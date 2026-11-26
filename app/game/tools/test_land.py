import datetime
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import land  # noqa: E402

Q = """| Row | Spec | State |
|---|---|---|
| Fog (1) | x | working: a |
| Rain | y | idle |
"""


def rows(text: str = Q):
    return land.parse_queue(text)


def test_trailers_multiline():
    msg = "feat\n\nQueue: Fog\nQueue: Rain (2)\n  more\nCo-Authored-By: x\n"
    assert land.trailers(msg, "Queue") == ["Fog", "Rain (2) more"]
    assert land.trailers("no trailer", "Queue") == []


def test_parse_queue_skips_header_and_sep_and_keeps_width():
    r = rows()
    assert land.states(r) == {"fog": "working: a", "rain": "idle"}
    assert r["fog"].width == 3 and r["fog"].cells[0].strip() == "Fog (1)"


def test_unmarked_rules():
    before = land.states(rows())
    assert land.unmarked(["Rain"], before, {**before, "rain": "working: b"}) == []
    assert land.unmarked(["Rain"], before, before) == ["Rain"]
    assert land.unmarked(["Rain"], before, {k: v for k, v in before.items() if k != "rain"}) == []
    assert land.unmarked(["Rain"], before, {**before, "rain": "done-ish"}) == ["Rain"]
    assert land.unmarked(["Nope"], before, before) == ["Nope (no such row)"]
    assert land.unmarked(["Fog"], before, {**before, "fog": "waiting on me: z"}) == []


def queue_with(state: str) -> str:
    return Q.replace("| Rain | y | idle |", f"| Rain | y | {state} |")


def test_state_gate_controls_and_refusals():
    before = rows()
    assert land.state_problems(before, rows(queue_with("working: ok"))) == []
    assert land.state_problems(before, rows(queue_with("waiting on the owner: ok"))) == []
    assert land.state_problems(before, rows(queue_with("working: " + "w " * 59))) == []   # 60 words
    long = land.state_problems(before, rows(queue_with("working: " + "w " * 60)))   # 61 words
    assert len(long) == 1 and "61 words" in long[0]
    pipe = land.state_problems(before, rows(queue_with("working: a | b")))
    assert len(pipe) == 1 and "4 cells" in pipe[0]
    start = land.state_problems(before, rows(queue_with("idle again")))
    assert len(start) == 1 and "neither" in start[0]


def test_state_gate_ignores_untouched_rows():
    assert land.state_problems(rows(), rows()) == []   # Rain's `idle` is not this branch's change


EXPLAINED = "feat\n\nDirective: d\nLanded: l\n"
DEFERRED_EMPTY = "| Row | Spec | State |\n|---|---|---|\n"


def gate(msgs, before, after, branch="br", approved=frozenset(), logged=()):
    return land.queue_gate(msgs, before, after, branch, set(approved), list(logged))


def test_queue_gate_completion_needs_a_trailer_naming_the_row():
    before = rows()
    gone = rows(Q.replace("| Rain | y | idle |\n", ""))
    assert gate(EXPLAINED + "Queue: Rain\n", before, gone) == []
    why = gate(EXPLAINED, before, gone)
    assert len(why) == 1 and "no `Queue: <row id>` commit trailer or added docs/queue-log.md line names" in why[0]
    assert gate(EXPLAINED + "Queue: Rain\n", before, rows(queue_with("working: b"))) == []   # marking, not completing


def test_a_removed_row_is_also_named_by_an_added_queue_log_line():
    before, gone = rows(), rows(Q.replace("| Rain | y | idle |\n", ""))
    assert gate(EXPLAINED, before, gone, logged=["- 2026-11-25 · Rain · asked · did it · abc\n"]) == []   # a log line names the row
    assert gate(EXPLAINED, before, gone, logged=["- 2026-11-25 · Rainy · x · y · z\n"])   # control: another row's line names nothing


def test_every_landing_must_explain_itself_with_directive_and_landed():
    assert gate(EXPLAINED, rows(), rows()) == []
    for msg, missing in (("feat\n\nLanded: l\n", "Directive"), ("feat\n\nDirective: d\n", "Landed"), ("feat", "Directive, Landed")):
        why = gate(msg, rows(), rows())
        assert len(why) == 1 and f"(missing: {missing})" in why[0]


def test_queue_gate_reports_every_refusal_together():
    why = gate("feat\n\nQueue: Rain\n", rows(), rows(queue_with("idle again")))
    assert len(why) == 3 and "explain itself" in why[0] and "States must start" in why[1] and "left unmarked" in why[2]


def test_a_row_moved_to_the_deferred_file_is_no_removal_but_a_row_deleted_from_both_is(tmp_path):
    root = repo(tmp_path / "r", {land.QUEUE: Q, land.DEFERRED: DEFERRED_EMPTY})
    base = land.rows_at("HEAD", True, root)
    assert sorted(base) == ["fog", "rain"]
    commit(root, {land.QUEUE: Q.replace("| Rain | y | idle |\n", ""), land.DEFERRED: DEFERRED_EMPTY + "| Rain | y | waiting on the owner: which |\n"})
    assert gate(EXPLAINED, base, land.rows_at("HEAD", False, root)) == []      # moved: nothing removed, its new State is a status
    commit(root, {land.DEFERRED: DEFERRED_EMPTY})
    why = gate(EXPLAINED, base, land.rows_at("HEAD", False, root))
    assert len(why) == 1 and "drops row(s) rain" in why[0]


def test_a_base_that_predates_the_deferred_file_reads_with_no_deferred_rows(tmp_path):
    root = repo(tmp_path / "r", {land.QUEUE: Q})
    assert sorted(land.rows_at("HEAD", False, root)) == ["fog", "rain"]


def test_stale_states_name_only_this_branch_in_a_pending_clause():
    st = {"char": "the style; branches artb and charart not landed", "ui": "branch uithemea pending",
          "perf": "working: perf2 landed, next fog", "x": "artbx pending"}
    assert land.stale_states(st, "charart") == ["char"] and land.stale_states(st, "uithemea") == ["ui"]
    assert land.stale_states(st, "perf2") == [] and land.stale_states(st, "artb") == ["char"]
    assert land.stale_states(st, "art") == []                                  # a longer name is another branch
    why = gate(EXPLAINED, rows(), rows(queue_with("working: br pending")), branch="br")
    assert len(why) == 1 and "still calls branch br unlanded in row(s) rain" in why[0]
    assert gate(EXPLAINED, rows(), rows(queue_with("working: br pending")), branch="other") == []   # control


def test_a_row_waiting_on_a_playtest_card_stays_live_until_the_owner_approves_it(tmp_path):
    waiting = {"feel": "waiting on the owner: playtest pt-1", "other": "working: x"}
    gone = {"other": "working: x"}
    f = tmp_path / land.DECISIONS
    f.parent.mkdir(parents=True)
    verdicts = lambda *s: f.write_text(json.dumps({"decisions": {"pt-1": [{"at": "t", "status": x, "note": ""} for x in s]}}), encoding="utf-8")   # noqa: E731
    assert land.approved_cards(tmp_path / "none") == set()                   # no decisions file
    verdicts("rejected")
    assert land.approved_cards(tmp_path) == set()
    assert land.playtest_held(waiting, gone, land.approved_cards(tmp_path)) == ["feel"]   # removing the row is refused
    assert land.playtest_held(waiting, waiting, set()) == []                 # kept Live
    assert land.playtest_held(gone, {}, set()) == []                         # other rows leave as before
    verdicts("approved", "revise")                                           # the latest ruling decides
    assert land.playtest_held(waiting, gone, land.approved_cards(tmp_path)) == ["feel"]
    verdicts("rejected", "approved")
    assert land.approved_cards(tmp_path) == {"pt-1"}
    assert land.playtest_held(waiting, gone, land.approved_cards(tmp_path)) == []        # approved: the row may leave


