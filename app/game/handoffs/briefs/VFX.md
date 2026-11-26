# Brief — VFX: every effect in the world

Handoff/log: `handoffs/VFX.md`. Port **5223**. Scratch `/tmp/vfx/`.
Read: `DECISIONS.md` §14, §13.8 (palette and light of `docs/refs/mine.png`), §13.3; `docs/refs/mine.png` (the violet crystal light and vein look); `src/render/effects.ts` and `src/render/particles.ts` (existing effects — read-only, owned by the mine engine builder); `src/sim/content/` (miracles, bonuses, evil acts — every one needs its own look); `handoffs/P4.md` (v2 events); `handoffs/P6b.md` (world coordinates, `mineToWorld`); `handoffs/briefs/FEEL.md` (it triggers you), `handoffs/briefs/STAIN.md`.

The current effects are a thin thread and a ring. A shipped game has a distinct, satisfying visual for everything the god does and everything the world does back.

## Build `src/render/fx/` — `createFx()`; `fx.spawn(kind, params) → handle`; `fx.update(dt)`; `fx.draw(g, host, layer)`
Host (you define it in `types.ts`): `{ toScreen(wx, wy), scale, time, visibilityAt(wx, wy) }`; layers `'ground' | 'above'`; world units are town units (mine-side positions arrive already converted). Effects must look right from mine close-up to whole-town zoom (a far-zoom form for each important effect: a readable pulse/beacon, never a dot nobody sees).
Effects (each with anticipation, hit, settle; hand-drawn inked style consistent with the art, violet/ink for the god, ochre for lamp-world, steel-blue for the Council, kiln-orange for the Temple):
- **God:** the whisper thread (a living tendril from the grave that searches, finds, coils), heard / turned (colour ripples out across the ground from the person's feet) / refused (the thread frays, ash); prayer wisps drifting to the grave; Nether arriving; Ichor pips; hunger (the grave dims, cracks pulse); eating crystals; level up; Divinity up (a once-per-rank spectacle).
- **Stain:** vein tips racing ahead when Hold grows, a bloom when an area roots, a wither when it recedes, seepage through a passage mouth, the pit head taking colour.
- **Followers' work:** Send route drawn on the ground (inked dashes that march; destination mark), arrival mark, lamp sweep into gray when exploring, discovery reveal (one per discovery kind: cache, seam, loner, shortcut, relic, danger), crystals carried and poured at the grave, spreading the word (small sigils passing between people), lying low.
- **Miracles and evil acts:** one distinct effect each (read the list; design them — tremor, false dawn, sickness, visions, etc.), targeted on an area or a person; terrorize / sacrifice / desecrate must feel wrong and heavy.
- **The world pushing back:** a ward flaring against the stain, a guard noticing (lantern swing, a hard cone), purge fire, the Temple bell's rings, the inquisitor's light, lockdown bars over a block, a crusade at the gate; cave-in dust; follower caught.
- **Turn rhythm:** dusk settling, the dawn bell wave travelling through the mine and up the shaft.
Rules: nothing drawn in Void; no band/rim/halo left at fog edges; nothing floats over heads permanently; capped particle counts; pooled objects; ≤ 1.5 ms per frame for a busy dawn on this machine; reduce-motion variants (no flashes > 10 % luminance step).

## Interface first
Within your first ten tool calls list every effect kind with its params at the top of your handoff (the feel builder and the play scene call them by name). Additive after that.

## Proof
`dev/fx.html` (a gallery: every effect on a mine-like dark teal ground and on the real mine renderer if available, at zoom 3 / 1 / far) + `e2e/fx-shots.cjs`: an 8-frame strip per effect → `screenshots/fx-*.png` and a contact sheet; perf numbers; pixel check that nothing is drawn where `visibilityAt` is void. Look at every strip yourself (downscaled) and fix what looks cheap.

## Ownership
Yours only: `src/render/fx/**`, `dev/fx.html`, `e2e/fx-shots.cjs`, `screenshots/fx-*.png`, `handoffs/VFX.md`. Append `### VFX — Effects` to `DECISIONS.md`.
