# Brief — TOWN-ART: the town's look (ground, buildings, landmarks, props)

Handoff/log: `handoffs/TOWN-ART.md`. Port **5228**. Scratch `/tmp/townart/`.
Read: `docs/refs/town.png` (the target for the town) and `docs/refs/mine.png` (the hand, ink, palette and lighting the whole game must share), `docs/refs/region.png`; `handoffs/ART-REFERENCE.md`; `DECISIONS.md` §13.1–13.3 (one world; Deepwell and its five districts; the Temple "the Flame", the Council "the Crown"), §13.8, §13.9, §14.2; `handoffs/P6.md` (town renderer: layout, plan, tiles, `painters.ts` seam — `ground.paint`, `buildings.paint`; its art is placeholder); `src/render/town/{layout,plan,painters,types}.ts`; `src/render/art/**` (shared painters, palette); `src/render/terrain/**` public API (sculpted terrain, usable for ground relief if it fits the budget).

The town renderer's engineering is being fixed by its own builder; **its art is placeholder. You make the town look like a place from the same game as the mine**: hand-inked, dark, lamp-lit, dense with detail when zoomed in, a clear readable map when zoomed out.

## Build `src/render/town/art/` (pure painters called through the `painters.ts` seam)
1. **Ground:** cobbles, packed dirt, mud at the smelters, plaza paving, fields with furrows, the river/ditch and bridges, slag heaps, the road to the city gate, the pit head's trampled yard; wear paths where people walk; puddles; no tiling repetition visible at any zoom.
2. **Buildings by district (five districts, each recognisable from the whole-town view by roofline, material and colour temperature):** miners' rows (cramped, soot, shared yards), the smelter quarter (kilns, chimneys, slag, ochre glow), the market (stalls, awnings, a hall), the Temple precinct (the Flame: kiln-domed temple, steps, braziers, cloister), the Keep / Council quarter (stone, steel-blue slate, barracks, the hall, the wall and gate). Top-down three-quarter view consistent with the mine's wall faces (north faces visible, roofs readable); doors, windows (lit state at night is a separate cheap layer), chimneys, signs without text.
3. **Landmarks:** the pit head (winding tower, engine house, ore chutes — the link to the mine), the temple, the Council hall, the market cross, the city gate and wall towers, the graveyard, the well.
4. **Props and dressing:** carts, barrels, crates, woodpiles, washing lines, lamps, fences, trees, shrines, notice boards, scaffolds; placed by rules so no two yards look alike.
5. **States:** coloured (Active) and a gray (Sensed) rendition that is clearly darker and desaturated; partial colour by Hold comes from the renderer's stain mask — your art must look right half-gray, half-colour; occupation / lockdown / purge dressing (barricades, banners, pyres) as overlays.
6. **Lighting:** bounded warm lamps and windows, the smelters' ochre, the Temple's kiln-orange, the Council's cold blue; no glow or halo at fog or world edges (owner's rule); rock and roofs fade to near-black away from light as in `mine.png`.
7. **Budget:** fits the town renderer's tile bake (sliced, no task > 50 ms, total bake and memory within what `handoffs/P6.md` states); LOD-aware (a simplified far rendition that keeps district identity).

## Working with the town engine builder
`src/render/town/painters.ts` is the seam and is theirs: you export painter functions from `src/render/town/art/` with the signatures it expects (read it; if a signature must grow, write the exact request in your handoff and build behind an adapter). Your harness renders your painters on your own canvas (district sheets) and, when the town renderer runs, through it.

## Proof and self-grading
`dev/townart.html` + `e2e/townart-shots.cjs`: a sheet per district at zoom 1 and 3, landmarks, the whole town at far zoom, colour vs gray, night vs day (if the atmosphere layer exists), side by side with crops of `town.png` → `screenshots/townart-*.png`. Follow `handoffs/RULES.md` rule 13: after every milestone compare with `town.png`/`mine.png`, score yourself honestly, list what a hostile critic would say, and keep going until ≥ 8.

## Ownership
Yours only: `src/render/town/art/**`, `dev/townart.html`, `e2e/townart-shots.cjs`, `screenshots/townart-*.png`, `handoffs/TOWN-ART.md`. Append `### TOWN-ART — The town's look` to `DECISIONS.md`.
