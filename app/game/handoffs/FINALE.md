# FINALE — the watershed pull-back and the ending beat (running handoff)

Round 3 builder (successor, 2026-11-23 ~09:50). Port 5230. Scratch `/tmp/finale3/`. Owns `src/scenes/finale/**`,
`tests/finale/**`, `e2e/finale-shots.cjs`, `screenshots/finale-*.png`, this file, the FINALE section of `DECISIONS.md`.

## For PLAY-CORE: the one call (round 3; unchanged API, additive only)
```ts
import { runWatershed, runEnding } from '../finale';
// when the sim says stageAdvanced (Whisper → Shade), at the end of that Day, instead of the dusk:
this.finale = runWatershed(this.finaleHost(), this.sim.state() as unknown as FinaleState,
                           { fromHold: this.holdBefore('minehead', 82) });
// each frame while it runs:  update(dt) → this.finale.update(dt); return;   render(ctx) → this.finale.render(ctx); return;
// input while it runs:       this.finale.input({ type: 'key', key }) / input({ type: 'click', x, y })  (consumes all)
const r = await this.finale.done;   // { skipped, pose, next: 'play' }
```
What it needs: `FinaleHost` = `{ world: WorldComposite, cam: Camera, view(t) → WorldView (the scene's own view of the
sim, as it would draw it), hud: { hide, show }, audio?, settings?: { reduceMotion } }` (as `finaleHost()` builds today).
**Hand-back contract (no cut):** the run ends on `world.frameAll()` (the whole town, the mine a violet point in the pit
floor) at night light (`dayT` 0.93), bars open, and it calls `hud.show()` itself 1.4 s before the end (the HUD rises
over the moving picture). On `done`: **keep the camera exactly where it is** (`r.pose`; do not `setPose(poseAll())`
or `wholeWorld()` — today's `runWatershedNow` does, which is a visible re-frame when the god knows few blocks; if a
glide is wanted, glide from `r.pose`), keep `dayT` at night (Shade's night is 0.02, Whisper's 0.92 — both dark), then
mount Shade. Skippable only after the first viewing (localStorage `hg.finale.seen`), `skippable: true` forces it.
The ending: `runEnding(host, state, { shadeTurn })` when the sim's phase is `won`; `done` → `next: 'title'` after the
player clicks the closing card. Debug: `__hg.hooks.play.debugFinale('watershed' | 'ending', skippable?)`; the run
that is playing is `window.__hgFinale` (seek / t / finished; e2e only).

## Interface (exact; additive changes only from here)

