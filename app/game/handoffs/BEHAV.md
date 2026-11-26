# BEHAV — the life director (running handoff)

> **CAST clip requests (round 5; the director already emits these `doing` / meanings, today they fall back to a
> near clip):** `bier` (two or four carry a body: `carry:'crate'` on a burning walk), `bundle` (walk carrying a cloth
> bundle / sack after the market: `walk:sack`), `squat` and `squatEat` (sit on the heels, eat from the hand),
> `greet` (a nod / raised hand between two in a knot), `coverWick` (hand over the head-wick: mourning, see-off),
> `heap` (sleepers lying close), `stoke` (ash keeper at the fire), `muster` (stand in rank, chin up), `march`
> (walk in step), `scrape`, `tend`, `queue` (stand, shift weight, look ahead), `play` / `run` (children),
> `haggle` (point at goods / weigh in the hand, with a carried sack). Priority: bundle, squat/squatEat, coverWick,
> greet, march, bier.

> **PLAY-WORLD — FEEL's `duskWalk {bearers}` cue is the director's (round 4):** call `life.bearersToGrave(ids)` when the
> cue fires (or pass `StageOpts.bearers: ids` on every `stage()` call of that Day); those miners stay below after the
> shift, walk to the grave carrying their find (`carry: 'crystal'`), set it down at ~0.93 and go up after. Read
> `frame.bearers[]` ({id, kind, arrive, leave, x, y}, plan time) to time the offering. Call `bearersToGrave([])` on the
> next Day. Do not write your own walk. **`clock.catchUp`:** `stage(input, t)` is pure in t — feed it the racing
> `clock.t` and everyone hurries along their plan by itself (nothing to call).

Builder #1. Brief: `handoffs/briefs/BEHAV.md`. Port 5221. Scratch `/tmp/behav/`.

## v4 — staging the living world (round 3, builder #3, 2026-11-23; spec v2.1 §3, §5, §5b) — ADDITIVE, binding
Everything below the v4 block still works unchanged (`night()`, `day()`, `specks()`). New: one pure call that stages a
whole society's day (LIVING's `DayPlan`, or our stand-in in the same shape) at plan time `t`.
```ts
import { createLife, nightClock, PLAN, type StageInput, type StageFrame, type StageOpts } from 'src/life';
// time = LIVING's plan time: 0 dawn bell … 1 dusk (= feel.dayClock.t), 1–1.25 evening, 1.25–2 night (to the next dawn)
export const PLAN = { DAY_END: 1, EVENING_END: 1.25, END: 2, FILM_S: 18 /* film seconds per plan unit by day */, NIGHT_RATE: 1 / 162 };
export function nightClock(nightSeconds: number): { t: number; loop: number }; // the Night: real-time pace, holds at 1.97,
                                                                                 // `loop` keeps the watch's rounds, pumps, the winder alive
export function duskClock(duskSeconds: number): number;   // after the Day film reached 1: 1 → 1.25 at film pace (the walk home)
export function townLayoutFromPlan(geo: TownGeo, plan: TownPlan): LifeLayouts['town'];  // real doors/stalls/yards + off-roof test
//   createLife({ town: townLayoutFromPlan(townRenderer.geo, townRenderer.plan) }, seed) — without it the town falls back to
//   synthesised spots and everything counts as standable (people can stand on roofs)
interface Life { /* … existing … */
  stage(input: StageInput, t: number, opts?: StageOpts): StageFrame;   // PURE in t (any order, any speed, paused, skipped)
  standIn(seed: number, dayIndex: number, facts?: { followers?: string[]; rain?: boolean; kind?: string }): StageInput; // until LIVING planDay lands
}
interface StageInput {                       // exactly LIVING's objects (src/sim/living/types.ts); pass the same objects every frame
  society: Pick<Society, 'people' | 'groups' | 'households'>;   // the society the plan was made from
  plan: Pick<DayPlan, 'dayIndex' | 'calendar' | 'weather' | 'plans' | 'events' | 'feed'>;
}
interface StageOpts {
  sim?: { state: LifeState; dayEvents?: readonly DayEventLike[]; nightEvents?: readonly LifeEvent[] }; // sim units by id
       // (adopted ids g01… are LIVING people): routines (pray/offer/lieLow), strike/pocket/tally/search/evil beats, night reacts
  weather?: { kind: WeatherKind; strength: number };   // override; default = plan.weather at t
  loop?: number;                                       // from nightClock()
  view?: { layer: 'mine' | 'town'; x: number; y: number; w: number; h: number }; // optional: full patches only in view
}
interface StageFrame extends LifeFrame {   // people: one LifePatch per INDIVIDUAL (named / key / adopted / followers)
  crowds: CrowdPatch[];                     // town groups: centre + per-member offsets (each member walks, faces, acts)
  specks: LodSpeck[];                       // far zoom: EVERY person (crowd members expanded) at speck cost
  lift: LiftState & { queueTop: number; queueBottom: number; stopped: boolean };
  weather: { kind: string; strength: number };
  lit: { x: number; y: number; zone: string }[];   // lit windows (door points of houses with someone up) — evening / night
  stats: { people: number; visible: number; moving: number; indoors: number; distinct: number; mine: number; town: number };
}
interface CrowdPatch { id: string; trade: string; layer: 'mine' | 'town'; zoneId: string; x: number; y: number; count: number;
  doing: string; activity: string | null; moving: boolean; facing: 1 | -1; indoors: boolean;
  members: { id: string; dx: number; dy: number; facing: 1 | -1; moving: boolean; doing: string; activity: string | null }[] }
interface LodSpeck { id: string; x: number; y: number; layer: 'mine' | 'town'; moving: boolean;
  cls: 'miner' | 'worker' | 'folk' | 'child' | 'guard' | 'priest' | 'elite' | 'follower' | 'cart'; lamp?: boolean; indoors?: boolean }
// LifePatch additions (all optional): trade, role (CAST / miner role id to draw), indoors, hood, lamp, carry, event, household
//   Individuals INDOORS still get a patch (indoors: true, asleep at night, at their house door) so the player can whisper to
//   sleepers in their houses; crowds indoors and indoor people are not in `specks`.
// Moment kinds added: brawl wedding funeral marketCrowd sermon procession patrol search cartCity rainRun lostChild collapse
//   debt beastSick rats inspector caravan preacher strikePay festival gather liftStop lamplight; plus every v3 kind.
```
**PLAY-WORLD, per frame:** Day: `life.stage(input, feel.dayClock.t, { sim: { state: lifeStateOf(before), dayEvents } })`;
Dusk: keep calling with t running 1 → 1.25 (the walk home, the offering); Night: `const c = nightClock(tNight);
life.stage(input, c.t, { loop: c.loop, sim: { state, nightEvents } })`. Copy each patch onto its PersonView by id as before;
draw `crowds` members at (x+dx, y+dy); at far zoom draw `specks`. Patches with `indoors` are inside (draw nothing or a
lit window). Old callers: nothing to change — `day()`/`night()` keep their behaviour.

