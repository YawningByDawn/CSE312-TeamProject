# CLOSE-PLAY (2026-11-23) — fixes found by playing, then the owner's Day ruling (§31). Port 5205, lock 2.
- **One clock, one position:** a person the stage drives (`pos`, a walked `route`, or the lift) is drawn where the stage says and on the layer it says (`render/world/crossing.ts`, `render/town/people.ts stagePos`). Tests: `tests/world/oneclock.test.ts`. Live, seeds 7 and 11 over 10 nights: every dusk with a bearer set the stone on arrival (+0.17–0.70 s); the fallback was never used. The robot never produced a bearer from above ground, so `close-dusk.png` was not shot.
- **Night shift at work:** `life/stageEvents.ts NIGHT_DOWN` gives the sim's night shift a work stop in the mine. The opening camera is fitted per seed (`app/worlds.ts whisperStartCamera(r, seed)`). Seeds 1–20 hold ≥ 3 whisperable workers in view (`tests/play-world/night1.test.ts`); live seeds 1, 7 and 13 hold 4, 4 and 7 (`screenshots/close-night1.png`).
- **The Day (§31):** `DAY_SECONDS` = 24 is the one constant (fastday; play and shade import it). The film never moves the camera (`FastFilm.cameraTaken` ≡ true), notes never slow the clock, and a rare strike's hold stops the clock without moving the camera (a pan ends it). The "Follow the day" button is kept hidden through `dayFollow {on: true}`; the **HUD may delete it**. The scene no longer frames the Day. The old return glide is dead code (`fastfilm.ts startReturn`), safe to delete.
- **Off-frame = data:** `render/people/life.ts Life.inView` (set each frame by the world composite) skips posing figures outside the mine camera's view. Seed 7 live: night default zoom posed 7 of 9; Day 33 of 50.
- **Census (§31, seed 7, opening view):** `CENSUS=1 npx vitest run tests/play-world/census.test.ts`.
  - Night Q1–Q4: 129 people, 11 in the mine, 5–6 in frame and awake.
  - The rest are asleep in town: slagrows 51, wellsquare 15, minehead 13, highwarrens 12.
  - Day Q1: 4 in the mine (55 walking at the minehead). Q2: 55 in the mine, 29 in frame. Q3: 54 / 36. Q4: 53 / 24.
