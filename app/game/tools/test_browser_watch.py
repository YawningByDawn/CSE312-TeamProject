import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import browser_watch as bw  # noqa: E402

NOW = 1_000_000.0
STAGE = bw.bj.STAGE


def start(i="aaaaaaaaaaaa", pid=100, t=NOW - 60, cwd="/w/hgiwatch"):
    return {"ev": "start", "id": i, "pid": pid, "t": t, "cwd": cwd, "command": "node e2e/perf-ui.cjs"}


def end(i="aaaaaaaaaaaa", exit=0, **kw):
    return {**start(i, **kw), "ev": "end", "exit": exit}


def client(pid=100, started=NOW - 61):
    return bw.Proc(pid, "python tools/browser_job.py node e2e/perf-ui.cjs", {}, "/w/hgiwatch", started)


def step(w, rows=(), procs=(), now=NOW, free=16.0):
    return w.step(list(rows), list(procs), now, free)


def test_a_failed_job_is_said_once_and_a_passed_job_is_not():
    w = bw.Watch()
    assert step(w, [start(), end()], [client()]) == []
    out = step(w, [start("bbbbbbbbbbbb"), end("bbbbbbbbbbbb", exit=1)])
    assert len(out) == 1 and out[0].startswith("job failed: hgiwatch exit=1")
    assert step(w) == []


def test_a_job_that_hit_the_hang_cap_is_said_as_hung_not_failed():
    out = step(bw.Watch(), [start(), end(exit=124)])
    assert len(out) == 1 and out[0].startswith("job hung: hgiwatch") and "7200" in out[0]


def test_a_job_whose_client_lives_past_the_limit_is_long_once_and_not_before():
    w = bw.Watch()
    assert step(w, [start(t=NOW)], [client(started=NOW)], now=NOW + bw.LONG_S - 1) == []
    out = step(w, [], [client(started=NOW)], now=NOW + bw.LONG_S + 1)
    assert len(out) == 1 and out[0].startswith("long job: hgiwatch running 30 min")
    assert step(w, [], [client(started=NOW)], now=NOW + bw.LONG_S + 60) == []


def test_a_job_whose_client_is_gone_without_a_result_is_lost_once():
    w = bw.Watch()
    out = step(w, [start()], [])
    assert len(out) == 1 and out[0].startswith("job lost: hgiwatch client pid 100")
    assert step(w, [], []) == []


def test_a_reused_pid_is_not_the_jobs_client():
    other = bw.Proc(100, "python tools/browser_job.py x", {}, "", NOW + 500)  # started after the job did
    assert step(bw.Watch(), [start()], [other])[0].startswith("job lost")


def test_a_tool_running_the_job_in_its_own_process_is_its_client():
    shot = bw.Proc(100, "python tools/shot.py --out screenshots/x ?scene=play", {}, "", NOW - 61)
    assert step(bw.Watch(), [start()], [shot]) == []


def test_arming_tracks_a_running_job_and_says_nothing_of_the_past():
    w = bw.Watch()
    w.arm([start("a" * 12), end("a" * 12, exit=1), start("b" * 12, pid=200), start("c" * 12, pid=300)], [client(200)])
    assert set(w.open) == {"b" * 12}
    assert step(w, [], [client(200)]) == []


def test_a_browser_whose_job_output_dir_is_gone_is_an_orphan_once(tmp_path):
    live = tmp_path / "out"
    live.mkdir()
    gone = tmp_path / "gone"
    chrome = lambda pid, out: bw.Proc(pid, "/c/chrome-headless-shell --headless", {"GAMEJOB_OUT": str(out)}, "/", NOW - 9)
    w = bw.Watch()
    out = step(w, procs=[chrome(7, gone), chrome(8, live)])
    assert len(out) == 1 and out[0].startswith("orphan process: pid 7") and "output directory" in out[0]
    assert step(w, procs=[chrome(7, gone)]) == []


def test_a_vite_server_in_the_stage_of_an_ended_job_is_an_orphan():
    vite = bw.Proc(9, "node node_modules/.bin/vite --port 41200", {}, f"/w/{STAGE}/aaaaaaaaaaaa/in", NOW - 9)
    w = bw.Watch()
    assert step(w, [start()], [client(), vite]) == []  # its job is still running
    out = step(w, [end()], [vite])
    assert len(out) == 1 and "stage of job aaaaaaaaaaaa, which ended" in out[0]


def test_a_name_alone_is_never_an_orphan():
    owners_chrome = bw.Proc(5, "/opt/google/chrome/chrome", {}, "/home/o", NOW - 9)
    stray_env = bw.Proc(6, "chromium --app", {"HOME": "/h"}, f"/w/{STAGE}/ffffffffffff/in", NOW - 9)  # a job the ledger never ended
    assert step(bw.Watch(), procs=[owners_chrome, stray_env]) == []


def test_a_gone_output_dir_on_a_process_that_is_no_browser_is_not_an_orphan(tmp_path):
    p = bw.Proc(4, "node e2e/perf-ui.cjs", {"GAMEJOB_OUT": str(tmp_path / "gone")}, "/", NOW - 9)
    assert step(bw.Watch(), procs=[p]) == []


def test_low_memory_is_said_on_the_second_low_reading_only_and_resets():
    w = bw.Watch()
    assert step(w, free=3.0) == []
    assert step(w, free=3.0) == ["low memory: 3.0 GB free"]
    assert step(w, free=3.0) == []
    assert step(w, free=9.0) == [] and step(w, free=3.0) == []


def test_the_ledger_is_read_from_a_position_and_a_half_written_row_waits(tmp_path):
    f = tmp_path / "jobs.jsonl"
    f.write_text(json.dumps(start()) + "\n" + json.dumps(end())[:20])
    rows, pos = bw.read_rows(f)
    assert [r["ev"] for r in rows] == ["start"]
    f.write_text(json.dumps(start()) + "\n" + json.dumps(end()) + "\nnot json\n")
    rows, pos2 = bw.read_rows(f, pos)
    assert [r["ev"] for r in rows] == ["end"] and bw.read_rows(f, pos2) == ([], pos2)
    assert bw.read_rows(tmp_path / "none.jsonl") == ([], 0)
