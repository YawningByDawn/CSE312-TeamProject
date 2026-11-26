#!/usr/bin/env python3
"""Lands the current worktree's branch onto LOCAL main. Never pushes.  `python tools/land.py` from inside the worktree.

`python tools/land.py --check` runs every gate below except the rebase, the log entry and the merge, on the branch as committed
(its diff is taken from the merge base with main) and exits non-zero on any refusal. A landing runs these steps, each gated on
its exit code, the first failure stopping it:
  1. the tree is clean and the branch is not main; a log entry commit a killed run left is taken back off the branch
  2. rebase on main (landing only): a conflict only in docs/queue.md or docs/queue-deferred.md is resolved row by row (the
     branch's changed rows re-applied on main's file); any other conflict aborts the rebase and is reported
  3. the static gates, every refusal reported together with its fix:
     - the commit messages carry `Directive:` and `Landed:` trailers
     - no conflict marker is committed; docs/queue-log.md only grows
     - docs/queue.md and docs/queue-deferred.md read as one set of rows (a row moving between them is no removal): every row
       this branch changes has a State that starts `working:` or `waiting on `, has at most 60 words and holds no `|`; every
       row this branch removes is named by a `Queue: <row id>` commit trailer; each trailer names a row this branch marks
       `working:` / `waiting on ` or removes (completes); a branch with no trailer owes no mark; no row leaves while its State
       names a playtest card the owner has not approved; no State calls this branch pending or not landed
  4. `npm run typecheck`, then `node tools/systems.cjs check`: no import breaks contract.md's layer rule except the
     listed REMAINING ones, and no listed one is stale; then `node tools/size.cjs check`: no src/ file passes 400 lines
     unless listed in OVER, and none grows past its recorded count (src/ total and per-folder lines are
     reported against the 35,000 ceiling, not failing yet);
     then `node tools/reach.cjs check`: every src/ file is reached from src/main.ts, or is a tool-only file listed in
     reach.cjs's REMAINING under its owning row (a dead file fails);
     then `node tools/flags.cjs check`: the query string is read only in src/content/flags.ts, every flag and dev page has an
     entry in src/content/flags.json with a queue row and a deletion date not yet passed, and no entry is read by nothing;
     then `node tools/text.cjs check`: no player-visible string literal or template sits in src/ui, src/scenes, src/app or
     src/render (the words live in src/content, the interface's in its `UI` tables) except the counts recorded in text.cjs's
     REMAINING, which only shrink;
     then `substrate_lint --inject-check docs/queue.md`: the merged queue fits the session inject's wire cap
  5. tests: the changed test files plus every test file whose import closure (`.ts`, `.json` and tools/*.py edges) reaches a
     changed file, plus the test files that name a changed path outside docs/ (a `.json`, `.png` ...), and every test file when package.json,
     package-lock.json, tsconfig.json or vite.config.ts changes. A changed path that maps to no test and is not in NO_TESTS (the
     reviewed table of paths that need none) fails the landing naming it, never falling back. Each affected file needs a testq
     PASS receipt that holds at this HEAD: its newest receipt whose tested tree differs from HEAD's in no path that affects
     the file (a queue edit or a rebase over unrelated files keeps it); a receipt that failed is red; every file without a receipt is submitted in this run
     (a batch per runner, at most 25 files each: testq's per-request ceiling), the request ids printed, and the run exits
     non-zero: rerun it once the verdicts arrive. Nothing waits.
  6. `vite build --mode course` (`npm run build` less the typecheck step 4 ran)
  7. one commit appends one docs/queue-log.md line (date, rows or `-`, branch, Directive, Landed, hashes)  [landing only]
  8. gitlane merge --no-ff into main (the primary checkout must be on main), then tools/owner_hook.sh is installed as the
     shared pre-commit and pre-merge-commit hook                                  [landing only]

`python tools/land.py --staged` is the worktree pre-commit hook's check (tools/owner_hook.sh): a staged queue file whose
changed rows break the State rules is refused, by the same state_problems step 3 applies.

`python tools/land.py --batch <wt> <wt> ...` (worktree paths, or names under .worktrees/), from anywhere: in the dedicated
.worktrees/landstack each branch is rebased onto main in order and stacked, each followed by its own queue-log commit; a branch
that conflicts or fails the static gates is dropped and reported. ONE pass of steps 4, 5 (through testq) and 6 runs over the
stack; when red, halves are retried until each red branch is found (a half whose red is implied is not rerun). A submitted test
run exits non-zero until its verdict; the rerun rebuilds the same stack (every date is the newest tip's committer date), so its
receipts apply. Only a stack whose exact HEAD passed is merged onto local main through gitlane; exit 0 only when every branch
landed. The source worktrees are not touched.

env: ZS_ROOT (the fleet root: testq and gitlane live under it).
"""
from __future__ import annotations

import argparse
import datetime
import fnmatch
import json
import os
import posixpath
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Callable, NamedTuple

