# Renderer contract — the stain (partial colour by Hold) and the living day (DECISIONS §14)

Applies to the mine renderer (`src/render/mine/**`, `src/render/fog.ts` — engine builder), the town renderer (`src/render/town/**`), the world composition (`src/render/world/**`) and the people module (`src/render/people/**`). Additive to the existing view types; old fields keep working.

## 1. Partial colour
- `ZoneView.hold?: number` (0–1) and `ZoneView.holdFrom?: string[]` (ids of neighbouring zones the colour comes in from; empty = from the grave / from followers standing there) and `ZoneView.holdAt?: { x: number; y: number }[]` (optional extra seed points in world units, e.g. where followers spend their time).
- Meaning: `visibility: 'active'` = fully coloured (as today). `visibility: 'sensed'` with `hold > 0` = **that share of the area's ground is in full colour**, the rest gray. The coloured part grows organically from the mouths shared with `holdFrom` zones and from `holdAt` points (order cells by geodesic distance from those seeds, perturbed by noise; reveal the cells whose order ≤ hold). `visibility: 'void'` ignores hold.
- The front is alive: thin violet veins and a slow shimmer run a little ahead of the colour; **no band, rim, halo or straight/stepped edge** (owner's rule) — the colour→gray transition uses the same soft organic falloff as Active→Sensed today.
- When `hold` changes between frames/views, the front **creeps** to the new position over about 1.5–2.5 s (ease-out), forward or backward. Many zones may change at once (dawn).
- Rooted (`hold = 1`, `visibility: 'active'`, `control` high): veins settle into the ground as today's control veins.
- Cost: recomputing the order field for a zone happens only when its seeds change, off the frame (sliced); advancing the front is cheap (threshold on a baked order texture/mask).
- Harness: `&hold=<zoneId>:0.35,<zoneId>:0.8` and `__mine.setHold({ id: v })` (and the town/world equivalents) for testing; a shot `*-stain-steps.png` showing 0, 0.25, 0.5, 0.75, 1 of one area, and a frame strip of a creep.

## 2. The living day
- People: `PersonView.task`, `.react`, and movement between zones are shown by the people module (walk routes, lift rides: a figure walks to the lift cage, the cage goes up/down, it appears at the other end). The renderers must let people cross zone borders and the mine↔town link without popping.
- `EffectRequest` additions (kinds): `ripple` (colour ripple at a person when they turn), `bell`, `discover` (a reveal flourish in an area), `mark` (a brief result mark at a person's feet with a small glyph id). Old kinds stay.
- A lift that visibly moves (cage, cable, wheel at the pit head) driven by `WorldView.lift?: { pos: number }` or an effect; carts rolling on the rails as ambient life (cosmetic, deterministic from time).

## 3. Zoom
- The world renderer must allow the full zoom range at any time, from turn 1 (before any town block is seen the town is black with the pit's glow; blocks appear gray/coloured as the view says).
