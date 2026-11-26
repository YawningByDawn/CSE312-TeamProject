# THEME — the shared kit (running handoff)

Builder: THEME. Port 5234. Scratch `/tmp/theme/`. Owns `src/render/theme/**`, `tests/theme/**`, `dev/theme.html`,
`e2e/theme-shots.cjs`, `screenshots/theme-*.png`, this file. Binding text: `docs/theme.md`.

## PUBLIC INTERFACE (binding; additive changes only)
Import everything from `src/render/theme` (`index.ts`). Canvas 2D, no dependencies, no allocation-heavy paths
in the per-figure draws (a few small arrays per call at most).

### props.ts — shared props (NEW; owner ruling on cap-trees, DECISIONS §18)
All props are drawn in the town/mine three-quarter top-down view, anchored at the **ground contact point (x, y)**,
`size` in ctx units; detail tier (0 silhouette / 1 mid / 2 full) is picked from the on-screen size via
`ctx.getTransform()` unless `o.tier` is given. Common opts `PropOpts`: `{ seed?, time?, gray?: string|null (Sensed),
dark?: boolean (night: forms kept dim, lights stay), tier?: 0|1|2 }`.
```ts
// Cap-trees — house-sized or bigger. Three separate draws so the canopy can go on a top layer and fade with zoom.
function capAlpha(figurePx: number): number;   // THE shared rule. figurePx = adult figure height on screen (FOLK.H × zoom):
                                               // 1 at ≤16 px, 0 at ≥40 px, smoothstep between (no pop)
interface CapTreeOpts extends PropOpts { species?: 'teal'|'amber'; wind?: number /*0..1, sways the cap only*/ }
function capTreeGeom(x, y, capW, o?): { capX, capY, capRx, capRy, stalkH, stalkW, baseW };  // capW = cap width (≥ a house)
function drawCapTreeStalk(ctx, x, y, capW, o?): void;      // trunk, flared base, roots, undergrowth — y-sort at y with people/buildings;
                                                           // pass o.fade = 1 − capAlpha so a close view shows a trunk that fades upward, not a pole
function drawCapTreeCap(ctx, x, y, capW, alpha, o?): void;  // the canopy; draw on a layer above people and roofs; alpha = capAlpha(figurePx)
function drawCapTreeShade(ctx, x, y, capW, k, o?): void;    // soft cap-shaped shade on the ground (draw with the ground); k = 1 − capAlpha
function drawCapTree(ctx, x, y, capW, o?): void;            // shade + stalk + cap at full alpha (sheets, far views)
function drawCapShrub(ctx, x, y, size, o?): void;           // small undergrowth caps (a cluster of 3–6), size = cluster width
// Lights, beasts, things (size = overall width unless noted)
function drawShardLamp(ctx, x, y, size, o?: PropOpts & { lit?: number; mount?: 'post'|'wall' }): void; // cold white (Council); size = height
function drawBrazier(ctx, x, y, size, o?: PropOpts & { lit?: number }): void;                           // gold (the Flame); size = height
function drawPitBeast(ctx, x, y, size, o?: PropOpts & { pose?: 'walk'|'stand'|'curl'; phase?: number; facing?: 1|-1 }): void; // size = body length
function drawSkitter(ctx, x, y, size, o?: PropOpts & { phase?: number; facing?: 1|-1 }): void;
function drawLampMoth(ctx, x, y, size, o?: PropOpts & { phase?: number }): void;
function drawCart(ctx, x, y, size, o?: PropOpts & { load?: 'empty'|'crystal'|'fuel'|'ore'; facing?: 1|-1 }): void; // shell-and-stalk rail cart
function drawCrystalHeap(ctx, x, y, size, o?): void;       // violet
function drawFuelCakes(ctx, x, y, size, o?): void;
function drawGourd(ctx, x, y, size, o?): void; function drawBasket(...): void; function drawJar(...): void;
function drawClutter(ctx, x, y, size, o?: PropOpts): void;  // a seeded heap of gourds/baskets/jars/cakes for wall bases
function contactShadow(ctx, x, y, rx, ry, a?): void;        // the soft ground shadow every prop uses
function propTone(hex, o: PropOpts): string;               // a colour as Sensed / night would show it
function propTier(ctx, size, t1?, t2?, o?): 0|1|2;          // the tier rule
```
Per-frame use: the cap-tree for one zoom is three calls in three layers —
```ts
const a = capAlpha(FOLK.H * zoom);                          // zoom = screen px per world unit
drawCapTreeShade(g, x, y, w, 1 - a, o);                     // ground layer
drawCapTreeStalk(g, x, y, w, { ...o, fade: 1 - a });         // y-sorted with people and buildings
drawCapTreeCap(g, x, y, w, a, { ...o, wind, time });         // top layer, after roofs and people
```
Cost: a 3-tier cap-tree is ~40 path ops at tier 2, ~10 at tier 0; cache to a sprite per (species, seed, tier) if a
view holds more than ~150 trees.