def test_the_queue_gate_holds_a_playtest_row_until_approved():
    before = rows(Q.replace("| Rain | y | idle |", "| Rain | y | waiting on the owner: playtest pt-9 |"))
    gone = rows(Q.replace("| Rain | y | idle |\n", ""))
    why = gate(EXPLAINED + "Queue: Rain\n", before, gone)
    assert len(why) == 1 and "playtest card the owner has not approved" in why[0]
    assert gate(EXPLAINED + "Queue: Rain\n", before, gone, approved={"pt-9"}) == []   # control


def test_the_queue_log_only_grows():
    assert land.log_only_appended("--- a/docs/queue-log.md\n+++ b/docs/queue-log.md\n@@ -1 +1,2 @@\n x\n+y\n")
    assert not land.log_only_appended("--- a/x\n+++ b/x\n@@ -1 +1 @@\n-x\n+y\n")


def test_log_entry_is_one_line_with_rows_or_a_dash_for_every_landing():
    msgs = "feat\n\nDirective: do it\nmore words\nLanded: fixed it\nQueue: Rain\n\nfix\n\nQueue: Rain\nQueue: Fog\n"
    assert land.log_entry("br", msgs, "abc\ndef\n", "2026-11-24") == \
        "- 2026-11-24 · Rain, Fog (br) · do it more words · fixed it · abc, def\n"
    assert land.log_entry("br", EXPLAINED, "abc\n", "2026-11-24") == "- 2026-11-24 · - (br) · d · l · abc\n"   # no row: still a line
    long = land.log_entry("br", "x\n\nDirective: " + "d" * 300 + "\nLanded: " + "l" * 300, "h", "2026-11-24")
    assert "d" * 159 + "…" in long and "l" * 199 + "…" in long and "d" * 160 not in long                  # clipped as ZvC clips


def test_log_commit_appends_the_line_through_the_lane_commit(monkeypatch, tmp_path):
    root = repo(tmp_path / "r", {land.QUEUE_LOG: "# log\n", "x.ts": "x0\n"})
    g(root, "checkout", "-q", "-b", "br")
    commit_msg(root, {"x.ts": "x1\n"}, "work\n\nDirective: d\nLanded: l\n")
    monkeypatch.setattr(land, "ROOT", root)
    ran = []
    monkeypatch.setattr(land, "step", lambda name, argv, cwd=None: ran.append((name, argv)))
    land.log_commit("/zs", "br", "main", "2026-11-24")
    assert (root / land.QUEUE_LOG).read_text(encoding="utf-8").splitlines()[1].startswith("- 2026-11-24 · - (br) · d · l · ")
    name, argv = ran[0]
    assert name == "queue-log entry" and argv[1:5] == ["/zs/engine/Universal/tooling/lib/gitlane.py", "commit", "--paths", land.QUEUE_LOG]


def repo(tmp_path: Path, files: dict[str, str]) -> Path:
    tmp_path.mkdir(exist_ok=True)
    subprocess.run(["git", "init", "-q", "-b", "main"], cwd=tmp_path, check=True)
    commit(tmp_path, files)
    return tmp_path


def commit(root: Path, files: dict[str, str]) -> str:
    for name, text in files.items():
        (root / name).parent.mkdir(parents=True, exist_ok=True)
        (root / name).write_text(text, encoding="utf-8")
    subprocess.run(["git", "add", "-A"], cwd=root, check=True)
    subprocess.run(["git", "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", "commit", "-q", "-m", "c"],
                   cwd=root, check=True)
    return subprocess.run(["git", "rev-parse", "HEAD"], cwd=root, capture_output=True, text=True, check=True).stdout.strip()


def test_queue_at_absent_on_base_is_empty_and_any_other_failure_raises(tmp_path):
    root = repo(tmp_path / "r", {"a.txt": "x"})
    assert land.queue_at("HEAD", True, root) == ""
    with pytest.raises(SystemExit, match="git show"):
        land.queue_at("HEAD", False, root)
    with pytest.raises(SystemExit, match="git ls-tree"):
        land.queue_at("no-such-ref", True, root)
    commit(root, {"docs/queue.md": Q})
    assert land.queue_at("HEAD", True, root) == Q
    assert land.queue_at("HEAD", False, root) == Q


def test_a_game_folder_in_a_bigger_repo_reads_every_git_path_relative_to_itself(tmp_path, monkeypatch):
    root = repo(tmp_path / "r", {"app/main.go": "x", "app/game/docs/queue.md": Q})
    game = root / "app" / "game"
    base = subprocess.run(["git", "rev-parse", "HEAD"], cwd=root, capture_output=True, text=True, check=True).stdout.strip()
    commit(root, {"app/game/src/a.ts": "1", "app/main.go": "y"})
    monkeypatch.setattr(land, "ROOT", game)
    assert land.queue_at("HEAD", False, game) == Q
    assert land.changed_files(f"{base}..HEAD") == ["src/a.ts"]
    assert land.game_dir(root) == game
    other = tmp_path / "other"
    other.mkdir()
    assert land.game_dir(other) == other / "app" / "game"


def test_import_graph_and_affected_tests():
    texts = {
        "src/a.ts": "export const a = 1",
        "src/b.ts": "import { a } from './a'",
        "src/c/index.ts": "export * from '../b.js'",
        "src/d.ts": "import data from './d.json'",
        "tests/b.test.ts": "import { a } from '../src/b'",
        "tests/c.test.ts": "import('../src/c')",
        "tests/d.test.ts": "import { x } from '../src/d'",
        "tests/e.test.ts": "import { y } from 'vitest'",
    }
    assert land.import_graph(texts)["src/c/index.ts"] == {"src/b.ts"}
    assert land.import_graph(texts)["src/d.ts"] == set()
    assert land.affected_tests(["src/a.ts"], texts) == ["tests/b.test.ts", "tests/c.test.ts"]   # transitive
    assert land.affected_tests(["tests/e.test.ts"], texts) == ["tests/e.test.ts"]   # a changed test is its own
    assert land.affected_tests(["src/d.ts"], texts) == ["tests/d.test.ts"]
    assert land.affected_tests(["README.md", "src/gone.ts"], texts) == []
    cites = {**texts, "tests/q.test.ts": "// the spec (docs/spec.md); the queue's rows: docs/queue.md"}
    assert land.affected_tests(["docs/queue.md", "docs/spec.md", "docs/refs/mine.png"], cites) == []   # docs select no test
    assert land.unmapped(["docs/queue.md"], cites) == []


