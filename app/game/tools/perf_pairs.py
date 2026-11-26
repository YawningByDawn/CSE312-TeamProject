#!/usr/bin/env python3
"""Price a change: alternated before/after pairs of the frame's cost by state on the game VM, the one way (docs/contracts/perf.md, Method).

usage: python tools/perf_pairs.py --pairs N --before <worktree>
  e.g. python tools/perf_pairs.py --pairs 5 --before ../perf-base

The after arm is this worktree, the before arm <worktree> (a worktree of the same base without the change). Each run is one
`tools/browser_job.py --build OUT=... node e2e/perf.cjs` job from its arm's own worktree; pair i runs before first when
i is odd and after first when it is even, so the VM's load drift falls on both arms. Every run's perf.json and log land
under screenshots/pairs/<stamp>/ here; the summary (each metric's mean, range and N per arm, and each run's 1-minute VM load
before it) is printed and written as summary.json there. A run that failed (a console error fails it) is listed with its
reason and left out of the means. Exits 1 when any run failed.
"""
from __future__ import annotations

import argparse
import json
import shutil
import statistics
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARMS = ("before", "after")


def order(pairs: int) -> list[tuple[int, str]]:
    """(pair, arm) in run order: pair i runs before first when i is odd, after first when it is even."""
    return [(i, arm) for i in range(1, pairs + 1) for arm in (ARMS if i % 2 else ARMS[::-1])]


def metrics(rep: dict) -> dict[str, float]:
    """The numbers of one perf.json: the game's own frame in each state, and the profiled page's counts at rest."""
    f = rep["frame"]
    out = {"fps": round(1000 / f["interval"], 1), "draws/f": f["draws"], "uploads/f": f["uploads"], "heap MB": rep["memory"]["heapMB"]}
    for state, g in rep["game"].items():
        out |= {f"{state}: cb ms": g["cb"], f"{state}: alloc KB/f": g["allocKB"], f"{state}: GCs": g["gcs"]}
        if g.get("gpu") is not None:
            out[f"{state}: GPU ms"] = g["gpu"]
    return out


def summary(runs: list[dict]) -> dict[str, dict[str, dict[str, float]]]:
    """{metric: {arm: {mean, min, max, n}}} over the runs that count (no failure, no console error)."""
    vals: dict[str, dict[str, list[float]]] = {}
    for run in runs:
        if run["why"]:
            continue
        for k, v in run["metrics"].items():
            vals.setdefault(k, {}).setdefault(run["arm"], []).append(v)
    return {k: {arm: {"mean": round(statistics.mean(vs), 2), "min": min(vs), "max": max(vs), "n": len(vs)}
                for arm, vs in arms.items()} for k, arms in vals.items()}


def cell(m: dict[str, float] | None) -> str:
    return f"{m['mean']} ({m['min']}-{m['max']}, N={m['n']})" if m else "-"


def run_one(worktree: Path, rel: str, log: Path) -> dict:
    """One perf job from `worktree`; its report (or why there is none) and the VM load it ran under."""
    argv = [sys.executable, "tools/browser_job.py", "--build", f"OUT={rel}", "node", "e2e/perf.cjs"]
    p = subprocess.run(argv, cwd=worktree, capture_output=True, text=True)
    log.write_text(p.stdout + p.stderr)
    rep_path = worktree / rel / "perf.json"
    rep = json.loads(rep_path.read_text()) if rep_path.is_file() else None
    why = (f"exit {p.returncode}" if p.returncode else "") or ("no perf.json" if rep is None else "")
    return {"rep": rep, "why": why, "vm": (rep or {}).get("vm")}


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--pairs", type=int, required=True)
    ap.add_argument("--before", type=Path, required=True, help="the before arm's worktree")
    a = ap.parse_args(argv)
    if a.pairs < 1 or not (a.before / "e2e" / "perf.cjs").is_file():
        ap.error("--pairs is at least 1 and --before a worktree with e2e/perf.cjs")
    trees = {"before": a.before.resolve(), "after": ROOT}
    stamp = time.strftime("%Y%m%d-%H%M%S")
    out = ROOT / "screenshots" / "pairs" / stamp
    out.mkdir(parents=True)
    runs = []
    for i, arm in order(a.pairs):
        rel = f"screenshots/pairs/{stamp}/{arm}-{i}"
        r = run_one(trees[arm], rel, out / f"{arm}-{i}.log")
        if trees[arm] != ROOT and (trees[arm] / rel).is_dir():
            shutil.copytree(trees[arm] / rel, ROOT / rel, dirs_exist_ok=True)
        vm = r["vm"] or {}
        runs.append({"pair": i, "arm": arm, "why": r["why"], "vm": vm, "metrics": metrics(r["rep"]) if r["rep"] else {}})
        print(f"{arm}-{i}: {r['why'] or 'ok'} | VM load {vm.get('load1Start', '-')} before", flush=True)
    s = summary(runs)
    (out / "summary.json").write_text(json.dumps({"before": str(trees["before"]), "runs": runs, "summary": s}, indent=1))
    print("\n| metric | before | after |\n|---|---|---|")
    for k, arms in s.items():
        print(f"| {k} | {cell(arms.get('before'))} | {cell(arms.get('after'))} |")
    print(f"\n{out.relative_to(ROOT)}/summary.json")
    return 1 if any(r["why"] for r in runs) else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
