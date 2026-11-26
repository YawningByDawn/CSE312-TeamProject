# TOWN-ART — handoff / log

## Round 5 (successor, 2026-11-23 ~10:00) — IN PROGRESS. Read this block first.
**Size range each kind supports (world units; a figure ≈ 24 tall; answers the orchestrator's 10:40 request):**
| kind | w range | notes |
|---|---|---|
| `home.shell` / `home.cast` (every shanty/dome/caphouse/shell/hall) | 48–240 | keeps `it.w` (clamped to 2·min(bb.l, bb.r) − 8); body 66–86 % of w, the rest is lean-to / pod / trade yard; height capped (shell roof ≤ 74, cast upper ≤ 44, depth ≤ 118) and fitted (depth first, then height) into `bb` top; needs `bb` ≥ 0.15·w below the front for porch / stair / step. Neighbours may touch: nothing is drawn outside x ±(w/2 + 4). |
| `stall` | 50–140 | cloth 0.86·w wide, 0.48–0.6·w deep, ~27–33 high (fixed: a figure stands under it) |
| `pen` (sorting / count pens) | 80–160 | fills a w × 0.62·w plot: floor, fence, gate, 3–5 crystal heaps (PROPS) |
| `temple` | 300–420 | carved front 0.6·w, cliff to ±w/2, height 0.8·w |
| places (tally, tavern, forge, …) | plan sizes ±30 % | still shrink-to-fit inside `bb` (measured extents, kwire `fittedKind`) |
The engine takes house light pools from `itemLights(it)` (door hearth, lit windows, cast door lamp, potter's kiln).

**Drawing box (agreed numbers, for P6):** homes no longer shrink to fit. `fittedKind(it)` passes the item's `bb`
as `room` (l, r, up, dn from the front-centre) and the home keeps `it.w` (clamped to 2·min(l, r) − 8) and fits its
**depth and height** into `room.up` instead. Request to P6 (`plan.ts` / `art/townBuild.ts anatomy`): give homes and
halls `bb = { x: x − 0.62·w, y: y − 1.0·w, w: 1.24·w, h: 1.15·w }` (front at y; 0.15·w below the front for the step,
porch and clutter). Today the default `anatomy` box (halls: top = y − h − 20 ≈ −0.6·w) still works — the cast homes
just come out one storey lower; shell homes (shanty/dome, top ≈ −1.05·w) get their two-storey forms.
### Interface additions (additive; rule 12)
```ts
// kinds.ts: KindId += 'home.shell' | 'home.cast'; KindSpec.room?: Room  (homes fit height to it, never width)
// khome.ts
interface Room { l: number; r: number; up: number; dn: number }
homePlan(w, seed, lang: 'shell'|'cast', room?): HomePlan   // pure; body, storey, roof, extras, yard (the trade), door, windows
paintHome(g, F, w, seed, lang, room?): void
homeLights(w, seed, lang, room?): KindLight[]                // lit door, lit windows, cast lamp, potter's kiln
// kmarket.ts
stallPlan(w, seed) / paintStall(g, F, w, seed) / stallLights(w, seed)
// k3.ts: hatchPoly, crack, chip, HATCH.on; outline() now inks the underside heavier; MAT += slate, bleach, ochreRoof, rubble
// kshell.ts: castBlock, cylinder, sagFacets exported; vault/hideHut take noDoor; hideHut takes sag
```
kindForItem: shanty / dome / caphouse / shell → `home.shell`; hall → `home.cast` (72 %) or `home.shell`. Places unchanged.
### Round 5 status (14:40, after the restart) — self-grade 7/10
- Evidence (all 0 console errors): `screenshots/townart-vs-target-pairs.png` (four pairs at the same pixel scale,
  ours | target: plaza, shell block, cast block, Temple; composer `/tmp/townart5/pairs.py`), `townart-homes.png`,
  `townart-places.png` (incl. sorting pen, w200 / w220 homes), `townart-stalls-pens.png`, `townart-street-*.png`,
  `townart-whole-day.png`, `townart-whole-dusk.png`. Shots: `/tmp/townart5/combo.cjs` (one browser, sheet + engine),
  `run2.sh` / `run3.sh`. Lit-pixel luminance: whole day median 63 (q 48–77) — 3 over the §18 aim, the cream cast
  walls are the brightest thing; dusk 44 (33–61); night street 51 (35–71), forms readable.
- Sheet cost: median 2.3 ms per home, max 12 ms (temple / awning sets ~18–30 ms at zoom 2), load 20+.
- Added after 10:15: `pen` fills its plot (floor, fence, gate, 3–5 PROPS crystal heaps / clusters), plan kind `yard`
  → `paintYard` (fenced trade yard), heights capped for wide homes (w up to 240 tested), tent stalls (ridge front
  to back, gable, dark interior with counter and goods).
- Self-grade 7: the homes now differ house to house and match the target's size at equal scale; stalls and the
  Temple read as the target's in kind. A hostile critic would say: (1) the plaza ring and lots still show dark
  fenced yards with little in them at town zoom (yard contents too small — scale them ×1.5); (2) day is a touch
  bright and the cast blocks are pale toy-cream next to the target's dirtier cream; (3) the headframe / winding
  wheel, Keep, tally house, works and tavern are still the round-4 painters (not redrawn this round).
### Next steps (exact)
1. Headframe + winding wheel readable from above at zoom ~1.5: thicker lattice legs (2× ink), a big spoked wheel
   pair on top seen three-quarter, a cage, a rail fan at the foot (kplaces `headframe`, `engine`).
2. Yard contents ×1.5 and denser (khome `yardFront`); cast albedo: `MAT.cast` lit toward '#bcb497' with grime streaks.
3. Keep compound (cast walls, gate, pipes, tanks), tally house + pens row, works vats, tavern in `kgrand.ts`.
4. Delete the dead round-3 modules (organic, hands, masses, grand, landmarks, house, buildings) — first grep: index.ts
   still imports them behind `LEGACY`; remove that import path with them.
### Round 5 status (10:15)
- DONE (code, tsc clean, `tests/townart` 9/9 incl. new `homes.test.ts`): `khome.ts` (homes from parts: 5 shell bodies ×
  storey or not × 7 roof colours × patches / lashing / sag / prop × lean-to / pod × porch × outside stair × vent / flue ×
  water tank × 8 yards that tell the trade; 5 cast bodies with domes, tanks, stacks, rails, pipes, ports, marks),
  `kmarket.ts` (stalls: sagging cloth grid, counter + goods under the front edge, side drops, 8 kinds of goods),
  `kgrand.ts` (Temple: carved front, columns, arch within arch, gold gate, 2 gold figures in niches, frieze, steps,
  braziers, obelisk-lamps), k3 hand (heavier underside ink, hatching on shadow planes, cracks, chips), muted MAT.
- IN PROGRESS: first browser shots (`/tmp/townart5/run1.sh` → homes sheet, places, 4 engine pairs, whole) — the
  machine's browser locks are queued ~20 min deep.
- NEXT: look at the shots; compose `screenshots/townart-vs-target-pairs.png` (`python3 /tmp/townart5/pairs.py out
  e-plaza e-shell e-cast e-temple`); fix what a stranger would spot; then Keep / pit heads / tally+pens / works.


> **FOR P6 #8 (08:05): the "no ordinary building appears" bug was TOWN-ART's, now fixed.** Round 4's `paintItem`
> applied the item's (x, y) twice (ArtBuildings already translates to the item) so every building was painted
> ~2000 units off its tile. Probe on the live plan (seed 1): 10/10 items in a 600×400 rect accepted, 0 rejected;
> every kind / place in the plan maps to a painter (`kindForItem`, kinds.ts); nothing is filtered on block, lot,
> facing or terrace. Vats and the monument are left to the engine (ENGINE_KINDS never reach the inner painter).

## Round 4 (builder r4, 2026-11-23 07:10) — the kinds in the target's hand (DECISIONS §18, docs/refs/town-target.png)
Owns `src/render/town/art/**`, `dev/townart.html`, `dev/townkinds.html`, `e2e/townart-*.cjs`, `screenshots/townart-*.png`.
### Interface (new, additive; rule 12)
```ts
// src/render/town/art/kinds.ts — every thing that stands in the town, one painter per kind, world units
type KindId = 'shell.vault'|'shell.rust'|'shell.red'|'shell.double'|'shell.leanto'|'shell.elder'
  |'cast.cyl'|'cast.block'|'cast.tank'|'cast.pipes'|'cast.stack'|'cave'|'temple'|'awning'|'monument'|'tavern'
  |'tally'|'sorting'|'headframe'|'pit.wall'|'pit.trestle'|'pit.crane'|'pit.rail'|'vats'|'forge'|'gemworks'
  |'apothecary'|'wash'|'beastpen'|'burning'|'keep'|'vault'|'gate'|'guardpost'|'carters'|'captree.teal'|'captree.amber'|'clutter';
interface KindSpec { kind: KindId; x: number; y: number /* front-centre on the ground */; w: number; seed: number; v?: number }
paintKind(g, p: Pen, s: KindSpec, L: BakeLight): void          // albedo (the engine lights/grades it)
kindLights(s: KindSpec): { x: number; y: number; r: number; col: 'hearth'|'shard'|'crystal'|'flame'|'forge' }[]  // emissive accents
paintKindLights(g, s: KindSpec, k: number): void                 // 'lighter' accents: hearth doors, shard lamps, crystal, braziers
kindForItem(it: TownItem): KindSpec                              // plan item → kind (by place, then kind/block)
```

### Round 4 status (09:45) — wired and rendering end to end (owner §19: simple, right in kind and colour)
- Engine shots (dev/town.html, seed 1, preset full): every ordinary home and hall draws; 0 console errors / warnings.
  Lit-pixel median luminance: whole day 49, street day 54–57, dusk 40, night 39 (§18/§19 aim ~53, 37–71).
- Shots: `screenshots/townart-kinds{,-day,-dusk,-night,-gray}.png` (every kind with a wickfolk for scale),
  `townart-caps-strip.png` (THEME cap fade over 6 zooms), `townart-whole-{day,dusk,night}.png`,
  `townart-street-{temple,market,pithead-dusk,night}.png`, `townart-pithead.png`, `townart-sensed.png`,
  `townart-vs-target-market.png` (ours | target crop).
- Tests: `tests/townart/kinds.test.ts` (3): every plan home/hall maps to a building kind, every non-engine item
  paints with a finite fitted width and finite lights, every sheet kind paints. tsc clean for src/render/town/art.
- Perf: the whole sheet (~50 kinds) paints in ~190 ms (≈ 4 ms per kind at zoom 1, load ~14); the first use of each
  kind measures its extent once offscreen (800² getImageData).
### Self-grade (09:45): 6/10 — reads as the target's town in kind and colour, not yet in density and detail
1. Houses read small: the plan's widths (72–144) are then shrunk to fit the engine's `bb`; many homes come out
   2–3 figures wide. Fix: P6 grows `bb` (anatomy) to the kinds' measured extents, or TOWN-ART stops shrinking and
   the engine pads tiles; then raise the shells' depth.
2. Market stalls read as flat coloured tiles from above (the awning cloth hides the counter and poles).
3. Detail is thinner than the target (clutter small, few patches / cords per roof, cast houses plain); polish
   paused by §19.
### Next steps (exact)
1. With P6 #8: agree the drawing box (request below), then drop the shrink in `kwire.fittedKind`.
2. Polish once the owner has seen the engine's look: clutter scale ×1.5, more roof patches/lashing, stall
   awnings tilted so the counter shows, Temple idols smaller (kplaces `goldFigure`), cave terrace face in rock
   colours of `rock.ts`, night accents tuned against mine.png.
3. Old round-3 modules (organic/hands/masses/grand/landmarks/house/buildings/facilities dress) are dead code under
   `LEGACY = false`; delete after the owner signs off the new look.
### Requests to the town engine (P6 #8)
- `bb` for houses/halls: our painting needs about x ±0.68·w, y from −1.0·w to +0.15·w (shell elder / tavern up to
  −1.1·w); today it is shrunk to fit. `fittedKind(it)` in kwire.ts shows the measured extents.
- Light pass: `itemLights(it)` gives each building's emissive sources (hearth / shard / crystal / flame / forge).

### Round 4 status (07:50)
- DONE: `k3.ts` (one projection + stepped-plane solid painter + ink + crystals), `kshell.ts` (6 shell houses, 5 cast
  houses, clutter, lean-to, shard lamp, Council mark), `kplaces.ts` (cave terrace, Temple, awnings/stall, monument,
  tavern, tally, sorting pens/pen, headframe, pit wall/trestle/crane/rail, vats/vat, forge, gem workshop, apothecary,
  wash-place, beast pen, burning ground, Keep+vault, gate, guard post, carters' yard, engine house, barracks, small
  pieces: heaps, bench, cart, lamp, brazier, flame bowl, washing line, rack, pod), `kinds.ts` (dispatch, lights,
  `kindForItem`), `kwire.ts` (bb-fitted painting, `itemLights`, `paintItemLights`, canopy, fill restyle),
  `themeprops.ts` = re-exports of THEME's props (cap-trees, lamps, braziers, beasts, carts).
- Wired: `ArtBuildings` paints every plan item through `paintItem` (fitted inside `it.bb`, so no tile seam cuts a
  painting); `paintLitWindows` now draws the kinds' emissive accents; fill.ts lots → yards/heaps/lean-tos only
  (no extra huts). `setLegacyPainters(true)` brings back the round-3 painters for comparison.
- Sheet: `dev/townkinds.html?zoom=1&light=even|day|dusk|night|gray`, `&strip=caps` (cap fade over 6 zooms).
- Owner §19: stop polishing; one decent version of each kind, wired, whole town renders.
### Engine requests (round 4)
- Light pass: per-item emissive sources are `itemLights(it)` (world units, col hearth|shard|crystal|flame|forge) —
  use them for the pools instead of / with `plan.lights`.

## Round 3 (builder r3, 2026-11-23) — IN PROGRESS: the buildings rebuilt to docs/theme.md §5 (three hands)
- New: `art/organic.ts` (mass generator: drum + dominant cap, families, pure geometry `massGeo`/`roofPolys`),
  `art/hands.ts` (theme §5: `vault` shell house, `cast` Council block, `carved` Temple front; `councilMark`, `castLamp`),
  `art/masses.ts` (`builtFor(item, facId)` / `builtForFill` — district → hand/family, wear, facility crowns),
  `art/clutter.ts` (heaps against walls: pots, gourds, baskets, scrap, cord, stalk piles, shard/glow lamps, washing, chalk),
  `art/grand.ts` (landmarks: gate = two round cast towers + barred portal; Keep = stacked cast blocks behind a kerb;
  levy hall; engine house + drum; cast A-frame headframe; Temple cut into a rock outcrop with idols and fire bowls).
- `buildings.ts drawBuilding(..., facId)` routes shanty/dome/caphouse/shell/hall through masses; `fill.ts` huts too;
  `props.ts` lamp posts → bent stalk with a glowing pod / Council lacquer spine with a shard (no rows of lamp posts).
- Harness: ambient raised to `#8890a0` (owner: forms must read), `?sheet=1` family sheet, `?lm=<kind>` centres a landmark.


## Facilities for the sim, BEHAV and the play scene (DECISIONS §15.7, §15.10 A) — read this first
Six plan buildings are dressed as the loop's facilities. Get them at runtime (deterministic per plan; same
seed → same buildings) — do not hard-code coordinates:
```ts
import { townFacilities, facilityOf, facilityRoute, drawFacilityClaim, type Facility, type FacilityId } from 'src/render/town/art';
type FacilityId = 'tally' | 'gemworks' | 'forge' | 'chapel' | 'apothecary' | 'vault';
interface Facility {
  id: FacilityId; name: string; grants: string;   // 'Tally house' / 'False weights (cursed)', 'Gem workshop' / 'Faceting', 'Forge' / 'Jewelry', …
  block: string;        // layout.ts block id: tally→minehead, gemworks→market, forge→smeltery, chapel→highwarrens, apothecary→wellsquare, vault→tallyhall
  itemId: number;       // the plan item (TownItem.id) — its hit box, door and lights are the engine's as before
  x: number; y: number; // front-centre on the ground
  door: Pt;             // where crystals go in (person stands here to deliver)
  work: Pt[];           // 3 work spots in front of the facade (benches, anvil, scales…)
  bb: Rect;
}
townFacilities(plan: TownPlan): Facility[]                 // memoised per plan object
facilityOf(plan, item): Facility | undefined
facilityRoute(geo, plan): Pt[][]                          // the crystals' road legs: pit → tally, tally → gemworks, tally → forge, gemworks → vault (street graph)
drawFacilityClaim(g, f, scale, k = 0..1): void            // "this is now yours": violet veins up the facade, crystal clusters at the feet;
                                                          // world transform; call per frame in the props/above hook while held (k grows it in)
```
Gray/coloured state comes from the engine's stain mask like every building (the dressing is baked with the building).
Everyday places (spec v2.1 §5b / DECISIONS §16) use the same table and type (`FacilityId` = loop facilities ∪
`PlaceId` 'tavern' | 'bakery' | 'guardpost' | 'stables' | 'mill' | 'washplace'; `LOOP_FACILITIES` lists the six that
grant a craft); `townHomes(plan)` lists every other dwelling's door by block for LIVING's households. Landmarks
already in the plan: the well (`kind 'well'`), the Council hall (`'council'`), the temple, barracks, gate, graveyard
(block gravefield), fields (`'terrace'` items in sporegardens).

### Facilities (seed 1; x,y = front-centre; door; work spots) — reference only, read them at runtime
| id | name | block | item | door | work spots |
|---|---|---|---|---|---|
| tally | Tally house | minehead | 200 | 1805,1004 | 1773,1012 · 1956,1012 · 1823,1016 |
| gemworks | Gem workshop | market | 244 | 2878,1734 | 2840,1742 · 2903,1742 · 2860,1746 |
| forge | Forge | smeltery | 207 | 2570,773 | 2542,781 · 2707,781 · 2588,785 |
| chapel | The Flame's chapel | highwarrens | 288 | 3860,1999 | 3832,2007 · 3904,2007 · 3878,2011 |
| apothecary | Apothecary | wellsquare | 254 | 2326,1847 | 2282,1855 · 2378,1855 · 2344,1859 |
| vault | The Council's vault | tallyhall | 329 | 4243,1783 | 4167,1791 · 4319,1791 · 4261,1795 |
| tavern | Tavern | wellsquare | 263 | 2650,2193 | 2617,2201 · 2671,2201 · 2632,2205 |
| bakery | Bakery | slagrows | 48 | 1080,1292 | 1026,1300 · 1111,1300 · 1062,1304 |
| guardpost | Guard post | citygate | 336 | 4535,818 | 4476,826 · 4577,826 · 4517,830 |
| stables | Carters' yard | haulyard | 195 | 2083,673 | 2006,681 · 2159,681 · 2101,685 |
| mill | Mill | sporegardens | 274 | 3069,2690 | 3037,2698 · 3090,2698 · 3051,2702 |
| washplace | Wash-place | wellsquare | 261 | 2130,2240 | 2078,2248 · 2182,2248 · 2112,2252 |

## Public interface (rule 12 — additive only from here)
`src/render/town/art/index.ts`:
```ts
export class ArtGround implements GroundPainter     { constructor(m: GroundModel); readonly name = 'art-ground'; paint(t: TileTarget): Job<void> }
export class ArtBuildings implements BuildingPainter { constructor(light: (x: number, y: number) => BakeLight); readonly name = 'art-buildings'; paint(t: TileTarget, items: readonly TownItem[]): Job<void> }
/** drop-in for townBuildJob(seed, artPainters) */
export const artPainters: { ground: (m: GroundModel) => GroundPainter; buildings: (light) => BuildingPainter };
/** night: lit window panes / lantern cores of the items in rect (additive emissive, call in the glows hook, 'lighter') */
export function paintLitWindows(g: CanvasRenderingContext2D, r: Rect, scale: number, items: readonly TownItem[], k?: number): void;
/** state dressing overlays (call in the props hook): */
export function drawBarricade(g, x, y, dx, dy, scale): void;   // occupation / lockdown checkpoint at a street mouth
export function drawBanner(g, x, y, scale, col?: string): void; // steel-blue Council banner (or gold Temple)
export function drawPyre(g, x, y, scale, burning?: boolean): void; // purge pyre (flames are live; this is the stack)
```
The engine swaps `PlaceholderGround/PlaceholderBuildings` for these with one import (`townBuildJob(seed, artPainters)`).

## Reading of `docs/refs/town.png` (before painting)
- **View:** the same 3/4 top-down as `mine.png` — you look down and a little north. Buildings show their roof as the
  big shape and a strip of **south-facing front wall** with the door and windows; side walls are almost edge-on.
- **Construction:** shanty-industrial. Low boxy huts and **barrel (Quonset) roofs** of corrugated metal running
  front-to-back with an arched front; lean-tos, patched sheds, a few flat-topped blocks with vents; doors are dark
  rectangles, windows small pale panes, pipes/crates against walls. Buildings are 3–5 figures wide, 1.5–2 figures to the eave.
- **Roof and wall treatment:** roofs are **patchwork sheets** — teal-green corrugated metal with ochre/rust patches,
  some mustard tarps with folds; every sheet has ribs (parallel lines) and a lighter lit plane / darker shadow plane.
  Walls are blue-gray panels / planks, slightly lighter than the ground, with dark feet.
- **Ink:** dark teal-black, medium and slightly irregular; heavy on the silhouette and the roof edge, thin inside
  (ribs, panel joins). Small objects (crates, barrels, stones) are inked too. No outline-free blobs.
- **Palette:** desaturated. Ground charcoal gray (#3c3b38-ish) with **packed ochre-brown dirt paths** worn between doors;
  teal (#4f7d74), rust (#8a5634), mustard ochre (#a8842e), blue-gray (#69777e), cream panes. Value range is narrow
  except at lights.
- **Light:** night, dark overall; local warm pools at doors/lamps; the temple (bottom-right) is a **gold-lit** stone
  facade — the warmest, brightest thing; crystals violet. Light falls off to near-black at the cavern rock.
- **Density:** buildings in loose rows with lanes 1–2 figures wide; yards hold crates, carts, stones, rails;
  rounded stones lie in **clusters** (not everywhere), dirt paths branch between doors.
- **What makes areas differ:** roof material + colour temperature (teal metal vs mustard tarp vs gold stone),
  building size, and what's in the yards (rails/carts at the pit head, crates at the market).
- **Ours differs on purpose:** Deepwell is on the surface (brief), so the cavern walls become the dark beyond the
  town; five districts each get their own roof language: Rows = patched teal/rust corrugated barrels, Works =
  soot-black iron + brick kilns with ochre glow, Market = striped awnings + ochre tile hall, Temple Hill = cream
  stone + kiln-gold dome and terracotta, Keep = gray ashlar + steel-blue slate.

## Done
- reading, interface
- predecessor (stopped): kit/house/buildings/landmarks/props/ground modules + harness + shots script; tsc clean;
  harness runs, 0 console errors (successor check 04:10)
- successor M-A (ground, 04:40): calm charcoal-gray ground palette (GROUND in ground.ts), soft ochre dirt lanes
  with ragged verges and faint ruts (no dark verge = no band), visible ochre wear paths door→street, inked
  clustered stones (low-frequency gather field), puddle-holes removed (rare teal water only in the Works/Rows),
  paving decided per stone by a continuous field `paveAt` (no 16-unit cell steps; L1 plain stones on a dark bed),
  Market/High Warrens no longer carpeted in cobble (streets + plaza only)
- successor M-B (density, in progress): `art/fill.ts` scenery fill — huts, sheds, fenced yards (clutter, washing),
  woodpiles, ore heaps, crate stacks, garden plots in free lots; never overlaps plan items' extent, streets,
  spots, plazas, pit, wall, rails, channels → draw order irrelevant; drawn by ArtGround at the end of its tile.
  houseSmall roofs deeper (D 0.48 w), walls shorter; silhouette ink min 1.2–1.3 device px.

## Successor (2026-11-23 04:10) — first look at the predecessor's shots
- whole/rows/market/albedo shots: final median luminance 29 vs ref 62 (ground albedo too dark for the engine's
  ambient #5d6474 multiply + soft-light 0.55); ground a blotchy brown mottle; black puddle ellipses read as holes;
  cobble "clusters" gridded; market paving stepped square artefacts; town far too sparse vs the ref (plan density
  is the engine's) — houses small, tall walls, thin roofs, thin ink.

## M-B/M-C progress (05:35)
- fill.ts: two passes (big lots then small), hashed-bucket visiting order (no big sort), sliced (worst slice
  ≤ 40 ms seen at normal load; one 184 ms outlier under load spike 05:15 → yields now every 150 candidates);
  ~450 fillers (hut 126, garden 74, stack 80, yard 56, ore 54, shed 46, pile 11); gardens never on paving;
  ore heaps are low lumpy unions of mounds (were cones that read as tents).
- trodden paths are ragged meandering dabs (straight ochre bands lit by door lamps read as light beams).
- temple dome albedo lit high (its crown was going black under the lightmap).
- DECISIONS `### TOWN-ART — The town's look` appended.

## M-D facilities + places (06:05, successor) — done
- `art/facilities.ts`: 6 loop facilities + 6 everyday places chosen deterministically from the plan (own block
  first, else nearest), dressed in front of their facades (tally: scales, ledger, strongboxes; gem workshop: a
  shop window of stones, wheel bench + loupe; forge: hearth with hood, anvil, moulds, iron barrel; chapel: braziers;
  apothecary: drying herbs, jar shelf; vault: banded iron door, steel lamps; tavern: tables + barrels; bakery: oven;
  guard post: spear rack; carters' yard: trough, hay; mill: sacks; wash-place: tubs) + pictogram signs (no text).
- crystals' road: `facilityRoute` (street-graph BFS) dressed by the ground painter (cart ruts, violet grit,
  tally-board waymarks every ~180 u); fillers keep off it.
- claim overlay `drawFacilityClaim` (violet veins creeping up from the door, crystal clusters at the corners).
- harness: `?fac=<id>` centres a facility, `&claim=1|half`, `mode=split` (colour | gray with a wavy front) done.
- slices: worst slice 10–39 ms at load 8–9 (05:58–06:04); earlier 100–800 ms outliers came from one big
  pre-cells slice + load 14 spikes; yields added (road, wear, every L2 cell row, fill every 80 candidates).

## Files touched (successor, all rounds)
- src/render/town/art/{ground,fill(new),facilities(new),buildings,house,landmarks,index,harness}.ts,
  e2e/townart-shots.cjs, handoffs/TOWN-ART.md, DECISIONS.md (TOWN-ART section)

## Evidence (screenshots/townart-*.png; 800-px copies in /tmp/townart/*-s.png)
whole, whole-gray, whole-amb, rows-z1/z3, rows-amb, works-z1/z3, market-z1/z3, temple-z1/z3, keep-z1/z3,
pithead-z1/z3, gate-z1, graves-z1, gray-z1, split-rows, dress-z1, compare-rows (side by side with town.png),
kinds-rows, kinds-temple, fac-{tally,gemworks,forge,chapel,apothecary,vault,tavern,stables}, fac-claim (split
colour/gray with the claim on the coloured half), route-z05. Bake (harness, 1600×900 view): 100–440 ms of tile
work per view, prep (ground field + fill + route) 200–350 ms sliced, 0 console errors.

## Self-grade (06:05): 5/10 against "a shipped indie game" / town.png
Better than the predecessor's state (ground reads like the ref: gray stone ground, ochre lanes, inked stone
clusters; 2–3× the buildings via fill; districts tell apart by roof colour from the whole view; facilities dressed
and published). A hostile critic would say:
1. **The spec now says the buildings must be alien and organic** (docs/spec.md v2 §12 refs: "ignore human-looking
   sheds (buildings should be alien, organic)"; spec §1 "an alien civilization"). Ours are human: corrugated
   Quonsets, brick, slate, timber-frame. This is the biggest open question — it needs an orchestrator/owner call
   before more polish (the engine's old placeholder `art/townBuild.ts` was alien: shanty burrows, fungus caps,
   spiral shells, chitin-ribbed halls, bone-and-resin).
2. **Still too sparse and too small** vs town.png: houses are 3–4 figure-heights wide (ref 6–7), lots of empty
   ground in the Works and outskirts; facilities and the crystals' road do not read from the far view (only
   from z ≥ 1); lighting is dark and lamp-blotchy (engine ambient; request below).
3. **Close-up polish:** paving at z3 is a busy brick-grid, the temple dome is a flat wireframe grid, the pit is a
   giant black ellipse beside the headframe; ore heaps / fillers have no lit windows at night.

## Next steps (exact)
1. Get the orchestrator's ruling on point 1 (alien/organic vs current shanty-industrial). If alien: re-skin
   through `styleFor` + `house.ts` roof/wall kinds (add organic kinds: resin dome, chitin rib, fungus cap, shell
   spiral) — the HouseSpec pipeline, fill, facilities and ground all stay.
2. Far-view readability of facilities and the road: a tall distinctive silhouette per facility (forge stack with
   ember top, tally mast with a board, gem workshop glass lantern, vault squat tower) drawn inside the bb top
   margin, and a lighter, wider road bed at L0.
3. Lit windows for fillers in `paintLitWindows` (expose `fillLitPanes(r)` from ArtGround) for time-of-day.
4. LIVING/§16 places still missing as dressed buildings: market-day stall set (stalls exist in the plan),
   sheepfolds, smithy separate from forge if wanted, chalk marks; WEATHER may ask for roof/ground masks
   (roof outlines are in `house.ts roofPlanes`, ground is everything else) — none requested yet.
5. Re-shoot through the real engine once P6 adopts `artPainters` (dev/town.html).

## Requests to the town engine builder
- AMBIENT (town/index.ts '#5d6474') is darker than the reference: our median luminance after the bake is ~45 vs
  town.png 62 / mine.png 57 with albedo already lifted. Suggest '#727a88' (harness: ?amb=727a88 to preview;
  rows z1 median 37 → 49).
- Building scale (plan.ts `sizeFor`): in town.png a house is ~6–7 figure-heights wide; ours (dome 96–150,
  shanty 64–96 with figures ≈ 24 units) are 3–4. Suggest shanty 96–140 × h 64–90, dome 130–190 × h 84–120,
  and tighter packing (lanes ≈ 1 figure). TOWN-ART's fill.ts adapts automatically (it fills whatever is free).
- The headframe stands beside the shaft (legs on ground north of the pit); a headframe stands over the shaft:
  move it so its legs straddle the collar (PIT_RECT / headframe position), or shrink the shaft (rx ≈ 6 figures now).
- Before adopting artPainters: `new ArtGround(model)` exposes `prepare()` (sliced; run it during the bake's
  startup) — otherwise the first ground tile does the prep inside its job (~250 ms total, sliced).