## v4.1 additions (round 4, 2026-11-23) — ADDITIVE, binding
```ts
import { livingDays, livingDay } from 'src/life';
livingDays(seed, n, factsOf?: (d) => Partial<SimFacts> | undefined): (StageInput & { plan: DayPlan })[]  // LIVING's real chain
livingDay(seed, dayIndex): StageInput & { plan: DayPlan }        // plain chain, memoised (tests, dev pages; PLAY-WORLD has its own)
interface StageFrame {
  bearers: { id: string; kind: 'offer' | 'tribute'; arrive: number; leave: number; x: number; y: number }[];
      // dusk bearers (followers on Offer, or bringing tribute): plan time they reach / leave the grave (mine coords).
      // v3.2: they stay below after the shift and set the stone down at the sim's `offered` time (0.92–0.955).
  stats: { …as before…, townOutside, townIndoors, mineOutside, mineIndoors, sheltering /* under the eaves */, asleep };
      // townOutside + townIndoors + mineOutside + mineIndoors === people; townOutside === town specks (what is drawn)
}
// LifePatch.doing for someone INDOORS at work is now the trade's own work (dip / grind / knead…), not 'idle'.
// Event moments now use LIVING's kinds as they are: burning, stateBurning, emptyBurning, levyCalled, levyDay,
// wickBlessing, beastMoult, runawayTrain (+ beastCurl), refugees, woundedHome, procession, titheBurned, taxCrier,
// warNews … (stand-in kinds funeral / levy / patrol still work). Crowd members named in an event (and the hearths of the
// dead, the levied, a newborn's mother) step out of their crowd for that day and act as individuals.
// Carry kinds used: 'crate' (bier, tithe crate, moulted shell), 'bundle' (a newborn), 'censer', 'cart', 'sack'.
// LifePatch also carries (since round 3): light: 'white' | 'brazier' | 'shard'; hood (rain, Lie low); lamp (fog, night);
// beasts: true on a town cart walker; moments 'beastCurl' (collapse, runaway train), 'liftStop' (storm / LIVING effect).
```

## Per-turn call sequence (what a caller must do — PLAY-WORLD)
```ts
const life = createLife(undefined, seed);                 // once per run
// NIGHT of turn N (the player's turn), every rendered frame:
const f = life.night(lifeStateOf(state), tNight, nightEvents);
//   tNight = seconds since this night began (restart at 0 each night, non-decreasing within it);
//   state.turn must be N (a new turn = a new night). nightEvents = this night's acts so far, `at` in tNight seconds
//   (whisper/converted/refused/miracle/purge/stain/offer/tribute); keep the array for the whole night, clear at dusk.
//   Copy each patch onto its PersonView by id: pos, activity, route, react, asleep, inLift, task, zoneId (+ face, gait);
//   WorldView.lift = { pos: f.lift.pos } (+ cargo); f.moments → FEEL/VFX/audio cues.
// END NIGHT → the sim returns { state: after, events: dayEvents }.
// DAY replay, every frame, p = 0..1 over the replay (scrub freely, any order):
const d = life.day(lifeStateOf(before), dayEvents, p, { after: lifeStateOf(after), seconds: replaySeconds });
//   `before` = the state the night ended with (same object for the whole replay); patches/lift/moments as at night.
// NEXT NIGHT: call life.night(lifeStateOf(after), 0, []) — the night starts where the Day left everyone.
```
Robustness (self-check, tested): a new `turn` or the night clock going back by > 0.5 s starts a fresh night (a caller that
asks once with the old clock and then restarts at 0 no longer freezes everyone); any person whose plan does not cover
`t` is re-planned on the spot (`life._debug.night.repairs` counts it; it stays 0 in every test).

## Public interface (binding from now; additive changes only)

