"""Shared process plumbing for the pipeline tools: a child in its own process group (POSIX) or Job Object (Windows), killed as a
group. One code path for Linux, macOS and Windows; the OS differences sit in this file only."""
from __future__ import annotations

import ctypes
import os
import signal
import subprocess
import sys
import time
from ctypes import wintypes

WIN = sys.platform == "win32"

JOB_KILL_ON_CLOSE = 0x2000
JOB_MEMORY = 0x200
JOB_EXTENDED_LIMIT_INFO = 9


class _BasicLimits(ctypes.Structure):
    # DWORD is 32 bits on Windows; ctypes' wintypes.DWORD is c_ulong, 64 bits off Windows, so the layout names c_uint32
    _fields_ = [("PerProcessUserTimeLimit", ctypes.c_int64), ("PerJobUserTimeLimit", ctypes.c_int64),
                ("LimitFlags", ctypes.c_uint32), ("MinimumWorkingSetSize", ctypes.c_size_t),
                ("MaximumWorkingSetSize", ctypes.c_size_t), ("ActiveProcessLimit", ctypes.c_uint32),
                ("Affinity", ctypes.c_size_t), ("PriorityClass", ctypes.c_uint32), ("SchedulingClass", ctypes.c_uint32)]


class _ExtendedLimits(ctypes.Structure):
    _fields_ = [("Basic", _BasicLimits), ("IoCounters", ctypes.c_uint64 * 6), ("ProcessMemoryLimit", ctypes.c_size_t),
                ("JobMemoryLimit", ctypes.c_size_t), ("PeakProcessMemoryUsed", ctypes.c_size_t),
                ("PeakJobMemoryUsed", ctypes.c_size_t)]


def job_limits(mem_mb: int | None) -> _ExtendedLimits:
    """The job limits: every process in the job ends when its last handle closes, and with `mem_mb` the whole job's
    committed memory is capped at that many MiB."""
    info = _ExtendedLimits()
    info.Basic.LimitFlags = JOB_KILL_ON_CLOSE | (JOB_MEMORY if mem_mb else 0)
    info.JobMemoryLimit = (mem_mb or 0) << 20
    return info


def scope_argv(argv: list[str], mem_mb: int) -> list[str]:
    """Linux: argv in a transient user scope whose cgroup caps the whole group at `mem_mb` MiB with no swap. systemd-run
    expands `$` in its arguments unless told not to."""
    return ["systemd-run", "--user", "--scope", "--quiet", "--expand-environment=no", "-p", f"MemoryMax={mem_mb}M",
            "-p", "MemorySwapMax=0", "--", *argv]


_JOBS: dict[int, int] = {}  # Windows: leader pid -> its Job Object handle


def _k32():
    k = ctypes.WinDLL("kernel32", use_last_error=True)
    k.CreateJobObjectW.restype = wintypes.HANDLE
    k.CreateJobObjectW.argtypes = [ctypes.c_void_p, wintypes.LPCWSTR]
    k.SetInformationJobObject.argtypes = [wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD]
    k.AssignProcessToJobObject.argtypes = [wintypes.HANDLE, wintypes.HANDLE]
    k.TerminateJobObject.argtypes = [wintypes.HANDLE, wintypes.UINT]
    k.CloseHandle.argtypes = [wintypes.HANDLE]
    return k


def _job_for(p: subprocess.Popen, mem_mb: int | None) -> None:
    k = _k32()
    job = k.CreateJobObjectW(None, None)
    info = job_limits(mem_mb)
    if (not job or not k.SetInformationJobObject(job, JOB_EXTENDED_LIMIT_INFO, ctypes.byref(info), ctypes.sizeof(info))
            or not k.AssignProcessToJobObject(job, int(p._handle))):
        raise ctypes.WinError(ctypes.get_last_error())
    _JOBS[p.pid] = job


def spawn_group(argv: list[str], mem_mb: int | None = None, **kw) -> subprocess.Popen:
    """Start argv as the leader of a new process group (POSIX session) or of a Job Object that dies with its last handle
    (Windows). `mem_mb` caps the whole group's memory where the OS has a group cap: a cgroup scope on Linux, the job's memory
    limit on Windows. macOS has no such cap; there the group holds only to its processes' own limits."""
    if WIN:
        p = subprocess.Popen(argv, **kw)
        _job_for(p, mem_mb)
        return p
    if mem_mb and sys.platform.startswith("linux"):
        argv, kw["env"] = scope_argv(argv, mem_mb), user_manager_env(kw.get("env"))
    return subprocess.Popen(argv, start_new_session=True, **kw)


def user_manager_env(env: dict | None) -> dict:
    """`env` (default: ours) naming the user's systemd manager, which `systemd-run --user` reaches through XDG_RUNTIME_DIR:
    the one given, else systemd's own `/run/user/<uid>`. No manager there is a RuntimeError: a cap is never dropped."""
    env = dict(os.environ if env is None else env)
    runtime = env.get("XDG_RUNTIME_DIR") or f"/run/user/{os.getuid()}"
    if not os.path.exists(os.path.join(runtime, "systemd", "private")):
        raise RuntimeError(f"no user systemd manager at {runtime}: a memory-capped group needs one")
    env["XDG_RUNTIME_DIR"] = runtime
    return env


def kill_group(p: subprocess.Popen, grace_s: float = 0.5) -> None:
    """End p and every descendant. POSIX: TERM the group, give it grace_s, KILL the group, and only then reap the leader, so the
    group id cannot be recycled before the signals land. Windows: terminate the job and close it."""
    if WIN:
        if job := _JOBS.pop(p.pid, None):
            k = _k32()
            terminated = k.TerminateJobObject(job, 1)
            k.CloseHandle(job)
            if not terminated:
                raise ctypes.WinError(ctypes.get_last_error())
    else:
        for sig in (signal.SIGTERM, signal.SIGKILL):
            # no such group: ESRCH; a group left only with zombies: EPERM on macOS. Both mean nothing is left to signal.
            try:
                os.killpg(p.pid, sig)
            except (ProcessLookupError, PermissionError):
                break
            if sig == signal.SIGTERM:
                time.sleep(grace_s)
    p.wait()


def group_alive(pid: int) -> bool:
    """True while any process of the group led by pid exists (POSIX only; Windows reports the leader)."""
    if WIN:
        out = subprocess.run(["tasklist", "/FI", f"PID eq {pid}"], capture_output=True, text=True).stdout
        return str(pid) in out
    try:
        os.killpg(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True
