#!/usr/bin/env python3
"""Run one browser job on the game VM (a real GPU): every e2e script, bake, shot (tools/shot.py) and reel. The VM's job runner,
zunstack-app/tools/gamejob.py, starts a job whenever the VM has headroom and gives it GAMEJOB_PORT, the base of its GAMEJOB_PORTS ports.

usage: python tools/browser_job.py [--build] [--ship PATH]... [NAME=VALUE]... <command> [args...]
  e.g. python tools/browser_job.py --build STATIC=dist TABLE=1 node e2e/perf-ui.cjs

The job runs in a copy of this worktree: its working files (tracked and untracked, not the ignored ones, not screenshots/),
and each --ship path (a worktree-relative file or directory the job reads, e.g. a save under screenshots/). node_modules goes
as gamejob.py --deps: content-addressed, it crosses to the VM only when it changes.
--build puts a production build of the worktree at dist/ in the copy, reused while what it is built from is unchanged (keyed by
the git tree of the working files less NOT_BUILT; one build per key under .gamejob/dist/). The local environment does not reach the VM: the job's
environment is the VM's plus each NAME=VALUE, and a value that is a local absolute path or a loopback server is refused.
Every file the job writes or deletes inside its copy is written or deleted here in the worktree when it ends (screenshots/, a
bake's output). Prints the job's log, then its cost on stderr:
  [browser job] staged S s (N MB), round trip R s, exit N: <command>     (the VM's own run time is the log's last line)
A job runs until it finishes or this client dies (its group is killed then). Its one timeout is a hang cap, HANG_CAP_S, the same
for every job: never per script, a table or a flag.
Exits with the job's code (2 on a refusal or a relay failure).
"""
from __future__ import annotations

import argparse
import json
import os
import re
import secrets
import shlex
import shutil
import signal
import subprocess
import sys
import tempfile
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _proc import kill_group, spawn_group  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
GAMEJOB = Path.home() / "zunstack" / "zunstack-app" / "tools" / "gamejob.py"
HANG_CAP_S = 7200  # every job's one timeout: a guard against a hung job, never a budget
LEDGER = Path(tempfile.gettempdir()) / "hgi-browser-jobs.jsonl"  # a row at each job's start and end, every worktree: tools/browser_watch.py reads it
RAN = "ran_ms"  # under the job's output: the VM's own run time of the command, which the ledger's end row carries
STAGE = ".gamejob"  # under the worktree (gitignored): the copy hard-links the worktree's files, so it is on their filesystem
ENV_ARG = re.compile(r"^[A-Z_][A-Z0-9_]*=")
LOCAL_ONLY = re.compile(r"^/|^[A-Za-z]:[\\/]|//(127\.0\.0\.1|localhost)\b")
MIRROR_SKIP = ("node_modules",)
SHOTS = "screenshots/"
DISTS = "dist"  # under STAGE: one production build per key (dist_key)
NOT_BUILT = ("screenshots", "docs", "handoffs", "tests", "e2e", "*.md", "*.py")  # paths vite build never reads: out of dist_key


def say(msg: str) -> None:
    print(f"[browser job] {msg}", file=sys.stderr, flush=True)


def record(row: dict) -> None:
    with open(LEDGER, "a", encoding="utf-8") as f:
        f.write(json.dumps(row) + "\n")


def split_env(args: list[str]) -> tuple[dict[str, str], list[str]]:
    """Leading NAME=VALUE arguments (as env(1) takes them) and the command after them."""
    n = 0
    while n < len(args) and ENV_ARG.match(args[n]):
        n += 1
    return dict(a.split("=", 1) for a in args[:n]), args[n:]


def check_env(env: dict[str, str]) -> None:
    for k, v in env.items():
        if LOCAL_ONLY.search(v):
            raise ValueError(f"{k}={v}: a local absolute path or loopback server means nothing on the game VM (use a "
                             "worktree-relative path, --ship, --build or a server the job starts itself)")


def working_files(root: Path) -> list[str]:
    """The worktree's working files: tracked and untracked, not the ignored ones and not screenshots/ (a job writes there; it
    reads a shot only through --ship); a tracked file deleted here is left out."""
    out = subprocess.run(["git", "ls-files", "-co", "--exclude-standard", "-z"], cwd=root, capture_output=True, check=True).stdout
    return [p for p in out.decode().split("\0") if p and not p.startswith(SHOTS) and os.path.lexists(root / p)]