```ts
import { runWatershed, runEnding, type FinaleHost, type FinaleState, type FinaleRun } from '../finale';
// (src/scenes/finale/index.ts)

/** What the sequences need from the play scene. Everything optional has a local stand-in. */
export interface FinaleHost {
  /** the one world renderer (`WorldComposite` from src/render/world) */
  world: WorldComposite;
  /** the play scene's world camera (town units). The run sets its pose every frame; never calls constrainCamera. */
  cam: Camera;
  /** the WorldView the scene would draw now (zones/people from the sim state). The run edits a copy each frame
   *  (stain, pitGlow, lift, effects; hover/selection cleared). */
  view(time: number): WorldView;
  /** hide the HUD / play overlays at the start; show them at hand-back */
  hud: { hide(): void; show(): void };
  /** the AudioEngine (or anything with these methods). Sequences call setScene('watershed'|'shade'|'ending') and sfx(). */
  audio?: { setScene(scene: string, opts?: { fadeSeconds?: number }): void; sfx(name: string, opts?: { gain?: number; pan?: number; pitch?: number }): void } | null;
  /** optional feel/VFX hooks; when absent the run draws its own (local stand-ins) */
  fx?: { shake?(px: number, seconds: number): void } | null;
  /** Settings: reduce motion (no shake; slower glides are kept, hard flashes softened) */
  settings?: { reduceMotion?: boolean } | null;
  /** "seen before" store for skippability (default: localStorage 'hg.finale.seen', try/catch) */
  seen?: { get(id: 'watershed' | 'ending'): boolean; set(id: 'watershed' | 'ending'): void } | null;
}

/** Structural subset of the sim's GameState (pass the GameState itself) + the event payload. */
export interface FinaleState {
  seed: number; turn: number; stage?: string;
  god: { level: number; xp?: number };
  zones: { id: string; hold: number; rooted?: boolean; explored?: boolean }[];   // hold 0..100
  units: { id: string; follower: boolean; alive: boolean; kind?: string; headcount?: number; name?: string }[];
  stats?: Partial<{ whispers: number; conversions: number; miraclesCast: number; evilActs: number; crystalsEaten: number;
           followersLost: number; deaths: number }>;
  bonuses?: string[];
}
export interface FinaleOpts {
  /** the stageAdvanced / won event text (else the built-in line) */
  text?: string;
  /** the Hold the pit head (watershed) / city gate (ending) showed before the day that rooted it, 0..100
   *  (the "last gray" the stain surges through). Default 82. */
  fromHold?: number;
  /** force skippable (tests); default = seen before */
  skippable?: boolean;
  /** the Shade start turn (ending summary: turns in the mine / in the town) */
  shadeTurn?: number;
}

export interface FinaleRun {
  readonly id: 'watershed' | 'ending';
  readonly duration: number;        // seconds (watershed 28, ending ≈ 40 + waits on the summary)
  readonly t: number;               // current time in seconds
  readonly finished: boolean;
  readonly skippable: boolean;
  /** resolves when the run hands back: watershed → the play scene resumes; ending → go to the title */
  readonly done: Promise<{ skipped: boolean; pose: CamPose; next: 'play' | 'title' }>;
  /** call once per rAF INSTEAD of the scene's own world.update/render (ctx has the logical 1600×900 transform) */
  frame(ctx: CanvasRenderingContext2D, dt: number): void;
  /** forward input while the run is active; returns true if consumed (it consumes all input) */
  input(e: { type: 'key'; key: string } | { type: 'click'; x: number; y: number }): boolean;
  skip(): void;                     // no-op unless skippable (ending: jumps to the summary)
  seek(t: number): void;            // testing / scrubbing; deterministic for the same state
}

export function runWatershed(host: FinaleHost, state: FinaleState, opts?: FinaleOpts): FinaleRun;
export function runEnding(host: FinaleHost, state: FinaleState, opts?: FinaleOpts): FinaleRun;
export const WATERSHED_SECONDS: number; export const ENDING_SECONDS: number;
```

Additive since builder #1: `FinaleRun.update(dt)` + `FinaleRun.render(ctx)` (= `frame` split in two, for a scene with
separate update/render); `FinaleHost.audio.stinger?(name)` (the AudioEngine's; the ending plays `shadeTop` when the gate
is soaked, falling back to `sfx('victory')`).