```ts
// src/life/index.ts  (headless, deterministic, presentation-only: never mutates the sim state)
export function createLife(layouts?: LifeLayouts, seed?: number): Life;

export interface LifeLayouts {
  /** Optional overrides. Default: everything is derived from src/render/mine/layout.ts and
   *  src/render/town/layout.ts (the mine floor is rebuilt headlessly from the same seeded prims). */
  mine?: { isFloor?: (x: number, y: number) => boolean; geoSeed?: number };
  town?: { spots?: { x: number; y: number; tag: string; block: number; face?: 1 | -1 }[][]; isOpen?: (x: number, y: number) => boolean };
}

/** The slice of sim state the director reads (structurally compatible with GameState). */
export interface LifeState {
  turn: number;
  units: LifeUnit[];
  zones?: { id: string; hold: number }[];
}
export interface LifeUnit {
  id: string; role: string; kind?: 'person' | 'group' | 'elite'; headcount?: number;
  alive: boolean; follower: boolean;
  at: string; home: string; work: string; dayAt: string; shift: 'day' | 'night'; asleep: boolean;
  task?: { kind: string; zone?: string } | null; trait?: string; devotion?: number; // = stats.devotion
  stats?: { devotion: number };
}

/** Timed things that happen at night (the player's acts and their consequences). `at` = night seconds. */
export type LifeEvent =
  | { kind: 'whisper'; unit: string; at: number }
  | { kind: 'converted'; unit: string; at: number }
  | { kind: 'refused'; unit: string; at: number }
  | { kind: 'miracle'; zone: string; at: number; unit?: string }
  | { kind: 'purge'; zone: string; at: number }
  | { kind: 'stain'; zone: string; at: number }        // stained ground grew here (unconverted edge away / grow curious)
  | { kind: 'sent'; unit: string; zone: string; at: number };

export interface Life {
  readonly places: Places;
  /** The Night (runs indefinitely). `t` = seconds since dusk, non-decreasing between calls of one night.
   *  A new `turn` starts a new night. Same (state, events, t-sequence) → same frames. */
  night(s: LifeState, t: number, events?: readonly LifeEvent[]): LifeFrame;
  /** The Day replay, pure in `t` (0..1; scrubbing backwards works). `dayEvents` = the ordered events
   *  `endNight` returned (bell, moved, liftRide, taskResult, enemyMoved, …, each with `time`).
   *  `seconds` = how long the replay lasts on screen (default 8; only sets the pace of idles). */
  day(before: LifeState, dayEvents: readonly DayEventLike[], t: number, opts?: { after?: LifeState; seconds?: number }): LifeFrame;
  /** Town folk (groups expanded into members) for zoomed-out specks / crowds: positions only, cheap. */
  specks(frame: LifeFrame): Speck[];
}

export interface LifeFrame {
  time: number;                 // night seconds, or day t (0..1)
  people: LifePatch[];          // one per unit present (groups: one patch for the group centre)
  lift: { pos: number; riders: string[]; doorsOpen: boolean }; // cage 0 = mine bottom … 1 = pit head
  moments: Moment[];            // unscripted moments active now (for camera/FEEL/audio)
}

/** Maps 1:1 onto PersonView fields (src/render/types.ts). Coordinates are layer-local:
 *  mine units (2400×1400) when layer = 'mine', town units (6400×3600) when 'town'. */
export interface LifePatch {
  id: string;
  zoneId: string;               // the area the person stands in NOW (sim area at night; changes during the day)
  layer: 'mine' | 'town';
  x: number; y: number;         // feet, layer-local
  facing: 1 | -1;
  moving: boolean;
  /** what they are doing (a clip id of src/render/people, or 'walk:<carry>') — for stats and tests */
  doing: string;
  // ---- PersonView fields, pass straight through:
  pos?: { x: number; y: number } | null;   // set while acting at a spot
  activity?: string | null;                // clip while acting
  route?: { pts: { x: number; y: number }[]; t: number; carry?: string } | null; // set while walking
  react?: { kind: string; at: number } | null;
  asleep?: boolean;
  inLift?: boolean;
  task?: { kind: string; zone?: string } | null;
  face?: 1 | -1;                           // REQUESTED additive PersonView field (see Requests)
  gait?: 'stroll' | 'walk' | 'sneak' | 'jog' | 'push'; // REQUESTED additive route field
}

export interface Moment { kind: string; at: number; until: number; zone: string; units: string[]; x: number; y: number; layer: 'mine' | 'town' }
export interface Speck { x: number; y: number; layer: 'mine' | 'town'; id: string; crest: string; moving: boolean }

/** Named places. */
export interface Places {
  mine: Spot[]; town: Spot[];
  byTag(layer: 'mine' | 'town', tag: SpotTag, zone?: string): Spot[];
}
export interface Spot { id: string; layer: 'mine' | 'town'; zone: string; tag: SpotTag; x: number; y: number; face: 1 | -1; synth?: boolean }
export type SpotTag =
  | 'face' | 'load' | 'sortTable' | 'bunk' | 'bench' | 'fire' | 'shrine' | 'lamp' | 'water' | 'post' | 'patrol'
  | 'desk' | 'liftQueue' | 'cage' | 'mouth' | 'wall' | 'grave'
  | 'door' | 'stall' | 'well' | 'yard' | 'field' | 'steps' | 'gate' | 'corner' | 'plaza' | 'pithead';
```

### v3 additions (§15 mining loop; additive, keyed off stand-in event names until `handoffs/P4.md` "v3 API contract" lands)
```ts
interface LifeUnit { /* … */ routine?: 'pray' | 'offer' | 'lieLow' | string }   // read as `routine ?? task?.kind`
// LifeEvent (night) — new kinds:
| { kind: 'offer'; unit: string; at: number }            // force the dusk offering walk now (otherwise automatic at dusk for routine 'offer')
// DayEventLike (day) — kinds the director stages (all fields optional except kind; `time` 0..1):
//  strike {unit, zone, rarity, kept, time}  → the miner stops, looks; kept: furtive pocketing; else carries it to the cart
//  carted {zone, time, count?}               → moment only (AMBIENT rolls the cart to the lift)
//  tally  {expected, counted, short, time}  → day-shift miners queue at the overseer by the lift, hand in one by one;
//                                              short count: the overseer flares, guards in the mine stir
//  search {unit, by?, found?, time}         → a guard (or the overseer) pats that miner down at the tally line
//  evil   {unit, act: 'theft'|'beating'|'sabotage', victim?, zone?, time}  → staged with bystanders reacting
interface LiftState { /* … */ cargo?: 'ore' | 'empty' | null }   // night: the cage runs ore carts up on a timetable
interface Moment { /* … */ data?: Record<string, unknown> }     // e.g. strike {rarity, kept}, tally {short}
// Moment kinds: night 'liftBell','offerSet'(units=[who], at the grave),'offerBow', moments as before;
//               day 'strike','pocket','toCart','carted','tallyOpen','handIn','tallyShort','search','searchFound','evil'
```

Adapter for the play scene: copy `pos, activity, route, react, asleep, inLift, task, zoneId` of each patch onto the
unit's `PersonView` (by `id`); feed `frame.lift.pos` to `WorldView.lift`. Followers keep `task` from the sim.

