# PROPS — the shared props, redrawn (running handoff)

Builder: PROPS. Port 5236, lock `flock /tmp/hg-pw-$((5236 % 3)).lock` (= /tmp/hg-pw-0.lock). Scratch `/tmp/props/`.
Owns `src/render/theme/props.ts`, `src/render/theme/props/**`, `dev/props.html`, `e2e/props-shots.cjs`,
`screenshots/props-*.png`, `screenshots/theme-props.png`, this file; `### PROPS` in `DECISIONS.md`; palette.ts ramps (add only).
Owner: "Characters are charming. Props are. NOT EVEN CLOSE." Figures untouched (folk/body/kit).

## PUBLIC INTERFACE (binding; the THEME props.ts contract is kept exactly, additions marked NEW)
Everything stays exported from `src/render/theme` (props.ts). Same names, same signatures, same anchor (ground contact
point x, y), same meaning of `size`, same `PropOpts { seed, time, gray, dark, tier }`, same cap-tree 3-layer split and
`capAlpha` (unchanged numbers). What changes is what they draw, and that each draw now blits a cached sprite.
```ts
// unchanged contract (see handoffs/THEME.md): capAlpha, capTreeGeom, drawCapTreeStalk/Cap/Shade, drawCapTree, drawCapShrub,
// drawShardLamp, drawBrazier, drawPitBeast, drawSkitter, drawLampMoth, drawCart, drawCrystalHeap, drawFuelCakes, drawGourd,
// drawBasket, drawJar, drawClutter, contactShadow, propTone, propTier, PropOpts, PropTier, CapTreeOpts, CapTreeGeom
// NEW (additive):
function drawRail(ctx, x1, y1, x2, y2, o?: PropOpts & { gauge?: number }): void;      // a straight rail piece, ground to ground
function drawCrystalCluster(ctx, x, y, size, o?: PropOpts & { lean?: number; glow?: number }): void; // crystals growing out of rock, glow spill; size = height
function drawFence(ctx, x1, y1, x2, y2, o?: PropOpts & { h?: number }): void;         // pen fence section, posts + 2 rails, h = post height
function drawCrate(ctx, x, y, size, o?): void;                                       // stalk-timber crate, X-braced lid; size = width
function drawDrum(ctx, x, y, size, o?): void;                                        // cast-ware drum (Council issue), seams, stains; size = width
function drawTimberFrame(ctx, x, y, size, o?: PropOpts & { braced?: boolean }): void; // stalk-timber prop frame (2 posts + lintel); size = width
function drawAwning(ctx, x, y, size, o?: PropOpts & { cloth?: 'ochre'|'teal'|'rust'; bare?: boolean }): void; // market stall; size = width
function drawLadder(ctx, x, y, size, o?): void;                                      // leaning stalk-timber ladder; size = height
function drawCordRack(ctx, x, y, size, o?): void;                                    // knot-cord rack (tally records hung on a rail); size = width
function propCacheStats(): { sprites: number; pixels: number; hits: number; misses: number };
function clearPropCache(): void;
// NEW round 7 (light model) — optional on EVERY draw's PropOpts; pass your scene light so props sit in it:
interface PropOpts {
  light?: { dir?: [number, number]; colour?: string; amount?: number }; // key light; dir = on-screen direction FROM the prop
                                    // TOWARD the light ([-1,-1] upper left); colour → nearest of warm gold / cold white / violet
  ambient?: string;                 // shadow-side colour: teal-dark (default), copper (dusk), near-black (night)
  glows?: { colour: string; amount: number; dir?: [number, number] }[];   // nearby emitters (≤ 2 used), dir toward them
  flat?: boolean;                   // true = old flat sprite, no light pass
}
// Defaults with nothing given: warm key from the upper left by day; cold, weaker key at night (o.dark); teal ambient.
// Quantised into the cache key (8 dirs × 3 colours × 2 amounts × 3 ambients [+ emitters]); each distinct light a scene
// uses costs one more copy of the sprites it is used on (a typical scene: 35 sprites ≈ 0.13 Mpx ≈ 0.5 MB per light).
```

