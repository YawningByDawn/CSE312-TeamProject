# Terrain (track A) critic r2: 3/10 — defect list, with the orchestrator's corrections

Evidence under `/tmp/terrain-critic-r2/shots/` (82 shots; most telling: `p_north.png`, `pc_overseer.png`, `pz_shrine.png`, `z2_south_s.png`, `z2_island_small_s.png`, `z3_north_c.png`, `z3_litrim_c.png`); scripts `run1.cjs`, `shoot.cjs`, `prof.cjs`; profiler output `prof2.txt`.

**Read `handoffs/ART-REFERENCE.md` first.** Where this list and that reading disagree, the reading wins. Corrections are marked ⟶.

## Blocking
1. **Glow halo on all four outer rock→black edges** (owner's hard rule). Luminance going outward: floor ≈60 → ink 16 → **teal rim 50** → decaying glow 19, 16, 14, 11, 8, 5, 3, 1, 0. Glow width at zoom 2: S 46 px, N 37, W 36, E 34 (up to 65). Colour ≈ RGB(8,22,25).
2. **Bright rim band where island meets floor and around pools:** floor 58 → shadow 42 → ink 16 → **rim 64–70** (≈6 px, 2.3× the interior) → interior 28. Pools carry the same teal lip.
3. **Island tops are dead-flat fills:** RGB(11,32,35), standard deviation 0.09. They read as holes or water.
   ⟶ The fix is NOT a textured plateau: a narrow uneven dark-teal margin with a subtle lip and a few crack ticks, fading smoothly to near-black inward (ART-REFERENCE §2).
4. **Rock is a row of beads or teeth:** one row of similar-sized, separately inked rounded stones (15–30 units each) on a smooth airbrushed backing (0→16 over ~100 px). The reference builds wall faces from large forms of 60–120 units.
   ⟶ Big chunky slabs/blocks forming a continuous cliff face, about two figures tall; no visible backing (ART-REFERENCE §1).
5. **"No walls along most of the outer boundary"** (south, east, west).
   ⟶ Partly wrong. The south side of a floor has no wall face in the reference. What is right: wall faces must wrap from the north down the west/east sides, tapering toward the south; and the **shrine alcove needs a real rock mass** — a deep niche of slabs lit gold — for the shrine to sit in.
6. **Main-thread long tasks of 300–460 ms from the terrain code:** `src/render/terrain/index.ts` synchronously creates two 4564×2852 canvases and clears them, 50 ms and 400 ms after the bake starts (328/161 ms and 418/312 ms measured). Geometry/dressing adds 205–309 ms more (not terrain code, but the harness path).

## Major
7. **Lit rock turns lime:** hue 75–77, saturation 0.33–0.41, up to RGB(186,202,136). Reference rock near fire is muted (teal with warm tint → gold-ochre, saturation 0.1–0.2). Lit boulders carry dark teal blotches unrelated to form.
8. **Floor reads as masonry** under the north wall (polygon crazy-paving at cx 1530, cy 140) with a hard seam against the tan floor.
9. **Floor light is airbrushed:** purple and warm pools are soft blurred ellipses; the shrine floor has a two-tone camouflage blotch texture.
10. **Palette (non-black pixels vs `mine.png`):** teal 47.5 % vs 28.7 %; neutral gray 20.4 % vs 46.3 %; mean saturation 0.34 vs 0.25; 90th-percentile luminance 80 vs 99. Too teal and saturated; lacks neutral stone and bright highlights.
11. **Rails get almost nothing from the terrain:** only two faint ruts; no ballast bed visible at zoom 2–3.
12. **Bake 30–55 s wall** under load (median 36.6 s; `shade` stage 21–44 s). Too long at game start unless cached or pre-baked. The `form` canvas (52 MB) is allocated by default. Peak 259 MB, canvases 107 MB.

## Minor
13. Uniform pebble confetti over every floor (reads as beads). Reference stones are sparse, gray, near walls.
14. Pools are simple dark ellipses with faint ripples and a cyan airbrushed glow.
15. With `props=1` the floor's baked light pools vanish in places (1400,200: RGB(68,66,87) → (27,24,37)); the shrine's prop masonry stands in for rock the terrain should supply.

## Good
Zero console errors; worker bake, deterministic; ink crisp at zoom 2 (acceptable at 3); void outside the halo exactly `#000`; no straight or stepped outline edges; tidy at fit zoom; easy harness.

## Orchestrator's direction for round 3
- Structure stays (faces on north sides, dark tops, inked south contours). Replace bean lumps with slab cliff faces; kill every rim/halo/glow; rock-top fade; calm dark teal-gray floors with sparse stones; gold-ochre light; real shrine niche.
- **Bake cost is a blocker for adoption:** target ≤ 6 s wall for the whole mine on this machine at the shipped resolution, no main-thread task > 50 ms, ≤ 120 MB peak. Options: bake at 1 px/unit and upscale only the ink layer; tile + cache; drop per-pixel work that the eye cannot see (wide shadow kernels); do not allocate `form`; transfer `ImageBitmap`s from workers. If the per-pixel approach cannot get there, say so plainly with numbers.
