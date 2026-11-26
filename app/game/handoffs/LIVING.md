# LIVING — the society, its calendar, its weather and its events (rules side)

Brief: `handoffs/briefs/LIVING.md`. Headless. Scratch `/tmp/living/`. Owns `src/sim/living/**`, `tests/living/**`,
`scripts/living-*.ts`, this file, `### LIVING — The society` in DECISIONS.md.
Self-contained: imports nothing outside `src/sim/living/`. Zone ids are the sim's (`src/sim/types.ts` / `content/maps.ts`)
copied into `living/world.ts` as the default layout; the sim passes its own layout and units through `adapter.ts`.

## NIGHT-LIFE (2026-11-23) — the pit works a day shift and a night shift (DECISIONS §44)
- `society.ts`: `PIT_NIGHT_SHARE` deals each mine trade's night shift exactly around the sim's own people, whose shifts are the
  rules' roll: `createSociety(seed, layout?, simShifts?)` with `simShifts = simShiftsOf(seed)` (src/sim/state.ts; passed by
  `makeSociety` and the play scene's `SocietyAdapter`). Without it LIVING deals `SIM_NIGHT_SHARE` of them itself. The mine is 81
  (more hewers and haulers, a night overseer). Non-adopted night hewers work the main faces. The rules are unchanged.