## Requests to PLAY-v2 (exact call sites, `src/scenes/play/index.ts`)
```ts
import { runWatershed, runEnding, type FinaleRun, type FinaleHost, type FinaleState } from '../finale';
private finale: FinaleRun | null = null;
private finaleHost(): FinaleHost {
  const t0 = this.now();
  return {
    world: this.world.r, cam: this.world.cam,
    // the view the scene would draw (night, no selection); the run edits a copy each frame
    view: (t) => this.world.build(this.sim, this.shown, this.marks, t0 + t, { rounds: true, night: true, patches: null }),
    hud: { hide: () => { this.root.style.visibility = 'hidden'; this.hintLayer.style.visibility = 'hidden'; },
           show: () => { this.root.style.visibility = ''; this.hintLayer.style.visibility = ''; } },
    audio: this.sc.audio ?? null,                    // AudioEngine: setScene / sfx / stinger
    fx: { shake: (px, s) => this.feel.shake?.(px, s) }, // or omit: the run wobbles the camera itself
    settings: { reduceMotion: settings.get().reduceMotion },
  };
}
const holdBefore = (id: string) => this.preDay?.zones.find((z) => z.id === id)?.hold ?? 82;  // 0..100

// endDay(), replacing the `if (this.pendingStage) { … pullBackPath … }` block (and the setScene/sfx there:
// the run sets the 'watershed' bed at its start and 'shade' at its end):
if (this.pendingStage) {
  this.pendingStage = false;
  this.mode = 'pullback';
  this.finale = runWatershed(this.finaleHost(), this.sim.state() as unknown as FinaleState, { fromHold: holdBefore('minehead') });
  void this.finale.done.then(() => {
    this.finale = null;
    this.userCam = true;                               // the camera stays where the run handed it back
    this.showSummary(text.stage().lines.slice(0, 3));  // or the stand-in lines
  });
  return;
}
// endDay(), the won branch (replacing the goto('ending') for 'won'; defeat unchanged):
if (s.phase === 'won') {
  this.mode = 'over';
  this.finale = runEnding(this.finaleHost(), s as unknown as FinaleState, { fromHold: holdBefore('citygate'), shadeTurn: this.shadeTurn });
  void this.finale.done.then(() => this.sc.goto('title', {}, { transition: 'black', duration: 1.2 }));
  return;
}
// update(dt): first thing after the timers —
if (this.finale) { this.finale.update(dt); return; }   // no world.update / feel / constrain / cam.update while it plays
// render(ctx): first thing —
if (this.finale) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 1600, 900); this.finale.render(ctx); return; }
// onKey(e) / onPointerDown(p): first thing —
if (this.finale) { this.finale.input({ type: 'key', key: e.key }); return; }
if (this.finale) { this.finale.input({ type: 'click', x: p.x, y: p.y }); return; }
// (onPointerMove / onPointerUp / wheel: `if (this.finale) return;`)
```
`shadeTurn` = the turn the watershed ran (store it in the `pendingStage` branch). `FinaleState` is structural: the
sim's `GameState` fits (`zones[].hold` 0..100, `units[].{follower,alive,kind,headcount,at}`, `stats`, `god.level`).
Skippability is automatic ("seen" in localStorage `hg.finale.seen`); the debug hook can force it with `{ skippable: true }`.

## Status
- Round 3 (2026-11-23, from 09:50):
  - [x] Both sequences rewritten over the real renderers (`watershed.ts`, `ending.ts`); FINALE's own city / veins / crystal
        streams deleted (`city.ts`, `veins.ts`, `crystals.ts` removed). New: `spline.ts` (keyed monotone camera moves),
        `words.ts` (WRITING adapter: `text.stage()`, `text.ending()`, the tally with `text.crystalName`/`text.rarity`).
  - [x] Runner: optional `Script.render` (reduce-motion cross-fades), `window.__hgFinale` (e2e).
  - [x] `e2e/finale-shots.cjs` rewritten: the REAL game (`?scene=play`), debug jump state, `debugFinale(kind, true)`,
        deterministic `seek` + `__hg.advance`; strips, hand-over frames + largest frame diff, Void check on the first
        Shade frame. `tests/finale/finale.test.ts` (12 tests) green.
  - [x] run1 (watershed look): grave and pit-head frames read well; fixed after it: the band frame was off-centre (the
        camera followed the cage, so the descent ring showed as a gray arc on one side) → centred on the mouth from
        scale ≈ 4; the hand-back now lands on the play scene's own framing (`poseAll` equivalent) after opening the
        whole map, so PLAY's re-frame on `done` is a no-op.
  - [ ] run2 (both sequences, full strips, hand-over, Void) — queued on lock 1.
  - Requests to P6b written (bigger city, `revealCity`, brighter night lamps) at the end of `handoffs/P6b.md`.

## Evidence
- `screenshots/finale-watershed-{strip,pull,last-mine,band,point,town-opening,town-open,crowds,elites,temple,council,forget,handback}.png`
- `screenshots/finale-ending-{strip,pull,gate,gate-soaked,lift,city,answer,mines,title,summary,to-be-continued}.png`
- numbers: `/tmp/finale/report.json` (run `flock /tmp/hg-pw-1.lock node e2e/finale-shots.cjs all`, ~3 min + queue).

