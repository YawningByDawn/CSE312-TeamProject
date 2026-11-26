# CRYSTAL — the crystals themselves (handoff / log)

Brief: `handoffs/briefs/CRYSTAL.md`. Port 5231 (`dev/crystal.html`). Scratch `/tmp/crystal/`.

## NOTE FOR VFX — round 6 (2026-11-23): the real stone is ready for effects; switch over
Both defects from VFX round 5 are fixed in `src/render/crystal/**` (nothing in `src/render/fx/**` was touched):
1. **`RARITY_LOOK` is violet in every grade** (looks.ts): a violet ladder built from the soul violet at each grade's
   finish — glow brightness rises Dull → Royal, glow saturation Dull → Blazing, core whiteness all the way; Impossible
   is dark ultraviolet glass with a white core (its prismatic edge stays in `gradeAura()` only, never a table colour).
   Additive fields on `RarityLook`: `grade` (0..5), `glints` (stars), `rays` (0,2,4,8,10,12: a burst ray count for
   effects). The old hued tables are `PALETTES` (affinity bases and the magpie effect only). Test:
   `tests/crystal/raritylook.test.ts` (every colour hue 235–300° or saturation < 0.2).
2. **The "dark curved hook"** had three causes in `fxCrystalDrawer`: (a) `state: 'reveal'` drew the ROUGH husk (matte
   gray skin + rock clumps); (b) outside light was 0.55 + 0.45·lit; (c) the base anchor, so `rot` swung the stone
   about its foot and an effect's stone in the air got a ground pool. Seed 11 Bright's form IS a curved segmented arc
   (the same as `crystalIcon({seed: 11, rarity: 'bright'})`) — it is now lit violet with its backlight and glints.
   Now: only `'rough'` draws the husk; light ≥ 0.75; the stone is drawn the way the UI draws it (anchor centre at
   `sy - hp/2`, `rot` about its middle as shape.ts documents, the grade's signs behind it: Bright backlight, Blazing
   rays, Royal orbit + motes, Impossible dark disc with the prismatic edge; no ground pool).
3. **A stone with no `affinity` is the grade's own violet** (was "default affinity by grade": a bare Royal came out
   hunger-orange with a peach ring, a bare Blazing blood-red). Stones that carry an affinity are unchanged
   (`crystal-grades.png` re-shot: max pixel difference 0).

**How to switch (VFX, in `src/render/fx/shape.ts`):** either
- `let themed: boolean | null = null;` (auto: `crystalThemed()` now returns true — checked with tsx) **and** make
  `realCrystal` delegate to the CRYSTAL drawer: `import { fxCrystalDrawer } from '../crystal'` and in `realCrystal`
  replace the `drawRealCrystal(...)` block by `fxCrystalDrawer(g, sx, sy, hp, st, seed, rot, a, lit, state);` —
  your current `realCrystal` calls `drawCrystal` with the base anchor, which draws a ground pool under a stone in the
  air (a big dark ellipse with a prismatic ring under Impossible) and turns it about its foot;
