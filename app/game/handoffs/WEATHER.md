# WEATHER — rain, fog, wind, storm, and what they do to the picture — handoff

## LANDED in the live game (2026-11-23, landing round) — read this first
- **Where it is wired:** `src/scenes/play/world.ts` creates the run's ONE Weather (eager import, quality 'medium',
  governor on), `attachWorld(world.r)`, `linkAmbient(amb)` once AMBIENT loads, `onThunder → audio.thunder`,
  `audio.setWeather(state.audio)` each frame (`mixAmbience`). Timeline: LIVING's plan days via `fromLiving` at
  `livingPos(planNow)`; with no plan a seeded stand-in day per Day (`seededDay(seed, n)`, new in `samples.ts`).
  `world.sky` getter; `__hgWeather` on window for e2e. Town: `play/index.ts` passes `sky: this.world.sky` to
  `mountShade` → `shade/index.ts` drives that same Weather (no second one): `fromLiving({dayIndex: turn, slices})` or
  `seededDay`, `update(dt, livingPos(turn, clock | 1.5 at night))`, `audio.setWeather` per frame. (Before: a Continue
  into the town attached TWO weathers — one frozen, with stuck bolts and ~44 ms/frame. Fixed by the eager import.)
- `index.ts`: when a linked AMBIENT stops updating (the town stage never runs it) the weather takes its light from the
  world's `dayT` and pushes its darkening to `town.setSky` itself; the town sky binds on `townReady` if attached early.
- **Proof:** `e2e/weather-live.cjs` (real play scene, saves through the title's Continue: a late Whisper night and the
  watershed, made with `watershedState(3)` / `playRun`), `screenshots/weather-live.png` (6 frames; its town frames
  are from the run before the wind wisps were thickened — rerun `PHASE=town` to refresh).
- **Numbers** (this box, load 6–10 on 4 cores, swiftshader, 1600×900, rain, 'medium', governor off, 300 frames,
  `weather.stats.ms`): pit-head night 0.52 ms mean (p95 0.8), town night 0.54 (p95 0.8), town day 0.45 (p95 0.6).
  Whole frames are 60–80 ms here; skipping all weather saved ~0–18 ms of that (noise is larger than the effect).
- **Correctness:** underground (mine view) storm vs clear: 0 of 45 610 Void px changed, no streaks / bolt in the mine;
  town night / day, pit-head day: 0–182 Void px changed at stride 1 (182 = the town still revealing between frames).
  One full mine Day in a storm with strikes (to the watershed pull-back): 0 console errors; whole run 0 errors.
- `npx vitest run tests/weather` 15/15 (new `live.test.ts`: stand-in days, night hold, strike fades), tsc clean.
- **Left / honest:** rain at the far town zoom (≈0.3) is a few thin streaks — it reads at play zoom (≥1), weakly far
  out. Wind is only wisps + grit (now thicker) plus AMBIENT's smoke/flags; at the far zoom it barely shows. The
  stand-in day odds are a guess (no balance work). Nothing here was compared side by side with `docs/refs/`.

Port 5233 (`dev/weather.html`) · scratch `/tmp/weather/` · owner files: `src/render/weather/**`, `dev/weather.html`,
`e2e/weather-shots.cjs`, `screenshots/weather-*.png`, this file, `### WEATHER` in `DECISIONS.md`.

## Interface (exact; additive only)

