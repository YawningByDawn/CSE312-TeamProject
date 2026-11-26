# Brief — LOOP: the playtest harness and the reel (the shot loop)

Handoff/log: `handoffs/LOOP.md`. Port **5226**. Scratch `/tmp/loop/`.
Read: `DECISIONS.md` **§14.8** and §14 (all), §13.10; `handoffs/briefs/PLAY-v2.md`, `handoffs/PLAY-v2.md`; `e2e/lib/browser.cjs`; `handoffs/briefs/FEEL.md` (pacing guard).

Owner: "Where is the shot visual loop?" Builds were published that nobody had watched being played. **You build the instrument that plays the real game through the real UI and shows, in pictures and numbers, whether it is alive and understandable** — and you run it continuously and report what it shows.

## Build `e2e/playtest/`
1. **Player robots that use only the screen** (mouse, keys, what is visible; state read only through `window.__hg`, a small read-only debug hook the play scene exposes — list exactly what you need from it in your handoff): `guided` (does what the hints/pulsing goal say — if this one gets stuck, a new player is lost), `sensible` (whisper where odds are good, send followers into gray, end night), `clicker` (random plausible clicks — robustness), each from the title screen through cutscene and bonus for N nights with a fixed seed.
2. **The reel** (`node e2e/playtest/reel.cjs --nights 5 --seed 7`) → `screenshots/reel/`: stills of every step; 8-frame strips over 2 s of: the mine at rest, a whisper, a conversion, a Send, the Day replay (16 frames), dusk; the same moments zoomed out to the whole town; a before/after pair of the map each dawn; one contact sheet `reel.png` (≤ 2400 px wide) that tells the five nights as a storyboard; `reel.json`.
3. **Numbers in `reel.json` and a readable `REPORT.md`:** people moving per second at rest (share, mean speed), distinct poses in a 2 s window, screen-quarters with motion, pixels that changed colour (gray → colour) per day and cumulative coloured share of the mine per night, Hold per area per night (from the hook), time from night start to first meaningful action, clicks and seconds per night, input → first visual response (ms), dead time (> 3 s with nothing moving and no prompt), hints shown/dismissed/stuck, text below 12 px, clipped elements, frame time while playing (delivered, vs blank control, with load), console errors/warnings, network requests at runtime (must be none).
4. **Verdict rules (fail loudly):** nobody moving at rest; a day with no colour change; a night with no affordable action; `guided` stuck; any hint that cannot be dismissed or returns; any console error; any dead time > 5 s; input response > 100 ms median.
5. **Baseline now:** run it against the build as it is today (old scene) so the numbers exist before the rewrite lands, then against the new play scene after each of its milestones (watch `handoffs/PLAY-v2.md`). Keep a history table in `REPORT.md`.
6. **Look at the reel yourself** (downscaled) every run and write three lines in the handoff: what moved, what changed colour, where a new player would be lost.

## Ownership
Yours only: `e2e/playtest/**`, `screenshots/reel/**`, `handoffs/LOOP.md`. You never edit game code: defects and hook needs go under "Findings" / "Requests" in your handoff with image paths, and in your final message. Wrap browser runs per `handoffs/RULES.md` rule 11.
