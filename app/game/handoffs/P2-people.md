# P2-people — living people (running handoff)

Builder #1. Brief: `handoffs/briefs/P2-people.md`. Port 5210. Scratch `/tmp/p2people/`.

## CACHE KEYS — read before adding clips, carries, crowd drawing or reactions (PEOPLE-perf, 2026-11-23)
People are drawn from caches. Anything that changes the drawing but is missing from the key shows the **wrong cached
picture** (a stale pose, a missing carry) with no error. Every new input must reach one of the slots below.

**Townspeople: `FolkBank.draw` (`cast/folk/bank.ts`).** Key = `look.key | clip | facing | paintKey(paint) | sz | frame`.
- **Clip id:** a new clip must be registered in `FOLK_CLIP` and drawn by passing its id. The id is in the key. The
  frame comes from `frameOf`: walk clips by distance (`WALK_FRAMES`); loops by `dur × fps`, capped at 4 frames (calm
  clips, the `CALM` set) or 8 below 28 px; one-shots by `t / dur`. A clip that must stay smooth when small: leave it
  out of `CALM`, or ask PEOPLE-perf to exempt it.
- **Carry kind:** it is part of `look`, so it must change `look.key`. Alternatively make it a clip variant (`carry-sack`)
  so the clip id carries it. Never pass it as a side value into `poseAt` / `drawFolk`: the key would not see it.
  Today `poseAt` reads `cctx` = { seed, walked, hasTool, load, child, elder }, all derived from `look` (so already
  keyed). A new `cctx` field must also derive from `look`, or be added to the key.
- **Per-person state** (reaction, mood mark, wet, cold, hood, devotion, fin): it must be a `FolkPaint` field **and**
  be added to `paintKey()`, quantised to the fewest steps that read (each step multiplies the sprites).
- **Crowd LOD / a different detail level:** a different drawing at the same size needs its own key. Add a LOD tag to
  `base` in `FolkBank.draw`, or call a separate `FolkBank`. Below 28 px `CastLayer` already swaps to 4 shared looks a
  trade (`St.lookS`); keep that swap if you add looks.
- **Transient overlays** (a flinch spark, a "!" mark, a thrown object): draw them **live** on top after
  `bank.draw` (it returns `DrawMeta` with the crown, eyes and lights in rig units). Do not bake them into the sprite:
  a one-frame overlay in the cache is a miss every frame.
- **Size:** `sz = round(s·A·20)`. A zoom tween repaints per size step; the per-frame paint budget (`budgetMs` 8 ms)
  and the stand-ins hide this. `bank.frame(true)` paints everything (stills, screenshots).

**Miners: `Animator.draw` → figure cache (`figcache.ts`).** Key = look.key + `paintSig(paint)` + acting channels
(`FIG_DETAIL` low, fin, droop, flick, wick, hood, weather dress) + log-scale + ½-px phase + **the solved pose**
(`poseSig`: every joint and angle quantised to 0.8 device px, plus `Hold` near / far / back / cart / ground / twoHand).
A new `Hold` field, `FigurePaint` field or `FIG_DETAIL` channel that `drawFigure` reads must be added to `poseSig`,
`paintSig` or `base` in `Animator.drawCached`. Poses are keyed by their skeleton, so new clips need nothing. The sprite
box is measured from what `drawFigure` actually draws, so long props are never cut.

## Rig API for CAST (stable; additive only from now) — import from `src/render/people` (index.ts)
- **Units:** the rig is 40 units tall, feet at (0,0), facing +x, canvas y down. Mine draws it ×0.9 (`MINE_FIG_SCALE`,
  36 world units). Scale your transform, never the rig constants.