## Done
- Builder #1 (stopped by owner interrupt, handoff not updated) left on disk: `src/life/{index,types,actor,rng,mineMap,ground,places,night,day,specks,metrics}.ts`,
  `src/life/dev/harness.ts`, `dev/life.html`, `e2e/life-shots.cjs`, `tests/life/{life.test,presets}.ts`.
- Builder #2: tsc clean; first browser run of the harness (all strips written, 0 people off the real floor, floor match 99 %).
- Builder #2: **night lift** (`src/life/nightLift.ts`): the cage runs ore carts up / empties down all night on a 54 s timetable
  (pure in t), `frame.lift.cargo`, `liftBell` moments; a night-shift worker in the lift area is the **lift hand** (pushes the
  full cart into the cage in its loading window, rings it away, waits for the next).
- Builder #2: **§15 mining day** (`src/life/dayMining.ts`, a post-pass on the Day plan, continuous and pure in t):
  `strike` (stop, look; kept → pocket + glance; else carry to the nearest cart / basket), `carted` (moment), **the Tally**
  (miners walk to a line by the lift, step up, hand in one by one at the overseer's table; short beyond tolerance → overseer
  flares, guards stir), `search` (nearest guard pats down the miner at the head of the line; found → fear), `evil`
  (theft / beating / sabotage with bystander reactions). Keys off the real SIM-v3 events (`strike{unit,zone,rarity,kept,time}`,
  `carted{zone,count}`, `tally{expected,counted,short,tolerance,covered}`), stand-ins in `tests/life/presets.ts` otherwise.
- Builder #2: **dusk offering** (night): followers on routine `offer` walk the real path to the grave (already on their way at
  nightfall, ≤ 280 u out), set down (`offerSet` moment), bow (`offerBow`), walk back / go to bed; `{kind:'offer'}` event forces one.
  `routine` read as `routine ?? task.kind`; `pray` prays twice as often; `lieLow` as before. Patch `task` = `{kind: routine}`.
- Builder #2: night events are applied in planner time order → frames independent of query rate (a real bug with new sim data);
  personal walking pace per person (co-walkers drift apart; fixed a long overlap).
- Harness now reads frozen presets `tests/life/fixtures/presets.json` (regenerate: `npx tsx tests/life/make-fixtures.ts`) so it
  never breaks when the sim is mid-edit; `__lifeH.focus([x,y,w,h])`, `__lifeH.moments()`.
- Tests: 33/33 (`npx vitest run tests/life`), incl. new mining-day and routine tests and a `half-shift` / `dusk-offering` preset.

