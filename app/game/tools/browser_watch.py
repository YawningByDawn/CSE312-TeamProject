"""The main session's watch over browser jobs. Run under Monitor: one stdout line per event, each said once.
Events: a browser job that failed or hit the hang cap, one that ran long, one whose client died without a result, a browser or
Vite server left running by a job that ended, free memory under 4 GB. A process is an orphan only by evidence: its job's output
directory (GAMEJOB_OUT) is gone, or it runs in the stage of a job the ledger shows ended; its name alone never says so.
Usage: python tools/browser_watch.py"""
from __future__ import annotations

import json
import os
import re
import sys
import time
from pathlib import Path
from typing import NamedTuple

sys.path.insert(0, str(Path(__file__).resolve().parent))
import browser_job as bj  # noqa: E402

LONG_S = 30 * 60  # a job whose client is alive past this is an event
MEM_GB = 4.0
POLL_S = 15
TARGET = re.compile(r"chrom|headless_shell|\bvite\b")  # what an orphan can be; the evidence, not this, makes it one
STAGE_ID = re.compile(re.escape(bj.STAGE) + r"[\\/]([0-9a-f]{12})(?:[\\/]|$)")


class Proc(NamedTuple):
    pid: int
    cmd: str
    env: dict
    cwd: str
    started: float


def process_table() -> list[Proc]:
    import psutil
    out = []
    for p in psutil.process_iter():
        try:
            cmd = " ".join(p.cmdline())
            target = TARGET.search(cmd)  # only a candidate's environment and cwd matter
            out.append(Proc(p.pid, cmd, p.environ() if target else {}, p.cwd() if target else "", p.create_time()))
        except psutil.Error:
            pass
    return out


def read_rows(path: Path, pos: int = 0) -> tuple[list[dict], int]:
    """The ledger's rows from byte `pos`, and the new position (a half-written last line is left for the next read)."""
    rows = []
    try:
        with open(path, "rb") as f:
            f.seek(pos)
            for ln in f:
                if not ln.endswith(b"\n"):
                    break
                pos += len(ln)
                try:
                    rows.append(json.loads(ln))
                except ValueError:
                    pass
    except OSError:
        pass
    return rows, pos


def is_client(procs: list[Proc], pid: int, since: float) -> Proc | None:
    """The live job client `pid` that started a job at `since` (a pid reused later started after it). The client is
    whatever process ran the job: `browser_job.py`, or a tool calling `run_browser_job` in its own process (`shot.py`)."""
    return next((p for p in procs if p.pid == pid and p.started <= since + 5), None)


class Watch:
    def __init__(self) -> None:
        self.open: dict[str, dict] = {}   # job id -> its start row, while no end row and its client lives
        self.ended: set[str] = set()
        self.said: set = set()
        self.low = 0

    def arm(self, rows: list[dict], procs: list[Proc]) -> None:
        """Take the ledger as it stands: a job still running is tracked; what ended or died before now is not an event."""
        for r in rows:
            self.row(r)
        self.open = {i: r for i, r in self.open.items() if is_client(procs, r["pid"], r["t"])}

    def row(self, r: dict) -> list[str]:
        wt = os.path.basename(r.get("cwd", ""))
        if r.get("ev") == "start":
            self.open[r["id"]] = r
            return []
        if r.get("ev") != "end":
            return []
        self.open.pop(r["id"], None)
        self.ended.add(r["id"])
        if r.get("exit") == 124:
            return [f"job hung: {wt} hit the {bj.HANG_CAP_S} s cap: {r.get('command', '')[:100]}"]
        if r.get("exit"):
            return [f"job failed: {wt} exit={r['exit']}: {r.get('command', '')[:100]}"]
        return []

    def say_once(self, key: tuple, line: str) -> list[str]:
        if key in self.said:
            return []
        self.said.add(key)
        return [line]

    def orphan(self, p: Proc) -> str | None:
        """Why p is a leftover of a job that ended, or None."""
        out = p.env.get("GAMEJOB_OUT")
        if out and not os.path.exists(out):
            return f"its job's output directory {out} is gone"
        m = STAGE_ID.search(p.cwd)
        if m and m.group(1) in self.ended:
            return f"it runs in the stage of job {m.group(1)}, which ended"
        return None

    def step(self, rows: list[dict], procs: list[Proc], now: float, free_gb: float) -> list[str]:
        lines = []
        for r in rows:
            lines += self.row(r)
        for i, r in list(self.open.items()):
            client = is_client(procs, r["pid"], r["t"])
            wt = os.path.basename(r["cwd"])
            if not client:
                del self.open[i]
                lines += self.say_once(("lost", i), f"job lost: {wt} client pid {r['pid']} is gone without a result: {r['command'][:100]}")
            elif now - r["t"] > LONG_S:
                lines += self.say_once(("long", i), f"long job: {wt} running {(now - r['t']) / 60:.0f} min: {r['command'][:100]}")
        for p in procs:
            if TARGET.search(p.cmd) and (why := self.orphan(p)):
                lines += self.say_once(("orphan", p.pid, p.started), f"orphan process: pid {p.pid}, {why}: {p.cmd[:100]}")
        self.low = self.low + 1 if free_gb < MEM_GB else 0
        if self.low == 2:
            lines.append(f"low memory: {free_gb:.1f} GB free")
        return lines


def main() -> None:
    try:
        import psutil
    except ImportError:
        sys.exit("browser_watch.py: needs psutil (run it with the zunstack-app venv python, or pip install psutil)")
    w = Watch()
    rows, pos = read_rows(bj.LEDGER)
    w.arm(rows, process_table())
    while True:
        rows, pos = read_rows(bj.LEDGER, pos)
        for ln in w.step(rows, process_table(), time.time(), psutil.virtual_memory().available / 2**30):
            print(ln, flush=True)
        time.sleep(POLL_S)


if __name__ == "__main__":
    main()
