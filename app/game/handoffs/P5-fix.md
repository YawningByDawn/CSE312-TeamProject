# REPORTED — P5-fix (settings on every screen + nothing cut off + hints)

## Shell / settings / layout / hint API (for PLAY-v2)
- **Pause:** the app shell (`src/app/app.ts`) owns the gear (`.hg-gear`, always in `.hg-shell`, top-right of the stage) and the settings panel (`src/ui/settings.ts`). While it is open the shell does not call `scene.update` and freezes transitions — a scene needs nothing to be paused. A scene may open it with `sc.openSettings()` and ask `sc.paused()`. Esc: the shell opens settings unless the scene sets `readonly handlesEscape = true` (then the scene's `onKey` gets Esc: close a hint first, then cancel, then call `sc.openSettings()`). Keys tab: implement `keys(): [string, string][]` on the scene.
- **Settings:** `import { settings } from '../app/settings'` → `settings.get()` (master, music, sfx, muted, muteInBackground, uiScale 90/100/115/130, reduceMotion, brightness 80–130, dawnSpeed normal/fast/skip, showHints, panSpeed, invertZoom, skipOpening), `settings.subscribe((v, changed) => …)` (returns unsubscribe), `settings.onCommand(c => c === 'resetHints' && hints.reset())`. Volumes, mute, brightness, interface size and the `#ui.hg-reduce-motion` class are applied by the shell; scenes apply dawnSpeed (`DAWN_MULT`), panSpeed (`PAN_MULT`), invertZoom, reduceMotion (camera snaps) and showHints themselves. Stored under one key `hg.settings.v1`, every access guarded.
- **Layout:** the stage is a letterboxed 16:9 box inside `#app`'s real box (ResizeObserver + visualViewport). Scenes build their HUD inside `sc.ui` (a `.hg-scene-root` child of `#ui`) with two CSS units: `--su` (px per canvas unit, for positions tied to the picture) and `--u` (HUD unit, for sizes; ≥ 0.9 px so 10-unit text ≥ 9 px; `u(n)` in `src/ui/kit.ts`). Classes on `#ui`: `data-fit` = wide (HUD ≥ 1480 units wide) / mid (1100–1480) / narrow (< 1100); `data-short="1"` (< 640 units tall); `data-tiny="1"` (< 400 tall or < 640 wide: one-row top bar, chips, folded side panels). Live metrics: `window.__hg.app.hud` = `{stage, unit, vw, vh, fit, tiny}`, change callbacks via `app.onLayout` (a Set). Region rule: every HUD panel absolutely positioned inside the scene root; panels below the top bar use the measured `--ws-top`-style variable (set from a ResizeObserver), never fixed px.
- **Hints (reusable, `src/ui/hints.ts`, exported from `src/ui`):** `const hints = new Hints(layerEl); hints.avoid = () => [panels…]; hints.enabled = settings.get().showHints; hints.show(id, title, html, { el, side } | { at: {x,y} })`; `hints.done(id)` when the player does the thing; `hints.dismiss()` on Esc; `hints.place()` on layout change (it also re-places itself every 200 ms while open); `hints.reset()` for "Show hints again". One at a time; a shown id is remembered forever (localStorage `hg.hints.v1`) whatever closed it; labeled "Got it" button `[data-action="hint-got-it"]`; never covers an `avoid` element (yields — hidden, not dismissed — when there is no free spot). Tooltips (`src/ui/tooltip.ts`) now hide when their target is clicked, removed or slides away (the cause of "Got it doesn't disappear").
- **Result:** layout matrix 179/179 checks pass (12 frames × 15 states + the hint run), on a static build of this round's code (logs `/tmp/p5fix/run5.log`, `/tmp/p5fix/run6.log`; thumbnails `/tmp/p5fix/shots/`). Min font ≥ 9 px everywhere (9.5 px in the tiny frames). `tests/settings.test.ts` 9/9.
- **Known issues:** the Whisper scene (`src/scenes/whisper/**`) was removed by PLAY-v2 after the run, so `e2e/layout-check.cjs`'s play steps (selectors `.ws-card`, `.ws-actions`, `.ws-insp`, `[data-action=end-night]`, hooks `__hg.hooks.whisper.*`) and `e2e/whisper-shots.cjs` must be re-pointed to the new play scene; the shell/settings/title/bonus/defeat/cutscene steps and the hint checks (`.hg-hint`, `[data-action=hint-got-it]`) carry over. The tiny-frame play layout lived in whisper CSS and must be re-done by PLAY-v2 against `#ui[data-tiny="1"]`. `npm run smoke`-style `e2e/smoke.cjs` (now also asserts the gear) was not re-run because the live source is mid-rewrite. A stale dev server from the previous builder held port 5204 for most of the round (killed).
- **Self-grade: 8/10** for what survives (shell, settings, layout units, hint component, tooltip fix). Worst things a critic would say: (1) the tiny play layout is gone with the Whisper scene; (2) a hint that yields on a tiny frame may never be seen; (3) the layout check is tied to old play selectors until PLAY-v2 updates it.
- **Checks:** `NODE_PATH=/usr/local/lib/node_modules_global node e2e/layout-check.cjs` (BASE=url of a running server, else starts vite on 5204; ONLY=viewport list or `hints`; SHOTS=1). `tests/settings.test.ts`.

# P5-fix handoff — settings on every screen + nothing cut off

## Done
- Sim API fixes (tsc clean for my files): `sceneForSession` (phase `won` → ending), whisper uses `state.stage === 'shade'` instead of phase `watershed`, narrate/dawn use `surfaceReached` / `stageAdvanced`.
- Settings store `src/app/settings.ts` (key `hg.settings.v1`, sanitized, try/catch, subscribe + commands, `hudUnit`, `fitFor`) + tests `tests/settings.test.ts`.
- Settings panel `src/ui/settings.ts` (tabs Sound / Display / Game / Keys / Run, switches, segmented choices, in-page confirms, focus trap, Esc).
- App shell (`src/app/app.ts`): always-present gear (`.hg-gear`, labeled "Settings" on title/defeat, subtle in the cutscene) in `.hg-shell`; `paused` (no scene update, no transitions) while open; music ducked; settings applied live (volumes, mute, mute-in-background, interface size, reduce motion class, brightness filter); layout from `#app`'s box (ResizeObserver + visualViewport + orientationchange); `--su` (stage unit) and `--u` (HUD unit, floor 0.9 px so text ≥ 9 px); `data-fit` wide/mid/narrow, `data-short`.
- index.html: `#app` is relative inside the root's content box (respects :root padding, iframes).
- Whisper: own gear removed (shell owns it), Esc → `sc.openSettings`, `keys()`, hints anchored to HUD elements and clamped, hints on/off + reset, dawn speed, pan speed, invert zoom, reduce motion (camera snaps, flashes 0.1), responsive CSS (top bar wraps, left column flex, inspector max-height above End Night), compact miracle hand (face always visible; details open upward on hover/focus/selection/first tap).
- Title/defeat/bonus/continued placeholders: stage-relative positions (`--su`), centred, fit-aware.
- `e2e/layout-check.cjs`.

## Done (successor builder, round 2)
- Matrix: added 1015×240 and 640×300; hint overlap checks (hint×card/actions/inspector/left/top, panel×top); hover no longer crashes when covered (logs and forces).
- Measuring on a static build: `npx vite build --outDir /tmp/p5fix/dist` + `npx vite preview --outDir /tmp/p5fix/dist --port 5204` (dev server timed out under load).
- Owner bug "Some of the Got its don't disappear": cause = the hint's X button had a tooltip "Got it"; clicking removed the button, no mouseleave → the "Got it" tooltip stayed on screen. Fixed in `src/ui/tooltip.ts` (rAF watchdog hides a tip whose target is gone/offstage; click hides own tip). Hint now has a plain labeled "Got it" button (`[data-action=hint-got-it]`, no tooltip); every dismissal is remembered (dawn, Esc, doing it, Got it); Esc closes a hint first, always.
- Hints avoid HUD panels (`Hints.avoid`, least-overlap placement).
- Tiny layout: `isTiny()` in settings.ts → `#ui[data-tiny="1"]`; whisper tiny CSS (compact top bar, chip cards with floating details, horizontal actions, goals/chronicle folded behind a "Goals" button `.ws-logbtn`, C toggles it); title column self-fits (ResizeObserver pulls it up) + tiny title CSS.

- Hint e2e (`hintRun` in `e2e/layout-check.cjs`, `ONLY=hints`): PASS — whisper, endnight, orders, miracle reached in play; hunger, suspicion forced; Esc; no returns.
- Tiny frames 640×300 all pass; 1015×240 had hint×inspector/top → candidate-grid placement + Got it moved into the hint header + tiny hint text.
- whisper-shots: `BASE` env (use a running server), `hints.dismiss()`. smoke: asserts the gear is visible inside the stage.
- DECISIONS.md: round-2 bullets appended to `### P5-fix — Settings and layout fit`.

## In progress
- Nothing. Reported.

## Next
- Fix any remaining offenders; run smoke + whisper-shots (BASE=http://127.0.0.1:5204); check the 8 required screenshots exist in /screenshots; final report.

## Requests
- (see final report)
