# Brief — P2 round 5B: mine renderer engine

Handoff/log: `handoffs/P2-r5B.md`. Shared request file with 5A: `handoffs/P2-r5-requests.md`. Port **5202**. Scratch `/tmp/p2r5b/`.
Work order: `handoffs/P2-critic-r3.md` (blind critic 5/10) — everything that is not rock/floor painting. Art reading: `handoffs/ART-REFERENCE.md`.

## Work (acceptance numbers measured on an HMR-free page at 1600×900)
1. **No light outside the rock:** every additive glow, lightmap pass and emissive sprite is limited to (rock ∪ floor) coverage × fog visibility. No lips/halos at eastworks east tip, overseer north wall, top edge near x≈520, bunks west, shrine south-west; the ward's ring never spills over void; no bright candle cluster on the fog gradient. Scanline test (a luminance peak within the first 15 px in from black above 1.25 × inner median + 8) < 1 % of boundary scanlines in every preset — as a committed script (`e2e/mine-edges.cjs`).
2. **Void exactly `#000`:** ≥ 99.5 % of pixels ≥ 30 px inside a void zone in every preset (rails, mips, emissive, people must be gated on fog).
3. **Real render cost:** median delivered frame ≤ 25 ms in `full` at fit zoom (or within 1.5× a blank-canvas control under the same load), pan hitches ≤ 100 ms, fog fade median ≤ 30 ms; `lastRenderMs`/`stats` report flushed cost.
4. **Harness on the async sliced bake** with progress, `?stats=1` (longest task, worst bake slice ≤ 30 ms), centred `zoom=0.3`.
5. **Selectable/hover tint** subtle (≤ ~8 % luminance lift, living), Sensed stays dark gray, zero spill onto void.
6. **Control tint** as creeping veins/tendrils from the god's side; at full control the map is still teal with warm torch pools (no mauve wash).
7. **Nothing over heads:** selection/target/hover/orders as ground marks; allegiance readable by silhouette at default zoom.
8. **Whisper thread effect** clearly visible for its whole duration; `convertFail` clearly different. (Not `mine/thread.ts`.)
9. **Bloom** distinguishable at default zoom; place 5A's cave-in (`drawCaveIn` in `art/props2.ts`) for the blocked flag; shrine not blown out in `mid` at fit zoom.
10. Regenerate all `screenshots/mine-*.png` with `e2e/mine-shots.cjs` at the end (after 5A's handoff says its rock/floor work is in; if 5A is still working, regenerate anyway and say so).

## Ownership
Yours: `src/render/mine/{index,lit,people}.ts`, `src/render/{fog,lighting,effects,slice,particles,camera,types}.ts` (types additive), `src/render/art/ghelm.ts`, `src/render/dev/mineHarness.ts`, `dev/mine.html`, `e2e/mine-shots.cjs`, `e2e/mine-edges.cjs`, `screenshots/mine-*.png`.
Not yours: 5A's files (`art/{rockface,boulders,palette,props,props2,draw,geom}.ts`, `mine/{rock,bake,geometry,layout,dressing}.ts`), `mine/thread.ts`, `src/render/{terrain,town,world}/**`, everything outside `src/render`. The renderer API used by `src/scenes/**`, `src/app/worlds.ts`, `src/render/world/**` and `src/render/town/**` (shared `fog.ts`, `effects.ts`, `particles.ts`, `lighting.ts`, `camera.ts`) stays compatible — additive only; the town and world builders depend on these modules right now.
Append `#### Round 5B` under the P2 section of `DECISIONS.md`.