- **Whole world:** with at most 3 surface blocks known it is `frameShaft()` (scale 2.33): the whole mine through the shaft mouth. The old framing at ×0.75 drew the mine only as a point, which went black on a Void town. Town far-zoom lamps were kept as points (`render/town/index.ts`, now TOWN-WORLD's). Shots: `screenshots/close-whole-{night,dusk}.png`.
- **Watershed:** from the shaft on, the camera stays on the pit mouth, then pulls straight back to a hand-back that keeps the pit in the middle third (`fitPoseAround`). There is no detour through `frameAll`, and no shaft rings (`WorldView.shaft = false`). See `screenshots/close-watershed.png` and `e2e/playtest/watershed-strip.cjs`.
- **Defeat:** each `why`, `IchorReason` and `GoneReason` has its own sentence in `src/content/defeat.ts`. A test scans the sim's sources for these.
- **Town (dropped, now TOWN-WORLD's):**
  - Commits 6546866, a4bb0a8 and 4a6bba2 touch `src/render/town/people.ts` (stage-driven), `src/render/town/index.ts` (far-zoom lamps), `src/scenes/play/shade/{pick.ts,index.ts}` (pick rule, Day 24 s / no slow / no recentre) and `tests/play-shade/pick.test.ts`.
  - `e2e/playtest/pick-check.cjs` found no crowded sim units in the test town and made 0 picks.

# PLAY-MINE (2026-11-23 16:xx) — the first half by play: cutscene → bonus → the mine's turns → the watershed
- **Dusk:** bearers walk to the grave and set the stone on arrival (BEHAV `OFFER_HOLD` 0.2 plan; the dusk restages the Day's own build, `life.ts dayGen`; `toPlanList` puts `offered` at `PLAN_B+0.012`); the 3.4 s timeout is only the fallback. Live seed 7: dusk→ledger 3.7–4.3 s, set +0.1–0.5 s, bearer 9.8 u from the anchor; world keeps moving.
- **Day camera:** `fastfilm.lean()` visits heavy notes (push ≥ 1.3, lit-aware, `VISIT_PUSH`); dusk shot homes on the grave; a click/drag still takes the camera. Unit test in `tests/feel/fastday.test.ts`. Live: 2–4 framings a Day (no seeded Day with ≥ 3 heavy notes seen live; the unit test covers it).
- **End Night:** never silent — `refuseEnd()` names what waits (event / blessing) and reopens the card; `!r.ok` says the sim's reason. Devour sound once (FEEL's score plays it at the maw).
- **By play to the watershed** (`e2e/playtest/mine-run.cjs`, UNTIL=watershed, PLAY-CORE's policy through the screen): seed 7 → watershed night 21 (20 mine turns), seed 11 → night 19 (18); town mounted after; **0 console errors** both. Shots `screenshots/play-mine-run{7,11}.png`.
- **Reel** `--until watershed` (seed 7): beats 25 (long play) and 33 (watershed by play) **present**, 0 console errors (`screenshots/reel/sheet-until-watershed.png`, `INDEX-until-watershed.md`). Fix was the robot: `lib/longplay.cjs` bringOn scrolls out for far targets, `clickPerson` re-aims at walkers.
- **Proof strips:** `screenshots/play-mine-day.png` (Day 3, 3 framings), `play-mine-dusk.png` (Day 1's walk to the grave → set → reveal → Continue). Tools: `e2e/playtest/mine-probe.cjs` (SHOOT=1, TRACE=<unit>, FRONT=1), `mine-strips.cjs`.
- **Open (not mine):** (1) a bearer who lives ABOVE ground (seed 7 day 8, Mara) is never drawn on the mine layer that day: BEHAV's table says she kneels at 0.82 but the world keeps her on the town layer, so the stone comes by the 3.4 s fallback and that dusk runs 7.2 s — BEHAV / town people (`src/render/town/people.ts` walks blocks on its own clock). (2) Reel beats 6–8: night 1 shows ~0–2 people on screen, nobody whisperable (sleepers above ground). (3) The offering strip covers the grave's lower right. (4) Every Day ends with a rise to the pit head, then the dusk glides ×14 back to the grave in ~1 s (reads as a cut at 2×). (5) Watershed mid-frames: the town sits lower-left with half the frame black; a red/teal ring plate around the mine at the pull-back. (6) Reel 15 evil, 17/19 crystal moments not visible in the world, 24 whole-world near-black.

# PLAY-CORE successor 3 (2026-11-23 10:0x →) — a whole run by play. Port 5205, lock /tmp/hg-pw-2.lock, scratch /tmp/playcore3/
## Requests (top) — exact and small
- **HUD (`hudbridge.ts event`)**: pass each option's `ok` / `why` through (`ok: o.ok ?? true`, show `why` on the option) — the scene now sends `options[i].ok/why` (an event option can need crystals the grave lacks; seed 12 night 2 "Answer (2 crystals)").
- **PLAY-SHADE**: (1) `ShadeHost.apply?(a: Action): StepResult | null` — when given, step through it instead of `applyAction` (the scene passes the Session's dispatch, so saves / the defeat screen's history keep every town action); (2) `nextStep` (autoplay.ts) never answers a v3.3 threat (`answer` / `favour`) — the scripted player loses ~half its town runs to Ichor.
## Log (newest first)
- **11:2x:** BOOT API adopted in `src/app/app.ts waitForMine` (no 25 s cap / no sync fallback; `preloadMine()` → `load.hurry?.(40)` → `load.promise`; "The mine stirs… N %" from `load.progress`). Browser script hardened (whisper fallback to the likeliest on-screen person, `why` diagnostics, tolerant `page.$`). Seed 7 (to the ending), seed 3 (to a loss) and the layout check (1600×900, 1280×720) queued on lock 2 against `/tmp/playcore3/dist7`. **dusk: true NOT switched** — FEEL's staged dusk runs itself to the night (no ledger Continue) and the HUD's offering strip must be opened `driven` at `duskStart`; the scene's own dusk works and is what LOOP's reel waits on. Plan in "Next steps".
- **10:4x:** town hand-over glides (log-zoom, 2.2 s) from the watershed's hand-back pose to the stage's framing (FINALE's `handback` option is declared but not implemented, so the stage's own `frameTown` would have been a cut); Esc the stage leaves opens Settings; P3 theme: `wickCall` on a whisper (turned / refused), `wickGrief` when a follower is lost in the Day, `councilPlate` at the count (and again on a search), `audio.setMood` each night from the hottest track; `RealNight.playMiracle` tops a pick that falls a hair short of the price (by worth) instead of refusing it; `tests/play-core/session.test.ts` (adopt + snapshot resume). Browser runs queued on lock 2 (19 waiters at 10:35).
- **Step 3 WIRED (stage changes), browser run pending:** watershed `done` → `enterTown()` mounts PLAY-SHADE's `mountShade` (world, cam, state = sim state, finale host; `onStep` → `Session.adopt`; `onEnd` won → title after its ending, lost → `goto('defeat',{session})`); scene `mode 'town'`, update/render/input routed to it; `?Continue` in Shade enters the town directly. `Session.adopt(state, events, action?)` + `SaveData.snapshot`. `__hg.play.town` / `.finale`; `__hg.hooks.play.suggest()` (read-only policy). Event card: WRITING's `text.event` title/body/labels when present. Browser script `e2e/play-core-fullrun.cjs` written (static build `/tmp/playcore3/dist`); seed 7 queued on lock 2.
- **Step 1 DONE (headless full run):** `src/scenes/play/autoplay.ts` (`pendingChoice(g)` in the sim's order event → blessing → facet; `nextVerb(g, handsShown, mem)` a sensible player in the scene's verbs), `tests/play-core/fullrun.lib.ts` + `fullrun.test.ts` (mine nights through RealSim/RealNight as index.ts does, town nights through PLAY-SHADE's `nextStep`). Found + fixed: (a) **index.ts pendingChoices showed the blessing before a waiting event → the pick is refused and the card re-opens forever** (now event first); (b) an event option the rules refuse (needs crystals) is marked `ok:false` + "Not now: …", a refused pick says why. Table: seed 7 up 15 / won 32; seed 3 up 14 / lost 34; seed 21 up 16 / lost 43; sweep 40–51 all reach town (up 14–19), 8 won 37–56, 4 lost 39–56; seeds 1–60: 0 refused, 0 stuck, 0 no-path. `npx vitest run tests/play-core` 8/8.

## PLAY-CORE list (orchestrator 09:3x), state at 10:00 — successor #2
- **Real sim swap + v3.2 turn order: DONE.** `USE_REAL = true` (`sim.ts`), `realsim.ts`; Night → End Night → the sim's Day (LIVING inside it) → dusk offering → ledger with the count → hands. Browser run7 (seed 7, 3 nights, real sim): 0 console errors. Unit `tests/play-core/realsim.test.ts` 4/4.
- **Natural stage-up into the watershed: WIRED, NOT YET SEEN on a played run.** The scene starts the watershed on the sim's `stageAdvanced` and the ending on `phase==='won'`; level-up blessings and story events are now answerable (`pendingChoices`), which was what held level-ups. Next: a long headless run (tsx, answer events/blessings every night) to confirm the stage-up turn, then a browser run to it.
- **FEEL 3b routing in index.ts: DONE.** URL for dusk shots in the real game: **`/?scene=play&seed=7`** (real sim by default; `&sim=standin` = old stand-in). The scene still passes `dusk:false` until the HUD renders FEEL's dusk cues.
- **`StepResult.day` → `shift.begin`: DONE** (`shift.begin(r.events, turnBefore, this.sim.dayFilm?.())`, from `Session.lastDay`).
- **Bake on the title screen: DONE on PLAY-CORE's side.** `preloadMine()` starts with the app; `goto` into cutscene/play/bonus waits for it with "The mine stirs… N %" (max 25 s). The synchronous fallback bake when ground workers never answer is the mine engine's.
- **Shade entry / hit-testing: PLAY-SHADE's.** The scene opens a card for any sim unit id `world.hit()` returns (`c01…c20`, `e01…`, `g17`); `world.hit` must return those for town crowds and Elites.
- **Layout (e2e/play-core-layout.cjs):** 1600×900 6 faults, 1280×720 8 faults, 0 cut-offs, 0 console errors, no dismissed hint came back, settings has 3 sliders. Every fault is HUD's: hints over the goal panel / miracle hand / grave, and at 1280 the top bar's right group (`Temple · Calm / Count · Content`) covers the `camera` button ("Whole world", 74 %). Shots `/tmp/playcore/layout/{1600,1280}-*.png`.

## Reel beats (orchestrator 09:3x) — PLAY-CORE status (successor #2)
- **Beat 25 (stuck in Shade, "Answer the event first")** — FIXED in code (09:30, after the 09:12 reel): `index.ts pendingChoices()` shows the sim's `pendingEvent` (title, text, one card per option → `resolveEvent {option}`) and a level-up `blessingOffer` (→ `chooseBlessing`) through the HUD's pick-one cards (`hud.blessing`, selectors `[data-act^="bless:"]`), at the start of each night and whenever End Night is pressed with one pending. Headless test `tests/play-core/realsim.test.ts` (4/4). Browser confirmation pending (lock queue).
- **Beat 22 (no natural stage-up)** — likely the same cause: the sim holds level-ups until the rank blessing is chosen (`offerBlessings(x,'rank')`), and the stage advances at dawn only at Divinity ≥ `BALANCE.shadeLevel` with the surface reached (`checkGate`). Now the blessing is offered and the scene's watershed starts on the sim's own `stageAdvanced` event (no hard-coded thresholds). Confirm on a played run.
- **Beats 23 / 24 (Shade targets not clickable)** — the scene opens a card for any sim unit id `world.hit()` returns (groups `c01…c20`, Elites `e01…`, `g17` Overseer Varn are real sim units; the HUD builds Group/Elite cards). Hit-testing of crowds/Elites is the town renderer's: **PLAY-SHADE fixes `world.hit` for town groups and Elites** (return the sim unit id at the crowd's / Elite's drawn feet).
- **Beat 17 (enchant never possible)** — FIXED: the grave's crystal VM had no `mods`, so a full stone showed no reroll rows; `hudbridge.crystal()` now passes every modifier (+ the base's implicit last), and `RealNight.enchant(id, slot)` rerolls the named modifier. "Add" stays off with "0 open" when every slot is full.
- **Beat 10 (the Day)** — FEEL 3b wired (cue/deal hooks, `film.onEnd`, Skip → `skipToDusk`, `forwardNotes` deleted). `__hg.play.dayClock` (0–1) and `dayPhase` are the clock; `dayNotes` = all FEEL notes (light ones go to the feed only, so fewer are placed on screen — by design).
- **Beat 3 (41 s black after Begin)** — cause: `getMineRenderer()` → `createMineRenderer` → the preload waits on ground workers, `finishSync` throws, so a full synchronous bake runs (`runSync`, seen by debugger pause at 30/34/38 s). FIXED on PLAY-CORE's side (`src/app/app.ts goto` + `src/app/worlds.ts NEEDS_MINE/mineReady`): entering cutscene / play / bonus waits for the background bake with the current picture up and a line "The mine stirs… N %" (`[data-hud=loading]`), max 25 s. If the ground workers never answer (the mine engine's open bug) the scene still bakes synchronously after those 25 s — the mine engine builder owns that.
- **hudbridge.ts belongs to the HUD builder (successor 6) from 09:3x.** My last edit there: crystal VM `mods` (beat 17). The pending-event card currently goes through `hud.blessing` from `index.ts pendingChoices()`; switch it to `hud.event` when the HUD has it (HUD builder may edit that call, marked `// HUD`).

# PLAY-CORE — the night's interface and rules wiring (successor of PLAY-v2; port 5205, lock /tmp/hg-pw-2.lock, scratch /tmp/playcore/)
Owns `src/scenes/play/{index,hudbridge,night,sim,crystals,standin,types,debug,styles,modules}.ts`, `src/app/**`, `src/main.ts`, scene registrations,
`e2e/{smoke,layout-check,play-shots}.cjs`, this file. PLAY-WORLD owns the canvas (`handoffs/PLAY-WORLD.md`).

## Requests from PLAY-CORE (2026-11-23, successor) — exact and small
- **HUD:** (1) handle `hud.cue('ledger', { lines })` / a `ledger` VM so the scene's dusk ledger stops riding on `DawnVM` (today: `set({ phase:'dawn', dawn:{ title:'Dusk, day N', lines } })`, Continue `next-night`); (2) words: `intro nether.body` and `stat.nether.tip` still say "cut crystals" — Nether now pays for whispers and Enchant; (3) the offering strip's Continue appears only after the last reveal — keep `data-act="offer-continue"` and its `hide` class (LOOP waits on `:not(.hide)`).
- **PLAY-WORLD:** in `feel.ts` FEEL host forward `cue: (n, p) => h.cue(n, p)` and `deal: () => h.deal()` and expose `focusNote(id)` on `FeelAdapter`; once done, delete `forwardNotes()` in `index.ts` (it forwards `film.notes` to `hud.cue('dayNote')` as a stand-in) and the `(this.feel as …).feel?.focusNote` reach-in. The Day's world (`life.day`, `shift.p`) should follow `film.clock.t` (FEEL Round 3 migration), not `replay.p`.
- **SIM:** v3.2 (Night → Day → Dusk, the count at dusk) — the scene already runs that order; publish the dusk events (`offered`/`tribute`, `tally`) and selectors `tallyView`, `enchantPreview`, `recombinePreview` with the shapes in `night.ts` so `sim.ts` can map 1:1.
- **FRONT:** none.

## PLAY-CORE successor #2 (2026-11-23, 07:xx) — running log (newest first)
- **Real sim swap (step 3)**: `src/scenes/play/realsim.ts` — `RealSim implements PlaySim` (drives `Session.dispatch`, maps GameState → `PState`, selectors memoised per state object) + `RealNight implements NightCtl` (AP, routines, Move, crystals, enchant/recombine, hands, count → sim actions; sim events → scene moments). `NightCtl` type in `night.ts`; `createNight(hooks)` picks. **The swap is one line: `USE_REAL` in `sim.ts`** (true now); `?sim=standin|real` overrides per run. `Session.lastDay` (src/app/session.ts) keeps `StepResult.day`. `shift.begin(r.events, turn)` with the sim's events (PLAY-WORLD request 1); `world.audio = sc.audio` (request 5).
- FEEL Round 3b wired (orchestrator 07:5x): `cue`/`deal` hooks into `FeelAdapter`; `forwardNotes()` deleted; the Day ends on `film.onEnd` (ctx `dusk: false` — the scene's own dusk stays until the HUD renders FEEL's `ledger`/`offerBeat` cues); Skip → `film.skipToDusk()`; `film.onOfferBeat` → `offerBeat` (VFX/audio); ctx `dayIndex`, `runSeed`, `calendar` (real sim). "Follow the day": the HUD has no handler yet (request below).
- Browser runs: the dev server times out under load (≥ 15); probes now run on a static build (`npx vite build --outDir /tmp/playcore/dist`, `/tmp/playcore/static.cjs`, `/tmp/playcore/probe.cjs`). Real-sim night 1 boots, 83 people, 0 console errors (frame cost under investigation).

### Requests from PLAY-CORE successor #2 (exact, small)
- **PLAY-WORLD:** (1) `society.ts` must stop calling `planDay` itself under the real sim (SIM v3.2 runs LIVING inside its Day): read the Day's plan/feed from `session.lastDay` (`{ turn, events, dusk, calendar, weather, plan }`, set by `Session.dispatch` on End Night; the scene has `this.session`) — LIVING's feed is already merged in `r.events` as `living` events; (2) draw violet seeds from `colourSeedsOf(s)` / `hearthSeeds(s)` (`src/sim`) — `this.sim.backend === 'sim-v3'` and `(this.sim as RealSim).g` give the GameState; (3) `feel.followDay(on)` exposed on `FeelAdapter` so the HUD's "Follow the day" can call it; (4) the real sim has 83 people (night 1, seed 7): check the people pass cost (frames under the real sim were not yet measured — the browser lock queue blocked every run 08:00–09:xx).
- **HUD:** (1) render FEEL's dusk cues (`ledger {lines,title}`, `offerBeat`, `duskWalk`, `duskEnd {night}`, `dayFollow {on}`) so the scene can pass `dusk: true` and drop its own offering/ledger; (2) a `onDayFollow?(on)` handler for the "Follow the day" toggle; (3) hints must not sit over an open panel's controls (seen: `intro:hunger` over the grave panel's close button, `n2.decide` over the miracle hand's first card and label, the n1 whisper hint over Mara's card bio); (4) the offering strip says "1 crystals" (plural) and covers the goal panel's right column.
- **SIM:** none (the adapter reads `StepResult.day` through `Session.lastDay`).

## PLAY-CORE successor (2026-11-23, 06:xx) — running log (3 lines per confirmed step)
- Step 1 boot: the build boots (no `applyCut` import left; tsc clean for scenes/app). Probe `/tmp/playcore/probe.cjs <fn.cjs>` (port 5205) + `/tmp/playcore/nights.cjs`.
  The first robot "whisper never lands" was the camera push-in moving Mara under the robot's stale snapshot (hit-test itself is right: `/tmp/playcore/p1.cjs`).
- Step 3 turn order (§5 / §16): Night → End → Day (FEEL clock) → **dusk** (mode `'dusk'`: offering strip → ledger "Dusk, day N" with the count → Continue `[data-action="next-night"]`/Space deals) → night. No dawn box. `__hg.play.dayPhase|dayClock|dayNotes|ledger` added.
  FEEL's notes reach the HUD feed through a stand-in in `index.ts forwardNotes()` (until PLAY-WORLD's FEEL host forwards `hud.cue`); speed/pause/focusNote wired to the film.
- HUD native Enchant/Recombine wired (`enchantPreview`, `recombinePreview`, `onEnchant`, `onRecombine`); `onDayPause`. Stand-in rules: day 1 a follower's first swing strikes; the count's guess starts day 3.
- Step 2 confirmed (run4, seed 7, 3 nights, 0 console errors; log `/tmp/playcore/run4.log`, shots `/tmp/playcore/n/`): night 1 whisper lands (0.9), Offer set, Day with clock + notes,
  dusk 1 offering (Mara's first strike) → ledger "Dusk, day 1 … Expected 12 · counted 11 · 1 short" → Continue → night 2 hands; night 2 set + miracle (pay step); night 3 miracle + devour;
  hints n1.whisper → n1.end → n2.decide → intro:surface, none repeated, none over the grave, none during day/dusk. Finale wired (`debugFinale`), offering beats → onOfferBeat.

## v3.2 selectors for LOOP (HUD-native names; updated by the PLAY-CORE successor — the turn order changed)
Turn order (spec §5, DECISIONS §16): night actions → End Night → the Day (`dayPhase` 'day', `dayClock` 0–1, `dayNotes`) → **dusk** (`dayPhase` 'dusk', `mode` 'dusk'):
the offering strip (`beat` 'offering'; `[data-act="offer-continue"]:not(.hide)` once every crystal is revealed, clicking the strip = faster) → the ledger
(`ledger` true; box `[data-hud="dawn"]` titled "Dusk, day N"; Continue `[data-action="next-night"]` or Space) → the hands are dealt → `mode` 'night'. Night 1 has no hands.
- People (canvas click from `__hg.play.people[].screen`; re-read it right before clicking — the camera glides) → card: `[data-act="whisper"]` (class `off` when not possible).
- Follower card: `[data-act="routine:pray"|"routine:offer"|"routine:lieLow"]`, `[data-act="move"]` → click a place → click it again to send. Right-click / Esc cancels.
- Hands: `[data-hand="miracles"]` / `[data-hand="evil"]`, cards `[data-card=<id>]` → zoom → `[data-act="play"][data-card=<id>]` (several zooms may be in the DOM:
  always add `data-card`); a miracle opens the pay step (`[data-act="pay-ok"]`); a targeted card arms (`__hg.play.aiming`), next world click plays it. Skip: `[data-hand=…] [data-act="skip"]`.
- Grave: `[data-act="grave"]` → tiles `.hud [data-item=<crystalId>]` → `[data-act="crystal:set"|"crystal:unset"|"crystal:eat"|"crystal:enchant"|"crystal:recombine"]`;
  enchant → `[data-act="enchant:add"]` (or a modifier row to reroll); recombine → pick the other tile → `[data-act="recombine:do"]`. Close `[data-act="grave-close"]`.
- `[data-action="end-night"]` (first press warns once if you did nothing), `[data-action="camera"]`, `[data-action="hint-got-it"]`, `[data-stat="ap"|"tally"|…]`.
- `window.__hg.play`: `mode` ('night'|'day'|'dusk'|'pullback'|'summary'|'over'), `dayPhase`, `dayClock`, `dayNotes`, `ledger`, `beat`, `ap`, `crystals[]`, `sockets[]`, `hands`, `day`
  (`tally {expected,counted,short,tolerance,word}`), `god`, `people[]`, `aiming`, `moveFor`, `graveOpen`, `hint`. Finale: `__hg.hooks.play.debugFinale('watershed'|'ending')`, `.finaleRunning`.

# PLAY-v2 — play scene INTEGRATOR (running handoff)

Builder #1. Brief: `handoffs/briefs/PLAY-v2.md` + orchestrator scope change (integrator; DECISIONS §14.9–14.10; RULES 11–13).
Port 5205 (browser lock `/tmp/hg-pw-2.lock`). Scratch `/tmp/playv2/`.

## v3 night (DECISIONS §15) — stable selectors for LOOP (successor #2, 04:50; additive)
The Send chip / route flow is gone. Night order: dusk offering (crystals revealed one by one at the grave) → the draw → actions → End Night.
- Hands (stand-in panel `src/scenes/play/night.ts`, bottom centre): `[data-action="play-miracle"][data-card=<id>]`, `[data-action="skip-miracle"]`,
  `[data-action="play-evil"][data-card=<id>]` (devour is `data-card="devour"`), `[data-action="skip-evil"]`, `[data-action="reroll"]` (only with a Loaded crystal set).
  A targeted card arms: the next world click on a person (`target: unit`) or a place (`zone`) plays it; right-click/Esc disarms.
- Action points: `[data-stat="ap"]` (child `i.on` = AP left). Whisper 1 AP (`[data-action="whisper"]` on the HUD card), routine change 1, Move 1–2.
- Follower selected → routine panel under the HUD card: `[data-action="set-routine"][data-routine="pray"|"offer"|"lieLow"]` (current one has class `primary`),
  `[data-action="move"]` → click a place (prompt shows chance + AP) → click it again or `[data-action="confirm-move"]`.
- Crystals: `[data-action="crystals"]` toggles the crystal view (also: click the grave). Each crystal `.nv3-item[data-crystal=<id>][data-tier=0..5]` with
  `[data-action="eat"|"set-crystal"|"unset-crystal"|"cut"|"graft"][data-crystal=<id>]`; after `cut`: `[data-action="choose-cut"][data-cut=0..2]`;
  after `graft`: `[data-action="graft-onto"][data-crystal=<target>]`. Empty sockets `.nv3-item.empty[data-socket=i]`.
- Unchanged: `[data-action="end-night"]` (HUD; first press warns once if you did nothing), `skip-day`, `next-night` (= HUD `dawn-continue`), `camera`, `log`.
- Snapshot `window.__hg.play` keeps its shape (`sendFor`/`pending` are always null now); `__hg.hooks.play.nv.v` is the v3 state (AP, bag, sockets, routines, hands, lastDay).

## Interface for other pieces (exact; additive only)

### Debug hook for robots / LOOP (read-only)
`window.__hg.play` → `PlaySnapshot | null` (a fresh JSON snapshot each read; `src/scenes/play/debug.ts`):
```ts
{ scene: 'play'; mode: 'bonus'|'night'|'day'|'pullback'|'summary'|'over'; turn; phase; stage; backend: 'standin'|'sim-v2';
  god: { nether, crystals, ichor, level, hunger }; goal: { minePct, pitHeadHold, next };
  selected: string|null /* person or zone id */; sendFor: string|null /* follower being sent */; pending: { unit, zone }|null;
  hint: string|null /* id of the open hint */; camera: { x, y, scale } /* world units */; dayProgress: number|null /* 0..1 */;
  people: { id, name, follower, asleep, zone /* shown */, task, screen: {x,y}|null /* feet, logical 1600×900 px */, whisper: { ok, why, odds } }[];
  zones: { id, hold, shownHold, visibility, screen: {x,y} /* anchor, logical px */, sendable }[];
  metrics: { nights: { turn, clicks, seconds }[]; clicksTonight; lastAnswerMs } }
```
Logical px → client px: `client = canvasRect.x + x * canvasRect.width / 1600` (same for y with 900).
`window.__hg.scene()` is `'play'` (or `'bonus'` while the bonus overlay is up — same scene object).

### Stable `data-*` on interactive elements (play scene)
`[data-action="whisper"]` (card), `[data-action="recall"]`, `[data-action="lie-low"]`, `[data-action="end-night"]`,
`[data-action="eat"]`, `[data-action="camera"]` (Whole world / My mine), `[data-action="log"]`, `[data-action="confirm-send"]`
(Send chip), `[data-action="skip-day"]`, `[data-action="next-night"]` (summary), `[data-bonus="<id>"]` (bonus offers),
`[data-goal="mine"|"surface"|"gate"]`, `[data-miracle="<id>"]`, `[data-action="hint-got-it"]` (hints), `[data-hud="danger"|"goals"]`,
`[data-stat="ichor"|"hunger"|"nether"|"crystals"|"danger"]`, `[data-summary="1"]`.
World interaction is canvas clicks: click a person → card; click a follower → send mode (the prompt shows); click a place → route + line + cost
(pending); click it again or `[data-action=confirm-send]` → sent. Right-click / Esc cancels. Wheel zooms; drag pans; Z toggles whole world.

## Integration table
| piece | adapter file | status | since |
|---|---|---|---|
| SIM-v2 (rules) | `src/scenes/play/sim.ts` (+ `standin.ts`, `types.ts`) | stand-in (contract-shaped, deterministic) | M1 |
| World renderer (P6b) | `src/scenes/play/world.ts` | real (`createWorldRenderer`, `hitTest`, frame*) | M1 |
| Stain (STAIN / mine engine) | `world.ts` (passes `hold`, `holdFrom`) | real where the renderer draws it | M1 |
| HUD (`src/ui/play`) | `src/scenes/play/hudbridge.ts` (`mountHud`, VMs from sim selectors, handlers → verbs, `data-action` aliases) | **real** | successor M3a |
| FEEL (`src/feel`) | `src/scenes/play/feel.ts` (FeelHost, day film, camera director); `day.ts` DayReplay kept for summary/timing | **real** (loads lazily) | M1/successor |
| VFX (`src/render/fx`) | `src/scenes/play/fx.ts` | **real** (loads lazily) | M1/successor |
| BEHAV (`src/life`) | `src/scenes/play/life.ts` (night/day patches) | **real** (loads lazily) | M1/successor |
| AMBIENT (`src/render/ambient`) | `world.ts` `lift.pos` only | stand-in | M1 |
| WRITING (`src/content`) | strings inline in play files | stand-in | M1 |
| FRONT (`src/scenes/front`) | `registerScene('title'|'bonus'|'defeat')` → `createTitleScene/createBonusScene/createDefeatScene`; bonus replayed from `session.state.bonuses[0]` in `sim.ts`; PauseVeil in `app.ts` draw; `autoPause` in `main.ts`; defeat gets a live `backdrop` | **real** (wired 05:1x, not yet re-run through e2e/front-shots.cjs) | successor |
| CRYSTAL (`src/render/crystal`) | `src/scenes/play/crystalart.ts` (`drawWorldCrystal`; lazy `drawCrystal`); socketed crystals drawn in a ring at the grave's lip | stand-in (module has no index.ts yet) | successor |
| FINALE (`src/scenes/finale`) | pull-back via `pullBackPath` in `index.ts`; ending → `goto('ending')` placeholder | stand-in | M1 |
| LOOP (`e2e/playtest`) | `window.__hg.play` + data-* | provided | M1 |

## Done
- M1 (playable end to end with stand-ins): `src/scenes/play/{index,sim,standin,types,world,day,hud,card,styles,debug}.ts`.
  Flow: title → cutscene → `bonus` (= play scene, overlay over the handed frame) → night → day replay → summary → night…
  `?scene=play&seed=N` boots straight into night 1. Whisper scene and `e2e/whisper-shots.cjs` removed (owned after P5-fix REPORTED).
  `sceneForSession` → `play`; music `play: 'whisper'`.
- First browser probe: whisper → convert → End Night → day replay → summary, 0 console errors.

## In progress
- M1 polish + M2 (night interaction details), then adapters as specialists publish interfaces.

## Files touched
- new: `src/scenes/play/*`; edited: `src/app/session.ts` (sceneForSession), `src/app/app.ts` (MUSIC.play), `src/app/debug.ts`
  (`__hg.play`), `src/main.ts` (comment), `src/scenes/_placeholders.ts` (bonus → play); removed `src/scenes/whisper/**`, `e2e/whisper-shots.cjs`.
- Not written: `e2e/playtest-reel.cjs` (LOOP owns the reel now). Scratch probe: `/tmp/playv2/probe.cjs`.

## Exact next steps
- Swap each stand-in when its handoff lists the interface (HUD `mountHud`, FEEL `FeelHost`, BEHAV `createLife`, VFX `createFx`, AMBIENT
  `createAmbient`, FRONT scenes, FINALE `runWatershed/runEnding`, WRITING strings, sim v2 when P4 says implemented).
- `e2e/layout-check.cjs` still drives the removed whisper scene: rewrite its play parts against `__hg.play`.

## Requests to SIM
- Night 1 must offer a Likely whisper to the miner awake by the grave and leave Nether for one Send after it (stand-in: 14 Nether,
  +0.3 odds on night 1 for grave/gallery miners; whisper ≈ 8, send 3).
- `sendPreview` for a place the player cannot afford: keep `intent`, `line`, `cost`, `path` filled (the UI shows the route with "Needs N Nether").

## Requests to FRONT
- The bonus pick: on choose, `goto('play', { session, world }, { transition: 'cut' })` (not `'whisper'`), passing the same `world`
  object with `view.time` advanced by the seconds the overlay was up. Until then play registers `bonus` as itself.

## Waiting on renderers
- Partial colour by `hold` (STAIN): passed every frame; until drawn, a zone shows full colour from hold ≥ 5.
- People life (in-zone activities, routes by `t`): until then awake people do cosmetic rounds between neighbouring places.

## Self-grade
- (after M1 evidence)

## What I saw
- Probe 1 (seed 7): night 1 card beside Mara with "Even · 46 %", hint pointing at her; after End Night the camera frames the change,
  the day bar runs, the summary reads "The crystal gallery is 16 % yours (+16). Colour spread in 3 places. / Mara prayed…".
  Faults: the send could not be afforded after the whisper (fixed: 14 Nether), the hint stayed over the day (fixed: hidden by day).


## Handoff at context cap (latest)
- DONE since last entry: `src/scenes/play/fx.ts` (VFX adapter + FEEL semantic-name translation, legacy emit fallback) and `src/scenes/play/feel.ts` (FeelHost, stand-in recipes, day film, camera director) written; both wired into `index.ts` (moments go through `feel.play`, fx.update/draw each frame, camera input forwarded to `feel.cam()` when FEEL is real, `feel.update` replaces constrain+cam.update when real, Day uses `feel.day` film when real with DayReplay silent, hit-stop freezes world clock, route overlay suppressed when FEEL real).
- NOT YET VERIFIED after the wiring: tsc for src/scenes/play + src/app, and the browser probe (`flock /tmp/hg-pw-2.lock node /tmp/playv2/probe.cjs`). Last verified probe (before wiring): 0 console errors, full night→day→summary.
- Integration table additions: VFX · src/scenes/play/fx.ts · stand-in until src/render/fx exports createFx; FEEL · src/scenes/play/feel.ts · stand-in until src/feel exports createFeel.
- Hud stand-in has no `pulse()` yet (call is optional-chained); add `pulse(id)` bump to hud.ts or replace with HUD module adapter.
- Next: verify tsc + probe; HUD adapter (mountHud); AMBIENT adapter; FRONT/FINALE registration; WRITING strings; rewrite e2e/layout-check.cjs play part on `__hg.play`; run LOOP's reel; DECISIONS `### PLAY-v2 — Play scene`; self-grade.


## Successor #2 (2026-11-23, after the owner interrupt)
- M1 verified: tsc clean for `src/scenes/play` + `src/app`; probe (`/tmp/playv2/probe.cjs`, seed 7) night → whisper → send → End Night → day → dawn, **0 console errors**. Snapshot now has `modules` (which specialist modules run real). At 04:26: life/feel/fx/hud real; ambient/front/finale/content stand-in.
- Fixed: a fresh follower whose card is open goes straight into send mode (before: the second click closed the card — the Send step was unreachable without re-clicking).
- M3a HUD: the real play interface (`mountHud`) replaces `hud.ts`/`card.ts`/Hints/prompt/day bar/summary/hand in the scene (`hudbridge.ts`). The old stand-in files stay on disk unused (`hud.ts` still exports `fmt`). Stable selectors kept via aliases: whisper, recall, lie-low, send, confirm-send, skip-day, next-night, log; `end-night`, `eat`, `camera`, `data-goal`, `data-miracle`→ hand cards are `[data-card]`. Hints are on only at night (none over the Day or the dawn lines).
- Camera: after the hand-over the camera leans in (`pushIn`, scale ≥ 13) on the grave + first reachable miner: figures ≈ 25–30 px. "Whole world" button (`[data-action=camera]`) top right.
- Route preview: light inked marching dashes (dark ink under a pale dash) only while choosing; gone once sent.
- Stain: `holdAt` seeds = followers' places captured at dusk (stable through the night).
- Day speed 1×/2×/4× from the HUD strip drives DayReplay and FEEL's film.
- **v3 night stand-in (§15, after the coordinator's re-scope message 04:40):** `crystals.ts` (rules: tiers, strike table, crystals with seeded shape/lines/odd effects, cut options, mining + Tally) and `night.ts` (controller + stand-in panel: AP pips, two hands, crystal view, routine panel, Move prompt). Scene: dusk offering sequence (`offering()`), strikes glint during the Day (`crystalStrike`/`crystalAbsorb`), mining lines lead the dawn summary, grave click opens the crystal view, targeted cards arm the next world click, Move mode with chance. Send flow removed from the UI (sim stand-in still has it; unused). v3 first-night beats added to the HUD guide (`V3_RULES` in hudbridge: whisper (HUD beat 1) → routine Offer → End Night).
- Integration table: SIM — stand-in v2 + v3 stand-in (`crystals.ts`/`night.ts`); the v3 contract is now at the top of `handoffs/P4.md` (status: contract only). Next: map NightV3 methods 1:1 onto v3 Actions (`setRoutine`, `move`, `playMiracle{pay}`, `playEvil`, `skipHand`, `reroll`, `eat{crystal}`, `setCrystal{socket}`, `unsetCrystal`, `cut`, `chooseCut`, `graft`) once `src/sim` exports them.

## Requests (successor #2)
- HUD: (1) a dawn box placed away from the grave (bottom third) — at top 28 % it covers the colour change the Day just showed; (2) the v3 parts the scene now fakes in `night.ts`: two hands (miracle / evil) with Skip, AP pips, crystal view with sockets/cut choices/graft target, follower routine buttons + Move on the follower card, six rarities (Dull…Impossible) — when they land the bridge switches and `night.ts`'s panel goes; (3) native `data-action` names (whisper, recall, lie-low, confirm-send, skip-day, next-night, log) so the aliases can go.
- FEEL: the Day film framing pulled out to scale ≈ 5.9 on night 1 (the mine a small island in black on the right third); frame what matters at ≥ the player's zoom ÷ 2.
- VFX: `crystalStrike`/`crystalAbsorb`/`socket`/`craft`/`devour` are called with world units + `rarity` 0..3 (six tiers mapped 0,0,1,2,3,3) — a six-tier palette when you can.
- SIM-v3: nothing beyond the contract; the stand-in uses your routine id `lieLow`.
- FRONT wiring done (items 1–8 of `handoffs/FRONT.md` "Requests to PLAY-v2"; item 5 backdrop too). Files: `src/scenes/play/index.ts` (bonus registration, defeat backdrop), `src/scenes/title/index.ts`, `src/scenes/defeat/index.ts` (registrations only; old classes kept unused), `src/app/app.ts` (PauseVeil), `src/main.ts` (autoPause), `src/scenes/play/sim.ts` (bonus replay).
- BLOCKED at 05:1x: `src/sim/index.ts`/`panels.ts` import `destinationFor` that `src/sim/life.ts` does not export (SIM-v3 mid-edit) → every page fails to load. Waiting; not mine to fix.

## Exact next steps (successor #3 starts here; successor #2 stopped near the context limit, 05:2x)
1. **HUD v3 wiring** (`handoffs/HUD.md` "v3 INTERFACE"): in `hudbridge.ts` stop setting `send`; feed `HudVM.hands` (miracle + evil) from `nv.v.miracles/evils` (later `handView`), `grave` (sockets + inventory), `aim`, `stats.ap`/`stats.tally`, follower routine/stash/move; wire handlers `onCardPlay(id, at?, burn?)`, `onHandSkip`, `payOptions`, `onCardAim`, `onRoutine`, `onMoveStart/onMoveCancel`, `onEat`, `onSet`, `onUnset`, `cutChoices`, `onCut`, `graftOptions`, `onGraft`, `onGrave` → the `NightV3` methods (same names/semantics); `hud.offering(list)` at dusk in `index.ts offering()` instead of the ticker loop; `hud.crystalMoment`, `hud.deal()`; `guide.saw` for strike/offered/dealt/cut/tally/converted/graveOpened/offeringSeen + fact `strikeAt`. Then delete the stand-in panel parts of `night.ts` (keep the controller) and the `V3_RULES` if the HUD's beats cover them. Keep the LOOP selectors in the v3 block at the top of this file valid (aliases if HUD names differ).
2. **Audio names** (top of `handoffs/P3.md`): replace the placeholder sfx in `index.ts moment()/offering()/strike loop` with strikeDull…strikeImpossible, pocket, cartDrop/cartRoll, tallyTick/tallyShort, offeringSet, crystalReveal (+ `stinger('bestFind')` for ≥ Royal), cardPlayMiracle/cardPlayEvil/cardSkip, crystalBurn, eatCrystal, devour, cut/crack/flaw/graft/socket, apSpend/apEmpty, routinePray/Offer/LieLow, moveOk/moveFail, followerEvil; `setAmbience({procession, grave})` during the offering.
3. **VFX ids** (top of `handoffs/VFX.md`): strikeGlint, pocket, cartDrop, cartGlow, tally, offerArrive, offerReveal, burn, cut, crack, flaw, graft — swap the `fx.raw` calls in `index.ts` (currently crystalStrike/crystalAbsorb/socket/craft/devour).
4. **Words** (`handoffs/WRITING.md` round 2): `text.card/rarity/crystalName/statLine/oddEffect/routine`, Move preview, `text.why(view.why, undefined, view.code)`, chronicle via `voice.chronicle(ev, ctx.crystal(id))`. Player-facing: "the count" (done in the summary), `deep` = "Blazing" (done in the stand-in), "actions" not "AP" (the stand-in already says "Actions"). `scripts/content-sample.ts` is WRITING's file — not deleted by me.
5. **SIM-v3 swap** when `handoffs/P4.md` "v3 status" shows M1–M2 done: `sim.ts` creates the real game (`createGame`, `applyAction`, `endNight`), maps NightV3's methods to Actions 1:1 (routine id `lieLow` already matches), the Day's `strike/carted/tally/offered` events replace `crystals.ts mine()` (time-ordered, the scene already fires strikes by `time`).
6. Re-run `e2e/front-shots.cjs` (flock /tmp/hg-pw-2.lock) for the real flow title → cutscene → pick → play; run `/tmp/playv2/nights.cjs` (3 nights, seed 7) and LOOP's reel; rewrite `e2e/layout-check.cjs` play part against `__hg.play` + the v3 selectors.
7. CRYSTAL: when `src/render/crystal/index.ts` exists, `crystalart.ts` uses it automatically (lazy); use `crystalIcon` for the HUD only via the HUD.
8. **CAST** (`handoffs/CAST.md` contract): add `cast: import.meta.glob('../../render/people/cast/index.ts')` to `modules.ts`; for the town stage draw town people through `cast.draw({ g, A, view, time, visibilityAt }, entries)` inside the town renderer's `layers.props` seam (entries from the sim's town units via BEHAV), set the town renderer's `ownPeople = false` once P6 lists the flag, `cast.lights` as light pools; `castRoleOf(role, {hunter})`. The mine keeps the miner rig.

## Self-grade (successor #2, 05:3x): 6 / 10 — not done
Evidence: `/tmp/playv2/sheet3s.png`, `/tmp/playv2/sheet4s.png` (real HUD night → day → dawn), `/tmp/playv2/s6s.png` (v3 night 1: hands, AP, crystal view after cut + set, Day, dawn with the mining line); 0 console errors in every run.
Worst three:
1. The v3 night runs on a scene-owned stand-in panel (`night.ts`) beside the real HUD — two visual languages; the HUD's v3 interface is now on disk and must replace it (next step 1).
2. Night 1 v3 probe: the HUD's new "Your crystals" intro hint opens over the grave on the first frame and the robot's whisper never landed (followers=0 after night 1) — the first-night beat order (whisper first) must be re-checked once the HUD v3 guide is wired; the Day film still pulls out to scale ≈ 6 with the mine a small island.
3. Rules are stand-in numbers (crystals.ts), the sim's v3 contract is not yet adopted; strikes use placeholder sounds/effects ids.