def test_affected_python_tests():
    texts = {
        "tools/browser_job.py": "import os\nimport sys\n",
        "tools/shot.py": "import json\nfrom browser_job import run_browser_job  # noqa: E402\n",
        "tools/_proc.py": "import signal\n",
        "tools/land.py": "import re\n",
        "tools/test_browser_job.py": "import os, sys\nimport browser_job as bj  # noqa: E402\n",
        "tools/test_shot.py": "import _proc, shot\n",
        "tools/test_land.py": "    import land\n",
        "tools/test_bots.py": "import pytest\nfrom bots.x import y\n",
        "src/a.test.ts": "import { a } from './a'",
        "src/a.ts": "export const a = 1",
    }
    g = land.import_graph(texts)
    assert g["tools/shot.py"] == {"tools/browser_job.py"}
    assert g["tools/test_shot.py"] == {"tools/_proc.py", "tools/shot.py"}   # a comma list
    assert g["tools/test_bots.py"] == set()   # bots.py is not in texts
    assert land.affected_tests(["tools/browser_job.py"], texts) == ["tools/test_browser_job.py", "tools/test_shot.py"]   # through shot.py
    assert land.affected_tests(["tools/test_land.py"], texts) == ["tools/test_land.py"]   # a changed test is its own
    assert land.affected_tests(["tools/land.py", "src/a.ts"], texts) == ["src/a.test.ts", "tools/test_land.py"]
    assert land.affected_tests(["tools/_proc.py"], texts) == ["tools/test_shot.py"]


MAPS = {
    "src/d.ts": "import data from './d.json'",
    "src/d.json": "{}",
    "tests/d.test.ts": "import { x } from '../src/d'",
    "tests/m.test.ts": "readFileSync('assets/thread/manifest.json')",
    "tools/shot.py": "import os",
    "tools/test_shot.py": "import shot",
}


def test_a_json_maps_through_its_importer_and_a_named_path_through_the_test_that_names_it():
    assert land.affected_tests(["src/d.json"], MAPS) == ["tests/d.test.ts"]
    assert land.affected_tests(["assets/thread/manifest.json"], MAPS) == ["tests/m.test.ts"]
    assert land.affected_tests(["assets/thread/frame.png"], MAPS) == ["tests/m.test.ts"]   # a folder the test names
    assert land.affected_tests(["assets/other/frame.png"], MAPS) == []                       # control: another folder
    assert land.affected_tests(["tools/shot.py"], MAPS) == ["tools/test_shot.py"]


def test_package_and_tsconfig_changes_select_every_test():
    every = ["tests/d.test.ts", "tests/m.test.ts", "tools/test_shot.py"]
    for f in land.ALL:
        assert land.affected_tests([f], MAPS) == every
    assert land.affected_tests(["src/d.ts"], MAPS) == ["tests/d.test.ts"]                    # control: a source file selects its own


def test_unmapped_names_every_changed_path_no_test_reaches_and_no_row_exempts():
    mapped = ["src/d.ts", "src/d.json", "assets/thread/manifest.json", "tools/shot.py", "package.json", "src/gone.ts",
              "docs/queue.md", "README.md", "assets/mine/a.webp", "assets/zzz/x.json", "e2e/a.cjs", "dev/a.html", "gen/a.json",
              "tools/size.cjs", "tests/rebuild/prof/check.cjs", "src/ui/fonts/f.woff2", "index.html", "src/ui/.gitkeep"]
    assert land.unmapped(mapped, MAPS) == []
    loose = ["src/new.css", "src/content/x.json", "styles/a.css", "a.cjs", "src/a.html", "tools/owner_hook.sh", "zzz.cfg"]
    assert land.unmapped([*mapped, *loose], MAPS) == loose
    assert land.unmapped(["src/new.css"], {**MAPS, "tests/c.test.ts": "'src/new.css'"}) == []   # a test that names it maps it


def test_every_no_tests_row_gives_its_reason_and_the_table_stays_small():
    assert all(g and why for g, why in land.NO_TESTS) and len(land.NO_TESTS) <= 25


def test_testq_batches_one_runner_each():
    ts = [f"tests/t{i}.test.ts" for i in range(land.TESTQ_FILES + 2)]
    got = land.testq_batches(["tools/test_land.py", *ts, "tools/test_shot.py"])
    assert got == [ts[:land.TESTQ_FILES], ts[land.TESTQ_FILES:], ["tools/test_land.py", "tools/test_shot.py"]]
    assert land.testq_batches([]) == []


def test_verdicts_hold_unless_the_diff_since_affects_the_file(tmp_path):
    # newest first; OLD's diff to HEAD touched only what d imports, UNKNOWN is a tree git does not hold
    stale = {"T": set(), "OLD": {"tests/d.test.ts"}}.get
    rec = [
        {"status": "passed", "tree": "T", "targets": ["tests/a.test.ts", str(tmp_path / "tests/b.test.ts")]},
        {"status": "failed", "tree": "T", "targets": ["tests/c.test.ts"]},
        {"status": "running", "tree": "T", "targets": ["tests/e.test.ts"]},
        {"status": "passed", "tree": "OLD", "targets": ["tests/c.test.ts", "tests/d.test.ts", "tests/e.test.ts"]},
        {"status": "passed", "tree": "UNKNOWN", "targets": ["tests/f.test.ts"]},
    ]
    assert land.verdicts(rec, tmp_path, stale) == {
        "tests/a.test.ts": "passed", "tests/b.test.ts": "passed", "tests/c.test.ts": "failed", "tests/e.test.ts": "passed"}


def listing(receipts: Path):
    """A fake `testq status --json` printing the receipts in `receipts`, newest (the highest name) first, as testq does."""
    code = ("import glob, json, sys; "
            "print(json.dumps([json.load(open(p)) for p in sorted(glob.glob(sys.argv[1] + '/*.json'), reverse=True)]))")
    return lambda zs: [sys.executable, "-c", code, str(receipts)]


def test_a_rebase_that_changes_land_py_reruns_it(tmp_path, monkeypatch):
    calls = []
    monkeypatch.setattr(land.os, "execv", lambda exe, argv: calls.append(argv))
    tool = tmp_path / "land.py"
    tool.write_bytes(b"old")
    land.rerun_if_changed(tool, b"old", ["--x"])
    assert calls == []                                   # control: unchanged code runs on
    tool.write_bytes(b"main's")
    land.rerun_if_changed(tool, b"old", ["--x"])
    assert calls == [[sys.executable, str(tool), "--x"]]


def test_read_receipts_reads_the_testq_listing(tmp_path, monkeypatch):
    (tmp_path / "r1.json").write_text(json.dumps({"rid": "r1"}))
    monkeypatch.setattr(land, "status_argv", listing(tmp_path))
    assert land.read_receipts("/zs") == [{"rid": "r1"}]


def test_read_receipts_refuses_a_failed_listing(monkeypatch):
    monkeypatch.setattr(land, "status_argv", lambda zs: [sys.executable, "-c", "import sys; sys.exit(3)"])
    with pytest.raises(SystemExit, match="testq status failed"):
        land.read_receipts("/zs")


def test_status_argv_asks_testq_for_json():
    argv = land.status_argv("/zs")
    assert argv[1:4] == ["/zs/zunstack-app/tools/testq.py", "status", "--json"]