- Builder #2 (later): §15.10. **Tribute** (lone furtive walk, `tributeSet` moment; `LifeState.dusk.tribute` or a `tribute` event),
  **worn items** (`LifeUnit.worn`: nerve, watchful, "touch the charm" near the law, avoids the guards' beat), **exposure**
  at a search (`search{found, item}` → the guard holds it up (`exposed` moment), the line pulls back, the follower is taken aside),
  **depth wariness** (`zones[].depth` or the area's y). **Self-check / per-turn sequence** (top of this file): a clock rewind
  starts a fresh night, and uncovered plans are repaired. This is the likely cause of LOOP's "nobody moves from night 2"
  (a caller asking with the old clock and then restarting at 0 froze everyone until the old time). Tested.
- Strips: `screenshots/life-shift.png`, `life-tally.png`, `life-offer.png` (12 frames each), plus earlier `life-night-*`, `life-day-*`.

## In progress
- Nothing half-done on disk. Everything compiles; `npx vitest run tests/life` passes 34/34.

## Files touched
- src/life/{nightLift,dayMining}.ts (new), night.ts, day.ts, types.ts, dev/harness.ts; tests/life/{presets,life.test,make-fixtures}.ts,
  tests/life/fixtures/presets.json; e2e/life-shots.cjs (shift/tally/offer strips); screenshots/life-*.png; DECISIONS.md (BEHAV section).

## NEW OWNER DIRECTION (binding, arrived after builder #2's report: read first)
Read `docs/spec.md` v2.1 §3, §5 and §5b, and `DECISIONS.md` §16. Owner: "Make the game feel way more lived in… many
professions many people and events, daily life going about… people you influence in the mine should be able to go
aboveground… ending a turn is like a fast forward of watching people do stuff in the day."
1. The Day is a ~15–20 s fast-forward on one clock owned by FEEL (`feel.dayClock`, `handoffs/FEEL.md` "Round 3"). People
   follow their plans against that clock at any speed, paused, and skipped. `day(…, t)` is already pure in t, so this is an
   adapter matter. Retune DAY_V and the beat lengths for 15–20 s; the 0.1–0.2 s beats were too short anyway.
2. Plans come from LIVING (`handoffs/LIVING.md`: `planDay(...)` → per person timed stops `{t0,t1,place,activity}`; about 60
   mine workers in ≥ 20 trades, about 400 townspeople in ≥ 40). BEHAV stages them. Until LIVING lands, emit our own plans in
   that same shape behind ONE adapter file (e.g. `src/life/plans.ts`), and make `day.ts`'s `live()` / commute consume stops
   instead of inventing work.
3. Nobody lives in the mine. At shift end everyone, followers included, rides the lift up and goes home, to the tavern,
   market, chapel or wash-place. At night the mine is near empty. This drops the bunks-sleeper model: `bed()` in the mine
   becomes the exception, and the night lift and night shift shrink accordingly. The SIM request for a bigger night shift
   is superseded; keep the night life of the few who are there.
4. Weather (`weather.state`, `handoffs/WEATHER.md`): rain → indoors, hurrying (jog gait), hoods (request the clip/prop);
   storm → the lift stops early (cut the night lift timetable and the evening cage loads).
5. Life must read at every zoom, down to specks at the far view: `specks()` must carry the town's 400 (groups expanded) at
   speck cost.
Order: adapter for plans (2) → everyone goes up (3) → retune the Day for the FEEL clock (1) → weather (4) → specks at scale (5);
then the spec-v2 items below.

## Exact next steps (successor)
1. Read `docs/spec.md` v2 §3, §5, §6, §7.5, §8 and §10 (the coordinator asked; not yet read). Add visible behaviours for the
   later routines **Delve, Skim, Preach, Stand watch** in `taskBeat` (night) and `live()` (day). Add **cursed gifts delivered
   by a neighbouring follower** (walk over, hand it, leave). Add the factions' people as walkers: Council searches / guards /
   lockdown, Temple wards / purges / inquisitor, Public rumours / informers / mob. Key everything off the sim's
   "v3.1 changes" block at the top of `handoffs/P4.md` once it exists (fields assumed here: `routine`, `worn`, `dusk.tribute`,
   `zones[].depth`, `search.item`).
2. **Offering staging around the grave is not verified on screen.** In `life-offer.png` a walker shows ON the great crystal
   (it passes behind the mass at y ≈ 727, and the people layer draws over props), and the kneelers in front of the eye were
   not clearly seen. Check the positions at `offerSet` times (`/tmp/behav/look.cjs`, preset 4, rect around (1190,850)). Route
   offerers south of the mass, or request y-sorted occlusion from the people/mine renderer.
3. Tally line: the head of the line crowds (the guard and the miner overlap the front slot). Space the searcher spot and the
   `aside` spot further apart.
4. Regenerate fixtures when the sim compiles (`npx tsx tests/life/make-fixtures.ts`), then run
   `NODE_PATH=/usr/local/lib/node_modules_global flock /tmp/hg-pw-0.lock node e2e/life-shots.cjs all 1`.
5. Town life (brief item 5) was not looked at in the browser this round (the harness renders the mine only).

## Requests
- **SIM-v3 (`src/sim`, P4):** the night shift is ~18 % of the mine (`BALANCE.nightShiftShare` 0.3 → 4–7 awake of 22 in a
  2400×1400 mine; one lonely person per area at night — this is the main reason the mine reads dead while the player acts).
  Please raise it to ≈ 0.5, and put one lift hand (`work: 'lift'`) and one guard on nights. The `half-shift` preset shows the
  director at that density (13 awake, 11 doings at once, ~0.5 moving/s, no overlaps).
- **Animator (P2-people):** clips the mining beats now fall back on: `pocket` (hand to coat, glance) ← hide; `strikeLook`
  (pick stops, bend, hold the find up to the lamp) ← notice; `handIn` ← putdown; `patdown` / `searched` (arms out) ← talk / idle;
  `flare` / `scold` (overseer jabs the ledger) ← startle / talk; `snatch` ← gather; `beat` ← talk; `bow` ← pray; `offerSet`
  (kneel, set crystals down) ← putdown; `sleepCot` (lie ON the cot: body raised ≈ 8 u, sorted at the cot's front edge) — today
  sleepers lie on the floor in front of the cots. Mapping table: `CLIP` in `src/life/dayMining.ts`.
- **AMBIENT:** draw a cart in the cage when `lift.cargo` is `'ore'`/`'empty'`; ring on `liftBell` moments.
- **Play scene / FEEL / VFX:** moments to key effects on: `strike` (`data.rarity`, `data.kept`, `data.unseen` = night-shift find,
  no glint), `pocket`, `toCart`, `carted`, `tallyOpen`, `handIn`, `tallyShort`, `search`, `searchFound`, `evil` (`data.act`),
  `offerSet` (the reveal), `offerBow`, `liftBell`. The dusk offering starts the procession ≤ 280 u from the grave: cover the
  Day → Night cut so the few followers who start on the path do not visibly pop.

## Self-grade (builder #2): 6.5 / 10
The three worst faults a hostile critic would name:
1. The mine still reads empty at night. The sim puts 4–7 awake people in 12 areas (request to SIM). The director shows the
   `half-shift` density well, but the real game does not have it yet.
2. The offering procession is not proven on screen: a walker draws over the grave crystal, and the kneelers are unverified.
   The mining beats use fallback clips (pocket = hide, pat down = talk, hand in = putdown), so at play zoom they read as
   generic gestures.
3. The Day is a time-lapse. Strike, pocket and hand-in beats last 0.1–0.2 s of an 8 s replay and may be too quick to read.
   The camera has to frame them (FEEL/PLAY-WORLD), and the spec v2 routines and faction walkers are still missing.

## Round 3 status (context handoff, BEHAV #3)
Done: stage director (src/life/stage.ts, stageEvents.ts, stageFrame.ts, trades.ts, living.ts, standin.ts, slots.ts, townLayout.ts), dev harness (src/life/dev/stageHarness.ts, dev/life-stage.html), e2e strips (e2e/life-shots.cjs `stage` mode), tests/life (54 pass). Theme pass applied: squat/squatEat/greet/coverWick/heap meanings, hearths of up to 10 ("X's hearth"), funeral = burning at the burning ground ('pyre' spot, stoke, coverWick), new `emptyBurning` (StandInFacts.devoured), new `levy` (muster at drillyard, march out citygate, every 7th day), `beastCurl` moment on collapse, Lie-low followers hood:true, `light: 'white'|'brazier'|'shard'` on LifePatch / LodSpeck / CrowdPatch (lightOf in stageFrame.ts), `beasts:true` on town cart walkers.
Not done: browser strips (background run on lock 1, log /tmp/behav/stage-run.log, report /tmp/behav/life-shots.json) not yet inspected; willReadFrequently source not identified; no tests yet for emptyBurning/levy/light; town walkers ~7% of walking samples cross blocked ground; adapter not yet tried against LIVING's real planDay or the re-planned town (townFacilities/townHomes); interface block at top not yet updated for light/beasts/emptyBurning/levy/beastCurl.
Requests: animator clips squat, squatEat, greet, coverWick, heap, stoke, muster, curl, escort, knead, pump, wind, strikeLook, pocket, handIn, patdown, offerSet; CAST draws `light` (staff lamp / brazier) and `beasts` cart trains; AMBIENT cart in cage from lift.cargo, bell on liftBell.
Sim field fix (after the P4 "Step B" note): tribute now comes from dayEvents `offered { tribute: true }` (tributeIds in stageEvents.ts; `dusk.tribute` kept only as a stand-in fallback). Still to do: the same in the older night.ts path (line ~179), and night.ts depthOf should use the sim's `depthOf(zone)`/`workDepth(s, zone)` rather than `zones[].depth` (today it falls back to geometry, so it is harmless). Watch for the sim's "v3.2" block (turn becomes Night → Day → Dusk, everyone gets a surface home): the plan-time mapping in stage.ts (0 dawn … 2 night) may need its origin moved.

## Round 4 status (builder #4b, successor of the stopped round-4 builder) — keep this section current
Found on disk (07:03): tsc clean for src/life; round-4 #1 had done step 1 (night.ts tribute from `offered{tribute}` +
`depthOf` from the sim), `legalRoute` A* re-routing, a schematic proof page `src/life/dev/proof.ts` + `e2e/life-shots.cjs`
strips (`screenshots/life-follow-*.png`, `life-set-*.png`), and `tests/life/ground.test.ts` (legal ground, indoors, rain,
theme beats). The sim's **v3.2 landed** (homes above ground, tally/search at dusk) and broke 19 old `night()`/`day()`
tests in `tests/life/life.test.ts` (sleepers no longer in mine bunks, units end at their surface home).
- [done] legal ground: `clearLine` samples every 2 units (16-unit cells were clipped at corners) + string-pull `pull()` in
  `legalRoute` (no doubling back along streets). 0 blocked walking samples beyond the doorway step, seeds 9 / 3 / 21.
- [done] real inputs: `livingDays(seed, n, factsOf?)` / `livingDay(seed, d)` in `src/life/living.ts` (exported from
  `src/life`) run LIVING's `createSociety` → `planDay` chain; the stager runs on it (506 people, ~1 s a day build).
- [done] staged LIVING kinds (stageEvents.ts): `burning`/`stateBurning`/`emptyBurning` (the dead's hearth carries the
  bier and stands with covered wicks; a priest / ash keeper is found for an empty one), `levyDay` (muster at the drill
  yard, march out the gate, each hearth sees its own off at the gate), `levyCalled`/`taxCrier`/`warNews` (a crier reads
  it out), `wickBlessing` (mother kneels with the newborn, priest blesses, hearth prays), `beastMoult` (keeper scrapes,
  finder carries the shell home), `runawayTrain` (+`beastCurl`), `refugees`/`woundedHome` (innkeeper / healer meets the
  cart at the gate, the watch stands by), `procession` (the faithful fall in behind the priest; 3 in rain), `titheBurned`.
- [done] indoor work keeps the trade's own clips (`doing` = dip / grind …), `sell` = the trade's craft + haggle,
  `rounds` = the trade's clips (porter carries sacks, watchman patrols); trade test now on LIVING's real days 9 + 0:
  every trade seen at its own work. Heavy rain only (≥ 0.7 / storm) stops outdoor work; light rain = hoods, work goes on.
- [done] walking pace capped at 5.8× nominal (teleport test); route ends keep the snapped open start (doorway step only).
- [done] v3.2 offering: the bearer stays below after the shift and sets the stone down at the sim's `offered` time
  (0.92–0.955); `StageFrame.bearers` [{id, kind, arrive, leave, x, y}]; `stats` gains townOutside / townIndoors /
  mineOutside / mineIndoors / sheltering / asleep.
- [legacy] `tests/life/life.test.ts` day + mining suites skipped (pre-v3.2 Day semantics; stage() is binding); night
  suite adapted (sleepers in town). 42 pass / 23 skipped across tests/life.
- [done] tests: `tests/life/living.test.ts` (8, LIVING's real days: counters agree with specks, burning with the hearth's
  covered wicks + a stoker, empty burning, levy ranks/march + see-off, procession followers, indoor work not idle,
  dusk bearers at the sim's offering time, rain shelter + hoods). tests/life: 50 pass / 23 skipped (legacy day()).
- [done] proof page `src/life/dev/proof.ts` on LIVING's real days (facts {seed, day, devour, sim, standin}); plain-English
  captions (`say()`), a small verb tag under each figure (proof only; overlap-culled), whole-town counters per layer.
  `e2e/life-shots.cjs proof[:name]` strips: follow-miner/-town/-guard/-follower, set-liftqueue/-market/-rain/-burning/
  -empty/-levy/-patrol (night watch)/-flame/-fog/-storm/-night. Lock 1 was queued 4 deep at 07:45 (world/weather shots).
- [in progress] rendering + inspecting the strips; then fix what they show.
- [done] after looking at the first strips: LIVING's crowd homes (`homes:<zone>`) are now indoors (crowds slept in the open
  street: night counters read 371 outside / 130 in); the levied (no plan left on levy day) get a last-day plan so the
  levy strip can follow them; everyone out in the rain is hooded; proof page: no lamp glow by day, `centre(zone, tag)`,
  `queuePeak(side, a, b)`; strips take comma lists (`proof:a,b,c`).

### What the strips showed (round 4 look, before the last fixes)
- Readable: life-follow-miner (stretch → eats inside → queue → board → ride → digs → squats on the heels → drinks →
  greets brow to brow → asleep in the heap, cutaway), set-rain (stalls busy → hoods → running → square thins), set-empty
  (covered wicks round a priest, no bier), set-flame (procession with censers, faithful following, watchers),
  set-burning (mourners cover wicks, stoker).
- Weak: set-market (stall area nearly empty at midday — camera was off the stalls; recentred), set-fog (crowds stand in
  lattice blocks; carried lamps do not stand out), set-storm (pit head empty in every frame: the camera / times miss the
  last crowded cage), set-liftqueue (times missed the queue; now taken from the queue peak), set-levy (blank: the levied
  had no plan; fixed), night (crowds asleep in the street; fixed with `homes:`). The bier is only `carry: 'crate'` — CAST
  must draw it as a bier.

## Self-grade (round 4, builder #4b): 7 / 10
1. Several set-pieces still do not prove their behaviour (fog lamps, storm lift stop, market crowd density).
2. Town crowds stand and walk in visible lattice blocks (formation()), which reads as regiments, not townsfolk.
3. The legacy night()/day() path is only partly v3.2-correct (day suites skipped); PLAY-WORLD still calls night() for
   sim units at Night.

## Exact next steps (successor)
1. Run `NODE_PATH=/usr/local/lib/node_modules_global flock /tmp/hg-pw-1.lock node e2e/life-shots.cjs proof`, downscale
   and look at every `screenshots/life-follow-*.png` / `life-set-*.png`; fix set-fog (follow one lamp carrier instead of
   a fixed camera; lamps on everyone walking in fog incl. crowds), set-storm (follow the last rider up; times from
   `moments('liftStop')` and the last up-trip), set-market (check density after recentring; if thin, LIVING's market
   stops are too few — ask LIVING).
2. Loosen crowd formations at stands (jitter the lattice per member; break ranks on arrival).
3. Use TOWN-ART's `townHomes(plan)` / `townFacilities(plan)` for household doors and facility work spots in
   `townLayoutFromPlan` (today: hash-picked `door` spots per place).
4. Rebuild the legacy `day()` on `stage()` (or retire it) and un-skip / rewrite the day suites in tests/life/life.test.ts.
5. willReadFrequently: none of src/life calls getImageData; the proof strips report 0 console warnings. If a stage-page
   run still prints it, it comes from a renderer (mine/index.ts, town/index.ts, town/art/kwire.ts) — ask their owners.

## Requests (round 4)
- **PLAY-WORLD:** use `life.stage()` for sim units at Night too (v3.2: everyone sleeps above ground; `night()` is legacy);
  the Night before Day N is plan day N−2's [1.25, 2) as now (no origin move needed: LIVING's 0 = the sim's Day 0 = the
  dawn bell); for turn 1's Night use day 0's plan at t 1.25+ or hold t = 0 (all asleep). Time the offering from
  `frame.bearers[].arrive` (plan time at the grave).
- **CAST / animator:** draw `carry: 'crate'` on a pair walking to the burning ground as a bier (two bearers), `'bundle'` as
  a newborn in arms; clips still wanted: squat, squatEat, greet (brow to brow), coverWick, heap, stoke, muster, scrape,
  tend, kneel-with-bundle; `hood` over the wick; `light` (staff lamp / brazier) and `lamp` (fog).
- **FEEL:** moments to frame: burning / emptyBurning / levyDay (see-off at the gate) / procession / beastCurl / liftStop.
- [done 08:06] re-rendered follow-town/-guard/-follower, set-liftqueue/-market/-levy/-patrol/-night: market now busy
  (stalls, a cobbler taps a sole, a butcher chops, lunch on the heels, a beggar); levy follows a levied trackman in
  marching ranks out to the road; night counters now 16 outside / 485 indoors (crowd homes fixed); the watch walks with
  lamps. Still weak: the night rows frames show no cutaway heaps (the camera's doors have nobody inside — follow a hearth
  instead), the levy's muster at the drill yard and the see-off at the gate are not in frame, fog, storm.
- [done] FEEL `duskWalk` cue: `life.bearersToGrave(ids)` / `StageOpts.bearers` (note at the top of this file), test in
  tests/life/living.test.ts. tests/life: 51 pass / 23 skipped (legacy day()).

## Round 5 status (builder #5, successor) — keep this section current
Found on disk 08:09: tsc clean, tests/life 51 pass / 23 skipped. Work, in order:
- [done, code] **Crowd shapes** (`src/life/shapes.ts`, `slots.ts` rewritten): no lattice. `SlotBank.claim` takes a seeded
  nudge of up to ~½ body room per cell and keeps a point only if nobody else's point is within a body's room (spatial hash),
  with ½ room of clearance from walls in the town; `SlotBank.group(key, layer, zone, bases, n, kind, focus)` places a crowd
  by shape: `knots` (2–5 facing each other, now and then one alone), `queue` (loose line, uneven gaps, facing the head),
  `arc` (round a focus: chapel, sermon, burning, crier), `ranks` (drill/muster only), `spread` (a crew at work), `heap`
  (sleepers). Every member carries its facing (`CrowdMember.facing` is now per member). Event beats with no place get
  knots on free ground. Walking crowds are a ragged stream (uneven gaps, some two abreast). Milling (`mill()`): weight
  shift, a step, a look round, each on its own phase; cycles (`cyc`) and member meanings run on per-person phases.
  Individuals standing about turn to the nearest person standing near them (`faceNeighbours` in stageFrame).
- [done, code] **Market crowds browse** (`Builder.browseCrowd`): a crowd at a market stop breaks up; each member walks
  (legal route) from stall to stall, stops at one of 6 browse spots round each stall (shared by all crowds, taken in turns:
  `Built.pools`), haggles / weighs / points, moves on, ~70 % carry a sack or bundle away (`walk:sack`), children run about,
  ~20 % only talk in their knot; all are back in their knot when the crowd leaves.
- [done, code] **Real doors**: `townLayoutFromPlan` now also returns `facilities` (TOWN-ART `townFacilities`, mapped to
  LIVING place ids) and `homes` (`townHomes`); each household gets its own dwelling door in its zone (`hearthDoors`),
  facilities use their real door and work spots.
- [done, code] **Legacy `day()`** now delegates to `stage()` on the stand-in day for `before.turn − 1` with the sim's units
  and the Day's events; the two skipped suites are rewritten on it (no skips).
- [done] proof strips: rows 3–4 of every strip are the same moments with **no tags at the game's figure size** (town 22 px,
  mine 45 px); figures are drawn at true scale (`CellSpec.px`). Market strip times follow LIVING's two waves.