## REQUESTS to callers (round 8 — exact; I do not edit these files)
The real renderers mostly do not draw THEME props yet, or draw them without the scene light (proof:
`screenshots/props-real-{pithead,plaza,pens,sorting}.png`). Cap-trees are the only THEME props visible in the town at
street zoom; the mine draws its own crystals, frames and carts (`src/render/art/props.ts`, baked into the prebuilt ground).
1. **Mine dressing (P2-density, `src/render/mine/dressing.ts`)** — use the THEME kit for crystals / frames / crates / carts
   and pass the mine light, then re-bake the prebuilt ground (P2-r5B `scripts/mine-ground-bake.cjs`):
   `import * as K from '../theme/props';`
   - crystals (line ~131): `K.drawCrystalCluster(g, x, y, size, { seed: Math.round(x * 13 + y), lean: o.lean ?? 0, ambient: '#2f5a5e', light: { dir: [-1, -1], colour: '#d6e4f0', amount: 0.3 } });`
   - gallery frames: `K.drawTimberFrame(g, x, y, w, { seed, opening: true, ambient: '#2f5a5e', glows: [{ colour: '#ffa040', amount: 0.9, dir: [torchX > x ? 1 : -1, -0.1] }] });`
   - crates (Sensed areas need nothing: `gray` is applied by the fog pass; else) `K.drawCrate(g, x, y, s, { seed });`
   - crystal carts: `K.drawCart(g, x, y, w, { seed, load: 'crystal', light: { dir: [-1, -0.6], colour: '#ffb050', amount: 0.5 } });`
2. **Town rock (P6, `src/render/town/rock.ts` line ~513)** — add the pit's violet spill:
   `const o = { seed: Math.round(p.x), tier: (lod >= 1 ? 2 : 1) as 0 | 1 | 2, glows: [{ colour: '#a07cf0', amount: 0.5 }] };`
   and at dusk/night pass `ambient: dusk ? '#7a5848' : '#2f4a55'` (the default is the day light: warm key from the upper
   left, teal ambient). Same for `kplaces.ts:65` `drawCart(...)` and `themeprops.ts` cap-trees: `{ ..., dark }` already
   picks the night light; add `ambient` at dusk.
3. **Town market (TOWN-ART)** — the plaza stalls are drawn by the town art, not `drawAwning`; to use the new stalls:
   `drawAwning(g, x, y, w, { seed, cloth: i % 3 === 0 ? 'teal' : 'ochre', bare: !marketDay })` (anchor = front edge centre, w = stall width).

## Reference study (before drawing; crops in `screenshots/props-ref-board.png`)
How the references draw props, in my words:
- **View.** Steep three-quarter top-down. Every box-like thing shows its top face as a big, nearly rectangular plane
  (a crate's lid with an X brace is as tall on screen as its front face; a cart in `town.png` is mostly bed-from-above
  with a thin front strip). Fronts are short. Nothing is a side elevation; nothing has perspective convergence.
- **Line.** One dark teal-black ink (≈ #141a1c) around every form, weight ≈ 3–5 % of the prop's width (1–2 px at
  reference scale), visibly thicker along the bottom and where one part overlaps another, thinner/broken on lit top
  edges. Lines wobble a little; corners are slightly rounded and never perfectly square; planks don't line up.
- **Fill.** Flat 2–3 tones per material with hard edges: top plane lightest, front plane mid, a dark band under rims
  and at the base. No airbrush gradients on objects; the only soft gradient is the light pool and the glow spill.
  Interior marks are few and short: plank seams, a crack, a nail dot, a hatch of 3–5 short strokes in the shadow.
