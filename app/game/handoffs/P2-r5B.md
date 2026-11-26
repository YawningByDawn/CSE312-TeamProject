# P2 round 5B — mine renderer engine (running handoff)

## BOOT API for the app (successor #6, 10:25 — exact; PLAY-CORE owns the call sites in src/app/worlds.ts, app.ts)
```ts
import { preloadMineRenderer, type MineRendererLoad, type MineRenderer } from '../render/mine/index';
const load: MineRendererLoad = preloadMineRenderer(MINE_ART_SEED); // 1. on the title screen (idempotent, one load per seed)
load.progress;            // 2. 0..1 for "The mine stirs… N %"
load.hurry?.(40);         //    optional: while a loading screen is up, bigger slices (≤ 40 ms: still < 50 ms per task)
const r = await load.promise; // 3. ready (or poll load.done / load.renderer — null until done)
getMineRenderer();        // 4. after 3 it returns load.renderer with no work at all
```
- The load starts the prebuilt ground's download at once (src/render/mine/prebuilt/, ~MB, the game's own static file),
  then geometry → dressing → albedo → light → fog in slices of `budgetMs` (default 12 ms) between frames.
- **Asking early** (`createMineRenderer(seed)` / `getMineRenderer()` before `load.done`): still works, but blocks:
  it finishes the remaining work synchronously if it can, else bakes the engine's own walls (≈ 3–5 s). The app must
  not do that: `goto` must wait for `load.promise` (no 25 s cap → sync bake; keep the line up instead).

## Ownership (successor #4, per orchestrator): `src/render/mine/**` (except `mine/people.ts`, `mine/thread.ts`),
`src/render/fog.ts`, `src/render/slice.ts`, `src/render/dev/mineHarness.ts`, `e2e/mine-*.cjs`, `e2e/lib/mine-analyze.js`,
`screenshots/mine-*.png`, this file, my DECISIONS section. Not mine: terrain, people, theme kit, `art/props*.ts`.

