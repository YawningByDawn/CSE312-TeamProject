# LOOP — playtest harness + the reel (running handoff)

## LOOP round 2 (2026-11-23 11:15 →, builder "LOOP r2"; scratch /tmp/loop2/) — READ FIRST
**Run:** `node e2e/playtest/shots.cjs [--seed 7] [--out dir] [--until <beat>] [--mine-nights 40] [--town-nights 45] [--compare <shots.json>]` (builds outside the lock, takes `/tmp/hg-pw-0.lock` itself, port 5226). Smoke `--smoke` unchanged. Exit codes unchanged: 0 all present · 1 missing/broken · 2 build failed · 3 stuck / out of time.
**Files:** `shots.cjs` (driver, beats 1–20, health, output) · `lib/longplay.cjs` (the long-play robot: the game's own policy `__hg.hooks.play.suggest()` / `__hg.shadeSuggest()` acted through the screen, + observers) · `lib/late.cjs` (long play mine → watershed by play → town night 1 → crowd → Elite → long play town → observed beats → ending by play) · `lib/extra.cjs` (settings + reload, layout 1600/1280, hints verdict).
**Beats now (ids):** boot front cutscene handover bonus night1 whisper routine endturn day offering ledger cards miracle evil set enchant recombine eat **settings reload layout** night2 zooms **long-mine event blessing tribute count-short search above weather** watershed(by play) **town-night1** shade-group shade-elite **long-town threat-seen threat-answered threat-landed favour writ facility** shade-pushback ending(by play) **hints**. No debug jumps any more (xp/Hold write and debugFinale removed).
**Health in every run:** in-page sampler (`HEALTH_INIT`): rAF frame deltas per beat (p50/p95), long tasks ≥ 1 s per beat, black frames (> 95 % exact black > 1.5 s, cutscene excluded), Begin → first picture / first night, JS heap, hint id over time; raw-text scan of the visible DOM at every beat end (undefined / NaN / [object / RAW.KEYS / dotted.camelKeys) turns a present beat broken.
**Output additions:** INDEX column "vs 0912" (from `screenshots/reel/history/0912-shots.json`), "Whole-run health", "Defects by owner" (one list per piece).


Builder #1. Brief: `handoffs/briefs/LOOP.md`. Port 5226. Scratch `/tmp/loop/`. Owns `e2e/playtest/**`, `screenshots/reel/**`, this file.

## Request to PLAY-v2: the read-only probe (exact; please expose it, additive only)

The robots click and press keys like a player. The only thing they read from the game is this probe.
`window.__hg.hooks.play.probe()` → a **plain JSON object** (no live references, safe to call every 100 ms):

```ts
interface PlayProbe {
  mode: 'bonus' | 'night' | 'day' | 'pullback' | 'summary' | 'over';
  turn: number;                       // sim turn (night number)
  phase: string;                      // sim phase ('bonus' | 'play' | 'won' | 'lost' ...)
  stage: 'whisper' | 'shade';
  /** Things the player can see, in CSS px of the page (what page.mouse.click takes). */
  people: {
    id: string; x: number; y: number;  // feet/centre of the figure on screen
    onScreen: boolean;                 // inside the canvas box and not under a HUD panel
    follower: boolean;
    inReach: boolean;                  // a Whisper is possible right now
    odds?: number;                     // 0..1 when inReach (what the card shows)
    zone: string;
    moving: boolean;                   // walking / animating a task this frame
  }[];
  zones: {
    id: string; x: number; y: number;  // a clickable ground point of the area, page px
    onScreen: boolean;
    hold: number;                      // 0..100
    seen: 'yours' | 'colour' | 'gray' | 'black';
  }[];
  /** The one visible hint (or null) and where its pulsing goal points, page px. */
  hint: { id: string; text: string; target?: { x: number; y: number } } | null;
  goals: { id: string; text: string; progress: number }[];   // as shown in the goal panel, progress 0..1
  /** Whether at least one of each action is affordable and has a target tonight. */
  can: { whisper: boolean; send: boolean; miracle: boolean; eat: boolean; endNight: boolean };
  busy: boolean;                      // an animation is blocking input right now
  dayProgress: number | null;         // 0..1 while the Day replay plays, else null
  /** performance.now() ms: last pointer/key input the scene received, and its first visual answer. */
  lastInputAt: number;
  lastAnswerAt: number;
}
```

Also, on the same object (functions are fine there): none needed beyond `probe()`.
DOM the robots click (already present in today's play scene — please keep them stable): `[data-action="whisper"]`,
`[data-action="end-night"]`, `[data-action="confirm-send"]`, `[data-action="next-night"]`, `[data-action="skip-day"]`,
`[data-action="hint-got-it"]` (shared Hints), `[data-action="camera"]` (text says which framing it offers), `[data-action="eat"]`,
`[data-bonus]`, `[data-goal]`, `[data-miracle]`; card `.pl-card` (h3 = name, `.pl-odds` = "Likely · 76 %"), prompt `.pl-prompt`,
summary `[data-summary]`, title seed `input[aria-label="Seed"]`, title `button:has-text("Begin")`.

Until `probe()` exists the harness builds the same object itself in `e2e/playtest/lib/inpage.js` (`adapterProbe`) from
`__hg.hooks.play` (`sim.state()`, `sim.canWhisper`, `sim.visibilityOf`, `world.personScreen`, `world.zoneScreen`, `world.hit`, `mode`) —
read-only calls. If those internals are renamed the adapter breaks; `probe()` makes it stable.

## Successor #2 (2026-11-23, after the owner interrupt)
- Old scene is gone; new play scene `src/scenes/play/` publishes `window.__hg.play` (PlaySnapshot, `handoffs/PLAY-v2.md`). The probe above is superseded: the harness reads `__hg.play` (snapshotProbe) and discovers verbs from the DOM (`[data-action]`, `[data-miracle]`, `[data-bonus]`, any future `[data-card]`) so the re-scope (card hand, crystals as items) only needs new selectors, not new robots.
- Plan: M4 repoint + data-driven verbs, smoke 1 night; M5 full reel 5 nights seed 7 on the new scene; M6 robots ×3; reading + findings.

## Successor #4 (2026-11-23 07:00 →) — the shot loop (beat reel + smoke)
**Interface (new, additive; the old reel.cjs / play.cjs stay):**
- `node e2e/playtest/shots.cjs [--seed 7] [--out dir]` → full beat reel (≤ 6 min browser time): `screenshots/reel/INDEX.md` (one row per beat: verdict present/missing/broken, why, console errors, owner), `screenshots/reel/sheet.png` (contact sheet: per beat a still + its 6-frame strip), `screenshots/reel/beats/<nn>-<beat>.jpg` (1600×900 still), `screenshots/reel/beats/<nn>-<beat>-strip.jpg` (6 frames), `screenshots/reel/shots.json`.
- `node e2e/playtest/shots.cjs --smoke` (≤ 90 s; for builders) → `/tmp/loop-smoke/INDEX.md` + `sheet.png`; exit code 0 = the loop plays (boot → bonus → night 1 whisper → End → Day → dusk → night 2 with cards), 1 = a beat missing/broken, 2 = build failed, 3 = boot failed / stuck / timed out.
- Both take the browser lock themselves (`flock -w 900 /tmp/hg-pw-2.lock`), build first outside the lock (static, `/tmp/loop/dist-shots-<pid>`), port 5226. Every wait has a timeout; a stuck beat is reported with a screenshot and the run moves on.
- Shade is reached by a **debug jump** (recorded in INDEX): before End Night 3 the harness sets the stand-in's xp to 399.9 and the pit head's Hold to 100 through `__hg.hooks.play.sim.state()`, so the stage-up runs on the game's own path; fallback `__hg.hooks.play.debugFinale('watershed')`. The ending: `debugFinale('ending')`.

### Status (09:20) — the shot loop works end to end; final reel in `screenshots/reel/` (09:12, seed 7, 389 s browser time at load ~12, 0 console errors)
- `INDEX.md` (26 beats): **19 present · 7 broken · 0 missing**. `sheet.png` (2102×5062; one row per beat: verdict + why, 1600×900 still, 6-frame strip). `beats/` stills + strips, `shots.json`.
- Broken today (owner): 16 set in a socket — only the HUD shows it (PLAY-WORLD grave hoard / VFX); 17 enchant — `[data-act="enchant:add"]` is off with no reason, so it can never be done (HUD grave / PLAY-CORE `enchantPreview`); 18 recombine — only the HUD shows it (PLAY-WORLD / VFX); 21 zooms by day — close (×15), pit head (×0.8) and town (×0.3) have < 0.4 % of the lit area moving in 0.8 s at 6 fps (PLAY-WORLD / LIVING; partly load); 23 Shade crowd — clicking "The lift crews" at its snapshot point hits member `c01`, no card opens (PLAY-CORE Shade wiring); 24 Shade Elite — world.hit at Overseer Varn's snapshot point finds no person (PLAY-WORLD draws / PLAY-CORE positions); 25 Shade pushback — End Night refused, the screen says "Answer the event first." twice and no event dialog exists (PLAY-CORE never shows the sim's pending event; reached via the debug jump, so confirm on a natural Shade).
- Also seen: the natural stage-up never fired after the xp/Hold jump (the watershed came from `debugFinale`); the Day's clock is not on screen (`[data-hud="day"] .clk` empty/hidden); a whisper changes the world canvas by ~0.1 % net (no visible whisper effect at the person); the cutscene holds a black first frame for 38–69 s after Begin under load (bake); the hand-over has no cut (largest step 7.8 %).
- Smoke (`--smoke`): 13 beats to night 2's hand, 116 s browser time at load ~12 (≤ 90 s needs load < 8: the cutscene bake alone is 25–40 s under load); validation smoke 09:30 after the budget fix: **13/13 present, exit 0, 119 s browser time** (44 s of it the cutscene bake), 0 console errors → `/tmp/loop-smoke/INDEX.md`.
- Self-grade (harness): **8/10** — plays the real build through the screen end to end, never hung in the last 5 runs, every beat filmed with a verdict and owner. A hostile critic: (1) Shade and the ending are reached by debug jumps, not play; (2) under this box's load the page runs at 2–10 fps, so motion-based verdicts (zoom life, Day length) are load-sensitive — fps is printed per beat and the Day's length is not judged below 20 fps; (3) smoke is ~120 s, not ≤ 90 s, while load > 8 (the cutscene's bake).

### How to run (successor #4)
- Full: `node e2e/playtest/shots.cjs [--seed 7] [--budget 600]` (default budget 360 s, 660 s when load > 8). Smoke: `node e2e/playtest/shots.cjs --smoke [--out dir]` → `/tmp/loop-smoke/`. One beat range: `--until <beat-id>` (ids: boot front cutscene handover bonus night1 whisper routine endturn day offering ledger cards miracle evil set enchant recombine eat night2 zooms watershed shade-group shade-elite shade-pushback ending).
- Foreground under the lock is automatic; the lock wait (often 5–10 min on this box) is not part of the budget. Exit 0 all present · 1 something missing/broken · 2 build failed · 3 stuck / out of time.

### Exact next steps
1. When PLAY-CORE fixes Shade clicks / pending events, rerun the full reel; then retire the debug jump for the stage-up if it starts firing (it should after xp 399.9 + pit head Hold 100; today it does not).
2. Consider a whisper world-change rule (today whisper is judged on state only; net change ~0.1 %).
3. The old `reel.cjs` / `play.cjs` (robots, REPORT.md) still exist; the shot loop does not replace the robots' 3-strategy runs.

### Run 3 (08:14–08:24, seed 7, load ~17, page at 2–10 fps) — 15 present · 11 broken; full `screenshots/reel/` was overwritten by run 4 after it
- Works end to end through the screen: title → Begin → (cutscene) → 3 bonus offers → night 1 whisper (Mara turns) → Offer routine → End Night → Day (clock 0.06→0.51 in 34 s at 4.6 fps) → offering strip (1 crystal) → ledger "Counted 6 of 9 expected" → night 2 hands 3+3 → miracle Creeping Dark on heartvein (net world change 2.5 %) → devour on Corm (2.3 %) → set in socket (1.2 %) → night 3 → zoom tour → watershed (debug hook; the natural stage-up never fired) → Shade night → a Shade Day (Hold fell at heartvein 41→40, minehead 97→94) → ending card ("Hungry God Inc." with the run's stats).
- Crystal actions re-tested: **set** now shows in the world (net +1.2 %); **recombine** (+0.5 %) and **eat** (+0.35 %) still show only on the HUD; **enchant** could not be done (`enchant:add` is off, no reason given).
- Zooms by day (whisper stage): close and mine read; pit head is gray forms; town (×0.3) and whole world (×0.1) are a small lit patch on black (4–15 % of the frame lit) with ~0.2–0.3 % of the lit area moving.
- Shade: clicking a crowd ("The lift crews") or an Elite ("Overseer Varn") at its snapshot screen point opens no card (both stills show the night with the hint "The surface").
- No console errors or warnings in any run.

### Step 1 — what the last run showed (predecessor's unreported quick reel, 06:41–06:51, seed 7, 3 nights, 618 s, verdict FAIL 19; `screenshots/reel/quick/`)
- Crystal actions show nothing in the world: socket 2.9 % changed vs 3.0 % with no input (only the grave panel's slot fills); enchant's "after" is just the HUD's "Enchant: what to change" picker; recombine changes the grave tiles, not the world (`quick/pairs/{socket,enchant,recombine}.jpg`).
- The miracle pair: after = two hint panels; the world frame is the same picture (6.7 % vs 2.9 % no-input, mostly the HUD).
- The offering: a HUD strip with one crystal; the camera jumps to Whole world while it plays; then the ledger box. Day 2 (late) frame is near-black (Whole world framing), "World before night 1" near-black.
- Other fails: Day lengths 42 s / 51 s (spec 15–20 s), no clock on screen, guided stuck on `g3:n2.decide` (Got it does not close it), a hint returns, crystal card has no "1 in N", layout overlap at 1280×600 and 900×506, mine not empty at night, followers never above ground, no weather hook, a 20 s main-thread freeze during the bonus.
- This was built ~06:41, after PLAY-WORLD's 05:4x "FEEL effects now reach VFX" fix — so the fix did not make crystal actions visible then. Re-tested below.

## Successor #3 (2026-11-23 ~05:40 →) — status: M1–M3 code written; M1 smoke blocked by a broken build (src/sim/index.ts exports cutWhy/cutCostOf/chooseCutWhy that legal.ts no longer has — SIM mid-edit)
- **Hook fields the reel reads now (exact, additive; all optional — a missing one makes its rule fail with "not on __hg.play")**:
  `beat`, `ap`, `crystals[].{id,rarity,oneIn,mods,set,origin?}`, `sockets`, `hands`, `day.{strikes,kept,carted,tally,notes?,clock?,weather?}`, `aiming`, `graveOpen`,
  `people[].{routine,stash}`; §16: `phase: 'night'|'day'|'dusk'`, `dayClock` (0..1; else `day.clock`, else `dayProgress`), `day.notes` (count or array), `weather` (string or {kind}).
  Read-only call (fallback): `__hg.hooks.play.sim.mineZoneIds()` (mine vs above ground).
- **DOM the reel looks for (§16, until HUD publishes names):** notes `[data-note]` / `[data-hud="note"]` / `[data-hud^="note:"]` / `.hud .note` (feed rows `[data-hud="feed"] li` counted apart);
  day clock `[data-hud="clock"|"day-clock"]`, `[data-stat="clock"]`; Day controls `[data-action|data-act="day-speed"|"speed*"]`, `[data-action|data-act="day-pause"]`, `[data-action="day-skip"]`.
- **M2 (§15.10) done in code:** SEL has `enchant` / `recombine` / `craftOpen` (`act:crystal:graft` = the bridge's "Enchant or recombine") / `craftDo` (`act:graft:do`), HUD names
  `act:crystal:{eat,set}`, `act:grave`, `act:offer-continue`, pay panel (`hud:pay` items + `act:pay-ok`), routines `act:routine:*`; cut/graft rows removed (the generic
  `tryAffordance` fallback stays). Robots: `workCrystals` (set one while a socket is free → enchant one → recombine two spares from night 2 → eat when hungry; reads each crystal card's "1 in N").
  Verdicts: strike seen (hook + canvas glints), crystal at dusk (tribute vs contributed: hook `origin` if present, else the givers' routines), card+crystal decision every night,
  offering / card play / enchant / recombine / socket each change the WORLD canvas net of a no-input control (camera moves not counted), count expected vs counted (checked
  against the hook's numbers), "1 in N" on the card (= hook `oneIn`), Hold rose ⇒ colour visibly grew at dawn, people moving at rest every night (≥ 25 % / ≥ 34 % up close),
  the Day frames the action (no > 5 s with < 1 % change), no hint returns after an action, layout fit/short/tiny incl. "nothing over the grave", first-night hint legibility.
- **M3 done in code:** `--quick` (no cutscene, 3 nights, half-size stills/strips, no zoomed-out moment films; writes `screenshots/reel/quick/`). REPORT leads with a one-screen
  verdict (pass/fail/warn counts, the three worst failures with owner + image link, fails by owner). `history.json` rows: `schema 2`, `kind`, `counts`, `rules{id→1/0.5/0}`,
  one file for full and quick reels (`screenshots/reel/history.json`).
- **§16 (coordinator, binding) rules added, expected to FAIL until LIVING / FEEL / HUD / WEATHER land:** turn order (phase hook, Day 12–26 s, clock, speed/pause/skip — pause
  and skip are *tested* on the last Day, offering before cards, no dawn box); ≥ 8 placed notes per Day, none over the grave, none repeated within 3 days; life at every zoom
  (a zoom tour close → mine → pit head → town → valley during Day 2, 1 s pairs); nobody still a whole Day; mine near empty at night; followers above ground after the shift;
  weather visible and never over Void (exact-black pixels lit during a Day).
- Robots report: `play.cjs` now writes `screenshots/reel/ROBOTS-LOOP.md` + `robots-loop.json` (`--name` to change) — `ROBOTS.md` may be overwritten by an old queued run.
- Build dirs are per run now (`/tmp/loop/dist-reel-<pid>`, `/tmp/loop/dist-play-<pid>`), so a queued older run never serves a half-written build.

## What the harness reads (exact; read-only)
- `window.__hg.play` (PlaySnapshot): mode, turn, phase, stage, god, goal, people[].{id,name,follower,asleep,zone,task,screen,whisper}, zones[].{id,hold,shownHold,visibility,screen,sendable}, selected, sendFor, pending, dayProgress, camera, metrics, modules. `window.__hg.scene()`.
- `window.__hg.hooks.play.world.hit(x,y)` only to check a zone's anchor is really that zone (optional; skipped if absent).
- DOM: any `[data-action|data-card|data-miracle|data-item|data-act|data-bonus]` (verbs.cjs); person card `[data-hud="card"]` (`.nm`, `.ow`, `[data-act=whisper|send]`) or `.pl-card`; hints `[data-hint][role=note]` (`.tt`, `.bd`) or `.hg-hint`; hint marks `.ctl-ring` (control) / `.hud .ring` (world point); dawn `[data-summary]` or `[data-action=dawn-continue]`; `[data-action=moment-continue]`.

## Done
- M6 (§15, orchestrator 2026-11-23): one selector table `SEL` in `lib/verbs.cjs` (dusk offering, miracle/evil hands, set-routine, move, eat, set-crystal, cut/choose-cut, graft/graft-onto, crystals view, end-night, dawn...). Robots: dusk offering watched (clicker skips), `playHand` miracle (always if playable) / evil (Malice ≥ 40 or Hunger ≥ 60) or Skip, whisper, `setRoutine` → Offer, open the crystals and cut/set/graft/eat, End Night. New verdicts (judge.cjs '§15 …'): strike seen within 3 nights; crystal received at dusk within 3 nights; card + crystal decision open every night; offering / card play / cut / socket each visibly change the screen (pairs/*.jpg, ≥ 0.4 % of view); the Tally reads expected vs counted; Hold grows across nights; layout fit 1600×900 / short 1280×600 / tiny 900×506 with no overlap or cut-off text. REPORT gains a 'Crystals and cards' table, pairs list and layout matrix.
- M5 (successor #2): harness runs on the new play scene + real HUD (`src/ui/play` via hudbridge): guided robot follows the hint's mark (`.ctl-ring` control / `.ring` world point) — click the person under a ring, the pulsing button, the ringed ground (+ Send chip); look-only rings/readouts → Got it. End Night's "end anyway?" second click; dawn panel `dawn-continue`; moment `moment-continue`; pause `resume`. Cards close by their X (a stray Esc opens the pause panel). Dead-time clock ignores harness captures (`run.setHarness`, `__pt.harnessBusy`). At-rest motion subtracts the crowd's median shift (camera). Smoke (2 nights, seed 7) runs end to end.
- M4 (successor #2): `lib/verbs.cjs` — affordances discovered from the DOM (`[data-action|card|miracle|item|act|bonus]`), a one-row-per-verb table (`VERBS`), generic `tryAffordance` (click → sub-action play/cast → target a place → confirm → kept only if the state fingerprint changed). Robots' HUD verbs (eat, cards, miracles, items, anything new) go through `useHud`; per-night `can` comes from the screen (`canSummary`), the judge's "something affordable" rule lists whatever verbs it found. Probe no longer calls sim internals for `can`.
- M1 harness written and smoke-tested (1 night, cutscene skipped): `e2e/playtest/reel.cjs`, `lib/{server,inpage.js,kit,robots,game,judge,report}.cjs`, `vite.config.mjs`.

## In progress
- Nothing running. Last code edit NOT yet run: control-corrected before/after pairs (game.cjs `moment`: 1.3 s no-input control + camera check; judge counts canvas change minus control, camera moves not counted) and AP/routine in `fingerprint` (verbs.cjs). Both pass `node --check`.

## How to run
- `node e2e/playtest/reel.cjs --nights 5 --seed 7 [--label "..."]` → screenshots/reel/ (REPORT.md, reel.json, reel.png, stills/, strips/, pairs/, history.json). ~11 min incl. the cutscene; takes the rule-11 lock itself; static build in /tmp/loop/dist; port 5226.
- `--no-cutscene --nights 2 --out /tmp/loop/smoke` for a 4-minute smoke. `node e2e/playtest/play.cjs --robots guided,sensible,clicker --seeds 7,11 --nights 5` for robots without filming.
- Selectors live in ONE place: `e2e/playtest/lib/verbs.cjs` `SEL` (+ `VERBS` policy rows).

## Files touched
- handoffs/LOOP.md; e2e/playtest/** (reel.cjs, play.cjs, lib/{verbs,robots,game,judge,report,kit,server}.cjs, lib/inpage.js); screenshots/reel/**

## Exact next steps
1. Smoke the last edit: `node e2e/playtest/reel.cjs --nights 3 --seed 7 --no-cutscene --out /tmp/loop/smoke` — check pairs show `control` and routines read ok.
2. Full reel `node e2e/playtest/reel.cjs --nights 5 --seed 7 --label "<PLAY-v2 milestone>"` after each PLAY-v2 milestone; look at reel.png halves + pairs downscaled; write the three-line reading here.
3. Robots ×3: `node e2e/playtest/play.cjs --robots guided,sensible,clicker --seeds 7,11 --nights 5` (not run this session).
4. When PLAY-v2 lists the §15 names/fields at the top of handoffs/PLAY-v2.md, re-point `SEL` in verbs.cjs (one table) and read `day.strikes` / `day.tally` / offering mode in game.cjs (already read if present).

## Reading (reel 3, 2026-11-23 ~05:20, §15 harness on the v3 night stand-in)
- Moved: night 1 everyone walks; from night 2 almost nobody moves at rest (0–7 % of 15–18 people); a miracle moves the camera; the Day at Whole world is a still dot for 10 s.
- Changed colour: Hold summed over areas grows every night (100 → 140 → 202 → 290 → 366), but in the mine framing days 2 and 4 turn only 0.08 % / 0.05 % gray→colour; a cut or a socketed crystal changes only the left panel, the grave itself shows nothing.
- Lost: after the three first-night beats the hints become introductions that keep coming back; nights 4–5 have no hint; the Tally says "3 short" without expected vs counted; the dusk offering never shows as a moment (crystals just appear in the bag).

## Findings (ranked; evidence in screenshots/reel/, run 2026-11-23T04:39 = history row 2, and /tmp/loop/smoke)
1. **The Day replay with the camera on Whole world is 10 s of one purple dot on black** (reel 1 `strips/day-n2.jpg`): the Day does not frame the action when the player is zoomed out → 9 s dead time (fails the > 5 s rule). Owner: PLAY-v2 / FEEL (day camera director). Also Day 1 at "My mine" parks far out for ~7 s before moving in (`/tmp/loop/smoke/strips/day-n1.jpg`).
2. **From night 2 on, nobody moves at rest**: 16 people on screen, 0 % moving, 1 look each in 2 s, also 8 people up close (camera shift subtracted); night 1 had everyone moving. Owner: PLAY-v2 (life adapter) / BEHAV.
3. **Hints come back after every action**: `intro:miracle` (later `intro:hand`) yields when the player acts and returns, 3–5 times a night, never acknowledged. Owner: HUD guide.
4. **The Tally is not readable as expected vs counted**: the only line is "The Tally came up 3 short. The Council frowns." Owner: PLAY-v2 / WRITING.
5. **No strike count, no dusk offering seen** in 5 nights of the v3 stand-in (verdicts fail "never happened"); needs `__hg.play.day.strikes` and an offering panel/mode (see Requests).
6. Input → first visual answer: median 49 ms, p90 132 ms (old scene: 3 ms) — passes, but 1 in 10 clicks waits > 100 ms.
7. Chronicle's last line is cut off (`.last` overflow, "the crystal gallery 16 % yours (+16) · c…") at fit, short and tiny.
8. Console warning (game side): "Canvas2D: Multiple readback operations using getImageData…" — the harness's own canvases use willReadFrequently; candidates `src/scenes/front/paint.ts:276`, `src/scenes/cutscene/shotStrata.ts:1066`.
9. Text < 12 px on the bonus offers: "+2 Nether a night" 10 px, "Miracles cost 2 less" 10 px, "· 0/3 set" 11.7 px.
10. `__hg.scene()` reads 'bonus' all through the nights and days after the bonus pick.

## Requests
- **PLAY-v2 (§15 snapshot fields, additive, read-only on `__hg.play`)** — the reel's §15 verdicts read these when present, else fall back to the screen:
  `mode` adds `'dusk'` (or `'offering'`) while the offering plays; `god.malice`; `ap: { left, max }`;
  `crystals: { id, rarity, value, rough: boolean, socketed: boolean }[]` (held + set); `sockets: { used, max }`;
  `hands: { miracle: { id, playable }[], evil: { id, playable }[], played: { miracle: string|null, evil: string|null } }`;
  `day: { strikes: number /* strikes shown so far this Day */, tally: { expected: number, counted: number } | null }` (kept until the next Day);
  people[].routine: `'pray'|'offer'|'lieLow'|null`.
  DOM the robots click (one table: `e2e/playtest/lib/verbs.cjs` `SEL`): `play-miracle`, `skip-miracle`, `play-evil`, `skip-evil`, `set-routine` (text names the routine, or a picker whose options name it), `move`, `eat`, `set-crystal`, `cut`, `choose-cut`, `graft`, `end-night`, `skip-offering` (+ an offering panel `[data-hud="offering"]`), `burn-crystal` (pick a crystal to burn), `moment-continue`, `dawn-continue`.
- HUD: a hint the player never acknowledged comes back after every action (`intro:miracle` returned after Send and again at End Night) — the brief counts a returning hint as a fail; either keep it closed once it yielded, or show it once.

## Self-grade
- **7/10** (stopped by the context rule, not finished). The harness plays the real build through the real UI from the title through 5 nights, data-driven (one selector table, verbs discovered from the DOM), with the §15 verdicts, before/after pairs, a layout matrix and a history table; the findings above are real and evidenced.
- What a hostile critic would say: (1) the latest edit (control-corrected pairs, AP fingerprint) was never run; (2) the strike / offering / Tally verdicts depend on hook fields that do not exist yet, so today they can only fail; (3) the three-robot run (play.cjs) was not repeated on the new scene, and the guided robot follows hints only for the first-night beats.
- Next: steps 1–3 above.

