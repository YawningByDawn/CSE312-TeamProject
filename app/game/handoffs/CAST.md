# CAST — town folk, Elites, enemies, crowds (running handoff)

## ROUND 4 — body language, carries, crowds, reactions (builder #5, 2026-11-23; additive, binding)
New modules (all under `src/render/people/cast/folk/`): `clips4.ts` (clips + reactions), `carries.ts` (held items,
drawn by body.ts through `ITEM_EXT`), `crowd4.ts` (crowd entry → members, LOD drawing), `bier.ts` (multi-figure carry).
```ts
// import from 'src/render/people/cast'
// ---- clips (all in FOLK_CLIPS; pass as CastEntry.activity or drawPerson pose)
bundle sack crate bier censer cart newborn crystalHidden crystalUp   // walking carries (+ '<id>Hold' standing)
squat squatEat coverWick greet greetDip greetBrow march muster haggle heap stoke knead pump wind pocket handIn
patdown searched offerSet strikeLook curl escort scrape tend queue
// BEHAV's `doing` values and LIVING activities map through folkClipFor(doing, trade, t, seed) (never the fallback
// for any value the director emits — tests/cast/doing.test.ts reads the director's tables).
// ---- carries: CastEntry.carry?: string   // BEHAV LifePatch.carry: 'bundle'|'sack'|'crate'|'bier'|'censer'|'cart'|
//   'newborn'|'crystal' (hidden)|'crystalUp'; walking → the carry clip, standing → '<clip>Hold'. carryClip(carry, moving)
// ---- reactions (one-shots over the running clip, return cleanly): CastEntry.react = { kind, at }
//   kind: startle lookAround awe flinch point callOut weep cheer turnAway (+ the sim's whisper→lookAround, fear→flinch,
//   glance→startle, notice→point, turned/zeal→cheer, grief→weep). reactClipId(kind, base) = combined clip id.
// ---- in step: clips in IN_STEP ('march', 'muster', 'bier', 'censer' in a procession) take their phase from the
//   clock, so a file marching together lands every foot together.
// ---- the bier (two or four bearers + the shrouded body): see "Bier" below (filled in as it lands)
// ---- crowds: see "Crowd entry" below (filled in as it lands)
```

