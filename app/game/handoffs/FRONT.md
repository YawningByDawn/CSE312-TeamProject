# FRONT — title, starting-bonus pick, defeat, pause (handoff / log)

Brief: `handoffs/briefs/FRONT.md`. Port 5229. Scratch `/tmp/front/`.

## Public interface (additive only)

All in `src/scenes/front/` (`index.ts` re-exports). Each scene implements `Scene` from `src/app/scene.ts`;
nothing registers itself (main.ts's glob imports `front/index.ts`, which has no side effects).

```ts
createTitleScene(opts?: { onLeave?(scene, data) }): FrontTitleScene      // 'title'
createBonusScene(opts?: { onLeave?(scene, data); next?: string }): FrontBonusScene  // 'bonus' (next default 'play')
createDefeatScene(opts?: { onLeave?(scene, data) }): FrontDefeatScene    // 'defeat'
mountBonusPick(o: BonusPickOptions): BonusPick   // the pick overlay alone, for a scene that draws its own world
class PauseVeil { k; update(dt, paused: boolean); render(ctx, w = 1600, h = 900) }
autoPause(host: { inRun(): boolean; paused(): boolean; pause(): void }): () => void
defeatFacts(session): DefeatFacts;  causeOf(session): 'starved' | 'temple' | 'council' | 'alone' | 'ground'
OPENING_SPARK = { x: 801.2, y: 356.4 }   // where the cutscene's held first frame draws the god's spark
```

enter() data:
- `title`: none. Begin → `goto('cutscene', { session }, { transition: 'cut' })` after a 2.6 s push into the
  eye that ends on the spark at OPENING_SPARK (the cutscene's first frame). With Skip-the-opening on:
  the camera settles on `whisperStartCamera` and `goto('bonus', { session, world }, { transition: 'cut' })`.
  Continue → `goto(sceneForSession(s), { session, continued: true }, black)`.
- `bonus`: `{ session, world?: { renderer, camera, view, thread } }` (the cutscene payload). First frame is
  identical (no clock step on the first update). On pick: `session.dispatch(chooseBonus)`, card sinks,
  effects emitted on the renderer, then `goto(next = 'play', { session, world, from: 'bonus' }, { transition: 'cut' })`
  with the same world, `view.time` continued. If the session is not in the bonus phase it forwards at once.
- `defeat`: `{ session, backdrop?: { draw(ctx, dt): void; eye?(): {x, y} }, world?: Handover, facts?: Partial<DefeatFacts> }`.
  `backdrop` is preferred (the play scene's own world drawing keeps living while it drains). Without
  either it draws the mine as the run left it. Clears the save.

`BonusPickOptions = { host, offers: {id,name,effect,flavor}[], eye(): {x,y} (logical), pick(id): boolean, done(id), emit?(kind, zoneId), world?(id), sound?(name, gain?, pitch?), fast?, reduceMotion? }`
→ `{ update(dt), render(ctx), key(e): boolean, picked, destroy() }`.

## Requests to PLAY-v2 (the app wiring owner) — exact
1. `src/scenes/play/index.ts` line ~979: replace `registerScene('bonus', () => new PlayScene());` with
   `registerScene('bonus', () => createBonusScene());` and add `import { createBonusScene } from '../front';`.
2. `src/scenes/title/index.ts` line ~306: `registerScene('title', () => createTitleScene());` with
   `import { createTitleScene } from '../front';` (the old `TitleScene` class can stay unused or go).
3. `src/scenes/defeat/index.ts` line ~137: `registerScene('defeat', () => createDefeatScene());` with
   `import { createDefeatScene } from '../front';`.
4. The bonus is chosen on the **session** before `play` starts (`session.state.phase` is then `'play'`,
   `session.state.bonuses[0]` is the kept id). Play's stand-in sim currently drops it
   (`seedUnitsOf` passes `offer: []` when the phase is not `'bonus'`). In `src/scenes/play/sim.ts`:
   ```ts
   function seedUnitsOf(session: Session): { units: unknown[]; offer: string[]; chosen?: string } {
     const st = session.state as unknown as { units?: unknown[]; bonusOffer?: string[]; phase?: string; bonuses?: string[] };
     const chosen = st.bonuses?.[0];
     return { units: st.units ?? [], offer: st.phase === 'bonus' || chosen ? [...(st.bonusOffer ?? [])] : [], chosen };
   }
   export function createPlaySim(session: Session): PlaySim {
     const { units, offer, chosen } = seedUnitsOf(session);
     const sim = new StandinSim(session.seed, units, offer);
     if (chosen && offer.includes(chosen)) sim.dispatch({ type: 'chooseBonus', bonus: chosen } as never);
     return sim;
   }
   ```
   (play's `enter` then sees phase `'play'` and calls `startRun()`; `showBonus()` stays as the fallback.)
5. Optional, for the drain: when the run is lost, `goto('defeat', { session, backdrop: { draw: (ctx) => <draw the world
   exactly as render() does, without HUD>, eye: () => <god's eye on screen, logical> } }, { transition: 'cut' })`
   instead of `{ transition: 'black' }` — the defeat screen then drains your living world to gray and black
   (without `backdrop` it draws the mine as the run left it, which is also fine).
6. The thread: the bonus scene draws the handed thread and retracts it into the eye while the offers rise;
   it hands over `world.thread = { reach: 0, rest: 1 }` (play's `PlayWorld` reads `h.thread`, so nothing pops back).

7. Pause veil (the shell's settings panel is the pause; the veil makes the frozen world sink back while it is open
   and lift in 0.25 s on resume). `src/app/app.ts`: add `import { PauseVeil } from '../scenes/front/pause';`,
   a field `private veil = new PauseVeil();`, and in `draw()` right after `this.resetTransform();` that follows
   `sc.render(ctx)` (line ~514): `this.veil.update(1 / 60, this.paused); this.veil.render(ctx);`
   (drawn under the transition overlay). Then remove nothing else — scenes need no change.
8. Auto-pause. `src/main.ts`, after the app is created: `import { autoPause } from './scenes/front/pause';`
   `autoPause({ inRun: () => ['play', 'bonus'].includes(app.sceneName() ?? ''), paused: () => app.paused, pause: () => app.openSettings() });`
   (tab hidden or window blurred during a run → the settings panel opens; nothing happens on title/defeat/cutscene).

## Status (round 2, successor)
- DONE: compile clean; title still baked; full e2e green (final run 04:5x: 15 layout checks, 32 shots, 4 strips, 0 console errors, flow ok) (layout checks at 1600×900, 1366×768, 1015×240, 640×300,
  zero console errors/warnings); fixes this round:
  - title → opening: a visible ×4.6 push into the eye before the dark closes (was a near-static iris);
  - the shell's corner Settings button is hidden on the title (it sat on the name at 1015×240 / 640×300);
  - pick: the god's thread retracts into the eye while the offers rise; handed on at `reach: 0`;
  - pick: cards/head move clear of the settings button on short layouts (measured); e2e now fails any word/card under it;
  - pick: the stroked "selection ring" replaced by a soft swell of light through the ground;
  - defeat: the cause picture is 1.5× larger (176 u), a soft pool of dark under the words while the gray world shows;
  - e2e: causes reuse one page (no re-bake per cause), mid-drain shots wait for the CSS ink-in; new `flow` segment
    (real opening skipped → pick with the handed world → key 3 → play gets world, bonus, thread at rest).
- Files touched: `src/scenes/front/{title,bonus,defeat,dev}.ts`, `src/scenes/front/title-still.webp`, `e2e/front-shots.cjs`,
  `DECISIONS.md` (FRONT section), `CREDITS.md` (IM Fell row — required by RULES 9), this file.
- Evidence: `screenshots/front-*.png` (title/bonus/defeat × 4 sizes, bonus-hover, bonus-details ×3 sizes, title-early,
  opening-first-frame, defeat-<cause> and defeat-mid-<cause> ×5, pause, resumed, flow-pick, flow-play) and strips
  `front-strip-{title-to-opening,cards-rising,pick,defeat-drain}.png`; `screenshots/front-report.json`.

## Self-grade (round 2): 8 / 10
Worst three a hostile critic would say:
1. The bonus cards are wide HUD-style panels, not cards; the pictures are small line icons (Cruel Delight's is abstract).
   With the re-scope (a hand of cards each night) the card look should be shared with HUD's card component when it exists.
2. The defeat pictures are thin ink line drawings — legible and on-language but not an illustration.
3. Title menu is small and sits bottom-left; nothing on the title moves except the breathing, the embers and the ink-in.
Not mine but visible in my shots: the mine renderer's pale haze on the right of the first gameplay shot; the white
"reveal" bloom when Deep Roots lights the gallery (VFX/renderer).

## Next steps
- Wiring (PLAY-v2): items 1–8 above. Then run `ONLY=title node e2e/front-shots.cjs` against the real app is not needed —
  the dev harness uses the real shell; re-run the whole script after the wiring to refresh the shots.
- If the HUD card component lands: render the offers with it (keep `mountBonusPick`'s motion and API).
