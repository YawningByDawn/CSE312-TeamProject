# P2 round 5 — requests between 5A (art) and 5B (engine)

Each request: exact, small. Mark `[done]` when served (with the function/file it landed in).

## From 5B to 5A

1. **Cave-in art function.** Please export from `src/render/art/props2.ts` (or `props.ts`) a function
   `drawCaveIn(g: CanvasRenderingContext2D, x: number, y: number, w: number, rng: Rng, fam: StoneColors, gray?: boolean): void`
   that paints a cave-in heap in your new boulder language (rounded, individually shaded boulders, black
   crevices, splintered timber props, rubble skirt), base centre at (x, y), heap about `w` units wide
   (≈ 200), crest reaching about 0.6·w above y, everything inside x±w/2+30, y−0.75·w … y+30.
   5B calls it into a cached 2 px/unit sprite (`blockedSprite` in `mine/index.ts`) and places/sizes it
   at the tunnel mouth. Until it exists 5B keeps the old pebble heap.
   **[done — 5A]** `drawCaveIn(g, x, y, w, rng, fam?, gray?)` in `src/render/art/props2.ts` (wraps
   `drawCaveInHeap` in `art/boulders.ts`). `fam` is ignored (the mine's rock is one teal-gray now). Crest ≈ y − 0.5·w.
2. **Rail junction switch.** In `drawRailJob` / `geo.rails` one horizontal track dead-ends against the
   diagonal track (critic r3, "rail junction"). Please end it in a proper switch (points + frog where it
   meets the diagonal) or a buffer stop clear of the diagonal.
   **[done — 5A]** `layout.ts` RAILS west spur now leaves the loop through a trailing switch (tangent to the
   loop's down-left run, curving away west); the existing switch lever at (900, 770) stands by it.
3. **Albedo alpha = coverage.** 5B's light masks are derived from the albedo's alpha (rock ∪ floor
   coverage, sampled at 4 units/px). Please keep albedo alpha exactly 0 in the void and ≥ 0.98 on rock
   and floor except in the outer feather (as round 4 does). Nothing to change if that already holds.
5. **Engine-side edge sink (FYI).** 5B now darkens the lit layer and the Sensed gray toward #000 over
   36 world units from the void (`SINK_D` in `mine/lit.ts`, from the albedo-alpha coverage), and no
   light of any kind reaches past 6–40 units inside the outline. Your rock fade can stay as it is; if
   the outer boulder band now reads too dark/thin, tell me and I will shorten SINK_D.
6. **Edge test.** `node e2e/mine-edges.cjs` (5B) prints per preset the critic's scanline rim test, split
   into true void/fog boundaries vs black-inside-the-art (black crevices / dark island tops also count
   in the critic's raw test: entering a lit boulder from a black crevice reads as a "peak").
4. **Shrine strength.** 5B now bakes static light into the colour layer and caps the shrine fire at
   ≈ 0.85 of its old strength (gold niche glow). If your palette makes the shrine floor/arch very light
   (albedo luminance > 170), please darken it so the niche does not read as a lit wall.

## From 5A to 5B

1. **Teal-cool ambient.** The map's dominant hue must be teal (critic r3 / brief §3). The albedo is now
   teal (rock `PAL.mineRock`, floors teal-earth, warm earth only round lights), but the mine ambient
   `MINE_AMBIENT = '#7c8494'` (gray-blue) multiplies it toward gray. Please set
   `MINE_AMBIENT = '#6f8b88'` (same luminance ≈ 0.53, hue teal). **[done 5B: index.ts MINE_AMBIENT]** Torches/lamps/shrine stay as they are:
   warm colour must come from the lights only.
2. **Bloom must read at default zoom** (brief §4; `drawBloom` in `mine/index.ts`): today it adds
   0.55–0.8 scale clusters at every second glint. Please (a) draw a bloom cluster at *every* glint of
   the zone at scale 0.8–1.1, (b) add a soft violet floor stain under the whole zone while bloomed
   (`drawGlow(g, anchor, 260, PAL.crystal.glow, 0.22·a, 0, 0.6)` with 'lighter', under the clusters),
   and (c) raise the crystal light ×1.6 → ×2.2 (`lightIntensity` for bloom). Goal: heartvein bloomed
   vs not is obvious in `mine-flags-bloom` at zoom 1.6 *and* at fit zoom. **[done 5B: a cluster beside
   every glint (0.8–1.1), violet stain per chamber via the radius-clamped glow layer, crystal ×2.2
   (baked re-light + per-frame delta)]**
3. **Cave-in:** `drawCaveIn` is ready (see 5B #1); `fam` can be omitted. Sprite size: the heap spans
   x ± (w/2 + 30), y − 0.75·w … y + 30, so a 260×170 sprite at w = 200 fits as before. **[done 5B:
   `blockedSprite` calls drawCaveIn; the colour heap is baked into the lit layer (lit by the lights)]**
4. **Albedo alpha (your #3):** holds — void alpha is exactly 0; rock and floor are 1 except the outer
   rock's last 15 % of its fade, where the colour is already black (the rock darkens to #000 before
   it goes transparent). Note the rock now reaches ≈ 60–150 units beyond the floors (boulder band +
   fade); `rimGridJob` returns that whole extent.

5. **(5A, after ART-REFERENCE.md) Glow beyond south floor edges.** At zoom 2 (`preset=full&focus=overseer&zoom=2`,
   south edge of the overseer floor; also round the shrine floor) a pale teal glow ≈ 20–30 units wide
   sits outside the floor's ink line. The albedo there is now transparent (alpha 0 from ≈ 9 units past
   a south/side floor edge; rock above wall faces keeps a dark margin), so the glow comes from the
   light/composite pass. Please clip every light/soft-light/additive pass to the albedo alpha
   *without blurring the mask outward* (erode rather than dilate), so luminance falls monotonically
   after the ink line.
   **[5B: lit layer is opaque black outside the albedo and every light pass is masked; the teal band below the
   overseer floor at world (1000–1060, 290–320) is in the ALBEDO itself (opaque, with a 4-unit stair-stepped
   edge) — an art fix, still open]**
6. **Warm light must read gold-ochre, never lime** (ART-REFERENCE §5): teal albedo × torch/shrine colour
   multiplies toward olive/lime. Suggest torch `#ffa860` → `#ff9f5a`, shrine `#ffb23a` → `#ffa63e`, and keep
   the soft-light pass from adding green (e.g. desaturate its source 30 %).
   **[done 5B: `lightColor()` mixes fire/lamp light 32 % toward #ff5a1e; soft-light source 45 % desaturated]**

7. **(5A) Shrine niche is blown by the additive light, not the albedo.** After round 5A the shrine's
   albedo is a dark slab niche (arch reveal ≤ L 90, stone steps ≤ L 120, `alb` dump), yet at
   `preset=full&focus=kilnshrine&zoom=2` the arch region (screen 650–790 × 150–330) still measures
   median L 147, p90 240, mean rgb (186,154,82) — unchanged by the albedo change, so it comes from the
   flame/bloom/'lighter' passes. Please cap the shrine's additive glow/bloom so the niche interior's
   median L is ≈ 110–125 (muted gold-ochre, ART-REFERENCE §5), keeping the flame itself bright.
   I lowered the eye light (`dressing.ts`, 0.7 → 0.45) and removed the overseer's east torch (the post
   now reads steel-blue from the Tally lamp, with one warm torch far down the west wall).
   **[done 5B: SHRINE_K 0.55, shrine halo 0.3 → arch median L 122 (was 147)]**

## From people to 5B (P2-people, living people — all in `src/render/mine/index.ts`)

The mine already runs on the new people through the unchanged `People` / `drawGhelm` API. These make it right:

1. **Crest glows → a lamp glint (owner: nothing floats over heads).** In `drawEmissive`, the crest loop draws a
   13–23-unit halo round each head — on a 36-unit figure that reads as a halo. Please replace the loop body with:
   skip `st.being.hidden`; `const c = this.people.headPoint(st)` (new, people.ts; the solved head centre);
   lamp point `= { x: c.x + st.facing * 4.2 * st.look.scale, y: c.y - 3 * st.look.scale }`;
   `drawGlow(g, lamp.x, lamp.y, 7 * st.look.scale, col, a * 0.5 * k, 0.3)` and a core
   `drawGlow(g, lamp.x, lamp.y, 2.2 * st.look.scale, col, a * 0.8, 0.6)` with `col = st.look.paint?.lamp ?? col`.
   Drop the `kind === 'kiln'` / `'tally'` body glows (they were placed for the old creature) — allegiance now shows
   in clothing and lamp colour on the figure itself. Also make `crestPoint(st)` return `this.people.headPoint(st)`.
2. **Planted feet in the sprite cache.** `drawPeople` repaints a person's sprite every ≈ 0.067–0.2 s but blits it at
   `st.x` every frame, so a walker's planted foot slips up to ≈ 2 units between repaints. Please add
   `st.moving ? Math.floor(st.being.anim.dist / 2) : 0` to the sprite `key` (a walker repaints each 2 rig units of
   travel ≈ 8 Hz per 30 u/s… i.e. whenever the pose really changed) **or** simply repaint movers every frame
   (`stale ||= st.moving`). Cost measured in `handoffs/P2-people.md` (Perf).
3. **Sprite box.** `PBOX = { x: -44, y: -78, w: 88, h: 94 }` (× look.scale) can shrink to `{ x: -30, y: -64, w: 66, h: 76 }`
   (rig units; covers carts, picks, lying sleepers, tall hats) — 40 % fewer pixels per repaint.
4. **Light on people (optional).** `People.lightAt?: (x, y) => string | null` is ready: set it to a function returning the
   local light colour (hex, the lightmap's colour at the feet, 1.0 = white) and the figures take that tint
   (cached per quantised colour). Without it they keep their flat tones.
5. **Hidden riders.** `sorted()` already leaves out people with `inLift`; please also skip `st.being.hidden` in the
   emissive loop and in `drawPersonOverlays` (selection ring for a person in the cage is drawn by the lift).

### From people to 5B — round 2 (P2-people builder #2)
6. **Anchored walker blits (replaces #2).** Keep the per-person sprite but, for a mover, blit at the feet position of
   its last repaint instead of `st.x/st.y` (store `e.ax = st.x; e.ay = st.y` when repainting; blit at `e.ax/e.ay`
   while `st.moving`). The body then advances in small steps at the repaint rate and a planted foot never slips;
   the `dist / 2` key term can go (fewer repaints). `LiveSprite` in `src/render/people/sprites.ts` does exactly this
   (plus a tight source rect from the solved joints) and can replace the cache entry wholesale:
   `live.update(st.being.anim, paint, st.x, st.y, st.look.scale, A, time, crestKey)` then
   `live.draw(g, st.x, st.y, st.look.scale, A, st.moving)`.
7. **Readback warning.** The life harness page shows `Canvas2D: Multiple readback operations using getImageData are
   faster with the willReadFrequently attribute` — from the mine's readbacks (`bake.ts:937/965`, `index.ts:402/1162`,
   `lit.ts:90`). Please create those canvases' contexts with `{ willReadFrequently: true }`.
8. **Low detail is automatic.** `drawGhelm` now reads the context transform and draws the low detail level when a
   figure is under ≈ 64 px tall (fewer canvas calls). No change needed; listed so the repaint cost drop is expected.

## From TERRAIN (P2T successor 6) to 5B — adoption (owner ruling DECISIONS §19)
1. **One call to adopt the sculpted rock:** before `preloadMineRenderer(seed)` in the game's mine boot (and, if you
   like, in `mineHarness.ts` for `?ground=terrain`): `setMineGround(terrainMineGround)` with
   `import { terrainMineGround } from '../terrain/mineGround'`. Same contract as your `terrainGround` (light-free
   `form` albedo, void alpha 0, `draws.pools = true`) plus `wallFace` / `floor` on `GROUND_MASK` — your request (2)
   of 06:40 (faces kept out of the edge sink). Nothing else changes on your side. Proven on your real layout and
   harness at `dev/terrain.html?engine=1&<your params>` (numbers in `handoffs/P2-terrain.md`, round 5 log).
2. Your requests of 06:40: (1) `form` stays light-free — yes; (3) shrine niche + pools stay painted by the terrain,
   rails/props/timber stay yours.
