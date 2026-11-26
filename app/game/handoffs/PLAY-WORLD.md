# PLAY-WORLD — everything drawn on the canvas during play (running handoff)

## >>> Successor 3 (09:2x →) — STATUS (newest first; read this block first)
- Boot: direct `?scene=play` still unproven (the mine engine now bakes the engine's own walls on a sync entry, index.ts 09:19);
  the integrated build reaches play through the front page — verification now runs through the shot loop:
  `PORT=5232 node e2e/playtest/shots.cjs --seed 7 --until <beat> --out /tmp/playworld3/reelN` (takes lock 0 itself; ~4 min to `recombine`).
- Baseline (reel1, 09:3x, old hoard): whisper net 0.25 %, offering net 2.94 %, set −0.09 % (BROKEN), recombine 0.64 % (BROKEN).
- [in progress] **The grave hoard rewritten** (`grave.ts`): loose stones in two heaps either side of the grave's hole, the
  sockets = seats on the hole's front rim (drawn by the hoard now; `index.ts drawSockets` stands down via one `// PLAY-WORLD`
  line), every change is a movement (set/unset fly between heap and seat, recombine = two fly together and one new stone is
  struck, eat/burn sink into the hole), the grave drinks each change (violet wash rises 0.25 s, holds to 2.2 s, ebbs by 4 s),
  a set stone gets a column of its light (3 s) and a lasting pool. Geometry knobs: `HOARD` in grave.ts.
- [done] fx.ts host carries `grave` (VFX round 5); wick effects get `feet` (+ `grave` on wickTurn); `__hgWorld.wick()` counts turns.
- Seen: Mara (turned by a whisper) keeps a GOLD lamp on her hat in the mine renderer — request to the people renderer below.
- [done 09:5x] Direct `?scene=play` boots again: night up in 24 s on the static build (`/tmp/playworld3/grave-probe.cjs`).
- [done] wickTurn verified in the live game: `__hgWorld.wick().turns` = 1 after a whisper on Mara; the violet flood, rings and
  veins toward the grave show 2–3 s after the click (frames `/tmp/playworld3/whgrid.png`). The harness's whisper beat measures
  at 1.4 s after the click, i.e. 0.5 s into the effect (still in its "old light gutters" phase) — hence its small net change.
