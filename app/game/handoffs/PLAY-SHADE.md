# PLAY-SHADE — the Shade stage (the town), playable (running handoff)

## LANDED (worktree builder, 2026-11-23 ~16:30) — read this first
- **Sim:** rooted-out loss = SIM's `rootedOut` (spec §13 plain reading, tested in `tests/sim/v33-town.test.ts`). WRITING's
  round-5 table was already in; the town now also gets town words for the threshold lines (`SHADE_STAGE.crossTexts` /
  `suspicionHints`) and for vigil / bolted / heretic-hunt / crackdown / Kindling (`factions.ts`). `npm run bots` →
  `scripts/sim-bots.ts`. The loss screen takes `defeat.why` first (`sealed` → Council, `rootedOut` → alone; front/adapter.ts).
- **Headless:** `tests/play-core/fullrun.test.ts` — seed 11 to a win, seeds 7 / 11 to a loss with the `idle` town player
  (answers only the cards put in front of it), each run twice and compared (deterministic). The lib also returns
  `lastMineSave` / `lastTownSave` (real Session saves).
- **Browser:** `e2e/play-core-fullrun.cjs` with `FROM=lastmine|lasttown` (the save goes in through the title's Continue,
  no debug jump) and `TOWN=idle`. Seed 7: Continue at night 14 → End Night → watershed → 41 town nights by clicks
  (crowds, Elites, answers, landed moves, pushback). Seed 7 `lasttown`: night 30 → Day → the ending → closing card →
  title. Seed 11 `idle`: night 16 → watershed → town → Ichor 0 at night 34 (same as headless) → stage card → defeat →
  title. 0 console errors in every run. `e2e/env-check.cjs` on this build: 0 Void pixels in all Shade views.
- **Fixed on screen:** the ending played under the frozen Dusk ledger and caught its click (panels now cleared when it
  starts) and ran 1/60 s per drawn frame (now real time); the Dusk ledger names a landed move / seal / lost building
  first; no Elite ring over Void ground (`eliteGroundSeen`).
- **Open:** the browser robot misses many direct map picks (86 in 41 town nights) (it clicks the unit's snapshot point; persons are not in
  the snapshot; neighbours overlap) and goes through the block's card instead — a player can always do the same, but
  the town hit-test around crowded blocks deserves a look. Proof strip: `screenshots/play-shade-run.png`.

Builder #1 (2026-11-23). Port 5235, browser lock `flock /tmp/hg-pw-2.lock` (5235 % 3 = 2). Scratch `/tmp/playshade/`.
Owns `src/scenes/play/shade/**`, `dev/shade.html`, `tests/play-shade/**`, `e2e/play-shade-shots.cjs`,
`screenshots/play-shade-*.png`, this file, `### PLAY-SHADE` in `DECISIONS.md`.

## The town hit (published; PLAY-CORE / HUD bridge read this — orchestrator 2026-11-23, reel beats 23–24)

```ts
// src/scenes/play/shade/index.ts — stage.hit(x, y) in LOGICAL px (1600×900); also window.__hg.shadeHit(x, y)
interface ShadeHit {
  kind: 'crowd' | 'elite' | 'person' | 'block';
  unit: string | null;   // ALWAYS a sim unit id from the v3.2 state (c01…c20 crowds, e01… Elites, t…/g… people) or null
  zone: string | null;   // a sim town zone id (minehead … citygate)
  name: string;          // the sim unit's name, or the block's name
}
const ELITE_HIT_PX = 26; // Elites are tested first, within 26 logical px of their ground point
```
- A crowd is one target: a hit on any drawn member answers the crowd (`kind 'crowd'`, `unit 'c01'`); member ids of the
  form `c01#3` / `c01:3` / `c01.3` are folded to the crowd. The click opens the crowd's card (Whisper as a group).
- An Elite: a ground ring (gold; violet once yours) under the figure, ≥ 11 px at any zoom, never over the head; the hit
  radius is 26 px. Click → the Elite's card (stage, odds, what stands between, Whisper).
