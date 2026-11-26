# Brief — P6b: world composition (`src/render/world/`)

Handoff/log: `handoffs/P6b.md`. Port **5209** (`e2e/world-shots.cjs` runs its own server, HMR stubbed). Scratch `/tmp/p6b/`.
Read: `docs/spec.md` (fog of war, watershed), `DECISIONS.md` §13.1–13.3, §13.6; `handoffs/P6.md` (town), `handoffs/P7.md` (cutscene → play hand-over); APIs: `src/render/types.ts`, `src/render/mine/index.ts`, `src/render/town/index.ts` + `types.ts` (`pitRect` = {x 1660, y 1290, w 400, h 233}, `MINE_K` = 6), `src/render/camera.ts`, `src/app/worlds.ts`.

One renderer, one camera, one fog picture for the whole game. World coordinates are town units (6400×3600). The mine interior (2400×1400 mine units) is a nested detail layer at the pit: mine (mx, my) ↔ world (pitRect.x + mx / MINE_K, pitRect.y + my / MINE_K).

## Requirements
1. **Composition and LOD:** zoomed out = the town at night with the pit as a glowing point; zooming in on the pit, the surface cross-fades into darkness and the mine fades in; at mine scale only the mine is drawn, exactly as the mine renderer draws it alone. Reads as descending into the ground: no pop, no doubled image, no visible pit rectangle, no band or seam. Skip a layer whose weight is 0.
2. **Identity at mine scale (hard):** at a view equivalent to a mine camera, output equals the mine renderer's own output for the same view/time (max channel diff ≤ 1/255), proven by a pixel test in the e2e script. Constructible from existing instances (`createWorldRenderer({ mine, town })` — the cutscene passes its `MineRenderer`) and from a seed (`preloadWorldRenderer(seed, budgetMs)`); the town may finish baking in the background while the mine is shown. `worldCameraFromMine` / `mineCameraFromWorld`.
3. **One view in, routed:** `WorldView` (12 mine areas + 13 town blocks with fog state, control, flags; units incl. groups with `size` and Elites; selection/hover/selectable; effects; time) split into the mine's and town's views. `zoneAt`, `personAt`, `zoneBounds`, `unitScreenPos` route to the dominant layer. Nothing over heads; no labels.
4. **Crossing:** a unit moving between `lift` and `minehead` walks to the cage / pit head, fades out and appears at the other end. Cross-layer effects (the god is at `grave` in the mine) run to/from the pit glow on the surface or up the lift shaft.
5. **Camera helpers:** `frameMine()`, `frameTown()`, `frameZone(id)`, `frameAll()`, zoom limits (whole town … mine close-up ≈ mine zoom 2.5), `pullBackPath(fromCam, toCam)` → `(t01) => camera`, eased in log-zoom, pit kept on its path (the watershed: the camera pulls back, the mine shrinks into a glowing point, the town opens mostly gray and black). Contact sheet of ~12 frames along the path; every frame must look deliberate.
6. **Fog continuity** across layers; Void exact `#000`.
7. **Perf:** outside the cross-fade band ≤ max(mine-only, town-only) + 3 ms per frame; inside ≤ 1.6× the larger; no hitch > 100 ms in a zoom sweep; no extra full-world canvases.
8. **Harness + shots:** `dev/world.html`, `src/render/dev/worldHarness.ts` (`preset`, `zoom`, `cx`, `cy`, `focus=<zoneId|pit|mine|town>`, `t`, `pull=<0..1>`, `stats=1`; `window.__world`), `e2e/world-shots.cjs`, `screenshots/world-*.png` (mine scale, three cross-fade steps, town scale per preset, pull-back contact sheet, a crossing, a cross-layer effect, identity diff).

## Ownership
Yours only: `src/render/world/**`, `src/render/dev/worldHarness.ts`, `dev/world.html`, `e2e/world-shots.cjs`, `screenshots/world-*.png`, `handoffs/P6b.md`. The mine renderer (`src/render/mine/**`, `fog.ts`, `lighting.ts`, `effects.ts`, `art/**`) and the town renderer (`src/render/town/**`) are being edited by their own builders right now — expect transient breakage, wait and retry; requests go under "Requests" in your handoff (work around meanwhile, e.g. render a layer to a screen-size offscreen canvas). Do not judge or polish mine/town art. Append `### P6b — World composition` at the end of `DECISIONS.md`.

## Report
API the play scene will call, LOD thresholds, identity result, perf table with load, shots list, requests, known issues.
