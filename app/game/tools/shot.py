#!/usr/bin/env python3
"""The only sanctioned screenshot launcher. One job on the game VM (tools/browser_job.py): a production build of the worktree,
served there, shot by headless Chromium on the VM's GPU (tools/shot-driver.cjs); the PNGs come back under screenshots/.

usage: python tools/shot.py [--out DIR] [--size 1280x720] [--settle MS] [--wait-for JS] [--wait-for-ms MS] [--dev] <url-or-query> [...]
e.g.   python tools/shot.py "?scene=play&seed=7&mute=1" "?scene=play&seed=7&mute=1&view=2"

A target is a query string ("?scene=play&seed=7") or a path. --dev serves the worktree with the vite dev server instead of a
build, for a dev page ("/dev/dress.html?x=1", not in the build); a dev page has no game clock, so --settle is wall-clock ms.
--out is a directory under screenshots/ (default screenshots/shot-<timestamp>); screenshots/baselines/ is refused.
Prints per shot its path, its cost (boot: load and --wait-for; settle; capture) and its console errors; the job's own cost
is browser_job.py's line. Exit 1 when any shot recorded a console or page error, 2 on usage or infrastructure failure.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from browser_job import run_browser_job  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SHOTS = "screenshots"


def check_out_dir(root: Path, out: str | None, stamp: str) -> Path:
    """The output dir: inside <root>/screenshots, never inside screenshots/baselines. SystemExit(2) otherwise."""
    shots = (root / SHOTS).resolve()
    d = (root / (out or f"{SHOTS}/shot-{stamp}")).resolve()
    if d == shots or shots not in d.parents:
        raise SystemExit(f"--out must be a directory under {SHOTS}/ (got {d})")
    if (shots / "baselines") in (d, *d.parents):
        raise SystemExit(f"{SHOTS}/baselines/ is never written by shot.py (got {d})")
    return d


def shot_name(i: int, target: str) -> str:
    slug = re.sub(r"[^A-Za-z0-9]+", "-", target).strip("-")[:80] or "root"
    return f"{i + 1:02d}-{slug}.png"


def norm_target(t: str) -> str:
    return t if t.startswith("/") else "/" + t


def parse_size(s: str) -> tuple[int, int]:
    m = re.fullmatch(r"(\d+)x(\d+)", s)
    if not m:
        raise SystemExit(f"--size is WIDTHxHEIGHT (got {s!r})")
    return int(m[1]), int(m[2])


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("targets", nargs="+", help='query strings or paths, e.g. "?scene=play&seed=7&mute=1"')
    ap.add_argument("--out")
    ap.add_argument("--size", default="1280x720")
    ap.add_argument("--settle", type=int, default=2500, help="game-time ms (window.__hg.app.time) to let pass after load before each shot")
    ap.add_argument("--wait-for", help="JS expression that must turn truthy before the shot (e.g. window.__hg?.play?.mode==='night')")
    ap.add_argument("--wait-for-ms", type=int, default=90000, help="wall-clock ms each wait (--wait-for, then the settle) may take")
    ap.add_argument("--dev", action="store_true", help="serve the worktree with the vite dev server (dev pages); --settle is wall-clock")
    a = ap.parse_args(argv)
    w, h = parse_size(a.size)
    out = check_out_dir(ROOT, a.out, time.strftime("%Y%m%d-%H%M%S"))
    rel = out.relative_to(ROOT.resolve())
    result = rel / "shots.json"
    shots = [{"url": norm_target(t), "file": str(rel / shot_name(i, t))} for i, t in enumerate(a.targets)]
    job = {"shots": shots, "width": w, "height": h, "settleMs": a.settle, "waitFor": a.wait_for, "waitForMs": a.wait_for_ms,
           "dev": a.dev, "result": str(result)}
    try:
        code = run_browser_job(["node", "tools/shot-driver.cjs", json.dumps(job)], build=not a.dev, root=ROOT)
    except (ValueError, RuntimeError) as e:
        print(f"shot.py: {e}", file=sys.stderr)
        return 2
    if code:
        print(f"shot.py: the shot job exited {code}", file=sys.stderr)
        return 2
    bad = 0
    for s in json.loads((ROOT / result).read_text())["shots"]:
        print(ROOT / s["file"])
        print("  cost: " + ", ".join(f"{k} {v / 1000:.1f} s" for k, v in s["ms"].items()))
        for e in s["errors"]:
            print(f"  console error: {e}")
            bad += 1
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