## ROUND 3 — the wickfolk (builder #3; interface binding from now, additive only)
Everyone CastLayer draws is now **wickfolk** (`docs/theme.md` §3), drawn by `src/render/people/cast/folk/**`
(own pose model + drawer + sprite bank; the old rig-based exports stay for compatibility but CastLayer no longer uses
them). Shared body kit: `folk/kit.ts` is the one adapter to THEME's `src/render/theme/` (local stand-in until it exists).
```ts
// import from 'src/render/people/cast'
CastLayer.draw(ctx, entries)                 // unchanged call; entries gain OPTIONAL fields:
interface CastEntry {                        // … existing fields …
  trade?: string;        // LIVING TradeId (51 town + 24 mine) or any alias; wins over `role` for the look
  wick?: 'gold' | 'pale' | 'violet' | 'out';  // devotion colour override (default: from crest/devotion, see below)
  spirit?: number;       // 0..1 wick brightness (health/spirit); default 0.7; mood 'fear' gutters it
  hood?: boolean;        // hood up (a follower lying low hides a violet wick; also rain)
  age?: 'child' | 'young' | 'adult' | 'old';
  mood?: 'fear' | 'zeal' | 'doubt' | 'joy' | 'grief' | 'tired' | 'angry' | null;   // ear-fins + posture + wick
}
// activity: a folk clip id (FOLK_CLIPS) OR a LIVING ActivityId ('work','market','tavern','eat','sleep','chapel',
//   'beg','rounds','wash','play','queue','preach','procession','drill','mourn','shelter','sell','family',…):
//   mapped per trade by folkClipFor(activity, trade, t, seed).
// wick colour default: crest 'follower' → violet; 'kiln' (Temple) → bright gold; devotion < 0 or mood 'doubt' → pale;
//   otherwise gold. dead → 'out'.
cast.weather = { wet?: 0..1, wind?: 0..1, windX?: -1..1, cold?: 0..1, fog?: 0..1 }   // set per frame (WEATHER state)
cast.night   = 0..1        // only affects the emissive pass strength (wick glow, eyeshine)
cast.drawGlow(ctx)         // additive wick + eyeshine + carried-flame glow for the people drawn this frame; call it
                           // AFTER the night grade (or in `above` if no later seam) so wicks shine in the dark
cast.lights                // now also one small pool per wick (r ≈ 9 world u) + Council shard-lamps (cold white,
                           // r 46) + Temple braziers (gold, r 52) + carried lamps (fog)
FOLK_TRADES, FOLK_CLIPS, folkTradeOf(role), folkClipFor(activity, trade, t, seed)
drawFolkSpeck(g, x, y, worldPerPx, wickCol, bodyCol, alpha, bob)   // far zoom: body speck + wick light dot
FolkCrowd(kind: 'market'|'tavern'|'procession'|'queue'|'levy'|'heap'|'chapel'|'news'|'patrol', seed, count)
  .entries(id, x, y, t, extra?, mood?: GroupMood = 'calm', moodAt?) → CastEntry[]   // members as entries for CastLayer;
                                           // mood bends the group person by person from the front over ~2 s
GroupMood = 'calm' | 'uneasy' | 'fervent' | 'yours';  GROUP_MOODS;  crowdExtent(crowd, mood) → { rx, ry }
cast.drawGroups(ctx, bodies: GroupBody[])  // { x, y, rx, ry, mood }: call BEFORE cast.draw — the group's body at town
                                           // zoom (trodden-ground shade + the wicks' gathered light in the mood colour)
// ---- one person at a time (BEHAV stand-ins, PLAY-WORLD seams, HUD) — added round 3 successor
drawPerson(ctx /* world transform */, person: PersonLike, pose: string | null, t, o?: { scale?: 0.6, weather?, night? }) → DrawMeta | null
interface PersonLike { id; x; y; trade?; role?; age?; wick?: 'gold'|'pale'|'violet'|'out'; spirit?; hood?; mood?; dead?;
                       facing?; moving?; walked?: number /* world units, planted feet */; gray?: boolean /* Sensed */ }
// pose: any folk clip, LIVING ActivityId, or BEHAV stage name: squatEat coverWick heap curl muster escort levy stoke
//   sermon greeting offerSet pocket strikeLook pump wind knead rainRun patdown handIn ('work' = the trade's work clip).
// New clips: levied (bound, led away, looking back), escort (pike + lead rope), stoke (pole into the pyre).
```
Scale: a grown wickfolk is `FOLK_H` = 24 world units feet to crown at town scale (36 device px at A = 1.5);
children ≈ 0.55, elders 0.92, Elites 1.08 + hood. Animals: dog/cat/chicken/mule are gone (theme: no dogs);
roles `dog|cat|chicken|mule` draw a **pit beast** (`beast`) or a **skitter** (`skitter`).

## (round 1–2 interface below — rig-based; superseded for drawing by round 3)

Builder: CAST. Brief `handoffs/briefs/CAST.md`. Port 5227. Scratch `/tmp/cast/`.
Code: `src/render/people/cast/**` (new files only; builds on the miner rig `src/render/people/` through one
adapter `cast/rigAdapter.ts`). Harness `dev/cast.html`, shots `e2e/cast-shots.cjs` → `screenshots/cast-*.png`.

## Interface (binding from now; additive only)
Import everything from `src/render/people/cast` (`index.ts`).

### How a `PersonView` selects a design
```ts
castRoleOf(view.role: string, hints?: { elite?: boolean; hunter?: 'auditor'|'cantor' }): CastRole
```
`view.role` strings accepted (case/punctuation-insensitive): every sim `RoleId` (`smelter trader farmer soldier
clerk priest beggar gravedigger washer lamplighter magistrate captain highpriest guildmaster smugglerboss guard
overseer digger hauler sorter kilnkeeper`) plus the cast extras below. Hunters: `auditor`→`inspector`,
`cantor`→`inquisitor`. Unknown → `townsman`. Miner roles are passed through to the miner animator untouched
(`isMinerRole(role)`), so one call site can route everyone.

### CastRole ids
- Town folk: `smelter` `bellows` (smelter hand on the bellows) `trader` `stallholder` `farmer` `carter`
  `clerk` `washer` `child` `beggar` `drunk` `lamplighter` `gravedigger` `townsman` `townswoman` `elder`
- Elites (one individual each, by sim id e01–e05): `magistrate` (Orla) `captain` (Harl) `highpriest` (Aldo)
  `guildmaster` (Petra) `smugglerboss` (Vix)
- Authority / enemies: `guard` `guardsergeant` `overseer` `priest` `acolyte` `inquisitor` `inspector`
  `soldier` `officer` `drummer` `pikeman` `shieldman` `hunter`
- Animals: `dog` `cat` `chicken` `mule` (mule draws with its cart)