- [done] tests/life: **74 pass, 0 skipped** (legacy day suites rewritten on stage(); new FIFO test on the scheduler's
  own waits; overlap test now skips members walking inside a stand; ground test now also checks members browsing).
- Numbers (headless, `/tmp/behav/metrics.ts`, LIVING seed 9, real town plan; frame = the market's stalls at the game's
  town scale, 248 × 189 world units): **market day (day 9)** in frame 0 @0.06, 30 @0.2, 54 @0.4, 139 @0.49 (27 walking),
  **149 @0.515**, 51 @0.7, 130 @0.845 (65 walking), 139 @0.87, 78 @0.9, 10 @0.93; **a workday (day 8)** peaks at 35.
  Standing people outdoors (4 times of day): 87 % in company (within 2 rooms of someone), 13 % alone.
- **LIVING's market (numbers for LIVING):** on market day 9 the `market` activity holds 0 people from dawn to 0.47
  (sellers 19–25 and 10 beggars are the only people at the stalls all morning), 77–129 in 0.475–0.52 (a 0.05 lunch
  wave = ~1 film second), 0–2 in 0.55–0.82, 146–148 in 0.85–0.875, then 44 / 29 / 10 by 0.95. Everyone in a wave
  arrives within 0.01 of each other. The stager spreads them (ragged streams, staggered browse legs) but cannot invent
  a morning crowd.