FAKE_TESTQ_OK = lambda zs, files, wt: [sys.executable, "-c", "print('testq: queued rid=abc123 lane=x')", *files]  # noqa: E731
FAKE_TESTQ_REFUSES = lambda zs, files, wt: [sys.executable, "-c", "import sys; print('REFUSED'); sys.exit(2)"]  # noqa: E731


@pytest.fixture
def landing(tmp_path, monkeypatch):
    """A repo whose diff against `base` edits src/a.ts, which tests/a.test.ts imports; ROOT, the receipts and testq are its own."""
    root = repo(tmp_path / "w", {"src/a.ts": "export const a = 1", "tests/a.test.ts": "import { a } from '../src/a'"})
    base = commit(root, {"src/other.ts": "export const o = 1"})
    commit(root, {"src/a.ts": "export const a = 2"})
    receipts = tmp_path / "receipts"
    receipts.mkdir()
    monkeypatch.setattr(land, "ROOT", root)
    monkeypatch.setattr(land, "status_argv", listing(receipts))
    monkeypatch.setattr(land, "testq_argv", FAKE_TESTQ_OK)
    tree = subprocess.run(["git", "rev-parse", "HEAD^{tree}"], cwd=root, capture_output=True, text=True, check=True).stdout.strip()
    return base, tree, receipts


def receipt(receipts: Path, name: str, **fields):
    (receipts / f"{name}.json").write_text(json.dumps({"rid": name, **fields}))


def test_tests_check_passes_with_a_pass_receipt_at_this_tree(landing, capsys):
    base, tree, receipts = landing
    receipt(receipts, "r1", status="passed", tree=tree, targets=["tests/a.test.ts"])
    land.tests_check("/zs", base)
    assert "PASS receipt" in capsys.readouterr().out


@pytest.mark.parametrize("fields", [
    {},   # no receipt at all
    {"status": "failed", "tree": "OTHER", "targets": ["tests/a.test.ts"]},   # a red at another tree is no verdict on this one
    {"status": "passed", "tree": "OTHER", "targets": ["tests/a.test.ts"]},
    {"status": "passed", "tree": "TREE", "targets": ["tests/zzz.test.ts"]},
])
def test_tests_check_submits_and_refuses_without_a_pass_receipt(landing, capsys, fields):
    base, tree, receipts = landing
    if fields:
        receipt(receipts, "r1", **{**fields, "tree": tree if fields["tree"] == "TREE" else fields["tree"]})
    with pytest.raises(SystemExit, match=r"submitted 1 as abc123\. Rerun land\.py after the PASS arrives"):
        land.tests_check("/zs", base)
    assert "rid=abc123" in capsys.readouterr().out


def test_tests_check_is_red_on_a_failed_receipt_at_this_tree_and_submits_nothing(landing, monkeypatch):
    base, tree, receipts = landing
    monkeypatch.setattr(land, "testq_argv", FAKE_TESTQ_REFUSES)
    receipt(receipts, "r1", status="failed", tree=tree, targets=["tests/a.test.ts"])
    with pytest.raises(land.Failed, match=r"red: tests/a\.test\.ts failed on content this HEAD still has"):
        land.tests_check("/zs", base)
    receipt(receipts, "r2", status="passed", tree=tree, targets=["tests/a.test.ts"])   # control: a newer pass is no red
    land.tests_check("/zs", base)


def test_a_pass_holds_across_a_commit_that_affects_no_test(landing, monkeypatch):
    base, tree, receipts = landing
    monkeypatch.setattr(land, "testq_argv", FAKE_TESTQ_REFUSES)
    receipt(receipts, "r1", status="passed", tree=tree, targets=["tests/a.test.ts"])
    commit(land.ROOT, {"docs/x.md": "a queue line"})
    land.tests_check("/zs", base)


def test_tests_check_submits_as_pending_not_red(landing):
    base, _, _ = landing
    with pytest.raises(land.Pending):
        land.tests_check("/zs", base)


def test_tests_check_fails_a_changed_path_that_maps_to_no_test(landing):
    base, tree, receipts = landing
    receipt(receipts, "r1", status="passed", tree=tree, targets=["tests/a.test.ts"])
    land.tests_check("/zs", base)                                                       # control: the mapped diff passes
    commit(land.ROOT, {"src/new.css": "a{}", "src/ok.json": "{}", "docs/x.md": "x"})
    with pytest.raises(SystemExit, match=r"no test maps changed path\(s\) src/new\.css, src/ok\.json;"):
        land.tests_check("/zs", base)
    commit(land.ROOT, {"tests/a.test.ts": "import { a } from '../src/a'\n// src/new.css src/ok.json"})   # a test that names them maps them
    tree = subprocess.run(["git", "rev-parse", "HEAD^{tree}"], cwd=land.ROOT, capture_output=True, text=True, check=True).stdout.strip()
    receipt(receipts, "r2", status="passed", tree=tree, targets=["tests/a.test.ts"])
    land.tests_check("/zs", base)


def test_tests_check_submits_every_batch_in_one_run(landing, monkeypatch):
    base, _, _ = landing
    many = [f"tests/t{i}.test.ts" for i in range(land.TESTQ_FILES + 2)]
    monkeypatch.setattr(land, "affected_tests", lambda changed, texts: many)
    sent = []
    monkeypatch.setattr(land, "testq_argv", lambda zs, files, wt: sent.append(files) or FAKE_TESTQ_OK(zs, files, wt))
    with pytest.raises(SystemExit, match=rf"{len(many)} of {len(many)} .* submitted {len(many)} as abc123, abc123"):
        land.tests_check("/zs", base)
    assert sent == [many[:land.TESTQ_FILES], many[land.TESTQ_FILES:]]


def test_tests_check_submits_a_batch_per_runner(landing, monkeypatch):
    base, _, _ = landing
    ts = [f"tests/t{i}.test.ts" for i in range(3)]
    monkeypatch.setattr(land, "affected_tests", lambda changed, texts: [*ts, "tools/test_land.py"])
    sent = []
    monkeypatch.setattr(land, "testq_argv", lambda zs, files, wt: sent.append(files) or FAKE_TESTQ_OK(zs, files, wt))
    with pytest.raises(SystemExit, match=r"4 of 4 .* submitted 4 as abc123, abc123"):
        land.tests_check("/zs", base)
    assert sent == [ts, ["tools/test_land.py"]]


def test_tests_check_refuses_when_testq_refuses(landing, monkeypatch):
    base, _, _ = landing
    monkeypatch.setattr(land, "testq_argv", FAKE_TESTQ_REFUSES)
    with pytest.raises(SystemExit, match="testq refused"):
        land.tests_check("/zs", base)


def test_tests_check_with_no_affected_test_submits_nothing(landing, monkeypatch, capsys):
    base, _, _ = landing
    monkeypatch.setattr(land, "testq_argv", FAKE_TESTQ_REFUSES)
    land.tests_check("/zs", subprocess.run(["git", "rev-parse", "HEAD"], cwd=land.ROOT, capture_output=True, text=True,
                                           check=True).stdout.strip())
    assert "no test file is affected" in capsys.readouterr().out


