# Work queue

The specs for the owner's open orders: each item is one task an agent starts with no scoping (what to change, where, the measure that ends it). Specs only, no history: an item leaves this file in its landing's own commit (`tools/land.py` logs the landing in `docs/queue-log.md`). The owner's orders, verbatim, and their status are in `docs/queue.md`; each item names its row. The rules for every item are `contract.md`, Work.

## In flight

| Item | Row | Who | Open |
|---|---|---|---|
| zvc-tools | PERF | waiting on zunstack-app (testd's then) | What of ZvC's tooling makes sense for a light browser game, cheaper than now, no shot regression; no warm server (the game boots in 0.8 s). (1) A shot's round trip near its real cost: one at `?scene=play&seed=7&mute=1` takes 11.4 s for 0.8 s boot, 3.2 s settle and 0.3 s capture; measure where the rest goes (staging 2.3 s, browser launch, job start) and cut it. (2) Landing chains: when `tools/land.py` submits tests it files them with testq `--then` rerunning the same land, so a pass lands with no caller rerun. (3) A change under `docs/` selects no tests; `readers()` stops treating a test that names a docs file as its reader. (4) The browser job ledger's end row carries its staging, run and round-trip ms. Each with its test; `tools/test_shot.py`, `test_browser_job.py`, `test_browser_watch.py`, `test_land.py` green; a shot before and after, looked at and matching, with both times. |

## Next (staff in this order)

| Item | Row | Open |
|---|---|---|
| ore-marks | MINE | Possessing a miner, the player can see where to mine: the minable wall sections (the sim's ore/vein cells, §121) carry a baked indicator that they are interactable (nothing draws live), and the one in reach is highlighted with its key shown (the mine key, F by default and rebindable in the Keys tab; left click stays attack). If no minable section exists near the host's start, that is the bug to fix first. Shots of a host walking up to ore, looked at; a card `ore-marks`. |
| drop-text | DEAL | When a slain skeleton drops Nether (§122, the sim's `slain` event with `nether`), a small "+x Nether" rises above where it fell and fades quickly (well under a second and a half). The renderer reads the event; words in `src/content/words/`; no text when nothing dropped. Shots mid-fade looked at; a card `drop-text`. |
| card-deal | DEAL | (1) No card at the very start: the card select comes only when the player becomes the god at night, never while possessing a miner (today a gift sits in hand from the first dawn). Fix where the hand is dealt (sim), not by hiding it. (2) The night's cards rise from the bottom of the screen face down to their places at the centre, then flip face up soon after they arrive. Card backs and the flip are baked frames (nothing draws live). A test that the first day deals nothing; shots of the deal at rise, arrival and flip, looked at; a card `card-deal`. |