## Requests
- Mine engine (`src/render/mine`): every page that bakes the mine logs Chrome's warning "Multiple readback operations
  using getImageData…" once — a 2D context read back repeatedly without `{ willReadFrequently: true }` (candidates:
  `mine/index.ts:402/1162`, `mine/bake.ts:937/965`, `mine/geometry.ts:142`, `mine/lit.ts:90`, `art/geom.ts:23`).
- Sim (P4): export `MINE_TIERS` with, per tier, a name and its notable grade (`best: RarityId`); FINALE reads tier II's.
- Town engine: animating one block's `hold` while the camera holds still re-renders its ground in visible rectangular
  tile steps (seen at the city gate, ending 7.5 s, before this round's workaround) — tiles should cross-fade.
- World/town: whole-canvas pixels at the same t differ between two seeks (town tiles refine on the wall clock); the finale's
  own timeline is deterministic (harness `timelineHash`). Nothing needed unless a pixel-exact replay is wanted.

## Files touched
- src/scenes/finale/{index,types,host,seq,motion,overlay,city,veins,watershed,ending,dev}.ts, dev/finale.html,
  e2e/finale-shots.cjs, screenshots/finale-*.png, handoffs/FINALE.md, DECISIONS.md (FINALE section)

## Self-grade (builder #2, after run 6/7; evidence above)
- **Watershed 8/10.** One unbroken move (mean frame diff ≤ 3.1/255 on average through 0–16.2 s at 30 fps; worst mean 17/255
  in the first second's glide to the cage, worst 10×10 cell 81 on a beat glide — no cut); crystals ride the cage up the
  shaft, the mine shrinks to one violet point, the whole town opens gray and black around it with the crystals running
  into the smelters and the vault, the god's line, four beats, the dark closes back, hand-back at the pit head. Void exact
  `#000` in all four corners at the point (0 non-black px of 60 000 each); skip works only after the first time.
- **Ending 8/10.** Veins and a violet wash climb the gatehouse; the camera lifts up the road with a stream of crystals
  going on to a city ~5× the town's size, a wave of cold lights with a river and a citadel; the gold light opens and
  turns to look; the title, a run summary, "Everyone starts small. / THE CITY IS NEXT", waits for a click.
- Three worst things a hostile critic would say:
  1. The first second snaps: the glide from the player's view to the cage is quick at mine zoom (mean diff 17/255).
  2. The gate veins read as lightning more than a stain soaking stone; the gatehouse art itself stays dark blue.
  3. The city is a procedural light field (blobby districts, a horseshoe of dark under the citadel); the crowd/Elite
     beats show small figures — the caption carries more than the picture.
- New in run 9 (not mine, seen in `finale-ending-mines.png`): at the far view (scale ≈ 0.035, below ZOOM_MIN) the town
  renderer now draws the ground round the town as visible square tiles (a straight-edged dark-green rectangle at the
  lower left); it was not there in run 6 (`finale-ending-answer.png` then). Request to the town engine / P6b: below
  0.25 the unseen ground must stay `#000` (or fade with no edges). If it persists, FINALE can raise the far view's
  scale (FAR in `city.ts`) — at the cost of a smaller city.
- Frame cost (run 6, load ≈ 8 on 4 cores, flushed): watershed median 38 ms, p95 108 ms; ending median 31 ms, p95 68 ms.
  No blank-canvas control taken this round.

## Next steps
1. When `handoffs/P6b.md` changes (pull-back fit, mid-descent picture), rerun `flock /tmp/hg-pw-1.lock node e2e/finale-shots.cjs all`
   and look at `finale-watershed-{band,point,town-open}.png`.
2. PLAY-v2 wires the call sites above; then a full-run check from the play scene (stageAdvanced → watershed → play; won → ending → title).
3. Polish if time: slower first glide (start 0.4 s later or rho 1.0), crowd/Elite beat closer (needs town close-up > 1.65),
   a blank-canvas frame-time control.
