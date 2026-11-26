# Brief — P6a round 2: town renderer fixes

Handoff/log: `handoffs/P6.md`. Port **5206** (`e2e/town-shots.cjs` runs its own server and stubs HMR). Scratch `/tmp/p6r2/`.
Read: `DECISIONS.md` §7, §13.1–13.3, §13.8–13.9 and `### P6 — Town render`; `handoffs/P6.md`; **`handoffs/P6-critic-r1.md`** (blind critic 6/10 — the work order: all Blocking and Major, then Minor).

## Priorities
1. **World edge:** no non-Void pixel ends on a straight line. Fade ground/buildings/light to black organically well inside the world bounds; keep the Keep, the wall and the **gate** comfortably inside; the road to the city visibly leaves **through the gate** into darkness; the wall reads as a wall along the Keep with the gate in it. Prove with a straight-edge detector at several zooms/positions including camera overscroll.
2. **Real frame cost:** measure delivered frames against a blank-canvas control; cut the ~240 draws / ~14 screens of blit per frame (cached composites redrawn on change, viewport culling, few sprites for live lights), spread tile bakes (no frame > 50 ms), slice startup finer (no task > 50 ms). Targets: idle delivered frame within 1.5× the control; pan/zoom/fade `render()` median ≤ 12 ms; no hitch > 50 ms in a 180-frame pan or zoom sweep.
3. **LOD and crowds:** cross-fade tile levels (no pop at zoom 0.75); pre-warm tiles ahead of a pan; crowd members/positions stable across zoom; far-zoom crowd glow matches the real footprint and scales with headcount; groups spread so 8 vs 30 reads.
4. **Sensed vs Active:** Sensed neutral gray and ≈ 0.6× the luminance of the same ground when Active, per block, every preset.
5. **Readability at town scale:** individual effects (convert, convertFail, evil, death, crystalize, group death) readable at zoom ≤ 0.4; people at far zoom get a signature lamps cannot share (haloed, pulsing crest point sized by headcount; Elites marked); **nothing over heads** (order/apostle marks on the ground); a clear ward visual; unmistakable Elites at zoom 1.
6. Minor: recognisable haul yard; hover wash without straight polygon edges; `settle()` finishes fades to Void; fade without a first-frame step, ramp ≈ 1 s; control veins on the ground only.

## Constraints
- Ground/building **painters stay placeholders** behind `town/painters.ts`; the final ground art comes from the sculpted terrain (`src/render/terrain/`, §13.9). Keep the painter interface stable and terrain-ready (tile rect in, lit image out, async).
- The world composition builder (`src/render/world/**`) uses your public API now (`createTownRenderer`, `preloadTownRenderer`, `createTownRendererAsync`, `townBuildJob`, `pitRect`, `MINE_K`, `TOWN_W`, `TOWN_H`, view types, renderer methods): additive only; keep `pitRect`/`MINE_K` unless unavoidable (then note it at the top of `handoffs/P6.md` under "API changes"). Serve requests addressed to the town in `handoffs/P6b.md`.
- Yours only: `src/render/town/**`, `src/render/art/town*.ts`, `src/render/dev/townHarness.ts`, `dev/town.html`, `e2e/town-shots.cjs`, `screenshots/town-*.png`, `handoffs/P6.md`. Shared modules (`src/render/{fog,effects,particles,lighting,slice,camera}.ts`, `art/{draw,rng,geom,palette,ghelm,props,props2}.ts`) are read-only for you (mine builders are editing them); work around locally and file requests.
- Regenerate all `screenshots/town-*.png`; append `#### Round 2` to the P6 section of `DECISIONS.md`.