ROOT = Path(__file__).resolve().parent.parent
SELF = Path(__file__).resolve()
LOADED = SELF.read_bytes()             # this run's own code: a rebase that changes it re-runs the landing on main's
MAIN = "main"
NPM = shutil.which("npm") or "npm"
QUEUE = "docs/queue.md"
DEFERRED = "docs/queue-deferred.md"
QUEUES = (QUEUE, DEFERRED)              # every file holding queue rows
SIZE = "tools/size.cjs"
QUEUE_LOG = "docs/queue-log.md"
DECISIONS = "data/workshop/approvals_decisions.json"   # the owner's card rulings, in the checkout the workshop serves
LOG_COMMIT = "log: landing entry"
CO_AUTHOR = "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
STATUSES = ("working:", "waiting on ")
STATE_WORDS = 60
TESTQ_FILES = 25
RECEIPTS = 500                          # the recent receipts searched for a PASS at this HEAD's tree
TABLE_SEP = re.compile(r"^\|?[\s:|-]+\|?$")
ORDER_TAIL = re.compile(r"\s*\([^()]*\)$")
IMPORT = re.compile(r"""(?:from|import)\s*\(?\s*['"](\.\.?/[^'"]+)['"]""")
PY_IMPORT = re.compile(r"^[ \t]*(?:from[ \t]+(\w+)[\w.]*[ \t]+import\b|import[ \t]+([\w., \t]+))", re.M)
TEST_FILE = re.compile(r"(\.test\.ts|(^|/)test_\w+\.py)$")
ALL = ("package.json", "package-lock.json", "tsconfig.json", "vite.config.ts")   # each selects every test file
NO_TESTS = (   # (path glob, why no test needs it): paths no test reaches that a diff may still change; reviewed, never grown to fit a diff
    ("*.md", "prose; no test reads it"),
    ("docs/*", "notes, references and the queue files (land.py's queue gate reads those)"),
    ("handoffs/*", "hand-off notes and their images"),
    ("screenshots/*", "shot output and baselines; the owner's verdict, no test reads the bytes"),
    ("*.png", "art; a test that names one maps it to itself first"),
    ("*.webp", "art; as *.png"),
    ("*.jpg", "art; as *.png"),
    ("*.opus", "audio; no test reads the bytes"),
    ("*.mp4", "video; no test reads the bytes"),
    ("*.bin", "baked data; no test reads the bytes"),
    ("assets/*.json", "baked manifests the game loads at run time; a test that names one maps it to itself first"),
    ("*.woff2", "font; no test reads the bytes"),
    ("*.txt", "licence text"),
    ("*.gitkeep", "keeps an empty folder"),
    (".gitignore", "ignore rules"),
    ("index.html", "entry page; `npm run build` covers it"),
    ("e2e/*", "browser jobs: run on the game VM through tools/browser_job.py, never by a land test"),
    ("tests/*.cjs", "browser checks, run on the game VM through tools/browser_job.py"),
    ("scripts/*", "bakers and dev scripts, run by hand or on the game VM"),
    ("dev/*", "dev pages, run on the game VM; tools/flags.cjs checks their flag entries"),
    ("gen/*", "offline painters and bakers; nothing at load reads them"),
    ("tools/*.cjs", "the checks land.py itself runs as gates (systems, size, reach, flags, text)"),
)
RID = re.compile(r"rid=(\w+)")
PLAYTEST = re.compile(r"\bplaytest ([\w.-]+)", re.I)
PENDING = re.compile(r"\b(pending|not landed|unlanded|to land|awaits? landing)\b", re.I)
MARKER = r"^(<{7}|>{7})( |$)"
STACK_BRANCH = "landstack"              # the batch's integration worktree, .worktrees/landstack (one batch at a time)
DATE_ENV = ("GIT_COMMITTER_DATE", "GIT_AUTHOR_DATE")
OWNER_HOOK = Path(__file__).resolve().parent / "owner_hook.sh"
HOOKS = ("pre-commit", "pre-merge-commit")


class Row(NamedTuple):
    """A queue table row: its cells and the cell count of its table's header."""
    cells: list[str]
    width: int


class Line(NamedTuple):
    """One line of a queue file: its text with the line ending, its cells when it is a row, the width of the table above it."""
    text: str
    cells: list[str] | None
    width: int


def trailers(msgs: str, key: str) -> list[str]:
    """Every `<key>: text` trailer in the commit messages, in order, its value running over following lines up to a blank line or
    the next `Word:` key."""
    out: list[str] = []
    open_ = False
    for line in msgs.splitlines():
        if line.lower().startswith(key.lower() + ":"):
            out.append(line.split(":", 1)[1].strip())
            open_ = True
        elif open_ and line.strip() and not re.match(r"[\w-]+:", line):
            out[-1] += " " + line.strip()
        else:
            open_ = False
    return [t for t in out if t]


def row_id(cell: str) -> str:
    """A queue row's id, case-insensitive: its first cell, spaces collapsed, less a trailing `(order ids)`; a whole quoted row names
    its first cell."""
    cell = cell.strip()
    if cell.startswith("|"):
        cell = cell.strip("|").split("|")[0]
    return ORDER_TAIL.sub("", " ".join(cell.split())).lower()


def scan(text: str) -> list[Line]:
    """Every line of a queue file: a table row (not a header or separator, with a first cell that names an id) carries its cells."""
    lines = text.splitlines(keepends=True)
    out, width = [], 0
    for i, raw in enumerate(lines):
        ln = raw.strip()
        cells = None
        if ln.startswith("|") and ln.endswith("|") and len(ln) > 1 and not TABLE_SEP.match(ln):
            parts = ln[1:-1].split("|")
            if i + 1 < len(lines) and TABLE_SEP.match(lines[i + 1].strip()):
                width = len(parts)
            elif row_id(parts[0]):
                cells = parts
        out.append(Line(raw, cells, width))
    return out


def parse_queue(text: str) -> dict[str, Row]:
    """{row id: Row} of every table row of the queue but a header or a separator."""
    return {row_id(x.cells[0]): Row(x.cells, x.width) for x in scan(text) if x.cells}


def states(rows: dict[str, Row]) -> dict[str, str]:
    """{row id: State (the last cell)}."""
    return {k: r.cells[-1].strip() for k, r in rows.items()}