- `plans.ts`: `PIT` (the shift clock), `hoursOf`, `shiftAnchors` (meal by face, errands: `water` / `errand`, night `doze`),
  `mineDay` (household-staggered walk-in, face-by-face relief at dusk, the pit clerk late), `mineNight` (relieved at dawn, sleeps
  ≥ 6.5 h by day, the afternoon at home or the market, down at dusk; the sim's night hands stay at their post all night). New activities `water`, `errand`, `doze` (additive).
- Proof: `tests/living/nightlife.test.ts`; census `CENSUS=1 npx vitest run tests/play-world/census.test.ts`; frames
  `screenshots/nightlife-*.png` (`e2e/playtest/nightlife-shots.cjs`).

## PERF (2026-11-23) — `planDay` is copy-on-write; every output is unchanged byte for byte — SIM builder: rerun the table
- **Same interface, same results.** `planDay` no longer JSON-clones the society. It plans on a draft (`living/cow.ts`) that **shares**
  every person, hearth (household), crowd (group), the `order` list and the records that hold them with its input, and **clones**
  only the chronicle (`ends` shared: it is only read and then replaced whole; history / lasting / the flat number records copied
  one level; chains and anything unknown JSON-cloned). Every write in a day goes through `touch(soc, p)` / `touchHearth` /
  `touchGroup` / `addPerson` / `touchOrder`, which clone that one object on its first write of the day and put the copy in a
  copied record. A day clones 0 people (median; p90 2, max 6 over 3 seeds × 60 days) and 0–2 hearths: nearly every person object is shared day to day.
  The input is never written: a deep-frozen society plans fine (`tests/living/perf.test.ts`, `scripts/living-golden.ts freeze`).
  Called on a plain society outside `planDay` (the tests' and coverage script's direct `rollEvents`), the touch helpers write in
  place as before.
- **Everything returned is plain JSON data** (no Map / Set / class in the state; indexes live in WeakMaps or last-value caches outside
  it). **Returned data is now shared between days and societies** — person objects, hearths, lasting-effect records, and each stop's
  `via` list (frozen; shared by the stops that walk the same trip). Treat a DayPlan and `plan.next` as read-only (nothing in `src/`
  writes them today).
- **Proof**: `npx tsx scripts/living-golden.ts check` — full DayPlan hashes for seeds 1–5 × 60 chained days with a synthetic fact
  sequence (followers, devotion, deaths, devourings, searches, the count: 166 echo events) — **identical to the pre-perf code**
  (`/tmp/livingperf/golden.orig.json`); `botcheck` — 129 days of inputs recorded from real `sensible` bot runs — identical;
  whole bot runs (`playRun` seeds 1–4, `sensible`) hash identical with the old and new LIVING on the same sim snapshot.
- **Timings** (thread CPU, medians; the 4-core box at load 15–30, so take the ratios, not the absolutes):

  | | before | after | × |
  |---|---|---|---|
  | `planDay`, synthetic 5 × 60 days, warm | 8.3 ms | 2.8 ms | 3.0 |
  | `planDay`, recorded bot inputs, warm | 7.5–9.2 ms | 2.5–2.75 ms | 3.0–3.4 |
  | `planDay`, recorded bot inputs, one cold pass | 9.2 ms | 4.05 ms | 2.3 |
  | `planDay` inside real bot runs (3 seeds) | 429 ms/run | 230–242 ms/run | 1.8 |
  | whole `sensible` bot run (`playRun`, 4 seeds) | 2159 / 2285 ms | 1798 / 1937 ms | −15…17 % |

  Inside a bot run `planDay` pays more (cold JIT for the first days, and the big heap's GC charged to whatever allocates); the clone
  itself (was ~45 % of `planDay` in a bot run) is gone. **The 4× target is not reached**: about 3× warm, 1.8× in-bot. What is left
  is the plans themselves (~45 %: ~190 actors × ~18 stops, all of it output), events (~20 %), the feed (~20 %).
- **Why no plan-template cache**: every plan draws from its own (seed, 'plan', day, id) random stream, so no two plans share inputs;
  caching templates by (trade, shift, calendar, weather) would change outputs. Instead the plan code was made cheaper with exact
  equivalents: trips (travel segments) cached by (from place, to place) with the zones checked, zone paths / travel times / hearth
  zones memoised, per-actor shelter thresholds and the plan rng's hash prefix cached, closures hoisted, crowd actors in one pass,
  weather splits without temp arrays. Events: the living lists rebuilt only when a person object is replaced, born, killed or
  joins a crowd; `pickTrade` (an index by trade) for the 59 casts that picked by trade alone. Feed: one pass over the plans builds
  the lift / work / life lists (was four), yesterday's sorted id list reused.
- **Tools**: `scripts/living-golden.ts write|check|freeze|time|botwrite|botcheck|bottime` (golden hashes + timing; the recorded bot
  inputs are `/tmp/livingperf/botfacts.json`), `scripts/living-botrun.ts [seeds]` (CPU of in-process bot runs).
- **DECISIONS.md**: this job could not edit it (outside its files). Orchestrator, please copy the first and the "Why no
  plan-template cache" bullets into `### LIVING — The society`.

## PUBLIC INTERFACE (binding; additive changes only) — `import … from 'src/sim/living'`

```ts
// ---------- entry points (pure, deterministic; inputs are never mutated) ----------
createSociety(seed: number, layout?: LivingLayout): Society
planDay(society: Society, dayIndex: number, simFacts?: Partial<SimFacts>): DayPlan
//   dayIndex 0-based (= sim turn − 1). Pass `plan.next` as the society for the following day: it carries the chronicle
//   (running chains, lasting effects, cooldowns, births / deaths / weddings). Same (society, dayIndex, facts) → same DayPlan.
mergeFeed<T extends { time: number }>(living: FeedItem[], sim: T[]): (FeedItem | T)[]   // stable sort by time
whereAt(stops: Stop[], t: number): Stop                         // the stop covering t (t in [0, 2))
planOf(day: DayPlan, personId: PersonId): Stop[]                // a person's own plan, or their group's
presentAt(day: DayPlan, zone: ZoneId, t: number): Presence[]    // who is in a zone at t (individuals + groups with counts)
nearby(day: DayPlan, personId: PersonId, t: number): Presence[] // everyone in the same zone at t (witnesses, reach)
haunts(society: Society, personId: PersonId): Haunt[]           // home, work, tavern table, chapel bench, wash-place… (colour seeds)
colourSeeds(society: Society, followers: PersonId[]): Haunt[]   // merged haunts of all followers, weighted (above-ground seeds)
calendarOf(dayIndex: number): CalendarDay
weatherOf(seed: number, dayIndex: number): DayWeather           // pure; same as day.weather
weatherAt(w: DayWeather, t: number): WeatherSlice               // the slice covering t in [0, 1]
travelTime(layout: LivingLayout, from: PlaceId, to: PlaceId): number

// ---------- time ----------
// t is a day fraction: 0 = the dawn bell, 1 = dusk (the Day film's 0–1, same as the sim's Day event `time`);
// 1–1.25 = the evening (tavern, table, chapel); 1.25–2 = the night (sleep / night shift) up to the next dawn.
// Every plan covers [0, 2) with contiguous stops; a person ends day N where they start day N+1.

// ---------- ids ----------
type ZoneId = string    // the sim's 12 mine + 13 town zone ids
type PlaceId = string   // a spot inside a zone: PLACES (static) or 'home:<householdId>'
type PersonId = string  // adopted sim unit ids (g01…, t01…) or generated 'p001'…
type GroupId = string   // 'grp:<trade>:<n>' — town headcount crowds
type TradeId = (see TRADES: 24 mine + 50 town)      MINE_TRADES, TOWN_TRADES, TRADE_IDS
type ActivityId = 'sleep'|'wake'|'eat'|'walk'|'liftDown'|'liftUp'|'queue'|'work'|'break'|'rounds'|'market'|'tavern'
  |'chapel'|'service'|'procession'|'wash'|'well'|'home'|'family'|'visit'|'court'|'play'|'beg'|'drill'|'preach'|'sell'
  |'shelter'|'mourn'|'wedding'|'funeral'|'search'|'gather'|'tend'|'idle'|'pay'|'strike'|'school'
ACTIVITIES: readonly ActivityId[]
type WeatherKind = 'clear'|'overcast'|'drizzle'|'rain'|'storm'|'fog'|'wind'|'coldDawn'          WEATHER_KINDS
type CalendarKind = 'workday'|'marketday'|'payday'|'flameday'|'restday'                         CALENDAR_KINDS
type EventKind = (one per EventDef id; ≥ 60)                                                    EVENT_KINDS, EVENTS
type FeedKind = 'weather'|'calendar'|'life'|'event'|'echo'                                     // the note's family
type EffectKind = 'strike'|'crew'|'whisper'|'whisperZone'|'search'|'suspicion'|'notice'|'guards'|'liftStop'
  |'countTolerance'|'hold'|'reach'|'crowd'
TRAITS = sim TraitId ('greedy'|'pious'|'grieving'|'ambitious'|'fearful'|'curious'|'bitter'|'loyal')
TEMPERS = 'calm'|'hot'|'gloomy'|'merry'|'sly'|'shy'

// ---------- the society ----------
interface Society {
  seed: number; day: number /* last planned dayIndex, −1 fresh */;
  layout: LivingLayout;
  people: Record<PersonId, Person>; households: Record<string, Household>; groups: Record<GroupId, Group>;
  order: PersonId[];            // stable iteration order
  chronicle: Chronicle;         // running chains, lasting effects, cooldowns, history (plain JSON)
}
interface Person {
  id; name; trade: TradeId; side: 'mine'|'town'; simRole: string | null /* nearest sim RoleId */;
  household: string; home: PlaceId; homeZone: ZoneId; work: PlaceId; workZone: ZoneId;
  shift: 'day'|'night'; habits: { tavern: PlaceId | null; chapel: PlaceId | null; market: boolean; wash: PlaceId | null };
  ties: Tie[] /* 2–4 */; trait: TraitId; temper: Temper; age: 'child'|'young'|'adult'|'old';
  key: boolean /* individual in the town (Elites, masters, adopted) */; group: GroupId | null /* town crowd member */;
  alive: boolean; gone?: string; line: string /* who they are, one plain line for the card */;
}
interface Tie { kind: 'kin'|'friend'|'owes'|'owed'|'rival'|'lover'; to: PersonId; rel?: 'spouse'|'parent'|'child'|'sibling'|'cousin' }
interface Household { id; home: PlaceId; zone: ZoneId; members: PersonId[]; name: string /* "Bram's house" */ }
interface Group { id: GroupId; trade: TradeId; name: string; count: number; members: PersonId[]; homeZone: ZoneId; work: PlaceId; workZone: ZoneId; shift: 'day'|'night' }
interface TradeDef {
  id; name; plural; side: 'mine'|'town'; simRole: string | null; work: PlaceId[]; shift: 'day'|'night'|'mixed';
  rounds: PlaceId[] | null;      // walks these during work (lamplighter: every street at dusk; guard: the rounds)
  sees: SeeTag[];                // 'carts'|'count'|'faces'|'lift'|'streets'|'homes'|'ledgers'|'sermons'|'gate'|'dead'|'goods'|'talk'|'water'|'sick'
  access: 'mine'|'town'|'both'|'everywhere';   // midwife: everywhere (let in anywhere)
  gift: string;                  // what they can do for the god, plain ("touches every cart")
  reach: number;                 // extra zones of whisper reach a follower of this trade brings (0–2)
  weight: number; line: string;
}

// ---------- the day ----------
interface DayPlan {
  dayIndex; calendar: CalendarDay; weather: DayWeather;
  plans: Record<PersonId | GroupId, Stop[]>;   // every alive individual + every group (crowd members use the group's)
  events: DayEvent[];  feed: FeedItem[] /* ordered by time, 8–16 a normal day */;  effects: DayEffects;
  next: Society;                               // the society after this day (pass to the next planDay)
}
interface Stop { t0; t1; place: PlaceId; zone: ZoneId; activity: ActivityId; from?: PlaceId /* walks */; via?: ZoneId[]; with?: PersonId[]; event?: string }
interface CalendarDay { dayIndex; week; weekday: 0..6; kind: CalendarKind; name: string; payday: boolean; market: boolean;
  flame: boolean; rest: boolean; count: boolean; carts: boolean /* crystal carts leave for the city */; line: string }
interface WeatherSlice { t; kind: WeatherKind; strength: 0..1; windDir: number /* degrees the wind comes FROM, 0 = north */; wind: 0..1; cold: 0..1 }
interface DayWeather { dayIndex; slices: WeatherSlice[] /* t ascending, first t = 0 */; main: WeatherKind; rainy: boolean; line: string }
interface DayEvent { id: string /* unique per run */; kind: EventKind; time; place: PlaceId; zone: ZoneId; who: PersonId[];
  textKey; slots; text /* fallback */; weight; chain?: { id; step; of } ; echo?: string /* sim act it answers */; effects: LivingEffect[] }
interface FeedItem { time; kind: FeedKind; place: PlaceId; zone: ZoneId; who: PersonId[]; textKey: string; slots: Record<string, string | number>;
  text: string /* plain fallback */; weight: 0..1 /* ≥ 0.8 slows the film / takes the camera */; event?: string }
interface LivingEffect { kind: EffectKind; target: string /* zone | person | faction | '*' */; value: number; source: string; why: string; from: number; until: number /* dayIndex inclusive */ }
interface DayEffects {
  list: LivingEffect[];                                   // everything active today, with its plain why
  strike: Record<ZoneId, number>;    // × strike chance per face (rain floods lowgallery/sump)
  crew: Record<ZoneId, number>;      // × diggers at work per zone (Flame's day 0.5, rest day 0.25, strike over pay…)
  whisper: Record<PersonId, number>; // + whisper odds per person (a grieving widow +0.15)
  whisperZone: Record<ZoneId, number>; // + whisper odds for anyone there (payday tavern talk)
  search: Record<ZoneId | '*', number>; // × search / watch chance (fog 0.6)
  suspicion: { cult: number; government: number; public: number };   // + added today
  notice: { cult: number; government: number; public: number };      // × on today's suspicion gains
  guards: Record<ZoneId, number>;    // + guards posted (a brawl draws 2 from the lift to the rows)
  liftStop: number | null;           // t at which the lift stops (storm)
  countTolerance: number;            // × the count's forgiveness (cart days 0.7)
  hold: Record<ZoneId, number>;      // × colour spread
  reach: number;                     // + whisper reach in zones (wind carries rumours)
  crowd: Record<ZoneId, number>;     // × people present (festival fills the chapel, empties the rows)
}

// ---------- what the sim gives (all optional; standalone runs without) ----------
interface SimFacts {
  turn: number; stage: 'whisper'|'shade';
  followers: PersonId[]; devotion: Record<PersonId, number>;
  hold: Record<ZoneId, number>;                          // 0..100
  suspicion: { cult: number; government: number; public: number };
  gone: { id: PersonId; why: 'devoured'|'taken'|'burned'|'sacrificed'|'killed'|'died'|'exposed'; zone?: ZoneId }[];   // since the last day
  acts: { kind: string /* EvilId | 'miracle' | 'search' | 'purge' | 'exposure' | 'lockdown' | 'hunter' | 'ward' */; zone?: ZoneId; target?: PersonId }[];
  count: { short: number; searched: boolean } | null;    // the last count
}

// ---------- the layout ----------
interface LivingLayout {
  zones: { id: ZoneId; region: 'mine'|'town' }[]; edges: [ZoneId, ZoneId][];
  places: PlaceDef[];                                    // default: PLACES
  adopt?: AdoptPerson[];                                 // sim units to adopt with their ids (default: the 58 stand-ins)
}
interface PlaceDef { id: PlaceId; zone: ZoneId; kind: PlaceKind; name: string; indoor: boolean }
interface AdoptPerson { id: PersonId; name: string; role: string /* sim RoleId */; trait: string; post: ZoneId }
DEFAULT_LAYOUT, PLACES, ZONES, EDGES
// adapter.ts — the thin mapping the sim builder calls:
layoutFromSim(map: { zones: { id; region }[]; edges }, units: { id; name; role; trait; work|post }[]): LivingLayout
factsFromSim(state: SimStateLike, lastNightEvents?: { kind: string; [k: string]: unknown }[]): Partial<SimFacts>
foldInto(effects: DayEffects): SimHooks   // per-zone/per-unit numbers in the shape the sim's dawn reads (see Requests)
```

## Additions to the interface (successor, additive)
```ts
NOTE_KEYS: Record<LivingEventId, WriterEventId>      // where the writer drafted the same happening under another id
LIVING_NOTE_ALIAS: Record<'event.<ours>', 'event.<theirs>'>   // WRITING: Object.assign(NOTE_ALIAS, LIVING_NOTE_ALIAS)
noteKeyOf(kind) → 'event.<kind>'                      // every event FeedItem's textKey
buildFeed(soc, partialDay, facts): FeedItem[]; FEED_MIN = 8; FEED_MAX = 16
Person.lodger?: boolean                               // lives in a hearth that is not their kin's
layoutFromSim / factsFromSim / foldInto (adapter.ts) + types SimHooks, SimStateLike, SimUnitLike, SimMapLike
FeedItem.textKey families: 'event.<id>' | 'weather.<kind>' | 'calendar.<kind>' | 'calendar.carts' | 'calendar.count' | 'life.<activity>'
  | 'life.work.<tradeId>' (follow-up) | 'life.liftDown' | 'life.liftUp'
FeedItem.slots: name, name2 (two-person notes), place (a place NAME: "the wash-place", "the third hearth in the rows"), n; life notes add trade
```

## Status
- [x] M1 interface + population + hearths + trades + daily plans. Seed 1: **506 people — 62 mine in 24 trades, 444 town in 51
  trades; 54 hearths** (52 homes of 7–11, typically 9: three generations — an elder, a head couple, a grown couple, children — and
  a lodger or two; plus the barracks and the temple house), 60 town crowds.
- [x] M2 calendar + weather + rule effects (unchanged).
- [x] M3 **105 event kinds, 16 chains (2–4 steps), 13 echo kinds** covering every EvilId plus search/purge/exposure/lockdown/
  hunter/ward/miracle/count; the feed (`feed.ts`); `notekeys.ts`; theme pass (below). 3.8 events a day on average.
- [x] M4 `adapter.ts`; tests; the week print; DECISIONS note.
- Tests: `npx vitest run tests/living` → **28 passing** (38 after the follow-up, see its section) (society 9, calendar-weather 7 … events 9, adapter 3), ~25 s under load 16.
  `tests/living/events.test.ts`: ≥ 60 kinds; every kind fires over seeds 1–40 × 120 days with forced facts/followers; every chain
  reaches its last step; echoes once per fact; the levy on its day (3 after it is called), takes ≥ 3, guards −1 at the lift, search
  × 0.85, gone after 8 days; every effect present from its day to `until` and gone after; the feed 8–16, sorted, every event, 1–3
  weather notes on a day the weather turns, 1–2 calendar notes, zones valid, no `{slot}`/undefined in text; plans valid for 60 days
  through births, deaths, weddings, the levy, refugees; hearths 8–10, three generations, lodgers; determinism.
- Scripts: `scripts/living-week.ts [seed] [days] [ids] [--brief]`, `scripts/living-coverage.ts [seeds] [days]` (events only, fast),
  `scripts/living-stats.ts [seed]` (population and hearths).

### Theme pass (docs/theme.md §3–4, §10)
- Hearths (above); person lines say "Lives at the fourteenth hearth in the rows, nine under one shell, with Viny, old Tok and two children".
- **Burnings, not burials:** `funeral` → `burning` ("carried to the burning ground and burned, wick first … hum the long low hum");
  `emptyFuneral` → `emptyBurning` — **no body to burn is a scandal**: public suspicion +1, notice public × 1.15 and cult × 1.1 for 3 days;
  `stateFuneral` → `stateBurning`. Place `graveyard` is named "the burning ground"; the gravedigger trade is the "ash keeper".
- **The war:** `warNews` read in the market on market day; `quotaRaised` (count tolerance × 0.85 for 7 days, faces resent it);
  **the levy** — `levyCalled` every second week on its first day, `levyDay` three days later: takes 3–5 of the strong (never sim
  units), guards −1 at the lift / pit head / market and −2 at the barracks, search × 0.85 everywhere, crews × 0.9 for a week, grief
  for their kin; `woundedHome` (a new bitter, dim-wicked person joins a hearth, whisper +0.15 for 10 days); `refugees` (two lodgers
  join a hearth, whisper +0.12).
- **Pit beasts, skitters, lamp-moths:** `beastMoult` (the shed shell roofs a hearth), `runawayTrain`, `sickBeast`/`beastDies`,
  `rats` → `skitters`, `lampMoths` (search × 0.85 where the lamps are dimmed).
- **Temple:** `titheBurned` (Flame's day), `wickBlessing` (birth → blessing 2–4 days later: "lights its wick from the Flame. It burns
  gold"), `procession` (brass bowls, not bells). **Council:** `countAudit`, `lampsIssued`, the inspector chain, `taxCrier`.
- Human-world words removed from LIVING's text: coin → clay chits, soldiers → guards in pale plate, bells → brass bowls, purse → chit
  pouch, letters → knot-cords under seal, rats → skitters, house → hearth, the inspector walks (no riding).

## Event kinds (EVENT_KINDS, 105)
courtship betrothal wedding labour birth oldDeath burning quarrel brawl debtCalled debtThreat debtPaid lostChild childFound
loversCaught newArrival fever feverSpreads feverToll apprentice propCollapse propInquiry sickBeast beastDies skitters newSeam injury
doubleQuota badAir cartDerail liftJam powderMisfire goodShift peddlerDown paymaster caravan caravanLeaves cartsLeave thiefMarket
smugglersCaught smuggleRun taxCrier guardRotation inspectorNews inspectorArrives inspectorAtPit inspectorLeaves payShort payMeeting
payStrike paySettled forgeAccident washGossip elderStory childrenDare breadPrice stallFeud sermonGreed procession wanderingPreacher
preacherDriven alms confession beggarProphecy festivalPrep festival feastMorning warNews quotaRaised levyCalled levyDay woundedHome
refugees floodSouthLoop lightning roofTorn fogCarter frost windBells rainTavern sleepTalker followerKindness strangeDreams beastMoult
runawayTrain lampMoths titheBurned wickBlessing countAudit lampsIssued missing emptyBurning takenTalk trial searchGrumble
sermonAfterPurge rescueDig sickWater sabotageInquiry curfew boltedDoors reconsecration stateBurning miracleTalk shortCount
(`node -e` / `EVENT_KINDS` is the source of truth.) Same ids as the writer's: courtship wedding birth quarrel brawl debtCalled lostChild
childFound apprentice propCollapse sickBeast newSeam injury liftJam caravan cartsLeave guardRotation payStrike breadPrice procession
alms festival warNews missing. Mapped through `NOTE_KEYS` (ours → theirs): oldDeath/feverToll → death; burning/emptyBurning → funeral;
newArrival → newcomer; fever/feverSpreads → sickness; skitters → rats; badAir → gas; cartDerail → cartBroken; peddlerDown → peddler;
thiefMarket → theft; smuggleRun → smuggler; smugglersCaught → arrest; inspectorArrives → inspector; paySettled → strikeEnds;
washGossip → washday; elderStory → ghostStory; childrenDare → childrenPlay; stallFeud → feud; sermonGreed → sermon;
wanderingPreacher → preacher; levyCalled → conscription; woundedHome → soldierHome; rainTavern → tavernSong; floodSouthLoop → flooding;
sleepTalker → sleepwalker; beggarProphecy → fortune; taxCrier → councilNotice; sickWater → wellFoul; debtPaid → reconciled;
goodShift → promotion. Everything else falls back to LIVING's own `text` (which is themed and specific).

## Requests
**To the sim builder** (`src/sim/livingBridge.ts` already does most of this — keep it):
1. Call `planDay(society, turn − 1, facts)` **once per turn** at the start of the Day and keep `plan.next` as the society; never
   re-plan a day (echoes are keyed by turn and fire once; re-planning from the same society is pure and safe, but do not feed
   `plan.next` back twice).
2. Fold `plan.effects` (or `foldInto(plan.effects)`) into the dawn: strike × by face, crew × by zone, guards + by zone (negative =
   gone with the levy / at a brawl), search × by zone × `search['*']`, whisper + by person and by zone, count tolerance, liftStop,
   reach, notice ×, suspicion +, hold ×, crowd ×.
3. Pass `SimFacts`: followers, devotion, hold, suspicion, **gone since last day (each once)**, last night's acts (EvilId, miracle,
   search, purge, exposure, lockdown, hunter, ward), the last count. Add `levied: 'taken'` to `GONE_WHY` if sim units can be levied
   (LIVING never levies or kills an adopted sim unit on its own; only echoes of the sim's own `gone` do).
4. Show `plan.feed` in the Day, merged with the sim's own events by time (`mergeFeed`); weight ≥ 0.8 (levy day, missing, the
   inspector at the count) may take the camera. Every note has `place` + `zone` to point at.
**To WRITING:** `Object.assign(NOTE_ALIAS, LIVING_NOTE_ALIAS)` (import from `src/sim/living` in a test or at the HUD, or copy the
table); re-theme the drafted lines that still say *buried*, *rats*, *candle*, *onions*, *bread sent*, *beer and shawl*, *dog*
(theme §3–4, §10); new LIVING ids with no writer key yet: levyDay, quotaRaised, refugees, beastMoult, runawayTrain, lampMoths,
titheBurned, wickBlessing, countAudit, lampsIssued, emptyBurning (a separate "no body to burn" pool would be better than funeral),
stateBurning, labour, betrothal, plus `calendar.carts` / `calendar.count` and `life.<sell|preach|drill|tend|school|eat|break|pay|service|well>`.
**To BEHAV:** `tests/life/stage.test.ts` "every trade present is seen doing its own work" now reports `watchman` missing (seed 9, the
stand-in day) after the hearth rework changed the society's draw. LIVING's plans for both watchman crowds are `rounds` all shift
(checked); the director's pose sampling of the watchman entity no longer lands on `patrol`/`notice`. Please re-check on your side.
**To HUD:** the person card can show `person.line` (hearth, kin, debts, rivals) and the hearth name (`households[p.household].name`).

## Self-grade (rule 13): 8/10
Read the week below as a player: the town has a rhythm (the shift going down, payday chits and a tavern fight, the Flame's day
procession and tithe, the levy called and marched out three days later), people with hearths and grudges recur across days (Nan and
Blesin, Karne and Trasso, Blisna's baby blessed two days after its birth), the weather turns and the notes say so, and every
happening carries a small real effect the sim can use. The three worst faults a hostile critic would name:
1. Life notes are template lines (≈ 2–3 variants per activity); over a long run "Mott takes a break at the pit kitchen" repeats.
   The writer's `life.*` pools should take over; the trade-specific work note is still missing.
2. Effects are many and small (a levy day lists 30+ effect lines); the sim may need to clamp, and the HUD should show only the top
   two or three "why" lines.
3. Text is still LIVING's fallback for most events until WRITING merges the alias and re-themes its pools; a few of the writer's
   drafted lines break the theme (see Requests).

## Next steps (for a successor)
- (done in the follow-up) trade-flavoured work notes. Still open: more variants per generic life note.
- If the sim builder wants it: a `levy` day flag on `CalendarDay` (today it is an event chain on a fixed rhythm: called on the first day
  of every second week, marched on the fourth).
- Tune event density per stage (Shade could add more Council and Temple events as suspicion rises: today only a few `when`s read
  `facts.suspicion`).

## Follow-up (round 4, the writer's requests) — status: done
Interface shapes are unchanged; every id is stable (trade ids, place ids, event kinds, note keys). Additive only. Tests:
`npx vitest run tests/living tests/content` → **136 passing** (living 38: the old 28 + `theme.test.ts` 3 + `followup.test.ts` 7; content 98).
Under machine load the old long tests timed out at vitest's default 5 s; every test in `events.test.ts` that runs 20+ days now has a 120 s timeout.

**1. Work notes and the lift in the feed** (`feed.ts`; `NOTE` keys the writer's `WORK_NOTE_KEYS` / `keyOf` already read)
- `life.work.<tradeId>`, slots `tradeId`, `name`, `place` (a place NAME), `trade` (the trade's display name). About three a day, aimed at 0.2 / 0.5 / 0.78 of
  the day (± 0.05, then placed inside a stop where that trade is at work, so they are spread across the shift). Weight 0.12 (light).
  Seen doing their own work = a `work` / `rounds` / `sell` / `preach` / `drill` / `tend` / `school` stop. A different trade each note (a seeded circle of all 75
  trades, a new stretch of it each day) and **never a trade that had a note the day before** (`chronicle.workNoted`, optional field, written by `buildFeed` on `plan.next`).
  The fallback text is only "Perk, a pit cook, is at work at the pit kitchen." — the writer's pools take over.
- `life.liftDown` and `life.liftUp`: once each on every day except the rest day (the day shift's ride: down in the morning, up in the evening; the night shift is not
  used). Slots `name`, `place`, `trade`. Weight 0.1 (+0.2 for a follower). A rider is not named again for 8 days (`chronicle.liftNamed`), so the daily line does not repeat.
- Never the same person twice among a day's life notes, and never someone who is in one of the day's event notes (crowds name a member not yet named).
- Density: lift (2) + work (~3) are counted first and the generic life notes (market, wash, tavern…) are drawn down to fill: the feed is 11–15 notes on a normal day
  (seed 1 week: 11, 12, 14, 14, 15, 13, 12). The cap of 16 still drops the lightest first (work, then lift), never an event.

**2. Outcome slots** (`slots.outcome`, set at cast time so the text, the effects and the slot agree)
`paySettled` paid | unpaid (the paid case now has **no** effect — before, the "marked as a troublemaker" whisper bonus applied to both), `inspectorLeaves` good | bad
(bad = the last count was short), `childFound` town | mine, `smuggleRun` clear | fog, `washGossip` plain | follower, `procession` dry | rain (rain or storm).

**3. Place display names** (ids unchanged). Used the writer's `PLACE_WORDS` words, not the three shorter variants in the brief, so notes and names agree:
the old face by the grave → **the old face by the hollow**; bakehouse → **the cake ovens**; chandlery → **the fuel-cake yard**; pawn shop → **the knot-lender's**;
alehouse → **the cap-beer shed**; gate inn → **the gate lodge**; scriptorium → **the cord room**; ropewalk → **the cord walk**; stables = the beast pens and graveyard = the
burning ground (already). The keys of `PLACE_WORDS` in `src/content/living.ts` no longer match anything (harmless; it can be dropped).

**4. Human-world words out** of fallback texts, trade names and lines: caravan "wagons" → beast carts; peddler's tray → bone hooks, sour lichen drops; bread →
root-cakes (price, alms and the effect line); "pawns a coat and a pot" → leaves a work wrap and a horn cup with the knot-lender; "soldiers" → guards; wind "bells" → brass bowls;
"the books are checked" → knot-cords; trade names now equal the writer's (skitter catcher, oven keeper, wrap-stitcher, cord twister, fuel-cake maker, pen hand, garrison guard,
bowl ringer, knot-lender, lodge keeper, stalk-joiner) and **fence → stone broker** (the writer's `text.trade('fence')` is still "fence": please change it to match);
their lines and gifts re-voiced (chits, cord, shard-lamps, knot-cords, burning litters instead of coffins, a gate lodge instead of an inn). `person.line`:
"owes Pelta money" → "owes Pelta two knots" (one to five, fixed by the pair of people, so by the seed; "one knot" in the singular). Generated names can no longer be a
human-world word (Nose, Hat, Dog… — a blocklist in `names.ts`).

**5. `refugees`**: slot `b` is now the second refugee's name (= `r2`); the two ids moved to `vars.ida` / `vars.idb` and are no longer sent as slots.
(The levy's `levied` slot is still a comma list of ids; it is not a text slot.)

**6. Test**: `tests/living/theme.test.ts` — `forbiddenIn` (+ grave, the nine old place names, bell, soldier) over place names, trade names / plurals / gifts / lines, every
person line, hearth and crowd name (seeds 1–3), the fallback text of every event kind (20 seeds × 120 days with forced echoes), and a 60-day run for seeds 1–3: every feed text and
text slot, event text, effect reason, calendar and weather line. `tests/living/followup.test.ts` covers items 1, 2, 4 (knots), 5 and the place names.

**Other pieces must know**
- New note keys: `life.work.<tradeId>` (75), `life.liftDown`, `life.liftUp`. New slots: `tradeId`, `trade`, `outcome`. New optional chronicle fields: `workNoted`, `liftNamed`.
- **WRITING**: the lift pool (`life.liftUp` has 4 lines) is now used once a day; keep ≥ 7 variants of each so a week does not repeat (the content test passes today only because riders are rested for 8 days). Rename `fence` → "stone broker" (or tell me to switch back).
- **HUD / FEEL**: no change to read; the feed has ~3 more light notes (weight ≤ 0.12) — if the film's pace matters, they can be skipped when crowded.
- **Sim builder**: nothing; the new chronicle fields are optional plain JSON.

## A week in the life — seed 1
(`npx tsx scripts/living-week.ts 1 7` — the feed is LIVING's fallback text; three people's full plans per day.)

# A week in the life — seed 1
- **Ket** (g06): Hauler at the rail junction. Lives at the third hearth by the pit head, nine under one shell, with Wil, old Thilard and a child.
- **Mara** (g01): Digger on the old face by the hollow. Lives at the fourteenth hearth in the rows, nine under one shell, with Viny, old Kapo and two children; owes Mark two knots.
- **Nan** (t16): Washer at the wash-place. Lives at the first hearth by the well, nine under one shell, with Stoand, old Warn and a child; Braset is kin.

## Day 1 — First Day (week 1) — Clear and still.
_A work day. The first shift of the week goes down._  Weather: 06:00 clear
Effects: crew cartway 0.6 (The cartway is blocked by a runaway train.); crew sorting 0.8 (No carts reach the sorting floor for half a shift.); guards lift -1 (A lift guard runs down to help with the runaway.); whisperZone cartway 0.03 (Shaken by the runaway; the haulers mutter about luck.); whisper g19 0.06 (Dreaming of the deep; halfway there.); whisperZone lift 0.02 (A dream told at the face.)

Feed (11):
- 06:05 A work day. The first shift of the week goes down.
- 06:09 A clear dawn over the bowl; the small sun is up early.
- 07:30 Rook steps into the lift cage with the first shift, goggles down.
- 08:26 Yara tells the shift about a dream: a violet light under the rock, breathing.
- 09:56 Thaib, a knot-lender, is at work at the knot-lender’s.
- 10:48 Gelen sits with the sick at the market square.
- 12:31 A pit beast takes fright and curls into a ball on the rail; the cart train behind it runs away down the cartway. Dov jumps clear, and Steo talks the beast open again.
- 13:34 Brossa, a rag picker, is at work at the market square.
- 15:50 The children dare Gwoabe to touch the lift’s cage. A guard chases them off with his rod.
- 16:12 Grean, a powder keeper, is at work at the powder store.
- 18:56 Parwyn steps out of the lift cage at the pit head, hands scraped raw.

Ket:
    06:00–06:23  wake      home
    06:23–07:04  eat       home
    07:04–07:08  walk      the pit head (from home)
    07:08–07:26  queue     the pit head
    07:26–07:44  liftDown  the lift (from the pit head)
    07:44–08:05  walk      the rail junction (from the lift)
    08:05–13:03  work      the rail junction
    13:03–13:14  walk      the pit kitchen (from the rail junction)
    13:14–13:44  break     the pit kitchen
    13:44–13:54  walk      the rail junction (from the pit kitchen)
    13:54–18:18  work      the rail junction
    18:18–18:40  walk      the lift (from the rail junction)
    18:40–18:58  liftUp    the pit head (from the lift)
    18:58–19:01  walk      home (from the pit head)
    19:01–23:10  family    home
    23:10–06:00  sleep     home

Mara:
    06:00–06:23  wake      home
    06:23–06:57  eat       home
    06:57–07:08  walk      the pit head (from home)
    07:08–07:26  queue     the pit head
    07:26–07:44  liftDown  the lift (from the pit head)
    07:44–08:16  walk      the old face by the hollow (from the lift)
    08:16–13:03  work      the old face by the hollow
    13:03–13:25  walk      the pit kitchen (from the old face by the hollow)
    13:25–13:44  break     the pit kitchen
    13:44–14:05  walk      the old face by the hollow (from the pit kitchen)
    14:05–18:18  work      the old face by the hollow
    18:18–18:50  walk      the lift (from the old face by the hollow)
    18:50–19:08  liftUp    the pit head (from the lift)
    19:08–19:30  walk      the wash-place (from the pit head)
    19:30–20:04  wash      the wash-place
    20:04–20:15  walk      the tavern (from the wash-place)
    20:15–21:10  tavern    the tavern
    21:10–21:12  walk      home (from the tavern)
    21:12–23:10  family    home
    23:10–06:00  sleep     home

Nan:
    06:00–06:27  wake      home
    06:27–07:17  eat       home
    07:17–07:21  walk      the wash-place (from home)
    07:21–12:54  work      the wash-place
    12:54–12:58  walk      home (from the wash-place)
    12:58–13:53  eat       home
    13:53–13:57  walk      the wash-place (from home)
    13:57–18:27  work      the wash-place
    18:27–19:17  wash      the wash-place
    19:17–19:21  walk      home (from the wash-place)
    19:21–23:10  family    home
    23:10–06:00  sleep     home

## Day 2 — Second Day (week 1) — Clear and still.
_A work day._  Weather: 06:00 clear
Effects: notice government 1.1 (The Council is nervous before the inspector.); whisper g19 0.04 (Angry, and looking for someone on their side.); strike heartvein 1.15 (Soft rock at this face today.); whisperZone cartway 0.03 (Shaken by the runaway; the haulers mutter about luck.); whisper g19 0.06 (Dreaming of the deep; halfway there.); whisperZone lift 0.02 (A dream told at the face.)

Feed (12):
- 06:05 A work day.
- 07:34 Yoalel steps into the lift cage with the first shift, goggles down.
- 07:42 Old Grep did not wake this morning.
- 09:23 A knot-cord comes down the road under seal: an inspector from the city is coming to count the mine.
- 10:17 Perk, a pit cook, is at work at the pit kitchen.
- 12:46 Ilsa, a shrine keeper, is at work at the shrine.
- 13:24 Vell squats on the heels to eat at the cord room.
- 14:02 Yara and Blisna have words at the east face. Old business.
- 14:47 The crystal gallery is kind today: Hale says the rock comes away like wet clay.
- 17:20 Hearo, a healer, is at work at the rows.
- 18:57 Kuv comes up out of the dark, squinting at the light at the pit head.
- 19:48 The count at the tally house tonight. Every stone is weighed against the knot-cords.

Ket:
    06:00–06:23  wake      home
    06:23–07:04  eat       home
    07:04–07:08  walk      the pit head (from home)
    07:08–07:26  queue     the pit head
    07:26–07:44  liftDown  the lift (from the pit head)
    07:44–08:05  walk      the rail junction (from the lift)
    08:05–13:03  work      the rail junction
    13:03–13:48  break     the rail junction
    13:48–18:18  work      the rail junction
    18:18–18:40  walk      the lift (from the rail junction)
    18:40–18:58  liftUp    the pit head (from the lift)
    18:58–19:01  walk      home (from the pit head)
    19:01–23:10  family    home
    23:10–06:00  sleep     home

Mara:
    06:00–06:23  wake      home
    06:23–06:57  eat       home
    06:57–07:08  walk      the pit head (from home)
    07:08–07:26  queue     the pit head
    07:26–07:44  liftDown  the lift (from the pit head)
    07:44–08:16  walk      the old face by the hollow (from the lift)
    08:16–13:03  work      the old face by the hollow
    13:03–13:25  walk      the pit kitchen (from the old face by the hollow)
    13:25–13:44  break     the pit kitchen
    13:44–14:05  walk      the old face by the hollow (from the pit kitchen)
    14:05–18:18  work      the old face by the hollow
    18:18–18:50  walk      the lift (from the old face by the hollow)
    18:50–19:08  liftUp    the pit head (from the lift)
    19:08–19:30  walk      the wash-place (from the pit head)
    19:30–20:04  wash      the wash-place
    20:04–20:15  walk      home (from the wash-place)
    20:15–23:10  family    home
    23:10–06:00  sleep     home

Nan:
    06:00–06:27  wake      home
    06:27–07:17  eat       home
    07:17–07:21  walk      the wash-place (from home)
    07:21–12:54  work      the wash-place
    12:54–12:58  walk      home (from the wash-place)
    12:58–13:53  eat       home
    13:53–13:57  walk      the wash-place (from home)
    13:57–18:23  work      the wash-place
    18:23–18:27  walk      home (from the wash-place)
    18:27–23:10  family    home
    23:10–06:00  sleep     home

## Day 3 — Market Day (week 1) — Grey, with a little drizzle.
_Market day. The town fills, and the crystal carts leave for the city._  Weather: 06:00 overcast, 14:59 drizzle, 16:55 overcast
Effects: whisper p111 0.15 (Grieving Grep; grief opens a door.); guards citygate 1 (Guards see the crystal carts off.); notice public 0.9 (Everyone is at the gate, looking at the wounded.); crowd citygate 1.8 (The town crowds the gate.); whisper p444 0.15 (Came back from the war with a dim wick and nothing left to believe in.); whisperZone bunks 0.03 (Short rations and grumbling at the bunks.) … +4

Feed (14):
- 06:05 Market day. The town fills, and the crystal carts leave for the city.
- 06:09 Overcast and still; the smoke from the hearths hangs low.
- 07:13 The lift queue is long; Mara is near the back.
- 07:24 The crystal carts leave for the city, Lup on the first box. Guards in pale plate walk beside them to the bend in the road. Every stone is a piece of you.
- 07:36 Wren goes down in the lift with the morning crowd, wick banked.
- 08:16 Doam, a fuel-cake maker, is at work at the fuel-cake yard.
- 12:25 Falard, a brewer, is at work at the brewhouse.
- 12:46 Skitters in the pit kitchen’s stores, pale and fast. Triv throws out a sack of root meal; Tok sets the cord snares.
- 14:49 Grep is carried to the burning ground and burned, wick first. Pelta and the family hum the long low hum.
- 14:59 A fine drizzle starts; hoods go up.
- 15:30 The wounded come home from the war on a beast cart, wicks dim. Nonde is carried back to the third hearth in the rows; Stoand sees to the rest.
- 16:55 Cloud comes over the rim and stays.
- 17:54 Skaisna, a washer, is at work at the wash-place.
- 19:00 Sib comes up out of the dark, squinting at the light at the pit head.

Ket:
    06:00–06:23  wake      home
    06:23–07:04  eat       home
    07:04–07:08  walk      the pit head (from home)
    07:08–07:26  queue     the pit head
    07:26–07:44  liftDown  the lift (from the pit head)
    07:44–08:05  walk      the rail junction (from the lift)
    08:05–13:03  work      the rail junction
    13:03–13:14  walk      the pit kitchen (from the rail junction)
    13:14–13:44  break     the pit kitchen
    13:44–13:54  walk      the rail junction (from the pit kitchen)
    13:54–18:18  work      the rail junction
    18:18–18:40  walk      the lift (from the rail junction)
    18:40–18:58  liftUp    the pit head (from the lift)
    18:58–19:19  walk      the wash-place (from the pit head)
    19:19–19:57  wash      the wash-place
    19:57–20:19  walk      home (from the wash-place)
    20:19–23:10  family    home
    23:10–06:00  sleep     home

Mara:
    06:00–06:23  wake      home
    06:23–06:57  eat       home
    06:57–07:08  walk      the pit head (from home)
    07:08–07:26  queue     the pit head
    07:26–07:44  liftDown  the lift (from the pit head)
    07:44–08:16  walk      the old face by the hollow (from the lift)
    08:16–13:03  work      the old face by the hollow
    13:03–13:48  break     the old face by the hollow
    13:48–18:18  work      the old face by the hollow
    18:18–18:50  walk      the lift (from the old face by the hollow)
    18:50–19:08  liftUp    the pit head (from the lift)
    19:08–19:30  walk      the wash-place (from the pit head)
    19:30–20:04  wash      the wash-place
    20:04–20:15  walk      the tavern (from the wash-place)
    20:15–21:48  tavern    the tavern
    21:48–21:50  walk      home (from the tavern)
    21:50–23:10  family    home
    23:10–06:00  sleep     home

Nan:
    06:00–06:27  wake      home
    06:27–07:17  eat       home
    07:17–07:21  walk      the wash-place (from home)
    07:21–12:54  work      the wash-place
    12:54–13:05  walk      the market square (from the wash-place)
    13:05–13:48  market    the market square
    13:48–13:59  walk      the wash-place (from the market square)
    13:59–18:27  work      the wash-place
    18:27–19:10  wash      the wash-place
    19:10–19:21  walk      the market square (from the wash-place)
    19:21–20:40  market    the market square
    20:40–20:51  walk      home (from the market square)
    20:51–21:46  visit     home
    21:46–21:49  walk      home (from home)
    21:49–23:10  family    home
    23:10–06:00  sleep     home

## Day 4 — Fourth Day (week 1) — A cold, still dawn; then clear and still.
_A work day._  Weather: 06:00 coldDawn (heavy), 08:00 clear
Effects: guards citygate 1 (The inspector’s guard at the gate.); strike heartvein 1.25 (A fresh seam: more strikes here.); guards heartvein 1 (A guard watches the new seam.); whisper p001 0.1 (Hurt, unpaid and bitter.); whisper p028 0.06 (Sleepless with a newborn; dreams come easily.); whisper g19 0.06 (Dreaming of the deep; halfway there.) … +6

Feed (14):
- 06:05 A work day.
- 06:09 Frost on the shell roofs; the hearths burn high.
- 07:41 Foar goes down in the lift with the morning crowd, wick banked.
- 08:00 It clears. Washing goes back out on the lines.
- 08:06 The city’s inspector walks in at the gate under a white shard-lamp, two clerks and a guard behind. The magistrate meets them in the road.
- 09:01 Ott, a gardener, is at work at the gardens.
- 09:46 The midwife Gelen is called to the seventh hearth in the rows, for Parwyn.
- 10:50 Jerta crushes a hand at the east face; Krei sets it on the spot. No pay until it mends.
- 12:38 Felt the surveyor marks a fresh seam at the crystal gallery. The overseer moves picks to it.
- 13:57 Foni, a lampman, is at work at the west tunnel.
- 16:58 A child is born to Parwyn: Lart, wick already lit. The whole row hears the trilling.
- 17:49 Meany, a wrap-stitcher, is at work at the market square.
- 18:37 Grur rides the lift up at the end of the shift, grey with rock dust.
- 19:07 Krid is home, curled up with the little ones.

Ket:
    06:00–06:23  wake      home
    06:23–07:15  eat       home
    07:15–07:18  walk      the pit head (from home)
    07:18–07:36  queue     the pit head
    07:36–07:54  liftDown  the lift (from the pit head)
    07:54–08:16  walk      the rail junction (from the lift)
    08:16–13:03  work      the rail junction
    13:03–13:48  break     the rail junction
    13:48–18:18  work      the rail junction
    18:18–18:40  walk      the lift (from the rail junction)
    18:40–18:58  liftUp    the pit head (from the lift)
    18:58–19:19  walk      the wash-place (from the pit head)
    19:19–19:57  wash      the wash-place
    19:57–20:19  walk      home (from the wash-place)
    20:19–23:10  family    home
    23:10–06:00  sleep     home

Mara:
    06:00–06:23  wake      home
    06:23–07:08  eat       home
    07:08–07:18  walk      the pit head (from home)
    07:18–07:36  queue     the pit head
    07:36–07:54  liftDown  the lift (from the pit head)
    07:54–08:27  walk      the old face by the hollow (from the lift)
    08:27–13:03  work      the old face by the hollow
    13:03–13:48  break     the old face by the hollow
    13:48–18:18  work      the old face by the hollow
    18:18–18:50  walk      the lift (from the old face by the hollow)
    18:50–19:08  liftUp    the pit head (from the lift)
    19:08–19:19  walk      the tavern (from the pit head)
    19:19–22:19  tavern    the tavern
    22:19–22:21  walk      home (from the tavern)
    22:21–23:10  family    home
    23:10–06:00  sleep     home

Nan:
    06:00–06:27  wake      home
    06:27–07:17  eat       home
    07:17–07:21  walk      the wash-place (from home)
    07:21–12:54  work      the wash-place
    12:54–12:58  walk      home (from the wash-place)
    12:58–13:53  eat       home
    13:53–13:57  walk      the wash-place (from home)
    13:57–18:23  work      the wash-place
    18:23–18:27  walk      home (from the wash-place)
    18:27–23:10  family    home
    23:10–06:00  sleep     home

## Day 5 — Payday (week 1) — Grey, with a little drizzle.
_Payday. Clay chits at the pit head, drink in the rows, debts called in._  Weather: 06:00 overcast, 09:14 drizzle, 11:12 overcast
Effects: countTolerance everywhere 0.6 (The inspector watches the count.); search lift 1.5 (Everyone is searched while the inspector watches.); guards lift 2 (Extra guards at the lift for the inspector.); whisperZone bunks 0.03 (The peddler’s gossip at the bunks.); guards citygate 1 (Guards see the crystal carts off.); crowd minehead 1.6 (The whole shift queues at the pit head for pay.) … +10

Feed (15):
- 06:05 Payday. Clay chits at the pit head, drink in the rows, debts called in.
- 06:09 Overcast and still; the smoke from the hearths hangs low.
- 07:26 The crystal carts leave for the city, Yoll on the first box. Guards in pale plate walk beside them to the bend in the road. Every stone is a piece of you.
- 07:44 Yara steps into the lift cage with the first shift, goggles down.
- 08:23 Skase walks the rounds past the crystal gallery, a shard-lamp on a staff.
- 09:14 A fine drizzle starts; hoods go up.
- 10:26 Noasna, a lodge keeper, is at work at the gate lodge.
- 10:35 Floin the peddler comes down the mine with a tray: bone hooks, sour lichen drops, charms of the Flame, news from the city.
- 11:12 Cloud comes over the rim and stays.
- 14:57 Skinwyn, a lift winder, is at work at the lift.
- 16:29 Groany, a courier, is at work at the council hall.
- 17:03 **The inspector stands at the lift for the count, writing everything down.**
- 17:52 Osk rides the lift up at the end of the shift, grey with rock dust.
- 18:20 The paymaster’s table goes up at the pit head. Grur reads the names; the shift queues for its clay chits.
- 20:42 A fight at the tavern: Jerta puts Garr through a table. The lift guards come running.

Ket:
    06:00–06:23  wake      home
    06:23–07:04  eat       home
    07:04–07:08  walk      the pit head (from home)
    07:08–07:26  queue     the pit head
    07:26–07:44  liftDown  the lift (from the pit head)
    07:44–08:05  walk      the rail junction (from the lift)
    08:05–13:03  work      the rail junction
    13:03–13:14  walk      the pit kitchen (from the rail junction)
    13:14–13:44  break     the pit kitchen
    13:44–13:54  walk      the rail junction (from the pit kitchen)
    13:54–17:42  work      the rail junction
    17:42–18:04  walk      the lift (from the rail junction)
    18:04–18:22  liftUp    the pit head (from the lift)
    18:22–19:08  pay       the pit head
    19:08–19:12  walk      home (from the pit head)
    19:12–23:10  family    home
    23:10–06:00  sleep     home

Mara:
    06:00–06:23  wake      home
    06:23–06:57  eat       home
    06:57–07:08  walk      the pit head (from home)
    07:08–07:26  queue     the pit head
    07:26–07:44  liftDown  the lift (from the pit head)
    07:44–08:16  walk      the old face by the hollow (from the lift)
    08:16–13:03  work      the old face by the hollow
    13:03–13:48  break     the old face by the hollow
    13:48–17:42  work      the old face by the hollow
    17:42–18:14  walk      the lift (from the old face by the hollow)
    18:14–18:32  liftUp    the pit head (from the lift)
    18:32–19:03  pay       the pit head
    19:03–19:14  walk      the tavern (from the pit head)
    19:14–22:33  tavern    the tavern
    22:33–22:35  walk      home (from the tavern)
    22:35–23:10  family    home
    23:10–06:00  sleep     home

Nan:
    06:00–06:27  wake      home
    06:27–07:17  eat       home
    07:17–07:21  walk      the wash-place (from home)
    07:21–12:54  work      the wash-place
    12:54–12:58  walk      home (from the wash-place)
    12:58–13:53  eat       home
    13:53–13:57  walk      the wash-place (from home)
    13:57–18:23  work      the wash-place
    18:23–18:27  walk      the cap-beer shed (from the wash-place)
    18:27–22:36  tavern    the cap-beer shed
    22:36–22:38  walk      home (from the cap-beer shed)
    22:38–23:10  family    home
    23:10–06:00  sleep     home

## Day 6 — The Flame’s Day (week 1) — Grey, with a little drizzle.
_The Flame’s day. Sermons and a procession; the mine is half empty._  Weather: 06:00 overcast, 12:25 drizzle, 14:50 overcast
Effects: whisper p028 -0.05 (The child’s wick burns gold; the mother’s faith is renewed.); notice cult 1.05 (The Temple has the town’s eyes at the blessing.); notice government 0.85 (After a good report the Council relaxes.); crowd kilntemple 1.4 (The procession draws the town to the temple.); crowd slagrows 0.6 (The rows are empty behind the procession.); search lift 0.85 (A lift guard walks with the procession.) … +7

Feed (13):
- 06:05 The Flame’s day. Sermons and a procession; the mine is half empty.
- 07:35 Blailan, a water seller, is at work at the well.
- 07:38 Tok rides the lift down with the shift, the cage swaying on its cord.
- 08:29 The inspector leaves satisfied. The overseer buys the tavern a round.
- 09:47 Bek walks the rounds past the pit head, a shard-lamp on a staff.
- 12:08 Orla, a magistrate, is at work at the council hall.
- 12:25 Drizzle drifts across the bowl.
- 12:34 At the wash-place they are talking about Floin.
- 13:06 Parwyn carries the newborn Lart to the chapel; Edda lights its wick from the Flame. It burns gold.
- 13:44 The procession of the Flame winds down Temple Hill, gold cloth and brass bowls. The streets empty behind it.
- 14:50 The light goes flat and gray.
- 17:47 Dag, an ash keeper, is at work at the burning ground.
- 19:15 Tov rides the lift up at the end of the shift, grey with rock dust.

Ket:
    06:00–06:23  wake      home
    06:23–07:04  eat       home
    07:04–07:08  walk      the pit head (from home)
    07:08–07:26  queue     the pit head
    07:26–07:44  liftDown  the lift (from the pit head)
    07:44–08:05  walk      the rail junction (from the lift)
    08:05–13:03  work      the rail junction
    13:03–13:14  walk      the pit kitchen (from the rail junction)
    13:14–13:44  break     the pit kitchen
    13:44–13:54  walk      the rail junction (from the pit kitchen)
    13:54–18:18  work      the rail junction
    18:18–18:40  walk      the lift (from the rail junction)
    18:40–18:58  liftUp    the pit head (from the lift)
    18:58–19:19  walk      the wash-place (from the pit head)
    19:19–19:57  wash      the wash-place
    19:57–20:19  walk      home (from the wash-place)
    20:19–23:10  family    home
    23:10–06:00  sleep     home

Mara:
    06:00–06:23  wake      home
    06:23–06:57  eat       home
    06:57–07:08  walk      the pit head (from home)
    07:08–07:26  queue     the pit head
    07:26–07:44  liftDown  the lift (from the pit head)
    07:44–08:16  walk      the old face by the hollow (from the lift)
    08:16–13:03  work      the old face by the hollow
    13:03–13:25  walk      the pit kitchen (from the old face by the hollow)
    13:25–13:44  break     the pit kitchen
    13:44–14:05  walk      the old face by the hollow (from the pit kitchen)
    14:05–18:18  work      the old face by the hollow
    18:18–18:50  walk      the lift (from the old face by the hollow)
    18:50–19:08  liftUp    the pit head (from the lift)
    19:08–19:30  walk      the wash-place (from the pit head)
    19:30–20:04  wash      the wash-place
    20:04–20:15  walk      home (from the wash-place)
    20:15–23:10  family    home
    23:10–06:00  sleep     home

Nan:
    06:00–06:27  wake      home
    06:27–07:01  eat       home
    07:01–07:12  walk      the Flame’s chapel (from home)
    07:12–09:25  service   the Flame’s chapel
    09:25–09:36  walk      the wash-place (from the Flame’s chapel)
    09:36–12:54  work      the wash-place
    12:54–12:58  walk      home (from the wash-place)
    12:58–13:53  eat       home
    13:53–13:57  walk      the wash-place (from home)
    13:57–18:27  work      the wash-place
    18:27–19:19  wash      the wash-place
    19:19–19:30  walk      the Flame’s chapel (from the wash-place)
    19:30–20:31  service   the Flame’s chapel
    20:31–20:42  walk      home (from the Flame’s chapel)
    20:42–23:10  family    home
    23:10–06:00  sleep     home

## Day 7 — Rest Day (week 1) — Grey, with a little drizzle.
_Rest day. The lift barely runs; the town is at home._  Weather: 06:00 overcast, 13:12 drizzle, 14:09 rain (heavy), 18:04 overcast
Effects: strike lowgallery 0.78 (Rain water floods the south loop.); strike sump 0.71 (The pools rise with the rain.); crew sump 0.82 (Hands taken off the face to man the pumps.); notice public 0.89 (Nobody is out in the rain to see.); crowd market 0.6 (Rain empties the market.); crowd slagrows 1.22 (Everyone is in, at home or in the tavern.) … +17

Feed (12):
- 06:05 Rest day. The lift barely runs; the town is at home.
- 09:23 Jerta tells the hearth about a dream: a violet light under the rock, breathing.
- 09:32 Verna holds a hand up to the brazier at the temple.
- 09:58 Jeath, an oven keeper, is at work at the cake ovens.
- 10:37 Refugees on the road from the marches: Moag and Dod, a cart and a curled-up beast. The first hearth in the rows takes them in as lodgers.
- 12:31 Old Yeapa tells the children at the well about the thing under the mine that the Flame put to sleep.
- 13:12 A fine drizzle starts; hoods go up.
- 14:09 Rain. Everyone runs for a doorway.
- 14:16 Nuve, an acolyte, is at work at the temple steps.
- 14:38 Rain water pours down the shaft and floods the low gallery to the knee. Karne and the pump crew work the beams until their arms shake.
- 16:50 Cass, a lamplighter, is at work at the haul yard.
- 18:04 Cloud comes over the rim and stays.

Ket:
    06:00–06:23  wake      home
    06:23–07:08  eat       home
    07:08–07:30  walk      the wash-place (from home)
    07:30–10:01  wash      the wash-place
    10:01–10:12  walk      the market square (from the wash-place)
    10:12–11:38  market    the market square
    11:38–12:00  walk      home (from the market square)
    12:00–23:10  family    home
    23:10–06:00  sleep     home

Mara:
    06:00–06:23  wake      home
    06:23–06:57  eat       home
    06:57–07:08  walk      the pit head (from home)
    07:08–07:26  queue     the pit head
    07:26–07:44  liftDown  the lift (from the pit head)
    07:44–08:16  walk      the old face by the hollow (from the lift)
    08:16–13:03  work      the old face by the hollow
    13:03–13:48  break     the old face by the hollow
    13:48–15:00  work      the old face by the hollow
    15:00–15:32  walk      the lift (from the old face by the hollow)
    15:32–15:50  liftUp    the pit head (from the lift)
    15:50–16:12  walk      the fuel-cake yard (from the pit head)
    16:12–21:43  court     the fuel-cake yard with Kot
    21:43–21:56  walk      home (from the fuel-cake yard)
    21:56–23:10  family    home
    23:10–06:00  sleep     home

Nan:
    06:00–06:45  wake      home
    06:45–07:26  eat       home
    07:26–07:30  walk      the wash-place (from home)
    07:30–08:49  wash      the wash-place
    08:49–09:00  walk      the Flame’s chapel (from the wash-place)
    09:00–09:54  chapel    the Flame’s chapel
    09:54–10:16  walk      the market square (from the Flame’s chapel)
    10:16–11:49  market    the market square
    11:49–12:00  walk      home (from the market square)
    12:00–14:20  family    home
    14:20–14:24  walk      home (from home)
    14:24–16:08  visit     home
    16:08–16:12  walk      home (from home)
    16:12–17:20  family    home
    17:20–17:24  walk      the cap-beer shed (from home)
    17:24–21:58  tavern    the cap-beer shed
    21:58–22:00  walk      home (from the cap-beer shed)
    22:00–23:10  family    home
    23:10–06:00  sleep     home