- The living town's other people (BEHAV society, not sim units) and the hunters answer as their block (`kind 'block'`).
- `world.hitTest` (PLAY-WORLD / the town) is used underneath; this function is what maps it to the sim. In the
  integrated scene, use `mountShade` (Requests) and the stage does all of this; if PLAY-CORE keeps its own Shade input
  instead, call `stage.hit` (or copy its rules) rather than `world.hit`.

## Town exports and ids this stage depends on (for the town rebuild, #8: please keep these stable)

Through `WorldComposite` (`src/render/world/index.ts`) only — no direct `src/render/town/**` imports:
- `preloadWorldRenderer(seed, budget).fullPromise`, `world.setupCamera(cam)`, `world.update(view, dt)`, `world.settle()`,
  `world.render(ctx, cam)`, `world.townReady` (resolves to `{ geo, plan }`; `geo` + `plan` go to BEHAV's
  `townLayoutFromPlan` — the stage keeps the plain life when either is missing).
- `world.hitTest(sx, sy, cam)` → `{ zoneId, personId }`; `world.zoneAnchor(id)`, `world.zoneBounds(id)`,
  `world.personPos(id)`, `world.townExtent()` → `{ x, y, w, h }`, `world.visibilityAt(x, y).vis`.
- `WorldView` fields read by the town: `zones[]` (`id, visibility, control, hold, holdFrom, flags { desecrated, warded,
  occupied }`), `people[]` (`TownUnitView`: `id, zoneId, role, crest, devotion, size, elite, marker: 'inquisitor', pos,
  activity, route, asleep, face`), `selectedIds`, `hoverId`, `selectableIds`, `dayT`.