```ts
import { createWeather, type Weather, type WeatherKind, type WeatherKey, type WeatherTimeline,
         type WeatherState, type WeatherQuality, WEATHER_KINDS, sampleTimeline } from '../render/weather';

type WeatherKind = 'clear' | 'overcast' | 'drizzle' | 'rain' | 'storm' | 'fog' | 'wind' | 'colddawn';
/** LIVING's shape. t = timeline position (LIVING: day index + fraction of the day, or any unit the caller
 *  also passes to update); kind holds from t until the next key; strength 0..1; windDir radians in world
 *  (town) space, 0 = the wind blows toward +x (east), π/2 = toward +y (south, down the screen).
 *  Optional ramp = how long (timeline units) the change into this key takes (default 0.04). */
interface WeatherKey { t: number; kind: WeatherKind; strength: number; windDir: number; ramp?: number }
type WeatherTimeline = WeatherKey[];

const weather = createWeather({ seed?: number, quality?: WeatherQuality /* 'low'|'medium'|'high', default 'medium' */ });

weather.set(timeline: WeatherTimeline);           // replace the timeline (keys sorted by t)
weather.set(state: { kind: WeatherKind; strength?: number; windDir?: number }); // hold one weather (eases in ~2 s)
weather.at(t: number): void;                      // move the timeline position (e.g. LIVING's day clock); smooth
weather.update(dt: number, t?: number): void;     // once per frame: dt seconds of animation; t = timeline position
weather.state: Readonly<WeatherState>;            // read by AMBIENT, people, audio, FEEL — see below
weather.attachWorld(world: WorldComposite): () => void;   // registers every overlay seam (town + mine); returns detach
weather.attachTown(town: TownRenderer): () => void;       // standalone town (chains into town.layers.*)
weather.attachMine(mine: MineRenderer): () => void;       // standalone mine (mine.addLayer)
weather.linkAmbient(amb: Ambient): () => void;    // one sky: AMBIENT's day.rain/mist/cloud/wind/windX/windY/gust follow
                                                  // this weather; weather reads AMBIENT's clock (day/dawn/dusk/night)
weather.onThunder(fn: (e: { delay: number; strength: number; x: number; y: number }) => void): () => void;
weather.quality: WeatherQuality;                  // settable; a governor lowers it if rain costs > 2 ms
weather.stats: { ms: number; streaks: number; splashes: number; quality: WeatherQuality };
weather.flash(strength?: number, x?: number, y?: number): void;  // force a lightning strike (FEEL, shots)

interface WeatherState {
  kind: WeatherKind;          // dominant kind now
  strength: number;           // of the dominant kind 0..1
  mix: Record<WeatherKind, number>;  // smoothed weights (sum ≈ 1)
  rain: number;               // precipitation 0..1 (drizzle ≈ .25, rain ≈ .65, storm ≈ 1)
  drop: number;               // 0 = fine drizzle … 1 = heavy drops (streak length/weight)
  cloud: number;              // cloud cover 0..1 (cloud shadows, grade)
  dark: number;               // sky darkening 0..1 (overcast / storm grade)
  fog: number;                // fog / mist 0..1
  wind: number;               // 0..1 (gusts included)
  windX: number; windY: number;  // unit wind direction, world space
  gust: number;               // 0..1 now
  wetness: number;            // ground wetness 0..1 — lags rain (wets in ~1 min of rain, dries over several)
  puddles: number;            // 0..1 — lags wetness further
  flood: number;              // mine lower workings water level 0..1 (lags rain by minutes)
  seep: number;               // mine drip rate multiplier 1..4
  cold: number;               // cold-dawn look 0..1
  flash: number;              // lightning light this frame 0..1
  visibility: number;         // 1 clear … ~0.25 thick fog / storm (for watchers, LIVING already owns the rules)
  audio: { rain: number; wind: number; drips: number };   // levels 0..1 for audio.setAmbience
}
```