### How to adopt (per piece)
- **Miner animator / mine people:** `drawFolkHead` (+ `FOLK`, `turnFromLook`, `crownPoint`, `drawWick`, `wickLight`) as now; take shard-lamps, pit beasts on rails, skitters, lamp-moths and carts from `props.ts` instead of local copies.
- **CAST (townspeople):** `drawFolk(ctx, x, y, { h, trade, age, turn, pose, phase, fin, wick, hood, gray, dark, seed })` for every person; `kitOf(trade)` for the kit; wick colour from devotion (`yours` = violet), `hood: true` for Lie low.
- **TOWN-ART / town engine / world composition:** cap-trees by the three-layer recipe above with `capAlpha`; colours from `PAL` + `RAMPS` (`castCream`, `terraceTop`/`terraceFace`, `lane`, `vat`, `shell`, `hide`); `drawClutter` at wall bases; `drawShardLamp` over Council doors, `drawBrazier` at the Temple; `drawMark(ctx, PLACE_MARK[place], …)` on signboards.
- **HUD:** `UI` for accents, `drawMark` for icons at 16–24 px (`ink: UI.text`), `drawFolkHead` for portraits.
- **AMBIENT:** pit beasts (`pose: 'walk'|'stand'|'curl'`, `phase` 0..1 per stride), skitters, lamp-moths round lamps and crystal, carts with `load`, `drawFuelCakes`/`drawGourd`/`drawBasket`/`drawJar`.
- **VFX:** owner colours only from `OWNER` / `PAL.<family>.lit` (violet = you, gold = Flame, cold = Council, red = blood); `wickColour` for any wick-coloured effect.

### palette.ts — the colour code (theme §2). One source of truth.
```ts
type Ramp = { lit: string; mid: string; shadow: string; ink: string };   // '#rrggbb'
type Family = 'violet'|'gold'|'cold'|'teal'|'ochre'|'rust'|'red'|'skin'|'shell'|'hide'|'felt'
            |'cast'|'stone'|'timber'|'dirt'|'rock';
const PAL: Readonly<Record<Family, Ramp>>;     // measured from docs/refs (see REF_SWATCHES), tuned to the code
const INK = '#141a1c';                          // the reference's dark teal-black line
const VOID = '#000000';
const OWNER: { you: string; flame: string; council: string; damp: string; life: string; blood: string; sensed: string }; // the §2 table, one colour each (= PAL.x.mid)
const UI: { violet, violetLit, gold, goldLit, cold, coldLit, red, text, textDim, panel, panelEdge }; // interface accents (HUD)
const REF_SWATCHES: { name: string; src: 'mine'|'town'; hex: string; x: number; y: number }[]; // sampled points
function grayOf(hex: string, k?: number): string;   // Sensed: luminance-preserving gray (k = 0..1 strength, default 1)
function mix(a: string, b: string, t: number): string;
function shade(hex: string, k: number): string;      // k<0 darker toward INK, k>0 lighter toward white
function rgba(hex: string, a: number): string;
function lum(hex: string): number;                    // 0..1 relative luminance (sRGB weights)
// NEW (additive): ramps the town target needs, same Ramp shape
type ExtraRamp = 'capTeal'|'capAmber'|'gill'|'stalk'|'castCream'|'terraceTop'|'terraceFace'|'lane'|'vat'|'beast';
const RAMPS: Readonly<Record<ExtraRamp, Ramp>>;       // e.g. RAMPS.castCream.mid for Council cast walls, RAMPS.lane.mid for lanes
function grayRamp(r: Ramp): Ramp; function rampAt(r: Ramp, k: number): string; function toRgb(hex): [r,g,b]; function fromRgb(r,g,b): string;
```