- or simply `setCrystalDrawer(fxCrystalDrawer)` at start-up plus `setCrystalThemed(null)`.
Readers checked: `RARITY_LOOK` — only the crystal harness labels and the `index.ts` re-export (no reader in fx, HUD or
scenes today; VFX's `crystalThemed()` reads `crystalLook`, auto check passes). `LOOKS` — legacy graft donor pieces
(paint.ts `lookOf`), graft seams (marks.ts), the graft anim (anim.ts): now violet. Magpie flecks moved to `PALETTES` (they
are meant to be "every other colour"). Not re-shot: `strips`, `world` (stones without an affinity in them are now
neutral violet). Decision (for DECISIONS §CRYSTAL when the orchestrator merges): a stone without an affinity is drawn in
its grade's own violet, not with a default affinity.
Then re-shoot `vfx-crystal-ab.png` (`Q=…&stand=1` vs default). The stone's glints twinkle on `performance.now()`;
there is no clock parameter in the drawer signature. Proof: `screenshots/crystal-fx-drawer.png` (six grades ×
24/48/96 px through `fxCrystalDrawer` beside `crystalIcon`, two seeds, plus each on a reveal burst; bottom: the
`RARITY_LOOK` swatches) and `screenshots/crystal-fx-before.png` (old fx call · shape.ts realCrystal · new drawer).

## Public interface (binding; additive only) — `import … from '../render/crystal'` (path `src/render/crystal/index.ts`)

```ts
import type { Crystal, RarityId, OddEffectId } from '../../sim/types3';

/** Anything with a seed and a rarity (= grade) can be drawn. A full sim `Crystal` fits as is.
 *  v3.1 (owner ruling §15.10): base × affinity × grade × modifiers × rare effect. */
export type CrystalLike = {
  seed: number;
  rarity: RarityId;            // the GRADE: size, complexity, finish (Dull … Impossible; 'deep' reads "Blazing")
  base?: string;               // form (BASE_IDS, 45; all 35 sim BaseIds map via BASE_ALIAS). Unknown ids map by a stable hash. Default: seeded, weighted.
  affinity?: string;           // spec v2 nine: hunger malice faith fear blood shadow stone echo flame. Unknown ids map by hash. Default (absent): none — the grade's own violet (round 6).
  profaned?: boolean;          // a Flame stone profaned at a chapel: tarnished gold, violet core, defiled veins
  curse?: boolean; facets?: number;   // the sim's own field names (types3 Crystal) are read too: a sim Crystal passes straight in
  mods?: (string | { id: string; tier?: number; curse?: boolean })[];  // each leaves a small visible mark; curses look cursed
  cursed?: boolean;            // shorthand for "has a curse"
  effect?: string | null;      // anomaly / odd effect: its own sign (EFFECT_SIGN for the 22 known; unknown → a generic strange mark)
  oneIn?: number;              // the stone's rarity "1 in N": ≥1e3 motes, ≥1e4 chromatic + orbiting motes, ≥1e5 unlike anything else
  facet?: number;              // times re-cut (town gem workshop): same stone, new geometry, brilliant finish
  parents?: { seed: number; base?: string; affinity?: string }[];   // recombined: the other parent is visibly fused into it
  // legacy, still drawn but not used by the base game any more: rough, grafts, graftFrom, cracked, flawed
  rough?: boolean; grafts?: number; graftFrom?: RarityId[]; cracked?: boolean; flawed?: boolean;
  id?: string; tier?: number; lines?: unknown[];   // ignored
};
export const BASE_IDS: readonly string[];        // see table below
export const AFFINITY_IDS: readonly string[];    // 'stone','faith','echo','blood','hunger','shadow','malice','fear','flame'
export const BASE_ALIAS: Record<string, string>;     // sim id → my base id (filled when SIM's v3.1 ids land)
export const AFFINITY_ALIAS: Record<string, string>; // sim id → my affinity id
export function affinityLook(id: string): RarityLook; // colours for UI frames / VFX by affinity

/** One-shot animations take progress 0..1; loops ('idle', 'socket') take time in seconds. */
export type CrystalAnim = 'idle' | 'reveal' | 'enchant' | 'curse' | 'recombine' | 'facet' | 'jewel' | 'shatter' | 'eat' | 'burn' | 'socket'
  | 'cut' | 'crack' | 'graft';   // legacy
// enchant: progress, the newest mod's mark grows in · curse: the newest (cursed) mark takes it · recombine: pass `parents`, both
// fly together and fuse · facet: from geometry facet-1 to facet · jewel: the stone is set into `jewel.kind` (opts.jewel)

export interface CrystalLight {
  angle?: number;  // radians, screen space, direction FROM the crystal TOWARD the light (default up-left, -2.3)
  level?: number;  // 0..1 how much outside light reaches it (default 0.8); inner light is independent
  warm?: number;   // 0..1 gold-ochre tint of the lit facets (firelight / shrine) (default 0)
}

export interface CrystalDrawOpts {
  x: number; y: number;        // anchor point in ctx space
  size: number;                // px height of the crystal (world: 6..64; works 4..512)
  anchor?: 'base' | 'center';  // default 'base' (x,y = where it sits on the ground / in the cart)
  time?: number;               // seconds; drives idle shimmer and the loops (default 0)
  state?: CrystalAnim;         // default 'idle'
  progress?: number;           // 0..1 for one-shot states
  light?: CrystalLight;
  glow?: number;               // 0..1 small pool of its light on the ground under it; default 0 (none, no halo)
  alpha?: number;              // default 1
  rotate?: number;             // radians, in-plane tilt (e.g. tumbling in a hand / cart)
  flip?: boolean;              // mirror horizontally
  jewel?: JewelKind;           // with state 'jewel' (or to draw the stone in its setting)
}
export type JewelKind = 'ring' | 'amulet' | 'circlet';
/** A crystal in its setting. size = setting height px. worn: figure scale (3..10 px): a metal fleck + its glint. */
export function drawJewel(ctx: CanvasRenderingContext2D, c: CrystalLike, o: { x: number; y: number; size: number; kind: JewelKind; time?: number; light?: CrystalLight; anchor?: 'base' | 'center'; progress?: number }): void;
/** Links between set stones: same affinity = braided flowing light; Flame quarrels (snapping arc) with any other stone near it. Draw after the stones. */
export function drawResonance(ctx: CanvasRenderingContext2D, stones: { x: number; y: number; size: number; crystal: CrystalLike }[], time: number): void;

/** World renderer. Static idle crystals hit a sprite cache (≤ 1.5 ms for 60 a frame); animated states draw live. */
export function drawCrystal(ctx: CanvasRenderingContext2D, c: CrystalLike, o: CrystalDrawOpts): void;

/** UI tiles / cards (24..160 px). Cached per (crystal, size, dpr). Square canvas `size*dpr` px, crystal centred. */
export function crystalIcon(c: CrystalLike, size: number, opts?: { dpr?: number; light?: CrystalLight }): HTMLCanvasElement;

/** Large inspect view (≥ 320 px): slowly turns and breathes; pure function of time. x,y = centre. */
export function drawCrystalInspect(ctx: CanvasRenderingContext2D, c: CrystalLike, o: { x: number; y: number; size: number; time: number; light?: CrystalLight }): void;

/** Colours per rarity for UI frames, VFX glints, ground light. */
export interface RarityLook { name: string; ink: string; dark: string; body: string; light: string; tip: string; core: string; glow: string; sparkle: string; grade?: number; glints?: number; rays?: number }   // round 6: violet ladder; grade/glints/rays additive
export const RARITY_LOOK: Readonly<Record<RarityId, RarityLook>>;
export function rarityOfTier(tier: number): RarityId;

/** What each odd effect looks like on the stone (for the writer / Details text). */
export const EFFECT_SIGN: Readonly<Record<OddEffectId, string>>;

/** Pure geometry (no DOM): the generated form. Used by tests and by anyone who needs the family name. */
export function crystalForm(c: CrystalLike): { family: string; families: string[]; pieces: number; faces: number };

/** Drop-in for VFX's adapter: `setCrystalDrawer(fxCrystalDrawer)` (src/render/fx/shape.ts signature). */
export const fxCrystalDrawer: (g: CanvasRenderingContext2D, sx: number, sy: number, hp: number,
  st: { tier: number }, seed: number, rot: number, a: number, lit: number,
  state?: 'reveal' | 'cut' | 'crack' | 'graft' | 'shatter' | 'socket' | 'rough') => void;

export function clearCrystalCache(): void;
```

Notes for callers
- Rough crystals from the sim have `lines = []`, `effect = null`: pass the `Crystal` straight in.
- `cracked`: the sim stores the dropped rarity; the renderer keeps the original (tier+1) form so a crystal never changes shape when it cracks.
- Use `anchor: 'center'` in UI; `'base'` in the world (in rock, in a hand, in a cart, set down at the grave, in a socket).
- Nothing is ever drawn outside the stone except `glow` (on the ground, only when asked) and the transient shards/sparks of `shatter`/`burn`/`cut`.

## Status (builder #1, handing off)
- [x] M1 generator: 45 bases in five classes, nine affinity looks combined with grade finish, painter, crystalIcon, harness `dev/crystal.html`. Tests green (8/8).
- [x] M2 (re-scoped): marks anchored to the largest visible piece; affinity materials (veins, frost, embers, ghost, hallow, defiled); a mark per mod family; curse mark; 22 effect signs; rarity tail (oneIn ≥1e3 / 1e4 / 1e5). Legacy rough, crack, flaw and graft are kept.
- [x] M3: world sprites with a live pulse and glints. Floating and orbiting forms up to 64 px are baked and bob as one piece. Animations: reveal (scales with oneIn), enchant, curse, recombine, facet, jewel, shatter, eat, burn, socket, plus legacy cut, crack, graft. drawJewel and drawResonance are done. All of them have been shot and looked at (run of 2026-11-23, 33 files, zero console errors).
- [~] M4: perf at machine load ~14: world60 2.5 ms median (p90 6.5), bare 1.3, live per frame 0, icon64 0.8 ms (fresh), cached 0, anim64 1.5. Over the 1.5 ms target: the ground glow costs ~0.7 ms and glints ~0.3. DECISIONS section written. Tests 8/8.

Known faults:
1. Odd-effect signs are still faint or invisible on hollow forms (ring, halo, möbius, knot): they anchor to the largest piece, and on a ring that is one segment. Fix: on forms with a heart mesh, anchor to the heart; otherwise draw the sign at the hull centre, unclipped, small.
2. Perf is over target (above).
3. Jewel settings are serviceable but plain. At figure scale the worn glint is one pixel, which may be too quiet next to CAST's figures.

Files: src/render/crystal/{index,geom,forms,looks,paint,marks,anim,jewel}.ts, src/render/crystal/dev/harness.ts, dev/crystal.html, e2e/crystal-shots.cjs, tests/crystal/forms.test.ts.
Sheets: world, cut, small32, icons, effects, bases (45×9), ladder (grades + mods + curse + profaned), tail (1 in 100 … 100,000), jewelry, resonance, crackflaw, plus legacy rough and grafts.
Shots: `flock /tmp/hg-pw-2.lock env NODE_PATH=/usr/local/lib/node_modules_global node e2e/crystal-shots.cjs all` → screenshots/crystal-*.png, /tmp/crystal/results.json (perf). Filters: `sheets bases ladder`, `strips enchant facet`.

## Next steps (successor)
1. Fault 1 (signs on hollow forms) in marks.ts `mk()`: prefer a mesh with mat 'heart' as the anchor piece when present.
2. Perf: bake the ground glow into the sprite when glow is constant, or draw all glows first in one pass with 'lighter' set once. Skip glints below 14 px. Re-run `perf`.
3. Re-shoot `sheets jewelry resonance` after the ring and quarrel tweak (the ring is more upright now; the quarrel shows a strained thread between snaps). These are not yet re-shot.

## Requests
- **HUD (`src/ui/play/crystal.ts`)**: `crystalIcon({ seed, rarity, … })` drops base, affinity, mods, curse, effect and oneIn, so
  every icon is drawn with a default base/affinity. Pass the sim `Crystal` straight in: `crystalIcon(crystal, size, { dpr })`.
  Also its "six rarity colours gray → ice → jade → sapphire → crimson → gold" break theme §2 (gold = the Flame) — use
  `RARITY_LOOK` / `affinityLook` or the theme `UI` accents.
- **PLAY-WORLD (`src/scenes/play/crystalart.ts`)**: same — pass `{ ...crystal, seed: c.shapeSeed }` (or the sim Crystal) so base,
  affinity, mods, effect and oneIn reach the world; world stones use anchor 'base' (ground pool, Blazing flare, Royal orbit).
- Callers: pass the sim `Crystal` straight in; base, affinity, mods (Mod {id, tier, curse}), curse, effect, oneIn and facets are all read. For a recombined stone, add `parents: [{seed, base, affinity}, …]` if the sim keeps them, so the other parent is drawn fused in.
- SIM: an optional `parents` on recombined crystals (seed, base, affinity of each).

## Status (builder #2, successor — 2026-11-23)
- [x] Files verified whole (tsc clean for crystal paths, tests 8/8).
- [x] Grades at a glance (looks.ts GRADE_PULSE / GRADE_SIGN, paint.ts, index.ts gradeAura / gradeFlare / worldRing / glintsStill):
  motion and star count belong to the grade; accent cut so every stone is violet; per-face lit→shadow gradients; firmer ink;
  Blazing seams burn; icons: Bright backlight · Blazing ray burst · Royal orbit ring (front + back halves) + motes ·
  Impossible dark disc with prismatic edge; world: Blazing core flare · Royal orbit · Impossible shadow pool with prismatic ring.
  Blind sheet (`sheets blind`, `BLIND_SALT=n` reshuffles): icons 18 → 18 → 22 → **24/24**; world 14 → 15 → 19/24 (Clear vs Bright left).
- [x] tests: `tests/crystal/simdata.test.ts` — every sim BaseId/AffinityId maps to a defined form/look; a full sim Crystal
  (mods, curse, effect, oneIn) passes straight in; every body is violet for 9 affinities × 5 grades; grade owns pulse/glints. 13/13.
- [x] `sheets world` is now on the game's mine floor (crop of screenshots/mine-zoom-overseer.png) with wickfolk (theme folk.ts)
  holding stones, plus a mine.png reference inset; the old one is `sheets worldsizes`. Harness waits for the two images.
- STOPPED here by owner §19 ("just get something in place for now"): no refinement rounds.

## Next steps (when visuals reopen)
1. World Clear vs Bright (19/24 blind at 16–22 px): give Bright a visible core dot at world size, or a second resting glint.
2. "1 in N" reveal tiers shared with FEEL `revealTier(grade, oneIn)` — not started; tailLevel() (≥1e3/1e4/1e5) is the hook.
3. Re-shoot `strips` (anims) and `jewelry` against the theme; worn jewelry on a drawFolk figure (helper `folk()` in harness).
4. Perf re-run (`perf`): per-face gradients add cost to bakes only (sprites/icons are cached); not re-measured.

## Self-grade
(see the final report)
