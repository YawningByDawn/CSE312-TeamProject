# Brief — P2T round 3: sculpted lit terrain (the chosen base for ground art)

Handoff/log: `handoffs/P2-terrain.md`. Port **5208**. Scratch `/tmp/p2t3/`.
Read: `handoffs/ART-REFERENCE.md` (binding reading of `docs/refs/mine.png`, crops in `handoffs/ref/` — look at them), `handoffs/P2T-critic-r2.md` (blind critic 3/10 with the orchestrator's corrections — the work order), the `### P2T` section + `#### Round 2` in `DECISIONS.md`.
Owner's verdict (DECISIONS §13.9): "the sculpted terrain is better fundamentally but lacks the detail and the polish relative to the ref image." This approach is the base; the gap to close is **detail and polish**, plus the bake cost.

## Work
1. **Wall faces = slab cliff faces** (ART-REFERENCE §1): continuous faces of big chunky slabs/blocks on north sides, wrapping down west/east sides and dying out toward the south; nothing on south sides. Scree only at wall feet. A real deep **shrine niche** modelled by gold light.
2. **Secondary detail on every form:** plane breaks, chipped corners, short crack lines, sparse hatch on shadow sides, varied ink weight, small ledges and overhang shadows, scree with contact shadows, damp streaks where fitting. Nothing procedural-uniform: vary size, spacing, density; leave rest areas.
3. **No rim, halo or glow anywhere** (outer contour, islands, pools, south edges). Script that proves outward luminance falls monotonically after the ink line on all sides; numbers in the report.
4. **Rock tops** (§2): narrow uneven dark-teal margin with lip detail and crack ticks, fading smoothly to near-black; exact `#000` outside.
5. **Floors** (§4): calm dark teal-gray, fine-grain finish (subtle mottling, faint cracks, sparse stones with contact shadows near walls, wear along walking routes, darker margins at wall feet, darker bed under rails); warm brown-ochre only inside warm light. No confetti, crazy-paving, camouflage blotches or coloured airbrushed ellipses.
6. **Light/palette** (§5): light models the slabs; lit rock/floor shifts to muted gold-ochre (saturation ≈ 0.1–0.25), never lime; readable falloff, not a blurred disc. Match the reference's balance (non-black pixels: teal ≈ 29 %, neutral gray ≈ 46 %, mean saturation ≈ 0.25, p90 luminance ≈ 99) and report yours.
7. **Pools:** dark still water in the floor with an inked bank; no glow.
8. **Cost (blocker for adoption):** whole-mine bake ≤ 6 s wall on this machine at the shipped resolution; no main-thread task > 50 ms (no synchronous 4564×2852 canvas allocations; no `form` layer by default; lazy/chunked or `ImageBitmap` transfer); peak ≤ 120 MB. Rethink as needed (shade at 1 px/unit + crisp vector ink at 2 px/unit; analytic slab normals; tiles + cache). If unreachable, say so with a profile.
9. API (`bakeTerrain`, `mineTerrainSpec`, `TerrainBake`, `lightFlickerDelta`) backward compatible; generic enough for the town (spec of floors/rock/lights in, lit image out, per tile).

## Ownership
Yours only: `src/render/terrain/**`, `src/render/dev/terrainHarness.ts`, `dev/terrain.html`, `e2e/terrain-shots.cjs`, `screenshots/terrain-*.png`, `handoffs/P2-terrain.md`.

## Deliverables
All `screenshots/terrain-*.png` regenerated, plus `terrain-north-wall-z3.png`, `terrain-south-edge-z3.png`, `terrain-island-z3.png`, `terrain-shrine-z2.png`, and two same-scale side-by-sides with the reference: `terrain-vs-ref-wall.png` (a wall + floor area) and `terrain-vs-ref-shrine.png`. Ask of each: would this pass as a crop of `mine.png`? Append `#### Round 3` under P2T in `DECISIONS.md`. Report palette statistics, boundary profiles, bake time / longest task / memory with load, and an honest score.