def state_problems(before: dict[str, Row], after: dict[str, Row]) -> list[str]:
    """One sentence per row this branch changed (or added) whose State breaks the queue's rule: it starts `working:` or
    `waiting on `, holds at most STATE_WORDS words, and holds no `|` (which would add a cell)."""
    out = []
    for k, r in after.items():
        if before.get(k) == r:
            continue
        state = r.cells[-1].strip()
        if len(r.cells) != r.width:
            out.append(f"{k}: {len(r.cells)} cells in a {r.width}-column table (a `|` in a cell?)")
        elif not state.lower().startswith(STATUSES):
            out.append(f"{k}: State starts with neither `working:` nor `waiting on `")
        elif len(state.split()) > STATE_WORDS:
            out.append(f"{k}: State is {len(state.split())} words, over {STATE_WORDS}")
    return out


def unmarked(ids: list[str], before: dict[str, str], after: dict[str, str], ever: frozenset[str] = frozenset()) -> list[str]:
    """The `Queue:` rows this branch leaves unmarked: neither removed from the queue nor given a State starting `working:` or
    `waiting on `. A row in neither queue is closed when the queue's history holds it (`ever`: a merged branch's row, done
    since) and otherwise named `(no such row)`."""
    out = []
    for i in ids:
        b, a = before.get(row_id(i)), after.get(row_id(i))
        if (a is None and b is not None) or (a is not None and a != b and a.lower().startswith(STATUSES)) \
                or (a is None and b is None and row_id(i) in ever):
            continue
        out.append(i if (a, b) != (None, None) else f"{i} (no such row)")
    return out


def stale_states(rows: dict[str, str], branch: str) -> list[str]:
    """Rows whose State still calls `branch` unlanded (`branch x pending`, `x not landed`) in one clause, at its landing."""
    name = re.compile(rf"(?<![\w/-]){re.escape(branch)}(?![\w/-])", re.I)
    return sorted(k for k, v in rows.items() if any(name.search(c) and PENDING.search(c) for c in re.split(r"[;,]|\.\s", v)))


def approved_cards(root: Path) -> set[str]:
    """Ids of the cards whose latest owner decision is `approved`, from `root`'s decisions file (a missing file is no decision)."""
    f = root / DECISIONS
    dec = json.loads(f.read_text(encoding="utf-8"))["decisions"] if f.is_file() else {}
    return {i for i, h in dec.items() if h and h[-1]["status"] == "approved"}


def playtest_held(before: dict[str, str], after: dict[str, str], approved: set[str]) -> list[str]:
    """Rows this branch removes whose State on main names a playtest card still open: feel work is done only when the owner
    approves its card, so the row stays Live until then."""
    return sorted(k for k, v in before.items() if k not in after and (m := PLAYTEST.search(v)) and m[1] not in approved)


def log_only_appended(diff: str) -> bool:
    """True when the branch's diff of the queue log removes or changes no line (append-only)."""
    return not any(x.startswith("-") and not x.startswith("---") for x in diff.splitlines())


def queue_lines(text: str) -> list[tuple[str | None, str]]:
    """[(row id, line)] of a queue file: a table row's id is row_id of its first cell; a header, separator or prose line has none."""
    return [(row_id(x.cells[0]) if x.cells else None, x.text) for x in scan(text)]


def merge_row(mine: str, now: str) -> str | None:
    """One row both sides changed: the branch's line with the Goal that holds both, since a Goal only grows by appended owner
    words and the landing branch's State is the newest; its item cell is the one carrying more order ids. None when the items
    differ or neither Goal extends the other."""
    m, n = scan(mine)[0].cells, scan(now)[0].cells
    if not m or not n or len(m) != len(n) or row_id(m[0]) != row_id(n[0]):
        return None
    gm, gn = m[1].strip(), n[1].strip()
    if not gn.startswith(gm) and not gm.startswith(gn):
        return None
    out = now if gn.startswith(gm) else now.replace(gn, gm, 1)
    im, i_n = m[0].strip(), n[0].strip()
    return out.replace(i_n, im, 1) if len(im) > len(i_n) else out


def merge_queue(base: str, ours: str, theirs: str) -> str | None:
    """A queue file for a rebase stop: `ours` (main's side) with each row the branch's commit (`theirs`) changed against `base`
    re-applied, matched by row id; a row both sides changed goes through merge_row. None when merge_row cannot hold both, a row
    id repeats, or the branch changed a line that is no row."""
    b, o, t = queue_lines(base), queue_lines(ours), queue_lines(theirs)
    if [ln for k, ln in b if k is None] != [ln for k, ln in t if k is None]:
        return None
    rows = [{k: ln for k, ln in x if k} for x in (b, o, t)]
    if any(len(r) != sum(1 for k, _ in x if k) for r, x in zip(rows, (b, o, t))):
        return None
    rb, ro, rt = rows
    out = list(o)
    order = [k for k, _ in t if k]
    for k in dict.fromkeys([*rb, *order]):
        was, mine, now = rb.get(k), ro.get(k), rt.get(k)
        if now in (was, mine):
            continue
        if mine != was:
            now = merge_row(mine, now) if mine and now else None
            if now is None:
                return None
        keys = [x for x, _ in out]
        if now is None:
            del out[keys.index(k)]
        elif mine is not None:
            out[keys.index(k)] = (k, now)
        else:   # a row the branch added: after the row before it in the branch's file, else before the row after it
            i = order.index(k)
            at = next((keys.index(p) + 1 for p in reversed(order[:i]) if p in keys), None)
            at = at if at is not None else next((keys.index(n) for n in order[i + 1:] if n in keys), None)
            if at is None:
                return None
            out.insert(at, (k, now))
    return "".join(ln for _, ln in out)


def rerun_if_changed(path: Path, loaded: bytes, args: list[str]) -> None:
    """Replace this process with a fresh run of `path` when its code is no longer `loaded` (the rebase brought main's): the
    gates always run on the tool the branch now has."""
    if path.read_bytes() != loaded:
        print("land.py: the rebase changed land.py; running main's", flush=True)
        os.execv(sys.executable, [sys.executable, str(path), *args])