- [done] VFX r5 call sites: FxHost `grave`; `feet` on every wick kind; `near` (neighbours' crowns) on wickGutter; `offerReveal
  {best: true}` on the strip's 'best' beat (one `// PLAY-WORLD` line in index.ts `offerBeat`).
- [done] **Empty dawn** (`life.ts dawnOf`, `shift.planA`): on the Day's first frame the stage is probed at plan times from
  PLAN_A; when fewer than 10 people stand in the mine (the cage held up — LIVING's liftJam on seed 7 day 1, which the plan
  itself does not show: BEHAV stages it) film 0 moves to the first plan time with ≥ 10 below (≤ 0.3). planT/filmT take
  `shift.planA`; reset every `shift.begin`. Unit test `tests/play-world/grave.test.ts`.

- [done 10:2x] Grave hoard on its OWN wall clock (`performance.now()`): driven by the overlay host's `time`, none of the hoard's
  movements showed in the shot loop while the grave panel was open (reel3: set −0.12 %); on wall time they do (reel4: +1.07 %).
  Cause not pinned down (the scene's `now()` does advance) — VFX at the grave may share it. Hole calibrated on a marked frame (`/tmp/playworld3/calib-mark.png`: anchor = base of the great crystal, hole
  centre = anchor + (0, 7.6), rx 12, ry 3.6). Arrivals drop out of the dark onto their heap with a column of light; a merge
  strikes a column; drink amount up to 2.
- Shot loop reel4 (seed 7, 10:1x): whisper PRESENT net 1.21 % (was 0.25); Day PRESENT, 5 notes placed (was 2, BROKEN);
  set PRESENT net 1.07 % (was −0.09, BROKEN); recombine 0.68 % (needs 0.8 — strengthened since); offering 0.12 % BROKEN
  (arrival drop + column added since; re-check).
- [done] `dayT` in every WorldView (world.ts feedAmbient — computed even without AMBIENT): the surface's daylight follows the Day.
- [done] Followers' ground from the sim: `sim.colourSeeds()` (hearths + strong haunts get violet seed points; zones Sensed).
- [done] `FeelAdapter.followDay(on)`.
- [done] **The Day's framing** (feel.ts): `seen` for FEEL = seen mine zones with today's events, coloured zones and the grave
  (≥ 2, else all seen); `surface` only when no mine zone is seen — a mine + town box put the mine in the middle of a black
  screen at 18-px figures (FEEL's MIXED_MIN_FIG_PX). Probe (seed 7 Day 1): the film now holds the grave + heartvein + cartway
  at ~5×, 16–34 people on screen from film 0.06 (`/tmp/playworld3/dpgrid.png`).
- (1) of PLAY-CORE's list: `society.ts` already uses the sim's Day film (`shift.film.plan` = `session.lastDay.plan`) for the Day
  itself; `planDay` is only called for TOMORROW during the night (no sim film exists yet then).

- [done] **VFX round 6 wired on the world side** (fx.ts): `FxAdapter.places()` (SimPlaces: grave mouth = the hole, `socket(i)` =
  the hoard's seats, `hoard(id)` = where a stone lies now, `unit`/`crown`/`zone`/`crystal`, `drawsStones: true`),
  `FxAdapter.onSimEvent(ev)` (routes one sim event; the hoard then leaves wash/column to VFX), and `graveState` every frame from
  `FxAdapter.update` (VFX's standing aura replaces the hoard's own pool under set stones).

- [done] **Audio theme round** (world.ts `audioView`): one `audio.setView(view)` per 4 Hz tick when the engine has it — place
  (grave / mine / town / valley), zoom 0..1 (log scale 15 → 0.05), phase / time / speed from FEEL's clock, weather, `near`
  (lift, carts, water, smelter, market, temple, council, road, crowd = society on screen / 40), `liftMoving`, `holy` (the
  calendar's Flame day); `audio.setWeather(weather.state.audio)` every frame; `weather.onThunder → audio.thunder(strength,
  delay)`. The old `setAmbience` table stays only as the fallback when `setView` is missing. Not passed: `mood`, `nether`
  (the world does not know them — PLAY-CORE can call `setMood`; `nether` needs the sim).

### Requests (successor 3)
- **PLAY-CORE:** route the scene's sim events through `this.fx.onSimEvent(e) // PLAY-WORLD` (VFX round 6: one call per event,
  the right kinds and points) where `moment()` now hand-picks VFX kinds — at least for the grave kinds (socket / unsocket /
  enchant / curse / recombine / eat / burn / offered). Call it BEFORE the state changes the grave (it reads `hoard(id)` = where
  the stone lay) or right after — the hoard keeps the last frame's places until the next draw, so right after is fine.
- **PLAY-CORE / VFX (to check):** with the grave panel open, the hoard's movements on the overlay host's `time` did not show in
  the shot loop (see status); check that the scene's `socket`/`recombine` VFX at the grave play while the panel is open.
- **People renderer (mine people `src/render/mine/people.ts` + `src/render/people/paint.ts`):** a follower's lamp/wick on the
  hat is still GOLD after the turn (Mara, seed 7 night 1, crest 'follower', `PersonView.wick = {tone:'violet'}`): draw the
  wick from `PersonView.wick.tone` ('violet' | 'gold' | 'pale', `state:'dead'` = out) so "yours" reads at play zoom.

Builder #1 (2026-11-23). Port 5232 (browser lock `/tmp/hg-pw-0.lock`). Scratch `/tmp/playworld/`.
Owns: `src/scenes/play/{world,life,day,fx,feel,crystalart}.ts` + new `src/scenes/play/{shift,stage,…}.ts`, `e2e/play-world-shots.cjs`,
`screenshots/play-world-*.png`. Sibling PLAY-CORE (port 5205) owns `index.ts`, `hudbridge.ts`, `night.ts`, `sim.ts`, … .

## Interface to PLAY-CORE (exact; additive only)

Everything goes through `PlayWorld` (`this.world`) and the shared module `src/scenes/play/shift.ts`. The lines in
`index.ts` are one-liners marked `// PLAY-WORLD` (already in place — keep them when you edit around them):
```ts
import { shift, shiftFromStandin } from './shift'; // PLAY-WORLD
// enter(), after `new PlayWorld`: what the world needs to know (routines → the life director; the grave's crystals → the hoard)
this.world.facts = { routineOf: (u) => …, grave: () => ({ loose: Crystal[], sockets: (Crystal|null)[] }) }; // PLAY-WORLD
// endNight(), BEFORE feel.day / life.day: the Day's mining events (v3 shapes, `time` 0..1). Real sim: pass r.events
// (non-mining kinds are ignored); stand-in: shiftFromStandin(dayMining, unit → work zone).
shift.begin(events, turn); this.strikes = []; // PLAY-WORLD
// offering() at dusk: who walks to the grave (tribute = one stone, a lone walk; Offer = the procession, automatic)
shift.dusk(off.map((o) => ({ unit: o.unit, tribute: o.crystal.origin === 'tribute' }))); // PLAY-WORLD
// exit()
this.world.dispose(); // PLAY-WORLD
// const PUSH_SCALE = 7.5  // PLAY-WORLD: default close-up, figure ≈ 45 px on a 900-px view
```
`ShiftEvent` = `strike {unit, zone, rarity, kept, crystal?, seed?, offer?, time}` · `skimmed` · `carted {zone, count, byRarity?, time}` ·
`tally {expected, counted, short, time}` · `search {unit, found, caught, time}` · `followerEvil` · `offered` (handoffs/P4.md shapes).
- The world reads the Day's progress from `shift.p` (set by `LifeAdapter.day(…, t01, …)` every frame) — no per-frame call needed.
- `feel.day(events, ctx)` (feel.ts) merges `shift.events` (only those in zones the player can see), adds `seen` + `figureH: 6`.
  `life.day(...)` (life.ts) merges `shift.events` for BEHAV (miners stop, look, pocket or carry to the cart; the count queue; searches).
- FEEL's effects reach VFX unchanged now (fx.ts passes VFX-native kinds/params straight through and returns the handle —
  before this fix every FEEL effect with world points was dropped: strike glints, pockets, cards, auras, offer reveals …).
- AMBIENT runs (`world.ts`: `createAmbient` + `attachWorld`, fed each frame: phase, dayT on the Day's clock, lift, bell; at
  `shift.begin` cart loads per face + working faces; strikes/carted/tally pulse at their faces as they come due).
- Requests to PLAY-CORE: (1) when the real sim lands, call `shift.begin(r.events, turn)` with the sim's own events;
  (2) keep `facts.grave()` returning `{ loose, sockets }` with `id`, `tier`, `seed|shapeSeed` (+ `oneIn`, `affinity` when you have them).

## Status (builder #1, stopping at ~240k context, 06:5x)
- M1 (living shift) — PARTLY: shift events wired end to end (sim stand-in → `shift` → BEHAV / FEEL film / AMBIENT / VFX);
  the film frames the seen mine (no island, no push into black); strikes glint at the miner; carts + count pulse in AMBIENT.
  NOT YET: the shift *reads* as a worked mine — too few people in the seen area (population, see Requests).
- M2 (night) — PARTLY: default zoom 7.5 (figure ≈ 45 px; night 2 rest 10/12 people on screen moving, night 3 11/13 — the
  "freeze" is gone at the default view); grave hoard in the world; tribute walks; routines passed to BEHAV (pray / lie low);
  wick + hood fields passed on every PersonView (additive, for the theme's people renderers). NOT YET: offering timing vs bearers.
- M3 (colour/surface) — PARTLY: AMBIENT attached and on the Day's clock; weather call site. NOT YET: audio ambience levels
  from what is on screen; Whole world at night is near-black (town zones are Void on night 1 — see next steps).
- M4 (town / finale) — NOT STARTED.
- Evidence: `/tmp/playworld/sheet3.png` (= `screenshots/play-world-sheet-n1n2.png`: night 1 rest, Day 1 ×3, dusk 1 with the
  offering strip, night 2, Day 2 ×2 in daylight grade, dusk 2 reveal at the grave, Whole world), `screenshots/play-world-grave-hoard.png`
  (three crystals lying at the grave's lip), `screenshots/play-world-day1.png`, `screenshots/play-world-dusk2.png`; 0 console errors
  in every run (seed 7, 2 nights). Probe: `/tmp/playworld/probe.cjs` = `e2e/play-world-shots.cjs`.

## Log
- 05:4x — found: FEEL's effects never reached VFX (adapter dropped VFX-native kinds) → fixed. Day film: `seen` passed (shift
  wide frames the visible part of the mine, figures ≥ 34 px); unseen strikes kept out of the film (a push into black before).
  Shift module + unit test (`tests/play-world/shift.test.ts`, 3 green). AMBIENT attached. Grave hoard (`grave.ts`): loose crystals
  lie at the grave's lip and drop in as they arrive. Depth mark (`depth.ts`): fathom gauge at the left edge inside the mine.
  Dusk: tribute bearers walk alone (BEHAV `offer` event). Weather call site in `world.ts` (binds `attach(world)` when it exists).
- Night freeze (LOOP): headless, BEHAV's night 2 is as lively as night 1 (`/tmp/playworld/lifetest.ts`: 236 moving samples / 20
  frames). In the browser the close-up showed 0–1 people: the grave's chamber is nearly empty at night (stand-in sim: ~21 people
  in the mine, 3 of them in the seen zones by day). The default zoom is now wider (scale 7.5).

