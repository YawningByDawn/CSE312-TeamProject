import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import perf_pairs as pp  # noqa: E402


def test_the_arms_alternate_which_runs_first():
    assert pp.order(3) == [(1, "before"), (1, "after"), (2, "after"), (2, "before"), (3, "before"), (3, "after")]


REP = {
    "game": {"rest": {"frames": 240, "cb": 0.281, "allocKB": 0, "gcs": 0, "gpu": None},
             "zoom": {"frames": 240, "cb": 0.758, "allocKB": 1.5, "gcs": 2, "gpu": 0.924}},
    "frame": {"cb": 1.77, "cbP95": 7.1, "interval": 16.7, "draws": 10, "uploads": 0, "allocKB": 195.5},
    "memory": {"heapMB": 66.0},
}


def test_a_report_gives_the_games_own_frame_by_state_and_the_profiled_counts():
    assert pp.metrics(REP) == {"fps": 59.9, "draws/f": 10, "uploads/f": 0, "heap MB": 66.0,
                               "rest: cb ms": 0.281, "rest: alloc KB/f": 0, "rest: GCs": 0,
                               "zoom: cb ms": 0.758, "zoom: alloc KB/f": 1.5, "zoom: GCs": 2, "zoom: GPU ms": 0.924}


def test_the_summary_counts_only_clean_runs_per_arm():
    runs = [{"arm": "before", "why": "", "metrics": {"x": 4}}, {"arm": "before", "why": "", "metrics": {"x": 6}},
            {"arm": "after", "why": "", "metrics": {"x": 1}}, {"arm": "after", "why": "2 console errors", "metrics": {"x": 99}}]
    assert pp.summary(runs) == {"x": {"before": {"mean": 5, "min": 4, "max": 6, "n": 2}, "after": {"mean": 1, "min": 1, "max": 1, "n": 1}}}
    assert pp.cell(None) == "-" and pp.cell({"mean": 5, "min": 4, "max": 6, "n": 2}) == "5 (4-6, N=2)"