### Activities (`view.activity`, or chosen by `defaultActivity(role, t, seed)` when unset)
Common: `idle` `walk` `stroll` `run` `talk` `listen` `sit` `pray` `cower` `kneel`.
Work/leisure: `hammer` `bellows` `haggle` `weigh` `sow` `reap` `carrysack` `cart` `write` `scrub` `play` `beg`
`stagger` `drink` `lightlamp` `dig` (gravedigger) `sweep`.
Authority: `patrol` `search` (lantern sweeps) `notice` `point` `seize` `beat` `burn` `ward` `prayagainst`
`march` `standguard` `breakdoor` `drum` `preach` `censer`.
Elite signatures: `sig` (each Elite's own idle: Orla reads and stamps, Harl paces with hands behind his back, Aldo
lifts the Flame, Petra counts coins, Vix leans and flips a knife) — `idle` on an Elite plays `sig`.
Animals: `idle` `walk` `run` `sit` `peck` (chicken) `sniff` (dog) `groom` (cat) `pull` (mule).

### Reactions (`view.react.kind`, `at` = WorldView.time)
`whisper` `turned` `refused` `fear` `glance` `notice` as for miners; Elites play their own signature reaction for
`whisper` and `turned`. Extra: `zeal` (fist raised, chest out), `doubt` (stops, looks at hands).

### Allegiance on the body
`castPaint(crest, devotion, mono?)` → `CastPaint` (extends the miner `FigurePaint`). Follower stages by
devotion: 0–24 a violet glint in the eye only; 25–59 + a violet thread at the wrist / the secret sign (two fingers
to the lips) now and then in idles; 60–100 devoted: violet sash/markings, lamp/lantern/censer flame violet,
upright posture. Temple = gold, Council = steel-blue. Posture: `mood` 'fear' | 'zeal' | 'doubt' | null modifies
any clip (hunch/shrink, chest out, slowed and looking down).

### Drawing one person
```ts
const cp = new CastPerson(id: string, role: string | CastRole, hints?: { hunter? })
cp.update(view: CastView { id, role, activity?, react?, mood?, hunter? }, t, stage /* followerStage(devotion) or -1 */, dx = 0, dy = 0, s = 0.6)
cp.draw(g, x, y, s /* world units per rig unit; town 0.6 = TOWN_CAST_SCALE */, paint: IndexedPaint, t, facing?)
bank.draw(g, x, y, s, A, look: CastLook, act, t, facing, paint, mood?, fps = 8, walked = -1)   // CastBank, sprite-cached
bank.frame()            // once per rendered frame: resets the paint budget (bank.budget = 14 new sprites/frame;
                        // over budget a person shows its last cached frame of the same activity for a frame or two)
drawCastSpeck(g, x, y, worldPerPx, role | SpeckShape, accent /* '' with a role */, paint, alpha?, bob?)   // far zoom
```

### The whole town in one call (recommended for the town renderer / life director) — `layer.ts`
```ts
const cast = new CastLayer(maxSprites = 6000)        // cast.scale = 0.6, cast.eliteK = 1.2, cast.fps = 8
// inside renderer.layers.props (TownLayerCtx has g/A/view/time/visibilityAt already):
cast.draw({ g, A, view: {x,y,w,h}, time, visibilityAt? }, entries: Iterable<CastEntry>)
interface CastEntry { id; role /* any string castRoleOf takes */; x; y; activity?; react?: {kind, at}; mood?;
                      crest?: Crest; devotion?; hunter?; facing?; alpha? }
cast.stats  // { figures, specks, culled } last frame
cast.lights // [{ x, y, r, col }] world units: every flame / lit lamp the drawn people carry this frame (pool light under them)
cast.bank.memory() // bytes of cached sprites
```
Culls to the view, y-sorts, detects walking from position changes (feet planted: the cycle follows the distance
walked), faces the direction of travel, plays `react` (Elites' own whisper/turned clips) for its duration, else
`activity`, else the role's deterministic schedule; Sensed-only (active < 0.5) → gray silhouette, unseen → not drawn;
figures under `CAST_SPECK_BELOW_PX` (7 device px) → role specks (Elites in their own coat colour). Townsfolk share 8
looks per role so a crowd shares sprites; Elites are individuals. Set `renderer.ownPeople = false` when using it.

### Groups
```ts
const grp = new CastGroup(kind: GroupKind, seed: number, count: number, opts?: { roles?: CastRole[]; spread?: number })
grp.draw(g, bank: CastBank, x, y, s, A, t, paint: IndexedPaint | ((memberIndex) => IndexedPaint),
         { conversion?: { at, dur, from: Crest, to: Crest, devotion? }, mono?, facing?: 1|-1, fps? })
grp.silhouette(g, x, y, worldPerPx, s, t, paint, opts?)   // far zoom: each member as a role speck in formation
grp.speed   // rig units/s for moving formations (procession, patrol, funeral): move the anchor at speed·s
grp.members, grp.rx, grp.ry, grp.actAt(i, t)
```
`GroupKind`: `market` `congregation` `procession` `patrol` `workgang` `mob` `queue` `funeral` `drill` `crowd` `hunt`.
Conversion passes person by person from the front of the group back over `dur` s; each lifts their head as it reaches them.

## Done
- Builder #1 (stopped by owner interrupt): adapter, roles (35 designs + 4 animals), paint, draw, clips (≈75 cast
  clips + the miner set), animator, bank, group (11 kinds), person, speck, animals, harness, shots script.