def test_testq_and_merge_argv(tmp_path):
    t = land.testq_argv("/z", ["tests/a.test.ts"], tmp_path)
    assert t[1:4] == ["/z/zunstack-app/tools/testq.py", "run", "--worktree"] and t[-1] == "tests/a.test.ts"
    assert "--wait" not in t
    m = land.merge_argv("/z", tmp_path, "br")
    assert m[1] == "/z/engine/Universal/tooling/lib/gitlane.py" and m[2] == "merge"
    assert m[-3:] == ["--", "--no-ff", "br"]


def test_check_flag_is_accepted_and_runs_the_gates(monkeypatch):
    seen = []
    monkeypatch.setenv("ZS_ROOT", "/zs")
    monkeypatch.setattr(land, "git", lambda *a, **k: {"rev-parse": "br\n", "status": "", "merge-base": "BASE\n"}[a[0]])
    monkeypatch.setattr(land, "gates", lambda zs, base, branch: seen.append((zs, base, branch)) or [])
    assert land.main(["--check"]) == 0
    assert seen == [("/zs", "BASE", "br")]
    with pytest.raises(SystemExit):
        land.main(["--bogus"])


def test_gates_hold_the_merged_queue_to_the_inject_cap(monkeypatch):
    ran = []
    monkeypatch.setattr(land, "refusals", lambda base, branch: [])
    monkeypatch.setattr(land, "tests_check", lambda zs, base: None)
    monkeypatch.setattr(land, "step", lambda name, argv, cwd=None: ran.append((name, argv)))
    land.gates("/zs", "BASE", "br")
    cap = dict(ran)["inject cap"]
    assert cap[1:] == ["/zs/engine/System/tooling/instructions/substrate_lint.py", "--inject-check", str(land.ROOT / land.QUEUE)]
    assert [n for n, _ in ran].index("inject cap") < [n for n, _ in ran].index("build")
    assert dict(ran)["build"][1:] == ["node_modules/vite/bin/vite.js", "build", "--mode", "course"]   # the typecheck step ran tsc once


def test_a_step_runs_rolldown_without_eager_arenas(monkeypatch):
    seen = []
    monkeypatch.setattr(land.subprocess, "run", lambda argv, cwd, env: seen.append(env) or subprocess.CompletedProcess(argv, 0))
    land.step("build", ["node", "x"])
    assert seen[0]["MIMALLOC_ARENA_EAGER_COMMIT"] == "0" and seen[0]["PATH"] == os.environ["PATH"]


def test_check_refuses_on_main_and_on_a_dirty_tree(monkeypatch):
    monkeypatch.setenv("ZS_ROOT", "/zs")
    monkeypatch.setattr(land, "git", lambda *a, **k: "main\n")
    with pytest.raises(SystemExit, match="not main"):
        land.main(["--check"])
    monkeypatch.setattr(land, "git", lambda *a, **k: {"rev-parse": "br\n", "status": " M x\n"}[a[0]])
    with pytest.raises(SystemExit, match="dirty"):
        land.main(["--check"])


# ---- real git: the rebase's queue resolution, conflict markers, the refusals as `--check` reports them

QT = "## Live\n\n| Item | Goal | State |\n|---|---|---|\n| A | x | working: a0 |\n| B | y | working: b0 |\n| C | z | working: c0 |\n"


def g(root: Path, *args: str) -> str:
    return subprocess.run(["git", "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", *args], cwd=root,
                          check=True, capture_output=True, text=True).stdout


def commit_msg(root: Path, files: dict[str, str], msg: str) -> None:
    for name, text in files.items():
        (root / name).parent.mkdir(parents=True, exist_ok=True)
        (root / name).write_text(text, encoding="utf-8", newline="")
    g(root, "add", "-A")
    g(root, "commit", "-qm", msg)


@pytest.mark.parametrize("ours,theirs,want", [
    (QT.replace("b0", "b1"), QT.replace("a0", "a1"), QT.replace("b0", "b1").replace("a0", "a1")),   # different rows: both kept
    (QT.replace("| C | z | working: c0 |\n", ""), QT + "| D | w | working: d0 |\n",                  # a branch's new row goes after
     QT.replace("| C | z | working: c0 |\n", "| D | w | working: d0 |\n")),                           # the row before it that is left
    (QT.replace("c0", "c1"), QT.replace("| A | x | working: a0 |\n", ""),
     QT.replace("c0", "c1").replace("| A | x | working: a0 |\n", "")),                              # a removal on the branch side
    (QT.replace("b0", "b1"), QT.replace("b0", "b2"), QT.replace("b0", "b2")),                       # both changed a State: the branch's
    (QT.replace("| y |", "| y / more |"), QT.replace("b0", "b2"),
     QT.replace("| y |", "| y / more |").replace("b0", "b2")),                                      # main grew the Goal, the branch the State
    (QT.replace("| B | y |", "| B (o-1) | y / more |"), QT.replace("b0", "b2"),
     QT.replace("| B | y |", "| B (o-1) | y / more |").replace("b0", "b2")),                        # main added an order id to the item
    (QT.replace("| y |", "| y2 |"), QT.replace("| y |", "| y3 |"), None),                           # Goals that diverge
    (QT.replace("b0", "b1"), QT.replace("b0", "b1").replace("a0", "a1"), QT.replace("b0", "b1").replace("a0", "a1")),   # same change
    (QT.replace("b0", "b1"), QT.replace("## Live", "## Open"), None),                               # a non-row line the branch changed
])
def test_merge_queue_reapplies_the_branchs_rows_on_mains_file(ours, theirs, want):
    assert land.merge_queue(QT, ours, theirs) == want


def test_rebase_resolves_a_queue_conflict_row_by_row_in_either_queue_file(tmp_path):
    root = repo(tmp_path / "r", {land.QUEUE: QT, land.DEFERRED: QT, "x.ts": "x0\n"})
    commit_msg(root, {land.QUEUE: QT.replace("b0", "b1"), land.DEFERRED: QT.replace("c0", "c1")}, "main work")
    g(root, "checkout", "-q", "-b", "br", "HEAD~1")
    commit_msg(root, {land.QUEUE: QT.replace("a0", "a1"), land.DEFERRED: QT.replace("a0", "a1")}, "br one\n\nLanded: one")
    commit_msg(root, {"x.ts": "x1\n"}, "br x")
    assert land.rebase(root, "main") == ""
    assert (root / land.QUEUE).read_text() == QT.replace("b0", "b1").replace("a0", "a1")
    assert (root / land.DEFERRED).read_text() == QT.replace("c0", "c1").replace("a0", "a1")
    assert g(root, "log", "--format=%s", "main..HEAD").split("\n")[:2] == ["br x", "br one"]
    assert "Landed: one" in g(root, "log", "--format=%B", "main..HEAD") and g(root, "status", "--porcelain") == ""


def test_rebase_resolves_the_size_list_as_mains_list_lowered(tmp_path):
    lower = "const fs = require('fs');\nif (process.argv[2] === 'lower') fs.appendFileSync(__filename, '// lowered\\n');\n"
    root = repo(tmp_path / "r", {land.SIZE: lower + "// a 500\n"})
    commit_msg(root, {land.SIZE: lower + "// a 480\n"}, "main shrinks a")
    g(root, "checkout", "-q", "-b", "br", "HEAD~1")
    commit_msg(root, {land.SIZE: lower + "// a 490\n"}, "br shrinks a")
    assert land.rebase(root, "main") == ""
    assert (root / land.SIZE).read_text() == lower + "// a 480\n// lowered\n"
    assert g(root, "status", "--porcelain") == ""


