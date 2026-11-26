# FEEL — game feel, camera direction, staging of every moment and of the Day (running handoff)

Builder #1, then builder #2 (successor, 2026-11-23). Brief: `handoffs/briefs/FEEL.md`. Port 5222. Scratch `/tmp/feel/`.

## Round 4 — in the live game (builder #5, 2026-11-23) — IN PROGRESS
Scratch `/tmp/feel5/`. Proof = the live game only: `e2e/feel-live.cjs` (+ `e2e/feel-live-lib.cjs`) on a static build
(`npx vite build --outDir /tmp/feel5/dist-r4`; `DIST=… SEED=7 OUT=/tmp/feel5/<run> flock /tmp/hg-pw-1.lock node e2e/feel-live.cjs`)
→ `screenshots/feel-live-{whisper,fail,miracle,devour,day,dusk,skip,dusk2}[-s<seed>].png`, `<OUT>/results.json`
(per Day frame: non-black share, figure px, people on screen; per dusk: offerBeats vs bearer arrivals; Skip catch-up s).
Moments and the Day are stepped deterministically (`__hg.app.stop()` + `__hg.advance(ms)`); the dusk runs in real time.

**API additions (additive):** `litWide(rects, {view, figureH, work, figPx?, maxFigPx?, maxBlack?})`, `litCover`, `DAY_FIG_PX` 40,
`DAY_FIG_MAX_PX` 56, `MAX_BLACK` 0.12 (src/feel/shift.ts); `feel.pitWide(ctx)`; `film.setPit(pose)`, `film.pit`, `film.pitAt`;
`VFX_BEATS.wickTurnViolet` / `wickOutGone`; `TURN_LEAN`, `TURN_HOLD_AFTER` (recipes.ts). ctx `pit?: string` (default 'minehead').
**Behaviour changes:** the Day's wide = the lit (seen) MINE zones only, figures ~40 px, ≤ 12 % of the frame off the
seen zones' rects (`ctx.surface` no longer widens it); the surface's share = a rise to the pit head (`pitWide`) when
the shift rides up (first `lift up` ≥ 0.6, 0.05 early) held to dusk; with `dusk: false` the film still takes the
camera down to the grave (`duskShot`) as it ends. Turn: lean ×1.14 on the person at the turn, held to the wick's
violet beat (+1.55 s) + 0.55 s, the hit (hit-stop 80, chime, goal pulse) on the violet. `evil {act:'devour', unit}`
is staged on the devour score (maw 0.42 / gone 1.05, close ×1.25, back at 2.35) without a second VFX `devour`.

### Round 4 — requests (exact; not FEEL's files)
- **PLAY-CORE** (`src/scenes/play/index.ts`): (1) `feel.day` ctx (line ~787): add `threat: (id) => g.threats.find((t) => t.id === id)`,
  `writ: { seals, max }`, `buildingName: (id) => <facility name>` (GameState `g` from `(this.sim as RealSim).g`) — FEEL's
  Day feed now speaks the v3.3 town events through `text.townNote` (WRITING round 5) and needs these to name the place /
  seal count. (2) devour (line ~526): drop `this.sfx('devour')` at the click — FEEL stages `evil {act:'devour'}` on the devour
  score now (scream at 0, `devour` at the maw 0.42 s, `gorge` at 1.05 s, close-in ×1.25 held to 2.35 s); keep `fx.raw('devour')`
  (FEEL no longer spawns a second one). (3) `dusk: true` as soon as the HUD draws FEEL's dusk cues — today, with the scene's own
  dusk, the stone is set on the HUD's 3.4 s timeout, not on the bearer (live seed 7, dusk 1: `set` at +3.8 s, Mara never within
  13.6 units of the grave).
- **PLAY-WORLD / BEHAV**: the dusk bearer does not walk to the grave in the live game (seed 7 dusk 1: g01 Mara's nearest approach
  to `zoneAnchor('grave')` was 27 units in one run and 131 in another — the second with the camera already on the grave; looks
  like people off screen do not walk). Walk every bearer to the grave whatever the camera shows; `world.arrival` should resolve on
  the real arrival, not the 3.4 s cap. Evidence: `/tmp/feel5/{base-7,r4a-7}/results.json` (`dusk[].check`).
- **HUD**: the offering strip (dusk) sits over the grave's lower half where the bearers kneel (`screenshots/feel-live-dusk.png`):
  anchor it to the bottom edge (or beside the grave) so the walk and the stones being set read.