- Build cost: a LIVING day builds in ~3–8 s under load 12–16 (town routing ≈ 70 % of it, ~1.5–3 ms a route).
- [done] market extras: short stops (the 0.05 lunch wave) are browsed in time-lapse (quicker steps, shorter stops);
  at the midday rush some queue at the cake stall (the stall nearest the bakery: `Builder.cookQueue`, ranks taken in
  turns) then eat squatting; knots at the market talk / point / greet (no cheering).
- [done] legal ground kept: `TownGround.reach()` (the main connected open ground, flood-filled once); claims refuse
  points in enclosed pockets; plan doors whose nearest open ground is a pocket are not used (`doorOk`); gridPath retries
  with a wider box. tests/life **74 pass, 0 skipped** (09:5x).
- [blocked, waiting] browser strips: queued on lock 1 since 09:00 (`/tmp/behav/shots2.log`, all proof strips with the
  new tagless game-scale rows); lock 1 had 6+ long jobs queued (world-shots, audio, weather, p6r8…).

- [done 09:36] strips rendered (all proof strips, 0 console errors). Graded from rows 3–4 (no tags, 22 / 45 px):
  - **market** (`life-set-market`): reads as a market without tags. In frame 0 @0.06, 30 @0.2, 47 @0.4, 59 @0.47,
    146 @0.49, **154 @0.52**, 64 @0.7, 141 @0.84, 154 @0.87, 11 @0.93. Browsing, carrying away, knots. Weak: the
    morning is thin (LIVING), and figures overlap the stall awnings in the proof drawing (stalls are FLAT in
    `townLayoutFromPlan`, so people may stand on a stall's footprint; check in the real renderer).
  - **pit queue** (`life-set-liftqueue`): a long loose line from the cage at 0.15–0.18 that reads as a queue; the
    cage fills (12/6 shown in the tag = two loads). Dusk at the pit head is empty between trips (riders leave quickly).
  - **fog**: one lamp carrier crossing the square, others faint at the edges. Reads; quiet.
  - **storm**: the last riders up in the mine (45 px), the cage at the pit head, then the walk home and in. Reads.
  - **night**: evening crowd at a hearth/tavern door (30+), then the watch, five with lamps, walking the rounds. The
    watch is a tight clump (reads as "a group with lamps", not as a patrol line).
  - **levy**: was BROKEN (the levied one never went: his take failed because he was due in the mine later, and
    everyone who did march came back home). Fixed 09:4x: the levied (not the captain, not a work gang) march from
    the yard out of the gate and are gone for the rest of the day (`Ov.away()`, hidden `doing:'away'`); the hearths
    see them off at the gate until z + 0.1. Headless: e02/p028/p091/p350 muster ~0.18, march 0.18–0.53, pass the
    gate ~0.35, gone after. The strip re-render was queued on lock 1 (`/tmp/behav/levy.log`); the gate cells now
    sample the moment the followed one passes the gate.
  - **follow-town**: the stream of small pale figures at 0.52 (children running?) and a group standing hard against a
    wall at 0.71–0.73 read poorly at 22 px.
- [done 10:0x] **stalls are solid** (`townLayoutFromPlan`: `stall` left `FLAT`, marked at 80 % of its footprint):
  people on a stall's footprint at the market peak fell from 62–68 of ~350 outdoors to 14–20 (cell-edge cases).
- tests/life: **74 / 74**, tsc clean for src/life + tests/life (the two 14-build theme tests' timeouts raised to 240 s:
  they take 60–85 s on a box at load 24).

### Self-grade (builder #5): 7.5 / 10
Market, queue, storm and fog read without tags; crowds no longer lattice. Below 8 because: the levy and market strips are not yet
re-shot after the fixes, the watch file is not yet seen in a strip, a few people still stand at stall edges and against walls,
and LIVING's morning market is empty (not the stager's to invent).

### Exact next steps (successor, round 5)
1. Check `/tmp/behav/levy.log` (or rerun `flock /tmp/hg-pw-1.lock env NODE_PATH=/usr/local/lib/node_modules_global
   node e2e/life-shots.cjs proof:life-set-levy`), view rows 3–4 of `screenshots/life-set-levy.png`: ranks at the yard,
   the column at the gate, the hearths watching.
2. Patrol: [done code 10:2x] a crowd whose work is `rounds` (the watch) walks in a spaced file, ~14–17 units apart,
   never abreast (`streamOf`); headless at 1.45: members at 0 / 16 / 30 / 46 / 62 along the route. Re-shoot
   `life-set-night` / `life-set-patrol` to see it.
3. Re-shoot `life-set-market` (stalls now solid) and check the market still reads full; then the wall clearance at
   0.71 in `life-follow-town`.
4. If the build cost matters to PLAY-WORLD (3–8 s a LIVING day under load), cache `legalRoute` per (cell a, cell b)
   or precompute an open-grid component/visibility map; `pull()` and `clearLine` dominate.