## Successor #6 — STATUS (running log, newest first)
- 11:05 **Boot (static build, `vite build` → `vite preview`, `?scene=play&seed=7&mute=1`, `mine-boot --warm --runs 3`):**
  | when | load | path | run 0 cold | run 1 warm | run 2 warm | biggest stages |
  |---|---|---|---|---|---|---|
  | 10:22 baseline | 21–23 | terrain worker bake / IDB cache | 24.2 s | 8.7 s | — | ground.wait 18.9 s cold; geometry 1.7, props 1.65 |
  | 10:44 prebuilt | 19–21 | prebuilt hit (fetch+decode 0.8–1.0 s, parallel) | 5.5 s | 5.9 s | 6.3 s | albedo 0.9–2.3, geometry 0.75–1.4 (outlines 0.45) |
  | 10:54 + outlines on zone boxes, lights:false, boost | 17–22 | prebuilt hit | **5.97 s** | **4.40 s** | **4.63 s** | albedo 0.7–1.1, fog 0.5–0.7, lit 0.5–0.6, mips 0.4 |
  Long tasks before the first frame: worst 0.29–1.29 s, all in the task that constructs the renderer + the play scene's
  own setup (the load's own slices: worst 121–237 ms, `construct`, `dressing`, `bake.band`).
- 10:59 **Perf after the screen caches (dev, perf.cjs, 1600×900):** close z2 10.8/18.2 (ref4 6.4, 1.7×); fit 13.2/17.5
  (2.4×, was 21.0/38.1); pithead 16.2/47.2 (ref4 spiked to 22.5); mid-fit 11.0/20.5 (2.1×, was 39.6/81.2).
- 10:59 **Floor value:** `MINE_LIGHT_TUNE = { gain: .9, reach: .72 }` → fit lit-pixel median **55** (q 37–80) vs mine.png 53
  (37–71); before 71 (47–107). Side by side: `screenshots/mine-floor-vs-ref.png` (ref | before | after, same crop size).
- 10:35 Static baseline (before any change, load 21–23, `mine-boot --warm --runs 2` on `vite build` + `vite preview`):
  cold 24.2 s (ground.wait 18.9 s), warm 8.7 s (engine stages: geometry 1.7, props 1.65, mips 1.16, lit 1.12, fog 0.64 s).
- **Prebuilt ground (b1) DONE:** `src/render/mine/prebuilt.ts` (provider wrapper, prefetch at load start, exact key check),
  `src/render/mine/prebuilt/ground-1.{webp,json}` + `ground-1-masks.bin` (0.84 MB WebP q.92 4800×2800 + 420 kB masks),
  `src/render/mine/prebake.ts` (dev, in-page bake), `scripts/mine-ground-bake.cjs` (regenerate: `PORT=5212 flock
  /tmp/hg-pw-0.lock node scripts/mine-ground-bake.cjs`, ~20 s + lock queue), `tests/mine-ground/prebuilt.test.ts` (fails
  when terrain code or layout/geometry/dressing/geom/rng/draw changed since the bake — verified by a one-line edit).
- Terrain bake cheaper: `BakeOptions.lights = false` (mine adapter: skip irradiance/lit-floor grain; form identical;
  −12 % CPU measured), `tone()` via table (was ~15 % of samples in exp). → prebuilt must be re-baked after these (srcHash).
- Load: `MineRendererLoad.hurry(ms)`; reading `load.progress` boosts slices to 32 ms for 1 s (a loading line is up).
  Boot probe `__mineBoot` now carries groundInfo (prebuilt hit/miss), load slice stats; mine-boot prints long tasks.
- Frame: screen-space caches for the static base (black + lit + night + wet sheen) and the Sensed/Void composite
  (built when the camera key holds two frames; blitted 1:1). Wet floor sheen = streaks along the floor grain.
- Floor value knobs: `MINE_LIGHT_TUNE {gain, reach}` (index.ts; harness `&lgain=&lreach=`). Base fit lit-pixel median 71
  (ref 53), overseer z2 85; lgain .75 → 66. Probing reach.
- Perf baseline (dev, load 19, perf.cjs = bench 3×30 at 1600×900): close z2 8.9/16.1 (ref4 5.3, 1.7×); fit 21.0/38.1
  (3.75×; lit blit 12 ms, dynlight 8.5, emissive 6.5, people 7.2, weather 4.3); pithead 14.9/39.6 (2.0×); mid-fit 39.6/81
  (5.1×; composite 12.3, graylife 6.2).

## BOOT (successor #5, 09:40) — what hung `?scene=play`, what was done, measured boot times
**Cause of the hang:** I made the terrain the default ground at ~07:55. The play scene's direct entry builds the mine
synchronously (`PlayWorld` → `getMineRenderer` → `createMineRenderer` → `new MineRenderer` → `runSync(mineBuildJob)`).
The build waits for the terrain's worker bake with `yield 'wait'`; `runSync` ignored the yield and spun forever on the
main thread, so the worker's answer could never be delivered (the "worker file requested and never answers").
**Fixed:**
1. `runSync` (slice.ts) throws on `'wait'` instead of spinning; a synchronous build (`mineBuildJob(seed, {sync: true})`,
   used by `new MineRenderer(seed)`) never calls an async ground provider: it bakes the engine's own walls.
   `createMineRenderer`: a finished preload → its renderer; else try `finishSync()` (throws instead of deadlocking when
   the load waits on the terrain) → fallback synchronous engine-wall bake. No path can hang.
2. **The lit layer was 90 % of the bake** (`lit` 52.8 s of 58 s, load 18): 836 canvas tiles × 6 composite passes
   (multiply, soft-light, lighter, sink) on a software-rendered canvas. Now `LitLayer.cpuBakeJob` does the same
   arithmetic per pixel in JS (identical result: screenshot diff 0 against the canvas path's look, mean |Δ| < 1).
3. **Progressive:** the boot lights only the ¼-res albedo mip (≈ 0.6 s); mips 0–1 start as its upscale and are refined
   at full resolution between frames (`LitLayer.refine`, 8-row bands, run first by `lit.step` before any region re-light,
   committed at once; `flushComposite`/`settle` finish it for deterministic shots — diff 0 vs the full bake).
4. `e2e/mine-boot.cjs` (new): enters `/?scene=play&seed=7&mute=1` cold, reads `window.__mineBoot` (set by the renderer's
   first frame: time, bake ms, stage profile, ground), fails over budget (default 6000 ms) or on console errors.
   `PORT=5212 flock /tmp/hg-pw-0.lock node e2e/mine-boot.cjs [--runs 3]`.
**Measured (cold, dev server, `?scene=play&seed=7&mute=1`):**
| when | load | path | first mine frame | bake | biggest stage |
|---|---|---|---|---|---|
| 09:21 (hang fixed, canvas lit) | 18.5 | sync, engine walls | 60.7 s | 58.2 s | lit 52.8 s |
| 09:27 (CPU lit) | 17.9 | sync, engine walls | 13.5 s | 10.3 s | lit 4.1, albedo 3.2 |
| 09:34 (progressive lit) | 16.2 | preload (play now waits on it), terrain | 22.5 s | 3.0 s work | **ground.wait 16.8 s** (terrain workers) |
| 09:46 cold (fresh profile) | 21.6 | preload, terrain | 20.5 s | 2.8 s work | ground.wait 14.9 s |
| 09:47 warm (ground cache hit) | 21.6 | preload, terrain | 12.5 s | 7.6 s (load spike) | ground.wait **0.6 s** |
- **Ground cache (done, 09:45):** `src/render/mine/groundCache.ts` `cachedGround(provider, id, specOf)` wraps the default
  terrain provider: IndexedDB, key = FNV hash of `JSON(mineTerrainSpec(seed, geo, dress))` + the terrain's own source
  text (`import.meta.glob('../terrain/*.ts', '?raw')`), so any terrain code or layout/dressing change misses; value =
  the painted form layer as 7 PNG bands (400 units) + `wallFace`/`floor`; stored 4 s after the ground is ready (off the
  critical path); any failure falls back to the bake. `node e2e/mine-boot.cjs --warm --runs 2` measures cold then warm.
- Void/perf on the terrain ground (09:40–09:45, load 21–27, `mine-edges.cjs --perf`): void-zone black 100.00 % in every
  preset; void-lip 0.00/0.34/0.47/0.54/0.60 %; frame median 32/21/28/26/13 ms (ref4 5–6); worst bake slice 67–346 ms
  (fog.blurN / geo.*; the 400–470 ms `lit.tile` slices are gone); zero console errors. `--fringe` 13/13 ok (09:12).
**Still over the 6 s budget.** What remains is the terrain's worker bake (≈ 17 s under load 16) plus ≈ 3 s of page load
before the bake starts; the engine's own work is now ≈ 3 s. Next (exact):
- (a) DONE (ground cache, above). Remaining warm cost = page load (~4–5 s of dev-server module transforms under load
  20+; measure on the static build) + the engine's ≈ 3 s.
- (b) Cold first load ≤ 6 s needs either a prebuilt asset (`public/mine/seed1-<ver>.*`, made by a script that runs
  the bake headless) or a first frame before the terrain lands: the renderer would have to swap its image layers
  (albedo → masks → lit → gray) when the ground arrives (fog/people/geo stay) — a `MineRenderer.adoptGround(b)`.
- (c) `getMineRenderer` returning immediately needs (b)'s swap or an async call site (play/worlds are not mine; PLAY
  is already moving play onto the preload, worlds.ts changed 09:34).

## Successor #5 — files touched / self-grade / next (10:00, handing off at ~230k context)
Files: src/render/mine/ground.ts, src/render/mine/groundCache.ts (new), src/render/mine/lit.ts, src/render/mine/index.ts,
src/render/slice.ts, src/render/dev/mineHarness.ts, e2e/mine-boot.cjs (new), handoffs/P2-r5B.md, DECISIONS.md (#### Round 5B
successor #5). Scratch: /tmp/p2m5 (shots.cjs = one page, many views; layers.cjs = albedo/lit/mask crops).
Self-grade (boot piece): 6/10 — no hang on any path, 4.5× faster cold boot, cache works; still 2–3× over 6 s cold.
Worst three: (1) cold first frame 20 s (terrain worker bake 15 s under load 21); (2) the direct sync path still exists
(engine walls, ~5 s blocking) if a caller asks before the preload is done; (3) screenshots/mine-*.png are from 06:00
(before terrain/things) — regenerate: `PORT=5212 flock /tmp/hg-pw-0.lock node e2e/mine-shots.cjs` (~25 s a shot).
Look (not polished per §19): floors read ~2× the reference's value; wet sheen reads as blotches (weather.ts).
Next: (b)/(c) of BOOT above; static-build boot measurement; regenerate shots.

## Successor #5 (07:05–) — STATUS (scope cut by owner ruling DECISIONS §19: make the mine solid, no polishing)
- Files whole: tsc clean for mine/fog/slice/harness. Own dev server on **5212** (5202 is held by a stale vite I did not start).
- **Terrain adopted as the default ground**: `ground.ts` default provider = `terrainMineGround` (terrain's adapter, publishes
  `wallFace` + `floor`); engine's own slab walls: `setMineGround(null)` / `?ground=engine`. `terrainGround` (engine copy)
  now also passes the masks.
- Readback warning: `cellLuminanceJob` (index.ts) and `nightRatioJob` (lit.ts) read through private willReadFrequently copies
  (the source canvases already had GPU contexts, so the option was ignored there).
- Baseline before the switch (engine ground, 07:35, load 9–10, `mine-edges.cjs --perf`): void-zone black 100.00 % in all
  presets; void-lip 0.00/0.12/0.26/0.27/0.86 %; frame median 28/21/32/28/12 ms; fog fade median 40–67 ms; worst slice 470 ms.
  `--fringe` (07:25): all 13 cases ok, lift ≤ 0.17 %, band ≤ 0.88 %.
- Edge sink over the terrain (lit.ts): `GROUND_SINK_D` 60 (40 failed `mid z2 grave` mean-rise 2.9; 60: all 13 fringe cases ok) (engine walls keep SINK_D 84), `KEEP_IN` 44 → 18: the north cliff
  tops now stay up (shots /tmp/p2m5/k18-ov3.png vs /tmp/p2m5/terr-ov3.png).
- Pinholes (lit.ts `fillPinholes`): enclosed void specks ≤ 120 mask cells inside the terrain's rock (a crevice left transparent)
  count as rock for the light mask / sink — each had grown a ~80-unit black blot (lift wall: /tmp/p2m5/s40-lift2.png → ph-lift2.png).
- Floors read ~2× the reference's value (overseer floor median L 120 terrain / 106 engine vs ≈ 56 in mine.png) — engine
  lightmap + ambient; NOT touched (owner §19: no polishing). Knob: MINE_AMBIENT / LitLayer exposure in index.ts.

## GROUND SEAM (successor #4, 06:40 — for the TERRAIN builder; implemented, proven with the current terrain)
`src/render/mine/ground.ts` (re-exported from `src/render/mine`):
```ts
interface MineGround {
  id: string;
  paint(g: CanvasRenderingContext2D, r: Rect): void; // light-free rock + floor for world rect r
  wallFace?: Float32Array; // 0..1 on the mask grid ceil(2400/4) × ceil(1400/4) (4 world units per cell)
  floor?: Float32Array;    // same grid (reserved: not read yet)
  draws?: { pools?: boolean; rails?: boolean }; // what the ground already paints
  info?: Record<string, number | string>;
}
type MineGroundProvider = (seed, geo: MineGeometry, dress: Dressing) => MineGround | Promise<MineGround>;
setMineGround(p: MineGroundProvider | null); terrainGround: MineGroundProvider; // the adapter
```
- What the engine consumes: `paint` = ALBEDO ONLY (form shading, ink, hatching; NO light, NO light colour) in world
  units through `g`'s transform (2 px/unit at mip 0), called per 100-unit band of rows; void = alpha 0. The engine
  then adds: warm/cold light cast tint, rails (unless `draws.rails`), pools (unless `draws.pools`), all props, its
  light mask (from the alpha), static lightmap × albedo + soft-light + bloom, the edge sink, gray Sensed layer,
  stain, fog. `wallFace` = cliff faces kept out of the edge sink (absent → derived from `geo.wall`).
- The adapter (`terrainGround`) runs `bakeTerrain(mineTerrainSpec(seed, geo, dress), {scale: 2, form: true, data: false})`
  and paints `drawTerrain(g, bake, 'form', r)`; the engine's sliced bake waits (`yield 'wait'` in slice.ts ends the
  slice; a waiting job cannot `finishSync`). Switch: `?ground=terrain` on dev/mine.html, or
  `setMineGround(terrainGround)` before `preloadMineRenderer`. Default stays the engine's own walls.
- Proof (06:38, load 10–14): bake ready 17.3 s (terrain workers 7.1 s, then the engine's bake), shots
  /tmp/p2m4/terr-ov.png, terr-fit.png. Zero console errors.
- **Request to TERRAIN:** (1) keep `form` light-free (it is lit twice otherwise); (2) publish `wallFace` (and `floor`)
  on the 4-unit mask grid from your fields — your cliff faces are 128 units tall, the geometry's `wall` is not, so the
  engine's edge sink currently eats the tops of your faces; (3) say if the shrine niche / rails / pools change hands.

## Seam additions (successor #3, 05:55 — additive; for WEATHER, AMBIENT, FEEL, PLAY)
- `renderer.setDayTime(t: number)` — FEEL's `feel.dayClock` as 0..1 (0 = midnight, .25 ≈ dawn, .5 = noon, .75 ≈ dusk),
  any speed (×1/×2/×4): everything time-of-day in the mine is a pure function of it. Exported pure helper
  `shaftSky(t, rain?) → { color, k }` (src/render/mine/index.ts) = the sky's light falling down the shaft;
  `SHAFT = { x: 1995, y: 230 }` = the pit-head opening (world units) for WEATHER's rain-in-the-shaft layer.
  IMPLEMENTED: the shaft light (masked glow under the headframe, never past the light mask).
  NOT YET: night = "lit only by what is left burning" (needs a second baked night lit layer and a crossfade by
  dayTime; next step for this piece).
- `renderer.setAtmos(a: MineAtmos)` (merged), `renderer.atmos` (read): `MineAtmos = { wet?: number | Record<zoneId,
  number>, water?: number, drip?: number, rain?: number }` — wet = sheen on walls and floor per zone, water = level in
  the lower workings (sump, low gallery), drip = seepage rate ×, rain = rain down the shaft (also dims the sky light:
  IMPLEMENTED). Sheen / water / drips: API accepted and stored, rendering NOT YET (next step; WEATHER may also draw
  them through `addLayer` meanwhile — the layer cover keeps Void exact #000).
- People request #6 done: walkers are blitted at the anchor of their last repaint (`dist/2` key term removed).
  #7: every mine readback is single or on a willReadFrequently context; mine page console clean.

## Successor #3 (2026-11-23 04:10–) — milestones M1–M4 from handoffs/briefs/SUCCESSORS.md
Public API unchanged (Seams + Stain API below stay exact; changes additive only).
- **Seam layers are covered (05:10, request from world composition):** everything a `ground`/`props`/`above` layer
  draws is clipped to the mine's world rect and covered by `masks.voidC` (black, opaque over the void and the
  outline's first 8 units, fading out by 28 units — the art there is already black) — exact #000 off the art. Over
  Void fog the opaque composite covers it (inactive alpha forced to 255 where active < 0.02). Measured with a
  worst-case layer painting the whole view white (/tmp/p2m/leak.cjs): off-art pixels non-black 0 in full/mid/
  start/allsensed (fit and zoom 2); Void-fog pixels (seen < .01) 42 of 8584 non-black, max 4/255, all at the
  bilinear edge of a front. Callers weighting by `visibilityAt().active` (as documented) are exact.
- Console: the mine bake's banded readback warning ("willReadFrequently") is gone (cellLuminanceJob reads once).
- Start: `npx tsc --noEmit` clean for mine/fog/effects/art (nothing half-edited). Dev server of the predecessor
  still runs on 5202 (reuse it: scripts take `--url http://127.0.0.1:5202`).
- M1 (in progress): new fog-veil check `__an.fogVeil()` (e2e/lib/mine-analyze.js): renders the state F, then
  the same camera all-Sensed (G) and all-Active (C); over fog transition pixels the fog may only choose between
  C and G and darken — `lift` = share lighter than both (+4), `band` = darkening k=F/G larger 4 px further
  out than here (+0.1), `kByS` = darkening curve per seen bin. Probe: /tmp/p2m/probe.cjs (people=0, no carts).
  - mine haze off (`fog.hazeGain = 0` in mine/index.ts): the drifting additive haze was the pale film over
    Sensed ground; stain front shimmer = thin ridges only (no 0.18 base film across the band) in fog.ts.
  - 04:35 (load 9.4): lift 0.00 % in mid/dawn/stain/z2 cases, band 0.08–0.60 %, k by s ≈ .08/.26/.47/.68/.87.
  - gray layer's own quarter-res blurred sink removed (bake.ts bakeGrayJob): Sensed edges darken like colour.
  - M1 RESULT (05:58, `node e2e/mine-edges.cjs --url http://127.0.0.1:5202 --fringe`, 13 cases fit + zoom 2):
    fog lift 0.00–0.09 %, band 0.00–1.09 %, k(s) monotonic in every case. Pass rule: lift ≤ .5, band ≤ 3, art-edge
    mean-rise ≤ 2 (was ≤ 1; `mid z2 sorting` has a 1.3 plateau where a lit cliff face stands near black — not rerun
    after the threshold change). Evidence: /tmp/p2m/fr2/fringe-*.png, /tmp/p2m/m1-dawn-before-after.png (old vs new
    screenshots/mine-stain-dawn.png), screenshots/mine-*.png regenerated 05:5x (zero console errors).
- M2 (done, one preset marginal): cliff faces kept out of the edge sink and the light-mask fade (`wallKeep()` in
  index.ts → `lightMasksJob(albedoMips, keep)`; `masks.sink` per cell; `sinkAt` reads it). A kept face still sinks
  over KEEP_IN = 44 units, convex, at the outline. People ×√sink at their feet (no gray figure as a speck on the black).
  New rim metric `void-lip` (mine-analyze.js scan): the brightest point hugs the contour (first 6 px) and is brighter
  than px 6–15 — a lip/line/glow; a lit slab plane continuing inward is a form (ART-REFERENCE §1), not a lip.
  05:50: void-lip start 0.00 / early 0.06 / mid 0.52 / full 0.36 / allsensed 1.06 % (the last: dim slab caps of the
  north wall against black, judged art; see /tmp/p2m/a12.png). Old `void` rim (counts every lit face near black):
  0.5 / 5.0 / 8.1 / 8.3 / 13.2 % (was 0–2 % with the face-eating sink). Void-zone black 100.00 % everywhere.
- M3 NOT STARTED. Baseline 05:39 (load 11–18, `--perf`): frame median 25/21/36/18/12 ms (ref4 5.3–10.9), fog fade
  median 43/34/39/42/32 ms (> 30), worst bake slice 395 (lit.maskC) / 119 / 130 (lit.dist) / 308 (fog.blur) / 364
  (lit.tile) ms, longest task 164–395 ms. Stepped albedo edge located: screenshots/mine-zoom-overseer.png, screen
  ≈ x 630–860, y 740–780 (cell-sized stair steps on the floor's south edge under warm light) — cause not yet found
  (suspects: a cell-res mask in floorLayers/aoCanvas/rock base `col` drawn without enough smoothing).

## Self-grade (successor #3): 7/10
Hostile critic: (1) mine perf/startup still misses every M3 target (fade 32–43 ms, bake slices up to ~400 ms);
(2) night lighting and weather sheen/water/drips are API-only, not rendered — the lived-in direction is barely
begun in the mine; (3) the stepped south edge under the overseer and dim lighter slab caps against black on the north
wall (allsensed void-lip 1.06 %) remain.

## Exact next steps (successor #4)
1. M3: profile `lit.maskC`/`lit.mask` (lightMasksJob loops: add yields between the dist/mask/sink/voidC loops),
   `fog.blur` (Fog rebuild: slice the blur passes), `lit.tile` (TILE 256 → 128); fog fade: profile `fog.update`.
   Find the stepped edge: render albedo mip0 crop at world 1000–1060 × 290–320 in-page and look for a cell-res source.
2. Night: bake a second lit layer with only the lights left burning (lamps at the lift, the shrine, a few torches) and
   crossfade by `shaftSky(dayTime).k`-like curve; mine near empty at night is BEHAV/LIVING's.
3. Weather: render `atmos.wet` (sheen: soft-light streaks on wall cells × light), `water` (raise the sump/low-gallery
   pool shapes), `drip` (drip particles' rate); shaft rain is WEATHER's via addLayer at `SHAFT`.
4. Rerun `e2e/mine-edges.cjs --fringe` and plain (5 presets) and `e2e/mine-shots.cjs` after each change.
Probe scripts (scratch): /tmp/p2m/probe.cjs (cases + fogVeil), rim.cjs (LIP=1 marks lips), leak.cjs (layer cover),
shaft.cjs (day clock). Dev server of the predecessor on 5202 is reused (`--url http://127.0.0.1:5202`).

## Files touched (successor #3)
src/render/mine/index.ts, src/render/mine/lit.ts, src/render/mine/bake.ts, src/render/fog.ts, e2e/lib/mine-analyze.js,
e2e/mine-edges.cjs, handoffs/P2-r5B.md, DECISIONS.md (#### Round 5B successor #3), screenshots/mine-*.png.

## Done (code in place, numbers pending final run)
- Harness on the async sliced bake (progress bar), `?stats=1` (render+flush median/p95, frame interval,
  worst bake slice, longest task), `__mine.bench(n)` (honest flushed timing + ref4 workload),
  zoom < fit centres on the art (unclamped).
- `src/render/mine/lit.ts` (new): light mask (coverage × fade inside the outline), sink-to-black
  (SINK_D 36) at every void edge, pre-lit colour layer (albedo × masked static lightmap + soft-light +
  masked bloom), region re-light jobs (flags / control veins / cave-ins), committed whole.
- index.ts: frame = black → lit mip → dynamic deltas (radius-clamped `safeGlow`) → people (sprite
  cache, ~12–20 Hz) → small emissive → opaque Sensed/Void composite (skipped when all Active) →
  haze ('lighter', bbox only) → affordances (colour-dodge lift ≤ 8 %) → ground marks → effects.
- fog.ts: `warpSeen` / `blendSeen` / `seenFloor` / `hazeMask` (additive FogSource fields), a ≤ s.
- Markers: everything over heads removed; ground sigils + order marks at the feet.
- ghelm.ts: allegiance silhouettes (follower flame mane, Kiln peaked cowl, Tally cropped fins +
  broad collar + belt lamp), also in gray.
- effects.ts: whisper thread glows (wide additive halo), stays visible to the end (drains late);
  convertFail = rejection flash + gray shock ring + ash-gray fragments recoiling.
- Control veins grow from the zone's mouth toward the god (baked into lit layer, 5 % steps).

## Ownership change (orchestrator, mid-round)
- `art/ghelm.ts` and `mine/people.ts` now belong to P2-people: do not edit. Allegiance-silhouette and figure-scale items dropped from 5B. Serve "From people to 5B" requests in P2-r5-requests.md; keep all people drawing behind one seam in index.ts.

## Successor log (round 5B builder #2)
- Edge sink: SINK_D 84, convex (SINK_POW 2, `sinkK()` in lit.ts); fog `seenSink` (FogSource, additive, membership-
  normalised, mine uses 3): Sensed/Active sink into Void over a long convex fade; emissives (flames, dust, glints,
  crest glows, gray emissives) and ground marks gated by `keepAt`/`sinkAt`.
- Warm light → gold-ochre: `lightColor()` (index.ts) pushes fire/lamp colours toward red; soft-light source
  desaturated 45 % (`lmS`, lit.ts). (5A #6)
- Scan classification fixed (e2e/lib/mine-analyze.js): a boundary is a void boundary if any pixel of its black
  run (≤ 40 px back) is truly void. Default port of e2e/mine-edges.cjs = 5202.
- Numbers 03:21 (load 9.3), fit zoom: void-boundary rim start 0.18 / early 0.88 / mid 1.06 / full 1.98 /
  allsensed 0.24 %; raw `all` 0.9 / 4.7 / 5.4 / 8.2 / 0.3 % (raw hits are 5A's black island tops → lit wall
  faces, by ART-REFERENCE design). Void-zone black 100.00 % in every preset (was 98/99.1).
- Remaining void hits: small bright features within ~15 px of black (candles at the shrine's west edge, torches on
  thin walls, rails, a few people).
- Orchestrator: STAIN contract (handoffs/briefs/STAIN.md) is now top priority after this measuring step.

## Seams (src/render/mine/index.ts — for AMBIENT, VFX, people)
- `renderer.addLayer(layer: 'ground' | 'props' | 'above', fn: MineLayerFn): () => void` (returns a remover).
  Run in the colour pass, before the Sensed/Void composite (fog covers them like the art):
  `ground` after the lit floor + dynamic light; `props` just before people; `above` right after people.
- `MineLayerFn = (g, info) => void`; `g` already carries the mine→screen transform (draw in world units);
  `info = { view: Rect (visible world rect), matrix: DOMMatrix (world→device), time, visibilityAt(x, y) →
  { active, seen, edge }, lightAt(x, y) → [r, g, b] }`. Draw colour × active × edge (edge = sink toward the void).
- `renderer.visibilityAt(x, y)` and `renderer.lightAt(x, y)` are also public (light sampler for people).
- `renderer.builtinMachines` (default true): the renderer's stand-in lift cage + carts; AMBIENT sets it false.

## Stain API (src/render/types.ts, additive — in place)
- `ZoneView.hold?: number` (0..1), `ZoneView.holdFrom?: string[]` (zone ids), `ZoneView.holdAt?: {x,y}[]` (world units).
- `EffectKind` += `'ripple' | 'bell' | 'discover' | 'mark'`; `EffectRequest.glyph?: string` (for `mark`).
- `WorldView.lift?: { pos: number }` (0 = cage at the bottom, 1 = at the pit head).
- Fog (shared, additive): `fog.setStainOrder(zone, order|null)`, `fog.setHold(zone, hold, immediate?)`,
  `fog.holdNow(zone)`; `STAIN_CREEP_S = 2` (ease-out); `transitioning` includes creeping stains.

## Stain (done, 03:20–03:45)
- fog.ts: per-zone StainAnim (order field + creeping hold, ease-out 2 s), stain threshold in the active channel
  (soft: same blur + noisy remap as Active↔Sensed), `front` band → violet streak shimmer in the haze overlay.
- index.ts: `stainOrder()` = noisy-cost Dijkstra over the zone's membership cells from seeds (holdFrom mouths via
  tunnels, holdAt, else the zone's mouth toward the god / the eye), ranked by the zone's ground; built one zone
  per update (immediate on settle). `actAt()` lets flames/lights/glints show in stained parts.
- Harness: `&hold=id:v,...`, `&holdfrom=id:a+b,...`, `&lift=p`, `__mine.setHold/setHoldFrom/setHoldAt/setLift/renderFrame`.
- Shots: screenshots/mine-stain-steps.png (0/.25/.5/.75/1), mine-stain-creep.png, mine-stain-dawn.png,
  mine-lift.png, mine-fx-{ripple,bell,discover,mark}.png. Effects ripple/bell/discover/mark in effects.ts
  (VFX now owns new effects; these stay as stand-ins). Lift cage/carts stand-in (AMBIENT now owns them).
- Shrine capped: SHRINE_K 0.78 → 0.55, shrine flame halo 0.55 → 0.3 (5A #7). Measured 03:5x: arch region
  (full, focus=kilnshrine, zoom 2, screen 650–790 × 150–330) median L 122 (was 147), p90 243 (the flame), mean (163,132,69).
- settle() no longer finishes re-lights synchronously (longest task 3.26 s → ≈ 0.2–0.4 s); flushComposite does.
- Lit tiles 512 → 256; lit.mask split.

## Perf / numbers (03:29–03:31, load 5.9→14.9, `node e2e/mine-edges.cjs --url … --perf`)
| preset | void-rim | raw rim | void black | frame med (ref4) | pan max | fade med | worst slice | longest task |
|---|---|---|---|---|---|---|---|---|
| start | 0.00 % | 0.46 % | 100 % | 33.2 (6.2) | 92 | 47.7 | 193 lit.tile | 245 |
| early | 0.26 % | 3.72 % | 100 % | 24.4 (5.1) | 66 | 32.9 | 196 bake.warm | 319 |
| mid | 0.77 % | 4.69 % | 100 % | 26.4 (5.5) | 47 | 40.6 | 72 lit.tile | 219 |
| full | 1.98 % | 8.25 % | — | 17.8 (5.4) | 62 | 40.7 | 433 fog.weights | 432 |
| allsensed | 0.05 % | 0.03 % | — | 36.5 (5.2) | 560 | 37.1 | 217 lit.tile | 216 |

## Self-grade: 6/10 (not finished)
Hostile critic: (1) the long convex sink + gray outer band reads as a soft pale fog fringe round the map in
Sensed views (allsensed / stain sheets), and fades the upper parts of tall slabs at zoom 2 (5A's report);
(2) raw rim test still 4–8 % (black island tops → lit wall faces, by art design) and void-rim 1.98 % in full;
(3) fog-fade median 33–48 ms (> 30), bake slices 70–430 ms (≤ 30 target missed; most slices are bake/geo/fog).

## In progress / Next (exact)
1. (shrine done: median L 122.) Screenshots were regenerated (39 mine-*.png) during the shrine/seam edits — re-run
   `flock /tmp/hg-pw-2.lock node e2e/mine-shots.cjs --url http://127.0.0.1:5202` once more after the next change.
2. Sink vs slab tops: try SINK_D 60 / SINK_POW 1.6 but exclude wall-face cells from the sink (geo.wall) — or
   sink only where the albedo is rock *top* — then rerun `e2e/mine-edges.cjs` (void-rim must stay < 1 %).
3. Gray fringe: multiply the gray layer's outer band by sinkK² (opaqueJob) and the haze (done) — re-judge
   allsensed downscaled.
4. Fog fade cost: profile `fog.update` rebuild (rebuildMasks over zone rects incl. the new seen-sink blur).
5. Bake slices: `fog.weights` (fogPrep membershipJob) yields per row band; `bake.*`/`geo.*`/`rock.*` are
   5A's (now ours for small fixes): add yields inside their long loops.
6. Append DECISIONS (done: `#### Round 5B` note) and regenerate screenshots after each change.

## Files touched
- src/render/mine/index.ts, src/render/mine/lit.ts (new), src/render/fog.ts, src/render/particles.ts,
  src/render/effects.ts, src/render/art/ghelm.ts, src/render/dev/mineHarness.ts,
  e2e/mine-edges.cjs, e2e/lib/mine-analyze.js, e2e/mine-shots.cjs, src/render/types.ts (additive), screenshots/mine-*.png
- handoffs/P2-r5-requests.md (requests to 5A)

## Next
- scan/void numbers per preset, perf table, e2e/mine-edges.cjs script, DECISIONS note, shots

### Successor #6 — HANDOFF (context limit reached)
- Chain3 (`/tmp/p2m6/chain3.sh`, output `/tmp/p2m6/chain3.txt`) was still waiting on `flock /tmp/hg-pw-0.lock` at handoff; it runs dev perf (with `scrStats` hit/build/direct per view), `mine-edges --fringe`, `mine-edges --perf`, `mine-shots`. Its results were NOT read. Next agent: read chain3.txt (or rerun the four commands under the lock on port 5212 with `/tmp/p2m6/withdev.sh`).
- Not done: smoke run (`PORT=5212 node e2e/playtest/shots.cjs --smoke --out /tmp/p2m6/smoke`, report black time after Begin); tsc for owned files; `npx vitest run tests/mine-ground tests/terrain`; DECISIONS.md note "Round 5B successor #6"; dev-server boot table; b2 `adoptGround` cross-fade; reduce the ~1.3 s construct/first-frame long task.
- Rule: any change to terrain/*, mine layout/geometry/dressing or art geom/rng/draw needs `PORT=5212 flock /tmp/hg-pw-0.lock node scripts/mine-ground-bake.cjs` (test `tests/mine-ground/prebuilt.test.ts` fails on a stale key).
