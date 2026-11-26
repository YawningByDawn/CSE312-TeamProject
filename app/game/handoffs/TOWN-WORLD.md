# TOWN-WORLD — the town as a place, its people as people (2026-11-23)

Branch `worktree-agent-a8165610bc68a15ca`. Commit 1 = 1a58b43 (plan + tests); commit 2 = people (see git log). DECISIONS 34.

## What is true now
- Plan: `src/render/town/townPlan.ts`, hand-laid. 8 districts in crystal order, named streets, 35 place buildings for 39 town places (rows, highhouses, templesteps, road are streets), 64 numbered home slots. `assignHomes()` gives every household a home in its own district (40 seeds, none homeless); unused slots are hidden. Overlaps 0, doors off street/yard 0, off walkable ground 0. Trees only in gardens, yards, edge.
- Diagram: `dev/townplan.html` (`drawTownDiagram`), proof `screenshots/townworld-plan.png`.
- People: `src/render/town/folk.ts` (TownFolk, pure in plan time t), `folkLayer.ts` (in-frame draw list, hit test). Each person is one ghelm figure at the place their living plan gives for that hour; walks follow named streets with lanes. Out of frame = not drawn. No rings/beacons/specks/seal/markers (all deleted from `render/town/index.ts`).
- Occupancy rule: inside = not drawn; building shows a door glow (stronger at night), lit windows at night only if occupied, hearth smoke for homes and smoky trades; `town.occupancy()` is the sound hook.
- Shade stage: `scenes/play/shade/folk.ts` replaces `life.ts` (deleted). Day = 24 s, dusk then night continue the same people. Crowds map to living members by zone + trade + kin. Picking: figure -> person (or its crowd/sim unit), building -> place; the panel head shows name · trade · home · doing, or building · who is inside.
- Perf: town sizes draw from a per-person sprite bank (`folkSprites.ts`); steady drawFolk 0.7 ms / 178 figures. perf-check medians before→after, same load: z0.5 night 30.1→12.6, z1 night 31.6→21.0, z0.5 day 79.4→52.3, z1 day 19.3→11.3 (load ~30; an earlier pair at load ~18 had z0.5 day 12.2→14.8 before the paint budget was cut).
- Tests: `tests/town-world/plan.test.ts`, `tests/town-world/folk.test.ts` (positions at 8 hours walkable or indoors, purity, homes).

## Known gaps (for the next town piece)
- Lanes on the west terrace are not drawn (`render/town/art/rock.ts`, not mine).
- Figures read pale/small at the default whole-town zoom (art).
- A phase change rebuilds TownFolk: 100–470 ms hitch at day/night switch. Could precompute on a worker or cache per day key.
- Only the Shade stage calls `setFolk`; the watershed reveal shows an empty town.
- Night crowds: about 80 people outdoors at t=1.25; most are home.
