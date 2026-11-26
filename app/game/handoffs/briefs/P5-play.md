# Brief — P5-play: the play scene, clarity pass (launch after P5-fix reports)

Handoff/log: `handoffs/P5-play.md`. Port **5205**. Scratch `/tmp/p5play/`.
Read: `DECISIONS.md` **§13.10 "Clarity pass"** (binding; the owner's words are quoted there), §13.1–13.3, §13.6; `handoffs/P4.md` ("API changes for the UI" — the sim's current API, incl. the §13.10 selectors/events: area panel data, goal progress, two-layer texts `short`/`details`, `oddsWord`, task `unlock`, `areaLit`/`areaRooted`/`areaDimmed`/`taskResult`/`taskUnlocked`); `handoffs/P5.md`, `handoffs/P5-fix.md` (shell, settings, layout rules, compact hand); `handoffs/P7.md` (the cutscene hand-over and how to call `drawGodThread`); `handoffs/P6b.md` (world renderer API, if it has landed).

The owner played the mine stage and did not understand it: areas did not visibly change, followers sat still, tooltips and stats were too much, some hints never went away. Your job is to make the first ten minutes self-explanatory **without reading**: visible cause and effect, one-sentence rules, few numbers.

## Work
1. **Rename/reshape the scene** `src/scenes/whisper` → `src/scenes/play` (one scene for the whole game; stage is state, not a scene). Keep the cutscene hand-over pixel-identical and draw the god's thread per `handoffs/P7.md`.
2. **Stats bar (§13.10 C):** three groups — You (Ichor pips, Hunger meter), Spend (Nether "+N a night", Crystals), Danger (one indicator, opens to three tracks). Malice appears when it first matters. Level/XP one line. No stat before the player has met it; each first appearance comes with one sentence. Remove Faith, Presence, Influence % from the bar ("Areas lit: N" lives in the goal panel).
3. **Goal panel (§13.10 E):** two plain lines with progress; clicking a line moves the camera to the next step and pulses that area's ground.
4. **Areas (§13.10 A):** when an area becomes lit, the light visibly spreads into it (use the renderer's fog fade) with a sound and a chronicle line; rooted areas show veins. The area panel (click an area's ground): lit / rooted / seen, "3 of 7 here follow you" with a bar and the half-way mark, one line on what is special. Hovering a person or area shows whether you can reach them and why not in plain words ("Too far — light an area next to this one first").
5. **Followers (§13.10 B):** no idle state anywhere. Selecting a follower shows their current task and at most four task buttons at the start (Pray, Go to…, Preach, Hide) — more appear only when unlocked, each with a one-line introduction. "Go to…" = click a seen area; show the route on the ground. At night's end the dawn replay shows each follower doing their task and what it produced (a brief mark at their feet + chronicle line). Pass each follower's task to the renderer view so figures pose accordingly (kneel, walk, talk, crouch) — file a request to the mine engine owner if a pose is missing.
6. **Tooltips (§13.10 D):** two short lines from the sim's `short` text; "Details" on hold/tap shows `details`. Odds as word + percent. Purge jargon from every string in your files.
7. **Hints (§13.10 F):** at most one at a time, always dismissible, never returning; rewrite the first-night guidance as three steps that follow the player's actions (whisper to a miner → see the area light up / send a follower to a new area → end the night), each ≤ 2 lines.
8. **Whole-world camera** once the world renderer is available (`createWorldRenderer`): free pan/zoom over mine and town, no labels in the world; until then keep the mine renderer and structure the scene so swapping is one file (`world.ts`).
9. Keep everything from P5-fix working: settings gear, pause, layout matrix (`e2e/layout-check.cjs` must still pass at every size), compact hand.

## Proof
- A scripted first-three-nights playthrough through the real UI (`e2e/play-shots.cjs`, replacing `e2e/whisper-shots.cjs`) with screenshots `screenshots/play-*.png`: first view, hover a reachable miner, whisper cast, converted + area lighting up (before/after), follower selected with four tasks, Go to route, end of night replay, goal panel progress, area panel, danger opened, details tooltip, each hint.
- Text audit script: no first-layer tooltip longer than 2 lines / ~110 characters; none of the banned words (zone, foothold, Control, Presence, Influence, watershed) in player-facing strings.
- Zero console errors; `npx tsc --noEmit` clean for your files.

## Ownership
Yours: `src/app/**`, `src/ui/**`, `src/scenes/play/**` (and removing `src/scenes/whisper/**`), `src/scenes/title/**`, `src/scenes/defeat/**`, `src/scenes/_placeholders.ts`, `index.html`, `e2e/play-shots.cjs`, `e2e/whisper-shots.cjs` (delete/replace), `e2e/smoke.cjs`, `e2e/layout-check.cjs`, `screenshots/play-*.png`, `screenshots/whisper-*.png` (remove stale). Not yours: `src/render/**`, `src/audio/**`, `src/sim/**`, `src/scenes/cutscene/**` — requests via your handoff. Append `### P5-play — Play scene and clarity pass` at the end of `DECISIONS.md`.
