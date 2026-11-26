# Brief — WEATHER: rain, fog, wind, storm, and what they do to the picture

Handoff/log: `handoffs/WEATHER.md`. Dev port 5233 (`dev/weather.html`). Scratch `/tmp/weather/`.
Read: `CLAUDE.md`; `handoffs/RULES.md`; `docs/spec.md` v2.1 §5b (binding), §2, §15; `DECISIONS.md` §16; `handoffs/ART-REFERENCE.md` + `docs/refs/mine.png`, `docs/refs/town.png`; the seams at the tops of `handoffs/P2-r5B.md` (mine renderer `addLayer`, `visibilityAt`, `lightAt`), `handoffs/P6.md` (town renderer layers), `handoffs/P6b.md` (world composition overlays, camera scale), `handoffs/AMBIENT.md` (time of day, smoke, flames, dust — you share a sky state with it; it owns time of day, you own weather), `handoffs/LIVING.md` when it exists (the weather timeline `{ t, kind, strength, windDir }` you render), `handoffs/P3.md` top (audio ambience — list the levels you want fed: rain, wind, thunder).

The owner: "Rain and weather appropriately too." "All the zooms as well." Weather must be seen at every zoom and must look like it belongs to the hand-drawn world, not like a particle demo.

## Build (`src/render/weather/**`)
1. **Kinds:** clear, overcast, drizzle, rain, storm (lightning + thunder timing), fog / mist, wind, cold dawn; smooth transitions driven by a timeline; a wind vector everything agrees on.
2. **Above ground (town, pit head, outskirts):** inked rain streaks with depth layers, splashes on ground and roofs, puddles that form, hold reflections of lit windows and dry out, wet-ground sheen, runoff toward the pit; fog banks that pool in low streets; wind in smoke, banners, washing, grass and dust; lightning that lights the town for a few frames with hard shadows; overcast and storm colour grade; the clear-after-rain look.
3. **In the mine:** no rain underground — the mine *answers* it: seepage and drips quicken, wet walls take a sheen, water creeps up in the lower workings, mist at the shaft foot, the pit-head opening shows the sky's light and rain falling down the shaft.
4. **At far zoom:** cloud shadows crossing the town, a rain curtain as a soft slanted veil with a visible front, fog as low pools, lightning as a flash across the whole picture.
5. **Rules of the picture:** weather is drawn only where the player can see (Active full, Sensed gray and fainter, **nothing over Void — exact `#000`**), never a band at any fog edge, never over the interface; the grave stays readable in any weather.
6. **Interface first** (top of the handoff within ten tool calls): `createWeather()`, `weather.set(timeline | state)`, `weather.attach(renderer | world)` through the documented seams, `weather.update(dt)`, `weather.state` (for AMBIENT, people, audio: wetness, wind, lightning flash 0–1, visibility), quality levels.
7. **Performance:** ≤ 2 ms a frame for rain at 1600×900 in software rendering at the default quality, with a governor.

## Proof (look at all of it)
`e2e/weather-shots.cjs` → `screenshots/weather-*.png`: each kind at close / mine / pit head / town / far zoom, 8-frame strips of rain starting and stopping, a storm, fog rolling in; the real mine and town renderers underneath (not a flat backdrop) once their seams allow; Void check (0 non-black pixels over Void); perf numbers. Self-grade per rule 13; do not report below an honest 8; milestone-sized work.

## Ownership
Yours only: `src/render/weather/**`, `dev/weather.html`, `e2e/weather-shots.cjs`, `screenshots/weather-*.png`, `handoffs/WEATHER.md`; append `### WEATHER` to `DECISIONS.md`. Requests to other owners go in the handoff. Never run git.
