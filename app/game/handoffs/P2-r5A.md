# P2 round 5A — mine art (rock, floors, palette) — running log

Scratch: /tmp/p2r5a (shot.cjs = screenshots via the running dev server on 5201; bake.cjs = sliced bake
timing via preloadMineRenderer; lib.cjs = sprite library + cave-in sheet; geo.cjs = geometry stats).

## Done
- `art/boulders.ts` (new): boulder sprite library (superellipse + noise silhouettes, lit plane, dark
  base, fused bulge, crest, rim light, hatch, ink heavy below), `BoulderLib.stamp` (halo + sprite),
  `drawCaveInHeap` (cave-in), `paintBoulder` (vector, one-off rock).
- `mine/rock.ts` rewritten: `rockReach` (distance field + rock extent), `drawRockBase` (crevice /
  island top + lit rim / outer mass colours, boulder plan: face columns then big→med→small passes),
  `drawRockForms` (rubble skirt, y-sorted stamps, darkness to #000 + alpha). Legacy exports kept.
- `mine/bake.ts`: rock base → floor → rock forms → pools → rails → props; rimGridJob = rockReach.rock;
  GROUND retuned to one teal-earth family; floorStones (embedded stones, cracks, warm trodden earth
  round lights); pebbles use the mine rock colour.
- `art/rockface.ts`: Voronoi removed; `drawOutcrop(Job)` now a boulder cave niche round a dark recess.
- `art/palette.ts`: `PAL.mineRock` added (shared entries untouched).
- `art/props2.ts`: `drawCaveIn(g,x,y,w,rng,fam?,gray?)` for 5B (request #1).
- `mine/layout.ts`: west spur leaves the loop through a trailing switch (request #2).

## Done (successor, session 2)
- `art/boulders.ts`: `paintSlab` + `slabPts` (angular quarried block: chamfered top facets, softened
  corners, near-flat front face, lighter top plane, darker side facet + sparse hatch, cracks, dark foot,
  ink heavy at top silhouette and foot; no filters). Slab class (18 sprites, aspect 0.75–2.65) uses it;
  scree/heaps grayer (`grayTone(variant, 0.45)`).
- `mine/rock.ts`: face planner — single / block-on-block / low-in-front-of-tall, irregular top
  silhouette (some stand 12–26 proud), no flipping; short faces raised to ≈ 56 where rock above has room;
  margin above faces dim and short (0.4·fa³ over 0.45·band) on islands too; coverage above faces
  extended (so 5B's sink does not eat slab tops).
- `art/palette.ts` mineRock: bluer, darker teal (no mint); `bake.ts` GROUND: dark teal-gray floors;
  wear band darker/fainter; rail bed darker; `lightCast` (source-atop tint: ochre round warm lights,
  steel-blue round the Tally lamp).
- Shrine: `rockface.ts` niche of slabs (ochre-leaning stone), arch/pillars/steps (`props.ts`,
  `props2.ts` SHRINE_STONE) darker; eye light 0.45. Remaining glare is 5B's additive light (request #7).
- Overseer: east torch removed (`dressing.ts`), post lit by the steel-blue Tally lamp.
- Scratch: /tmp/p2r5a/alb.cjs = albedo-only dumps (full + crops), shot.cjs = harness shots.

- Cave-in (`drawCaveInHeap`) rebuilt: dark heap mass, tumbled slab blocks, boulders/stones with black
  gaps, splintered beams, grit, dust.
- Bake slicing: `bakeAlbedoJob` now flushes after every step (fast-recording band steps used to pile
  their raster cost into the next step: 180–300 ms); wear layer stamped as opaque discs per band
  (wide translucent strokes were ~100 ms); `lightCast` painted at quarter res and laid on in bands;
  finer yields (stamps 80, dark bands 100 u, stones 60, grit 1200, warm per light, floor ink 30 prims,
  groundfill, geometry owner/bfs/walls). Albedo-only worst step 33 ms (canvas alloc) at load 6.5,
  albedo total ≈ 1.84 s; full preload: no slice of mine > 40 ms in the second run (max 74 = 5B lit.tile).
- DECISIONS `#### Round 5A` written.

## Measurements (final, load 6–8 on 4 cores)
- mine-edges (5B tool): mid rim void 1.11 %, full 1.98 % (was 1.75 / 3.12 at session start); void-zone
  black 100 %; zero console errors.
- Luminance (non-black px) full preset fit: p25/50/75/95 = 36/58/91/150 (start of session 42/65/100/157;
  mine.png 36/53/71/117).
- Shrine arch region at zoom 2 still median L 147 — additive light, request #7 to 5B.

## In progress / next
- Nothing required. Possible polish: slab front faces could take more plane breaks at zoom 3; scree
  count at wall feet could thin a little more.
