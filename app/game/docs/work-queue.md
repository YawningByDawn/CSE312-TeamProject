# Work queue

The specs for the owner's open orders: each item is one task an agent starts with no scoping (what to change, where, the measure that ends it). Specs only, no history: an item leaves this file in its landing's own commit (`tools/land.py` logs the landing in `docs/queue-log.md`). The owner's orders, verbatim, and their status are in `docs/queue.md`; each item names its row. The rules for every item are `contract.md`, Work.

## In flight

| Item | Row | Who | Open |
|---|---|---|---|
| zvc-tools | PERF | waiting on zunstack-app (testd's then) | What of ZvC's tooling makes sense for a light browser game, cheaper than now, no shot regression; no warm server (the game boots in 0.8 s). (1) A shot's round trip near its real cost: one at `?scene=play&seed=7&mute=1` takes 11.4 s for 0.8 s boot, 3.2 s settle and 0.3 s capture; measure where the rest goes (staging 2.3 s, browser launch, job start) and cut it. (2) Landing chains: when `tools/land.py` submits tests it files them with testq `--then` rerunning the same land, so a pass lands with no caller rerun. (3) A change under `docs/` selects no tests; `readers()` stops treating a test that names a docs file as its reader. (4) The browser job ledger's end row carries its staging, run and round-trip ms. Each with its test; `tools/test_shot.py`, `test_browser_job.py`, `test_browser_watch.py`, `test_land.py` green; a shot before and after, looked at and matching, with both times. |

## Next (staff in this order)

| Item | Row | Open |
|---|---|---|
| ov-revise | OVERHAUL | On branch `overhaul`. (1) Someone is always possessed: no day without a host (the dawn pick can't be skipped or empty; the first miner is always there), and the host plate is always shown. Whether the night keeps the host plate shown is the owner's "always": keep it shown. (2) Quests become a minimal UI: a few lines with no backing slab, not a whole panel. (3) Reshoot the combat and ui card shots on 8bd6f746 or later, with no miners lying by day. Shots looked at; cards `ov-layout`, `ov-combat`, `ov-ui` rewritten for the main session to repost. |
| ui-2 | UI | On branch `overhaul`. Merge branch `ui` (the §44 scale restore, menus fading only on open, HUD buttons toggling). Then: on big windows the larger panels' backgrounds (the slabs) are low resolution against the oldest stat page; find in git history what the oldest stat page drew its background from (resolution, mip, atlas cell, scale) and restore that for every panel, the root not a per-panel patch. Shots at 1280x720 and 2176x1152 beside the oldest stat page, looked at; a card `ui`. |