## Requests
- **SIM / LIVING:** the mine needs its people (spec §3: ~60 in the mine by day, ≥ 20 trades); today the stand-in has ~21 in the mine
  and 3 in the zones a player sees on night 1 — a Day film there cannot look like a worked mine.
- **BEHAV:** dusk offering — bearers start `HEAD` 280 mine units away and arrive ~9 s + 2.2 s each after dusk, while the scene
  reveals at 0.6 + 0.7 s × i: start them ≤ 1.5 s from the grave (or expose the arrival times) so a stone is set down when it is revealed.
- **Mine engine / terrain:** depth legible in the art: the lower workings (heartvein, lowgallery, grave) darker and stranger,
  the Deep (sump) darkest with richer veins (soft per-pixel, no zone edges). I only draw the gauge.
- **HUD:** `offering(list, { onReveal?(i) })` so the world can set each stone down in step with the strip.

## Self-grade (06:5x): 6 / 10 — not done
Worst three (hostile critic):
1. **It still does not look like a mine being worked.** In the Day wide 2–4 figures are visible; the stand-in sim puts ~21 people
   in the mine and 3 in the seen zones. Strikes are small glints on one or two miners. Needs LIVING's population (~60 mine
   workers by day) and the seen area to include faces; then re-check the film.
2. **Whole world at night is a black screen with a dot** (town zones are Void until explored/adjacent). §16 wants the surface
   (pit head, rows) part of the picture from night 1 with colour seeded where followers live.
