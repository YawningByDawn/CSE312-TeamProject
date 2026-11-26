# Town renderer critic r1: 6/10 — defect list

Scope of the review: everything except the painterly finish of ground and building bodies (placeholder). Evidence under `/tmp/p6-critic-r1/` (static build on port 5216; scripts `perf.cjs`, `calib*.cjs`, `prof.cjs`, `pop.py`, `spill.py`, `fadet.cjs`, `an.py`, `prof.py`). Zero console errors in ~90 shots, perf runs and a stress test.

## Blocking
1. **Straight world-edge cut on Sensed/Active ground (owner's rule: no straight edges).** Blocks own cells right up to the 6400×3600 world rectangle; where a non-Void block touches the world edge it ends in a hard straight line against black. The camera allows 15 % overscroll (`clampTargets` margin), so players see it — right next to the start (the pit is in the west).
   - `shots/sweep-0.2.png`: left edge x=192 for ~720 px, top y=71–72 for ~700 px, bottom y=791–792 for ~750 px.
   - `zm/fog-start-mid.png` (early, zoom 0.55): x=151 over the full height. `shots/pit-far.png` (start, zoom 0.3): x=241–242 plus a straight top edge. `shots/gate-close.png`: straight black band across the top.
   - Fix: fade every non-Void field to black organically inside the world bounds (noisy world-edge falloff), or clamp the camera to the world.
2. **Real frame cost far over target.** `render()` JS time looks fine but leaves out raster: one frame = 240 `drawImage` calls, ~14 full-screen equivalents of blit area (`prof.cjs`).
   - Idle delivered rAF interval median 52–82 ms at load 15–24 (a blank canvas with a full-screen fill under the same load: 16.7 ms). Long tasks of 50–100 ms every frame.
   - `render()` JS alone: idle median 3.6–4.4 ms (ok); pan 13.9–18.9 ms and zoom sweep 14.2–19.1 ms (miss ≤ 12); fade 4.1–9.1 ms.
   - Hitches > 50 ms per 180-frame pan: 2–23, worst 1876 ms (panZ1) and 365 ms (panZ2); zoom sweep worst 214–267 ms.
   - Startup: the 12 ms-budget preload still produces long tasks of 751, 401, 388, 333, 439 ms; ready in 3.9–10.4 s.

## Major
3. **Hard LOD pop at zoom ≈ 0.750→0.755** (tile level switch): roof patches, doors, fences appear in one step and every outline sharpens at once (scale-compensated frame diff doubles 0.74 → 1.51). `dome-pop.jpg`, `sw-a-pop33.jpg`.
4. **Crowds reshuffle while zooming** (members drawn change at every zoom step 0.75–1.5 → shimmer). Below ~0.4 the stand-in glow dots spread over ~2× the crowd's footprint, then collapse during the cross-fade. `sw-a-pop38-52.jpg`, `crowd-lod.jpg`.
5. **Sensed is not darker than Active**: `slagrows` p50 = 21 Active vs 21 Sensed; `gravefield` 22 vs 21; in `early`, Sensed market/`wellsquare` (27) is brighter than the Active shanties (21). Sensed reads as lighter milky haze and is tinted cool/violet (haul yard median RGB 28/28/36), not gray.
6. **Small effects unreadable at town scale** (zoom 0.35, pixels changed > 30 levels at peak): convert ~300, evil ~170, death ~220, crystalize ~290, group death ~500 (one wisp; the crowd unchanged). Whisper (~3800), miracle (~6900), reveal (~4100) read. Even at zoom 0.9 convert/crystalize/death are tiny flashes.
7. **People indistinguishable from lamps at whole-town zoom:** sparkles in the same hues as street lamps; follower glows lost among violet control lamps; Elites have no far-zoom signature. `cmp-people-far.jpg`.
8. **Gate, wall and road composition:** the gate sits ~40 units from the top world edge and opens onto the black cut-off; the "road to the city" turns sideways along the wall instead of leading out; the wall is two short stubs enclosing nothing; the gate block's anchor area shows only igloos and lamps. `shots/gate-close.png`, `small/z-gate.jpg`, `crop-full-keep.jpg`.
9. **Things float over heads:** order and apostle diamond icons above crowds and individuals (`drawOrderIcon` at `st.y - h - 6k`). Selection ellipse and target ring are correctly on the ground.
10. **Tiles pop in at the screen edge during a fast pan** (building missing at the leading edge, appears later). `sheet-pan.jpg`.

## Minor
11. Ward reads as warm lighting (+3–4 tiny motes), not protection. (Occupied, desecrated, control 0/50/100 read well.)
12. The haul yard isn't recognisable (road crossings, one shed, a cart).
13. Hover wash on a Sensed block follows a long, nearly straight polygon diagonal. `crop-hover.jpg`.
14. `settle()` doesn't finish fades to Void: mottled gray residue (89 % of old Sensed area non-zero, median 8) until `advance(10)`.
15. Fade starts with a step (probe 34.1 → 40.7 in the first 0.05 s, then holds); the ramp is short (~0.25 s).
16. Control veins draw over roofs and the temple wall like lightning cracks.
17. Elites only slightly special (guild master and smuggler boss read as townsfolk with a cloak); groups are tight scrums so headcount (8 vs 30) is hard to read.

## Good (keep)
Void exact (0 non-zero px deeper than 80 px; no spill from flags/hover/select/effects). Organic fog fronts, monotonic ramps, no band/rim/halo; smoky mid-fade dissolve. Districts read by colour and silhouette at mid zoom (violet pit head, orange smelter, gold temple, steel-blue council hall and barracks, graveyard candles, mushroom gardens, market stalls, well, spires). Pit works as a glowing point at every zoom. Allegiance reads at zoom ≥ 1. No labels. Robust.

## The critic's five changes
1. Fade all non-Void ground to black organically inside the world edge; keep the gate and road well inside the world so the road visibly leaves through the gate (or clamp the camera).
2. Cut per-frame full-screen composites (~14 screens of blit, 240 draws): bake static lightmap, sensed layer and fog into fewer cached layers, recomposite only on change; spread tile bakes so no frame exceeds 50 ms; measure delivered frame time (rAF interval or forced flush), not `render()` JS time.
3. Cross-fade between tile LOD levels around zoom 0.75; keep crowd member sets and positions stable across zoom; far-zoom crowd glow matches the crowd's footprint.
4. Sensed clearly darker than Active (~0.6× ground luminance) and neutral gray. People at far zoom get a signature lamps can't share (pulsing/haloed crest point sized by headcount; Elites marked).
5. Scale individual effects so they read at zoom ≤ 0.4 (ground ring, vertical light, lingering mark); move order/apostle icons to the ground under the unit; give the ward a clear visual; make the haul yard identifiable.
