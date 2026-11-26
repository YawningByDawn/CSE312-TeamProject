#!/usr/bin/env python3
"""Runs the bot players on the rebuilt sim (`npm run bots` -> scripts/bots/table.ts) and prints the balance table they print.

usage: python tools/bots.py [--timeout S] [-- <table args>]
e.g.   python tools/bots.py -- 500 all --md
       python tools/bots.py -- 200 decent,cautious --workers=2

The runner is one node process; its workers are threads, each capped by its own heap limit. The process carries node's
`--max-old-space-size` cap through NODE_OPTIONS, on every OS, so a runaway sim dies on its own heap limit; the whole run is one
group capped at GROUP_MB where the OS caps a group (Linux, Windows). The timeout kills the whole process group when it expires.
Exit code: the bots' own, 124 on timeout.
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _proc import kill_group, spawn_group  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
HEAP_MB = 1536     # each bot process's V8 old space
GROUP_MB = 4096    # the whole run, where the OS caps a group (`_proc.spawn_group`)


def bots_argv(extra: list[str]) -> list[str]:
    return [shutil.which("npm") or "npm", "run", "bots", "--", *extra]


def bots_env(env: dict[str, str]) -> dict[str, str]:
    """env with the heap cap added to NODE_OPTIONS (inherited by tsx and by every worker the sim forks)."""
    return {**env, "NODE_OPTIONS": f"{env.get('NODE_OPTIONS', '')} --max-old-space-size={HEAP_MB}".strip()}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--timeout", type=float, default=1800.0)
    ap.add_argument("extra", nargs="*", help="after `--`: arguments for scripts/bots/table.ts")
    a = ap.parse_args(argv)
    p = spawn_group(bots_argv(a.extra), mem_mb=GROUP_MB, cwd=ROOT, env=bots_env(dict(os.environ)))
    try:
        return p.wait(a.timeout)
    except subprocess.TimeoutExpired:
        print(f"bots.py: timed out after {a.timeout:.0f}s; killed", file=sys.stderr)
        return 124
    finally:
        kill_group(p)


if __name__ == "__main__":
    sys.exit(main())