- **Value/colour.** Low-key and muted. Measured: cart front #443836, lit lintel #705d3e, floor #393228, crate #323232
  (sensed), vat wall #676754, fungus teal cap #568775, stalk #8f6535, amber cap #a37838, awning #b1874b. The only
  saturated things are crystals (lavender-white faces #c8b4e0 → violet #8a6cb0 shadow faces) and flames; they tint
  the ground and the nearest surfaces.
- **Crystals.** Long hexagonal prisms with a pointed tip, 3–7 per cluster fanning out from one root, the tallest in
  the middle; each prism split down its length by a facet line into a light left face and a darker right face;
  pale nearly white tips; a soft violet glow on the rock round the root. In carts they stand up proud of the rim.
- **Carts.** A squat open box, slightly wider at the top, dark brown-gray; rim drawn as a lighter band; plank lines on
  the front; wheels only as two dark bumps under the box. On rails they sit nose-to-tail.
- **Timber frames.** Two square posts and a heavy lintel with a lit top face and a front face; ochre-brown in lamp
  light; diagonal braces; planks over gaps; small wall torches beside them.
- **Crates.** Cube from above-front: lid square with an X brace, front with 3 vertical planks, dark outline.
- **Rails.** Two thin pale rail lines with a dark outline each; dark sleepers closely spaced (≈ gauge/2.5 apart).
- **Pens/fences.** Rough posts with two rails, dark brown, uneven; crystal heaps inside glowing.
- **Vats.** Cream cylinder, top ellipse showing teal liquid inside a thick rim; dark pipes elbowing down.
- **Market awnings.** A cloth roof seen from above (sagging trapezoid, ochre or teal), corner poles, a valance edge,
  goods heaped under it in dark tones.
- **Fungus.** Cap seen from above-front: a flattened dome, a light top plane with a highlight blob, a dark underside
  band at the rim (gills hinted), on a short thick ochre stalk; undergrowth = 2–4 small caps of the same.

## Status (keep current)
### Step log
1. DONE reference study (above) + `screenshots/props-ref-board.png` (18 labelled crops; script /tmp/props/board.py).
2. DONE toolkit: `src/render/theme/props/ink.ts` (Rng, wobble, variable-weight ink in 4 buckets, hatch, crack, chip,
   formShade, ground contact shadow, glowAt), `env.ts` (tier/ink width/wobble per draw; KD/KH view constants),
   `tone.ts` (Sensed/night), `cache.ts` (sprite cache, third-octave buckets rounded up, LRU 28 Mpx).
3. DONE (iterating) redraw: `props/things.ts` (cart+loads, rail, crystal prism/cluster/heap, cakes, gourd, basket, jar, sack,
   clutter, crate, drum, timber frame, ladder, cord rack, fence, awning), `props/life.ts` (cap stalk/cap/shade, shrub,
   pit beast, skitter, moth), `props/lights.ts` (shard-lamp tripod/wall, brazier body + 8 flame frames).
   `props.ts` = public wrappers (contract kept; additions listed above). palette.ts: RAMPS wood/woodDark/iron/clay added.
4. Sheets: `dev/props.html?sheet=props|vs|perf`, `src/render/theme/props/sheet.ts`, `vs.ts`; `e2e/props-shots.cjs`
   → `screenshots/props-sheet.png`, `screenshots/props-vs-ref.png`. Lock /tmp/hg-pw-0.lock is heavily queued (~10 min waits).
### Files touched
src/render/theme/props.ts (rewritten), src/render/theme/props/{ink,env,tone,cache,things,life,lights,sheet,vs}.ts,
src/render/theme/palette.ts (+4 ramps), dev/props.html, e2e/props-shots.cjs, screenshots/props-ref-board.png,
screenshots/props-sheet.png, DECISIONS.md (### PROPS), this file. Old props.ts backed up at /tmp/props/props.old.ts.

### Side-by-side rounds (screenshots/props-vs-ref.png; reference crop | originals patched out, ours in place | ours on that ground)
- r1: crystals were thin saturated sticks; caps buns on pale poles; awnings tables side-on; beast a striped barrel;
  drums white tins; heap a flat violet mat. All redrawn.
- r2: crystals chunky + pale lavender (lit #cbbbe0), central big prism + flankers; cart box taller (H .34) with 3–6
  overlapping chunky crystals; rail quieter; shard pokes out of an open horn cradle; caps flat parasols (capRy .42 rx,
  domeH .14–.22 rx), thick gill band, apex knob + glow spot, warm ochre stalks, blunt roots; beast = ribbed isopod
  (plates bowing back, 6 pale legs, feelers, blind); curled beast bands wrap the ball; open market stall on a trestle.
- r3 (running): awning cloth with corner tension folds and sagging edges; drums dun cast-ware; crystal halo lowered.
- r4/r5 (rendered, console clean): awnings read as tent canopies; caps parasol-like; theme-props.png re-rendered.
- r6 (EDITED, NOT YET RENDERED, tsc clean on theme files): life.ts stalkW .29-.34 capW (was .24-.29), baseW .46,
  roots shorter (len bw*.7-1.0) and darker (shadow base, mid/shadow-mix light strip: no light claws); things.ts heap
  mound taller (ry .3S); sheet.ts perf rewritten: rAF frames, alternating props/blank control, reports
  jsMsPerProp / deliveredMsPerProp; willReadFrequently removed; perf sheet now awaited.
### HANDOFF (agent hit the 350k cap here) — exact next steps
1. Render: `cd /home/user/Hungry-God-Inc. && NODE_PATH=/usr/local/lib/node_modules_global flock /tmp/hg-pw-0.lock sh -c
   'timeout 500 node e2e/props-shots.cjs props vs perf; PORT=5236 timeout 300 node e2e/theme-shots.cjs props'`
   (run in background; lock queue ~10 min). Check console clean + PERF JSON (target jsMsPerProp <= 0.05).
   If e2e/props-shots.cjs waits on `__propsPerf` before `__propsReady`, confirm it still works with the async perf sheet.
2. Look at downscaled props-vs-ref.png fungus row: stalk should now be a thick orange-brown cylinder (ref ~.3-.35 cap width).
3. Remaining worst differences: (a) town-ref crystals more saturated blue-violet than our pale lavender (consider a
   'town' tint or nudge crystalRamp mid); (b) big carts at 200px still crate-like (add wheel hubs/axle shadow, flare the box);
   (c) fuel cakes read as coins (make them thicker lumpy bricks, stacked); drums a little clean (more stains/dents).
4. `npx tsc --noEmit`, `npx vitest run tests/theme` (was 39/39), then self-grade here and report via SubagentHandback.
   THEME's propsheet.ts (not owned) does not show the new additions (fence, crate, drum, frame, awning, ladder, cord rack).
### Numbers
- Cache draw cost (perf sheet, 400 mixed props, warm cache, forced readback): median 0.045 ms/prop (runs 0.042–0.063)
  at load avg ~8–12 on the shared box; cold (first stroke) 0.18 ms/prop. 35 sprites / 0.13 Mpx for that scene.
- tsc: whole project 0 errors. `npx vitest run tests/theme`: 39/39. Sheets: console clean.

## SUCCESSOR 2 (round 7: light, crystals, irregularity, awnings, families) — running log
Scratch /tmp/props2/. Orchestrator's verdict on r5: 5.5/10 (no light; crystals wrong in kind; too regular; awnings flat-on;
fungus thin/lonely; too large and crisp).
1. DONE r6 rendered (load 17): console clean; PERF warm jsMsPerProp 0.006, deliveredMsPerProp 0.063 (frame 32.7 ms with
   400 props vs 7.5 control), cold 0.092; 35 sprites / 0.13 Mpx. Shot script works with the async perf sheet.
   r6 stalks still thin-looking at sheet size (fixed in step 5).
2. DONE light model: `props/light.ts` (quantLight, applyLight: multiply grade key→ambient, screen lift, rim inside the
   ink on the lit edge + warmer lit-edge ink, AO toward the ground, emitter spill + coloured rim), `cache.ts` (LitApi
   `layer(g, fn, self?)`; auto one-layer for plain props, `selfLit` for props with emissive parts; ground shadows sink
   under the layer unlit), `env.ts` `onG` (env draws into a layer). Wrappers quantise via kk(). Sheet: `?sheet=light`
   → `screenshots/props-light.png` (7 lights × 2× and play size).
3. DONE crystals: `props/crystal.ts` (crystalRamp, crystal, crystalPile, bloom); cluster/heap/cart self-lit.
4. DONE (partly) irregularity: timber frame = logs (things.ts `log`, `lashing`), cart rewritten, rail sleepers, fence,
   fuel cakes. NOT done: crates/drums/baskets/jars (only seeded as before).
5. DONE awnings (hipped tent in 3/4, patches, goods spilling in front) and cap-trees (stout warm stalk, family at the
   foot via `shroom`, gold-lit gills + glowing spots drawn unlit over a lit cap body, ground glow at the foot).
   Tried shorter stalks (0.64–0.82 capW) — breaks THEME's test `caps are house-sized` (stalkH > 0.75 capW): reverted.
6. DONE proof: `vs.ts` middle column now drawn at the reference's own pixel scale (1:1 canvas, enlarged like the ref
   crop), right column the same at full res; per-case scene light. Play-zoom on the real mine/town renderers NOT done.
### Numbers (round 7, load ~21–27)
- perf (400 mixed props, warm): jsMsPerProp 0.0075–0.0085; deliveredMsPerProp 0.070 / 0.079 / 0.111 over 3 runs
  (frame 35–54 ms vs blank control 7–9 ms; r6 was 0.063 at load 17). Sprites 35, 0.13 Mpx — same as r6: the light pass
  adds nothing per frame (it runs once per cache miss); cold 0.14–0.26 ms/prop (was 0.09: the pass costs on misses).
- `npx tsc --noEmit` clean for src/render/theme; `npx vitest run tests/theme` 39/39; sheets console clean.
### Self-grade r7: 6.5/10 (from the middle column of props-vs-ref.png)
Per pair (what still differs): carts — close in kind now (glowing heap filling the bin, wheels, straps); ours are
bluer and a soft violet haze band sits above them. Cluster — ours more saturated violet than mine.png's pale lavender
prisms, bloom a little big. Timber frames — read as rough log frames; darker and less orange-lit than the ref's
torch-lit fronts. Sensed crates — ours lighter, cleaner, ruler-true (irregularity pass not done on crates). Pens —
crystals read; the heap is a wide fan, the ref's are taller chunkier clusters. Awnings — now tents from above, but darker
and duller than the ref's bright ochre cloth. Fungus — warm stout stalks in families now; ref caps broader with much
brighter gold gills. Cast yard — drums small and plausible; a stranger would not spot them at ref scale.
A stranger would still spot: the crystal colour (cluster), the awning tone, the crates.
### Next steps (exact)
1. Crates/drums/baskets/jars irregularity (sag: per-corner jitter on crate corners, scuffs; drum dents and stains).
2. Crystal colour: pinker-lavender lit faces for the mine (try lit #e2d2f8, mid #b090e0), reduce `bloom` radius ×0.8.
3. Awning cloth brighter (ochre front slope mix toward PAL.hide.lit 0.3), timber frames warmer lit tone under a torch.
4. Gill glow stronger on big caps (alpha 1.0 day) and broader cap (capRx is the contract; widen dome visually instead).
5. Play-zoom proof on the real renderers once they boot; ask TOWN-ART / AMBIENT / mine to pass `light`/`glows`.
### Files touched (r7)
src/render/theme/props.ts, props/{light,crystal,lightsheet}.ts (new), props/{cache,ink,env,things,life,vs,sheet}.ts,
screenshots/props-{light,sheet,vs-ref}.png, DECISIONS.md (### PROPS round 7), this file.

## SUCCESSOR 3 (round 8: crystals, frames, crates, awnings, fungus, haze, cost, real renderers) — running log
Scratch /tmp/props3/ (`shot.sh <sheet…>` = locked render; `sample.py [png]` = theirs/ours colour medians per pair from
props-vs-ref.png's left and middle columns). Start: tsc clean, files intact.
NEW API (additive): `drawTimberFrame(..., { opening?: boolean })` — a deep dark tunnel mouth behind the frame (gallery
entrances). `crystalRamp(o, kind?: 'wall'|'load')` internal.
1. EDITED (not yet rendered): crystal.ts rewritten (milky pale pink-lavender 'wall' ramp, richer 'load' ramp for carts/pens;
   broad blunt prisms, soft violet-gray edge instead of ink, inner milky core, tip bloom; no bloom discs); cluster = 3–5
   chunky prisms; pen heap tall + upright; cart load chunkier. Glows moved to flat ground pools at the foot (carts, heaps,
   clusters); tintAt discs removed; `ground()` contact shadow tightened (no haze disc).
2. EDITED: timber frame = squared chunky beams (post 0.13–0.17 S, lintel 0.12–0.14 S + top plane, end grain, cleats,
   lean ±0.05 S, warm timber ramp), `opening` option. vs.ts passes warm `glows` toward the torches + opening.
3. EDITED: crates (per-corner jitter, sag, planks with gaps, missing slat / lid ajar with straw, stain, scuffs, chalk
   tally, rope), drums (tilt, dent, rust ring), jars (tilt, chipped lip), baskets (tilt, broken strand). Sensed props
   darker: tone.ts gray → mix(grayOf(c), #0e0e0e, 0.22).
4. EDITED: awnings = flat sagging cloth sheet on 4 poles from above-front, bright ochre / soft green, scalloped valance,
   tension folds, patch, a leaning pole, rope guys, back wall with hanging goods, counter heaped with goods.
5. EDITED: fungus — capGeom flatter (capRy .38, domeH .12–.19 rx), stalk shorter (0.78–0.88 capW; THEME test needs
   > 0.75) and thicker (.34–.40); caps' underside painted gold unlit between gill band and dome; bright rim band;
   clump = one behind the trunk + young tree + 1–2 small ones overlapping (tight, mixed sizes); shroom caps flatter
   with gold glowing gills.
6. **Cap-trees handed to FLORA (orchestrator, 14:40).** I no longer edit `props/life.ts` or the cap-tree wrappers in
   `props.ts`. What I changed there this round (all compiling, tsc clean): `capGeom` capRy .42→.38 rx, domeH now
   .32–.42 rx (taller umbrella), stalkH .78–.88 capW (was .78–1.0), stalkW .34–.40 (was .30–.36), baseW .62;
   `capCapBody` returns { dome, under } and draws a pale rim band inside the dome's lower edge; `renderCapCap` paints the
   underside gold UNLIT between gill band and dome (radial, brightest round the stalk top; evenodd clip excludes the
   dome); gill band lipH .5→.3 capRy; `renderCapStalk` clump = one shroom behind the trunk + young tree + 1–2 small ones
   overlapping (h01 keys 51–55); `shroom` shorter/thicker stalk, flatter cap (ry .36, dome .26–.36), gold gill band,
   pale rim stroke. The brazier merge (one blit) is in props.ts but outside the cap-tree functions.
