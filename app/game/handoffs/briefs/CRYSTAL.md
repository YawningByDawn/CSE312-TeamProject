# Brief — CRYSTAL: the crystals themselves (the game's central object)

Handoff/log: `handoffs/CRYSTAL.md`. Dev port 5231 (`dev/crystal.html`). Scratch `/tmp/crystal/`.
Read: `CLAUDE.md`; `handoffs/RULES.md`; `DECISIONS.md` §15 (esp. 15.5, 15.8); `handoffs/ART-REFERENCE.md` and `docs/refs/mine.png` (the crystals in the reference: inked, faceted, lit from inside, purple in the mine); the top of `handoffs/P4.md` ("v3 API contract": `Crystal { id, rarity, seed, rough, lines, effect?, grafts }`, rarity ids, odd-effect ids — code against it; if it is not there yet use the same shape with your own ids behind one mapping table).

The owner: "Each crystal should have random stats. Many rarities and odd effects… Each should be a different, strange shape." "The entire game is about mining." Every crystal the player ever sees is drawn by you, everywhere: in the rock at a strike, in a miner's hand, in a cart, set down at the grave, in the inventory, in a grave socket, on a card as payment, being cut, cracked, grafted, eaten.

## Build (`src/render/crystal/**`)
1. **A seeded shape generator:** from `(seed, rarity, rough, grafts, effect?)` build a crystal as geometry (silhouette + facets + inner structure), not a sprite lookup. Families of form that mix by seed (shards, clusters, plates, twins, geodes, needles, knots, hollow/cage forms, spirals, things that should not be stone); rarer = stranger and more complex, never just bigger or more saturated. Thousands of visibly distinct results; two crystals of the same rarity must be tellable apart at 32 px.
2. **Rough vs cut:** rough = matrix rock clinging, dull skin, the form half-hidden; cut = clean facets, internal light. A crack (tier drop) and a flaw are visible marks. Each graft grows a visible foreign spur in the donor's colour/form. Odd effects each leave a small visible sign (e.g. Echo: a doubled ghost edge).
3. **Six rarity looks** (working names Dull, Clear, Bright, Deep, Royal, Impossible): a colour family and an inner-light behaviour each, readable by colour-blind players through form/sparkle as well as hue; inked outline and shading in the reference's style; sits correctly in the mine's lighting (takes a light direction, casts a small glow on the ground only when asked — no halo at fog edges, Void stays exact `#000`).
4. **Renderers:** `drawCrystal(ctx, crystal, {x, y, size, time, light?, glow?, state?})` for the world (sizes 6–64 px: in rock, in hand, in cart, on the grave, in a socket) and `crystalIcon(crystal, size) → canvas` (cached) for UI tiles and cards (24–160 px); a large inspect view (≥ 320 px) that slowly turns/breathes. States/animations as pure functions of time: idle shimmer, reveal (the dusk offering: rough stone turned to the light), cut (facets shear away), crack, graft growth, shatter (burnt/eaten), socketed pulse.
5. **Performance:** icon generation ≤ 3 ms at 64 px, cached; 60 crystals drawn in the world ≤ 1.5 ms a frame.

## Interface first
Within your first ten tool calls put the exact exports at the top of `handoffs/CRYSTAL.md` (HUD, VFX, FEEL, BEHAV, AMBIENT and the play scene draw every crystal through you; HUD and VFX have small stand-ins behind one function until you land). Additive only afterwards.

## Proof (look at all of it yourself, next to the reference's crystals)
`e2e/crystal-shots.cjs` → `screenshots/crystal-*.png`: a sheet of 20 seeds × 6 rarities cut, the same rough; a 32-px sheet (distinctness); odd-effect signs; graft stages; crack/flaw; each animation as an 8-frame strip; crystals in the mine's light at world sizes; the inspect view. Unit tests: determinism by seed, distinctness metric across 500 seeds per rarity, no NaN geometry, timing. Self-grade per rule 13 against "a shipped indie game where the loot is the star"; do not report below an honest 8.

## Ownership
Yours only: `src/render/crystal/**`, `tests/crystal/**`, `dev/crystal.html`, `e2e/crystal-shots.cjs`, `screenshots/crystal-*.png`, `handoffs/CRYSTAL.md`; append `### CRYSTAL — The crystals` to `DECISIONS.md`. Never run git.