def test_rebase_aborts_on_a_conflict_it_cannot_resolve(tmp_path):
    root = repo(tmp_path / "r", {land.QUEUE: QT, "x.ts": "x0\n"})
    commit_msg(root, {land.QUEUE: QT.replace("| y |", "| y2 |")}, "main")
    g(root, "checkout", "-q", "-b", "br", "HEAD~1")
    commit_msg(root, {land.QUEUE: QT.replace("| y |", "| y3 |")}, "br")
    tip = g(root, "rev-parse", "HEAD")
    assert "Goals diverge" in land.rebase(root, "main")
    assert g(root, "rev-parse", "HEAD") == tip and g(root, "status", "--porcelain") == ""
    g(root, "checkout", "-q", "-b", "br2", "main")
    commit_msg(root, {"x.ts": "x br\n"}, "br x")
    g(root, "checkout", "-q", "main")
    commit_msg(root, {"x.ts": "x main\n"}, "main x")
    g(root, "checkout", "-q", "br2")
    assert land.rebase(root, "main").startswith("x.ts conflicts")
    assert g(root, "status", "--porcelain") == ""


def test_conflict_markers_find_only_marker_lines_of_the_named_files(monkeypatch, tmp_path):
    mark = "<" * 7
    root = repo(tmp_path / "r", {"INDEX.md": f"a\n{mark} HEAD\nb\n", "ok.py": f"s = '{mark} x'\n", "other.md": f"{mark} y\n"})
    monkeypatch.setattr(land, "ROOT", root)
    assert land.conflict_markers(["INDEX.md", "ok.py"]) == ["INDEX.md"]   # a marker inside a string is no marker line


GOOD = "work\n\nDirective: d\nLanded: l\nQueue: A\n"
LONG_STATE = QT.replace("a0", "a1 " + "w " * 61)


@pytest.mark.parametrize("files,msg,want", [
    ({land.QUEUE: QT.replace("a0", "a1")}, GOOD, []),
    ({land.QUEUE: QT.replace("a0", "waiting on the owner: playtest pt-1")}, GOOD, []),   # feel work lands with its row Live
    ({land.QUEUE: LONG_STATE}, GOOD, ["a: State is 63 words"]),
    ({"x.ts": "x1\n"}, GOOD, ["`Queue:` rows left unmarked in docs/queue.md: A"]),
    ({land.QUEUE: QT.replace("a0", "a1 br pending")}, GOOD, ["still calls branch br unlanded in row(s) a"]),
    ({land.QUEUE: QT.replace("a0", "a1"), "x.ts": "<" * 7 + " HEAD\n"}, GOOD, ["conflict markers committed in x.ts"]),
    ({land.QUEUE: QT.replace("a0", "a1"), land.QUEUE_LOG: "# log\n"}, GOOD, ["docs/queue-log.md is append-only"]),
    ({land.QUEUE: QT.replace("a0", "a1")}, "work\n\nQueue: A\n", ["(missing: Directive, Landed)"]),
    ({land.QUEUE: LONG_STATE, "x.ts": "<" * 7 + " HEAD\n"}, "work\n", ["explain itself", "63 words", "conflict markers"]),
])
def test_refusals_report_every_static_gate_without_moving_the_branch(monkeypatch, tmp_path, files, msg, want):
    root = repo(tmp_path / "r", {land.QUEUE: QT, land.QUEUE_LOG: "# log\n- x\n", "x.ts": "x0\n"})
    g(root, "checkout", "-q", "-b", "br")
    commit_msg(root, files, msg)
    tip = g(root, "rev-parse", "HEAD")
    monkeypatch.setattr(land, "ROOT", root)
    why = land.refusals("main", "br")
    assert all(any(w in r for r in why) for w in want), why
    assert (why == []) == (want == [])                                              # control: the clean branch has no refusal
    assert g(root, "rev-parse", "HEAD") == tip and g(root, "status", "--porcelain") == ""


def lane(calls: list, fail_merge: bool = False):
    """A `land.step` stand-in: the queue-log entry step commits the tree as the lane would, the merge only records (or fails)."""
    def fake(name, argv, cwd=None):
        calls.append((name, argv))
        if name == "queue-log entry":
            g(cwd or land.ROOT, "add", "-A")
            g(cwd or land.ROOT, "commit", "-qm", argv[-1])
        elif fail_merge:
            raise SystemExit("merge failed")
    return fake


def test_every_landing_writes_one_queue_log_line_and_a_failed_merge_takes_it_back(monkeypatch, tmp_path):
    main_co, wt = repo(tmp_path / "r", {land.QUEUE_LOG: "# log\n", "x.ts": "x0\n"}), tmp_path / "wt"
    g(main_co, "worktree", "add", "-q", "-b", "br", str(wt))
    commit_msg(wt, {"x.ts": "x1\n"}, "work\n\nDirective: d\nLanded: l\n")
    work, calls = g(wt, "rev-parse", "HEAD"), []
    monkeypatch.setenv("ZS_ROOT", "/zs")
    monkeypatch.setattr(land, "ROOT", wt)
    monkeypatch.setattr(land, "primary_checkout", lambda: main_co)
    monkeypatch.setattr(land, "rebase", lambda cwd, onto: "")
    monkeypatch.setattr(land, "gates", lambda zs, base, branch: None)
    monkeypatch.setattr(land, "step", lane(calls, fail_merge=True))
    with pytest.raises(SystemExit, match="merge failed"):
        land.main([])
    assert [n for n, _ in calls] == ["queue-log entry", f"merge into {land.MAIN}"]
    assert g(wt, "rev-parse", "HEAD") == work and (wt / land.QUEUE_LOG).read_text(encoding="utf-8") == "# log\n"   # entry taken back
    monkeypatch.setattr(land, "step", lane(calls))
    assert land.main([]) == 0                                             # no `Queue:` row, no completed row: the line is written
    last = (wt / land.QUEUE_LOG).read_text(encoding="utf-8").splitlines()[-1]
    assert last.startswith(f"- {datetime.date.today().isoformat()} · - (br) · d · l · ") and last.endswith(work[:7])
    assert g(wt, "log", "-1", "--format=%s").strip() == land.LOG_COMMIT


def test_a_log_entry_commit_a_killed_run_left_is_taken_off_before_the_rebase(monkeypatch, tmp_path):
    main_co, wt = repo(tmp_path / "r", {"x.ts": "x0\n", land.QUEUE_LOG: "# log\n"}), tmp_path / "wt"
    g(main_co, "worktree", "add", "-q", "-b", "br", str(wt))
    commit_msg(wt, {"x.ts": "x1\n"}, "work")
    commit_msg(wt, {"x.ts": "x2\n"}, land.LOG_COMMIT)
    seen = []
    monkeypatch.setenv("ZS_ROOT", "/zs")
    monkeypatch.setattr(land, "ROOT", wt)
    monkeypatch.setattr(land, "primary_checkout", lambda: main_co)
    monkeypatch.setattr(land, "rebase", lambda cwd, onto: seen.append(g(wt, "log", "-1", "--format=%s").strip()) or "")
    monkeypatch.setattr(land, "gates", lambda zs, base, branch: None)
    monkeypatch.setattr(land, "step", lane([]))
    assert land.main([]) == 0
    assert seen == ["work"]                                                      # the stale entry is gone before the rebase
    seen.clear()
    commit_msg(wt, {"x.ts": "x3\n"}, "more work")
    assert land.main([]) == 0 and seen == ["more work"]                          # control: a normal tip is left alone


