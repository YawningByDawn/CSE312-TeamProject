import json
import os
import signal
import subprocess
import sys
import time
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import _proc  # noqa: E402
import shot  # noqa: E402


def test_target_and_name():
    assert shot.norm_target("?scene=play") == "/?scene=play"
    assert shot.norm_target("/dev/a.html") == "/dev/a.html"
    assert shot.shot_name(0, "?scene=play&seed=7") == "01-scene-play-seed-7.png"
    assert shot.shot_name(1, "?") == "02-root.png"


def test_parse_size():
    assert shot.parse_size("1280x720") == (1280, 720)
    with pytest.raises(SystemExit):
        shot.parse_size("big")


def test_out_dir_rules(tmp_path):
    (tmp_path / "screenshots").mkdir()
    assert shot.check_out_dir(tmp_path, None, "t1") == (tmp_path / "screenshots" / "shot-t1").resolve()
    assert shot.check_out_dir(tmp_path, "screenshots/mine", "t").name == "mine"
    for bad in ("screenshots/baselines", "screenshots/baselines/x", "screenshots", "elsewhere", "../x", "screenshots/../x"):
        with pytest.raises(SystemExit):
            shot.check_out_dir(tmp_path, bad, "t")


def _fake_job(tmp_path, monkeypatch, code=0, errors=()):
    """shot.main with the game VM's job replaced: records the call and writes the driver's result as the job would."""
    calls = []

    def job(args, build, root):
        spec = json.loads(args[2])
        calls.append({"args": args[:2], "spec": spec, "build": build, "root": root})
        if code == 0:
            res = {"shots": [{"url": s["url"], "file": s["file"], "errors": list(errors),
                              "ms": {"boot": 4100, "settle": 2600, "capture": 300}} for s in spec["shots"]]}
            (root / spec["result"]).parent.mkdir(parents=True, exist_ok=True)
            (root / spec["result"]).write_text(json.dumps(res))
        return code

    monkeypatch.setattr(shot, "run_browser_job", job)
    monkeypatch.setattr(shot, "ROOT", tmp_path)
    (tmp_path / "screenshots").mkdir()
    return calls


def test_a_shot_is_one_game_vm_job_on_a_build_with_worktree_relative_files(tmp_path, monkeypatch, capsys):
    calls = _fake_job(tmp_path, monkeypatch)
    assert shot.main(["--out", "screenshots/a", "?scene=play"]) == 0
    (c,) = calls
    assert c["args"] == ["node", "tools/shot-driver.cjs"] and c["build"] is True and c["root"] == tmp_path
    assert c["spec"]["shots"] == [{"url": "/?scene=play", "file": "screenshots/a/01-scene-play.png"}]
    assert c["spec"]["result"] == "screenshots/a/shots.json" and c["spec"]["dev"] is False
    out = capsys.readouterr().out.splitlines()
    assert out == [str(tmp_path / "screenshots/a/01-scene-play.png"), "  cost: boot 4.1 s, settle 2.6 s, capture 0.3 s"]


def test_dev_pages_need_no_build(tmp_path, monkeypatch):
    calls = _fake_job(tmp_path, monkeypatch)
    assert shot.main(["--dev", "--out", "screenshots/d", "/dev/town.html"]) == 0
    assert calls[0]["build"] is False and calls[0]["spec"]["dev"] is True


def test_console_errors_exit_1(tmp_path, monkeypatch, capsys):
    _fake_job(tmp_path, monkeypatch, errors=["boom"])
    assert shot.main(["--out", "screenshots/e", "?scene=play"]) == 1
    assert "  console error: boom" in capsys.readouterr().out


def test_a_failed_job_exits_2(tmp_path, monkeypatch):
    _fake_job(tmp_path, monkeypatch, code=124)
    assert shot.main(["--out", "screenshots/f", "?scene=play"]) == 2