def rebase(cwd: Path, *args: str) -> str:
    """`git rebase <args>` (`<onto>`, or `--onto <base> <upstream> <tip>`) in `cwd`, resolving each conflict in a queue file row by row (merge_queue) and in tools/size.cjs as
    main's list lowered (`size.cjs lower`). '' when rebased, else why (any other conflict, or a queue conflict merge_queue cannot
    place, aborts the rebase and leaves the branch as it was)."""
    env = dict(os.environ, GIT_EDITOR="true")

    def g(*a: str) -> subprocess.CompletedProcess:
        return subprocess.run(["git", *a], cwd=cwd, env=env, capture_output=True, text=True, encoding="utf-8")

    if len(args) == 1 and not g("merge-base", "--is-ancestor", args[0], "HEAD").returncode:
        return ""   # the branch has merged `onto` and already sits on it; a rebase would flatten its merges
    print(f"== rebase {' '.join(args)}", flush=True)
    rc = subprocess.run(["git", "rebase", *args], cwd=cwd, env=env).returncode
    while rc:
        files = g("diff", "--name-only", "--relative", "--diff-filter=U").stdout.splitlines()
        why = "" if files else "git rebase failed with no conflicted file"
        for f in files:
            if f == SIZE:   # main's list, lowered to the files as this commit leaves them
                (cwd / f).write_bytes(g("show", f":2:./{f}").stdout.encode("utf-8"))
                subprocess.run(["node", f, "lower"], cwd=cwd, env=env, capture_output=True)
                g("add", "--", f)
                continue
            if f not in QUEUES:
                why = f"{f} conflicts"
                break
            sides = [g("show", f":{n}:./{f}") for n in (1, 2, 3)]
            text = None if any(s.returncode for s in sides) else merge_queue(*(s.stdout for s in sides))
            if text is None:
                why = f"{f}: a row both sides changed whose Goals diverge, or the branch changed a line that is no row"
                break
            (cwd / f).write_bytes(text.encode("utf-8"))
            g("add", "--", f)
        if why:
            g("rebase", "--abort")
            return f"{why}; the rebase is aborted, the branch is as it was"
        print(f"== resolved {', '.join(files)}", flush=True)
        g("commit", "-q", "--allow-empty", "-C", "REBASE_HEAD")   # a commit the resolution emptied keeps its message
        rc = subprocess.run(["git", "rebase", "--continue"], cwd=cwd, env=env).returncode
    return ""


def clip(text: str, cap: int = 200) -> str:
    return text if len(text) <= cap else text[:cap - 1].rstrip() + "…"


def log_entry(branch: str, msgs: str, hashes: str, day: str) -> str:
    """The landing's one queue-log line: day, the `Queue:` rows or `-`, the branch, its Directive, what it Landed, the commit
    hashes (one `git log --format=%h` per line). The gates have refused a branch with no Directive or Landed trailer; the full
    text stays in the commit messages."""
    rows = ", ".join(dict.fromkeys(trailers(msgs, "Queue"))) or "-"
    return (f"- {day} · {rows} ({branch}) · {clip(' '.join(trailers(msgs, 'Directive')), 160)} · "
            f"{clip(' '.join(trailers(msgs, 'Landed')))} · {', '.join(hashes.split())}\n")


def import_graph(texts: dict[str, str]) -> dict[str, set[str]]:
    """{file: the files it imports}, over the files of `texts` ({repo-relative path: source}). A TypeScript specifier is
    relative and resolves to `<spec>`, `<spec>.ts`, `<spec>/index.ts` or `<spec>` with `.js` read as `.ts`. A Python import
    names a module beside the file (each tool puts its own folder on sys.path): its top-level name is `<dir>/<name>.py`. An
    import that resolves to no file of `texts` (a json, a css, the standard library) is no edge."""
    out: dict[str, set[str]] = {}
    for f, text in texts.items():
        d = posixpath.dirname(f)
        if f.endswith(".py"):
            mods = [frm or n for frm, names in PY_IMPORT.findall(text) for n in ([""] if frm else names.split(","))]
            cands = [[posixpath.join(d, m.split()[0].split(".")[0] + ".py")] for m in mods if m.strip()]
        else:
            ps = [posixpath.normpath(posixpath.join(d, spec)) for spec in IMPORT.findall(text)]
            cands = [[p, p + ".ts", p + "/index.ts", re.sub(r"\.js$", ".ts", p)] for p in ps]
        out[f] = {hit for c in cands if (hit := next((x for x in c if x in texts), None)) and hit != f}
    return out


def readers(path: str, texts: dict[str, str]) -> set[str]:
    """The test files of `texts` that name `path` or a folder of it two or more levels deep (a test reading `assets/thread/` or
    `tools/owner_hook.sh` by name). A docs/ file has none: a test names one only to cite it (the queue gate's tests build their
    own queue files)."""
    if path.startswith("docs/"):
        return set()
    parts = path.split("/")
    names = [path] + ["/".join(parts[:i]) for i in range(len(parts) - 1, 1, -1)]
    return {f for f, t in texts.items() if TEST_FILE.search(f) and any(n in t for n in names)}


def users_of(texts: dict[str, str]) -> dict[str, set[str]]:
    """{file: the files of `texts` that import it}."""
    users: dict[str, set[str]] = {}
    for f, deps in import_graph(texts).items():
        for d in deps:
            users.setdefault(d, set()).add(f)
    return users


