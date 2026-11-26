# Work queue

The specs for the owner's open orders: each item is one task an agent starts with no scoping (what to change, where, the measure that ends it). Specs only, no history: an item leaves this file in its landing's own commit (`tools/land.py` logs the landing in `docs/queue-log.md`). The owner's orders, verbatim, and their status are in `docs/queue.md`; each item names its row. The rules for every item are `contract.md`, Work.

## In flight

| Item | Row | Who | Open |
|---|---|---|---|
| zvc-tools | PERF | waiting on zunstack-app (testd's then) | What of ZvC's tooling makes sense for a light browser game, cheaper than now, no shot regression; no warm server (the game boots in 0.8 s). (1) A shot's round trip near its real cost: one at `?scene=play&seed=7&mute=1` takes 11.4 s for 0.8 s boot, 3.2 s settle and 0.3 s capture; measure where the rest goes (staging 2.3 s, browser launch, job start) and cut it. (2) Landing chains: when `tools/land.py` submits tests it files them with testq `--then` rerunning the same land, so a pass lands with no caller rerun. (3) A change under `docs/` selects no tests; `readers()` stops treating a test that names a docs file as its reader. (4) The browser job ledger's end row carries its staging, run and round-trip ms. Each with its test; `tools/test_shot.py`, `test_browser_job.py`, `test_browser_watch.py`, `test_land.py` green; a shot before and after, looked at and matching, with both times. |

## Next (staff in this order)

| Item | Row | Open |
|---|---|---|
| wt-verdicts | WTGATE | Fleet-wide, in engine (`Universal/tooling/hooks`, beside `comms_check.py`) and zunstack-app, each in its own worktree and landing. (1) A worktree verdict marker, one per existing worktree of the session's repos, schema like the comms marker: `<!-- wt: <repo>/<name> <verdict> -->`, verdict `live` (an agent or session is working in it), `keep: <why>` (the session's ruling), `drop` (the session removes it the same turn), or `ask` (the owner rules). (2) A merge gate: a landing (`wt.py land`, `gitlane.py merge`) by a main session refuses turn end until its reply carries a marker for every worktree that exists after the landing; a missing or malformed marker is refused as the comms meter refuses, naming the trees. A `drop` marker whose tree still exists at turn end is refused. (3) The app renders `live`, `keep` and `drop` markers hidden (routine); an `ask` on a tree that exists, is not live and has no standing owner ruling is shown to the owner to rule; the ruling is recorded so the same tree is not asked again. One implementation of the marker parse shared by the gate and the app. Tests with a control arm for each refusal and each render. Proof: a landing in CSE312 refused without markers and passed with them. |
