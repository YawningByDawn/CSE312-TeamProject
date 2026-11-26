# Work queue

The specs for the owner's open orders: each item is one task an agent starts with no scoping (what to change, where, the measure that ends it). Specs only, no history: an item leaves this file in its landing's own commit (`tools/land.py` logs the landing in `docs/queue-log.md`). The owner's orders, verbatim, and their status are in `docs/queue.md`; each item names its row. The rules for every item are `contract.md`, Work.

## In flight

| Item | Row | Who | Open |
|---|---|---|---|
| zvc-tools | PERF | waiting on zunstack-app (testd's then) | What of ZvC's tooling makes sense for a light browser game, cheaper than now, no shot regression; no warm server (the game boots in 0.8 s). (1) A shot's round trip near its real cost: one at `?scene=play&seed=7&mute=1` takes 11.4 s for 0.8 s boot, 3.2 s settle and 0.3 s capture; measure where the rest goes (staging 2.3 s, browser launch, job start) and cut it. (2) Landing chains: when `tools/land.py` submits tests it files them with testq `--then` rerunning the same land, so a pass lands with no caller rerun. (3) A change under `docs/` selects no tests; `readers()` stops treating a test that names a docs file as its reader. (4) The browser job ledger's end row carries its staging, run and round-trip ms. Each with its test; `tools/test_shot.py`, `test_browser_job.py`, `test_browser_watch.py`, `test_land.py` green; a shot before and after, looked at and matching, with both times. |

## Next (staff in this order)

| Item | Row | Open |
|---|---|---|
| cards-fix | PLAY | Playing and discarding a card does nothing on current main: find why (input, the hand's drag/click, the sim's play and discard, the night's action points) and fix it at the root. A test that plays and discards through the same path the UI uses, red before and green after; a browser run that plays and discards a card at night, its shots looked at. A bug fix: lands without a card. |
| miners | PLAY | The mine holds 3 miners besides the possessed host (today far more). The first host (the first miner) spawns near the grave each day, not elsewhere. Numbers in the sim's tables (DECISIONS.md). Bots `python tools/bots.py --timeout 7200 -- 500 all --md` before and after, reported, no retune. Shots of the mine at dawn looked at; a card `miners`. |
| enemy-outline | PLAY | Enemies (skeletons) carry a thin red outline. Baked into their frames offline (nothing draws live), every frame and facing. Shots in the mine beside a miner, looked at; a card `enemy-outline`. |