def unmapped(changed: list[str], texts: dict[str, str]) -> list[str]:
    """The changed paths that map to no test and are in no NO_TESTS row: a path maps when it is in ALL, is `.ts` or a tools/*.py
    (the import graph decides), is imported by a file of `texts`, or is named by a test file; the landing fails on the rest."""
    users = users_of(texts)
    return [c for c in changed if not (c in ALL or c.endswith(".ts") or (c.endswith(".py") and posixpath.dirname(c) == "tools")
                                       or users.get(c) or readers(c, texts)
                                       or any(fnmatch.fnmatchcase(c, g) for g, _ in NO_TESTS))]


def affected_tests(changed: list[str], texts: dict[str, str]) -> list[str]:
    """The test files of `texts` (`*.test.ts`, `test_*.py`) that are changed, name a changed path, or whose import closure
    reaches a changed file, sorted; every one when a path of ALL changed."""
    if any(c in ALL for c in changed):
        return sorted(f for f in texts if TEST_FILE.search(f))
    users = users_of(texts)
    hit = {c for c in changed if c in texts} | {r for c in changed if not c.endswith((".ts", ".py")) for r in readers(c, texts)}
    todo = list(hit)
    while todo:
        for u in users.get(todo.pop(), ()):
            if u not in hit:
                hit.add(u)
                todo.append(u)
    return sorted(f for f in hit if TEST_FILE.search(f))


def testq_batches(files: list[str]) -> list[list[str]]:
    """`files` as testq runs: one runner per batch (vitest `.ts`, pytest `.py`), at most TESTQ_FILES files each."""
    out = []
    for kind in (".ts", ".py"):
        mine = [f for f in files if f.endswith(kind)]
        out += [mine[i:i + TESTQ_FILES] for i in range(0, len(mine), TESTQ_FILES)]
    return out


def rel(target: str, root: Path) -> str:
    """A receipt target as a `root`-relative posix path (testq stores the target as given, relative or absolute)."""
    return Path(os.path.relpath(os.path.join(root, target), root)).as_posix()


def verdicts(receipts: list[dict], root: Path, stale: Callable[[str], set[str] | None]) -> dict[str, str]:
    """Each test file's verdict (`passed` or `failed`) from its newest receipt that still holds: one whose tested tree differs
    from HEAD's in no path that affects the file. `stale(tree)` is the test files that tree's diff to HEAD affects, None for a
    tree git does not hold. A queue edit or another file's change leaves a receipt standing."""
    out: dict[str, str] = {}
    for r in receipts:   # newest first
        if r.get("status") not in ("passed", "failed"):
            continue
        hit = stale(r.get("tree") or "")
        if hit is None:
            continue
        for t in r["targets"]:
            if (f := rel(t, root)) not in hit:
                out.setdefault(f, r["status"])
    return out


def status_argv(zs_root: str) -> list[str]:
    return [sys.executable, f"{zs_root}/zunstack-app/tools/testq.py", "status", "--json", "--limit", str(RECEIPTS)]


def read_receipts(zs_root: str) -> list[dict]:
    """The test queue's recent receipts (`testq status --json`), newest first."""
    r = subprocess.run(status_argv(zs_root), capture_output=True, text=True)
    if r.returncode:
        raise SystemExit(f"land.py: testq status failed ({r.returncode}):\n{r.stdout}{r.stderr}")
    return json.loads(r.stdout)


def testq_argv(zs_root: str, files: list[str], worktree: Path) -> list[str]:
    return [sys.executable, f"{zs_root}/zunstack-app/tools/testq.py", "run", "--worktree", str(worktree), *files]


def merge_argv(zs_root: str, repo: Path, ref: str, label: str = "") -> list[str]:
    """The lane merge of `ref` (a branch, or the batch stack's HEAD) into `repo`'s main; `label` names it in the lane's why."""
    return [sys.executable, f"{zs_root}/engine/Universal/tooling/lib/gitlane.py", "merge", "--repo", str(repo),
            "--why", f"land {label or ref} onto {MAIN}", "--", "--no-ff", ref]


def git(*args: str, cwd: Path | None = None) -> str:
    r = subprocess.run(["git", *args], cwd=cwd or ROOT, capture_output=True, text=True)
    if r.returncode:
        raise SystemExit(f"land.py: git {' '.join(args)} failed ({r.returncode}):\n{r.stdout}{r.stderr}")
    return r.stdout


class Failed(SystemExit):
    """A gate that ran and came back red: a step's non-zero exit, or a failed test receipt. The batch bisects on it."""


class Pending(SystemExit):
    """Tests were submitted and have no verdict yet: rerun once it arrives."""


def step(name: str, argv: list[str], cwd: Path | None = None) -> None:
    """Run one gate. Rolldown (the build, reach.cjs's graphs) allocates through mimalloc, whose eagerly committed arenas keep
    every freed page resident: with eager commit off a build holds 1.1 GB at its peak, not 1.7."""
    print(f"== {name}", flush=True)
    r = subprocess.run(argv, cwd=cwd or ROOT, env={**os.environ, "MIMALLOC_ARENA_EAGER_COMMIT": "0"})
    if r.returncode:
        raise Failed(f"land.py: {name} failed ({r.returncode}); not landed")


def primary_checkout() -> Path:
    first = git("worktree", "list", "--porcelain").splitlines()[0]
    return Path(first.split(" ", 1)[1])


def game_dir(checkout: Path) -> Path:
    """The game's folder (ROOT's place) in `checkout`, a checkout of the repo ROOT is in: every git path here is relative to it."""
    return checkout / git("rev-parse", "--show-prefix").strip()


def changed_files(*args: str) -> list[str]:
    """`git diff --name-only <args>` limited to ROOT, its paths relative to it."""
    return git("diff", "--name-only", "--relative", *args).splitlines()


def queue_at(ref: str, absent_ok: bool, cwd: Path | None = None, path: str = QUEUE) -> str:
    """A queue file's text at `ref`. A file the ref does not hold reads as empty when `absent_ok` (the base predates it);
    every other git failure raises."""
    if absent_ok and not git("ls-tree", "--name-only", ref, "--", path, cwd=cwd).strip():
        return ""
    return git("show", f"{ref}:./{path}", cwd=cwd)