def _link(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    os.link(src, dst, follow_symlinks=False)


def stage(root: Path, d: Path, ship: list[str], build: bool) -> None:
    """A copy of the worktree for one job at d/in, hard-linked: working files and the --ship paths; with build, dist/."""
    for rel in working_files(root):
        _link(root / rel, d / "in" / rel)
    for rel in ship:
        src = root / rel
        if not src.exists() or src.resolve() == root.resolve() or root.resolve() not in src.resolve().parents:
            raise ValueError(f"--ship {rel}: not a file or directory inside the worktree")
        if src.is_dir():
            shutil.copytree(src, d / "in" / rel, symlinks=True, copy_function=os.link, dirs_exist_ok=True)
        else:
            _link(src, d / "in" / rel)
    if build:
        shutil.copytree(built_dist(root), d / "in" / "dist", symlinks=True, copy_function=os.link)


def dist_key(root: Path) -> str:
    """What a production build is made from: the git tree of the worktree's working files as they are now (ignored files and
    NOT_BUILT out, package-lock.json in). Written through a scratch index so the worktree's own index is untouched."""
    def git(*a: str, env: dict[str, str] | None = None) -> str:
        return subprocess.run(["git", *a], cwd=root, capture_output=True, text=True, check=True, env=env).stdout.strip()

    index = root / STAGE / f"index-{secrets.token_hex(6)}"
    index.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(root / git("rev-parse", "--git-path", "index"), index)  # its stat cache: only changed files are hashed
    env = {**os.environ, "GIT_INDEX_FILE": str(index)}
    try:
        git("add", "-A", "--", ".", *[f":(exclude){p}" for p in NOT_BUILT], env=env)
        git("rm", "-r", "-q", "-f", "--cached", "--ignore-unmatch", "--", *NOT_BUILT, env=env)   # their tracked entries too
        return git("write-tree", f"--prefix={git('rev-parse', '--show-prefix')}", env=env)   # the game's folder alone, not the repo's other files
    finally:
        index.unlink()


def built_dist(root: Path) -> Path:
    """The production build of the worktree as it is now: the one under .gamejob/dist/<dist_key> when there is one, else built
    there (into a scratch dir renamed into place, so a concurrent job never links a half build). Builds of other keys go."""
    key = dist_key(root)
    dists = root / STAGE / DISTS
    out = dists / key
    if out.is_dir():
        return out
    tmp = dists / f".{key}-{secrets.token_hex(6)}"
    npm = shutil.which("npm") or "npm"
    p = spawn_group([npm, "exec", "--", "vite", "build", "--outDir", str(tmp), "--emptyOutDir"], cwd=root, stdout=subprocess.DEVNULL)
    try:
        code = p.wait()
    finally:
        kill_group(p)
    if code:
        if tmp.exists():
            shutil.rmtree(tmp)
        raise RuntimeError(f"vite build exited {code}")
    try:
        tmp.rename(out)
    except OSError:
        if not out.is_dir():
            raise
        shutil.rmtree(tmp)  # a concurrent job built the same key first: its build is this one
    for old in dists.iterdir():
        if old.name != key and not old.name.startswith("."):
            shutil.rmtree(old)
    return out


def size_mb(d: Path) -> float:
    return sum(f.lstat().st_size for f in d.rglob("*") if f.is_file() and not f.is_symlink()) / (1 << 20)


def apply_back(out: Path, root: Path) -> int:
    """The job's writes and deletions inside its copy, made here. Returns how many files changed."""
    n = 0
    tree = out / "tree"
    if tree.is_dir():
        for f in tree.rglob("*"):
            if f.is_file() or f.is_symlink():
                dst = root / f.relative_to(tree)
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(f, dst, follow_symlinks=False)
                n += 1
    gone = out / "deleted.txt"
    if gone.exists():
        for rel in filter(None, gone.read_text().split("\n")):
            (root / rel).unlink()
            n += 1
    return n


def run_browser_job(args: list[str], build: bool = False, ship: tuple[str, ...] = (), root: Path = ROOT) -> int:
    """args ([NAME=VALUE]... command) on the game VM in a copy of the worktree; the job's exit code."""
    env, cmd = split_env(args)
    if not cmd:
        raise ValueError("no command given")
    check_env(env)
    command = shlex.join(args)
    t0 = time.monotonic()
    d = root / STAGE / secrets.token_hex(6)
    job = {"id": d.name, "pid": os.getpid(), "cwd": str(root), "command": command}
    record({"ev": "start", "t": time.time(), **job})
    code = 2  # a refusal or a failure before the VM ran the job
    cost = {}  # the end row's ms: staged here, the round trip from the hand-off until the result is here, the VM's run in it
    try:
        stage(root, d, list(ship), build)
        mb = size_mb(d / "in")
        t1 = time.monotonic()
        cost["staged_ms"] = round((t1 - t0) * 1000)
        p = subprocess.run([sys.executable, str(GAMEJOB), "run", "--in", str(d / "in"), "--out", str(d / "out"),
                            "--deps", str(root), "--timeout", str(HANG_CAP_S), "--", "python3", "-B", "tools/browser_job.py", "--exec", *args],
                           check=False)
        code = p.returncode
        t2 = time.monotonic()
        cost["trip_ms"] = round((t2 - t1) * 1000)
        if (d / "out" / RAN).exists():
            cost["run_ms"] = int((d / "out" / RAN).read_text())
        changed = apply_back(d / "out", root) if (d / "out").exists() else 0
    finally:
        if d.exists():
            shutil.rmtree(d)
        record({"ev": "end", "t": time.time(), "exit": code, **cost, **job})
    say(f"staged {t1 - t0:.1f} s ({mb:.0f} MB), round trip {t2 - t1:.1f} s, {changed} files back, exit {code}: {command}")
    return code


def snapshot(root: Path) -> dict[str, tuple[int, int]]:
    """Every file under root but node_modules: its (mtime ns, size)."""
    snap = {}
    for dirpath, dirs, files in os.walk(root):
        dirs[:] = [x for x in dirs if not (Path(dirpath) == root and x in MIRROR_SKIP)]
        for f in files:
            p = Path(dirpath) / f
            st = p.lstat()
            snap[str(p.relative_to(root))] = (st.st_mtime_ns, st.st_size)
    return snap


def exec_job(args: list[str]) -> int:
    """On the game VM, in the job's copy (the cwd): run the command with its NAME=VALUE environment as a process group, then
    put every file it wrote under $GAMEJOB_OUT/tree and the ones it deleted in $GAMEJOB_OUT/deleted.txt."""
    env, cmd = split_env(args)
    root, out = Path.cwd(), Path(os.environ["GAMEJOB_OUT"])
    before = snapshot(root)
    t0 = time.monotonic()
    p = spawn_group(cmd, env={**os.environ, **env})
    try:
        code = p.wait()
        ran = time.monotonic() - t0
    finally:
        kill_group(p)
    after = snapshot(root)
    for rel, st in after.items():
        if before.get(rel) != st:
            dst = out / "tree" / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(root / rel, dst, follow_symlinks=False)
    (out / "deleted.txt").write_text("".join(f"{rel}\n" for rel in sorted(set(before) - set(after))))
    (out / RAN).write_text(str(round(ran * 1000)))
    print(f"[browser job] ran {ran:.1f} s on the game VM from port {os.environ['GAMEJOB_PORT']}, exit {code}", flush=True)
    return code if code >= 0 else 128 - code


def _terminate(signum, _frame) -> None:
    raise SystemExit(128 + signum)


def main(argv: list[str]) -> int:
    for sig in (signal.SIGTERM,) if sys.platform == "win32" else (signal.SIGTERM, signal.SIGHUP):
        signal.signal(sig, _terminate)  # the finally blocks run: the job's group is killed, the local copy removed
    if argv[:1] == ["--exec"]:
        return exec_job(argv[1:])
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--build", action="store_true", help="a production build of the worktree at dist/ in the job's copy")
    ap.add_argument("--ship", action="append", default=[], help="a worktree-relative path the job reads that git ignores")
    ap.add_argument("args", nargs=argparse.REMAINDER, help="[NAME=VALUE]... command [args...]")
    a = ap.parse_args(argv)
    try:
        return run_browser_job(a.args, a.build, tuple(a.ship))
    except (ValueError, RuntimeError) as e:
        say(str(e))
        return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
