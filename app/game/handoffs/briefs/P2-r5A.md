# Brief — P2 round 5A: mine art in the vector bake (rock, floors, palette)

Handoff/log: `handoffs/P2-r5A.md`. Shared request file with 5B: `handoffs/P2-r5-requests.md`. Port **5201**. Scratch `/tmp/p2r5a/`.
Work order: `handoffs/P2-critic-r3.md` (blind critic 5/10) **as corrected by `handoffs/ART-REFERENCE.md`** (binding reading of `mine.png`; where they disagree, ART-REFERENCE wins — in particular: no walls on south sides, wall faces are slab cliff faces not round boulders, rock tops fade to near-black).
Status of this track (DECISIONS §13.9): the owner chose the sculpted terrain (`src/render/terrain/`) as the base for ground art. This vector rock is the comparison and the fallback, and must leave the mine looking coherent (the game ships with it until the terrain is integrated). Props, dressing, palette, cave-in and bloom work are kept either way. Finish the round; do not gold-plate.

## Work
1. **Wall faces** on the north side of floors, wrapping down west/east sides: tall cliff faces of big chunky slabs/blocks (angular, softened corners, varied widths ~1–2 figures, ~2 figures tall, near-flat tone with lighter top plane and darker foot, dark gaps, firm ink, heavier at top silhouette and foot). Round stones only as scree at wall feet and in heaps. The boulder sprite library already built (`art/boulders.ts`) serves scree/heaps/cave-in; re-shape or add slab sprites for faces. South sides: inked contour + thin lip only.
2. **Rock tops / islands:** narrow uneven dark-teal margin fading smoothly to near-black; exact `#000` beyond. No lighter rim band, no glow; outward luminance falls monotonically after the ink line.
3. **Shrine:** a deep slab niche lit muted gold-ochre (not a blown-out lit wall, not lime). Overseer's post reads cold steel-blue.
4. **Floors:** calm dark teal-gray, low contrast soft mottling, faint cracks, sparse gray stones near walls, darker bed under rails, darker margins at wall feet; warm brown-ochre only inside warm light. No pebble confetti, flagstone crazy-paving, bare flat expanses or mauve/lavender wash.
5. **Cave-in** (blocked flag): a convincing fall of big and small rocks with dust and broken timber. **Bloom** state clearly distinguishable from the normal crystal gallery at default zoom.
6. **Bake cost:** total sliced bake ≤ ~3 s on this machine, worst slice ≤ 30 ms; texture memory must not grow.
7. Rock forms large relative to figures (a slab 1–2 figures wide).

## Ownership
Yours: `src/render/art/{rockface,boulders,palette,props,props2,draw,geom}.ts`, `src/render/mine/{rock,bake,geometry,layout,dressing}.ts`, new files under `src/render/art/` or `src/render/mine/` (not `thread.ts`, not `lit.ts`).
Not yours: `src/render/mine/{index,lit,people,thread}.ts`, `src/render/{fog,lighting,effects,slice,particles,camera,types}.ts`, `art/ghelm.ts`, `dev/mineHarness.ts`, `e2e/mine-*.cjs`, `screenshots/mine-*.png` (5B's), `src/render/{terrain,town,world}/**`, everything outside `src/render`. Keep every export other files import.

## Method
Harness `dev/mine.html` (`?preset=start|early|mid|full|allsensed&zoom=&focus=<areaId>`; see `src/render/dev/mineHarness.ts`). Compare at fit, 1× and 2–3× against same-scale crops of `mine.png` each iteration; judge against ART-REFERENCE §7. Append `#### Round 5A` under the P2 section of `DECISIONS.md`.