def rows_at(ref: str, absent_ok: bool, cwd: Path | None = None) -> dict[str, Row]:
    """The rows of both queue files at `ref` as one set (the deferred file may be absent)."""
    out: dict[str, Row] = {}
    for path in QUEUES:
        out |= parse_queue(queue_at(ref, absent_ok or path != QUEUE, cwd, path))
    return out


def unlogged_rows(removed: dict[str, Row], named: list[str], logged: list[str]) -> list[str]:
    """The `removed` rows (id -> the row as it was) that neither a `Queue:` trailer (`named`; land.py's log line carries it) nor
    an added queue-log line (`logged`) names: the row's first cell between the line's ` · ` separators."""
    ids = {row_id(n) for n in named}
    return sorted(k for k, r in removed.items()
                  if k not in ids and not any(f" {r.cells[0].strip()} " in a or f"· {r.cells[0].strip()} ·" in a for a in logged))


def queue_gate(msgs: str, before: dict[str, Row], after: dict[str, Row], branch: str, approved: set[str],
               logged: list[str], ever: frozenset[str] = frozenset()) -> list[str]:
    """The queue and trailer rules over one branch's commit messages, the queue rows before and after it and the queue-log lines
    it adds: every refusal with its fix."""
    ids = trailers(msgs, "Queue")
    out = []
    missing = [k for k in ("Directive", "Landed") if not trailers(msgs, k)]
    if missing:
        out.append("the branch must explain itself: a commit message carries `Directive: <what you were told, in the owner's "
                   f"words where you have them>` and `Landed: <what this landing does, with the numbers or proof>` (missing: {', '.join(missing)})")
    bad = state_problems(before, after)
    if bad:
        out.append(f"{QUEUE} States must start `working:` or `waiting on `, hold at most {STATE_WORDS} words and no `|`:\n    "
                   + "\n    ".join(bad))
    removed = before.keys() - after.keys()
    unnamed = unlogged_rows({k: before[k] for k in removed}, ids, logged)
    if unnamed:
        out.append(f"{QUEUE} drops row(s) {', '.join(unnamed)} that no `Queue: <row id>` commit trailer or added {QUEUE_LOG} line names")
    left = unmarked(ids, states(before), states(after), ever)
    if left:
        out.append(f"`Queue:` rows left unmarked in {QUEUE}: {', '.join(left)}. Set the row's State to `working:` or "
                   "`waiting on <who>:` (or remove the row when done) in a commit on the branch")
    held = playtest_held(states(before), states(after), approved)
    if held:
        out.append(f"{QUEUE} drops row(s) {', '.join(held)} whose State names a playtest card the owner has not approved; the row "
                   f"stays Live as `waiting on the owner: playtest <id>` until the owner's latest ruling on that card is approved ({DECISIONS})")
    pending = stale_states(states(after), branch)
    if pending:
        out.append(f"{QUEUE} still calls branch {branch} unlanded in row(s) {', '.join(pending)}; this landing lands it: "
                   "drop the pending/not-landed words for it from those States on the branch")
    return out


def conflict_markers(files: list[str]) -> list[str]:
    """The files of `files` whose HEAD copy holds a conflict marker line."""
    r = subprocess.run(["git", "grep", "-l", "-I", "-E", MARKER, "HEAD"], cwd=ROOT, capture_output=True, text=True, encoding="utf-8")
    return sorted({ln.partition(":")[2] for ln in r.stdout.splitlines()} & set(files))


def refusals(base: str, branch: str) -> list[str]:
    """The static gates over the commits `base..HEAD` of `branch`: every refusal with its fix."""
    rng = f"{base}..HEAD"
    log_diff = git("diff", rng, "--", QUEUE_LOG)
    out = queue_gate(git("log", rng, "--format=%B%n"), rows_at(base, True), rows_at("HEAD", False), branch,
                     approved_cards(game_dir(primary_checkout())), [x[1:] for x in log_diff.splitlines() if x.startswith("+") and not x.startswith("+++")],
                     frozenset(row_id(x[1:]) for x in git("log", "-p", "--full-history", "--format=", "HEAD", "--", *QUEUES).splitlines() if x.startswith("+|")))
    marked = conflict_markers(changed_files("--diff-filter=AM", rng))
    if marked:
        out.append("conflict markers committed in " + ", ".join(marked) + "; resolve them and commit")
    if not log_only_appended(log_diff):
        out.append(f"{QUEUE_LOG} is append-only; restore its edited lines from {base}")
    return out


