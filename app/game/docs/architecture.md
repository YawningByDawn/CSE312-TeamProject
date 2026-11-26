# Hungry God Inc. — the systems map

What the code in `src/` is. Each system below is a folder, and the folder's entry file opens with a comment saying what it owns and what it reads; this page is the map between them. Lines are non-blank, from `node tools/size.cjs`. The import table and the checks that hold it are `contract.md`, Architecture.

## Layers

| Layer | Lines | What it is |
|---|---|---|
| `src/types` | 624 | the contract between the tracks: the state, the actions and events (`index.ts`); the tracks' interfaces, the view model, the save, the atlas manifest, the debug API (`tracks.ts`) |
| `src/content` | 4,954 | the tables the rules read (balance, cards, crystals, gems, world, map, clock, roles, stories, threats, ...), the sound tables, the switches (`flags.ts`) and every player-visible word (`words/`, read with `uiText`) |
| `src/sim` | 5,233 | the rules and the people's lives; headless and deterministic from the seed |
| `src/view` | 4,479 | the world on the canvas (PixiJS): baked sprites placed, frames picked |
| `src/ui` | 2,807 | the DOM interface over the canvas |
| `src/audio` | 332 | the baked sounds, mixed by what is on screen |
| `src/app`, `src/main.ts` | 920 + 55 | the shell that builds the tracks and joins them |

## Systems

| System | Entry | Owns |
|---|---|---|
| `src/sim` | `index.ts` `makeSim` | the run's state and every change to it: `Sim` (create, step, act, legal) and the read-only `Query` |
| `src/sim/world` | `index.ts` `populateWorld`, `stepWorld` | the people's lives, imported by the rules: population, plans by the hour, routes, calendar and weather, the world's events |
| `src/view` | `index.ts` `createView` | the renderer, the layers in order, the camera's transform, picking |
| `src/view/life` | `people.ts`, `fx.ts` | every figure and every effect clip; the grave's hoard |
| `src/view/film` | `films.ts` | each film's length, camera keys and overlays |
| `src/ui` | `index.ts` `createUi` | the interface's layers and anchors, the kit; `hud/` the rest layout's parts, one a file |
| `src/ui/panels` | `index.ts` `mountPanels` | everything that opens over the rest layout |
| `src/app` | `boot.ts` (the page), `pump.ts` | the pump (ticks, the clock's holds, films' time, the camera, the view model), input, save, `window.__hg`, the framework's login |
| `src/app/prof` | `index.ts` | the profiled page (`?prof=1`, F3; `docs/perf.md`) |
| `src/audio` | `index.ts` `createAudio` | the AudioContext, the buses, the cues, beds and ambience |

The baked files every system places, folder by folder: `docs/art-pipeline.md`.

## One frame

`src/main.ts` builds the tracks behind their interfaces (`makeSim()`, `createView`, `createUi(mountPanels(...))`, `createAudio`), hands them to one `Pump`, and runs the one `requestAnimationFrame` loop:

1. `Input.update(dt)`: a held Space skips a film, and the camera eases toward the goal that keys, drags and the wheel set. Clicks and keys become `Intent`s sent to the pump (`Pump.send`) as they happen, the ui's clicks too.
2. `Pump.frame(dt)`: render time advances; a playing film advances and poses the camera (`View.filmPose`); while nothing holds the clock (no title, film, pending choice, or phase other than `live`) and the state's `until` is ahead of its tick, real seconds become whole sim ticks at `PLAY_TPS` (`Sim.step`), each tick's events gathered as the frame's `fresh`; `alpha` is the fraction to the next tick.
3. The pump hands the one view model to `View.frame`, `Ui.frame` and `Audio.frame`, in that order, then clears `fresh`. The view renders only when the camera, the size or a layer changed; the ui writes only what changed; the audio plays the fresh events' cues and mixes beds and ambience.

An action (a card played, a whisper) goes `Intent { kind: 'act' }` → `Pump.act` → `Sim.act`, which refuses with reasons or changes the state and returns its events into the same `fresh`.

## Clocks

- **The sim's tick** (`src/content/clock.ts`): `DAY_TICKS` a day, the run's tick 0 the dusk; time passes only up to `GameState.until` (the night's actions and the dawn's day move it; DECISIONS §118), played at `PLAY_TPS` (the day's span in `DAY_SECONDS`); `TICK_HZ` is a tick's length in the sim's own seconds (the weather's easing); the hour, day, weekday and part of day are `Query` reads of the tick; daylight and the sun's height are `Query.daylight` and `Query.sun`.
- **Render time** `vm.time`: seconds since boot, advanced by the pump every frame. Every animation and the tooltips' delay pick their time from it; nothing reads the wall clock for animation.
- **Film time** `film.t`: advanced by the pump, `?fast=1` eight times faster.
- **Frame time** `vm.dt`: the real seconds of the last frame. The clock's hold and the deal's take count it; no part of the interface reads the wall clock or sets a timer.
- **The wall clock** (`performance.now`) drives the rAF loop's `dt` (`src/main.ts`) and the profiler; the websocket reconnect (`src/app/net.ts`) is the one timer with no frame behind it.