3. **The dusk offering is not in step:** the reveals (HUD strip + VFX at the grave) run at 0.6 + 0.7 s × i while BEHAV's bearers
   arrive ~9 s later; the tribute walk is wired but unseen in the strips.

## Exact next steps (successor)
1. `npx tsc --noEmit | grep src/scenes/play/` (mine: world, shift, life, fx, feel, grave, depth, crystalart); `npx vitest run tests/play-world`.
2. Surface from night 1: in `world.ts build()` make the pit head (`minehead`) and the town blocks where followers live Sensed
   (and seed `holdAt` at followers' homes when the sim gives homes) — agree with SIM/LIVING who owns that rule; then Whole world
   shows a gray-gold town with violet points.
3. Dusk timing: when BEHAV exposes arrival times (or starts bearers ≤ 1.5 s away), schedule the grave's `offerReveal` per bearer
   (ask PLAY-CORE to take the delays from `shift`), and give the HUD strip `onReveal` (request below).
4. When FEEL round 3 lands ("the Day fast-forward"), read its clock instead of `shift.p` (set `shift.p` from the film's t01 in
   `feel.ts`), keep `seen` + `figureH`, pass `oneIn` on crystals (grave hoard already passes what `facts.grave()` gives).
5. Audio ambience from the view: `world.ts` — count carts/flames/water in view → `sc.audio.setAmbience({ lift, carts, water, … })`
   (needs a hook from PLAY-CORE: `this.world.audio = this.sc.audio // PLAY-WORLD`).
6. M4: CAST in the town's props seam (`handoffs/CAST.md`, `castRoleOf`), town `ownPeople=false`, FINALE's watershed/ending with the
   live world; read places from `townFacilities` / `townHomes` (theme re-plan).
7. Re-run `e2e/play-world-shots.cjs` (NIGHTS=3 ZOOM=1, background, timeout 1500 — the box is slow) and self-grade the 3-night set.

## Theme kit (after the report, 2026-11-23)
- `depth.ts` now takes its tone from `src/render/theme/palette.ts` (`PAL.teal.lit`, neutral); its violet pulse is removed (violet is the player's colour, never decoration).
- Still to move onto the kit: the stand-in crystal in `crystalart.ts` (still uses `TIER_COLOUR`; only drawn when CRYSTAL is not loaded); `wickOf` in `world.ts` should use the kit's tone names and `wickLight` from `src/render/theme/folk.ts` once the people renderers read `wick` (see `handoffs/THEME.md`).

## Successor 2 (2026-11-23, 07:0x →) — running status
Lock is `/tmp/hg-pw-0.lock` (5232 % 3 = 0). Probe `/tmp/playworld/probe2.cjs` (vis / pose / counts per moment).
- [done] tsc clean for src/scenes/play; tests/play-world 5 green (+ `clock.test.ts`).
- [done] **Film clock ↔ plan time** (`shift.ts planT/filmT`, PLAN_A 0.095, PLAN_B 0.9): LIVING's day starts with everyone
  at home and ends with the mine empty (plan 0–0.1 and 0.86–1 = an empty mine = a dead 4 s of film). The stage now runs on
  `planT(film t)` (events' times mapped too, life.ts); LIVING's feed and weather go to FEEL in film time (`filmT`, feel.ts).
  Film 0 = the cage going down full (52 riders), film ≈ 0.95 = the last cage up.
- [done] **Whole world** = the known world (`world.ts poseAll`): pit head + every non-Void town block (surface frame when ≤ 3
  blocks; the town round them when more; everything = `frameAll`).
- [done] `__hgWorld` debug: `pose()`, `shift()`, `ground()` (followers' Sensed ground) besides `count()`, `vis()`.
- [done] **Ambience from the view** (`world.ts mixAmbience`, 4 Hz, changed beds only; PLAY-CORE's line 144 hands `sc.audio`):
  lift / carts / water / seep / smelter / market / wind / rain / storm / fog / night. `grave`/`procession` stay the scene's.
- [done] **Crystals whole** (CRYSTAL's report): `crystalart.ts` passes the whole stone (`{...c, seed, rarity}`, anchor 'base'),
  `grave.ts` hoard keeps every field — base, affinity, mods, curse, effect, oneIn reach CRYSTAL.
- Measured (seed 7, real sim now, `/tmp/playworld/s2`): Day 1 on screen 0 / 0 / 21 / 24 / 37 / 29 at film 0.04 / 0.07 / 0.23 /
  0.53 / 0.78 / 0.96 (dawn 0 = LIVING's "the lift sticks halfway down with a full cage" event on seed 7 day 1; riders in the cage
  are not counted). Before the remap: 0 / 4 / 12 / 22. Whole world at night: median luminance 6 — the surface at night is near
  black (TOWN-ART's night grade); probing zooms over the pit (`/tmp/playworld/look.cjs`).
- [done] **Dusk bearers = BEHAV's walk (BEHAV v4.1; FEEL 3b requests):** bearers = the Day's `offered` units (at `shift.begin`) +
  FEEL's `duskWalk {bearers}` (feel.ts host now always has `hud.cue`: it reads duskWalk, then forwards to the scene's cue if any) +
  the scene's dusk list → `shift.bearerIds` → `StageOpts.bearers` on every `stage()` call of that Day and its dusk/night.
  BEHAV keeps them below after the shift, walks them to the grave with their find, sets it down at ≈ 0.93. PLAY-WORLD wrote no
  walk of its own (the old `offer` events only feed the pre-stage night fallback). `frame.bearers` → `shift.arrivals`
  ({id, kind, arrive, leave} plan time). **The film ends when the last bearer kneels:** `shift.planB` = last arrive + 0.012
  (0.9 … 0.985, set at the first frame of the Day), so FEEL's dusk finds them at the grave (its ARRIVE_R test passes) and
  `world.arrival(unit)` (a promise: within ~1.6 figures of the grave, or 3.4 s) resolves at once.
- [done] **Night by stage() for everyone** (BEHAV v4.1 request 4): sim units too (`sim: {state, nightEvents}`); dusk continues
  plan time from `shift.planB` at film pace (18 s per plan unit) to 1.25, then BEHAV's night clock. Old `night()` = fallback.
- [done] **catchUp**: nothing to do — the stage reads `planT(clock.t)` every frame (pure in t); people hurry with the racing clock.
- [done] **WEATHER attached** (`world.ts feedWeather`): `createWeather({quality:'low'})`, `attachWorld`, `linkAmbient(amb)`,
  timeline = `fromLiving([today's plan, tomorrow's plan])`, `update(dt, livingPos(shift.planNow))` after AMBIENT; `?weather=0`.
- [done] **VFX round 4** (`fx.ts`): `dayMark` → VFX `dayMark {x, y, variant, amount, owner?, kind?}`. **Wick moments**
  (`world.ts wickMoments`, at `crownOf(unit)` = feet − 5.6 mine / 29 town world units): every conversion (the follower flag
  flips, whatever path) → `wickTurn {from}`; fear reacts (flinch/cower/recoil/shiver…) → `wickGutter`; set to Pray →
  `wickFlare`; Lie low → `wickHood`; death → `wickOut` at the last crown. Caller contract: during wickTurn (1.55 s) the figure
  keeps its old crest with `wick.state 'dead'`, then flips to violet; during wickHood (0.85 s) no hood yet. NOTE: the people
  renderers do not read `PersonView.wick` yet (they colour the wick from `crest`) — request below.
- Static build for shots (`STATIC=<dir>` in e2e/play-world-shots.cjs; `npx vite build --outDir /tmp/playworld/dist`): the dev
  server's first load timed out at 180 s under load 20.
- [done] **SIM v3.2** (receiving side): `hew` (LIVING's diggers) in `SHIFT_KINDS` → AMBIENT strike pulse + a small glint
  (never counted); `shift.begin(events, turn, film?)` stores the sim's Day film; `SocietyAdapter.day(d)` uses `film.plan`
  when its dayIndex is d (no second `planDay`); feel.ts stops passing LIVING's feed when the events already carry `living`
  notes, and takes the weather slices from `film.weather`.

### BLOCKER found at 09:1x (not PLAY-WORLD's code)
`?scene=play` no longer boots within 8 min on this box (dev server and static build alike): CDP pause shows the main thread in
`mineBuildJob ← runSync ← MineRenderer ← createMineRenderer ← getMineRenderer ← PlayWorld ← enter` — the mine bake runs
synchronously because its worker (`assets/worker-*.js`) never answers in time. At 07:30 the same path booted in ~100 s.
Owner: the mine engine (`src/render/mine/index.ts`, touched 08:08). So none of the work after 07:40 has been seen on screen.
Diagnostic: `/tmp/playworld/diag.cjs` (MODE=static|dev; logs pending requests + paused stacks).

## Requests (successor 2)
- **Mine engine:** the blocker above (sync bake on direct `?scene=play` entry).
- **PLAY-CORE:** (1) keep `StepResult.day` in realsim and pass it: `shift.begin(r.events as never, turnBefore, r.day) // PLAY-WORLD`
  (line ~734); (2) the offering: either let FEEL's dusk run it (bearers now kneel at the grave when the film ends, so FEEL's
  arrival test passes) or gate the HUD strip on the world: `hud.offering(list, { waitFor: (i) => this.world.arrival(off[i].unit) })`;
  (3) expose the sim's `colourSeedsOf(s)` / `sensedPlaces` through PlaySim so the followers' ground comes from the sim
  (`world.ts followerGround` reads LIVING plans today).
- **HUD:** `offering(list, { waitFor?(i): Promise<void> })` — await before each stone's 'set' beat.
- **People renderers (mine people / animator, CAST):** read `PersonView.wick {tone, spirit, state?}` and `hood` (today the wick
  colour comes from `crest`), so the VFX caller contract (wick out while `wickTurn` / `wickOut` own the light) is exact.

## Self-grade (successor 2, 09:1x): 6.5 / 10 — not done
Evidence: `/tmp/playworld/s2/sheet.png` (07:3x, before bearers/weather/wick): Day 1 on screen 0 / 0 / 21 / 24 / 37 / 29 people.
Worst three: (1) nothing after 07:40 has been seen on screen (boot blocker); (2) Whole world at night is still near-black
(median luminance 6 — the surface's night grade; the framing now shows the pit head + sensed blocks, but forms barely read);
(3) dawn on seed 7 day 1 shows an empty mine for ~1.5 s (LIVING's "lift sticks halfway" event; riders in the cage are drawn
but small) and figures are ~25–36 px gray Sensed silhouettes in most of the frame.

## Exact next steps (successor 3)
1. Once `?scene=play` boots again: `npx vite build --outDir /tmp/playworld/dist`, then
   `STATIC=/tmp/playworld/dist NIGHTS=3 MOMENTS=0.02,0.2,0.5,0.8,0.97 flock /tmp/hg-pw-0.lock node e2e/play-world-shots.cjs`
   (OUT=/tmp/playworld/s4). Check: bearers kneel at the grave at film 1 and at dusk; `shift.planB` > 0.9 on offering days;
   weather draws (try `?weather=0` for a control); wickTurn on the whisper conversion; ambience levels (`audio.setAmbience` calls).
2. Whole world at night: if still near-black, try a pose in the LOD band over the pit (scale 1.8–2.4; `/tmp/playworld/look.cjs`
   with POSES) so the lit mine shows inside the pit with the pit head round it; else request TOWN-ART's night grade.
3. Notes at places: verify `dayNote` anchors land at the place on screen (HUD) and a feed click calls `focusNote`.
4. Copy the best frames to `screenshots/play-world-*.png`, self-grade the 3-night set per §16.2.