def tests_check(zs: str, base: str) -> None:
    """Every changed path maps to tests or is in NO_TESTS; every test it affects has a testq PASS receipt that holds at HEAD
    (`verdicts`; a failed one is red); the ones without are submitted."""
    changed = changed_files("--diff-filter=d", f"{base}..HEAD")   # a deleted path's importers changed too
    texts = {f: (ROOT / f).read_text(encoding="utf-8") for f in git("ls-files", "*.ts", "*.json", "tools/*.py").splitlines()}
    loose = unmapped(changed, texts)
    if loose:
        raise SystemExit(f"land.py: not landed: no test maps changed path(s) {', '.join(loose)}; a test that reads one names it "
                         "(or imports it), else it is a path no test needs and goes in land.py's NO_TESTS with why")
    wanted = affected_tests(changed, texts)
    if not wanted:
        print("== no test file is affected by the diff")
        return
    head, diffs = git("rev-parse", "HEAD^{tree}").strip(), {}

    def stale(tree: str) -> set[str] | None:
        if tree not in diffs:
            r = subprocess.run(["git", "diff", "--name-only", "--relative", tree, head], cwd=ROOT, capture_output=True, text=True)
            diffs[tree] = None if r.returncode else set(affected_tests(r.stdout.split(), texts))
        return diffs[tree]

    got = verdicts(read_receipts(zs), ROOT, stale)
    red = sorted(f for f in wanted if got.get(f) == "failed")
    if red:
        raise Failed(f"land.py: red: {', '.join(red)} failed on content this HEAD still has; fix them and commit; not landed")
    missing = [f for f in wanted if got.get(f) != "passed"]
    if not missing:
        print(f"== tests: {len(wanted)} affected file(s) have a PASS receipt that holds at this HEAD")
        return
    rids = []
    for batch in testq_batches(missing):
        r = subprocess.run(testq_argv(zs, batch, ROOT), cwd=ROOT, capture_output=True, text=True)
        print(r.stdout + r.stderr, end="", flush=True)
        m = RID.search(r.stdout)
        if r.returncode or not m:
            raise SystemExit(f"land.py: testq refused the tests (exit {r.returncode}); not landed")
        rids.append(m[1])
    raise Pending(f"land.py: {len(missing)} of {len(wanted)} affected test file(s) have no PASS receipt at this HEAD; submitted "
                  f"{len(missing)} as {', '.join(rids)}. Rerun land.py after the PASS arrives.")


def checks(zs: str, base: str) -> None:
    """The gates that run on the tree as it stands (a branch or the batch's stack): typecheck, the structure checks, the inject
    cap, the tests the diff from `base` affects, the build."""
    node = shutil.which("node") or "node"
    step("typecheck", [NPM, "run", "typecheck"])
    for name in ("systems", "size", "reach", "flags", "text"):
        step(name, [node, f"tools/{name}.cjs", "check"])
    lint = Path(zs) / "engine/System/tooling/instructions/substrate_lint.py"
    step("inject cap", [sys.executable, str(lint), "--inject-check", str(ROOT / QUEUE)])
    tests_check(zs, base)
    step("build", [node, "node_modules/vite/bin/vite.js", "build", "--mode", "course"])   # `npm run build` less its typecheck, which ran first


def gates(zs: str, base: str, branch: str) -> None:
    """Every gate after the rebase and before the log entry."""
    why = refusals(base, branch)
    if why:
        raise SystemExit("land.py: not landed:\n  " + "\n  ".join(why))
    checks(zs, base)


def log_commit(zs: str, branch: str, base: str, day: str) -> None:
    """Commit the landing's one queue-log line (log_entry of the commits `base..HEAD`)."""
    rng = f"{base}..HEAD"
    with open(ROOT / QUEUE_LOG, "a", encoding="utf-8", newline="\n") as f:
        f.write(log_entry(branch, git("log", rng, "--format=%B%n"), git("log", "--reverse", "--format=%h", rng), day))
    step("queue-log entry", [sys.executable, f"{zs}/engine/Universal/tooling/lib/gitlane.py", "commit", "--paths", QUEUE_LOG,
                             "-m", f"{LOG_COMMIT}\n\n{CO_AUTHOR}"])


def install_owner_hook(main_co: Path) -> None:
    """tools/owner_hook.sh as the shared pre-commit and pre-merge-commit hook of `main_co`'s repository."""
    hooks = Path(git("rev-parse", "--path-format=absolute", "--git-common-dir", cwd=main_co).strip()) / "hooks"
    for n in HOOKS:
        (hooks / n).write_bytes(OWNER_HOOK.read_bytes())
        (hooks / n).chmod(0o755)   # git runs a hook only when it is executable (Linux, macOS); a no-op on Windows


def index_rows(cwd: Path) -> dict[str, Row]:
    """The rows of both queue files as staged in `cwd`'s index (a file the index lacks has no rows)."""
    out: dict[str, Row] = {}
    for path in QUEUES:
        if git("ls-files", "--", path, cwd=cwd).strip():
            out |= parse_queue(git("show", f":./{path}", cwd=cwd))
    return out


def staged() -> None:
    """`--staged`, the worktree pre-commit hook: refuse a staged queue change whose States break the queue rules (state_problems)."""
    cwd = Path.cwd()
    bad = state_problems(rows_at("HEAD", True, cwd), index_rows(cwd))
    if bad:
        raise SystemExit(f"commit refused: {QUEUE} States must start `working:` or `waiting on `, hold at most {STATE_WORDS} "
                         "words and no `|`:\n    " + "\n    ".join(bad))


def stack(zs: str, branches: list[tuple[str, str]], day: str, dropped: dict[str, str]) -> list[tuple[str, str]]:
    """Rebuild the stack worktree (ROOT) as main plus each (name, tip) rebased in order, each followed by its queue-log commit.
    Returns the stacked ones; the others go into `dropped` with why."""
    subprocess.run(["git", "rebase", "--abort"], cwd=ROOT, capture_output=True)   # a stale one from a killed run
    git("checkout", "-q", "-B", STACK_BRANCH, MAIN)
    kept = []
    for name, tip in branches:
        base = git("rev-parse", "HEAD").strip()
        why = rebase(ROOT, "--onto", base, MAIN, tip)
        if why:
            why = f"conflicts with {MAIN} or the branches stacked before it: {why}"
        else:
            git("checkout", "-q", "-B", STACK_BRANCH)   # the rebase leaves HEAD detached; the log commit goes through the lane
            why = "\n".join(refusals(base, name))
        if why:
            git("reset", "-q", "--hard", base)
            dropped[name] = why
            continue
        log_commit(zs, name, base, day)
        kept.append((name, tip))
    return kept