Seams used (all documented by their owners; no edits to their files):
- world: `world.addOverlay('ground'|'above'|'grade', fn, { inColour: true, layers: ['town'] })` — puddles + wet sheen
  (ground), rain, splashes, fog pools, wind wisps (above), grade + lightning (grade, multiply/soft-light/colour-dodge
  only → Void stays #000); `{ inColour: true, layers: ['mine'] }` for drips, wet walls, flood (× `host.fog().colour`).
  Far-zoom cloud shadows / rain curtain / fog pools ride the same town seams (LOD by `host.scale`).
- mine: `mine.geo` (floor / wall grids) for drip sites, wall sheen and the flood mask; town: `town.plan` (items, lights)
  and `town.geo` (streetDist) for puddle sites, roof splashes and lit-window reflections.

Added (successor, additive): `weather.atmos()` → `{ wet, water, drip, rain }` (MineAtmos; pushed to every attached mine's
`setAtmos` on each `update`/`settle` — the mine draws its own answer), `weather.mineOverlay = false` (true = also draw
WEATHER's own mine marks, post-fog), `weather.hardShadows = false` (lightning's building shadows). `linkAmbient` now goes
through `amb.setWeather` when AMBIENT has it.

Also exported: `weather.rainAt(wx, wy)` (0..1 with the front), `weather.settle()` (jump to the target incl. wetness),
`weather.setLight({ day, dawn, dusk, night })` (when AMBIENT is not linked), `weather.governor` (bool),
`sampleTimelines` (fair / showers / storm / fog in LIVING's shape), `fieldsOf`, `KIND_FIELDS`, `flashEnv`.

Added (perf successor, additive): `weather.level` (read-only: the governor's continuous quality level, 0 low … 1 medium
… 2 high; it eases ~0.6 / s so counts thin drop by drop). `weather.stats.ms` now = sky + town-pass JS per frame.
Behaviour notes: the governor now also watches the frame interval (drops to low when the frame EMA > 21 ms for ~1 s;
back after ~5 s under 17.5 ms); with a town engine that has `setSky`, the weather's darkening goes into
`town.setSky({ cloud })` (max of AMBIENT's and ours, quantised 1/32) instead of a fill of ours; the rain is drawn in
the town's in-colour 'above' seam; `atmos()` values are quantised (wet / rain 1/20, water 1/40, drip 1/8) and the
sheen fades out at the low level.

## Files
`src/render/weather/` — `types.ts` (public types), `model.ts` (pure: kinds → fields, timeline sampling, eased sky,
wetness/puddles/flood, rain front, lightning; unit-tested `tests/weather/model.test.ts`), `sky.ts` (the post-composite
pass on the world's `sky` seam: grade, cloud shadows, rain streaks ×3 depths, splashes, far curtain with a front, wind
wisps + lichen grit, lightning flash/bolt/hard shadows — only black-preserving blends), `town.ts` (in-colour town
pieces: puddles + reflections, wet lamp smears, eave drips, runoff rills, fog banks, lamp halos, rain into the shaft),
`mine.ts` (in-colour mine: drips, wet wall glints, geodesic flood of the Low Gallery + Sump, the shaft column at the lift),
`sprites.ts`, `samples.ts`, `dev/harness.ts`. Dev page `dev/weather.html`; shots `e2e/weather-shots.cjs`.

## Status
- [x] M1 rain / drizzle / wind on the real town (probe shots /tmp/weather/p1, p2): streaks, splashes, puddles, lamp
      smears, eave drips, runoff, slanted cold rain per theme §6
- [~] M2 fog, overcast, storm + lightning (white-violet, hard shadows), timeline transitions — code in, shots running
- [~] M3 mine answer + far-zoom looks — code in, shots running
- [ ] M4 shots, Void check, perf, DECISIONS, self-grade

## Requests
- **AMBIENT:** `weather.linkAmbient(amb)` wraps `amb.update` and, after it, sets `amb.day.rain = 0` and `amb.day.cloud = 0`
  (WEATHER draws rain, its grade and cloud shadows) and `mist / wind / windX / windY / gust` from the weather. It also sets
  `amb.weather = weather.state`. Ask: read `amb.weather` when present (rain for people/activity, wetness for wet looks) and
  skip your own `drawRain` + cloud shadows — then the wrap can go.
- **Audio (P3):** feed `audio.setAmbience({ wind: weather.state.audio.wind })` each frame; please add `rain` (0..1) and
  `drips` (0..1, mine) ambience keys and a `thunder` sfx (strength 0..1, distance) — `weather.onThunder(e => …)` gives
  `{ delay, strength }` at each strike (schedule the thunder `delay` s later).
- **LIVING:** publish the day's timeline as `WeatherKey[]` with t = day index + fraction; the play scene calls
  `weather.set(timeline)` once per day and `weather.update(dt, dayIndex + dayT)` each frame.

## Successor (2026-11-23 07:10) — status
- Picked up: tsc clean for weather files; interface above unchanged. Shots so far only in /tmp/weather/p6.
- Measured (load 10–15, delivered on−off): rain-town +53 ms, storm-street +48, rain-far +65, fog-town +87, rain-mine +50.
  Micro-bench (swiftshader, 1600×900): a full-screen textured blit 5–9 ms, soft-light anything 7–9 ms, gradient fill 7 ms,
  solid multiply/overlay fill ~1.5 ms, 600 hairline strokes ~1.4 ms, 600 filled triangles 5–10 ms, 8 big multiply sprites 23 ms.
  The world's in-colour MINE seams cost a full-screen scratch + 2 void covers + a blit each (×2 seams).
- Doing now (M-perf): grade → solid multiply + solid overlay fills; spatial buffer (clouds/band/front) only at far zoom or
  high quality; streaks/splashes as strokes; fog banks + halos into a ¼-res buffer, one blit; mine pieces post-fog
  (no in-colour seam), flood as multiply body + overlay lip; fog lookups cached per screen cell.

## Successor status (2026-11-23 08:10) — owner §19 bar: "in place", no polishing
Done:
- Perf rework (see DECISIONS ### WEATHER, successor round): rain-town delivered +53 → +16 ms, drizzle-close +6, mine +50 → +9
  (load 15–23; the box was never quiet). Still above the 2 ms brief at load; JS ≤ 1 ms.
- Mine answer via `mine.setAtmos` (weather.atmos()); own mine marks off by default (`mineOverlay`).
- AMBIENT linked through `amb.setWeather` (flash 0 to it). Lightning hard shadows off (`hardShadows`).
- `tests/weather/living.test.ts`: real LIVING `weatherOf` days → timeline (green, with model tests).
- Void check (stride 2): 0 leaks in rain/fog/wind mixed town, colddawn far, storm mine; storm-far flash had 42 px
  (max 50/255) from the far curtain's lit lines crossing into Void → lit lines now need seen > 0.9 at head, middle, tail;
  re-checked 08:09: storm-mixed-far 0 leaks / 90 999 Void px, rain-mixed-town 0 / 62 821. Console clean (p9 with AMBIENT,
  p10 with `WX_AMBIENT=0` because AMBIENT's town.ts was mid-edit: `drawCart is not defined`).
- Shots in `screenshots/weather-*.png` (11): clear/rain/wind/fog/storm-flash town, rain close/far/mine/lift, mixed.
Known issues / next (when visuals resume):
1. Rain over the (now very dark) night town reads faintly; lit-line alpha raised once, no further tuning.
2. Perf under load still +15–25 ms at town zoom in rain (grade fills + streaks); next: fold the uniform tint into
   AMBIENT's grade (request below) and drop the overlay lift when fog = 0.
3. Strips (rain start/stop, storm, fog rolling in) not re-shot this round; `e2e/weather-shots.cjs strips` still works.
Requests:
- **AMBIENT:** multiply `weather.state.dark`'s tint into your grade's multiply field (saves one full-screen fill);
  `amb.setWeather` source gives flash 0 on purpose (WEATHER flashes the world once).
- **PLAY-WORLD:** `const weather = createWeather({ seed }); weather.attachWorld(world); weather.linkAmbient(amb);`
  per day `weather.set(living.day.weather)` (LIVING DayWeather accepted as is), per frame
  `weather.update(dt, livingPos(dayIndex, dayT))` after `amb.update`. Mine renderer needs nothing else (setAtmos is fed).

## Perf successor (2026-11-23 08:15 →) — budget ≤ 3 ms at default quality, governor to 'low' ≤ 1.5 ms
In progress. Plan + state (keep current):
- Bench: `dev/weather` harness gained `__wx.ab / perf / parts` (interleaved A/B blocks, ≥ 300 frames a side, median +
  p95); `e2e/weather-shots.cjs perf2,parts` (scenes: rain-town, storm-street, drizzle-close, rain-far, fog-town,
  rain-mine). Skip keys for profiling: grade clouds curtain streaks splash wind puddles refl smear rills fogbank halo
  eaves shaft atmos.
- Before-source snapshot: /tmp/weather/before-src; new code staged in /tmp/weather/new (sky.ts, town.ts, index.ts)
  until the before-profile run has booted (it reads src at page load).
- Design: dark → town engine's `setSky({ cloud })` (pushed in the linkAmbient wrapper after AMBIENT's own; max of the
  two, quantised 1/32) — no grade fill of ours; cold dawn = 1 solid multiply only when cold > 0.3; rain = one
  color-dodge stroke path per depth layer (black-safe; brighter across lamp pools), 320 strokes cap at medium;
  splashes capped; far curtain ≈ 90 strokes + strokes along the front; cloud shadows 3–5 soft sprites (far, multiply);
  fog = soft sprites straight into the town colour pass under a screen-area budget; halos capped 'lighter';
  puddles at town zoom = one filled path + one lip stroke; governor = continuous level eased 0.6/s (no pop).
