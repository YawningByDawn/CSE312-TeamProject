# Brief — FINALE: the watershed pull-back and the ending beat

Handoff/log: `handoffs/FINALE.md`. Port **5230**. Scratch `/tmp/finale/`.
Read: `CLAUDE.md` scope items 4 and 6 ("the camera pulls back, the mine shrinks into a glowing point, and the town map opens mostly gray and black"; "an ending beat at the top of Shade that teases the city"); `docs/spec.md` (Whisper → Shade, the city); `docs/refs/town.png`, `docs/refs/region.png`; `DECISIONS.md` §13.1 (one seamless world: the pull-back is a real camera move, not a scene change), §14.3 (watershed = Divinity IV + the pit head fully yours), §14.7, §13.7 (it is a slice: the ending is a tease, not a third stage); `handoffs/P6b.md` (world renderer: `pullBackPath`, `CamPose`, beacons, LOD between mine and town); `handoffs/P4.md` (`stageAdvanced`, `won`); `handoffs/briefs/FEEL.md`, `handoffs/briefs/VFX.md`, `handoffs/briefs/P3-r3.md` (watershed and ending beds).

Two of the game's biggest moments do not exist yet.

## Build `src/scenes/finale/`
1. **Watershed (`watershed.ts`) — a sequence that runs inside the play scene on `stageAdvanced`:** input is taken away gently; the stain surges through the last gray of the pit head; the camera rises up the lift shaft with the cage and keeps pulling back in one unbroken move while the mine shrinks into a single violet point in the dark; the town resolves around it — mostly gray and black, the blocks the player has touched in colour; one line of text in the god's voice; the new things the town brings are introduced one beat each (crowds, Elites, the Temple and the Council looking back at you); control returns with the camera where the player needs it. 20–30 s, skippable after the first time, scrubbable for testing, identical every run for the same state.
2. **Ending beat (`ending.ts`) — on `won` (the city gate soaked):** the stain climbs the gate; the camera lifts over the wall; beyond the black a far larger city shows as a field of cold lights with one answering glow — something there has noticed you; the title returns; a run summary; "to be continued" in the game's own words; back to the title. 30–45 s. Uses `region.png` as the guide for what lies beyond. No new game systems.
3. Both are built as timelines over a small host (`camera`, `world.setView`, `fx`, `audio`, `hud.hide/show`, `text`) so the play scene only calls `runWatershed(host, state)` / `runEnding(host, state)`.

## Working alongside others
New directory only. Until the feel/VFX modules exist, use small local stand-ins behind your host adapter and swap when their handoffs list the interfaces. The play-scene builder wires the two calls — write the exact call sites needed under "Requests to PLAY-v2".

## Proof and self-grading
`dev/finale.html` (runs each sequence over the real world renderer with a scripted state) + `e2e/finale-shots.cjs`: 16-frame strips of each sequence and stills of the key frames (the last mine frame, the point, the town opening, the gate, the city) → `screenshots/finale-*.png`; checks: no cut (frame-to-frame difference stays below a threshold through the pull-back), no band/halo at fog edges, Void exact `#000`, zero console errors. `handoffs/RULES.md` rule 13: grade each sequence honestly ("would a player remember this?"), keep going until ≥ 8.

## Ownership
Yours only: `src/scenes/finale/**`, `dev/finale.html`, `e2e/finale-shots.cjs`, `screenshots/finale-*.png`, `handoffs/FINALE.md`. Append `### FINALE — Watershed and ending` to `DECISIONS.md`.