def test_job_limits_kill_on_close_and_cap_memory():
    import ctypes
    info = _proc.job_limits(None)
    assert info.Basic.LimitFlags == 0x2000 and info.JobMemoryLimit == 0
    capped = _proc.job_limits(4096)
    assert capped.Basic.LimitFlags == 0x2000 | 0x200 and capped.JobMemoryLimit == 4096 << 20
    if ctypes.sizeof(ctypes.c_void_p) == 8:
        assert ctypes.sizeof(info) == 144      # JOBOBJECT_EXTENDED_LIMIT_INFORMATION on Win64


@pytest.mark.skipif(not sys.platform.startswith("linux"), reason="the cgroup scope is the Linux group cap")
def test_a_capped_group_runs_in_a_scope_with_that_memory_max():
    """The group's own cgroup carries the cap. Control arm: an uncapped group's cgroup has no 256M ceiling."""
    probe = ("import pathlib; cg = pathlib.Path('/proc/self/cgroup').read_text().split('::')[1].strip(); "
             "print(pathlib.Path('/sys/fs/cgroup' + cg + '/memory.max').read_text().strip())")
    p = _proc.spawn_group([sys.executable, "-c", probe], mem_mb=256, stdout=subprocess.PIPE, text=True)
    out, _ = p.communicate(timeout=60)
    assert p.returncode == 0 and out.strip() == str(256 << 20)
    q = _proc.spawn_group([sys.executable, "-c", probe], stdout=subprocess.PIPE, text=True)
    out, _ = q.communicate(timeout=60)
    assert out.strip() != str(256 << 20)


def test_the_user_manager_is_found_without_xdg_runtime_dir_and_its_absence_refuses(tmp_path):
    if sys.platform.startswith("linux") and os.path.exists(f"/run/user/{os.getuid()}/systemd/private"):
        assert _proc.user_manager_env({})["XDG_RUNTIME_DIR"] == f"/run/user/{os.getuid()}"
    with pytest.raises(RuntimeError, match="no user systemd manager"):
        _proc.user_manager_env({"XDG_RUNTIME_DIR": str(tmp_path)})


def test_the_scope_argv_does_not_expand_dollars():
    argv = _proc.scope_argv(["sh", "-c", "echo $HOME"], 100)
    assert "--expand-environment=no" in argv and argv[-3:] == ["sh", "-c", "echo $HOME"] and "MemoryMax=100M" in argv


def test_kill_signals_group_before_reaping_leader(monkeypatch):
    p = _proc.spawn_group([sys.executable, "-c", "import time;time.sleep(60)"])
    calls = []
    real_killpg, real_wait = os.killpg, p.wait
    monkeypatch.setattr(_proc.os, "killpg", lambda pid, sig: (calls.append(("killpg", sig)), real_killpg(pid, sig)))
    monkeypatch.setattr(p, "wait", lambda *a, **k: (calls.append(("wait",)), real_wait(*a, **k))[1])
    _proc.kill_group(p, grace_s=0)
    assert calls[:3] == [("killpg", signal.SIGTERM), ("killpg", signal.SIGKILL), ("wait",)]


def test_kill_of_a_finished_group_does_not_wait_out_the_grace():
    p = _proc.spawn_group([sys.executable, "-c", "pass"])
    p.wait()
    t0 = time.monotonic()
    _proc.kill_group(p, grace_s=5)
    assert time.monotonic() - t0 < 1


TERM_AWARE = (
    "import signal,sys,time\n"
    "signal.signal(signal.SIGTERM, lambda *a: (open(sys.argv[1],'w').write('term'), sys.exit(0)))\n"
    "print('up',flush=True)\n"
    "time.sleep(60)\n"
)


def test_descendants_get_term_before_kill(tmp_path):
    script, mark = tmp_path / "t.py", tmp_path / "mark"
    script.write_text(TERM_AWARE)
    p = _proc.spawn_group([sys.executable, str(script), str(mark)], stdout=subprocess.PIPE, text=True)
    assert p.stdout.readline().strip() == "up"
    _proc.kill_group(p)
    assert mark.read_text() == "term"