def test_a_failed_rebase_stops_the_landing_before_any_gate(monkeypatch, tmp_path):
    main_co, wt = repo(tmp_path / "r", {"x.ts": "x0\n"}), tmp_path / "wt"
    g(main_co, "worktree", "add", "-q", "-b", "br", str(wt))
    monkeypatch.setenv("ZS_ROOT", "/zs")
    monkeypatch.setattr(land, "ROOT", wt)
    monkeypatch.setattr(land, "primary_checkout", lambda: main_co)
    monkeypatch.setattr(land, "rebase", lambda cwd, onto: "x.ts conflicts; the rebase is aborted")
    monkeypatch.setattr(land, "gates", lambda *a: pytest.fail("gated after a failed rebase"))
    with pytest.raises(SystemExit, match="rebase on main failed: x.ts conflicts"):
        land.main([])


HOOKQ = "| Row | Spec | State |\n|---|---|---|\n| A | x | working: a0 |\n"
LONG = "working: " + "w " * 60
HOOK_QUEUE = f"app/game/{land.QUEUE}"


def hook_owner(tmp_path: Path) -> tuple[Path, Path]:
    """An owner checkout holding queue rows and this land.py in its `app/game` folder, plus a linked worktree of it."""
    o, wt = tmp_path / "owner", tmp_path / "wt"
    repo(o, {HOOK_QUEUE: HOOKQ, "app/game/tools/land.py": Path(land.__file__).read_text(encoding="utf-8")})
    g(o, "worktree", "add", "-q", "-b", "wt", str(wt))
    return o, wt


def try_commit(wt: Path, files: dict[str, str]) -> subprocess.CompletedProcess:
    for name, text in files.items():
        (wt / name).write_text(text, encoding="utf-8", newline="")
    g(wt, "add", "-A")
    return subprocess.run(["git", "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", "commit", "-qm", "q"],
                          cwd=wt, capture_output=True, text=True)


def test_install_owner_hook_writes_the_shared_hooks_executable(tmp_path):
    o = repo(tmp_path / "o", {"x": "x\n"})
    assert not (o / ".git/hooks/pre-commit").exists()                                 # control: nothing before the install
    land.install_owner_hook(o)
    for n in ("pre-commit", "pre-merge-commit"):
        assert (o / ".git/hooks" / n).read_bytes() == land.OWNER_HOOK.read_bytes()
        assert os.access(o / ".git/hooks" / n, os.X_OK)


def test_a_landing_installs_the_hook_only_after_the_merge(monkeypatch, tmp_path):
    main_co, wt = repo(tmp_path / "r", {"x.ts": "x0\n", land.QUEUE_LOG: "# log\n"}), tmp_path / "wt"
    g(main_co, "worktree", "add", "-q", "-b", "br", str(wt))
    monkeypatch.setenv("ZS_ROOT", "/zs")
    monkeypatch.setattr(land, "ROOT", wt)
    monkeypatch.setattr(land, "primary_checkout", lambda: main_co)
    monkeypatch.setattr(land, "rebase", lambda cwd, onto: "")
    monkeypatch.setattr(land, "gates", lambda zs, base, branch: None)
    monkeypatch.setattr(land, "step", lane([], fail_merge=True))
    with pytest.raises(SystemExit):
        land.main([])
    assert not (main_co / ".git/hooks/pre-commit").exists()                           # control: a refused merge installs nothing
    monkeypatch.setattr(land, "step", lane([]))
    assert land.main([]) == 0 and (main_co / ".git/hooks/pre-commit").is_file()


def test_worktree_hook_refuses_a_long_staged_state_and_passes_a_good_one(tmp_path):
    o, wt = hook_owner(tmp_path)
    assert try_commit(wt, {HOOK_QUEUE: HOOKQ.replace("working: a0", LONG)}).returncode == 0   # control: no hook, the long State commits
    g(wt, "reset", "-q", "--hard", "HEAD~1")
    land.install_owner_hook(o)
    refused = try_commit(wt, {HOOK_QUEUE: HOOKQ.replace("working: a0", LONG)})
    assert refused.returncode and "commit refused" in refused.stderr and "a: State is 61 words" in refused.stderr
    g(wt, "reset", "-q", "--hard")
    assert try_commit(wt, {HOOK_QUEUE: HOOKQ.replace("working: a0", "working: short")}).returncode == 0
    assert try_commit(wt, {"y.txt": "y\n"}).returncode == 0                           # no queue staged: the hook is silent


def test_staged_applies_the_whole_state_rule_to_changed_rows_only(monkeypatch, tmp_path):
    o, wt = hook_owner(tmp_path)
    monkeypatch.chdir(wt / "app/game")
    (wt / HOOK_QUEUE).write_text(HOOKQ.replace("working: a0", "idle"), encoding="utf-8", newline="")
    g(wt, "add", "-A")
    with pytest.raises(SystemExit, match="neither"):
        land.staged()
    (wt / HOOK_QUEUE).write_text(HOOKQ.replace("working: a0", "waiting on the owner: ok"), encoding="utf-8", newline="")
    g(wt, "add", "-A")
    land.staged()                                                                     # control: a good change passes


def test_the_owner_checkout_hook_refuses_when_it_cannot_run_the_guard(tmp_path):
    """tools/owner_hook.sh in a primary checkout on main, with the fleet engine's owner_guard.py missing, failing to start or present."""
    o = repo(tmp_path / "o", {"x": "x\n"})
    land.install_owner_hook(o)
    guard = tmp_path / "engine/Universal/tooling/hooks/owner_guard.py"
    refused = try_commit(o, {"y": "1\n"})                                             # no guard anywhere
    assert refused.returncode and refused.stderr.strip().count("\n") == 0 and "the owner guard cannot run" in refused.stderr
    guard.parent.mkdir(parents=True)
    guard.write_text("import sys\nsys.exit(127)\n", encoding="utf-8")
    refused = try_commit(o, {"y": "2\n"})                                             # the guard's own cannot-start code is no pass
    assert refused.returncode and "the owner guard cannot run" in refused.stderr
    guard.write_text("import sys\nsys.exit(2)\n", encoding="utf-8")
    refused = try_commit(o, {"y": "3\n"})
    assert refused.returncode and "cannot run" not in refused.stderr                  # the guard's own refusal is passed on
    guard.write_text("import sys\nsys.exit(0)\n", encoding="utf-8")
    assert try_commit(o, {"y": "4\n"}).returncode == 0                                # control: a guard that runs and clears lets it through


