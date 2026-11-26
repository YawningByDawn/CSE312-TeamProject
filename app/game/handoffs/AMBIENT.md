# AMBIENT — a world that moves by itself — handoff

Port 5224 · scratch `/tmp/ambient/` · owner files: `src/render/ambient/**`, `dev/ambient.html`, `e2e/ambient-shots.cjs`, `screenshots/ambient-*.png`.

> **WEATHER (2026-11-23, successor 3):** `amb.setWeather(...)` now also reads **`dark`** (overcast / storm darkening 0..1)
> when present. It is folded into the ONE darkening layer: with the town engine's sky it goes into
> `town.setSky({ cloud })` (the engine's own multiply), else into the ambient grade's multiply field — never a second
> full-screen fill. The THEME props are reached through `src/render/ambient/themeprops.ts` (namespace import, guarded
> calls), so a half-written `theme/props.ts` drops a prop for a frame instead of throwing.

## Interface (exact; additive only)

```ts
import { createAmbient, type Ambient, type AmbientHost, type AmbientState, type AmbientLayer,
         type AmbientSpace, type AmbientLayouts, type CartInfo, clockLight } from '../ambient';

const amb = createAmbient(layouts?: AmbientLayouts, seed = 1);   // layouts default to the real mine/town layout data
amb.update(time: number, state: AmbientState);                    // once per frame (any renderer may call; idempotent per time)
amb.draw(g, host: AmbientHost, layer: AmbientLayer);               // per layer, per space, from the renderer's seam
amb.carts(space): readonly CartInfo[];                              // cart positions (life director attaches haulers)
amb.stats                                                           // { ms, items } last frame
amb.attachWorld(world: WorldComposite): () => void                  // one call: registers every seam (mine colour layers + world overlays); returns detach
amb.cue(c: 'dusk'|'dawn'|'night'|'day'|'dim'|'flash', ms)           // FEEL atmosphere cue
amb.lamplighter(): {x,y}|null                                       // town units, during the dusk round
```

```ts
type AmbientSpace = 'mine' | 'town';               // mine units (2400×1400) or town/world units (6400×3600)
type AmbientLayer = 'ground' | 'props' | 'above' | 'grade';
//  ground: on the floor, under people (pool rings, water sheen, cloud shadows, rail carts' shadows, ground breathing)
//  props:  y-sorted level of props/people (lift cage, carts, wheel, rats, chickens, dogs, carts on roads, flags, laundry)
//  above:  air over everything (dust motes, drips, bats, moths, smoke, birds, flames' breathing, rain, mist)
//  grade:  full-screen time-of-day colour grade (town only; mine: the daylight shaft only) — draw LAST, before UI

interface AmbientState {
  phase?: 'night' | 'day';
  dayT?: number;                  // clock of the day 0..1: 0 midnight, .25 sunrise, .5 noon, .75 sunset
  lift?: { pos: number; riders?: number };   // 0 cage at the bottom, 1 at the pit head
  bellAt?: number;                // time (s) the temple/shift bell was last rung (swings for ~6 s)
  day?: number;                   // turn number: seeds the day's weather (rain/mist) and wind
}

interface AmbientHost {
  space: AmbientSpace;
  /** the renderer's world transform: device = (x·a + e, y·a + f) — same A/E/F as `world(g)` in mine/town render */
  a: number; e: number; f: number;
  /** logical px per layer unit (LOD: what still reads at this zoom) */
  scale: number;
  /** visible rect in layer units */
  view: { x: number; y: number; w: number; h: number };
  time: number;
  /** 0 = Void (nothing drawn), 1 = seen; colour part via colourAt */
  visibilityAt(x: number, y: number): number;
  /** 0 = gray (Sensed: same motion, dim gray, fewer events) … 1 = full colour */
  colourAt(x: number, y: number): number;
  /** optional (brief): override state per draw */
  phase?: 'night' | 'day'; dayT?: number; lift?: { pos: number; riders?: number };
  /** Hold 0..1 of a zone (ground breathing near the grave, roots/moss leaning, violet) */
  hold(zoneId: string): number;
  /** optional mine light multiplier at a point (rgb ≈ 0.4..1.6) so props sit in the baked light */
  lightAt?(x: number, y: number): [number, number, number];
}

interface CartInfo { id: string; space: AmbientSpace; x: number; y: number; dir: number; moving: boolean; loaded: boolean; stop: string | null; pushX: number; pushY: number }
```

All motion is a pure function of (time, seed, state); nothing allocates per frame (pooled arrays, cached sprites).

## Crystal flow interface (DECISIONS §15.2/§15.7 — coordinator 2026-11-23; exact, additive only)

```ts
/** six tiers (§15.5): index 0..5 or the name, case-insensitive */
type CrystalTier = 0 | 1 | 2 | 3 | 4 | 5 | 'dull' | 'clear' | 'bright' | 'deep' | 'royal' | 'impossible';

/** Per-cart loads from the play scene / BEHAV. Replaces the previous list. An entry names a cart (`cartId` from
 *  `amb.carts()`) or a mine zone (`zone`: the next cart that loads at that zone's stop carries it). Loaded carts with
 *  no entry carry a seeded mix (mostly dull/clear). A cart's load glints in the rarity colours of what is in it. */
amb.setLoads(loads: { cartId?: string; zone?: string; crystals: CrystalTier[] }[]): void;

/** Which rock faces are being worked (dust puffs, chips flying, a lamp set down by the face, a strike glint).
 *  `n` = diggers (more = more puffs). Default when never called: the work zones by day, a few at night. */
amb.setWorking(faces: { zone: string; n?: number }[]): void;

/** SIM-v3 events (names from handoffs/P4.md "v3 API contract"): a pulse at the right place.
 *  strike — a glint in the rock in the tier's colour at the zone's face (or x,y);
 *  carted — the crystal hops into the zone's cart; tally — the overseer's scales dip, the ledger lamp flares,
 *  `short: true` = the lamp gutters red. `time` defaults to the last update time. */
amb.event(name: 'strike' | 'carted' | 'tally', o?: { zone?: string; x?: number; y?: number; tier?: CrystalTier; cartId?: string; count?: number; short?: boolean; time?: number }): void;

/** Anchors (mine units / town units) for people and effects. */
amb.faces(): readonly { id: string; zone: string; x: number; y: number; nx: number; ny: number; worked: number }[];  // mine faces; (nx,ny) points out of the rock
amb.tallyPoint(space: 'mine' | 'town'): { x: number; y: number };  // mine: the overseer's table beside the lift; town: the Tally Hall door
amb.crystalRoute(): readonly { x: number; y: number }[];  // town units: pit head → haul yard → market → Tally Hall (vault); a porter line branches to the smeltery cutters
```
Rarity colours (ambient's own; violet stays the god's): dull `#9a948a` bone-gray, clear `#d8f0f4` ice, bright `#5fd6a4` jade,
deep `#4f8dff` azure, royal `#ffc94a` gold, impossible: a slow prismatic hue cycle (never violet-dominant).

## §16 interface (lived-in world — coordinator 2026-11-23; exact, additive only)

```ts
// THE CLOCK: everything the ambient draws (carts, lift wheel, smoke, birds, windows, the grade) is a pure function of
// the `time` given to update() + state.dayT. Pass FEEL's day clock: amb.update(feel.dayClock.worldSeconds, { dayT: feel.dayClock.dayT, day, phase })
// (×1/×2/×4 just advances it faster; paused = same time; skipped = jump). Draw seams' own host/info time is ignored once update() ran.
amb.sky: SkyState      // stable object refreshed in update(): { dayT, sun 0..1, lamps 0..1 (street lamps lit), night, dawn, dusk, elev }
amb.setWeather(weather | (() => WeatherIn | null) | null)  // reads weather.state each update: { wetness?, windX?, windY?, wind?, flash?, visibility? }
//  → smoke, flags, laundry, crops, mist banks follow its wind; its flash lights the grade; the ambient's stand-in rain + ground mist switch off
amb.weather: WeatherIn | null   // last read
// crystal grades: spec v2.1 §7.1 names 'dull'|'clear'|'bright'|'blazing'|'royal'|'impossible' (0..5); 'deep' accepted for 3
```
Colours now: dull bone-gray, clear ice, bright jade, blazing flame-orange, royal azure (gold glint), impossible prismatic.

## Anchor data used (read-only, from the layouts; defaults synthesised if missing)
- mine: `RAILS` (loop + spurs), `POOLS`, `ZONES` chambers (floor), lights/flames via `buildDressing` (lamps, torches, crystal glints, liftWheel), lift landing (`MINE_CAGE` 1995,262).
- town: `TownPlan.smoke` (chimneys), `.rails`, `.shaft`, `.wall`, `.gate`, `.bowl`, `.items` (kinds: stall/hall/caphouse/dome/shanty/kiln/ftree/terrace…), `.spots` (plaza/yard/garden/stall), `ROADS`/`STREET_VIA`/`ADJ` (cart traffic), `BLOCKS` centres.

## Status (successor 3 — 2026-11-23 08:20, in progress)
Order (§19, no polish): 1 verify ✓ → 2 town frame cost → 3 follow the plan → 4 theme props → 5 one strip per place.
- [x] 1. tsc clean for ambient + town; harness boots; console clean (07:41).
- [x] 2. Perf BEFORE (load 21–32, median of 16 flushed frames, ambient on − all ambient off): market noon +41 ms
  (83.6 vs 42.3; grade alone ~40 ms = the colour-dodge exposure field), market dusk +16, town night +18, pit head noon +47.
  Fixes: (a) the town engine's sky now carries day / night / dusk / flash: `amb.update` calls
  `town.setSky({ daylight: daylightOf(dayT) (= Valley.daylightOf), lamps: sky.lamps, flash, cloud (weather only) })`
  every frame; the grade then draws NOTHING except the brief dim cue (one multiply) and the stand-in rain;
  (b) mist composed on a ≤160-px canvas, one upscaled draw; (c) windows + lamp glows not drawn when the engine has
  its own live night lights (`engineLights`); moths only. AFTER: see Numbers (measuring).
- [x] 3. Plan at runtime: `townroute.ts` (`placeAt(L, place…)`, `itemsOf`, `StreetGraph` over every street/road/lane
  polyline, Dijkstra). Crystal wagons: shaft → `sorting` pens (stop) → `tally` (stop) → `vault`/`keep` (unload);
  cutters' handcart: pens → `gemworks` (else forge/smelter). Headframe = `place: 'headframe'`, winding engine =
  `place: 'engine'` (steam plume there), stalls flutter only for `place: 'market'`, the well windlass not on the
  `wash` place, forge hammering / smelter bellows at their doors, lamp-moths at the plan's small lights
  (`plan.lights` kind lamp/torch/candle, not pools), spores under the plan's cap-trees, spring ripples on
  `plan.spring`. Re-plan: `amb.update` notices `town.plan !== last` and rebuilds the town ambient from it.
- [x] 4. THEME props: road wagons, pit-head rail carts and the mine loop carts are `drawCart` behind a walking
  `drawPitBeast` on a trace (mine spurs: carts alone); critters → THEME `drawSkitter` (town + mine);
  moths → `drawLampMoth`; shrine nooks (mine 'candle' flames) → a gold `drawBrazier` each; mine shard-lamps breathe
  cold white `#e8f0ff` with a hum shimmer and never gutter; pit-head engine steam plume (pale, beating);
  flags recoloured (gate/Keep cold, Temple gold), wall pennants removed. Cap sway: the ENGINE draws the caps —
  request below (I pass `wind` in setSky already; it is ignored until then).
- [x] 5. strips pithead / market / rail / face run 09:07 (console clean) and looked at once. Fixed what was plainly
  broken: chimney smoke read as separate pale dots (now 9 overlapping fainter puffs, warm gray by day → plumes);
  a spoked asterisk floated beside the engine house (winding drum glyph: now only on an old-plan `winding` item);
  a bell frame beside the Temple steps read as a gallows (removed). Street graph: the plan's lanes left 12 islands
  (crystal route fell back to 4 straight points) → islands joined at their closest pair (≤ 260 u): route 173 pts.
- [x] perf AFTER (see "Numbers, successor 3"). LOD trims after the first AFTER run: mine lamp motes 3–4 and only at
  s ≥ 0.5; town smoke 6 puffs (kiln 8); lamp-moths only at s ≥ 0.7, ≤ 24 lamps a frame; spores 2 per cap-tree at
  s ≥ 0.6; rain batched into 4 paths. Debug: `amb.off` also takes part names (town: smoke spores moths stalls wagons
  flow critters kilns flags; mine: carts nooks lamps glints flow).
- WEATHER `dark` folded in (see top). THEME props via the guarded adapter `themeprops.ts`.

### Numbers, successor 3 (load 16–32 on 4 cores: every number is noisy by ±5 ms)
BEFORE (frame median, ambient on − all ambient off, flushed): market noon +41 ms (grade alone ~40: the colour-dodge
exposure field), market dusk +16, town night +18, pit head noon +47.
AFTER, same probe (`p-perf3.js`): market noon +20, market dusk +14, town night +6.5, pit head noon +2.6.
AFTER, raster-inclusive per seam (`p-perf5.js`: `amb.flushProbe` flushes the seam's canvas before and after each
ambient draw; `amb.layerMs`), ms per frame: market noon 8.2 (props 4.1, above 3.9, grade 0.03, mist 0), market dusk
25.1 (mist 11.5, props 7.7, above 5.8), town night 13.4 (mist 8.6, props 2.8, above 1.9), town noon 5.1, pit head noon
4.7, route dusk-night 17.7 (mist 8.2), mine rail night 22.7 then 3.4–6.0 after the mote trim (`p-perf6.js`).
The grade is now ~0.03 ms (was the dominant cost). In play WEATHER owns fog (`setWeather` switches the ambient mist
off), so the in-play town cost is props + above ≈ 4–8 ms at this load (target ≤ 3: NOT met at load 17; per-part
toggles were within the noise — no single part dominates).

### Numbers (load 7–10)
Motion share changing within 2 s (with ambient / renderers alone): heart 10.2/4.6 %, lift 2.0/0.8, rail 8.1/3.5, sump 2.0/0.2, pithead 9.2/2.7, market 4.7/0.2, market-dusk 0.9/0.2, well 2.4/0.0, gate 1.3/0.0, town-night 1.3/0.3, town-mixed 1.8/0.3, tally 3.2/0.7, face 8.4/1.3, route 3.9/3.1. Every quarter of every subject has moving 32-px tiles (min 6).
Perf: ambient JS median 0.2–0.9 ms (budget 1.5 ✓), but delivered frame delta in the town is still +10–19 ms (market 40 vs 27 ms, dusk 49 vs 30, town-night 39 vs 30); mine +2–6 ms. The grade rewrite did not remove it → the cost is elsewhere (suspects: TownMist 34 puffs up to 360 u radius drawn in-colour; per-window 'lighter' blits ×2; cloud tiles). NOT within budget.

## Self-grade (successor 3, 11:15): 6.5/10 — in place (§19), not polished
Final strips 11:14 (`screenshots/ambient-{pithead,market,rail,face}.png`, full frames `/tmp/ambient/full-*.png`), console clean.
Worst three:
1. Delivered cost: the grade cost (~40 ms) is gone, but props + above still cost ~4–8 ms (flushed, load 17) in the
   town, and the stand-in mist 8–11 ms when WEATHER is not attached. Target ≤ 3 ms not shown at this load.
2. Pit head reads mostly through the engine's art: the steam plume is small at 1.25 zoom and the town engine
   re-planned again during the run (the pit-head frame changed), so the engine place and plume position need one look.
3. Cap sway needs P6 (request below); pale smoke puffs still read as separate dots at far zoom in places.

## Next steps (exact)
1. Perf on a quiet machine (load < 8): `/tmp/ambient/p-perf5.js` (per seam, raster-inclusive) and `p-perf6.js` (per part).
   If props/above stay > 3 ms: draw town smoke into a small canvas like the mist (one upscaled draw), and skip
   critters/stalls/laundry below s 0.5.
2. When WEATHER is attached in play (it is), the mist is off; if the harness should match play, call `amb.setWeather(() => ({}))`.
3. Re-look at `ambient-pithead` once P6's plan settles: the steam plume sits on `place: 'engine'` (else the headframe).

## Requests
- **Town engine (P6), cap sway (owner: "wind sways caps only"):** in `drawCanopy` pass `wind` to `drawCapTreeCap`
  (`{ ..., time: t, wind: this.sky.wind ?? 0 }`) and accept `wind?: number` (0..1) in `setSky` (additive). The ambient
  already calls `town.setSky({ wind: amb.day.wind, ... })` every frame.
- **Town engine (P6):** `setSky` now receives the ambient's clock each frame (daylight = Valley.daylightOf(dayT),
  lamps = the lamplighter's round, flash); if WorldView.dayT is also given, the world sets the same value.
- **WEATHER:** expose `weather.state` as `{ wetness, windX, windY, wind, flash, visibility }` (any subset; my adapter `amb.setWeather(weather)` reads it each update); read `amb.sky` (`dayT`, `sun`, `lamps`) for your own light. Wind direction should change slowly (I advect clouds/mist with the day's fixed direction and use yours for smoke/flags).
- **FEEL:** pass the day clock as `amb.update(worldSeconds, { dayT, day, phase })`; while it runs no `cue()` is needed (dayT wins).
- **Town engine (P6):** the town is baked night-lit (lightmap ambient `#5d6474` + baked lamp glows), so daylight can only be faked by a grade. Ask: a second, day lightmap (flat warm ambient, lamps off) baked once, and `town.setDaylight(k 0..1)` crossfading the two (AMBIENT drives k from `amb.day.day`). Until then the grade lifts exposure, lamps still glow by day.
- **Mine engine (P2-r5B):** `mine/index.ts` `cellLuminanceJob` reads back with `willReadFrequently: false` → Chrome warns "Multiple readback operations using getImageData…" on some loads; set it true (or snapshot via a 1×1 drawImage).
- **PLAY-v2 / BEHAV:** call `amb.setLoads([...])` with per-cart crystal tiers and `amb.event('strike'|'carted'|'tally', …)` from SIM-v3 events; `amb.setWorking([{zone, n}])` from who is digging; people attach at `CartInfo.pushX/pushY` (town `cutters-handcart` needs a porter; `crystal-wagon-*` are mule-drawn).


