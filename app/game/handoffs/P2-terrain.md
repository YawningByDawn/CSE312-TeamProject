# P2T — Sculpted terrain (art track A) — handoff

## MINE-ADOPT (2026-11-23 20:10) — the approved look (DECISIONS §30) is in the game; sharp pass built, OFF by default
- **Zone colouring adopted:** `terrain/shade.ts` + `terrain/mine.ts` are the old look2 versions; `look2/` is deleted. Prebuilt
  re-baked (`scripts/mine-ground-bake.cjs`, key `terrain:1th7ace:1m1cxf7`); `tests/mine-ground` green.
  Game seed 7 night 1 default zoom: median non-black 39.9–40.8 (before 40.3). The 50–58 bar is met on the dev page (57.3),
  not in the game frame (night ambient, Sensed cover, HUD). Proof: `screenshots/mine-adopt-default.png`.
- **Sharp ground (`src/render/terrain/sharp/`: core.ts ratio, worker.ts, index.ts `SharpGround`):** the engine's default
  `MineGroundDetail` (seam in `src/render/mine/ground.ts`; `setMineGroundDetail` swaps it). The engine passes `patch()`
  (ground paint + light-cast tint + an `own` mask = albedo pixels that are ground alone; veins/cave-ins cut), `colourIn()`,
  and `lit()` (mip0 once `lit.fullRes`). Nothing reads `lit.albedo`. `lit.onCommit` → `relit` re-composites; vein/cave-in
  changes → `invalidate`. Per 96-unit tile: ratio shaded at 2.5 px/unit (the game's real max zoom; `ZOOM_MAX = 2.5×K`),
  composited once (lit × ratio), blitted inside the cached base layer; on above 2.1 px/unit; cache ≤ 64 MB.
- **OFF by default, `?sharp=1` turns it on.** Failed: a cold zoom-in to an unprefetched view takes 6.3 and 6.8 s to sharp
  (35 tiles × ~240 ms, 3 workers, 4-core box at load ~9), limit 2.5 s. Passed: warm jump 1.0–1.4 s; static frame time
  at z2.5 +0 ms (on 47.2/52.1 vs off 55.7/57.9 ms, noisy box); nothing drawn at ≤ 2.1 (draws 0 at default zoom); ≤ 64 MB;
  0 console errors. Panning at z2.5 costs +6.7 ms median. To ship ON: speed up the worker shade (the hot loop is
  `shade.ts` at hi res), or prefetch the coloured mine before the player can zoom.
- Proof at closest zoom (camera 2250,1185, 2.5 px/unit): `screenshots/mine-adopt-zoom3.png` (`?sharp=1`),
  `screenshots/mine-adopt-zoom3-off.png` (default). Dev: `dev/terrain.html?engine=1[&ground=shipped][&sharp=1]`.
- Tests: `tests/terrain/sharp.test.ts` (ratio, prop mask, tint, empty tile, determinism, ramps, void).

## ADOPTION — what the mine engine calls (round 5, successor 6 — exact; owner ruling DECISIONS §19: adoption first)
**One call, before `preloadMineRenderer(seed)` (wherever the game boots the mine — engine/play owner):**
```ts
import { setMineGround } from '../mine/ground';            // engine seam (exists)
import { terrainMineGround } from '../terrain/mineGround';  // terrain's adapter (exists)
setMineGround(terrainMineGround);
```
- `terrainMineGround: MineGroundProvider` (`src/render/terrain/mineGround.ts`) = the engine's own `terrainGround`
  **plus** `wallFace` / `floor` masks on `GROUND_MASK` (ceil(2400/4) × ceil(1400/4), 4 units/cell, 0..1), so the
  engine's edge sink and light-mask fade keep the cliff faces (they rise above `geo.wall`). Bakes
  `bakeTerrain(mineTerrainSpec(seed, geo, dress), { scale: 2, form: true, data: false })` in workers; `paint(g, r)` =
  `drawTerrain(g, bake, 'form', r)`: **light-free albedo** (key-plane shading, ink, hatching, pools); void alpha 0;
  `draws: { pools: true, rails: false }` (engine keeps rails, props, lights, sink, gray, stain, fog — Void stays the
  engine's exact `#000` cover, no band from the terrain: exterior rock goes ink → #000 within 3 units).
- Engine side needs **no other change**: `index.ts` already reads `ground?.wallFace ?? wallKeep(geo)`; `floor` is
  reserved. The engine's `terrainGround` can stay as is or be replaced by this one.
- **Proof page (mine):** `dev/terrain.html?engine=1&<any dev/mine.html params>` installs `terrainMineGround` and boots
  the real mine engine harness (`src/render/dev/terrainEntry.ts`). Numbers + shots in the round 5 log below.
- Ownership of shared things: shrine niche + pools = terrain (painted); rails, props, timber, crystals = engine/art.

## Public API (exact; matches the code — `src/render/terrain/index.ts`, `mine.ts`, `types.ts`)
- `bakeTerrain(spec: TerrainSpec, opts?: BakeOptions): TerrainJob` — `TerrainJob {promise: Promise<TerrainBake>, progress, stage, cancel()}`.
- `drawTerrain(g, bake, layer: 'lit'|'form' = 'lit', view?: {x,y,w,h})` — `g`'s transform maps world units → target pixels; draws only tiles that intersect `view`.
- `TerrainBake {tiles: TerrainTile[]; readonly lit: HTMLCanvasElement (lazy, one big canvas — avoid); readonly form: HTMLCanvasElement|null (lazy; null unless opts.form); data: HTMLCanvasElement|null; scale; rect; dataRect; timings; wallMs; bakeMs; maxBlockMs; peakBytes; canvasBytes; worker}`.
- `TerrainTile {x, y, w, h, g, lit: ImageBitmap|HTMLCanvasElement, form: …|null}` (world rect without gutter `g`).
- `TerrainSpec {seed, width, height, floors[{pts, mat}], materials, pools[{x,y,rx,ry}], routes[{pts, kind:'rail'|'path', w?}], lights, solidIslands?, ambient?, niches?[{x,y,w,h}]}`.
- `BakeOptions {scale?=2, form?=false, data?=true, band?, dataBand?, rect?, onProgress?, noWorker?, debug?, workers?, budgetMs?, tile?=384}`.
- `lightFlickerDelta(g, x, y, r, color, k0, k, gain = 0.6)`; `terrainDomain(spec)`; `bakeCore` (headless generator).
- Mine: `mineTerrainSpec(seed, geo?, dressing?)`, `mineMaterials()`, `mineLights(dressing)`, `GROUND_MATERIAL`.

## Round 5 (successor 6, 07:05–07:40) — log
- Arrival: tsc clean; predecessor 5 (no report) had replaced r3d's rounded blocks with single-peak "masses" whose
  ridges diverged from the peak (read as pyramids / tombstones) and written `masks.ts` + `mineGround.ts`.
- **Cliff columns (slabs.ts `addMass`, shade.ts `mass()`):** see DECISIONS P2T Round 5. Back-tier masses are now
  80–230 units wide (overlap 2–5) and cut into columns; params layout documented above `addMass`.
- **Material channels 19–21** (`types.ts` additive: `TerrainMaterial.depth?/worked?/veins?`; `prep.ts` MCH 22;
  `Sampler.mat?`); `mine.ts` fills them from `depthOf` (sim, read-only) and the ground type.
- **Floors (shade.ts `floor`, new `footprint`, `puddle`):** depth darkening, bare-rock relief, footprints, puddles.
- **Tests:** `tests/terrain/terrain.test.ts` updated to columns (+ no-gap test): 5/5 pass. tsc clean for terrain + dev.
- **Adoption proof:** `dev/terrain.html?engine=1&preset=full&t=8&control=0&people=0[&focus=overseer&zoom=2]` →
  real mine engine on `terrainMineGround`: ready 35.5 s from page load at load 8–12 (engine bake waits on the
  terrain workers), **0 console errors/warnings**, void corners exact #000. Shots: `screenshots/terrain-engine-fit.png`,
  `terrain-engine-wall.png`. Script: `/tmp/p2t6/s/eng.cjs` (VIEWS env = [[name, query], …]).
- **Bake cost (terrain harness, `/tmp/p2t6/s/bakeprobe.cjs 3`, lock 0, load 11–12):** wall 9.6 / 9.7 / 10.9 s
  (predecessor measured 3.3 s at load 6–13 with the lighter shader — heavier per-pixel columns + higher load; not
  re-profiled), main-thread block ≤ 10 ms, long tasks 51–94 ms during setup/bake (harness + upload), peak 64 MB
  worker arrays + 51 MB tiles = 115 MB; 24 tiles; draw at fit 17–32 ms median, zoom 2 ≈ 1.1 ms.
- Headless shade: ≈ 1.6 µs/px at 2 px/unit (was 1.5), 0.76 µs/px at 1 px/unit.
- Shots (lit layer, headless): `screenshots/terrain-cliff-close.png` (figure ≈ 80 px), `terrain-cliff-far.png`,
  `terrain-cliff-before-after.png` (left: predecessor's masses, right: columns). Old `terrain-*.png` NOT regenerated.
- **Stopped polishing at owner ruling §19** (adoption first).

### Self-grade (successor 6)
- **6.5/10** vs `docs/refs/mine.png` (up from the tombstones; walls now read as cliff faces at all three zooms, in the
  engine too). Not an 8: no close crop would pass for the reference's artist.
- Worst three: (1) the columns are too regular — organ-pipe/basalt rhythm along long walls, planes too flat and
  empty at close zoom; the reference mixes broad faceted planes with stacked blocks; the shrine mound is faceted
  planes where the reference has rounded teal boulders. (2) Floors at far zoom are still pale and even (lit layer);
  footprints/puddles are subtle, depth reads weakly under the lights. (3) Bake 9.6–10.9 s under load (budget ≤ 6 s);
  in the engine the tops of north faces sink into dark (engine sink/light; check once `wallFace` is consumed).
- Next steps (when visuals resume): (a) mix block rows into columns (horizontal joints on 30–50 % of columns,
  row-stacked blocks on the shrine run — r3d's row code is in `/tmp/p2t5/s/new_sec3.txt` if still there);
  (b) per-column albedo jitter + stronger plane contrast; (c) profile `mass()` (edgeDist + objectAt per pixel) and
  cache the column frame per object to win back the bake time; (d) regenerate `e2e/terrain-shots.cjs` shots.

## Round 3d (successor builder 4, started 04:53) — log
- Arrival: tsc clean for terrain files. Scratch moved to `/tmp/p2t5/s/` (copies of the r3c tools + `r.sh <tag>`:
  renders the wall and shrine comparison areas at 2 px/unit and writes `/tmp/p2t5/o/<tag>_vs_{wall,shrine}.png`
  next to the same reference crops; `EXTRA=',[out,cx,cy,w,h,scale]'` adds crops). Spec: `npx tsx /tmp/p2t5/s/dumpspec.mts`
  (re-run after any `mine.ts` change — writes `/tmp/p2t4/spec.json`).
- **M1 done (05:40): rock masses of stacked rounded blocks.** `slabs.ts` section 3 rewritten:
  - blocks live in the contour frame (s along the wall, v into the rock by the visible face depth), so side walls get
    round blocks seen edge-on instead of vertical shards; the frame uses a separately smoothed normal (±48 units,
    `bnx/bny`, never > ~50° from the local normal) — with the ±15-unit normal the (u,v) frame spread 2–3× at v = 50 on
    wiggly contours and rows fell apart into gaps or crushed into shards (tried bent / rigid / stretched; this is the fix);
  - each pass lays one row; a block rests on the SUPPORT height map (per unit of arc length) left by the blocks below,
    its foot tucked 3–6 units behind them, so rows are uneven and joints offset (a joint never within 5 units of one
    below); rows step in world units at the block's height (`stretchAt`);
  - sizes: row heights 46/37/32/28… scaled by local face depth (×0.8–1.5: the shrine mound gets big boulders),
    anchors (20 % of the floor row, 1.4–1.8 rows tall), medium, small fill stones (≈ 22 %); widths 0.62–1.07 × height;
    squat cap stones at the lip are narrowed (no planks); tops stop 1.5–5 units past the lip (rounded, no spikes);
  - outline: 5–8 corners on a squarish superellipse frame (flatter foot), each corner rounded by a short bezier,
    low-order bulges, ±0.14 shear — rounded-angular, rigid (no bending at corners);
  - shrine: `kilnshrine` wallScale 1.3 → 1.8, niche 60×74; two anchor jambs flank it, the support is preset over the
    arch so the rows above rest on it as lintel boulders; the niche polygon draws over them (key), under the jambs.
  - band quads (crevice backing) and the face-clearance test use the same frame.
- `shade.ts` `slab()` replaced by per-block shading (same dispatch): blended top / front / side planes with wandering
  soft boundaries, convex body term, rolled rim, painter's stronger key on rock (albedo × 0.66–1.16 by n·key), soft
  occlusion at the foot and lower/right joints, rows darker upward, skyline rolls back, ink heavy at foot/skyline,
  plane-break line on 40 %, cracks on ~30 %, hatching on 26 % (side plane / foot only).

- **M2 done (06:05): per-block shading, skyline, warm highlights.** Rounded-angular outline (5–8 bezier-rounded
  corners, squarer frame), convex body term + painter's key (each block: lit upper-left, dark lower-right), per-light
  warm highlight on planes facing the light (`F.HR/HG/HB`, `F.HIL`: blocks 1 → 0.4 up the rows, big stones 0.5, pebbles
  0.12), rock light response 1.25 → 1.5, LGAIN 0.72 → 0.82, ambient base 0.42 → 0.41, torch/lamp gain 1.3/1.1.
  Crevices desaturated and lighter (0.46–0.58, AO 0.62) so a wall reads as one mass, not a chain of stones.
- **M3 done (06:20): floors.** Section 4 of `slabs.ts` rewritten: clustered floor stones on a 14-unit hash grid —
  pebble clusters at wall feet (`exp(sd/9)`), debris (flat 5-corner chips) round the warm work lights (`spots`, new
  optional last arg of `buildObjects`, passed by `prep.ts`), sparse loose stones elsewhere, none on rail beds or the
  trodden centre of paths; reference-sized stones (r 1.2–3.4, big 3.6–6.2). Floor shading: soft darker blotches,
  stronger mottling and grain, two faint broken ruts along paths, light embossed on the grain (lit dirt shows its
  texture), gray-region floors desaturated (no teal cast east/south), island-top fade desaturates as it darkens.
  `mine.ts`: shrine ground darker, shrine light reach 0.56 → 0.48.
- Exterior rock fade: `(1 − dT/3)² · 0.9` (was linear over 4 units) — the new face band made dTop non-monotonic
  outward at a few corners (N max rise 8.2 at L ≤ 10); now N 3.4 / S 1.7 / E 3.7 / W 3.4 max, ≤ 0.17 % > 3.
- Palette (headless full render at 1 px/unit, `pal.py`): teal 25.9 % (ref 26.4), neutral 51.7 (50.5), warm 15.8 (16.7),
  lime 0.0, mean sat 0.251 (0.257), p90 L 94.1 (98.9), p50 50.7 (53.0).

- Final tuning (06:40): lit block planes brighter (painter's key 0.66 + 0.68·n·key). Palette (headless, 1 px/unit):
  **teal 25.8 % (ref 26.4), neutral 51.7 (50.5), warm 15.8 (16.7), lime 0.0 (0.3), mean sat 0.251 (0.257), p90 L 99.0
  (98.9), p50 51.0 (53.0)**. Boundary (2 px/unit, `lum.py` + `ext` mask): max rise N 3.4 / S 1.7 / E 3.7 / W 3.4,
  rises > 3 in ≤ 0.17 % of profiles, all at L ≤ 9 (r3c: N 3.9 / S 0.0 / E 7.0 / W 0.5).
- Headless single thread, load 17: prep 3.1 s (objects 1.6 s; ≈ 0.4–0.6 s at load 7–8), shade of the whole mine
  13.4 s (1.0 µs/px, 13.1 Mpx). Objects 2061 (r3c 1178).
- Last art pass (06:55): shrine mound teal whatever the region (`mv(12) > 1.5` → `reg = 0`), whitening of lit rock
  halved (gold, not cream), ink inside a mass × 0.88, rare extra-tall anchors (2.1–2.5 rows, 6 % of the floor row where
  the face is > 60 deep), squat blocks never wider than 1.6 × visible height + 6 (no logs). Palette after it: teal 26.1,
  neutral 51.6, warm 15.8, lime 0.1, mean sat 0.252, p90 98.0, p50 51.0.
- **Browser bake (probe `/tmp/p2t5/s/bakeprobe.cjs 3`, lock 1, load 13 → 6 during the runs, code before the last
  art pass — the last pass only changes per-pixel constants and a few block sizes):** wall 3.53 / 3.31 / 2.96 s
  (median 3.3 s ≤ 6), self-measured main-thread block ≤ 4 ms, long tasks: one 55 ms task in the harness setup (not
  terrain), none during the bake; peak 62 MB worker arrays + 51 MB tiles = 113 MB (≤ 120); prep per worker 0.9–1.0 s
  (objects 0.29 s); draw all tiles at fit 11–14 ms median, at zoom 2 0.9 ms; zero console problems. **Budget met.**
- Tried and reverted: rigid blocks on the ±15-unit normal (gaps), width × frame stretch (planks), medium-only blocks on
  shallow faces (thin islands lost their anchors and became piles).

- **Shots (final code):** `node e2e/terrain-shots.cjs` (lock 1, 05:49, load 5.6) exit 0, zero console problems,
  bake 2.93 s wall / maxBlock 2 ms / 62 + 51 MB; all 18 `screenshots/terrain-*.png` regenerated, including
  `terrain-vs-ref-wall.png` and `terrain-vs-ref-shrine.png` (looked at next to the reference: wall = mass of fitted
  blocks, shrine = niche in a teal boulder mound; the two lit blocks right of the niche go pale cream in the browser).

### Self-grade (builder r3d)
- Score vs `docs/refs/mine.png`: **7.5/10** (up from 6.5). The walls are masses of stacked, fitted, rounded-angular
  blocks with lit upper-left planes; the shrine is a recess in a boulder mound; floors carry real stones and ruts;
  palette within ~1–2 points of the reference on every statistic; no band anywhere.
- Three worst faults a hostile critic would name:
  1. **Long north walls read a little like a dry-stone wall** at overview (2–3 even rows of similar medium blocks, ink
     round every block); the reference's walls have bigger value shapes, a few huge boulders and fewer, softer joints.
  2. **The shrine mound is a band, not a hill**: the reference's mound peaks high on one side and is saturated teal;
     ours is an even-height ring, olive-gray where lit, a little pale on the lit faces near the fire.
  3. **Lit floors are still smooth colour pools** at overview (the emboss shows only at zoom ≥ 2); thin islands'
     short side faces still pile small blocks at their ends.
- Next steps (exact, in order):
  1. Hill profile for deep faces: let the support start higher where `ws` is large and add 1–2 extra-tall anchor
     boulders (2–2.5 rows) per 150 units of north face; fewer small fills on long straight faces (`kind` 0 only next
     to anchors); ink weight inside a mass × 0.8 (keep the skyline and foot heavy).
  2. Shrine (teal DONE): the lit blocks right of the niche still go pale cream — cap the highlight by the albedo
     (`hw` ≤ 0.6 at lum > 0.3) or lower shrine `HIL`; raise the mound toward the niche's left (support offset) so it
     reads as a hill with a peak, not an even ring.
  3. Floors: a second, larger emboss octave (0.5 freq) under light so overview shows packed dirt; end-of-run fill
     stones on faces < 26 deep limited to 2 per run end.
  4. Re-measure as in M4 (probe `/tmp/p2t5/s/bakeprobe.cjs 3` on lock 1, `pal.py`, `lum.py`), shots, self-grade.

## Round 3c (successor builder 3, started 04:10) — log
- tsc for terrain files: clean on arrival (no repair needed).
- M1: the rewritten `shade.ts` (class `Shader`) runs. Full-domain render vs the old shader: identical except the pools
  (0.76 % of pixels, all inside pool ellipses — the predecessor's pool change, intended). Node, one thread, load 7.8:
  cold 7.1 s / warm 3.8 s for all 384-unit tiles (12.9 Mpx); deopts are few (prepare 11, run 9, floor 7, water 6) —
  the cold/warm gap is JIT tier-up, not deopt storms. Prep 2.0 s (fields 0.7, objects 0.8), 13 MB.
- M1 browser bake (harness `?stats=1`, probe `/tmp/p2t4/s/bakeprobe.cjs`, 3 runs each, Vite HMR stubbed):
  - run A (load 14–16): wall 5.30 / 6.32 / 5.99 s (median 6.0), self-measured main-thread block ≤ 4 ms.
  - run B (after the art changes below, load 6–9): wall 3.95 / 3.17 / 2.97 s (median 3.2); longtasks: one 50–54 ms
    task per run in the harness *setup* phase (geometry/dressing, not terrain code), none during the bake;
    peak 61 MB worker arrays + 51 MB tile bitmaps = 112 MB (≤ 120). Draw of all tiles at fit zoom 11.5–14 ms
    median, at zoom 2: 0.9 ms. Zero console errors. **Budget met** (≤ 6 s, no terrain task > 50 ms, ≤ 120 MB).
- M2/M3 art changes (all in shade.ts / slabs.ts / mine.ts): floors retuned to the reference's floor colours
  (neutral gray ≈ 52,53,53; teal-gray in the teal region); a broad colour **region** field (teal stone + teal-gray
  floors west/north-west, neutral gray stone east/south, as in the reference); hash-placed **grit** (pits and tiny
  pebbles with contact shadows, never periodic) and finer floor grain; calmer mottling; light no longer textured
  into clouds; **wall faces taller** (HC 46 → 64, the reference's walls are ~3 figures); **chunkier slabs** (min
  width ≈ 21 units, fewer full-height columns, more stacked blocks, broken top silhouettes, rounded corners, wider
  bevel); **lit rock** (wall receivers are no longer cut off by their own foot in the light visibility test;
  rock responds 1.5× to light and desaturates more → olive-gold, not teal); warm light more saturated (less white);
  lamps broader and weaker (no spotty discs); crystal/fungus light tighter; **pools**: irregular banks, depth
  gradient, sheen, no cracks across water, no teal glow from the old water light; **niche**: rough-hewn outline,
  hewn reveals, fire glow low at the foot, inner ink line. Debug view `irr` (irradiance) added.
- M4 (in progress): boundary script `/tmp/p2t4/s/lum.py full.png ext.png` (renders: `npx tsx /tmp/p2t4/s/crop.ts
  out.png 1157 658 2282 1438 2 [ext]`; debug view `ext` = exterior-rock mask) — outward profiles over the final
  exterior run: S max rise 0.0, W 0.5, N 3.9, E 7.0 (≤ 0.8 % of profiles rise > 3; AA at slab corners). Palette
  (`python3 /tmp/p2t3/s/pal.py`): teal 33.8 % (ref 26.4), neutral 48.4 (50.5), warm 10.5 (16.7), mean sat 0.253
  (0.257), p90 L 87.7 (98.9). `e2e/terrain-shots.cjs` gained terrain-north-wall-z3, -south-edge-z3, -island-z3,
  -shrine-z2 and same-scale pairs terrain-vs-ref-wall / terrain-vs-ref-shrine. DECISIONS `#### Round 3 (P2T …)` written.
  Shots run queued on lock 0 (output `/tmp/p2t4/shots.txt`).
- Final tuning (r3c): lit rock 1.25× (1.5 washed slabs out to cream in the browser), torch/lamp gain 1.1/1.0, shrine
  floor brown, no teal tint on warm-ground zones. Palette now teal 33.7 % (ref 26.4), neutral 47.8 (50.5), warm 13.7
  (16.7), lime 0.0, mean sat 0.26 (0.257), p90 L 91.9 (98.9). Boundary unchanged (S 0.0, W 0.5, N 3.9, E 7.0 max rise).
- Shots: first run 04:39 exit 0, zero console problems (bake 5.25 s wall at load 10, maxBlock 2 ms, 62 + 51 MB);
  final run 04:51 exit 0, zero console problems (bake 6.31 s wall at load 17.6 — over 6 s only under that load;
  3.0–4.0 s at load 6–9), 18 `screenshots/terrain-*.png` regenerated incl. the six new ones.
- Tried and reverted: `kilnshrine` wallScale 1.7 — stretching makes tall thin shards ("teeth"); tall faces need
  more stacked tiers, not taller slabs (next step 1).

### Self-grade (builder r3c, end of my context budget)
- Score vs `docs/refs/mine.png`: **6.5/10** (up from 6: budget met, palette near the reference, no band, floors and
  light much calmer; shape language still short of the reference).
- Three worst faults a hostile critic would name:
  1. **Wall faces are rows of upright slabs ("picket fence" / basalt columns)**, especially on tall faces and the shrine;
     the reference piles rounded-angular blocks in 2–4 stacked tiers with lighter top-left planes. The shrine is a thin
     wall with a doorway, not a rock mass with a niche (`screenshots/terrain-vs-ref-shrine.png`).
  2. **Floors still airbrushed under light**: lit areas are soft clouds; the reference's lit dirt has fine texture,
     scattered small stones and debris that the light picks out. Island tops at z3 are a soft even teal margin.
  3. **Highlights and warmth short**: p90 L 91.9 vs 98.9, warm 13.7 % vs 16.7 %; lit slab faces read flat (one tone per
     plane, plane breaks mostly un-inked), hatching mechanical.
- Next steps (exact, in order):
  1. `slabs.ts` tier 1/2 loop: number of tiers from face depth (`depth / 30`, 2–4); each tier a row of blocks whose
     height is ≈ 0.3–0.5 of the face (not stretched), set back and smaller toward the lip, offset so joints do not
     line up; then raise `kilnshrine` wallScale to ~1.7 and check `terrain-vs-ref-shrine`.
  2. Rounder block silhouettes (8–10 vertices with bulges, not chipped rectangles); per-block lighter top-left plane
     with an inked break, darker lower-right; reduce hatch to ~25 % of shadow planes.
  3. Floors under light: keep the light smooth but add the floor's own small-stone/debris layer near work spots
     (objects, not texture); island tops: a few lip chips and darker cracks in the margin.
  4. Re-measure: `node /tmp/p2t4/s/bakeprobe.cjs 3` (lock 0), palette (`/tmp/p2t3/s/pal.py`), boundary
     (`/tmp/p2t4/s/lum.py full.png ext.png`), shots `node e2e/terrain-shots.cjs`, self-grade again.
- Scratch tools (copy them if /tmp is cleared): `/tmp/p2t4/s/{crop.ts,c.sh,dumpspec.mts,dom.ts,warm.ts,lum.py,bakeprobe.cjs}`.




## Round 3 (in progress — builder r3b, started 03:05)
Previous r3 builder left no code edits (only scratch in /tmp/p2t3/s: dumpspec.ts, pal.py, canvprobe.cjs).
Plan (rewrite of the core, API kept):
- New modules: `prep.ts` (global 2-unit fields once per worker: floor mask, sdf, exterior, band mask,
  rock-top distance, contours, light visibility maps), `slabs.ts` (contour loops → slab polygons in
  tiers on north/side faces, scree stones, shrine niche), `shade.ts` (per-pixel shading of a rect at
  2 px/unit from an object-ID raster + analytic polygon edge distances; no ray-marched shadows).
- `index.ts`: tiles (384 world units) baked by a worker pool, returned as ImageBitmaps; `TerrainBake`
  gains `tiles` + `draw()`; `lit` becomes a lazy getter (full canvas only if someone asks).
- `form` off by default.
Progress (03:50): prep.ts, slabs.ts, shade.ts, tex.ts written and working headlessly; core.ts is now a
thin wrapper (bakeCore = prepare + shadeRect); mine.ts retuned (grey floors, TEAL, kilnshrine
wallScale 1.45, niche from dressing.shrine). Dev loop: `npx tsx /tmp/p2t3/s/crop.ts out.png cx cy w h
scale` (or CROPS='[[out,cx,cy,w,h,scale],…]'), spec from `npx tsx /tmp/p2t3/s/dumpspec.mts`.
Next: index.ts tiles + worker pool, harness, shots; then art polish (lights, pools, floor grain).

## Round 2 (done; awaiting critic)
- Rock rebuilt as **lumps** (core.ts §2), see DECISIONS "P2T … Round 2". North faces: tall columns +
  a smaller tier behind; side faces rounder masses; south lips no lumps (lit rim only); foot skirt,
  floor pebble clusters, pool-bank stones. Gaps on north faces = darker wall body; rock top = flat dark
  teal + crisp lit rim; islands solid; exterior rock darker and sinks into black (no band).
- Domain padded (`terrainDomain`): bake rect = floor bbox + rim on every side (rect may be negative).
- Lights tight (mine.ts LIGHT_REACH / LIGHT_GAIN), rock one gray-teal everywhere, muted grounds whose
  hue survives the cool ambient.
- Rails: exact segment distance (`SegIndex`), ballast + ruts under the rails; paths only a trodden centre.
- Office paving: irregular stones (stretched Voronoi), breaking up toward walls and in patches.
- Workers = min(4, cores − 1): each does fields + lumps (global), heights/lightmap only for its band;
  results come back as ImageBitmap strips drawn ≤ 10 ms per frame; data layer per band; result
  canvases pre-allocated while the workers run; harness builds the geometry in slices.
- New shots: `terrain-island.png`, `terrain-shrine-vs-ref.png` (ours with props, zoom 0.976, next to
  the reference crop 420×260 @150,230 at 2×: equal world scale).
- Dev loop (scratch, not in repo): `/tmp/p2t2/s/crop.ts` (tsx; bakes a world crop from a spec JSON
  dumped by `/tmp/p2t2/s/dumpspec.cjs`), `/tmp/p2t2/s/probe.cjs` (PerformanceObserver long tasks,
  rAF gaps, renderer RSS of the launched browser).

### Numbers (round 2, measured on this 4-core box at load average 16–26, i.e. heavily shared)
- Full bake 4564×2852 (lit + form) + data: 25–39 s wall with 3 workers (round 1: 35–42 s with 4).
  Per-worker typed-array peak 259 MB summed over 3 workers (round 1: 440 MB over 4). Renderer RSS
  of the launched browser 600–1700 MB depending on GC timing (whole process: page + workers + canvases).
- Setup before the bake: geometry in 12 ms slices + dressing 18–86 ms: no long task over ~105 ms
  there (round 1: one 0.8–1.3 s task). Upload: ≤ 10–41 ms per unit with pre-allocated canvases
  (137–178 ms for the first unit without).
- Long tasks / rAF gaps during the bake still appear (50–830 ms, scattered) while the main thread
  only receives progress messages: they track the machine load (other agents' browsers), not the
  bake's own work; on a quiet machine they should vanish. Not proven here.

### What still differs from the reference (side-by-side crops)
- The reference's rock is more saturated teal and fills more of the frame; our mine has wide floors,
  so the overall image is browner/grayer. Our lumps lit by torches go pale khaki where the reference
  stays olive-teal.
- Reference walls are a tighter, more continuous mosaic of lumps with darker crevices; ours still show
  a few "beads" on side walls and the north-face columns can read as a row of teeth at overview.
- The reference has a light halo around the whole mine; we do not (owner's rule).
- Floors: reference floors are smoother with fewer patches; ours have more mottling at zoom 2.
- The shrine alcove in our shots is mostly the shrine prop (owned by the mine renderer); the terrain
  around it is warmed but the alcove's own rock is the prop's masonry.

## Status
The pipeline is complete and the look has been through several rounds. Ready for a critic. Shots: `NODE_PATH=/usr/local/lib/node_modules_global node e2e/terrain-shots.cjs` (runs its own vite on 5208; the run fails on any console error or warning; the last run passed with exit 0).

## Files (all new, owned)
- `src/render/terrain/types.ts`: TerrainSpec, TerrainMaterial, TerrainLight, BakeOptions, BakeBuffers.
- `src/render/terrain/noise.ts`: integer hashes, gradient noise, Voronoi with precomputed bisectors (exact border distance, neighbour id, distance to the northern edge).
- `src/render/terrain/fields.ts`: scanline polygon fill, Felzenszwalb EDT (plus nearest-feature index), anisotropic one-sided `wallParam` (the 3/4 faces), border flood fill, polyline stroke, box blur, bilinear sampling.
- `src/render/terrain/core.ts`: the `bakeCore` generator. Stages: fields → height → AO → directional lightmap with ray-marched soft shadows → per-pixel shading, ink, hatching, floors and water → data layer. Options: `rect`, `band` (a range of rows), `scale`, `form`, `data`, `debug` ('light'|'normal'|'albedo'|'height').
- `src/render/terrain/worker.ts`: the worker entry (transfers its buffers back).
- `src/render/terrain/index.ts`: `bakeTerrain(spec, opts)` → `TerrainJob {promise, progress, stage, cancel}`. Up to 4 workers each shade a band of rows. The main thread only uploads rows, in strips of about 1 MB, and yields between them. Without workers it falls back to main-thread slices (`budgetMs`). Also exports the `lightFlickerDelta()` helper.
- `src/render/terrain/mine.ts`: `mineTerrainSpec(seed, geo?, dressing?)`, `mineMaterials()`, `mineLights()`, `GROUND_MATERIAL`.
- `dev/terrain.html` and `src/render/dev/terrainHarness.ts`: the harness. URL parameters `?zoom=&focus=<zoneId>|&cx=&cy=&void=0|1&props=1&layer=lit|form|data&scale=&worker=0&stats=1`; keys V/P/L/F; `window.__terrain`.
- `e2e/terrain-shots.cjs`: writes screenshots/terrain-{overview,kilnshrine,overseer,grave,sump,railtunnel,sorting-wall,overview-props,kilnshrine-props}.png and terrain-vs-ref.png.
- `DECISIONS.md`: appended `### P2T — Sculpted terrain` at the bottom.

## Numbers (round 1; round 2 numbers are in the report and DECISIONS)
- Full bake: lit + form at 4800×2800, plus data at 1200×700.
  - With 4 workers: about 8–11 s wall time when the 4-core box is quiet. Under load from other agents (load average 12–18) it measured 30–44 s.
  - With 1 worker: about 21 s.
  - The longest main-thread block is 35–60 ms, during the canvas upload.
- Memory: each worker peaks at about 110 MB of typed arrays (about 440 MB summed over 4 workers, freed when they finish). The result canvases take 111 MB.

## How the game adopts it
- **Mine renderer:**
  - Build the terrain with `bakeTerrain(mineTerrainSpec(seed, geo, dressing))` and use it in place of the rock and floor parts of the albedo bake (the rock rim, boulders and floors).
  - Recommended (`lit` layer), per frame: draw `lit`, then rails and props (they keep their `lightAt` lit sides), then flicker with `lightFlickerDelta` for each light (current k against the baked k), then people, emissive and fog as now.
  - Alternative (`form` layer): draw `form` × the existing multiply lightmap. Lights stay fully dynamic, but cast shadows and the light-coloured highlights are lost.
  - Sensed gray: derive it from `lit` the way `bakeGray` does now.
- **Town:** fill a TerrainSpec as follows:
  - streets and plazas as `floors`;
  - building plots as rock masses (`solidIslands: true` keeps enclosed masses solid);
  - lamps as `lights`.
  A new ground style is added in `GroundStyle` and in the floor branch of `core.ts`.

## What still differs from the reference
- The reference rock is lighter and more evenly teal, with big soft value shapes. Ours is darker away from lights. On tall faces at overview, the Voronoi blocks can read as a stone mosaic.
- The reference floors are calmer. Ours still show some soft light-pool haze, and the haul floors (an ochre ground set by the layout) make the overview warmer than the teal-dominant reference.
- The reference light pools are big and soft. Ours are tighter around crystals, and the shrine's gold reaches the walls less than in the reference.
- At overview scale (the 2 px/unit bake downsampled) the ink is heavy. At zoom 2 it is the right weight.

## Requests
- None. No external libraries, so nothing goes in CREDITS.md.
- For the owner of `src/render/mine/**`: when adopting this, skip the old rock rim and boulder bake and draw `lit` beneath the props.

### Round 3 — handoff at context cap (builder 2)
- Done (on disk, tsc clean for terrain files): tiled worker pipeline (prep.ts / slabs.ts / shade.ts / tex.ts, core.ts, worker.ts, index.ts rewritten; mine.ts palette + niches; harness uses drawTerrain). Slab cliff faces in tiers on north faces wrapping W/E, scree, floor stones with contact shadows, shrine niche lit gold, exterior rock fades ink→#000, island two-stage margin, warm light on desaturated albedo.
- Just done, NOT yet run: shade.ts rewritten as class `Shader` with small per-surface methods (same `shadeRect` export) to stop the ~32 V8 deopts of the old giant function (old: 12.8 s first run vs 3.7 s warmed in node, each worker pays it). First thing: render with `/tmp/p2t3/s/crop.ts` and compare against `/tmp/p2t3/o/full.png` for regressions, then `node --trace-deopt` count.
- Last measured browser bake (old shade.ts): 10.5–19 s wall under load 5.6–7, maxBlockMs 2–31, peak 84 MB workers + 51 MB canvas. Target ≤ 6 s / ≤ 120 MB. Ideas: quantize sd/band/dTop/railD/pathD (Float32 → Int16/U8) to cut prep ~21 MB → ~8 MB per worker.
- Not done: palette stats (`python3 /tmp/p2t3/s/pal.py`), boundary-profile script, new shots in e2e/terrain-shots.cjs (north-wall-z3, south-edge-z3, island-z3, shrine-z2, vs-ref-wall, vs-ref-shrine), regenerate all terrain shots, pools (too black/hole-like), light pools still blob-like, DECISIONS `#### Round 3`, vitest run.

### Self-grade (builder 2, at context cap, round 3 in progress)
- Score vs `docs/refs/mine.png`: **6/10**. Not checked side by side against `handoffs/ref/` this round: no new shots were made after the last changes.
- The three worst things a hostile critic would say:
  1. The pools read as black holes, not still dark water with an inked bank. The light pools are still soft blobs, and the lit falloff does not model the slabs the way the reference does.
  2. It lacks the detail and polish of the reference (the owner's verdict still stands). The floors are too uniform. Secondary detail at z2/z3 (ledges, damp streaks, varied ink, crack ticks) is thin and unverified. The shrine niche reads as a doorway.
  3. It is over budget: 10.5–19 s bake against ≤ 6 s, and about 135 MB against ≤ 120 MB. There are none of the brief's required shots, palette stats or boundary-profile numbers.
- Next: run the rewritten shade.ts and check it for regressions. Then measure the bake against the budget, fix the pools and light pools, and add the floor detail. After that, make the required shots and put them next to the `handoffs/ref/` crops, then grade again. Report only at an honest 8 or higher.
- For the next builder: per orchestrator rules 11–13 (`handoffs/RULES.md`) and `DECISIONS.md` §14.9–14.10, check that the public API section at the top of this file exactly matches the code. Add these, which are additive: `drawTerrain(g, bake, layer?, view?)`, `TerrainTile {x,y,w,h,g,lit,form}`, `TerrainSpec.niches?`, `BakeOptions.tile?`, and the TerrainBake fields `tiles`, `wallMs`, `bakeMs`, `maxBlockMs`, `peakBytes`, `canvasBytes`. `lit`/`form` are now lazy getters and form is off by default. TOWN-ART (`src/render/town/art`) and the mine engine builder will both consume this API.