## Round 3b — additions (builder #4, 2026-11-23) — additive to the Round 3 block below
```ts
// the clock
clock.catchUp: boolean                // true while a Skip's fast catch-up runs (the rest of the day in ≤ CATCH_S real s)
// the film
film.skipToDusk()                     // NOW: a fast catch-up — the clock races to dusk in ≤ CATCH_S (1.2 s real); the world
                                      //   is applied as it goes (BEHAV/AMBIENT see the clock race); HEAVY notes still show
                                      //   on screen (and stay up into the dusk), light/normal go to the feed only; no slow-downs,
                                      //   holds or camera leans. A second skipToDusk() during the catch-up = instant.
film.skipToDusk(true)                 // instant (the old behaviour); film.skip() stays instant (both skips)
film.following: boolean               // the Day is directing the camera (false once the player takes it)
film.setFollow(on: boolean)           // "follow the day" toggle: true gives the camera back to the Day (glides to where the day is)
feel.followDay(on: boolean): boolean  // same, on the film that is playing (false if none)
film.onOfferBeat(cb: (beat: 'arrive' | 'set' | 'reveal' | 'best', item: OfferBeatItem, index: number) => void)
interface OfferBeatItem { index: number; id?: string; unit?: string; rarity: string /*staged tier*/; grade: string; oneIn?: number; best: boolean; how: 'tribute' | 'offered' }
// exports: CATCH_S, ARRIVE_R, planDuskOffering(items, arrivals) (pure; src/feel/dusk.ts)
```
**HUD cues (changed payload, HUD-ready):** `dayNote { entry, anchor?, shown, where }` — `entry` = the DayNote with
`weight` as a number (0 light, 1 normal, 2 heavy — the HUD's scale) and `weightName`; `anchor` = a HUD `FocusTarget`
(`{kind:'unit',id}` when the world can place the person, else `{kind:'zone',id}`, else `{kind:'point',x,y}` world) and is
**omitted for feed-only entries** (so the HUD's `feed.add(entry, null)` lists it without a world note); `where` = the old
`{ zone?, unit?, at? }`. Density: **light notes go to the feed only**; normal and heavy stand in the world (≤ 3; heavy
replaces the oldest). New: `dayFollow { on }` (show/hide the "Follow the day" toggle; on=false after the player takes the
camera), `offerBeat { beat, index, id, unit, rarity, grade, oneIn, best, how }`, `duskWalk { bearers }` (the walk to the grave
begins). World mark: `fx.spawn('dayMark', { at, unit, zone, variant: 'normal' | 'heavy', amount: seconds })` under a note
on screen (a small ground mark at the place — never over a head; VFX: unknown kinds are no-ops until drawn).
**Dusk is one piece:** Day ends → `duskStart` → the bearers walk (camera eases to the grave + the bearers, never off the lit
mine) → **each stone is set when its bearer arrives** (`offerBeat 'arrive'`, `'set'`) → reveals in rising staged tier
(`revealTier(grade, oneIn)`), each no sooner than 0.35 s after its stone was set, the best last with anticipation + hold
(`'reveal'`, `'best'`) → `duskCount` → `ledger` → `hud.deal()` + `cardDraw` miracle, then evil → `duskEnd` → night.
Arrival = the bearer within `ARRIVE_R` (= 1.6 × figureH world units) of `zoneAnchor('grave')`, or its planned time + 1.2 s
grace (planned: first at 1.1 s, then every 0.45 s; the walk never exceeds 3.4 s).

## Round 3 — the Day fast-forward (builder #3, 2026-11-23; spec v2.1 §5, §5b; DECISIONS §16) — additive

**Same call as before**: `const film = feel.day(events, ctx)` — it now plays the whole Day as a fast-forward of the
world (dawn → dusk on one clock, ~18 s at ×1) with notes where things happen, then **Dusk** (offering → count →
ledger → the deal → night). `film.onEnd(cb)` fires when the night can begin (after the deal). The old 6–10 s
highlights film (`planDay`) is no longer what `feel.day` plays; `planDay` stays exported (pure) for old callers.

```ts
// new exports from src/feel (index.ts)
import { DAY_SECONDS, DUSK_MAX, NOTE_MAX, NOTE_SHOW_S, SPEEDS, planFastDay, notesFor,
         type DayClock, type DayNote, type NoteWeight, type FeedEntry, type WeatherPoint, type Ledger, type FastDayPlan } from '../../feel';

feel.dayClock: DayClock | null        // null at night. Everyone who moves with the day reads this each frame:
interface DayClock {
  readonly t: number;                 // time of day 0..1 (sim `time`; 0 dawn, 1 dusk) — BEHAV plans, the lift, carts, WEATHER, AMBIENT light
  readonly speed: 1 | 2 | 4;          // the player's choice
  readonly paused: boolean;
  readonly rate: number;              // effective clock rate now (speed × slow-down; 0 while held; 0 when paused)
  readonly slow: number;              // current slow-down factor (1, or 0.25 during a heavy note)
  readonly phase: 'day' | 'dusk' | 'night';   // 'dusk' once t reached 1: the offering, count, ledger, deal
  readonly label: string;             // 'Dawn' | 'Morning' | 'Midday' | 'Afternoon' | 'Evening' | 'Dusk' (the small clock)
  readonly weather?: WeatherPoint;    // ctx.weather sampled at t (latest point ≤ t)
}
// the film (DayFilm, as before, plus):
film.clock: DayClock                  // same object as feel.dayClock
film.setSpeed(s: 1 | 2 | 4)           // ×1 / ×2 / ×4 (Settings daySpeed multiplies on top)
film.setPaused(b) ; film.paused       // pause / resume anywhere (day or dusk)
film.skipToDusk()                     // the rest of the day at once: world applied silently, every note still joins the feed (shown:false); dusk plays
film.skipDusk()                       // the rest of dusk: offering skipped (silent), the ledger and the deal are still cued; then night
film.skip()                           // both (as before): straight to the night, everything applied, deal cued
film.notes: readonly DayNote[]        // every note fired so far (the feed), in order
film.phase                            // = clock.phase
feel.focusNote(id: string): boolean   // HUD calls it when a feed line is clicked: the camera glides to where it happened (player intent: the film stops directing)

// ctx additions (DayCtx): all optional
ctx.feed?: FeedEntry[]                // LIVING's day feed  { time, kind, place?, who?, textKey?, slots?, weight?, text? }
ctx.weather?: WeatherPoint[]          // LIVING's weather timeline  { t, kind, strength?, windDir? }
ctx.surface?: readonly string[]       // town zones where the player holds colour: the wide extends above ground to include them
ctx.items?: { id?, rarity, unit?, oneIn? }[]   // the dusk offering (else built from the day's `offered` events, `tribute: true` = unasked)
ctx.dusk?: false                      // compatibility: FEEL does not stage the dusk; the film ends when the clock reaches dusk
ctx.townFigureH?: number              // town figure height in world units (default 32) for the town wide
// host addition (optional): hud.deal?(): void — FEEL calls it at the deal

interface DayNote {
  id: string; time: number; kind: string; place?: string; who: string[];
  textKey?: string; slots?: Record<string, unknown>;
  text: string;                       // plain line (LIVING's `text`/fallback, or FEEL's own for sim events: "Ket struck a Bright stone.")
  weight: 'light' | 'normal' | 'heavy';
  source: 'living' | 'sim' | 'weather';
  mergedInto?: string;                // shown only in the feed, folded into that on-screen note
}
```
**HUD cues** (through `hud.cue(name, p)`; FEEL times everything, the HUD only draws):
- `dayNote { entry: DayNote, anchor: { zone?, unit?, at?: Vec /*world*/ }, shown: boolean }` — every entry, once, at its time. `shown` = draw it at `anchor` on screen now AND add it to the feed; `false` = feed only (merged / skipped).
- `dayNoteMerge { id, count, text }` — an on-screen note absorbed `count` more (update its line).
- `dayNoteHide { id }` — take the on-screen note away (it stays in the feed). FEEL keeps ≤ `NOTE_MAX` (3) on screen, each ~`NOTE_SHOW_S` (3 s real; heavy 4 s).
- `dayClock { t, speed, paused, phase, label }` — when speed / pause / phase change (the per-frame clock still goes through `hud.dayProgress(t, label)`).
- Dusk, in order: `duskStart {}` → the offering recipe's own cues (`offeringOpen`… `offeringDone` / `offeringEmpty`) → `duskCount { stones, byTier: number[6], kept, tribute }` → `ledger { lines: { text, tone: 'good'|'bad'|'plain' }[] }` → `hud.deal()` + `cardDraw` (miracle, then evil) → `duskEnd {}` → `film.onEnd`.
- Light: `atmosphere.cue('dawn')` at 0, `'dusk'` at t 0.93, `'night'` at the deal.

**Migration (PLAY-WORLD / PLAY-CORE, one line each):** drive the world from the clock, not from a linear replay:
`shift.p = film.clock.t` and `life.day(before, events, film.clock.t, …)` (was `this.replay.p`); `DayReplay` length = `film.duration` still works but drifts once the player changes speed / a heavy note slows the clock. Skip button → `film.skipToDusk()` (second press → `film.skipDusk()`); speed buttons → `film.setSpeed(1|2|4)`; End the scene's own dawn summary (the ledger replaces it). Forward `hud.cue` and `hud.deal` in the host (src/scenes/play/feel.ts line ~87 only forwards pulse/pop/summary/dayProgress/busy).

## Public interface (exact; additive only from here)

```ts
import { createFeel, planDay, paceCheck, RECIPES, type Feel, type FeelHost, type RecipeName } from '../../feel';
```

### For PLAY-WORLD (the caller of the recipes and the Day director) — 2026-11-23 additions
**The Day's framing rule (fixes "one dot on black").** `feel.day(events, ctx)` now frames the SHIFT, not the player's pose:
- `ctx.seen: string[]` — **pass the zones the player sees or owns** (visibility ≠ void, both layers). Fallback: the zones the day's events happen in, else `ctx.mineIds`.
- The film opens on the **shift wide** (`src/feel/shift.ts`, `feel.shiftWide(events, ctx)`): bounding box of `seen` (+8 % margin, ≥ 8 units) fitted to the view, but figures never under `MIN_FIG_PX` 36 logical px (the reference's own size; `ctx.figureH` world units per standing figure, default 6 = mine figures) nor over 72 px; a long thin box is zoomed until it fills ≥ 55 % of the view; a box bigger than the view is framed on the work, the view kept inside the box (no Void). Then `host.camera.constrain`.
- Shots push in from the wide (Deep 1.25×, Royal 1.45×, Impossible 1.7×) and never pull out past it; after the last shot the film returns to the wide; at its end, to the player's own framing. A drag/zoom by the player stops all direction for the rest of the film.
- Needs `host.camera.zoneBounds`, `zoneAnchor`, `unitPos`, `view`, `constrain` (you already have them). Don't forward HUD clicks to `feel.camera` (a click counts as camera input).

**1 in N (§15.10 D).** Pass `oneIn` (the roll's "1 in N") wherever you pass a crystal: `mineCrystal`, `tribute`, `enchant`, `recombine`, offering items, and on Day `strike` events. The reveal is staged at `revealTier(grade, oneIn)` (bands 30/150/700/3000/10000 → Clear…Impossible); the sound keeps the grade; VFX gets `rarity` = staged tier plus `grade` and `oneIn`. A Day strike ≥ 1 in 10,000 **stops the film and holds** 1.8 s (≥ 1 in 100,000: 3.2 s, plus the once-in-a-run layer: deep dim, a low second chime, the miners kneel, `hud.cue('onceInARun', { oneIn })`). `film.duration` now includes holds — use it for your replay length. The summary names it ("…a Deep, 1 in 150,000, in The Heart Vein.").

**Crafting moments (§15.10 A–B)**: `enchant`, `recombine`, `facetOffer`/`facet`, `forge`, `give`, `facility`, `tribute`, `exposed` (table below). `cut`/`cutOffer`/`graft` are withdrawn.

### The host (the play scene implements it; every member optional — missing ones are no-ops)
World units = town units (as `src/render/world`), screen = logical 1600×900 px.
```ts
interface Vec { x: number; y: number }
interface Rect { x: number; y: number; w: number; h: number }
interface CamPose { x: number; y: number; scale: number }            // same shape as render/world CamPose

interface FeelHost {
  camera?: {
    view?(): { w: number; h: number };            // default 1600×900
    constrain?(p: CamPose): CamPose;              // zoom limits + legal centre (wrap constrainCamera on a scratch Camera)
    apply(p: CamPose): void;                      // put the render camera exactly at p this frame (setPose(cam, p))
    frameMine?(): CamPose; frameAll?(): CamPose;  // world.frameMine() / world.frameAll()
    zoneAnchor?(id: string): Vec | null;          // world units
    zoneBounds?(id: string): Rect | null;         // world units
    unitPos?(id: string): Vec | null;             // world units, feet, live (walkers move)
  };
  fx?: { spawn(kind: string, params: FxParams): void };         // VFX `fx.spawn` (names mapped in src/feel/adapters.ts)
  audio?: { play(name: string, opts?: { pan?: number; gain?: number; pitch?: number }): void;
            setPhase?(phase: 'night' | 'day'): void };          // P3 `playSfx` / `setPhase`
  hud?: { pulse?(id: HudId): void;                              // HUD `pulse(id)`
          pop?(id: HudId, p: { text?: string; value?: number; at?: Vec }): void;  // a number rising at a world point / stat
          summary?(lines: string[]): void;                      // the ≤ 3-line dawn summary
          dayProgress?(t01: number, label?: string): void;      // day strip
          busy?(on: boolean): void };                           // grey End Night while a once-per-run moment plays
  people?: { react(unitId: string, r: Reaction): void };        // people module reactions
  time?: { hitStop?(ms: number): void };                        // freeze world animation for ms (sim/people/fx clocks)
  atmosphere?: { cue(c: AtmosCue, durMs: number): void };       // AMBIENT: light opens at dawn, closes at dusk
  settings?(): { daySpeed?: number; reduceMotion?: boolean };   // read every frame
}
type FxParams = { zone?: string; unit?: string; toZone?: string; toUnit?: string; at?: Vec; to?: Vec;
                  path?: string[]; amount?: number; variant?: string; far?: boolean; reduceMotion?: boolean };
type HudId = 'nether' | 'crystals' | 'ichor' | 'hunger' | 'danger' | 'goal' | 'endNight' | 'level' | 'malice' | 'miracle' | string;
type Reaction = 'look' | 'shiver' | 'kneel' | 'glance' | 'flinch' | 'recoil' | 'cheer' | 'fall' | 'set-off' | 'arrive' | 'work';
type AtmosCue = 'dusk' | 'dawn' | 'night' | 'day' | 'dim' | 'flash';
```

### The feel object
```ts
const feel = createFeel(host, { seed });
feel.update(dtSec);                          // once per frame BEFORE world.render (advances moments, the day film, the camera; calls host.camera.apply)
feel.play(name: RecipeName, params?: RecipeParams) → Moment   // { id, name, duration, done, cancel() } — first response same frame
feel.day(events: DayEvent[], ctx?: DayCtx) → DayFilm           // plays planDay(...) on the host
                                                              // DayFilm = { plan, duration, t, done, paused, skip(), scrub(t01), setPaused(b), onEnd(cb) }
feel.camera                                   // CameraDirector (below)
feel.log                                      // SessionLog — what happened when (for paceCheck)
feel.heartbeat(level01)                       // hunger heartbeat on/off (0 = off); continuous
feel.reset()                                  // drop all moments (scene change)

planDay(events: DayEvent[], ctx?: DayCtx) → DayPlan           // pure, deterministic: { duration, cues: Cue[], shots: Shot[], stills: [t0,t1][], summary: string[] }
paceCheck(log: SessionLog | LogEntry[]) → PaceReport          // { ok, dead: [t0,t1][], unanswered: [...], overlaps: [...], overstays: [...] }
```
`DayEvent` = the sim's `GameEvent` (P4.md v2) — only `kind`, `time` and the documented fields are read.
`DayCtx` = `{ playerPose?: CamPose; grave?: string /* zone id, default 'grave' */; mineIds?: string[];
  zoneName?(id): string; unitName?(id): string; isFollower?(id): boolean }`.

### CameraDirector (`feel.camera`) — the play scene forwards raw input here
```ts
pointerDown(sx, sy); pointerMove(sx, sy); pointerUp();   // drag pan with inertia (fling)
wheel(sx, sy, deltaY);                                    // zoom to cursor, smooth
key(dx, dy, dzoom);                                       // held-key pan/zoom each frame (-1..1)
pinch(cx, cy, factor);
frame(target: FrameTarget, o?: { pad?: number; zoom?: number; dur?: number; force?: boolean });
follow(unitId, o?: { dur?: number; zoom?: number });     // keep a walker framed
twoShot(a: FrameTarget, b: FrameTarget, o?);              // both in view
wholeWorld(); myMine();                                   // the two big moves (button)
shake(amp01, ms); punch(k);                               // tiny, capped, none with reduce motion
pose(): CamPose; isPlayerDriving(): boolean; yieldFor(ms) // player input cancels direction for 3 s
FrameTarget = { zone: string } | { unit: string } | { at: Vec; scale?: number } | { rect: Rect } | { pose: CamPose }
```
Cut vs glide: distance in screen-widths at the destination scale > 2.5 (or a zoom ratio > 6) → cut through a short dip; else a glide (critically damped, log-space zoom).

### Recipe names and params (`feel.play(name, params)`)
| name | params | what the player gets |
|---|---|---|
| `hover` | `{ unit?, zone? }` | soft tick + highlight pulse (rate-limited) |
| `select` | `{ unit?, zone? }` | click + person looks up + small punch |
| `cancel` | `{}` | back sound, preview fades |
| `whisperCast` | `{ unit }` | thread leaves the grave (sound first), camera eases toward the person if off-screen |
| `whisperHeard` | `{ unit }` | head lifts, shiver |
| `whisperTurned` | `{ unit, zone? }` | hit-stop 60 ms, kneel, colour ripple, `convert`, Nether pop |
| `whisperRefused` | `{ unit }` | thread frays to ash, flinch, low `convertFail` |
| `whisper` | `{ unit, zone?, result: 'turned' \| 'refused' }` | the whole chain cast → heard → result (≈ 1.3 s, never blocks input) |
| `ripple` | `{ zone?, unit?, at? }` | colour ripple on a conversion |
| `discovery` | `{ zone, kind, unit? }` | anticipation beat → reveal (kind = cache/seam/loner/shortcut/relic/danger) |
| `crystalsDelivered` | `{ amount, unit?, zone? }` | pour at the grave, number rises at the grave |
| `prayerTick` | `{ amount, units?: string[] }` | wisps to the grave, Nether ticks |
| `eat` | `{ amount? }` | crunch, grave brightens, Hunger falls |
| `miracle` | `{ id, zone?, unit? }` | per-miracle staging (wind-up, hit, settle) |
| `statChange` | `{ stat: 'nether' \| 'ichor' \| 'hunger' \| 'crystals' \| 'malice', from, to }` | pulse at source + pop |
| `unlock` | `{ id, text? }` | HUD toast pulse + chime |
| `levelUp` | `{ level, text? }` | once per level: grave flare, punch, `levelUp` |
| `divinityUp` | `{ rank, text? }` | once-per-rank spectacle (≤ 2.2 s, blocks End Night only) |
| `holdCreep` | `{ zone, from, to }` | vein tips race, soft pitched swell (stacking-safe) |
| `rooted` | `{ zone }` | bloom, `rooted`, short frame on it |
| `receded` | `{ zone, from, to, lostRoot? }` | wither, `holdLoss` |
| `guardNotices` | `{ unit, zone? }` | lantern swing, hard cone, sting |
| `pushback` | `{ track, zone?, from?, to? }` | danger pulse + faction sting |
| `purge` | `{ zone }` | fire, shake, frame |
| `inquisitorArrives` | `{ unit?, zone? }` | lift light, bell, frame the lift |
| `followerCaught` | `{ unit, zone? }` | flinch, sting, frame |
| `followerLost` | `{ unit, zone? }` | fall, `death`, Ichor pulse |
| `dusk` | `{}` | light closes, `duskBell`, phase night |
| `dawn` | `{}` | light opens, `dawnBell`, phase day |
| `hunger` | `{ level }` | heartbeat (same as `feel.heartbeat`) |
| `endNight` | `{}` | press: punch + `endTurn`, then dusk → day film |
| `stageUp` | `{ stage }` | (watershed hand-off is FINALE's; this only marks it) |

### §15 recipe ids (builder #2, 2026-11-23 — DECISIONS §15; Send / intents dropped: `sendPreview`, `sendConfirm`, `recall`, `lieLow`, `arrival`, `explore`, `craft` are gone)
Data scores in `src/feel/scores.ts` (beat lists; interpreter `src/feel/score.ts`), the offering director in `src/feel/offering.ts`; all in `RECIPES`, so `feel.play(name, params)`.
`Tier` = `'dull' | 'clear' | 'bright' | 'deep' | 'royal' | 'impossible'` (SIM-v3 working names; 0..5 and the old common/uncommon/rare/legendary also accepted — `rarityOf`). `Screen` = canvas px.
| id | params | staging |
|---|---|---|
| `offering` | `{ items: { id?, rarity: Tier, unit? }[], units?: string[] }` | **dusk reward beat**: procession (bearers set off, camera settles on the grave, 0.6–1 s) → reveals one by one rising through the tiers, best find last (Dull/Clear ring out ~0.3 s apart, Bright a beat, Deep a held breath + 60 ms hit-stop, Royal dims + 90 ms, Impossible stops everything 150 ms), anticipation before a Deep+ best find, best-find hold; ≤ 7.5 s for ≤ 8 crystals, ≤ 8 s always; **`moment.skip()`** jumps to the end silently and sends `hud.cue('offeringDone', { skipped: true })`. HUD cues: `offeringOpen {count}`, `offeringReveal {index, id, rarity, best}`, `offeringBest {index}`, `offeringDone {count}`, `offeringEmpty` |
| `cardDraw` | `{ deck: 'miracle' \| 'evil', count?: 3 }` | the hand fans in: miracles bright and rising (0.11 s apart), acts of evil low and heavy (0.13 s); `hud.cue('cardDealt', { index })` each |
| `cardHover` / `cardPick` | `{ card?, index? }` | tick + `cardLift` / pick + `cardHeld` + 0.4 % lean |
| `burnCrystals` | `{ count, rarity? }` | paying a miracle: the chosen crystals burn one by one at the grave (0.14 s apart), `hud.cue('crystalBurn', { index })` |
| `cardPlay` | `{ id, evil?, unit?, zone?, at?, near?, fromScreen? }` | weight on play: release (sound, `cardRelease`, card flight) → the card lands at 0.55 s with the miracle's / act's own sound, 60 ms hit-stop, reactions |
| `cardDenied` / `cardDiscard` | `{ card?, index?, reason? }` / `{ count? }` | shake + `cardShake` / cards burn (`cardBurn`) |
| `mineCrystal` | `{ rarity: Tier, unit?, zone?, at?, near?, amount? }` | a strike: effect at 0, pick sound when it bites, tier sound at the reveal (VFX `FX_TIMING`); Dull/Clear/Bright stay in the wide; Deep pushes in 1.12× + 80 ms; Royal 1.22× + dim + 110 ms + onlookers kneel; Impossible dims, 1.35×, 150 ms, everyone kneels (big); every push returns the framing |
| `pocket` | `{ unit, rarity? }` | a follower slips the find away (glance + soft sound) |
| `cart` | `{ zone?, unit?, amount? }` | finds roll to the lift |
| `tally` | `{ result: 'short' \| 'even', unit?, near?, count? }` | the count ticks up (rising), a held breath, then short (hit, shake, danger pulse) or even (quiet). HUD cues `tallyOpen`, `tallyTick`, `tallyShort`, `tallyEven` |
| `search` | `{ result: 'found' \| 'clear', unit?, zone? }` | lantern sweep, then caught (big) or nothing |
| `followerEvil` | `{ unit, act?, zone?, near? }` | a follower's own evil (lighter than yours), Malice/danger pulse |
| `crystalFed` | `{ rarity?, amount?, unit?, from? }` | **eat** a crystal: it spirals into the grave, gulp at 0.72 s, Hunger pops at the grave |
| `equip` / `unequip` | `{ rarity?, slot?, unit? }` | **set** in a socket: drop, lock at 0.34 s, the aura comes up (kept per slot) / aura ends |
| `enchant` | `{ result: 'modifier' \| 'reroll' \| 'curse', rarity?, oneIn? }` | gather (`enchantGather`/`enchantFade`) → the modifier lands at 0.75 s (tier chime, `enchantLand`) → its line is read (`enchantLine`); curse = dim, 110 ms stop, low sting (`enchantCurse`), malice pulse, then the line and a tempting glint |
| `recombine` | `{ result: 'same' \| 'up', rarity?, oneIn? }` | two stones in (`recombineIn`), a held breath (dim), the new stone revealed at the fuse 1.0 s (`recombineReveal`); `up` = brighter, longer stop, `recombineUp` |
| `facetOffer` / `facet` | `{ count?: 3 }` / `{ rarity? }` | gem workshop only: the 3 cuts shown (`facetShown`); the blade bites, the new shape rings at 0.55 s (`facetDone`) |
| `forge` | `{ rarity?, item?: 'ring' \| 'amulet' \| 'circlet' }` | forge only: three hammer strokes (`forgeStroke`), the stone is set at 0.9 s (`jewelryForged`) |
| `give` | `{ unit, rarity?, item? }` | an item given to a follower: they look, take it, kneel; its aura comes up on them (`itemGiven`) |
| `facility` | `{ zone, id, verb? }` | a town building becomes yours (big): nudge to it, bloom, the new craft verb appears (`facilityGained`, `facilityVerb`, pulse `craft`) |
| `tribute` | `{ unit?, rarity?, oneIn? }` | UNASKED tribute at dusk: quiet, no camera, no dim — one bearer sets off, lays one stone (`tributeArrive`, `tributeLaid`, pop at the grave), kneels. The Offer routine's contributed haul is `offering` (the procession) |
| `exposed` | `{ unit, zone?, near?, item? }` | a worn item found in a search — the worst small moment (big): lamp + dim at 0, close-in 1.2×, at 0.7 s a 140 ms stop, sting, shake, the wearer recoils (`itemExposed`), the others glance, danger; back at 1.9 s |
| `blessingDeal` / `blessingPick` | `{ count? }` / `{ id?, index? }` | three blessings fan in under a dim / pick chime, punch, grave flare |
| `routine` | `{ unit, routine: 'pray' \| 'offer' \| 'lieLow' }` | 1 AP: `hud.pulse('ap')` + `apSpent`; kneel / look / hide (+ lie-low effect) |
| `move` | `{ unit, zone?, result: 'ok' \| 'failed' }` | whisper → 0.45 s → sets off, or frays and flinches |
| `devour` | `{ unit, zone?, near?, amount? }` | the act-of-evil card: recoil + scream, maw at 0.42 s (120 ms hit-stop), gone at 1.05 s, Hunger pops at the grave, Malice/danger |
Kept from v2: `hover select cancel denied whisper* ripple discovery crystalsDelivered prayerTick eat miracle evil statChange unlock levelUp divinityUp holdCreep rooted receded guardNotices pushback purge inquisitorArrives followerCaught followerLost dusk dawn hunger endNight stageUp`.
Host addition (additive): `hud.cue?(name: string, p?: Record<string, unknown>)` — a named HUD beat (cards, offering, Tally, cuts). `Moment.skip()` added. Pulses used: `hand`, `ap`, `sockets`, `crystals`, `hunger`, `malice`, `danger`, `miracle`, `goal`.

### The Day film (§15 events; SIM-v3 names when its contract lands — aliases in `DAY_KINDS`, src/feel/day.ts)
`strike {unit, zone, rarity}` (also crystalMined/crystalFound) · `pocketed {unit, rarity}` · `carted {zone, unit?, amount}` · `tally {unit?, zone?, expected, counted, short?}` · `search {unit?, zone?, found}` · `followerEvil {unit, act?, zone?}` · `devoured {unit, zone?, amount?, text?}` · plus v2 `moved`, `liftRide`, `holdChanged`, `rooted`, `receded`, `heat`, `factionAction`, `hunter*`, `unitGone`, `dusk`, `levelUp`, …
Order: dawn → commute → **picks swing across the mine** (`people.react(u,'work')` staggered) → Dull/Clear/Bright strikes ring out in the wide (≤ 6, 0.18 s apart) → the best two Deep+ finds rise to the headline, each with a shot that pushes in (Deep 1.25×, Royal 1.45×, Impossible 1.7× the player's zoom) and a held beat → pockets right after their strike, carts roll → colour creeps → **the Tally** (short = a shot on the lift, tension) → searches → followers' own evil → opposition → evening commute → stillness → dusk + ≤ 3-line summary. 6–10 s always.

## Status
- [x] R3b-M1 (builder #4) `src/feel/dusk.ts` (arrival-timed offering: `planDuskOffering`, `DuskOffering`), FastFilm: Skip catch-up (`CATCH_S` 1.2), follow toggle (`setFollow`, `following`, `feel.followDay`, `dayFollow` cue), HUD-shaped `dayNote` cues (weight 0/1/2, FocusTarget anchor, feed-only without anchor) + `dayMark` ground mark, light notes feed-only, drift over worked places, dusk walk starts at once + `duskShot`; `feel.recipeCtx(film)`; tests: tests/feel/dusk.test.ts (6) + fastday updated; tests/feel 649 green; tsc clean for src/feel + tests/feel.
- [x] R3b-M2 strips `e2e/feel-shots.cjs day [moments|heavy|skip|follow|dusk]` → `screenshots/feel-day-{moments,heavy,skip,follow}.png`, `feel-dusk-{offering,tribute}.png`; full frames `/tmp/feel/{day-m,day-h,day-s,day-f,dusk-offering,dusk-tribute}-<i>.png`. Harness stand-ins added: ground marks, "set" husks in the offering row, "Follow the day" button, bearers moved to the grave on `duskWalk`, "skipping to dusk »" clock.
- [x] R3-M1 (builder #3) the Day fast-forward: `src/feel/notes.ts` (notesFor, NoteBoard density), `src/feel/fastday.ts` (planFastDay, clock constants, dusk plan, ledger), `src/feel/fastfilm.ts` (the player: clock, speeds, pause, skipToDusk/skipDusk, notes, slow-downs, holds, camera wide + drift + leans, dusk sequence); `feel.day` plays it, `feel.dayClock`, `feel.focusNote`; the old film is `feel.highlights` (deprecated, its tests kept). Samples `FAST_DAYS` (quiet, market+rain+LIVING feed, rare+exposure, dig). tests/feel/fastday.test.ts 28 green.
- [x] R3-M2 strips `screenshots/feel-dayff-{quiet,market,market-town,market-x4,rare,dig,pan}.png` (`e2e/feel-shots.cjs dayff [filter]`, 12 frames each over the whole day + dusk, 0 console errors/warnings); full frames `/tmp/feel/dayff-*-{a,b}.png`. Fixed from the strips: the town wide (town figures, specks allowed), mine notes stacking on the pit at town zoom (merge by screen proximity), the dusk leaving a town wide for the grave (no longer), merged strike lines ("— and 4 more stones here."). The harness draws stand-ins for the HUD's notes / feed / clock / ledger (off-screen notes wait at the edge with an arrow) and a rain stand-in from the weather timeline.
- [x] R3-M3 `ctx.dusk: false` compatibility switch; DECISIONS FEEL section (7 bullets); tests 31 in tests/feel/fastday.test.ts; whole tests/feel green.
- [x] M1 motion kit `src/feel/kit/` (ease set, closed-form springs/damp, seeded noise, Timeline with labels/scrub/speed/pause) — tests/feel/kit.test.ts
- [x] M2 camera director `src/feel/camera.ts` (drag 1:1 + fling, zoom-to-cursor, keys, pinch, rubber soft bounds, frame/follow/twoShot/wholeWorld/myMine, glide vs cut, yield 3 s on input, shake ≤ 6 px, punch ≤ 2 %, idle breath ≤ 3 px after 6 s; reduce motion = none of those and far moves cut) — tests/feel/camera.test.ts
- [x] M3 recipes `src/feel/recipes.ts` (39 names), host `src/feel/host.ts`, name adapter `src/feel/adapters.ts`, conductor `src/feel/feel.ts` — tests/feel/recipes.test.ts (first response 0 ms for every recipe, budgets, reduce motion, rate limits, big-moment queue)
- [x] M4 `planDay` + DayFilm `src/feel/day.ts` — tests/feel/day.test.ts (63 days: 3 samples, empty, 60 random) + tests/feel/realsim.test.ts (20 real sim days)
- [x] M5 `paceCheck` + `SessionLog` `src/feel/pace.ts` — tests/feel/pace.test.ts
- [x] M5b (builder #2) re-scope recipes as DATA: `src/feel/score.ts` (interpreter), `src/feel/scores.ts` (12 scores: cardDraw/Hover/Pick/Play/Denied/Discard, mineCrystal ×4 tiers, crystalFed, craft, equip, unequip, devour), `hud.cue` host hook, `recipeMeta(name, params)` (tier sets class), FxBridge kinds crystalStrike/crystalAbsorb/cardPlay/devour/craft/socket/aura with fallbacks to existing kinds while VFX ships them (dead handle id 0 = unknown kind), new SFX names with fallbacks — tests/feel/scores.test.ts (22 tests); all feel tests 513 green
- [x] M5c scores synced to the effects' own beats: `VFX_BEATS` in adapters.ts mirrors VFX `FX_TIMING` (test fails on drift); pick-bite sound at the strike, tier sound + hit-stop at the reveal (common 0.33 s … legendary 1.05 s), card hit at the card landing 0.55 s, devour hit at the maw 0.42 s and the fall at 1.05 s, craft at the fuse 1.0 s, equip at the lock 0.34 s
- [x] M5d Day director: `crystalMined`/`crystalFound` {unit, zone, rarity, amount} and `devoured` {unit, zone, amount, text} (phase "work"): small finds ring out staggered (≤ 4, 0.22 s, rising), the best two rare+ finds get their own beat rising to the headline (rare → legendary) with a shot on the miner, eaten = devour beat + shot; summary lines. Sample day `crystals`. Random-day properties include them.
- [x] M7 (builder #2) §15 re-point: six tiers; Send/intents recipes removed; scores for cards (two decks), burn, strike ×6, pocket, cart, search, followers' own evil, eat, set/unset, cut offer, cut (clean/crack/flaw), graft, blessings, routines, move, devour; code recipes `offering` (dusk reward director, skippable) and `tally` (beats on the VFX chalk strokes) in `src/feel/offering.ts`; Day film about digging (`DAY_KINDS` aliases, picks swing, strikes in the wide, Deep+ push shots, pockets/carts, Tally, searches, own evil); FxBridge maps to the VFX §15 ids (`pickStrike`… `offerReveal`, `offerArrive`, `cartDrop`, `tally`, `eatCrystal`, `burn`, `cut/crack/flaw`, `graft` with donor, `blessing`, `followerEvil`) with fallbacks; strike timing read from VFX `FX_TIMING` directly; offer reveal times mirrored (`VFX_BEATS.offerBreak`). Tests: 544 green in tests/feel (+ tests/feel/offering.test.ts); `tests/feel/realsim.test.ts` currently fails to LOAD because `src/sim` is mid-edit by its owner (`evilBlocker is not a function`) — not FEEL.
- [x] M6 strips (51 files, 0 console errors/warnings; results `/tmp/feel/feel-results.json`, log `/tmp/feel/shots-all.log`): `e2e/feel-shots.cjs` (long strips for offering/tiers/devour/tally/cuts, days first/discovery/pushback/dig), `/tmp/feel/probe.cjs` single frames. Harness stand-ins: card hand, offering row, Tally count (all driven only by FEEL's `hud.cue`).
- [x] M8 (builder #2) the Day frames the shift (`src/feel/shift.ts`, `feel.shiftWide`, `DayCtx.seen/figureH/mineIds`); Tally budget follows its count (the real-sim overstay); real-sim test answers blessing picks; §15.10: cut/crack/graft withdrawn, `enchant`, `recombine`, `facetOffer`/`facet`, `forge`, `give`, `facility`, `tribute`, `exposed`; 1-in-N staging (`revealTier`, `ONE_IN_BANDS`, `ONCE_IN_A_RUN` in `src/feel/score.ts`), Day holds (`PlanCue` kind `hold`, `HOLD_ONE_IN` 10,000, `HOLD_RARE_S` 1.8, `HOLD_ONCE_S` 3.2), sample day `rare`. Tests: 610 green in tests/feel (tests/feel/shift.test.ts new).

## Notes for the play scene (how to wire it)
- Create once: `const feel = createFeel(host, { seed })`; `feel.camera.sync(poseOf(cam))` on the first frame (cutscene hand-over: no motion).
- Forward raw input to `feel.camera` (pointerDown/Move/Up, wheel, key, pinch) instead of moving the Camera yourself; `host.camera.apply(p)` = `setPose(cam, p)`; `host.camera.constrain(p)` = run `constrainCamera` on a scratch Camera with tx/ty/tscale = p and read back tx/ty/tscale.
- Every click: call the recipe in the same handler (`feel.play('select', { unit })` …) — that IS the ≤ 100 ms answer. Clicks with no recipe: `feel.input(name)` so the pacing guard can flag them.
- End Night: `feel.play('endNight')`, then `const film = feel.day(events, { zoneName, isFollower })`; drive the world from `host.stage.hold(zone, v)` (shown Hold 0..100 per frame), `host.stage.apply(event, silent)` (moves, reveals), `host.stage.lift(dir)`; Skip button → `film.skip()`; `film.onEnd((ending) => …)` hands over stageAdvanced/won/defeat.
- `feel.heartbeat(hunger01)` each night; `feel.reset()` on scene exit.
- `feel.log.motion(n)` once a second from the scene (people moving) and `feel.log.prompt(on, id)` for hints, then `paceCheck(feel.log)` in the reel.

## Files touched
- (round 3) src/feel/{notes,fastday,fastfilm}.ts (new), src/feel/{feel,index,host,shift,day,samples}.ts, src/feel/dev/harness.ts, tests/feel/fastday.test.ts (new), tests/feel/{day,pace,realsim,shift}.test.ts (`feel.day` → `feel.highlights`), e2e/feel-shots.cjs (`dayff` mode replaces the old `days`), screenshots/feel-dayff-*.png, DECISIONS.md (FEEL section), handoffs/FEEL.md
- src/feel/{index,host,adapters,camera,recipes,feel,day,pace,samples}.ts, src/feel/kit/{ease,spring,timeline}.ts
- tests/feel/{mockHost.ts,kit,camera,recipes,day,pace,realsim,scores,offering}.test.ts
- src/feel/{score,scores,offering}.ts, src/feel/dev/harness.ts, dev/feel.html, e2e/feel-shots.cjs, screenshots/feel-*.png, DECISIONS.md (FEEL section)
- handoffs/FEEL.md

## Requests (round 3b — exact, small)
- **PLAY-CORE** (`src/scenes/play/index.ts`): (1) pass `cue: (n, p) => this.ui.hud.cue(n, p)` and `deal: () => <deal the night's hands>` into the `FeelAdapter` hooks (FeelSceneHooks already has both as optional) and then **delete `forwardNotes()`** — today every note goes to the HUD from your stand-in with `shown: !!anchor` (light ones too) and string weights the HUD reads as 0. (2) End the Day on `film.onEnd`, not on `clock.phase !== 'day'` (FEEL's dusk is the offering → count → ledger → deal); until your own dusk is gone pass `dusk: false`. (3) Skip button → `film.skipToDusk()` (the catch-up), a second press is instant by itself; `skip()` only for "skip everything". (4) `film.onOfferBeat((b, item, i) => …)` → the HUD strip / VFX `offerReveal` / audio instead of the HUD's self-timed `onOfferBeat`.
- **PLAY-WORLD / BEHAV**: at the `duskWalk {bearers}` cue (or `clock.phase === 'dusk'`), walk those bearers to the grave (`shift.dusk(...)` already knows them) — FEEL sets each stone when the bearer's feet are within 1.6 figure heights of `zoneAnchor('grave')` (`host.camera.unitPos`), else at its planned time + 1 s. During `clock.catchUp` keep reading `clock.t`: people should visibly hurry through the rest of the day (no teleports).
- **HUD** (`src/ui/play/feed.ts`, `index.ts`): (1) re-project live world notes every frame from their `anchor` (they are placed once today; the Day's camera drifts and leans, so they slide off their places); (2) honour `dayNoteHide {id}` / `dayNoteMerge {id, count, text}`; (3) a "Follow the day" button in the day strip shown while `dayFollow {on:false}` → `handlers.onFollowDay?.(true)` → `feel.followDay(true)`; (4) `dayClock {catchUp:true}` / `dayCatchUp` → the clock reads "Skipping to dusk"; (5) the dusk strip driven by FEEL: `offeringOpen {count, tribute}`, `offeringSet {index, id, unit, how}` (husk set down), `offeringReveal {index, rarity, grade, oneIn, best}`, `offeringBest`, `offeringDone` — instead of your own clock.
- **VFX**: `dayMark { at, unit?, zone?, variant: 'normal' | 'heavy', amount: seconds }` — a small flat ground mark under a note's place (ochre / rust ring at the feet, fading over `amount`), never above a head. Stand-in drawing: `drawMarks` in `src/feel/dev/harness.ts`.

## Requests (round 3 — exact calls)
- **PLAY-CORE / PLAY-WORLD** (`src/scenes/play/index.ts`, `feel.ts`): (1) host: forward `hud.cue(n, p)` and `hud.deal()` (feel.ts ~line 87 forwards only pulse/pop/summary/dayProgress/busy). (2) Drive the world from the clock: `shift.p = film.clock.t` and `life.day(pre, state, events, film.clock.t, …)` instead of `this.replay.p`; AMBIENT `dayT = feel.dayClock?.t`. (3) Pass `feed: living.feed, weather: living.weather` and `surface: <town zones the player holds colour in>` in the `feel.day` ctx; in Shade pass `seen` = the visible town zones (FEEL then frames the town wide). (4) Day controls: speed buttons → `film.setSpeed(1|2|4)`; pause → `film.setPaused(b)`; Skip → `film.skipToDusk()`, a second Skip during dusk → `film.skipDusk()`. (5) Drop the scene's own dusk offering / dawn summary / deal — FEEL's dusk cues them (`offering` recipe → `offeringOpen/Reveal/Done`, `duskCount`, `ledger`, `hud.deal()`); until you do, pass `dusk: false` and keep yours. (6) `film.onEnd` = the night begins (after the deal).
- **HUD**: draw the day notes from `dayNote {entry, anchor, shown}` (at the place, beside it — not over a head (owner rule 5); when the place is off screen, at the nearest edge with an arrow), `dayNoteMerge {id, count, text}`, `dayNoteHide {id}`; keep every entry in a clickable feed and call `feel.focusNote(entry.id)` on a click; the small clock from `hud.dayProgress(t, label)` + `dayClock {speed, paused, phase}`; `duskCount {stones, byTier, kept, tribute}`; `ledger {lines: {text, tone}[]}` (≤ 5 lines; the dawn summary box is gone); `duskStart` / `duskEnd`. FEEL guarantees ≤ 3 notes up at once. `src/feel/dev/harness.ts` (`noteCue`, `updateNotes`) shows the intended behaviour.
- **BEHAV**: read `feel.dayClock.t` (0..1) as the Day's `p` (it slows ×0.25 on heavy notes and stops on a rare-strike hold: people slow with it — that is the intended "slow-motion"); `feel.dayClock.phase === 'dusk'` = the walk home / the offering.
- **LIVING**: feed entries `{ time, kind, place, who[], textKey, slots, weight: 'light'|'normal'|'heavy' (or 1/2/3), text }` — please include a plain `text` fallback; FEEL writes a generic line otherwise. Weather timeline `{ t, kind, strength, windDir }`; a feed entry whose kind mentions weather/rain/storm/fog stops FEEL writing its own weather notes.
- **WEATHER / AMBIENT**: the time of day and the weather position are `feel.dayClock.t` (and `.weather`, the timeline point in force).

## Requests
- **VFX** (`handoffs/VFX.md`): please accept these kinds in `fx.spawn` (or tell me yours and I change `src/feel/adapters.ts` `FX` only): hover, select, whisperThread {at, toUnit}, whisperHeard {unit}, turnRipple {unit|zone}, threadFray {unit}, prayerWisp {unit, to}, netherArrive {at, amount}, ichorPip {at, amount}, hungerDim {at, intensity}, eatCrystal {at}, levelUp {zone, amount}, divinityUp {zone, amount}, graveFlare {zone, variant:'gather'}, veinRace {zone, intensity, amount}, rootBloom {zone}, wither {zone, amount}, seep, sendRoute {unit, toZone, path, variant:'preview'|'commit'}, sendRouteClear {unit}, arrivalMark {unit, zone}, lampSweep {unit, zone, variant?:'search'}, discover {zone, unit, variant: kind}, crystalPour {unit, to, amount}, spreadWord, lieLow {unit, variant:'on'|'off'}, miracle {variant: id, zone|unit}, evil {variant: act}, wardFlare {zone, variant: track}, guardNotice {unit}, purgeFire {zone}, templeBell {zone}, inquisitorLight {unit, zone}, lockdown, caught {unit, variant?:'lost'}, caveDust, duskSettle, dawnBell {zone:'lift'}. Every call carries `reduceMotion`.
- **P3 audio**: `has(name)` on the engine (or the play scene's adapter) so new names fall back cleanly; names used are in `SFX` in `src/feel/adapters.ts`. `holdGain` takes `pitch` (FEEL sends a rising pentatonic 1, 9/8, 5/4, 3/2, 5/3, 2 …) and is rate-limited by FEEL to one per 0.14 s.
- **HUD**: `pulse(id)`, `pop(id, { value, at? })` (at = world point → the number rises there, e.g. at the grave), `summary(lines)`, `dayProgress(t01, label)`, `busy(on)` (grey End Night). Ids used: nether, crystals, ichor, hunger, danger, goal, endNight, level, malice, miracle, plus unlock ids.
- **AMBIENT**: `atmosphere.cue(c, ms)` with c = dawn | dusk | dim (a short dip; a cut happens at its middle) | flash (Divinity only, never with reduce motion) | hunger (a vignette heartbeat).
- **People**: `react(unitId, r)` with r = look, shiver, kneel, glance, flinch, recoil, cheer, fall, set-off, arrive, work, hide.
- **PLAY-v2**: implement `FeelHost` (above) and route camera input through `feel.camera`.

## Round 3b — WRITING round 4 adopted
`createFeel(host, { seed, runSeed? })` keeps one `createNotebook(runSeed)` (`feel.notebook`); `feel.day` reads every LIVING feed line through `notebook.feed(item)` (fallback: LIVING's `text`) and FEEL's own weather-turn lines through `feed({textKey:'weather.<kind>'})`. New ctx `dayIndex`, `calendar` → `plan.dusk.title = text.duskDay(calendar, dayIndex)` (sent as `ledger {lines, title}`) and `plan.dusk.night = text.night(dayIndex)` (sent as `duskEnd {night}`). Rain / storm / fog turns are now `normal` notes (on screen). Test in tests/feel/dusk.test.ts.

## Self-grade (round 3b) — 8/10
Evidence: `screenshots/feel-day-{moments,heavy,skip,follow}.png`, `screenshots/feel-dusk-{offering,tribute}.png` (full frames `/tmp/feel/day-*.png`, `/tmp/feel/dusk-*.png`); tests/feel 650 green; 0 console errors / warnings in all runs (`/tmp/feel/day-run{2,3}.log`).
Worst three: (1) the harness people do not live their plans, so the strips show a still shift with notes and leans over it, and the dusk bearers never visibly walk (arrivals there come from the planned walk + grace: 1.9 / 2.4 / 2.8 / 3.3 s); arrival-timing is proven only headless (tests/feel/dusk.test.ts, walking units) until BEHAV walks bearers in the game; (2) notes, feed, follow button, offering row and ledger in the strips are FEEL's stand-ins; in the game the HUD draws them only once PLAY-CORE forwards `hud.cue` (today it forwards notes itself: every note shown, string weights) — see Requests; (3) the harness `dim` stand-in makes the Royal anticipation frame very dark for ~1 s (AMBIENT's real dim is gentler).

## Exact next steps
1. When PLAY-CORE forwards `cue`/`deal` and ends the Day on `film.onEnd`: shoot the real game (`/?scene=play&seed=7&mute=1`, End Night, sample `__hg.play.dayClock`) for the same 6 strips and compare.
2. Probe why harness bearers are never "in the chamber" (log `world.personPos(u)` vs `zoneBounds('grave')` at `duskWalk`); if mine people do not walk on a zoneId change, lerp a position override in the harness stand-in.
3. Tune `NOTE_SHOW_S` / merge window at ×4 on a real LIVING week once the HUD draws the notes.

## Seen in the strips (round 3b, builder #4)
- Rerun after the containment fix: `feel-day-heavy.png` — the lean on the 1-in-12,000 Deep stays on the lit mine (gray sensed workings below, no black band), eases in 0.8 s, holds through the reveal ring, back on the wide by +3.6 s. `feel-dusk-offering.png` (rare day, 5 stones, 4 bearers): shift ends → stones set one by one (husks in the row) 1.9–3.5 s → anticipation dim → reveals rising, Royal best held → count → ledger → cards → night at ~9.5 s.
- `feel-day-moments.png` (dig day ×1, 8 clock points): dawn → morning quiet wide (no notes: the sample's events start at 32 %); midday the Deep strike note beside the miner + ground ring; afternoon the lean onto the Impossible in the East Works (legible: rails, carts, crystals, the miner, the note beside him); evening the camera on the lift for the short count + "Rusk frightened a neighbour…"; feed on the right.
- `feel-day-heavy.png` (first run): the lean onto the 1-in-12,000 Deep pushed toward the bottom edge of the seen mine and showed ~40 % black under it → FIXED: leans, drift and the dusk shot are now contained in the seen zones' box (`film.lit`), a place outside the wide gets no lean; rerun pending in `/tmp/feel/day-run2.log`.
- `feel-day-skip.png`: Skip at 5.1 s, "skipping to dusk »", clock 28 → 95 % in 0.8 s, the heavy Deep note ("Old Wick struck a Deep stone…") shown during the race, light ones only in the feed; dusk at 6.1 s. Harness bug fixed after: its `duskStart` stand-in cleared the kept heavy note; zone names for lowgallery etc.
- `feel-day-follow.png`: the player drags at 3 s → "Follow the day" appears, nothing moves the camera for 1.5 s; toggle at 5.3 s → by 6.1 s back on the wide.
- `feel-dusk-offering.png` (first run) used the dig day, which has no offering (empty dusk: count → ledger → deal readable); the 5-stone haul is on the `rare` day → rerun pending.

## Self-grade (round 3 — the Day fast-forward)
- **8/10** against "does ending a turn feel like watching a living place go about its day, and can I always tell what just happened and where?" Evidence: `screenshots/feel-dayff-*.png`; tests/feel/fastday.test.ts (31) + all tests/feel green; 0 console errors. The day runs on one clock in 18 s, every event lands at its own time with a plain note at its place (merged so ≤ 3 are up; nothing is lost from the feed), heavy news slows the clock and leans the camera only when the player has not taken it, the rare strike stops it, and the dusk plays offering → count → ledger → deal in 5.6–7.4 s on the sample days.
- Worst faults a hostile critic would name: (1) in the harness the people do not live their plans (BEHAV moves them by `dayClock.t` in the game; here only `moved` events teleport them), so the strips show notes over a still world — the "living place" half depends on BEHAV/LIVING reading the clock; (2) notes, feed, clock and ledger are FEEL's stand-ins until the HUD draws the cues — and a note beside a place is a label in the world, which the owner's rule 5 forbids over heads: the HUD must place them beside, not above, people; (3) town places seen at mine zoom are only an edge note with an arrow (no lean when light) — at Whisper most of LIVING's town life will read as "elsewhere" lines; a sound or a soft pulse at the edge would help.
- Next: when HUD lands its feed, a strip of the real HUD; when LIVING lands, run its real week through `planFastDay` (density 8–16 notes + sim events) and tune `NOTE_SHOW_S` / merge window at ×4.

## Self-grade
- M1–M5 (logic only, no pictures yet): 7/10 — the maths and staging rules are tested, but nothing has been seen. Worst: (1) no visual evidence; (2) recipes call effect names VFX has not confirmed; (3) the film's camera shots have only been checked numerically.
- **VFX (§15)**: export in `FX_TIMING` the times FEEL now mirrors by hand: `offerBreak[6]`, `tallyStart`/`tallyTick`, `absorbArrive`, `devourOpen`, a strike glint time; read `grade` (the stone's colour) and `oneIn` on `crystalStrike` / `offerReveal`, where `rarity` is now the STAGED tier (timing and size).
- **Audio (§15)**: new names (fallbacks in `SFX`): crystalDull…crystalImpossible, shimmer, pickStrike, tallyTick/tallyShort/tallyEven, procession, offerSet, cut, burnCrystal, enchant, curse, recombine, tribute, facility, forge, give, exposed, blessDeal, blessPick, routineSet, moveOk, pocket, cartRoll, search, cardDeal/Hover/Pick/Play/Burn, devour, scream; and `has(name)`.
- **HUD (§15)**: `hud.cue(name, p)` names: cardDealt {index,deck}, cardLift, cardHeld, cardRelease, cardShake, cardBurn, crystalBurn, offeringOpen/Reveal {index,tier,best}/Best/Done {skipped?}/Empty, tallyOpen/Tick/Short/Even, enchantGather/enchantFade/enchantLand/enchantLine/enchantCurse, recombineIn/recombineReveal/recombineUp, facetShown/facetDone, forgeStroke/jewelryForged, itemGiven, facilityGained/facilityVerb, tributeArrive/tributeLaid, itemExposed, onceInARun {oneIn}, blessingShown/blessingPicked, apSpent. Pulse ids added: hand, ap, sockets. The harness stand-ins in `src/feel/dev/harness.ts` show the intended reaction to each.
- **SIM-v3**: emit Day events under the names in `DAY_KINDS` (src/feel/day.ts): strike {unit, zone, rarity 0..5|name}, pocketed, carted, tally {result:'short'|'even', count, missing, unit}, search {unit, zone, found}, followerEvil {unit, zone, act}. `tests/feel/realsim.test.ts` cannot load right now (`evilBlocker is not a function` in src/sim).
- **PLAY-v2**: at dusk `const m = feel.play('offering', { items })` (Skip → `m.skip()`), then `feel.play('cardDraw', {deck:'miracle', count:3})` and `{deck:'evil'}`; burn payment `feel.play('burnCrystals', {...})` before `cardPlay`.
- **Mine renderer**: Chrome logs "Canvas2D: Multiple readback operations using getImageData" from the mine engine on some runs; set `willReadFrequently: true` on that context.

## Seen in the strips (M7)
- `feel-offering.png`: the bearers arrive, crystals land in the row one by one ascending, the dim falls just before the best (Royal) at ~4.2 s, the best card is ringed and held, done at 5.6 s. Reads as a reward beat.
- `feel-day-dig.png`: picks in the wide, push on the Deep find (1.7 s), bigger push on the Impossible (star burst at ~5 s frame), the lift shot for the short Tally, the follower's own evil, back to the wide for the summary. 10.0 s, 4 shots.
- Browser pace check flags 9 "dead" gaps of 3.5–5.5 s: all are the shots script pausing between demos for captures (no motion logged), not game time. The unit test of a real night+day session is clean.

## Self-grade (M7, §15 re-point)
- 8/10. Every §15 verb has a recipe, synced to the VFX beats and tested (544 green); the offering and the digging Day read in the strips; zero console errors.
- Worst faults: (1) the hand, offering row and Tally count are only harness stand-ins; the real HUD must implement the `hud.cue` names or these beats land on nothing; (2) offering reveal times and tally ticks are mirrored constants, not read from VFX, so they can drift (tests guard strike/card/devour/socket only); (3) the dig Day hits the 10 s ceiling with 4 shots; on a busier day the later beats (own evil, opposition) get compressed to under 1 s each. Minor: the devour scream lands while the camera is still gliding.

## Seen in the strips (M8)
- `feel-day-dig-far.png`: the player had pulled out to a small island in black (frame 0); by 1.7 s the film is on the shift wide (the worked faces fill the view, figures readable), pushes on the Deep and the Impossible, the lift for the Tally, back to the wide, and at the end back to the player's own far framing. Run: `/tmp/feel/shots-1510.log`, 0 console errors/warnings.
- `feel-day-rare.png`: 13.2 s = 10.0 s plan + 3.2 s hold on the 1-in-150,000 find. `feel-exposed.png`: dim and close-in at once, the stop at 0.7 s, back by 1.8 s. Strips also for enchant(-curse, -reroll), recombine(-up), facetOffer, facet, forge, give, facility, tribute, mineCrystal-1in12000 / -1in150000.

## Self-grade (M8)
- 8/10. The Day now frames the shift whatever the player's zoom, rare rolls are staged by how rare they are, every §15.10 crafting moment has a tested recipe; 610 tests green; 0 console errors.
- Worst faults: (1) the hand, offering row, Tally count and the new craft cues land only on harness stand-ins until the HUD implements the `hud.cue` names; (2) VFX does not yet read `grade`/`oneIn`, so a 1-in-12,000 Deep strike is drawn in Impossible colours (timing is right); (3) the end of the film glides back to the player's framing, which can again be a far pose — PLAY-WORLD may prefer to stay on the shift wide into the dusk offering (one line: do not call `goHome`; ask me).
