# Brief — AMBIENT: a world that moves by itself (machines, creatures, air, time of day)

Handoff/log: `handoffs/AMBIENT.md`. Port **5224**. Scratch `/tmp/ambient/`.
Read: `DECISIONS.md` §14.1, §14.3, §13.8, §13.1; `docs/refs/mine.png`, `docs/refs/town.png`; `handoffs/ART-REFERENCE.md`; `src/render/mine/layout.ts` + `dressing.ts`, `src/render/town/layout.ts` + `plan.ts` (read-only: rails, pools, lamps, lift, pit head, roads, chimneys, river/well, market, fields, gate); `handoffs/P6b.md` (world coordinates); `handoffs/briefs/STAIN.md` §2.

Even with nobody acting, a still frame of this game must not look still. You own everything that moves that is not a person, an effect of an action, or the terrain itself.

## Build `src/render/ambient/` — `createAmbient(layouts, seed)`; `update(time, state)`; `draw(g, host, layer)`
Host (define in `types.ts`): `{ toScreen, scale, time, visibilityAt(wx, wy), phase: 'night' | 'day', dayT: 0–1, lift: { pos: 0–1, riders }, hold(zoneId) }`; layers `'ground' | 'props' | 'above' | 'grade'`. Everything deterministic from time + seed; Sensed areas show the same motion in dim gray at a lower rate; nothing in Void.
- **Machines:** the lift — cage, cable, counterweight, the winding wheel and engine at the pit head turning with `lift.pos`, gate opening, a lamp on the cage; ore carts rolling along the rails (loaded out, empty back, stopping at loading points, a hauler may push — positions exposed so the life director can attach people); a water pump; bellows and hammers at the smelter; a mill wheel; the temple bell swinging when rung.
- **Mine air and small life:** drips into pools with rings, seeping water sheen, dust motes in lamp cones, lamp and torch flames that breathe and gutter (not a uniform flicker), falling grit, a rat along a wall, bats at the shaft, moths at lamps, crystals that glint in slow waves, steam vents; near the grave: the ground faintly breathing, small things leaning toward it as Hold grows (roots, moss turning violet — tied to `hold`).
- **Town air and small life:** chimney and smelter smoke that drifts with one wind, flags, laundry, awnings, trees and crops moving in gusts, birds (flock wheel over the roofs, crows on the wall), chickens, dogs, a cat, cart and barrow traffic on roads, market awnings; windows lighting at dusk and going dark by ones late at night; street lamps lit by a lamplighter path.
- **Time of day (the surface must change; the mine barely does):** a grade layer for the town — night deep blue-black with warm windows, dawn gold coming over the wall during the Day replay, flat working daylight, dusk — and a faint shaft of daylight down the lift shaft into the mine by day; cloud shadows crossing the town; optional light rain/mist on some days (seeded). No glow/halo at fog edges (owner's rule).
- **Far zoom:** smoke plumes, lit windows, the turning wheel and the cart specks must still read from the whole-town view.
Budget: ≤ 1.5 ms per frame typical; pooled; no per-frame allocation.

## Interface first
Within your first ten tool calls put the exact API and host at the top of your handoff, and list the anchor data you need from each layout (as requests if missing — synthesise sensible defaults meanwhile). The world/mine/town owners call `ambient.draw` through one seam each; until they do, your own harness composites over their public renderers.

## Proof
`dev/ambient.html` + `e2e/ambient-shots.cjs`: 12-frame strips over 6 s of the mine heart, the lift, a rail line, the pit head, the market, the whole town at night → dawn → day → dusk → `screenshots/ambient-*.png`; a number: share of a "nobody acts" frame that changes within 2 s (target: visible motion in every screen-quarter); perf. Look at the strips yourself after every milestone.

## Ownership
Yours only: `src/render/ambient/**`, `dev/ambient.html`, `e2e/ambient-shots.cjs`, `screenshots/ambient-*.png`, `handoffs/AMBIENT.md`. Append `### AMBIENT — Ambient life and time of day` to `DECISIONS.md`.