def batch(wts: list[str]) -> int:
    """Land several worktrees' branches as one stack with one pass of checks (module docstring); 0 only when every branch landed."""
    global ROOT
    zs = os.environ.get("ZS_ROOT")
    if not zs:
        raise SystemExit("land.py: ZS_ROOT is not set")
    owner = primary_checkout()
    if git("rev-parse", "--abbrev-ref", "HEAD", cwd=owner).strip() != MAIN:
        raise SystemExit(f"land.py: the primary checkout {owner} is not on {MAIN}")
    branches, dates = [], []
    for w in wts:
        p = Path(w) if Path(w).is_dir() else owner / ".worktrees" / w
        tip = git("rev-parse", "HEAD", cwd=p).strip()
        if git("log", "-1", "--format=%s", cwd=p).strip() == LOG_COMMIT:   # left by a failed single landing
            tip = git("rev-parse", "HEAD~1", cwd=p).strip()
        branches.append((git("rev-parse", "--abbrev-ref", "HEAD", cwd=p).strip(), tip))
        dates.append(git("log", "-1", "--format=%ct %cI", tip, cwd=p).split())
    when = max(dates, key=lambda d: int(d[0]))[1]   # every rebuild of the same stack makes the same commits: the tree its receipts name
    tree = owner / ".worktrees" / STACK_BRANCH
    if not (tree / ".git").exists():
        subprocess.run([sys.executable, f"{zs}/engine/Universal/tooling/lib/wt.py", "new", owner.name, STACK_BRANCH], check=True)
    env = {k: os.environ.get(k) for k in DATE_ENV}
    os.environ.update({k: when for k in DATE_ENV})
    old, ROOT = ROOT, game_dir(tree)
    try:
        return land_stack(zs, owner, branches, when[:10])
    finally:
        ROOT = old
        for k, v in env.items():
            os.environ.pop(k, None) if v is None else os.environ.__setitem__(k, v)


def land_stack(zs: str, owner: Path, branches: list[tuple[str, str]], day: str) -> int:
    """`batch` with ROOT the stack worktree: stack, check (halving on red), merge the stack that passed onto main."""
    dropped: dict[str, str] = {}
    red: list[str] = []
    greens: set[str] = set()

    def head() -> str:
        return git("rev-parse", "HEAD").strip()

    def find(good: list, cand: list, red_known: bool = False) -> list:
        """The branches of `cand` that land green on `good` (green already): all of them, else each half in turn."""
        kept = stack(zs, good + cand, day, dropped)
        cand = [b for b in cand if b in kept]
        if not cand:
            return []
        if not red_known:
            try:
                checks(zs, MAIN)
            except Failed as e:
                print(e.code, file=sys.stderr, flush=True)
            else:
                greens.add(head())
                return cand
        if len(cand) == 1:
            red.append(cand[0][0])
            return []
        mid = len(cand) // 2
        a = find(good, cand[:mid])
        return a + find(good + a, cand[mid:], a == cand[:mid])   # the whole first half green: the red is in the rest

    good = find([], branches)
    report = "".join(f"\nland.py: batch DROPPED {n}: {w}" for n, w in dropped.items()) + \
        "".join(f"\nland.py: batch RED {n}: its checks fail on the stack" for n in red)
    if not good:
        raise SystemExit("land.py: batch: nothing landed" + report)
    if head() not in greens:   # the last stack tried was a red one
        stack(zs, good, day, dropped)
    if head() not in greens:
        raise SystemExit("land.py: batch: the final stack is not one that passed; nothing landed" + report)
    names = " ".join(n for n, _ in good)
    step(f"merge into {MAIN}", merge_argv(zs, owner, head(), names))
    install_owner_hook(owner)
    print(f"landed {names} on local {MAIN} (not pushed)")
    if report:
        print(report.strip(), file=sys.stderr)
    return 1 if report else 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--check", action="store_true", help="every gate but the rebase, the log entry and the merge")
    ap.add_argument("--staged", action="store_true", help="the pre-commit hook's State check of the staged queue files")
    ap.add_argument("--batch", nargs="+", metavar="WT", help="land several worktrees' branches in turn")
    args = ap.parse_args(argv)
    if args.staged:
        staged()
        return 0
    if args.batch:
        return batch(args.batch)
    zs = os.environ.get("ZS_ROOT")
    if not zs:
        raise SystemExit("land.py: ZS_ROOT is not set")
    branch = git("rev-parse", "--abbrev-ref", "HEAD").strip()
    if branch in (MAIN, "HEAD"):
        raise SystemExit(f"land.py: run it on a worktree branch, not {branch}")
    if git("status", "--porcelain").strip():
        raise SystemExit("land.py: the tree is dirty; commit or drop the changes first")
    if args.check:
        gates(zs, git("merge-base", MAIN, "HEAD").strip(), branch)
        print("land.py: --check passed")
        return 0
    main_co = primary_checkout()
    if git("rev-parse", "--abbrev-ref", "HEAD", cwd=main_co).strip() != MAIN:
        raise SystemExit(f"land.py: the primary checkout {main_co} is not on {MAIN}")
    if git("log", "-1", "--format=%s").strip() == LOG_COMMIT:   # left by a killed run: write the entry afresh
        git("reset", "--keep", "HEAD~1")
    why = rebase(ROOT, MAIN)
    if why:
        raise SystemExit(f"land.py: the rebase on {MAIN} failed: {why}")
    rerun_if_changed(SELF, LOADED, sys.argv[1:])
    gates(zs, MAIN, branch)
    log_commit(zs, branch, MAIN, datetime.date.today().isoformat())
    try:
        step(f"merge into {MAIN}", merge_argv(zs, main_co, branch))
    except SystemExit:
        git("reset", "--keep", "HEAD~1")   # the entry goes with the failed landing
        raise
    install_owner_hook(main_co)
    print(f"landed {branch} on local {MAIN} (not pushed)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
