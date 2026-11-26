import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bots  # noqa: E402


def test_argv_is_plain_npm_run_bots():
    a = bots.bots_argv(["200", "--workers=2"])
    assert a[1:] == ["run", "bots", "--", "200", "--workers=2"]


def test_env_adds_cap_and_keeps_existing_options():
    assert bots.bots_env({})["NODE_OPTIONS"] == f"--max-old-space-size={bots.HEAP_MB}"
    assert bots.bots_env({"NODE_OPTIONS": "--trace-warnings", "X": "1"}) == {
        "X": "1", "NODE_OPTIONS": f"--trace-warnings --max-old-space-size={bots.HEAP_MB}"}


@pytest.mark.skipif(shutil.which("node") is None, reason="node missing")
def test_node_child_gets_the_heap_limit():
    env = bots.bots_env({})
    js = "console.log(JSON.stringify(require('v8').getHeapStatistics().heap_size_limit))"
    limit = json.loads(subprocess.run([shutil.which("node"), "-e", js], env=env, capture_output=True, text=True, check=True).stdout)
    mib = 1024 * 1024
    assert bots.HEAP_MB * mib <= limit <= (bots.HEAP_MB + 256) * mib     # V8 adds its young generation to the old space
    uncapped = json.loads(subprocess.run([shutil.which("node"), "-e", js], capture_output=True, text=True, check=True).stdout)
    assert uncapped > limit


def test_timeout_kills_and_returns_124(monkeypatch):
    monkeypatch.setattr(bots, "bots_argv", lambda extra: [sys.executable, "-c", "import time;time.sleep(60)"])
    assert bots.main(["--timeout", "0.5"]) == 124


def test_exit_code_passes_through(monkeypatch):
    monkeypatch.setattr(bots, "bots_argv", lambda extra: [sys.executable, "-c", "raise SystemExit(3)"])
    assert bots.main([]) == 3
