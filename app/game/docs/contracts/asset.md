# Asset contract - agents that make art, props and sound

Assets are judged at shipped quality. Work one asset at a time, take hours not minutes, and compare against `docs/refs/` (`mine.png`; `town-target.png` for the town) until no gap is left.

## Style

- The look, palette and world are `docs/style.md` and `docs/theme.md`; read both. The style page's colour ramps are the only colours. Plain names, nothing floating over heads.
- Every image and sound is made by code that runs offline. No downloaded or hand-made asset files.
- An asset sits on the game's own ground and light: no pasted sheet, no ground pad, no rim or glow at a fog boundary. Void is exact black.
- The view looks down at 45 degrees everywhere (`docs/style.md` 1a): what stands shows a front and a top, what lies is foreshortened. Nothing is drawn in plan.
- Props show real construction (planks with gaps and nails, staves and hoops, lashed joints, patched cloth, chipped stone) and read at 24 px. Buildings are built like real ones (frames, sills, thickness), history shown in damage.

## Making an asset

Each pipeline's folder, command, manifest and placement call: `docs/art-pipeline.md`.

1. **Draw** it with a painter in the pipeline's folder, deterministic from its seed, at the big scale the bake shrinks from.
2. **Register** it where the pipeline lists its assets, so the bake finds it and the manifest keys it.
3. **Bake** it with the pipeline's command into its sheet or pack and manifest; the same painter gives byte-identical files.
4. **Place** it: the game picks a cell by key (id, facing, variant, frame) or plays a sound by name. A new kind of thing also gets its placement data, so something puts it on the map.
5. **Show** it on its `dev/` page and in the game, and prove it (Process).

- A thing with no sheet pipeline (figure, crystal, effect, light) gets a painter, a bake script writing an atlas and manifest in the Props 11 pattern, and a placement call that picks a cell. Never extend a run-time painter.

## Budgets

- A baked sheet or sound pack is judged by its shipped bytes: report the `du -sb` delta of its output folder and of `dist/`. Repeated pieces reuse one drawing.
- A sound is judged by its duration, RMS, peak and spectral centroid: its case in `tests/audio/pin.ts` pins them within 2 %; a deviation goes in `KNOWN` there with its measured size and reason.

## Levels

Every baked picture the view samples is mipmapped, by one scheme (`src/view/pictures.ts`): a PNG or WebP ships level 0 and the GPU halves it; a compressed one (`.bc1`, `.bc3`) ships each level as `<file>@1..@n`, its manifest's `levels` in all. The zoom picks the mip, with no per-feature case.

- Level 0 holds at least the max-zoom density: the mine camera's closest zoom (2.5) times the densest display the view sizes for (devicePixelRatio 2) = 5 texels per mine unit. A shipped level is the page halved, the same layout, so a cell keeps its rect, uv and margin in every level; every offset in a page is a multiple of 8.
- An asset whose painter draws softer than the max-zoom density names it as `bandLimit` in its manifest (texels per mine unit) and holds that density at level 0 instead; a texel past what the painter draws adds nothing (the haze tile at 1, the sheen page at 0.5).
- A table (indices a shader reads by cell, never minified: `assets/sheen/owner.png`) is named in its manifest's `tables` and has no levels.
- A drawn edge (a ring, a stroke, a claw) ramps over one texel of the max-zoom density, so level 0 is as sharp as a canvas edge on the screen it is made for.
- A bake reports its bytes per level and its time.

## Surface

- Paint the light into the drawing: lighter value shapes at the top, crisp highlights on bevelled edges, grime in crevices and at the ground contact, one light direction for every shadow (`docs/style.md` 5).
- Each material reads from its pattern: wood grain and worn edges, faceted chipped stone, rust running from rivets, cloth folds, per-tile roof values with moss. Three or four hard-edged tones per material, a mark on every area (`docs/style.md` 3).
- One pixel scale per piece, drawn at the scale it is shown, never resampled soft; line weight per `docs/style.md` 2.
- No visible seams: ground repeats without a join, a sprite's edge is clean alpha with no fringe, no atlas neighbour bleeds in (zoom the shot to the edge to prove it).

## Process

1. Write 2-3 references and what you take from each.
2. Draw it; check the silhouette at the game's zoom levels, one miner to the whole town.
3. Shoot it in the game and on its `dev/` page (`tools/shot.py --dev`), beside the reference at equal pixel scale. A sound has no page: hear it in the game and read its numbers.
4. List each gap against the reference and this contract, close it, repeat.
5. Review it blind (`docs/workshop.md`, Cards).

## Hand-in

- The shots, the references, and every gap still open.
- A unit test for any contract the piece holds (sizes, determinism, hit boxes, a bake stale against its inputs).
- The card (`docs/workshop.md`, Cards). Visual: the game shot, the dev-page shot and a close-up at each zoom it is read at; `notes` lists the references, the gaps closed, the byte delta and the gaps open. Sound: a playtest card whose `notes` carry the byte delta and fingerprint numbers and whose `steps` say where to hear it.
