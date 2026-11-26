# P6b — World composition — handoff

## To the town engine (the join with the land) — builder #6, 2026-11-23 11:15 (kept current)
- `townExtent()` / `frameAll()` now use your `TOWN_FRAME` ∪ the pit + 120 units (frameAll ≈ 0.37 on 1600×900).
- Where the land takes over: alpha = smoothstep(230, 560, distance past `FLOOR` + noise ±110) (the land is drawn
  over your frame only at scale ≤ 0.42, full at ≤ 0.2). Between 230 and 560 past the floor both show, so your ground
  there must match the land's colour **as drawn on screen** (after your light):
  | hour (`WorldView.dayT`) | land at 250–650 past the floor (median, hillshade off) | luminance |
  |---|---|---|
  | day 0.5 (your daylight 1) | `#42453c` (albedo `#424743` × 1.0/0.96/0.9) | 67 |
  | dusk 0.74 (daylight ≈ 0.2) | `#3a2d1f` (copper) | 47 |
  | night 0.02 (daylight 0) | `#222c2d` (62 % desaturated, × 0.5/0.62/0.66: teal-gray) | 42 |
  Your outer bench tops (#7f8f90 albedo × AMBIENT #827b6c ≈ `#40453d`) match the day value — keep that; please check
  dusk and night against the table (night: teal-gray around lum 35–42, not blue-black). Beyond ~560 past the floor
  your reach may fall to anything: the land covers it. Measured join numbers will follow below once a browser run
  gets the lock (lock 1 has a long queue).


## Interface for the play scene (exact; additive only — kept current)

```ts
import {
  createWorldRenderer, preloadWorldRenderer, type WorldComposite, type WorldView, type WorldZoneView,
  type WorldUnitView, type WorldEffect, type CamPose, type WorldHit,
  worldCameraFromMine, mineCameraFromWorld, setPose, poseOf, pullBackPath, constrainCamera,
  PIT, PIT_C, K, LOD_S0, LOD_S1, ZOOM_MIN, ZOOM_MAX, layerOfZone, mineToWorld, worldToMine,
} from '../../render/world';
```

**Create**
- From the cutscene's mine: `const world = createWorldRenderer({ mine })` — the town bakes in the background
  (8 ms slices; `world.townReady: Promise<TownRenderer>`, `world.townProgress` 0..1). Until it is attached the
  surface is black with the pit's glowing point. Options: `{ mine, town?, townLoad?, townSeed?: number|false, townBudgetMs? }`.
- From a seed: `const load = preloadWorldRenderer(seed, budgetMs)` → `{ progress, done, townDone, renderer, promise, fullPromise }`
  (`promise` resolves when the mine is ready; `fullPromise` when the town is attached too).

**Camera** (one `Camera` from `src/render/camera.ts`, world = town units 6400×3600; scale = logical px per town unit)
- From the cutscene's mine camera (same first frame): `const cam = worldCameraFromMine(mineCam)` then `world.setupCamera(cam)`
  (bounds = the world, `minScale = ZOOM_MIN` 0.25 = whole town, `maxScale = ZOOM_MAX` 15 = mine zoom 2.5).
- Each frame, after input and before `cam.update(dt)`: `constrainCamera(cam)` (zoom limits; below the pit the
  camera may descend into the mine; elsewhere it stops at the town close-up). The full zoom range is always
  available from turn 1.
- Poses (`CamPose = { x, y, scale }`, apply with `cam.setTarget(p.x, p.y, p.scale)` or `setPose(cam, p)` to jump):
  `world.frameMine()`, `world.frameTown(ids?)`, `world.frameZone(id)`, `world.frameAll(pad = 50)`.
  **`frameAll` = the whole town** (builder #4): the town plan's extent (`world.townExtent()` — every block's ground
  and the pit, + the ~220 units of walls/roads/lit edge round them: world x 387…5738, y 289…3201) centred, with
  `pad` logical px of margin, filling the view → `{ x: 3062, y: 1745, scale: 0.275 }` on 1600×900. (It was the
  6400×3600 rect at 0.25, which is mostly dark ground round the plan, so the town sat small and off-centre.)
  `townExtent()` is static (no bake needed).
  `world.frameSurface(ids = ['minehead', 'slagrows'], pad = 70)`: the pit head + miners' rows at a town zoom (≥ 0.75),
  the pit kept in the middle third (where followers live from night 1). `world.frameValley()`: the town in its valley,
  `{ x: 4100, y: 700, scale: ZOOM_FAR }`.
- **The valley** (builder #4, DECISIONS §16.5): `ZOOM_FAR` = 0.1 is the new furthest zoom (`constrainCamera`,
  `setupCamera`, `worldCameraFromMine` allow it; `ZOOM_MIN` 0.25 is still exported and means "the whole town").
  The land round the town fades in below scale 0.42 (full at 0.2): `world.valley` (`Valley | null`, built when the
  town attaches, baked a few ms per frame) with `alpha` 0..1 for a scene to dim/hide it; `VALLEY` = its world rect.
- Watershed: `const path = pullBackPath(poseOf(cam), world.frameAll())`; each frame `setPose(cam, path(t01))`
  (t over ~4 s; do not call `constrainCamera` while it plays). The path lingers in the descent band (≈ 22 % of
  the time, p 0.85 → 0), where the mine shrinks into the shaft mouth and dims into the glowing point.
- **Land round the town** (builder #5, theme §6): `world.valley` (`Valley`) is redrawn (rock country, bowl rim terraces,
  spoil heaps, cap-tree groves, glow-moss, dry gorge, herds, camps and waystations, the road to the city, mountains, the
  war's glow). Additive API: `WorldView.dayT?` (0 midnight … .5 noon … .75 sunset; lights the land: day even, copper
  dusk, black night with lights) — **play scene: pass the same `dayT` you feed AMBIENT**; `valley.dayT`,
  `valley.reveal` / `valley.revealColour` (0..1: open the land past what the god knows, gray / in colour — FINALE's
  first sight of the city), `valley.knownAt(x, y)` → `{ colour, seen }`, `valley.setFog(blocks, dt)` (the world calls it
  from the town zones each update), `CITY` (world point of the city, up the road), `VALLEY_NEAR`.
  Fog: land is known as far as the blocks next to it (Active → colour, Sensed → gray, Void → exact #000), reaching
  further with the share of the town held; the gate block opens a corridor up the road. Cut by the town's light reach.
- (builder #5b) `frameAll()` / `townExtent()` now fit the town engine's bowl (`FLOOR` bounds ∪ the pit rect + 330),
  and `frameValley()` sits relative to it; a `WorldView.dayT` also sets the town's daylight (`town.setDaylight`);
  `Valley.daylightOf(dayT)` / `Valley.dayTOf(k)`; the land's design is in `valleyArt.ts` (`CITY`, `CITY_R`, `MAIN_ROAD`).
- A mine camera for code that still thinks in mine units: `mineCameraFromWorld(cam, out?)`.

**Each frame**
```ts
world.update(view: WorldView, dt);          // view below
world.render(ctx, cam);                      // ctx: logical 1600×900 transform already set (as for the mine)
drawGodThread(...)                           // NOT needed: pass view.thread and the world draws it in the mine layer
```
`WorldView` = `{ zones: WorldZoneView[]; people: WorldUnitView[]; time; godPulse?; pitGlow?; thread?: { reach, rest, seed?, alpha? } | null;
selectedIds?; hoverId?; selectableIds?; effects?: WorldEffect[]; lift?: { pos: number } }`
- `zones`: the 12 mine areas + the 13 town blocks, one list, `ZoneView` fields (`visibility`, `control`, `flags`,
  `selected`/`selectable`/`highlighted`) plus the stain: `hold?` (0..1), `holdFrom?: string[]` (neighbour ids; may
  name the other layer's gate: `minehead` in `lift.holdFrom` / `lift` in `minehead.holdFrom` — colour then grows
  from the cage in the mine / from the pit mouth on the surface), `holdAt?: {x,y}[]` in **world (town) units** for
  both layers (the world converts mine-area seeds to mine units).
- `people`: `PersonView` + `size?` (group 8–40, town) + `elite?`; `zoneId` decides the layer. Changing a unit's
  `zoneId` between a mine area and a town block plays a crossing (walk to the cage / pit head, fade, ride, appear
  at the other end, walk on) — no pop.
- `lift: { pos }` 0 = cage at the bottom of the shaft (mine), 1 = at the pit head; drives the cage/wheel.
- `effects`: one-shot `{ kind, zoneId?, personId?, toZoneId?, id? }` (with `id` it fires once however many updates
  carry it); or call `world.emit(effect)`. Kinds: convert, convertFail, miracle, whisper, evil, death, crystalize,
  reveal, ripple, bell, discover, mark (+ `glyph?`). Routed to the layer of the person/zone; a whisper to a town
  person also runs up the lift shaft in the mine; mine effects get a world zoom-out beacon at the pit (town effects:
  the town's own far beacons); the new kinds are drawn by the beacon at every zoom until the layer reports
  `supportsEffect(kind)`.

**Overlay seams** (AMBIENT, VFX, people positions — `src/render/world/overlay.ts`)
```ts
const off = world.addOverlay(seam: 'ground' | 'props' | 'above' | 'grade', (ctx, host) => { ... }, { layers?: ('mine'|'town')[], order?: number });
// host: { layer, matrix /* world→device, already set on ctx */, toScreen(wx, wy), scale, dpr, time, descent,
//         visibilityAt(wx, wy) → { vis: 'active'|'sensed'|'void', zoneId, hold }, lift: { pos } | null, hold(zoneId), view /* world rect on screen */ }
off(); // unregister
```
- **In-colour seams** (additive, builder #3): `addOverlay(seam, fn, { inColour: true })` runs a 'ground' / 'props' /
  'above' callback INSIDE the layer's own frame, before its Sensed/Void composite, so the layer's fog covers it like its
  art (no fog maths needed): mine via `mine.addLayer` (ground = after the lit floor, props = before people, above =
  after people); town via `town.layers.*` (ground → town people → props → emissive → above; an in-colour 'grade' = the
  town's own grade seam, before rings/effects/pit point, must keep Void #000). Anything already in `town.layers.x` is
  chained and called first (re-checked every frame). Same world-unit transform and host as the post-fog seams.
  **Mine caveat (measured):** the mine's composite grays in-colour content over Sensed (chroma ≤ 7) but does NOT black it
  out over Void (leak up to 255) — in the mine layer draw colour × `host.fog(x, y).colour` (= the mine's own addLayer rule).
  The town covers Void itself (leak ≤ 3/255 at soft fog edges).
- Host additions: `host.inColour: boolean`, `host.fog(wx, wy) → { colour, seen }` (the layer's own soft per-pixel fog +
  stain, as it draws it; post-fog overlays draw colour × `colour`, gray × (`seen` − `colour`), nothing where `seen` = 0).
- Order per frame: town layer = `town.render → ground → props → above → grade`; mine layer =
  `mine.render → god's thread → ground → props → above → grade`. In the cross-fade band the town's overlays are
  darkened with the surface and the mine's are masked with the mine (they are part of their layer); a layer that is
  not drawn does not call its overlays. The callbacks run after the layer's own fog pass: apply fog yourself with
  `host.visibilityAt` (Void: nothing; Sensed: dim gray). Coordinates are always world (town) units, in both layers.
- `world.visibilityAt(wx, wy, layer?)` is also public.
- **`'sky'` seam** (builder #4, for WEATHER): `world.addOverlay('sky', (ctx, host) => …)` runs ONCE per frame after the
  whole composite (both layers, the band, the beacons) in world units; `host.layer` = the dominant layer, `host.fog`
  blends both layers' fog by the descent. `host.flash(k)` brightens everything drawn by (1 + k) (lightning) and
  `host.tint(colour, k)` multiplies it toward a colour (overcast/rain grade) — both keep exact #000 black. Rain veils,
  fog pools and cloud shadows: draw them weighted by `host.fog(x, y).seen` (0 = Void: draw nothing). Every host
  (all seams) now has `flash`/`tint` too (they act inside that layer's clip). People specks at far zoom: the
  town layer's `'above'` seam (post-fog) — the town covers Void, `host.fog` gives colour/gray.
- Mine in-colour seams are now cut by the mine's own Void cover by the world (scratch × voidCover², builder #4):
  callers no longer need to weight by `host.fog().colour` to keep Void black (weighting is still harmless).
- The lift cage/wheel is AMBIENT's (draw it at `host.lift.pos`); the world only passes `WorldView.lift` through
  (to the host and to both layers' views as `lift`).
- Beacons: `world.beaconLayers = { mine: true, town: false }` (default: the world echoes mine effects at zoom-out,
  the town draws its own); set `mine: false` once VFX draws far forms for mine effects.

**Camera outside the town (FINALE)**: `setPose(cam, pose)` never clamps (and `cam.clampEnabled = false` stops
`setTarget`/`panBy` clamping); `constrainCamera` only limits zoom (0.25 … 15) and the descent. Any centre is drawn:
outside the town rect (0..6400 × 0..3600) the world is plain `#000` (the town renderer's Void), so FINALE may rise
over the north-north-east wall and look up to one screen beyond the edge (e.g. centre y ≥ −1800 at scale 0.25–0.5)
and draw the distant city in that black on the town layer's `above` (or `grade`) seam — or directly after
`world.render` in screen space. Keep `scale ≥ 0.25` (ZOOM_MIN) for the pull-back; going wider is allowed for
FINALE (nothing breaks below 0.25, the town is just smaller).

**Hit-testing and coordinates** (all world = town units; screen = logical 1600×900 px of the last-rendered camera)
- `world.hitTest(sx, sy, cam?)` → `WorldHit = { layer: 'mine'|'town', world: {x,y}, local: {x,y}, zoneId: string|null, personId: string|null }`
  (`local` = the layer's own units: mine units in the mine; routed to whichever layer is drawn there).
- `world.zoneAtScreen(sx, sy, cam?)`, `world.personAtScreen(sx, sy, cam?)`, `world.zoneAt(wx, wy)`, `world.personAt(wx, wy)`.
- `world.unitScreenPos(id, cam?)` (feet, logical px), `world.personPos(id)` (world), `world.zoneAnchor(id)`,
  `world.zoneBounds(id)` (world rects; mine areas are small rects inside `PIT`), `world.zoneVisibility(id)`.
- `world.worldToScreen(wx, wy, cam?)` / `world.screenToWorld(sx, sy, cam?)` (= the camera's, with the last-rendered camera by default).
- `world.dominant` ('mine' | 'town' at the current zoom), `world.unitLayer(id)`, `world.info` (last frame: scale, descent p, layers drawn).
- `mineToWorld(mx, my)` / `worldToMine(wx, wy)`: the nested mine ↔ world mapping (`world = PIT.x + m / K`, K = 6).

## Status (builder #6, successor — 2026-11-23 10:10; scratch /tmp/p6b6, quick shots `q.cjs name@query …`)
Brief (orchestrator): 1 night not near-black (known-land median 30–40, forms readable teal-gray, pools of light);
2 town blends into the land (no dark rounded rect); 3 descent band: shaft walls/strata between mine and town;
4 crags → fewer bigger massifs, mountains varied ranges, spoil heaps as pale fans; 5 re-shoot stale shots + full
`everything`, perf, Void/seams, identity; 6 one clock (`dayT`) for every layer.
- [x] On arrival: tsc clean for world files, tests/world 15/15.
- [x] code (10:30, tsc clean, tests/world 15/15 with updated expectations), NOT yet seen in a browser (lock-1 queue ~8 jobs):
  1 night: `Valley.lightOf(dayT)` (static) — night = 62 % desaturation then × (0.5, 0.62, 0.66) (was × 0.1/0.11/0.145);
    dusk copper stronger (weight 0.7, k 0.98/0.58/0.34) so it still reads over the brighter night base.
  2 rim: plan part 4 (`PLAN_PARTS` 5) — 7 footpaths out of the rim (`LandPlan.paths`, drawn in `paintRoads`) to outlying
    shell-hut hamlets (lamps), cap-tree clumps and small tips; ~50 lone cap-trees/boulders 260–900 past the floor;
    groves/lone trees allowed from 600–650 past the floor (was 1000–1300: a bare ring round the town); the plateau
    colour ring softened (0.2–0.45 noise-weighted over 300–1100, was a flat 0.6 over 500–1500).
  3 band: `shaft.ts` `drawShaft` — the lift shaft's walls in the opening round the mine's box (log-spaced strata rings,
    ink lips, light catch, cribbing rings, guide rails, old adits with lamps, violet veins), lit from below, faded at the
    opening's edge, × smoothstep(0.995, 0.86, p), only where `lift`/`minehead` are seen (Void: nothing; Sensed: gray).
  4 crags: ~25 massifs (ridges of 3–7 outcrops, biggest in the middle, scree, boulders) + 70 lone boulders: 348 crags
    (96 with r > 150) — was a 150-unit grid scatter; big crags get scree, a crest and cracks. Mountains: 106 massifs
    of 1–4 summits (w 500–2500, the odd mesa), biggest placed first and kept apart (valleys between), skyline ink,
    spurs, east faces in shadow per summit. Spoil heaps: pale tailings fans tipped from the rim (streaks, dark toe).
  6 one clock: `WorldComposite.dayT` (from `WorldView.dayT`, else the town's daylight) sets the town's daylight even
    before the land exists; overlay hosts get `dayT` / `daylight` (additive; for WEATHER's sky seam).
  TOWN engine request done: `townExtent()` = `TOWN_FRAME` ∪ pit + 120 margin (frameAll ≈ 0.37 on 1600×900, was 0.275);
    `frameValley()` follows it.

## Status (builder #5b, restart of successor 5 — 2026-11-23 08:20)
Owner §19 ("just get something in place"): one decent version of the land, no polish rounds.
- [x] Files whole: tsc clean for world files; `tests/world` 15/15 (4 new: plan determinism / lights once, groves off
      the bowl and road with house-sized caps, cap fade = 1 at land zooms, `daylightOf`/`dayTOf`).
- [x] Land redrawn: `src/render/world/valleyArt.ts` (new: design, `planLand`, painters) + `valley.ts` (bake, fog,
      compose, live lights). Rock country, crags, ~29 cap-tree groves (THEME `drawCapTreeStalk/Cap`), glow-moss, dry
      gorge with black pools + teal glints and a trestle bridge, a dark tarn, spoil heaps + tip track + two old cuts
      placed from `FLOOR`/`PITS[0]` at bake time, pit-beast herds (THEME `drawPitBeast`) with hide camps, 4 waystations
      (shell houses, hearth, pen, THEME `drawCart`), the road from the town road's end to the city gate, inked
      mountains N and E, the city (walled basin, cast towers, gold dome), war smoke/fires + red glow.
- [x] Fog: unchanged mask machinery (Void exact #000, Sensed gray, organic cut); the land is now composed source-over
      with a soft rim cut (230 → 560 units past the floor) so it replaces the town's dark plateau (no moat).
- [x] One light: `WorldView.dayT` sets the town's daylight too; without it the land follows the town's daylight.
      Day lit-pixel luminance median 55 (q 39–67) at the valley view — mine ref 53 (37–71).
- [x] `townExtent()`/`frameAll()`/`frameValley()` follow the town's `FLOOR` (the re-plan moved the bowl).
- [x] Void check in `e2e/world-shots.cjs` takes the pit centre from the mine areas (it had the old pit hard-coded and
      counted the pit's own glow as a leak). Harness `lib.layerOfZone` added.
- [x] Bug fixed: the gorge polygons used `moveTo` for their second edge → a straight chord band across the map.
- [x] run4/run5 (08:20–08:55): all shots made, zero console errors; identity max 0/255 at all 8 cameras (after the
      check stopped assuming the old pit); seams Void max ≤ 3/255 (mine 1, town 1, far 3; the old 10/255 is gone).
- [x] Void check at s 0.1/0.25 failed in run5 (gray land over Void for one frame after the bake: the mask defaulted
      to all-Sensed) → fixed: the last fog sent is kept through the bake, default unknown. run6 (09:10): void
      0/255 at s 0.1, 0.25, 0.6, 1.2, 2.0, 2.6; seams Void max 1/0/1/3; zero console errors.

## Self-grade (builder #5b, 2026-11-23 09:15): land 7/10 ("in place, right in kind", owner §19), descent 7–8
Worst three: (1) crags read as scattered gray pebble fields at 0.1–0.2 and the spoil heaps as flat tents; (2) the bowl
still has a faint darker ring where the town's plateau meets the land at 0.2 (cut 230 → 560 units; the town's plateau
is darker than the land's); (3) the band: the mine is still a lit island on black until the town fades up (builder #4's
design, rated 7 by the orchestrator) — not touched this round.

## Next steps
1. When the town engine's plan settles: re-shoot `world-valley-*`, `ladder`, `sheet`, `band` (`node e2e/world-shots.cjs
   world-valley-far world-valley-far-night world-valley-mid-day world-valley-mid-night world-valley-reveal ladder sheet band checks`).
2. Polish when allowed: fewer, bigger crag clusters; spoil heaps as pale fans; plateau colour matched to the town's.
3. Shots with hard-coded `cx/cy` near the old pit (world-cross-town, world-fx-town, world-lift-*, world-ambient-pit)
   need `focus=pit` offsets instead (the pit moved to (2125, 1083)).
4. Band perf (≤ 1.6× at load) not re-measured this round (builder #4: 1.41–1.57× at load 8).
- [x] The plan runs in 4 bake steps (≤ 122 ms each unloaded; was one 360–700 ms step).

Requests (new):
- PLAY-WORLD: pass `dayT` in the `WorldView` you give the world (`src/scenes/play/world.ts`, the same `this.dayT` fed
  to AMBIENT) — today the town is never given daylight (always night grade) and the land follows it.
- FINALE: the land now draws the city at `CITY` (10100, −2500, walled basin r 1500, the dome at its centre) up the
  road; your ending's city is at (24400, −8800) r 15000 — use `CITY` (+ `world.valley.reveal/revealColour`) or tell
  me where to move it, so there is one city.
- TOWN-ART / town engine: the pit head from above reads as a stepped oval pit with a violet glow but no headframe
  lattice / wheel visible at scale 1.5 (sheet frame t .64): the headframe straddling the shaft is your item.
- TOWN engine: `geo.reach` and the bench rim: the land takes over at 230–560 units past `FLOOR`; if your plateau
  colour matches the land's (~#454c48 lit by NW) the cross-fade is invisible.

## Status (builder #4, successor — 2026-11-23 06:30)
- [x] M1 the descent reads as one thing: the mine shrinks INTO the shaft mouth (`MOUTH`, `mouthE`, `descentRings` rewritten,
      `renderBand` rewritten — split mode p ≥ 0.2, scratch only for the faint end). 24-frame strip p 0.85 → 0:
      `screenshots/world-pull-band.png`; sheet `world-pull-sheet.png`. Band now ≈ 22 % of the pull-back (was 9 %).
      Sweep 1.5 → 3.6: mean-luminance steps ≤ 2.7/255, pit-rect/box edges ≤ 4/255.
- [x] M2 framing: `frameAll` = the town plan's extent centred with a margin (0.275), not the 6400×3600 rect. Harness
      preset `watershed` (mine coloured, pit head held, town mostly gray and black) used by the sheets.
- [x] M3 band cost (PERF_CASES band2.0–2.65, 20 reps, load 8–14, delivered medians, world / larger layer):
      2.0 (p .19) 1.41× · 2.2 (p .37) 1.55× · 2.4 (p .56) 1.57× · 2.65 (p .76) 0.98× — all ≤ 1.6× (was 1.76–1.85×).
      Full perf: see run8 below.
- [x] M4 mine in-colour seams cut by the mine's own Void cover (scratch × voidCover²). Seams check before the cut: Void
      max 10/255 (the mine engine had started covering it); after: see run8.
- [x] M5 real AMBIENT through the seams: `world-ambient-pit/lift/band.png` render, zero console errors; nothing broken on
      my side (the cage at the pit mouth, wheels, carts, the band with AMBIENT's mine layers inside the opening).
- [x] M6 stain pass-through measured: pit head held vs unheld, via the world vs the town renderer alone — identical
      (hold 0: chroma 0.2 sat 0.007; hold 1: chroma 9.7 sat 0.196 hue 248, both paths). The weak town stain is TOWN-ART's.
- [x] Owner direction §16 (coordinator, mid-task): the valley zoom (`valley.ts`, `ZOOM_FAR` 0.1, `frameValley`),
      `frameSurface`, the `'sky'` seam with `flash`/`tint` (Void-safe), shots `world-valley-*.png`, `world-surface.png`.
- [x] unit tests `tests/world/descent.test.ts` (8: rings continuous at p = 1, close on the mouth, partition for p ≥ 0.2,
      off at p = 0; pull-back endpoints, monotonic, ≥ 20 % in the band).

- Measured (run8, 06:10–06:29, load 11–14, 30 reps, delivered medians; logs /tmp/p6b/run5–10.log):
  identity max 0/255 at 6 mine views + the town view (valley hidden); sweep steps ≤ 2.7/255; seams: mine Void leak
  max 10/255 at 41 of 23 712 probes (mine/band — the soft edge of the mine's own cover; the scratch cut did not move it,
  see next step 2), town ≤ 1; sky seam: flash + tint light 0 black px at mine/band/town/far.
  Perf world / larger layer: all 1.61× (valley bake pumping — re-measure once baked) · 1.2 0.93 · 1.6 0.92 · band1.8 1.50 ·
  2.0 1.69 · 2.2 1.51 · 2.4 1.85 · 2.65 0.98 · 2.9 0.72 · fit 0.87 · start 1.04 · close15 0.95 (load 14: run3/run-perf
  at load 8 gave 2.0 1.41, 2.2 1.55, 2.4 1.57 — the 1.6× budget is met at moderate load, not at load 14).
  Zoom sweep med 38.7 ms, 10 frames > 100 (max 149, at s 0.34–1.8 = town tile bakes, render ≤ 50 ms); pull-back med 32,
  4 > 100 (max 141).
- Valley void check (zone ground in the town rect must be #000) — run8 FAILED (valley over Void zone cells: the town's
  zones own every cell of its rect) → fixed by an organic blurred hole round the whole rect; run9: 66 / 445 px left
  (the live lights) → live lights now obey the hole too. run10 (06:45): void s 0.1: 8 px at max 1/255, s 0.25–2.6: 0;
  zero console errors.

## Self-grade (builder #4, 2026-11-23 06:40): descent/framing 8/10, valley 5/10 (superseded by theme §6)
1. The valley is the wrong land: theme.md §6 (written while I built it) says no grass, no trees, no human farms — cap-tree
   groves, lichen terraces, the bowl's rim and terraces, the city (cast towers, gold Temple dome), a red war glow past
   the mountains; and "beyond the rim: gray until you reach it". v1 has fields, trees and farms and is always visible.
   It is structurally right (bake, live lights, weight by zoom, Void-safe hole, alpha) — the content must be redrawn.
2. The town sits in a black moat at valley zoom (the hole round the whole town rect). Needed for Void exactness because
   the town's zones own every cell; a per-zone cut (the town fog's `voidCover` + an organic falloff) would let the land
   meet a known block's edge. The town is being re-planned (bowl) — do this against the new plan.
3. Band perf at heavy load: 1.85× at p .56 under load 14 (1.57× at load 8). Mine Void seam leak 10/255 at its soft edge.

## Requests
- (TOWN-ENGINE, new plan) expose the plan's extent and pit/shaft geometry at runtime (`town.plan.extent`, `plan.shaft`,
  `plan.gate`): the world reads `MOUTH`/`TOWN_EXTENT` from constants today (coords.ts / index.ts) — they must follow
  the new bowl. Also a soft "known ground" mask (seen, per pixel, extending past the plan's edge) for the valley cut.
- (FINALE) `frameAll` now fits the town plan (0.275, centred on (3062, 1745)); your `far`/`overview` follow it. Below
  scale 0.42 the valley is drawn round the town: set `world.valley.alpha = 0` (or fade it) for the far city shot.
- (WEATHER) use the `'sky'` seam (`host.flash`, `host.tint`, `host.fog`), described in the interface above.
- (mine engine, still open) the bake's banded `getImageData` console warning.

## Next steps (for the successor)
1. Redraw the valley per `docs/theme.md` §5–6 + `docs/refs/region.png` (`src/render/world/valley.ts`, keep its API):
   the bowl's rim and terraces seen from above, lichen terraces and cap-gardens outside, cap-tree groves (teal and amber
   crowns, lit — never lights on black), the road climbing out through the gate to the city (cast towers, one huge
   gold-lit Temple dome) at the far edge, a low red glow and smoke past the mountains at ZOOM_FAR; no tile grid. Decide
   "gray until you reach it" (draw the valley through the Sensed look until the rim block is known; `alpha`/a gray pass).
   Read the town's new plan/bounds at runtime (watch `handoffs/P6.md`).
2. Mine Void seam leak 10/255: compare `host.fog` (per pixel) with the composite's `voidCover` (soft, coarse) — the
   leak is at their mismatch; either sharpen the cut (voidCover³, or `inactiveMask` destination-in) or accept and
   document. Re-run `checks`.
3. Re-run `perf` at a quieter moment (and once the valley is baked) and the full `everything`
   (`NODE_PATH=/usr/local/lib/node_modules_global flock /tmp/hg-pw-1.lock node e2e/world-shots.cjs everything`, run it in the
   background and wait on it in the foreground with an until-loop: it takes 20–40 min under load).

## Status (builder #3, successor — 2026-11-23 04:10)
- [x] `src/render/world/` — `types.ts`, `coords.ts`, `cameraPath.ts`, `crossing.ts`, `beacons.ts`, `overlay.ts`, `index.ts`;
      tsc clean for these files on arrival (predecessor's last edit was complete).
- [x] harness `dev/world.html` + `src/render/dev/worldHarness.ts` (incl. `&hold=`, `setHold`, `&lift=`, `setLift`); `e2e/world-shots.cjs`
- [x] (predecessor, code on disk) stain pass-through (`localHold`: holdAt world→mine, cross-layer `holdFrom` → seed at the
      cage / pit mouth), lift pass-through, new effect kinds + zoom-out beacons, `hitTest`, `worldToScreen`/`screenToWorld`,
      band cost work (clip to where each layer shows, 256² ring sprites instead of full-screen gradients).
- [x] builder #3: in-colour overlay seams + `host.fog` / `host.inColour` (above).
- [x] run of `everything` (04:11–04:20, load 7–11 on 4 cores; log /tmp/p6b/run1.log): all 39 shots render;
      identity max 0/255 at 5 mine views + town view; void exact (0 non-black far px at s 0.25/0.6/1.2/2.0/2.6);
      descent sweep 1.5→3.6: mean luminance smooth (largest step 3.5/255 between 37 steps), pit-rect/box edges ≤ 4.1/255
      (that is town art at p = 0), mine renderer alone at its rect edge max 0. Run failed only on a FOREIGN console
      warning (mine bake's banded `getImageData`, see Requests) — script now reports it separately.
- perf (delivered, median of 30, load ≈ 8): outside the band ≤ +3 ms ✓ (all 0.98×; close15 +2.8 ms); band ratio
      vs the larger layer: s 2.0 1.21×, 2.2 1.77×, 2.4 1.77×, 2.65 1.36×, 2.9 0.76× — over 1.6× at p 0.35–0.6 because
      both layers are really drawn there (world ≈ mine + town + 4 ms). Zoom sweep 0.25→15→0.25: median 34 ms,
      2 frames > 100 ms (max 137); pull-back: median 29, max 86, 0 hitches. Scratch 5.5 MB.
- [x] builder #3: band clips are now ellipses (town not drawn inside the covered core; mine not drawn beyond its ring).
      Measured after (run4 04:45–04:59, load 10–12, 20 reps; /tmp/p6b/run4.log) — world/larger layer:
      s 1.6 1.00× · 1.8 0.99× · 2.0 1.42× · **2.2 (p .37) 1.85× · 2.4 (p .56) 1.76×** · 2.65 1.10× · 2.9 0.55× · 3.15 0.51×
      · fit 0.59× · start 0.79× · close15 0.82× (run3, load 6–9, 20 reps: 2.0 1.37×, 2.2 1.61×, 2.4 1.71×, 2.65 1.24×).
      **Still over 1.6× at p 0.35–0.6** (world ≈ mine + town + 4–10 ms). Zoom sweep 0.25→15→0.25: median 30 ms, max 76,
      0 frames > 100 ms; pull-back median 23, max 68, 0 > 100 ms (run1 had 2 sweep frames > 100 at load 11).
      Cheapest fix: render the mine into the scratch at half resolution while its ring weight < ~0.7 (faint, moving).
- [x] seams check (run4): mine Sensed stays gray (chroma ≤ 7), town Void leak ≤ 3/255; mine Void NOT covered (see caveat).
- [x] stain link (run3): hold 0 → 0 at the gate; 0.25 → colour 1.0 at the pit mouth / cage, 0 at the far side of the pit
      head; 1 → 0.26 at its far corner (soft edge to Void). The lift area visibly grows from the cage (row 2 of the sheet);
      the town row is hard to read because the night town's colour vs gray is subtle (town art/stain, not the link).
- [x] builder #3: `e2e/world-shots.cjs` — identity adds the cutscene hand-over pose (P7: x 1235, y 701.5, s 1.3757);
      `checks` adds `seams` (an in-colour white sheet: Void stays #000, Sensed stays gray, at mine/band/town/far);
      new `stainlink` → `screenshots/world-stain-link.png` (pit head + lift Sensed, hold 0→1, colour from the gate) with
      gate-vs-far-side numbers; `PERF_CASES=a,b PERF_REPS=n` to measure a subset; harness `&ambient=1` attaches the real AMBIENT.
- [x] DECISIONS `### P6b — World composition` (appended)

## Requests
- (to the mine engine) cover in-colour seam content over Void in the composite (as the town does), or confirm the rule
  "seam callers weight by active × edge" is permanent — then the world's in-colour seams stay documented as above.
- (to the mine engine, `src/render/mine/index.ts` ≈ line 395) the bake's banded `getImageData` on a context made with
  `willReadFrequently: false` makes Chrome print "Multiple readback operations using getImageData are faster with the
  willReadFrequently attribute set to true" once per page load (a console warning on every page that bakes the mine).
  Read it in one call, or use a `willReadFrequently: true` copy for the readback.

## Self-grade (builder #3, 2026-11-23 05:00): 7/10
Evidence: `screenshots/world-*.png` (39 shots), `world-pull-sheet.png`, `world-stain-link.png`, `world-identity.png`; logs /tmp/p6b/run1–4.log.
Three worst things a hostile critic would say:
1. The band costs 1.76–1.85× the larger layer at p 0.37–0.56 (brief: 1.6×). Done: elliptic clips (small gain). Next: half-res mine in the scratch while faint.
2. The in-colour seams leak over Void in the mine (the mine's composite does not cover seam content there). Done: measured,
   documented the rule (weight by `host.fog().colour`), requested a fix from the mine engine. Not fixed in the world.
3. Pull-back frame t≈0.45 (p 0.43) shows the bright mine cutaway floating in a dark oval on a still-visible surface; the switch
   from "mine in a hole" to "the pit as a glowing oval" happens within ~0.1 of the path. It reads as a descent, but it is the
   weakest frame of the sheet. Also: the lift cage moves only with AMBIENT attached (`&ambient=1`), never in the bare world.

## Known issues
- Band 1.76–1.85× the larger layer at p 0.37–0.56 (target 1.6×).
- In-colour seams: mine Void not covered (caller must weight by `host.fog().colour` in the mine).
- Foreign console warning on every page that bakes the mine (mine engine readback; requested; the e2e reports it separately).
- `routing` check: `personAtScreen` 12 px above a miner's feet misses at band scale (figures are ~10 px tall there) — the
  check's probe offset, not a routing fault; the dominant layer is right at all three zooms.

## Next steps
1. Band perf: half-res mine in the scratch while `rings.mine` weight < ~0.7 (keep full res in the core); re-measure
   `PERF_CASES=band2.0,band2.2,band2.4,band2.65 PERF_REPS=20` and the full `perf` (sweeps, `slow` frames list).
2. Mine Void under in-colour seams: either the mine engine covers it (request) or the world multiplies the mine's in-colour
   overlays by the mine's seen×edge mask (draw them into a scratch, `destination-in` with the mask, composite) — only if the request is refused.
3. Look at `dev/world.html?preset=mid&ambient=1&focus=pit&zoom=1.6&cy=1330&lift=cycle` (the real AMBIENT through the seams) and add a shot.
4. Full run: `NODE_PATH=/usr/local/lib/node_modules_global flock /tmp/hg-pw-1.lock node e2e/world-shots.cjs everything`
   (≈ 10 min; run it in the foreground).

## Requests from FINALE (round 3, 2026-11-23 10:10) — the ending now uses your `CITY` / `MAIN_ROAD` / `valley.reveal*`
FINALE's own city is gone; the ending flies up `MAIN_ROAD` (scale 0.8 → 0.115) to a framing of `CITY` at scale ≈ 0.21–0.25
and lights it (gold over the dome, a red war glow on the horizon past the mountains, violet walkers stopping at the first
waystation at 0.24 of the road). Three small asks, in order of value:
1. **Bigger city.** The brief (scope 6) wants it "far bigger than anything so far"; today `CITY_R` 1500 makes it ~3000 units
   wide, smaller than the town's ~5300. Please raise it to ≈ 3500–4000 (the dome and towers scaled with it), moving
   `CITY` further up/right if the basin needs room. FINALE reads `CITY`/`CITY_R` live — nothing to change on my side.
2. **`valley.revealCity` (0..1, additive):** colour only the city's basin (and the war glow), leaving the rest of the
   revealed land gray — so the ending can show "the road climbs through the grey" to a city in colour. Today
   `revealColour` colours radially from the town, so the whole land takes colour with the city.
3. (nice to have) the city's lamps a little brighter at night (`dayT` ≥ 0.9): the ending arrives at night and WRITING's
   line calls them "a second sky".