- Builder #2 (successor), M1: all 26 shots + perf run, tsc clean. Fixes: bank paint budget per frame + stale-frame
  fallback (cold-cache spikes), `walked` arg (planted feet from real movement), market/mob/crowd members spread
  by best-candidate sampling (no heaps), congregation rows opened up, harness centres moving formations (patrol,
  procession, funeral were cut off at the frame's left), far specks redrawn pixel-snapped and inked with Elites in
  their own coat colour, `kneel` clip (was advertised, missing), new `CastLayer` (one call per frame for a town),
  `view=town` harness (street through CastLayer, colour + Sensed gray strip, near/mid/far zoom), perf view
  flushes through a 1-px willReadFrequently canvas (was a console warning), tests/cast/cast.test.ts (5 tests).

- Builder #2 M2 (perf): sprites trimmed to their painted pixels (scratch canvas → bounds → right-sized canvas),
  looping clips ≤ 16 poses/cycle, cache default 6000. Measured (load 5–9, 1600×900, A 1.6, figure ≈ 38 px):
  300 figures warm 5.6 ms median / 9.3 p90 (blank control 0.7), cold 10.2 / 15.2 (before: 22–29 ms, never warmed);
  sprite memory 17.7 MB for 3959 sprites (before ≈ 27 KB/sprite ≈ 107 MB at that count). Paint ≈ 0.37 ms/sprite.

- Builder #2 M3: lights capture (`CastLayer.lights`, `bank.lights`, drawn as pools in `view=town`), Council
  armband on townsfolk (was a near-invisible badge), stage-sheet header labels no longer overlap, congregation in
  open rows (18×17 rig units), full re-shoot, console clean. Perf (load 5–6): bank 300 warm 4.8 ms / p90 8.2, cold 9.6;
  CastLayer town 300+24 → 9.7 ms, 120+24 → 5.4 ms; memory 17.7 MB / ~4000 sprites. tests/cast 5/5, tests/people green.

## Evidence
- Sheets: `screenshots/cast-sheet-{folk,elite,auth,animal}-{z1,z3}.png`, gray `cast-sheet-*-gray.png`
- Line-ups: `cast-lineup-ref.png` (beside ref-6x-figures-b), `cast-lineup-town.png` (beside a town.png crop)
- Allegiance / moods: `cast-stages.png`; conversion: `cast-convert.png`
- Crowds (12 frames each): `cast-crowd-{market,congregation,procession,patrol,workgang,mob,queue,funeral,drill,hunt}.png`
- Far zoom: `cast-far.png`, `cast-town-far.png`; integration path: `cast-town.png`, `cast-town-close.png`; perf `cast-perf-300.png`
- Perf JSON: `/tmp/cast/perf.json`; run `NODE_PATH=/usr/local/lib/node_modules_global flock /tmp/hg-pw-1.lock node e2e/cast-shots.cjs [names…|perf]`

## Files touched
- handoffs/CAST.md, src/render/people/cast/** (bank, group, speck, clips, draw, layer [new], index, dev/harness),
  e2e/cast-shots.cjs, screenshots/cast-*.png, DECISIONS.md (### CAST), tests/cast/cast.test.ts (new file; tests/ is not
  in my brief's list — orchestrator: keep or move).

## Next (exact)
1. Integration belongs to the town engine / PLAY-v2: `const cast = new CastLayer()`; in `renderer.layers.props`
   call `cast.draw(c, entries)` with entries mapped from TownUnitView (id, role, x, y, activity, react, crest,
   devotion, hunter) and set `renderer.ownPeople = false`; pool light from `cast.lights`.
2. Optional polish: cross-fade between the 16 poses of long idles (now ≈ 2.3 poses/s on a 7-s idle); light capture for
   the miner rig's `lantern` prop (needs a hook in figure.ts — request below); crowd group LOD hand-off by figure px.

## Requests
- Miner animator (P2-people): an optional light hook in `figure.ts` prop drawing (e.g. `onLight?(x, y, r, col)` in
  `FigurePaint` or a module-level capture like cast `LIGHTS`) so lanterns carried with the rig's `lantern` prop
  (guards, explorers) are reported too. Not blocking.
- Town engine (P6) / PLAY-v2: consume `CastLayer` as above (I do not edit the town).

## Self-grade: 8/10 (against "a shipped indie game", for this piece on its own)
- Worst 1: not yet in the game — the town still draws its own simpler people until P6/PLAY-v2 hand `layers.props` to
  `CastLayer` (outside my ownership; the seam is one call).
- Worst 2: dense crowds (congregation, mob) still read as a busy mass at mid zoom — rows/spacing are opened up but
  kneeling, arm-raised figures overlap the row behind in the 3/4 view.
- Worst 3: long idles step at ≤ 16 poses per loop (cache budget) — a sharp eye sees the slowest idles tick; and the
  town.png reference's townsfolk are chunkier/bigger-headed than our lanky (mine-reference) figures — a deliberate
  choice to keep one hand with the miners.

## ROUND 3 — successor status (builder #4, 2026-11-23 07:10)
- Step 1 verified: tsc clean for cast paths; tests/cast 5/5 (stub ctx lacked `getTransform`, fixed in the test).
- Next: cast sheet (80 px + 20 px every trade) → animation strips (14 named clips × 8) → mood groups → zoom tiers +
  400-figure perf → interface additions (`drawPerson`) → self-grade.

### Status (07:35) — owner ruling §19: "just get something in place" → polishing stopped
Done: tsc clean (cast paths); tests/cast 9/9 (new tests/cast/folk.test.ts). Body re-proportioned to THEME's current
FOLK (THEME widened chestW/hipW/torso to front-view numbers — our profile body had become a sack): side depth
`DEPTH_K` 0.62, trunk `TORSO_K` 0.8, thinner limbs, pale felt leg-wraps so legs read; head turns half as far as the
body (`HEAD_TURN_K` 0.5) so both eyes show as in the references; elders hunch more. Bug fixed in folk/bank.ts: the
shared scratch canvas leaked a bigger sprite's pixels into the outline pass (long dark bars beside small Elites).
Washer carries paddles. Stiff hood reshaped. New clips levied / escort / stoke; BEHAV names mapped; `drawPerson`;
group moods + `drawGroups`. Shots: `screenshots/cast-sheet.png`, `cast-strips-1.png`, `cast-strips-2.png`,
`cast-groups.png`, `cast-perf.png` (+ `/tmp/cast/perf.json`).
Next (when visuals resume): 20 px separation pass (guard vs washer is by helm/plate/lamp vs scarf/basket — check
cast-sheet's 20 px row), pair spacing in strips, Elites' attendants on drawPerson, cross-fade long idles.
Perf (07:40, load 25.6 / 17.9 / 13.5 — the box was saturated): 400 figures at town zoom (≈ 22 px), median 16.7–24.7 ms,
p90 23–55 ms, blank control 0.4–0.6 ms; 3182 sprites painted inside the timed window (the cache never warmed:
400 distinct trade×variant looks × clips), 5.5 MB. **≥ 400 at ≤ 3 ms is NOT met.** Next for perf: warm before timing,
cut looks at town zoom (share 4 variants, not 8, below 28 px), hold idle clips at 4 poses below 28 px, and drop the
outline pass under 24 px (the sprite is mostly outline at that size). Shots console-clean.
Self-grade (placeholder per §19): 6/10. Worst three: (1) perf above; (2) at 20 px most townsfolk differ only by cloth
colour — guard / priest / Elites stand out, washer vs weaver vs potter do not; (3) mood groups read at town zoom only
by the ground pool, and fervent vs calm are close.

## PEOPLE-perf pass (2026-11-23, in progress)
- `FolkBank`: `budgetMs` (8 ms of new-sprite painting a frame; past it a person shows its last frame of the clip, else its
  last sprite, else its trade's stand-in, else any adult's at that size); `frame(unlimited)` — CastLayer paints everything
  on a first draw or after a > 0.4 s pause (stills / screenshots stay exact). Below 28 px in-place loops keep 4 poses
  (calm clips) or 8 (`FEW_POSES_BELOW_PX`). Silhouette tier ≤ 20 px in `folk/body.ts` (`SIL_PX`, `FOLK_SIL`, `?sil=0`).
- Harness: `dev/cast.html?view=perf2&n=400&A=0.83&warm=600&frames=200` (warm / cold numbers).