def env_for_git(monkeypatch) -> None:
    for k, v in (("NAME", "t"), ("EMAIL", "t@t")):
        for who in ("AUTHOR", "COMMITTER"):
            monkeypatch.setenv(f"GIT_{who}_{k}", v)
    for k, v in (("GIT_CONFIG_COUNT", "1"), ("GIT_CONFIG_KEY_0", "commit.gpgsign"), ("GIT_CONFIG_VALUE_0", "false")):
        monkeypatch.setenv(k, v)


@pytest.fixture
def stacked(monkeypatch, tmp_path):
    """A main checkout with queue files and a `landstack` worktree; `add(name, files, msg)` makes a branch worktree; ROOT, the
    primary checkout, every gitlane/merge step and the owner hook are fakes that record into `calls`."""
    env_for_git(monkeypatch)
    main_co = repo(tmp_path / "r", {land.QUEUE: QT, land.QUEUE_LOG: "# log\n", "base.md": "b\n"})
    g(main_co, "worktree", "add", "-q", "-b", land.STACK_BRANCH, str(main_co / ".worktrees" / land.STACK_BRANCH))
    calls: list = []
    monkeypatch.setenv("ZS_ROOT", "/zs")
    monkeypatch.setattr(land, "ROOT", main_co)
    monkeypatch.setattr(land, "primary_checkout", lambda: main_co)
    monkeypatch.setattr(land, "step", lane(calls))
    monkeypatch.setattr(land, "install_owner_hook", lambda co: calls.append(("hook", co)))

    def add(name: str, files: dict[str, str] | None = None, msg: str | None = None) -> None:
        wt = main_co / ".worktrees" / name
        g(main_co, "worktree", "add", "-q", "-b", name, str(wt))
        commit_msg(wt, files or {f"{name}.txt": name}, msg or f"{name}\n\nDirective: d {name}\nLanded: l {name}\n")
    return main_co, calls, add


def fake_checks(seen: list, red_if: str = "", pending: bool = False):
    def f(zs, base):
        seen.append(sorted(p.name for p in land.ROOT.glob("*.txt")))
        if pending:
            raise land.Pending("land.py: submitted")
        if red_if and (land.ROOT / red_if).exists():
            raise land.Failed(f"land.py: build failed; not landed ({red_if})")
    return f


def merged(main_co: Path, calls: list) -> tuple[list[str], str]:
    """(the files, the log text) of the stack head the one gitlane merge was asked to land."""
    (merge,) = [argv for name, argv in calls if name == f"merge into {land.MAIN}"]
    head = merge[-1]
    return g(main_co, "ls-tree", "-r", "--name-only", head).split(), g(main_co, "show", f"{head}:{land.QUEUE_LOG}")


def test_batch_stacks_the_branches_runs_one_check_pass_and_merges_the_stack(monkeypatch, stacked):
    main_co, calls, add = stacked
    add("a")
    add("b")
    seen: list = []
    monkeypatch.setattr(land, "checks", fake_checks(seen))
    main_before = g(main_co, "rev-parse", "main")
    assert land.batch(["a", "b"]) == 0
    assert seen == [["a.txt", "b.txt"]]                                               # one pass over both, not one per branch
    files, log = merged(main_co, calls)
    assert {"a.txt", "b.txt"} <= set(files) and log.count("\n") == 3                  # one queue-log line per branch, in order
    assert "(a) · d a · l a ·" in log.splitlines()[1] and "(b) · d b · l b ·" in log.splitlines()[2]
    assert ("hook", main_co) in calls and g(main_co, "rev-parse", "main") == main_before   # the merge itself is gitlane's
    merge = next(argv for n, argv in calls if n.startswith("merge"))
    assert merge[2] == "merge" and merge[3:5] == ["--repo", str(main_co)] and merge[-3:-1] == ["--", "--no-ff"] and "land a b onto main" in merge


def test_batch_bisects_a_red_branch_and_lands_the_rest(monkeypatch, stacked, capsys):
    main_co, calls, add = stacked
    for n in ("a", "bad", "c"):
        add(n)
    seen: list = []
    monkeypatch.setattr(land, "checks", fake_checks(seen, red_if="bad.txt"))
    assert land.batch(["a", "bad", "c"]) == 1
    assert seen == [["a.txt", "bad.txt", "c.txt"], ["a.txt"], ["a.txt", "bad.txt"], ["a.txt", "c.txt"]]   # all, half, red found, rest
    files, log = merged(main_co, calls)
    assert "a.txt" in files and "c.txt" in files and "bad.txt" not in files and "(bad)" not in log
    assert "batch RED bad" in capsys.readouterr().err
    calls.clear()
    seen.clear()
    monkeypatch.setattr(land, "checks", fake_checks(seen))                            # control: none red, one pass lands all three
    assert land.batch(["a", "bad", "c"]) == 0 and len(seen) == 1 and "bad.txt" in merged(main_co, calls)[0]


def test_batch_that_submitted_tests_lands_nothing_and_leaves_the_environment_as_it_was(monkeypatch, stacked):
    main_co, calls, add = stacked
    add("a")
    monkeypatch.setattr(land, "checks", fake_checks([], pending=True))
    monkeypatch.setenv("GIT_COMMITTER_DATE", "keep")
    monkeypatch.delenv("GIT_AUTHOR_DATE", raising=False)
    with pytest.raises(land.Pending):
        land.batch(["a"])
    assert not [n for n, _ in calls if n.startswith("merge")]                         # a submitted run exits non-zero, nothing merged
    assert land.ROOT == main_co and os.environ["GIT_COMMITTER_DATE"] == "keep" and "GIT_AUTHOR_DATE" not in os.environ


def test_batch_drops_a_branch_that_fails_the_static_gates_and_reports_it(monkeypatch, stacked, capsys):
    main_co, calls, add = stacked
    add("a")
    add("mute", msg="mute\n")                                                         # no Directive or Landed
    monkeypatch.setattr(land, "checks", fake_checks([]))
    assert land.batch(["a", "mute"]) == 1
    files, _ = merged(main_co, calls)
    assert "a.txt" in files and "mute.txt" not in files
    assert "batch DROPPED mute" in capsys.readouterr().err


def test_batch_rebuilds_the_same_stack_on_a_rerun_so_its_test_receipts_apply(monkeypatch, stacked):
    main_co, calls, add = stacked
    add("a")
    add("b")
    monkeypatch.setattr(land, "checks", fake_checks([]))
    heads = lambda: [argv[-1] for n, argv in calls if n.startswith("merge")]   # noqa: E731
    assert land.batch(["a", "b"]) == 0
    (one,) = heads()
    calls.clear()
    assert land.batch(["a", "b"]) == 0 and heads() == [one]                           # the same commits, so the same tree
    calls.clear()
    monkeypatch.setenv("GIT_COMMITTER_DATE", "2001-01-01T00:00:00")                   # control: an outer date never leaks into the stack
    assert land.batch(["a", "b"]) == 0 and heads() == [one]


def test_batch_refuses_when_the_primary_checkout_is_not_on_main(monkeypatch, stacked):
    main_co, calls, add = stacked
    add("a")
    g(main_co, "checkout", "-q", "-b", "other")
    monkeypatch.setattr(land, "checks", fake_checks([]))
    with pytest.raises(SystemExit, match="not on main"):
        land.batch(["a"])
    g(main_co, "checkout", "-q", "main")
    assert land.batch(["a"]) == 0                                                     # control