### folk.ts — the wickfolk (theme §3) at any size, 10 px → 400 px tall
Coordinates: ctx units (any transform). Figures face **+x** at `turn = +π/2`, the camera at `turn = 0`, away at `π`
(`turnFromLook(look)` maps the miner rig's `look` 1 / 0 / −1 to π/2 / 0 / π). Detail drops automatically with the
on-screen size (read from `ctx.getTransform()`): < 14 px figure = silhouette + head + wick dot; < 28 px = no fin rays,
eyes as two dark marks + glints; ≥ 28 px = full; ≥ 120 px = ink texture, mottling, fin rays, finger joints.
```ts
type Devotion = 'flame' | 'pale' | 'yours';
type WickState = 'awake' | 'asleep' | 'afraid' | 'praying' | 'dead';
type FinPose = 'alert' | 'flat' | 'droop' | 'flick';
type Age = 'child' | 'adult' | 'elder';

const FOLK: {             // the rig description, in rig units of a 40-unit-tall ADULT (feet at y=0, up = −y)
  H: 40, headR: 6.6, headRx: 6.3,   // head = a third of the height (diameter 13.2)
  neck: 0.8, torso: 9.6, hipW: 4.2, chestW: 5.0, shoulderW: 5.6,
  thigh: 5.4, shin: 5.0, ankle: 0.9, footL: 4.4, footW: 3.0,   // short legs, broad flat feet
  upperArm: 5.0, forearm: 4.6, hand: 1.7, fingers: 4,
  wick: 2.6, wickW: 1.5,           // the bud: height, width above the crown
  fin: 4.2, finW: 2.6,             // ear-fin length / root width
  eyeRx: 1.25, eyeRy: 1.55, eyeGap: 2.5,   // big, dark, wide-set
};
const AGES: Record<Age, FolkProportions>;   // same keys as FOLK, child: H 24, head = half height; elder: hunched, longer fins, mottled
function folkProportions(age: Age): FolkProportions;

interface WickOpts { devotion: Devotion; spirit: number /*0..1*/; state: WickState; time: number; seed?: number; gray?: string | null }
function wickColour(o: WickOpts): { core: string; glow: string; edge: string; a: number };
function wickIntensity(o: WickOpts): number;          // 0 (out) .. ~1.4 (prayer flare); flickers with time
function drawWick(ctx, x, y, size, o: WickOpts): void; // (x,y) = crown point, size = bud height; draws bud + its small glow
function wickLight(ctx, x, y, radius, o: WickOpts): void; // additive ('lighter') pool of light in the wick colour; call on a light layer

interface HeadOpts {
  R: number;                 // head radius in ctx units (FOLK.headR × your scale)
  turn?: number;             // 0 camera, π/2 profile +x, π back
  tilt?: number;             // radians, + chin down
  age?: Age; seed?: number;  // seed → mottling, fin notch, skin variance
  fin?: FinPose; finK?: number; // pose and 0..1 amount; flick animates from `time`
  eyes?: 'open' | 'half' | 'shut' | 'wide';
  light?: { x: number; y: number } | null;   // direction (unit-ish) to the key light → shading + eyeshine side
  eyeshine?: number;         // 0..1 strength of the glints (1 in the dark next to a light)
  dark?: boolean;            // only eyeshine + wick are visible (night silhouettes): body drawn in near-black
  gray?: string | null;      // Sensed: flat gray (use grayOf) — wick gray too
  wick?: WickOpts | null;    // null = no wick drawn (hooded / helmed draws it under the slot)
  hood?: boolean;            // hood up: fins hidden, wick hidden (Lie low)
  time?: number;
}
function drawFolkHead(ctx, x, y, o: HeadOpts): void;   // head centre at (x,y); fins, eyes, slits, mouth, wick
function drawFins(ctx, x, y, R, pose: FinPose, turn, time, opts?): void; // ear-fins only (if you draw your own head)
function drawEyes(ctx, x, y, R, turn, o): void;        // eyes + eyeshine only (dark-scene pass)
function drawHand(ctx, x, y, size, angle, o?: { grip?: boolean; skin?: string; gray?: string|null }): void; // four fingers
function drawFoot(ctx, x, y, size, facing: 1|-1, o?): void;
function turnFromLook(look: number): number;
function headPoint(...)/crownPoint(R, turn, tilt): { x, y };  // where the wick sits, relative to head centre

// A whole figure (the reference pose set; people renderers may use it directly for still/crowd sprites)
interface FolkOpts {
  h: number;                 // figure height in ctx units (feet at y)
  age?: Age; trade?: string; // any TRADE_KIT id or alias (kitOf)
  turn?: number; pose?: FolkPose; phase?: number;   // pose 'stand'|'walk'|'work'|'kneel'|'pray'|'squat'|'cower'|'sleep'|'dead'|'carry'
  fin?: FinPose; wick?: Partial<WickOpts>; eyes?: HeadOpts['eyes'];
  light?: HeadOpts['light']; eyeshine?: number; dark?: boolean; gray?: string | null;
  hood?: boolean; seed?: number; time?: number;
}
function drawFolk(ctx, x, y, o: FolkOpts): void;
function folkFrame(o: FolkOpts): BodyFrame;          // joints for the pose (rig units ×scale): head, crown, sho, hip, hands, feet

// Dress kit (theme §3): layered draws over a BodyFrame, in this order
type KitPiece = 'wrap'|'apron'|'cape'|'hood'|'goggles'|'wickcap'|'plate'|'helm'|'robe'|'mask'|'brazier'
              |'belt'|'collar'|'waders'|'gloves'|'satchel'|'yoke'|'rack'|'stiffhood'|'cloak'|'sash';
interface TradeKit { id: string; layers: KitPiece[]; tool: ToolId | null; accent: string; body: Family; hand: 'near'|'far'|'two'; note: string }
const TRADE_KIT: Record<string, TradeKit>;   // every trade of theme §3 + every LIVING trade id (src/content/living.ts)
function kitOf(tradeOrRole: string): TradeKit; // aliases: lifthand→winder, trapper→ventman, cook→pitcook, …; unknown → 'townsfolk'
function drawKit(ctx, f: BodyFrame, kit: TradeKit, layer: 'back'|'body'|'head'|'front', o): void;
function drawTool(ctx, tool: ToolId, x, y, size, angle, o?): void; // pick, sieve, rod, adze, prop, goad, ladle, gourds, plumb, …
```

**Additions (2026-11-23, additive; the approved figure is pixel-identical in default use — `tests/theme/figure-regression.test.ts`, `tests/theme/pixels.cjs`):**
```ts
// body.ts — FolkOpts
wick?: Partial<WickOpts> | null;   // NEW: null = no wick at all (no bud, no glow, no crown tint) — for effects that draw the wick themselves
tone?: ToneFn;                     // NEW: colour map for the DRESS — cloth, legs, accent and ink ramps, every kit piece, the held tool.
                                   // Not skin, head or wick. (hex) => hex; alpha kept; absent = unchanged. Put the dress under the mine's light with it.
// kit.ts
type ToneFn = (hex: string) => string;                       // '#rrggbb' in, '#rrggbb' out
function toneCtx(ctx: Ctx, tone: ToneFn): Ctx;               // a view of ctx whose fillStyle / strokeStyle / shadowColor strings and gradient stops pass through `tone` (cached per ctx+map)
function toneTones(T: Tones, tone: ToneFn): Tones;           // tone the body ramps (skin is left alone)
function drawKitPiece(ctx, piece, f, T, kit, L, tone?: ToneFn): void;   // `tone` is new and optional; pass the UN-toned Tones (the piece tones every colour itself)
function drawTool(ctx, tool, x, y, u, angle, o?: { …; tone?: ToneFn }): void;
// kit.ts — the layer lists drawFolk uses (frozen), so other renderers order the same pieces
const KIT_BACK_PIECES: readonly KitPiece[];       // behind the torso: cape cloak rack pack basket yoke hood
const KIT_BODY_PIECES: readonly KitPiece[];       // with the torso: apron plate belt cords collar sash satchel robe waders rags whistle chain bandolier pouch
const KIT_HEAD_BACK_PIECES: readonly KitPiece[];  // behind the head: stiffhood tallhood
const KIT_HEAD_PIECES: readonly KitPiece[];       // on the head, after it, before the wick: goggles wickcap helm mask band scarf circlet
const KIT_FRONT_PIECES: readonly KitPiece[];      // in front of all: brazier
const KIT_LAYERS: { back, body, headBack, head, front };   // the five above as one frozen object, back to front
// Not in a list: `gloves` (drawn with the arms), `hoodup` (turns the head's hood on), `helm-closed` (hides the wick). Held tool: drawTool on the near hand.
```
Notes: a lit piece (the brazier's flame, the shard-lamp) is part of the kit and goes through `tone` too — a map that dims will dim it; pass a map that leaves bright hexes alone if that matters.

### marks.ts — pictogram signs (theme §4) as vector draws, for buildings and the interface
```ts
type MarkId = 'pick'|'cup'|'eye'|'scales'|'flame'|'crystal'|'anvil'|'wheel'|'gourd'|'council'|'flameGlyph'
            |'knotCord'|'notchTally'|'pot'|'needle'|'root'|'beast'|'hand'|'bowl'|'skull';
function drawMark(ctx, id: MarkId, x, y, size, o?: { ink?: string; fill?: string; weight?: number; seed?: number; carved?: boolean }): void;
const MARKS: readonly MarkId[];
const PLACE_MARK: Record<string, MarkId>;  // tally house→scales, tavern→cup, forge→anvil, apothecary→gourd, chapel→flame, …
```

### Sheets
`dev/theme.html?sheet=<name>` (port 5234) + `NODE_PATH=/usr/local/lib/node_modules_global flock /tmp/hg-pw-2.lock node e2e/theme-shots.cjs [names…]`
→ `screenshots/theme-<name>.png`: props, turnaround, lineup, lineup4x, wicks, fins, ages, power, palette (incl. RAMPS and the
materials under the mine light), marks, compare, sizes, dark (heads is an older sheet).

## Status (successor, 2026-11-23; owner §19: "get something in place, no polish rounds")
Done: palette (+RAMPS), folk (head, wick, fins, eyes, hands, feet), body (drawFolk, poses), kit (every trade), marks
(22 pictograms + PLACE_MARK), props (cap-tree 3-layer + capAlpha, shrubs, shard-lamp, brazier, pit beast, skitter,
lamp-moth, cart, crystal heap, fuel-cakes, gourd, basket, jar, clutter), index.ts exports all. tsc clean for theme;
`npx vitest run tests/theme` 25/25. Sheets render with zero console errors.
Known issues / next (polish, when the owner asks for visuals again): cap dome reads a little bun-like at 300 px
(flatter umbrella with more overhang); figure profile fin sits inside the head outline; theme-heads.png is stale;
cap fade at α≈0.4 shows figures through a translucent canopy (by design of the ruling, but a dither/fade pattern
could look better); no sprite cache for cap-trees yet.