- Zone ids (the sim's, `src/sim` town zones): `minehead, slagrows, haulyard, smeltery, market, wellsquare,
  sporegardens, gravefield, highwarrens, tallyhall, garrison, kilntemple, citygate`. Person ids: the sim's unit ids
  (`c01…c20` groups, `t*` people, `e01…e05` Elites) plus `hunter:<id>` for the Auditor / Cantor markers.

Tolerance (since 2026-11-23): every town call is wrapped. A zone id the town no longer anchors falls back to the nearest
landmark of the same kind (`anchorOf` in `view.ts`: e.g. `garrison → citygate → tallyhall`), then the town's middle; a
hit on a place id the sim does not know picks the nearest block anchor within 90 px on screen; a missing
`townExtent` keeps the default camera. Nothing here chases the town's look (orchestrator: the renderer is mid-rebuild).

## Interface (exact; additive only from here)

```ts
import { createShadeStage, type ShadeHost, type ShadeStage } from './shade';   // src/scenes/play/shade/index.ts

/** What the stage needs from the play scene (PLAY-CORE). Everything optional has a local stand-in. */
export interface ShadeHost {
  /** the one world renderer (WorldComposite, src/render/world) and the scene's world camera (town units) */
  world: WorldComposite;
  cam: Camera;
  /** a DOM element the stage may fill with its own panels (absolutely positioned over the canvas); emptied on exit */
  root: HTMLElement;
  /** the canvas element (for its client rect: logical 1600×900 → client px) */
  canvas: HTMLCanvasElement;
  /** hide / show the scene's own HUD while the stage's panels are up (the stage shows its own Shade HUD) */
  hud?: { hide(): void; show(): void } | null;
  /** AudioEngine or anything with these methods */
  audio?: { setScene(scene: string, opts?: { fadeSeconds?: number }): void; sfx(name: string, opts?: { gain?: number }): void } | null;
  /** every sim step the stage takes (so the scene's own copy stays current) */
  onStep?(state: GameState, events: GameEvent[]): void;
  /** the run ended: 'won' → the scene runs FINALE's runEnding (or the stage runs it itself when `finale` is given);
   *  'lost' → the scene shows its defeat / restart. The stage stops taking input after this. */
  onEnd?(kind: 'won' | 'lost', state: GameState, text: string): void;
  /** optional: when given, the stage runs the ending itself through FINALE with this host */
  finale?: FinaleHost | null;
}

export interface ShadeStage {
  /** take over from the watershed's hand-back: the sim state at the start of a Shade night */
  enter(simState: GameState): void;
  /** per rAF, before render */
  update(dt: number): void;
  /** draws the world (and the stage's ground marks) — call INSTEAD of the scene's own world render while the stage is up */
  render(ctx: CanvasRenderingContext2D): void;
  /** canvas input in LOGICAL px (1600×900); returns true if consumed */
  handle(input: ShadeInput): boolean;
  exit(): void;
  /** the current sim state */
  readonly state: GameState;
  /** robots / e2e: a JSON snapshot (also published as window.__hg.shade) */
  snapshot(): ShadeSnapshot;
}
export type ShadeInput =
  | { type: 'move'; x: number; y: number }
  | { type: 'click'; x: number; y: number; button?: number }
  | { type: 'wheel'; x: number; y: number; dy: number }
  | { type: 'drag'; dx: number; dy: number }
  | { type: 'key'; key: string };
```
Emits: `host.onStep(state, events)` after every sim step; `host.onEnd('won'|'lost', state, text)` once.
Robot hooks: `window.__hg.shade` (snapshot: `mode` 'night'|'day'|'dusk'|'ending'|'over', `turn`, `selected`, `targets[]`
with screen points, `hands`, `pushback[]`, `elites[]`), stable `data-shade-act="…"` on every button.

## Requests

### PLAY-CORE ↔ PLAY-SHADE: who fixes the Shade beats 23–25 (orchestrator, shot loop 2026-11-23)
Agreed split (PLAY-SHADE's side is done; proven by part D of `e2e/play-shade-shots.cjs` in the integrated build `/?seed=7`):
- **PLAY-SHADE owns** everything the player does in the town once the stage is up: hit-testing crowds / Elites / blocks
  (a hit on a crowd member opens that crowd's card; a hit on an Elite or its block opens the block card with the Elite
  listed; a hit on an unknown place id falls back to the nearest block), the unit / Elite / block cards and their acts
  (the sim's legal actions), the sim's **pending event / blessing card** (`pendingModal` — shown before anything else,
  answered on screen), End night → Day film → Dusk ledger (pushback with Why + Counter) → next night, the ending / loss.
- **PLAY-CORE owns** the hand-over only. Exact patch for `src/scenes/play/index.ts` (≈ 12 lines):
  ```ts
  import { mountShade, type ShadeMount } from './shade/mount';            // PLAY-SHADE
  private shade: ShadeMount | null = null;
  // in runWatershedNow's `finale.done.then(...)`, after the camera settles (replacing showSummary's Shade intro, or after it):
  this.shade = mountShade({
    world: this.world.r, cam: this.world.cam, state: this.sim.state() as GameState,
    canvas: this.canvasEl ?? (document.getElementById('game') as HTMLCanvasElement), parent: this.sc.ui,
    hud: { hide: () => { this.root.style.visibility = 'hidden'; }, show: () => { this.root.style.visibility = ''; } },
    audio: this.sc.audio ?? null, finale: this.finaleHost(),
    onStep: (s) => { /* optional: keep RealSim's session in step, e.g. this.sim.adopt?.(s) */ },
    // 'won' arrives after FINALE's ending has played (the stage runs it with `finale`); 'lost' shows the stage's own
    // defeat card with Begin again (back to the watershed state) — leave it up, or route it to your own defeat screen
    onEnd: (kind) => { if (kind === 'won') this.sc.goto('title', {}, { transition: 'black', duration: 1.2 }); },
  });
  this.root.style.visibility = 'hidden';
  // update(dt): first line → if (this.shade) { this.shade.update(dt); return; }
  // render(ctx): after the black fill → if (this.shade) { this.shade.render(ctx); return; }
  // on scene exit: this.shade?.dispose(); this.shade = null;
  ```
  `mountShade` takes the canvas input in the capture phase while it is up (the scene's mine hit-testing never sees a
  town click), lays its own panels over the canvas in a child of `parent`, and draws the world + its marks. The stage
  keeps its own copy of the sim state from `state` on; `onStep(state, events)` reports every step if the scene wants to
  mirror it. Debug jump: after `debugFinale('watershed')` the sim may still be at the mine; the stage plays any state
  it is given (the e2e mounts the sensible bot's real watershed state for the same seed when the scene's is not Shade).

- **SIM:** (1) `suggestPay(s, need, card)` can return stones worth a hair less than `need` (seed 3, Shade: "Needs 14 crystal value
  (you chose 13.9)") while `cardView(...).ok` is true — the stage now checks the exact action with `actionWhy` and shows the
  card off with the sim's words; please make `suggestPay` cover `need` after affinity weighting. (2) Several pushback texts are
  still mine-worded in the town (`vigil`: "Every miner in the mine resists you", `bolted`: "The miners bolt their doors",
  `hereticHunt`: "go bunk to bunk") — a town wording when `s.stage === 'shade'` would read right. (3) The watershed state for a
  seed is not stable across sim edits (seed 3 reached Shade at turn 16 at 07:40 and turn 14 at 07:58 — the sim is being edited);
  the dev cache is keyed by `START_VERSION` in `src/scenes/play/shade/start.ts`, and the e2e always runs `fresh=1`.
- **PLAY-CORE:** to hand the town to this stage after the watershed: on `runWatershedNow().done`, create it once
  (`createShadeStage({ world: this.world.renderer, cam: this.world.cam, root: <overlay div>, canvas, hud: { hide/show the
  HudBridge }, audio: this.sc.audio, onStep: (st) => this.sim.adopt?.(st), onEnd: (k) => k === 'won' ? this.runEndingNow() :
  this.goto('defeat') })`), call `stage.enter(this.sim.state())`, then while it is up route `update(dt)`, `render(ctx)` and canvas
  input (logical px) to it instead of the scene's own night. Pass `finale: this.finaleHost()` to let the stage run the ending itself.
- **HUD:** none required — the stage draws its own plain panels (`src/scenes/play/shade/ui.ts`). When the HUD wants to own them:
  the stage's `UIModel` (ui.ts) is the exact data each panel needs (selection card, Elite list, pushback notes with reason +
  counter, ledger with suspicion from → to).

## Status
- Step 0: interface written.
- Step 1 (model, tested): `model.ts` (choices = the sim's legal actions; places; Elites found → studied → approached → turned
  with "what stands between"; pushback table for every `factionAction` id with reason + counter; Day notes; Dusk ledger;
  modals for blessings / story events). `start.ts` (watershed state from the sensible bot; `lastNightState` for the ending /
  a loss). `autoplay.ts` (scripted player for the e2e). `tests/play-shade/model.test.ts` 14/14 green.
- Step 2 (stage + dev page, compiles): `index.ts` (controller: night / day / dusk / ending / over), `view.ts` (WorldView +
  ground rings), `ui.ts` (DOM panels), `dev.ts` + `dev/shade.html` (`?seed=3`, `&at=last`, `&fresh=1`). `e2e/play-shade-shots.cjs`
  written. NOT YET RUN in a browser (the shared lock was busy) — next: run it, look at every shot, fix.
- Step 3 (first browser run, 08:10): dev page boots (town bake ~50 s under load 20; the bot's mine run 0.5 s in the browser),
  first Shade night renders with the blessing modal, Elite list, faction meters, hands; 0 console errors. Fixed after it: the
  town is framed in the free middle (between the panels), cards compacted to fit three per hand. Full e2e running.
- Step 4 (08:40): BEHAV life (`life.ts`), WEATHER low behind `?weather=0`, VFX wick effects (`fx.ts`) wired as thin
  wrapped adapters. First full e2e: part A night 1 played through the DOM (modal, eat, card with target, routine, Day film,
  Dusk) with 0 console errors, then the script lost the Day panel's Skip button (the panel was rebuilt every frame) → fixed
  in `ui.ts` (clock bar set in place). Map pick in A happened under the blessing modal → e2e now resolves modals first.
  Scripted player kept all actions for Lie low on hot nights → keeps two for whispers. Town tolerance added (orchestrator:
  town mid-rebuild) — see the dependency list at the top. e2e rerun queued on lock 2 (busy with other agents).
- Step 5 (09:00, orchestrator on SIM v3.2: "the town is where runs die"): heat, Ichor and who is exposed made hard to miss.
  Meters carry 25/50/75 ticks, turn amber within 8 of a line and pulse red at Hostile (≥ 75); tooltips and a "Heat" block
  at the top of the right column say what crossing the next line brings (`THRESHOLD_BRINGS`, from the sim's responder,
  which Shade shares with the mine). Ichor gets a bar and pulses red at ≤ ⅓ ("0 ends you"). New top-bar stat
  "Exposed n/m" (followers not lying low) and a "Who is exposed" list (gold light, a hunter here, a purge here first;
  click → the follower); on the map, their blocks get a red dashed ring while a track is ≥ 45. `exposure(s)` +
  `factionMeters` tested (16/16 green). e2e rerun still queued on lock 2.
- Step 6 (09:50, orchestrator: shot-loop beats 23–25 broken in the integrated build): the integrated play scene never
  mounts this stage. Added `mount.ts` (`mountShade(opts)` → `{ stage, update, render, dispose }`: own panels, capture-phase
  canvas input, logical transform) — the dev page now boots through it, and part D of the e2e mounts it inside `/?seed=7`
  after `debugFinale('watershed')` (scene's update/render redirected as the stand-in for PLAY-CORE's patch), then clicks a
  crowd on the map, acts on it, finds + acts on an Elite, answers the pending event on screen and ends the night. Split
  agreed in Requests (PLAY-SHADE: town hit-testing, cards, pending event, End night; PLAY-CORE: the ≈ 12-line hand-over).
  e2e fixes: action counter (`actions`), clicks survive a panel re-render. Run 4 (ABCD) queued on lock 2.
- Step 7 (VFX round 5): wick calls pass `feet` + `grave` (the pit head's mouth via `anchorOf('minehead')`, also on the
  draw host); a crowd turning fires `wickTurn` on 3–5 members staggered 120 ms. tsc clean.
- Step 8 (10:50): published `stage.hit(x, y)` → `ShadeHit` in sim ids (top of this file; `__hg.shadeHit`), Elites tested
  first within 26 px and marked by a ground ring (gold, violet once yours) that reads at town zoom; crowd member ids fold to
  the crowd. Run 4 (ABCD): A played 12 nights (Day 14 → 25, no step lost, 0 console errors), B played the top night →
  Day → Dusk → FINALE's ending (shots 20–23), C's seed now WINS under SIM v3.3 (no loss shown) → new `?at=lost` (the
  greedy bot's last night: seed 1, turn 33, Ichor 1); D hung in the integrated boot (page busy) → per-call timeouts +
  progress notes. Dusk top bar = the ledger's day. Run 5 (ABCD) queued.
- Step 9 (after the restart, 14:40): SIM v3.3 town contest playable. `contestView(s)` (model): every pending move
  (`threatsView`) in WRITING's words (`text.threatLine`, `text.answerWith`, `text.writ`), each answer a legal action or the
  sim's reason; "Their moves" block at the top of the right column with answer buttons (`data-shade-act="answer"`,
  `data-arg="<threat>|<by>"`), the writ as a top-bar stat ("Writ seals n/4", red one short of sealed), "the town has lost
  patience" line; a turned Elite's card offers "Call in a favour" (`favour`); Day notes for threatAnnounced / Looms /
  Landed / Blunted, writSealed / Torn, facilityLost, townHardens (with Why / Counter). Scripted player answers moves.
  Test 17/17. Part D (integrated `/?seed=7`) run 7: mounted after the watershed, pending event answered on screen,
  `__hg.shadeHit` gives sim ids (`c01` crowd "The lift crews", `e01` Magistrate Orla 9 px off), but the map click did not
  reach the canvas (the scene's DOM layers sit over it) → `mountShade` now takes pointer input at the window (capture)
  inside the canvas rect, off panels / controls. Grave shows every stone action (eat was hidden past six). Run 8 (ABCD).