- **Design an outfit:** `registerOutfit(roleId, outfit: Outfit)` (design.ts). `Outfit` = `{ headgear: Headgear[]`
  (variants picked per person), `garment: 'short'|'tunic'|'long', coat, coat2?, legs, boots, hat, extras: Extra[]`
  (`apron leatherapron harness belt sash cape chain fur tabard satchel trim mask pauldron`), `extraCol?, sleeves:
  'long'|'rolled', wraps: 0..1, carry: PropKind|null` (held when walking/idle) `, tool: PropKind|null` (work tool)
  `, tall?, stout?, hunch? }`. Then `makeLook(id, roleId)` → `Look` (height, build, posture, tones, patches from the
  id's hash; `look.key` is stable). Built-in roles: digger hauler sorter keeper guard overseer worker smelter trader
  farmer soldier clerk priest magistrate captain highpriest guildmaster smugglerboss (`OUTFITS`).
- **New headgear / props:** `registerHeadgear(name, (g, R, tones, paint, t, look) => …)` draws in head space (head
  centre at 0,0, radius R, facing +x); `registerProp(name, (g, x, y, angle, tones, paint, t, mono) => …)` draws a
  prop held at (x,y) at `angle`. Use `tones.ink` for outlines, `tones.*D` for the shadow step; respect `mono`.
- **Clips:** `registerClip(keysClip(id, dur, loop, keys, hold, lifeAmt))`. A key is `[t, P({...}), ease?]`; `P()`
  overrides STAND channels: `hip:[x,y] lean nod look fn:[x,y] ff hn hf prop rot off:[x,y] breath grip2 squash elb`
  (feet/hands are IK targets in rig units; `grip2` puts the far hand on the held prop; `rot`+`off` for lying).
  `hold(h, ctx)` sets props: `h.near / h.far` (PropKind in that hand), `h.twoHand`, `h.back` ('sack'|'basket'|'pack'),
  `h.cart`, `h.ground`+`gx,gy`. Procedural clips: `{ id, dur, loop, hold, sample(t, out, ctx) }` writing all channels.
  Gaits: `GAIT.{stroll,walk,sneak,jog,push}` + carries (`Carry`).
- **Animate:** `const a = new Animator(look, v0to1)`; `a.setClip(id, t)` / `a.setGait(name, carry, t)` (+ `a.walkBy(dx, dy, t)`
  in rig units each frame → planted feet), `a.setFacing(±1, t)` (turns), `a.react(kind, t)`; then `a.evaluate(t)` and
  `a.draw(g, paint, t)` at the feet with your scale applied. Blends (0.32 s) and reaction overlays are automatic.
- **Paint / allegiance / gray:** `paintFor(kind, devotion, mono?, fromKind?, k?, out?)` → `FigurePaint`; gray (Sensed) =
  `mono: '#4c5053'` (flat silhouette, lighter ink). Lamp/cloth colours in `LAMP`/`ACCENT`.
- **Many figures:** `new SpriteBank(max).draw(g, x, y, s, A, look, activity | 'walk:<carry>', t, facing, paint)` caches
  pose sprites (clips at 9 fps, walks at 12 frames/cycle); `new Crowd(seed, n, roles, rx, ry).draw(g, bank, x, y, s, A, t, paint)`.
  Far zoom: `drawSpeck(g, x, y, worldPerPx, paint)` below `SPECK_BELOW_PX` (6 px figure height).

### Additions (builder #3 — the lived-in round; additive, binding from now)
- **Trades** (`src/render/people/trades.ts`, re-exported from index): `TRADES: Record<TradeId, TradeDef>` — every
  LIVING mine trade id (`digger hauler sorter timberman lampman pumpman powderman cartboy farrier watercarrier
  pitcook surveyor pitclerk chaplain overseer pitguard peddler winder trackman picksmith bonesetter ashboy ventman
  ratcatcher`) plus `washer` (pit-head washerwoman), `child`, `wife`, `elder`. `TradeDef = { id, outfit, work: clipId[],
  carry: Carry, colour (far-zoom trade colour), cls: 'miner'|'worker'|'folk'|'child'|'guard'|'priest' }`.
  `tradeOf(s)` → trade id or null (accepts LIVING ids, BEHAV's `trade`, sim roles, aliases like `lifthand`→`winder`,
  `trapper`→`ventman`, `smithsboy`→`picksmith`, `cook`→`pitcook`, `priest`→`chaplain`, `washerwoman`→`washer`).
  **`roleOf(view.role)` now returns the trade id** for any trade (old 7 mine roles unchanged), so passing a LIVING
  trade id as `PersonView.role` is all a caller does. `workClipsOf(role)` → that trade's work clips.
- **Weather dress** (`setPeopleWeather(w)`, `PEOPLE_WEATHER`): call once per frame with WEATHER's `weather.state`
  (reads `wetness|rain, wind, windX, cold, fog`) or any `{ wet?, wind?, windX?, cold?, fog? }` 0..1; every figure
  then dresses (hood / cloak / sacking over the shoulders when wet, per person), leans into wind, hunches and stamps in
  the cold, carries a lit lamp in fog. `dressKey()` → a short string to add to sprite-cache keys (changes in 4 steps).
- **New clips** (ids for `activity` / BEHAV's `CLIP` table): `pocket strikeLook handIn patdown searched flare scold
  snatch beat bow offerSet sleepCot` · everyday `drink argue laugh holdChild sleepBed prayHome wash stamp` (+ existing
  `eat sit talk`) · trade work `shovel timber crank pump tally hammer tamp trapdoor mend stir ratpoke survey scrub
  ladle shoe bandage` (all with tools from the trade). `sleepCot` lies 8 u above the floor — sort it at the cot's
  front edge. **Gaits:** `GAIT.trudge` (tired walk home) and `GAIT.hurry`; carries `'child' | 'yoke' | 'keg' | 'beam' |
  'bucket' | 'bundle'`.
- **Far zoom:** `drawTiny(g, x, y, worldPerPx, role, t, moving, facing, paint)` — a 4–14 px figure that keeps the trade
  colour, the head dot and a stepping / working motion; `TINY_BELOW_PX` (16 device px figure height). `drawSpeck`
  takes an optional `role` for the trade colour below `SPECK_BELOW_PX`. `lodFor(figPx)` → `'full'|'tiny'|'speck'`.

- **Wickfolk (theme §3, binding):** the miners are wickfolk. Drawn through ONE adapter `src/render/people/folk.ts`
  (`FOLK` proportions/palette, `wickColour`, `folkCloth`) — a local stand-in for THEME's `src/render/theme/folk.ts`
  until it exports; then only folk.ts changes. Body: legs ×0.64, trunk/arms ×0.82 of the old rig (pose authoring is
  unchanged — `solve(p, sk, hk, hunch, FOLK_BODY)` remaps it; CAST's 4-argument `solve` is unchanged), head radius 5.6
  (a third of the height), figure ≈ 33 rig units (≈ 30 world units in the mine). Head: ash skin, big dark eyes with
  eyeshine, no nose, ear-fins, the **wick** on the crown in `paint.lamp` (gold faithful / violet follower / pale
  Council-doubting). `attachPoints().lampX/lampY` = the wick. Acting channels on `Animator`: `fin` (ear-fins:
  +1 up alert … 0 rest … −1 flat afraid; `finDroop` 0..1 tired/grief; `finFlick` nervous) and `wick` brightness
  (0 out at death … 1 normal … 1.5 flaring in prayer/anger), set from clips/reactions automatically;
  `Animator.hood = true` puts the hood up and dims the wick (Lie low). New custom clips `greet` (brow to brow),
  `coverWick` (hand over the wick in grief/shame), `squat` (and `sit`/`eat` are now squats on the heels).


### Additions (builder #4 — the wickfolk body; additive)
- **The miners are THEME's figure** (`src/render/people/folkfig.ts`): `drawFigure` now draws the rig's skeleton as
  THEME's wickfolk — `torsoPath` trunk, thick short limbs (wrapped thighs, bare pale shins), broad flat feet
  (`drawFoot`), four-fingered hands (`drawHand`), the head through `drawFolkHead` (cached), and the trade's dress kit
  from THEME's `TRADE_KIT` (`kitOf(trade)`: goggles + wick-cap, yoke, lamp rack, waders, collar + knot-cords, stiff
  hood, cast plate + helm …) via `drawKitPiece`. Seen three-quarter (`TURN_3Q` ≈ 1 rad; `turnOfLook(look)`).
  `FOLK_FIGURE.on = false` (figure.ts) restores the round-1 human body (kept for comparison only).
- Nothing changes for callers: `PersonView.role` (any LIVING trade id), `Animator`, `drawGhelm`, `People`, `SpriteBank`,
  `LiveSprite` are as before. Carts are now stalk-timber tubs heaped with violet crystal (`drawFolkCart`).
- Sheet: `dev/people.html?view=tsheet` → `screenshots/people-sheet.png` (every mine trade at 80 px and 20 px).

## Interface for the play scene (binding from now; additive, all optional)
Fields on `PersonView` (in `src/render/types.ts`, already there):
- `task?: { kind: 'life'|'explore'|'spread'|'gather'|'goUp'|'lieLow'|'pray'|…, zone? } | string` — what a follower
  does for you; shown in the world: `life`/`pray` = their normal routine with prayer breaks (kneels toward the grave),
  `explore` = walks the area slowly with a raised lamp, stopping to look, `spread` = goes to neighbours and talks with
  gestures (they turn to listen), `gather` = picks crystals and carries a basket of them, `goUp` = walks toward the
  lift, `lieLow` = keeps to the walls, crouched, still-ish, peeking. A string is read as `{ kind }`.
- `react?: { kind: 'whisper'|'turned'|'refused'|'fear'|'glance'|'notice', at }` — `at` is `WorldView.time` (s) when
  it happened; a new `at` restarts it. whisper: head lifts, looks round (≈ 2.5 s); turned: slow kneel, hold, rises
  (≈ 4.5 s); refused: shakes it off (≈ 2 s); fear: cowers (≈ 3 s); notice: startles, stares (≈ 2.5 s, for a guard
  noticing stain/enemy); glance: brief look. People near a whisper/turned target glance over by themselves.
- `asleep?: boolean` — lies down (bunks / home spot) and breathes. Night shift: leave `asleep` false.
- `route?: { zones?: string[]; pts?: {x,y}[]; t: number; carry?: 'crystals'|'lamp'|'crate'|'none' }` — the Day
  replay: the person is placed at progress `t` (0..1) along the route; `zones` = area ids in order (the module builds
  the floor path through the connecting passages; same input → same path), or `pts` = world waypoints used as given.
  The walk cycle is stride-matched to the distance covered, so scrubbing `t` at any speed keeps the feet planted;
  t not changing = the person stands at that point doing a calm idle. When the route is done (or removed) the
  person settles into normal life in `zoneId`.
- `pos?: {x,y}` — world position override (stand/work exactly here). `activity?: string` — force a clip
  (`dig`, `cart`, `carry`, `sort`, `sweep`, `eat`, `sit`, `sleep`, `pray`, `talk`, `warm`, `patrol`, `watch`,
  `preach`, `hide`, `explore`, `idle`, …). `inLift?: boolean` — hidden from the world (the cage shows riders).
- Time: everything is a function of `WorldView.time` + seed; the renderer passes it. No hidden randomness.
- Zoomed far out: `drawSpeck(g, x, y, worldPerPx, paint)` from `src/render/people` draws a person as a moving
  2–3 px speck (lamp dot in allegiance colour); `PeopleModel.at(x, y)` hit-tests at the current scale.
- Lift: a route through `lift` → `minehead` walks into the cage in the mine and out at the pit head; set `inLift`
  while the cage carries them (the world/lift renderer draws the cage).

## Scale (measured)
Reference `mine.png` (3x / 6x crops, `view=ref` in the harness): a figure is ≈ 2.1 × the rail gauge (centre to
centre), ≈ 1.5 × a sleeper, ≈ ½ the north wall face, ≈ the height of a cart; a corridor is 3–4 figures wide.
Our mine: rail gauge 18 u (rails at ±9), sleepers 32 u, `WALL_H` 72 (terrain `WALL_N` 62), tunnels 96–124 u wide,
carts ≈ 40 u. Wall → 31–36, rails → 38, corridor → 25–40, props → 36–40. Chosen: **36 world units** feet to top of
head (`MINE_FIG_SCALE` 0.9 × the 40-unit rig, `src/render/people/scale.ts`), ≈ 8–10 u wide. Today's creature: ≈ 46 u
tall incl. crest × 28 u wide → new figure is ≈ 0.78 the height and ≈ 0.25 the silhouette area. Not "a third of
today's height": at a third (≈ 15 u) a figure would be smaller than a barrel and a quarter of a cart; one constant
changes it if the orchestrator wants smaller.


### Additions (builder #2, additive)
- `attachPoints(anim, out)` / `newAttach()` / `Attach` (animator.ts): head, cap lamp, hands, cart tub centre (rig units).
- `Animator.liftN / liftF` (true foot lifts; 0 = planted) and `Animator.travel` (real distance via `walkBy`).
- Clips `turn start stop board ride alight cartIdle`; reaction kind `turn`.
- `LiveSprite` (`src/render/people/sprites.ts`): one person's own sprite, repainted at most `fps` (default 10)
  times a second, phase-staggered, blitted every frame; `update(anim, paint, x, y, s, A, t, key?)` after
  `anim.evaluate(t)`, then `draw(g, x, y, s, A, anchored)` — `anchored = moving` draws walkers at the feet
  position of their last repaint, so planted feet never slide between repaints. Only the used rect is blitted.
- `FIG_DETAIL.low` (`figure.ts`) / `LOW_DETAIL_PX` (1.6 sprite px per rig unit): the low detail level for small
  figures (skips cuffs, wrap bands, patches, highlights, hand outlines). Set by `SpriteBank`, `LiveSprite`
  and `drawGhelm` (from the context transform) round each paint.

## Builder #2 (successor after the owner interrupt) — status: REPORTED EARLY at ≈ 7.5/10 (context)
Final evidence (run 6, all from the final code): `screenshots/people-acts-{1,2}[-gray].png` (all clips × 8 phases,
the M3 rows at the end of sheet 2), `people-roles[-gray].png`, `people-ref.png` (equal scale beside
`ref-6x-figures-b`), `people-life-00..11.png` (real mine, 10 s), `people-report.json`. Console errors/warnings: 0.

### M1 proof — DONE
- Repaired the predecessor's half edit (`peopleHarness.ts` used `view` before declaring it).
- `e2e/people-shots.cjs [sheets,roles,ref,life,perf]` (lock: `flock /tmp/hg-pw-2.lock`, `NODE_PATH=/usr/local/lib/node_modules_global`;
  `DUMP=<file>` writes the per-person traces; `PERF_RUNS=n`). Life check now reports median/p99/over-8 slide and
  uses true foot lifts (`Animator.liftN/F`) and marks the facing-flip frame as turning.
- Life (16 people, 10 s, 30 Hz trace): **0 of 127 one-second windows still**; planted-foot slide **median 0, p99 0,
  mean 0.07 u/s**, 7 of 2399 samples > 8 u/s, max 34.5 (first run: mean 6, max 370).
- Perf (30 people, median of 3, load 16.8): vector redraw 7.7 / 12.1 ms over blank at zoom 1 / 2.2; **`LiveSprite`
  2.2 ms at zoom 1 (figure ≈ 32 px), 4.5 ms at zoom 2.2 (≈ 71 px)** — budget 2 ms: borderline at zoom 1, over at 2.2.
  Probe runs at lower load: 1.8 ms at zoom 1; blits alone 0.7 ms (0.4 pixel-snapped).

### M2 look + fixes — DONE
- Look: heads drawn 15 % bigger (`HEAD_DRAW`, ≈ 24 % of height as in the ref), paler skins, caps cover only the
  crown, mine clothes ≈ 20 % lighter, thinner limbs/torso, smaller boots. Pray: arms open above the head.
- Feet at the cause: `Life.advance/joinSeg` (event-time joins; no glide onto activity points), per-person scale in
  `walkBy` (`scale × hk`; it used a flat 0.9 → 0–10 % slide), blends step feet on arcs (start/stop steps), walks start
  at the phase with the near foot under the hip, `Animator.plantFeet` integrates stance feet through corners and
  flips, foreshortened stride on vertical legs (`walkBy`: cycle advances `1/(1−0.35|uy|)` faster, `travel` = real
  distance), gait depth tracking `ay = uy`, leg IK may stretch to 1.3× (`ik(..., stretch)`, legs only).
- Perf: one ink stroke per limb, `FIG_DETAIL.low` below `LOW_DETAIL_PX`, `LiveSprite` (walkers 10 fps, work 8 fps,
  staggered, anchored walker blits, tight blit rect, partial clear).

### M3 clips — DONE
- `turn` (Life plays it as a feet-preserving overlay when a standing person turns round), `start`, `stop`,
  `board`/`ride`/`alight` (lift: bar hand overhead), `cartIdle`. `attachPoints(anim, out)`/`newAttach()` exported.
- Requests to 5B round 2 in `handoffs/P2-r5-requests.md` (#6 anchored walker blits or `LiveSprite`, #7
  `willReadFrequently` — the warning is gone in run 6, #8 low detail is automatic). BEHAV/CAST: no requests for me.

### M4 — DONE: `DECISIONS.md` `### P2-people — Living people` (numbers from run 6).

### Self-grade: 7.5/10 (bar: a shipped indie game)
Three worst faults a hostile critic would name:
1. **In the actual mine the planted-foot fix is only in the model.** The mine draws people through 5B's own
   throttled sprite cache, which blits a walker's stale sprite at the moving position (slip up to ≈ 2 u between
   repaints). Needs 5B request #6 (anchored blits / `LiveSprite`); I may not edit `mine/index.ts`.
2. **Perf over budget when zoomed in** (4.5 ms at zoom 2.2) and borderline at zoom 1 under load.
3. **Poses are less gestural than the reference** (the ref's miners stride wide and swing picks overhead in big
   arcs; ours idle and work in smaller, tidier poses; the roles sheet reads as a row of similar standing figures).

### Next steps (exact, for a successor)
1. Perf at zoom ≥ 2: render `LiveSprite` repaints for people farther than ~600 px from the screen centre at 6 fps;
   or skip the head shadow step and hand fills under 2 px/unit; measure with `/tmp/p2people/perfq.cjs`
   (`node perfq.cjs "mode=blank&A=2.2" "mode=live&A=2.2"`, under the lock). Target ≤ 2 ms at zoom 1, ≤ 3 ms at 2.2.
2. Bigger gestures: widen the dig stance (feet ±6), overhead swing key higher (hand y −40), idle weight shifts with
   a hip sway of ±1.2, talk gestures with both hands; re-shoot `sheets,ref` and compare at equal scale.
3. When 5B adopts #6, re-run `life` and look at a 12-frame strip of a walker crossing the cartway at zoom 3.
4. The 7 remaining > 8 u/s samples are one-frame events at zone/route changes (h2, w1, c2) — inspect with
   `python3 /tmp/p2people/slide.py <traces.json>` (per-person runs; frame index → `people-life` time).

## Builder #1 notes (kept)
## Done (builder #1, stopped at the 350k context cap — handoff)
- Module `src/render/people/`: rig.ts (2-bone IK legs/arms, 21-channel pose), design.ts (18 role outfits + Elites,
  per-seed look: height/build/hunch/tones/patches/beard, age/temper/limp), figure.ts (inked flat tones + one shadow step,
  headgear + props, skirts that follow each leg, carts), clips.ts (≈30 clips + 5 distance-driven gaits with carries,
  age/fatigue/temper/limp modifiers), animator.ts (0.32 s blends, reaction overlays, turn squash, head/hand springs,
  pick impact sparks/chips/dust), paint.ts, scale.ts (36 u, `MINE_FIG_SCALE` 0.9), life.ts (deterministic fallback
  routines; task/react/route/pos/activity/asleep/inLift honoured), nav.ts (A* + string-pull), sprites.ts, crowd.ts, speck.ts.
- Adapters: `src/render/art/ghelm.ts` (drawGhelm keeps its signature), `src/render/mine/people.ts` (People drives
  Life; `People.lightAt?: (x,y)=>hex` tint hook now implemented, quantised to 16 levels). Mine renders unchanged index.ts.
- Harness `dev/people.html?view=roles|acts&phase=0..7|walks|react|ref|life` (+ `src/render/dev/peopleHarness.ts`,
  `peopleLife.ts` with `window.__life.advance/snapshot`).
- Tests `tests/people/people.test.ts` 8/8 green (planted feet, determinism 30 vs 60 fps, nav through gaps, nobody
  still a whole second). `npx tsc --noEmit` clean for owned files (Look.age/temper/limp made optional so CAST's
  `cast/roles.ts` CastLook compiles again).

## Not done (exact next steps)
1. `e2e/people-shots.cjs` (port 5210, `e2e/lib/browser.cjs`, HMR stub, `flock /tmp/hg-pw-2.lock`): roles + acts at 8
   phases (zoom 1/3, colour + gray), `view=ref` side by side, `view=life` 12 frames over 10 s with the per-1 s
   changed-pose check and foot-slide check from `__life.snapshot()` (footN/footF lift flags), perf (30 people draw
   ≤ 2 ms, median, `uptime`, blank-canvas control) → `screenshots/people-*.png`. Scratch drivers `/tmp/p2people/shot.cjs`,
   `/tmp/p2people/life.cjs` are a starting point (the life capture was never seen to finish — bake is slow under load).
2. Look at the life view in the real mine (downscaled) and fix what reads wrong.
3. Clips the coordinator asked for that are still missing: turn-in-place with foot shuffle, start/stop steps,
   lift board/ride/leave sequence, cart-handle / cage attach points for AMBIENT. Check `handoffs/BEHAV.md` Requests
   (did not exist at last check).
4. Append `### P2-people — Living people` to `DECISIONS.md` (read it first; others edit it).
5. Self-grade vs `handoffs/ref/ref-6x-figures-*.png` (not yet done honestly after the last changes).

## Self-grade (last honest, before e2e): ~6.5/10
- Worst critic points: no e2e proof/screenshots yet; behaviour never viewed in the real mine at length; figures are
  closer to the ref (lanky, pale heads, work clothes) but the crest halos from 5B still float over heads (request #1).

## Files touched
- src/render/people/{index,rig,design,figure,clips,animator,paint,scale,life,nav,sprites,crowd,speck}.ts (new)
- src/render/art/ghelm.ts, src/render/mine/people.ts (rewritten; old copies /tmp/p2people/*.old.ts)
- src/render/types.ts (additive PersonView fields + PersonTask/PersonReact/PersonRoute types)
- dev/people.html, src/render/dev/peopleHarness.ts, src/render/dev/peopleLife.ts, tests/people/people.test.ts
- handoffs/P2-people.md, handoffs/P2-r5-requests.md ("From people to 5B", 5 requests)

## Requests
- see `handoffs/P2-r5-requests.md`, "From people to 5B" (#4 `People.lightAt` is now implemented).

## Builder #4 (successor, 2026-11-23 07:05–) — status: REPORTED ("something in place", DECISIONS §19)
- Verified on arrival: tsc clean for owned files, `tests/people` 9/9, harness loads.
- **Done:** the miners are THEME's wickfolk (`src/render/people/folkfig.ts`, branch in `figure.ts drawFigure`,
  `drawFolkHeadPart`, `drawFolkCart`); rig solve with a body remap seats the big head on the shoulders (no neck);
  every motion clip carries over unchanged (dig, carry, cart push, squat, walk, pray, offerSet, cower, …).
- Evidence: `screenshots/people-sheet.png` (every mine trade, idle / work / walk at 80 px and 20 px),
  `screenshots/people-life-wickfolk.png` (the real mine renderer, 16 scripted people), lineup / strips re-shot.
  Console errors 0 on tsheet, lineup, strips, life.
- Self-grade (looks, per §19 not polished): ≈ 6.5. Worst: (1) 20 px tier draws thin limbs (lod 'low' keeps full
  limbs; should thicken / merge into a silhouette); (2) heads are cached three-quarter for every trade, so the
  turn when walking left/right is a mirror (light flips side); (3) kit pieces (apron, goggles…) ignore the mine's
  local light tint (THEME's `drawKitPiece` takes gray/dark only) — small accents, still read.
- **Not done (brief items 3–6 of the successor task, parked by §19):** new work clips (prise a crystal and hold it to
  the wick, basket loading, cart with a pit beast, shard-lamp trimming, knot-cord tally, gourd break, lift queue);
  new reactions (rare strike gang look, collapse run, carry a body, offering at the grave as its own clip);
  idle fidgets (fin scratch, goggle wipe); perf pass (the predecessor's perf2: 60 people LiveSprite 11.8 ms at
  zoom 2 under load — over budget).
- Requests: THEME — `drawKitPiece` could accept a colour map (tint) so kit pieces take the mine light; export
  `BACK_PIECES/BODY_PIECES/HEAD_PIECES` (copied locally in folkfig.ts).

## PEOPLE-perf pass (2026-11-23, in progress) — drawing the people fast, same look
- Interface: unchanged for callers (`drawGhelm` → `Animator.draw` → `drawFigure`). Additive: `src/render/people/figcache.ts`
  (`FIG_CACHE` { on, maxPx, maxBytes, q, stats(), clear() }; `?figcache=0` turns it off on any page), `Animator.phaseKey(t)`.
  `Animator.draw` blits a cached sprite (painted once per look × paint × acting × pose × scale × ¼-px phase × facing)
  when the transform is axis-aligned and the figure ≤ `FIG_CACHE.maxPx` (96 px); else vector as before.
- Silhouette tier: figures ≤ 20 px (`SIL_BELOW_PX` in folkfig.ts) lay all limb ink under the body (one merged outline),
  limbs ×1.3 (`?sil=0` turns it off).
- Probe: `src/render/people/dev/perf.ts` (mine pattern / direct / vector / blank), runner `/tmp/peopleperf/perf.cjs`.
