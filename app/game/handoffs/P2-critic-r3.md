# Mine renderer critic r3 (after round 4, the refined vector style): 5/10 — defect list

Evidence images are under `/tmp/p2-critic-r3/` (static build served without HMR; 1600×900). Props, figures, the shrine's set dressing, effects, the Sensed treatment, the Active→Sensed falloff and the far-zoom point were judged at shipped-indie standard. The rock, the floors and the rock→void edges were not.

## How the critic read the reference (`ref_shrine.png`, `ref_rails.png`, `ref_island.png`)
- Rock: chunky **rounded slabs and boulders**; each form has its own gradient (lit top-left face falling into a dark base); **deep black crevices** separate the forms; rubble and pebbles collect where rock meets floor; every floor is wrapped in a thick wall, **three or more boulders deep**.
- Floors: worn dirt in teal-ochre with stone patches, pebbles, tie shadows and torch pools.
- Light: warm pools from each torch and the gold shrine fire, cool teal everywhere else.
- Figures: small relative to the space, which makes the mine feel large.

## Blocking
1. **Rock is a flat polygon mosaic at every zoom** (all areas; `c_z2_kilnshrine.png`, `c_z2_westdrift.png`, `z3_rock.png`, `aff_mag.png`). Walls and islands are Voronoi-like cells, each one or two flat tones with a light "top plane" strip and an outline; a few faint hatch strokes; no gradient inside a form, no crevices, no rubble at the base. Middle islands show as a violet/blue/ochre/teal patchwork. This is the "low-poly / masonry / stained glass" failure.
2. **Floors are flat fills with smudges and thin lines.** heartvein, lowgallery and lift are large bare gray-violet or tan expanses with blurry blotches, faint ruts and control veins (`c_z2_heartvein.png`). Nothing like the reference's pebbles, stone patches or worn texture. The control tint at high control turns whole floors a muddy mauve, so the map's dominant hue is lavender, not teal and ochre (`cmp_full.png`).
3. **Glowing rims and halos at rock→void edges** (`fog_mag1.png` top left, `fog_mag3.png`, `fog_mag4.png`, `fade_mag.png` right). Eastworks east tip, row y=360: luminance 4, 23, 71, **126**, 31 (dark outline), 171 — lamp light is painted outside the rock outline, onto the void. Overseer north wall and the top edge near x≈520: a white halo above the rock. Bunks west and the shrine south-west: a lighter teal lip on a thin teal rim. The warded flag draws a cream glow ring around bunks that spills over the void (`flags_grid.png`). Scanline test (a peak in the first 15 px from black above 1.25 × inner median + 8) hits 12.2 % of boundary scanlines in `full` (3.7 % in `allsensed`). Hotspots: shrine south-west, sump south, bunks/west drift north-west, top edge.
4. **Startup freeze:** one main-thread task of 4.7 s (`mid`) / 6.3 s (`full`) before the first frame; the bake reports 4.6 / 6.1 s, all in that one task. (Orchestrator's note: `src/render/dev/mineHarness.ts` calls the synchronous `createMineRenderer`; the game itself preloads with the sliced path. The harness must use the async path so this is measured honestly — and the total bake grew from ≈ 2.9 s to 4.6–6.1 s in round 4.)

## Major
- **Thin or missing walls:** in places the floor runs to the void with only a few-pixel rock lip (shrine south-west, sump south, bunks west; `fog_mag4.png`). The shrine's west dome is a crisp silhouette: 0 → 57 → 120 luminance within 6 px (`fog_mag3.png`).
- **Render cost on CPU:** median render+flush 60 ms (`mid`) and 111 ms (`full`) at fit zoom, against 21 ms for `allsensed` and 1.1 ms for four full-canvas fills. The renderer's own `lastRenderMs` reports about 10 ms, hiding most of the cost (canvas work is deferred until flush). Full idle frames: median 132 ms, p95 200 ms; pan hitches up to 878 ms; fog fade median 75 / 120 ms.
- **Void zones are not fully black:** in `mid` only 80 % of void-zone pixels ≥ 30 px inside are exactly `#000` (max value 111) — dim rails and rock of the sump and lift show through (`fog_mag2.png`). In `start`, westdrift is void but its rails show gray. (`early`: 88.7 %.)
- **Light painted over void:** the shrine glow spills across the black gap at westdrift (`z3_rock.png`); a full-bright candle cluster sits on the fog gradient beside the shrine (`floatcrystal.png`).
- **Selectable/hover tint is very heavy in `start`:** the default selectable state washes all Sensed areas lavender; hover lifts heartvein to a pale gray mist — the first gameplay view's Sensed areas read light and tinted, not dark and gray (`aff_grid.png`, `start_sensed_crop.png`). (Edges soft, no spill onto void — good.)
- **Cave-in (blocked) is a pile of separately outlined flat teal pebbles** (`flags_grid.png`).
- **Bloom flag is barely distinguishable** from the normal crystal gallery.

## Minor
- Figures are about three times the reference's scale relative to the space.
- Crest shape cues are not readable at default zoom; only colour separates allegiances (`crest_default.png`).
- The whisper thread is thin and faint at default zoom and almost gone by 85 %; convertFail looks nearly the same as whisper at default zoom (`fxgrid_0.png`, `fxgrid_1.png`).
- Purple diamond and eye markers float over heads; these are not order icons (`c_z2_overseer.png`).
- One horizontal track stops dead against the diagonal track with no switch (rail junction).
- The `mid` preset at fit zoom has the shrine blown out (`cmp_presets.png`); the shrine reads as a lit wall, not a cave alcove; its light washes the whole area a flat yellow. The overseer's cold steel-blue is one lamp; the area reads warm-gray.
- Harness: the `zoom=0.3` view is off-centre.

## Measurements worth keeping
- Active vs Sensed mean luminance per area: Active 49–98, Sensed 24–33 (passes; Sensed saturation 0.09).
- Active→Sensed is a smooth organic falloff; mean outward luminance profiles fall monotonically in every preset (no systematic band; the rims are local).
- Console: zero errors and warnings. JS heap 24.8 MB.

## The critic's five changes
1. Rebuild rock as rounded, individually shaded boulder and slab forms: gradient inside each form, lit top-left and dark base, black crevices between forms, rubble and pebbles where rock meets floor. Drop the flat-plane polygon cells entirely, walls and islands.
2. Make every wall at least two or three forms thick everywhere, so a floor never touches the void through a thin rim. Let the rock's own shading fall to `#000`. Never draw light outside the rock outline: clip lamp and ward glows to floor and rock; remove the light lips at eastworks, overseer north, bunks west and shrine south-west.
3. Texture the floors like the reference: worn dirt in teal and ochre, stone patches, pebble scatter, rut and tie shadows, darker margins along the walls, warm torch pools. Make the control tint a creeping presence, not a full-floor mauve wash.
4. Shift the global palette toward the reference's teal-cool base with warm ochre only where torches are. Tone the shrine down to a gold alcove glow within a cave niche (with the boulder-wall treatment), not a fully lit wall.
5. Move the bake off the main thread or split it into chunks, cut per-frame compositing cost (`full` costs 100× a full-canvas fill), and report the real render cost, not `lastRenderMs`.
