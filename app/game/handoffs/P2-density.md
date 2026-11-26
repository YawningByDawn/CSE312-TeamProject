# P2 round 3 — chamber content & density (builder: density half)

Owns: `src/render/art/props2.ts` (new), `src/render/mine/dressing.ts`, prop/people spot data + POOLS in `src/render/mine/layout.ts`.
Scratch: `/tmp/p2d` (shot.cjs = crop at world x,y,zoom via port 5202; map.cjs = ASCII floor map of a bbox).

## Done
- props2.ts: helpers (box, rivet, ropeLine, chain, drawSmoke, ripples, post), sump props (drawPipe, drawPumpWorks, drawTrough, drawDuckboard, drawMooringPost, drawPunt, drawSunkBarrel, drawStalactites, drawStalagmites, drawFungusBed, drawHiddenCache), kiln props (drawBrickFan, drawShrineSteps, drawPrayerMat, drawOfferingBowl, votiveFlames/drawVotives, drawCenser, drawHangingCenser, drawOfferingTable/offeringTableFlames, drawJar), drawRopeCoil.
- Sump (#5): plank bridge removed; pump + pipes + trough + buckets; duckboard across the bog between the two big pools to the south ledge; hidden cache (half-buried chest) at the duckboard's end; moored punt + mooring posts; half-sunk barrel; drip ripples; stalactites on the north face + stalagmites; pale fungus beds at the water's edge; water lights on the pool centres; all spots dry. Fallback lattice spots now also skip pools (`wetAt`).
- Kiln shrine (#6): shrine set 30 units forward into a wider rock outcrop on a 3-step carved dais; kiln-brick fan radiating from it with soot near the flame; offering table on the aisle; standing + hanging censers with baked smoke; 8 votive clusters (animated candle flames); offering bowls on the treads; 3 rows of prayer mats either side of an aisle; jars; broad gold floor wash light (in dressing).

- Overseer (#6): drawTallyWall, drawQuotaBoard (easel), drawLedgerDesk (+ drawStool), steel-blue lamp moved over the desk, drawIronChest, drawWeighScale (crystal on the pan), drawTallyCrate stacks, drawStaffRack, drawBarrierGate (raised boom) + drawBoomRest at the road to the lift. Stale `block(1170,225)` removed.
- Lift (#6): drawWinch with a hoist cable (late drawable) up to the sheave, drawCounterweights, drawLoadingDeck with crates, drawRopeCoil, drawSignalBell, two full carts queued on the spur.
- East Workings (#6): drawScaffold at the face, drawChute to a heap, drawToolRack, drawOreHeap ×3, drawSplitBoulder (wedges), drawHookLantern ×2, drawWaterBarrel ×2, a parked empty cart, crates; dig spots on/at the face.
- Bunks: drawBunk (frame, ticking, folded blanket, pillow, bundle, mug) ×7, drawColdBrazier, drawWashTrough, drawClothesLine, lamp over the middle.

- Heart Vein (#7): diggers placed 24 units beside a specific crystal cluster and turned toward it via `spot.face`; shard heap, sacks, rope coil, water barrel, hook lanterns.
- Pass over the other zones (#8): Cartway — points lever (drawSwitchLever) beside the junction with a haul spot on it, junction signpost (drawSignpost), spare cart wheels (drawCartWheel), spare rail stack (drawRailStack), ore heap. West Drift — sacks/crate, water barrel, rope coil, ore heap, hook lanterns. Low Gallery — rail stack, sleeper stack, ore heap, an empty cart off the rails with a spare wheel, tool rack, hook lanterns. Sorting — Tally crates by the lift spur, sacks + bucket. Kiln lower floor — brick stacks (drawBrickStack), cold brazier, ash bucket. The Hollow is deliberately left alone (focal point).
- Sump stalactites were tried and removed: hung from the wall lip they read as teeth on Heart Vein's south rim. Stalagmites + drip rings at the wall foot remain.
- `Dressing.smokes: Pt[]` (new, additive): mouths of the 4 Kiln censers, for optional drifting smoke.
- Measured: props add ~200 ms to the async bake (brick fan 17 ms is the largest); 297 drawables, 71 flames (≈45 new votive candle flames), 87 lights. Zero console errors in every harness run.

## Decisions to merge into DECISIONS.md (P2 — Mine render, round 3 density)
- Dense dressing lives in `art/props2.ts` (same language as props.ts: lit base + shadow side + lit edge from `lightAt`, contact shadow, heavy ink outline, thinner interior lines, construction/wear detail).
- Kiln shrine is set 30 units forward of the north wall in a wider outcrop on a 3-step dais; a kiln-brick fan radiates from it (soot near the flame); mats kneel toward it in rows either side of an aisle; an extra broad gold floor light (r 300, 0.7) pools over the fan.
- Votive candle layout is seeded from the cluster's position (`votiveFlames`) so dressing knows every animated candle flame without drawing.
- Sump: pump on the east pool's bank → pipe → trough; a duckboard over the bog between the two big pools links the north floor to the south ledge, where the hidden cache (§6) is half-buried. Only the punt, the mooring posts and a half-sunk barrel are in the water, by design.
- Every worker spot is hand-placed beside the thing its role works (face set toward it); fallback lattice spots skip pools.

## Next
- Optional: a critic pass at zoom 2 on each chamber; screenshots for `/screenshots` are the other builder's job (e2e/mine-shots.cjs).

## Requests (for the other builder / orchestrator)
- (optional) Animate drifting smoke from `dress.smokes` in the emissive pass; the censers already have baked static smoke, so this is a polish item.
- A dark bluish rectangular slab is visible in the Kiln Shrine at about world (342, 783), and similar ones in East Workings (~1960, 600) and Heart Vein. They do not come from dressing.ts; they look like bake-side ground puddles/plank pads (`bake.ts` GROUND). Worth a look by whoever owns bake.ts.
- DECISIONS.md: merge the section above (I was told not to edit DECISIONS.md).
