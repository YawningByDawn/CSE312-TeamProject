import type { CardId, GameEvent, ViewModel } from '../../types';
import { GRADES } from '../../content/crystals';

// The effects' recipes (#77, #81-89), one clip per event kind, card and grade, as parts of baked life-atlas cells. Sizes are figure heights, times seconds. fx.ts places them.

/** Where a part sits: the event's feet, their wick, the grave, riding from the grave to the feet (back: to the grave). */
export const FEET = 0, CROWN = 1, GRAVE = 2, RIDE = 3, BACK = 4;
export type At = typeof FEET | typeof CROWN | typeof GRAVE | typeof RIDE | typeof BACK;
/**
 * One part: cell (`@gem` the event's stone, a name ending `-` steps through its frames), tint (-1 the grade's ink),
 * where, start s, length s, radius from and to, peak alpha, count, spread, rise (negative: falls from that height), how,
 * turn (rad/s). How: g lies on the ground, b bursts outward from the spread, i draws in to the centre, n blends normally,
 * o stands round a ring at the spread, r stands in a row across it, x drifts across it, s staggers its count over its
 * length, l is a line from the centre (riding: from where it set out) to its point, a alternates its tint with the deep
 * violet, p shares its points with the clip's other p parts.
 */
export type Part = readonly [cell: string, tint: number, at: At, t0: number, dur: number, r0: number, r1: number, a: number, n?: number, spread?: number, rise?: number, how?: string, turn?: number];

/** the old palette (src/render/fx/pal.ts) */
const VIOLET = 0xa274e0, PALE = 0xf6ecff, LIGHT = 0xcfaef0, MID = 0x8a6cb0, DEEP = 0x4a3a63, BODY = 0x312543, BLACK = 0x0c0810;
const GOLD = 0xffd479, FIRE = 0xf0a748, STEEL = 0xeef3ff, BLOOD = 0xa82c20, BLOOD_LIT = 0xe2563f, BLOOD_DEEP = 0x5c1510, GRAY = 0x6c6c6c;
const BONE = 0xe2dccf, DUST = 0x7c6b4f, GRIT = 0x5c625f, ASH = 0x1d2222, SMOKE = 0x181e1f, INK = 0x1d1428, TEAL_DEEP = 0x17302f, LAMP = 0xb89262;
const SICK = 0x7b8770, SICK_INK = 0x0b1716, WHITE = 0xffffff;
/** each grade's light, dull to impossible */
export const GRADE_INK = [0x75678b, 0xb090d3, 0xcfaef0, 0xa274e0, 0xb68ee7, 0xe3d3ed];
/** the alternate tint of an `a` part */
export const ALT = MID;

const SPARK = (tint: number, at: At, t0: number, n: number, spread: number, r = 0.08): Part => ['star4', tint, at, t0, 0.8, r, r * 0.3, 1, n, spread, 0, 'b'];
const MOTES = (tint: number, at: At, t0: number, n: number, rise: number, dur = 1.4, spread = 0.5): Part => ['glow-0.3', tint, at, t0, dur, 0.07, 0.03, 0.85, n, spread, rise, 's'];
const RING = (tint: number, at: At, t0: number, dur: number, r0: number, r1: number, a = 0.9, cell = 'ring-8-1.1', how = 'g'): Part => [cell, tint, at, t0, dur, r0, r1, a, 1, 0, 0, how];
const POOL = (tint: number, at: At, t0: number, dur: number, r: number, a: number): Part => ['glow-0', tint, at, t0, dur, r, r, a, 1, 0, 0, 'g'];
const SHADOW = (at: At, t0: number, dur: number, r: number, a: number, tint = BLACK): Part => ['glow-0', tint, at, t0, dur, r, r, a, 1, 0, 0, 'gn'];
const PUFF = (tint: number, at: At, t0: number, n: number, spread: number, r = 0.25, dur = 0.9): Part => ['puff-0', tint, at, t0, dur, r * 0.5, r, 0.4, n, spread, 0.2, 'bn'];
const COIL: Part[] = [['glow-0.3', VIOLET, RIDE, 0, 0.85, 0.12, 0.08, 0.95, 10, 0, 0, 's'], RING(VIOLET, FEET, 0.85, 0.45, 0.95, 0.45)];
const BELL: Part[] = [0, 0.7, 1.4].map((t) => RING(GOLD, FEET, t, 1.6, 0.6, 8.6, 0.8, 'ring-4-1.1'));

// ---- the cards (miracles.ts, cards.ts, world.ts purge and caveIn, loop.ts followerEvil), each at its target, else the grave

const R = 4;
const terrorize: Part[] = [
  SHADOW(FEET, 0, 2.8, R * 1.5, 0.8), ['claw-0-', INK, FEET, 0.2, 0.6, R * 0.5, R * 0.5, 1, 4, 0.3, 0, 'on'],
  ...[0.22, 0.37].map((t) => RING(BODY, FEET, t, 0.9, R * 0.3, R * 1.1, 1, 'ring-8-2.8', 'gn')),
  POOL(MID, FEET, 0.2, 0.8, R * 0.6, 0.6), SPARK(DEEP, FEET, 0.25, 24, 3), ['soft-3', ASH, FEET, 0.25, 1.6, 0.08, 0.04, 0.8, 18, 1.5, 2.2, 'bn'],
  ['glow-0.3', PALE, CROWN, 0.4, 2.2, 0.1, 0.1, 1, 6, 2.6, 0, 'p'],
];
const sacrifice: Part[] = [
  SHADOW(FEET, 0, 3.4, 4.6, 0.85), RING(DEEP, FEET, 0, 3.4, 1.9, 1.9, 1, 'ring-16-1.8'), RING(BLOOD_DEEP, FEET, 0.4, 3, 1.5, 1.5, 1, 'ring-16-1.1'),
  ['glyph-evil-1.7', BLOOD_LIT, FEET, 0.5, 2.9, 0.17, 0.17, 1, 6, 1.7, 0, 'o'], ['disc', BLOOD_DEEP, FEET, 1.2, 2.2, 0.1, 0.7, 0.9, 1, 0, 0, 'gn'],
  ['beam', BLOOD, FEET, 0.6, 1.2, 0.5, 0.5, 0.25], SHADOW(FEET, 0.6, 1.2, 0.6, 0.5),
  ['gem-c3-0-0', BLOOD_LIT, FEET, 1.4, 1.8, 0.22, 0.22, 1, 3, 0.5, 1.7, 'rs'],
  ['disc', BLOOD, FEET, 1.2, 0.9, 0.06, 0.04, 1, 14, 1.6, 0, 'bn'], ['soft-3', ASH, FEET, 1.2, 1.8, 0.07, 0.04, 0.8, 20, 1.4, 2.6, 'bn'],
];
const desecrate: Part[] = [
  POOL(GOLD, FEET, 0, 1.3, 2.4, 0.6), RING(GOLD, FEET, 0, 1, 1.5, 1.6, 1, 'ring-8-2.8'), ['tongue-0-', GOLD, FEET, 0, 2.4, 0.55, 0.45, 1],
  ['claw-1-', BLACK, FEET, 0.8, 1, 2.6, 2.6, 1, 3, 0.2, 0, 'on'], SHADOW(FEET, 0.9, 2.3, 2.6, 0.7),
  ['star4', GOLD, FEET, 0.9, 0.9, 0.07, 0.03, 1, 18, 2.4, 0.8, 'b'], MOTES(FIRE, FEET, 0.9, 14, 1.4, 1.2, 0.8), ['soft-3', ASH, FEET, 1.4, 1.2, 0.07, 0.04, 0.8, 12, 0.8, 0.4, 'sn'],
];
const falseDawn: Part[] = [
  ['glow-0', LIGHT, FEET, 0, 3.4, R * 0.7, R * 0.7, 0.3, 7, R, 0, 'gr'], RING(PALE, FEET, 0, 3.4, R * 0.5, R * 1.1, 0.8),
  MOTES(LAMP, FEET, 0, 30, 0.9, 1.6, R),
];
const crystalBloom: Part[] = [
  POOL(VIOLET, FEET, 0.2, 2.8, R * 0.8, 0.5), RING(LIGHT, FEET, 0.25, 1, R * 0.2, R * 0.9, 1, 'ring-4-1.8'),
  ['star4', PALE, FEET, 0.3, 1.6, 0.06, 0.03, 1, 16, 2.2, 2, 'b'], PUFF(DUST, FEET, 0.3, 10, 2, 0.3),
  ['gem-c3-1-0', WHITE, FEET, 0.25, 2.75, 0.35, 0.3, 1, 7, R * 0.35, 0, 's'], ['glow-0.3', VIOLET, FEET, 0.25, 2.75, 0.4, 0.3, 0.6, 7, R * 0.35, 0, 's'],
];
const purge: Part[] = [
  SHADOW(FEET, 0.4, 3.2, 3.3, 0.6, SMOKE), POOL(FIRE, FEET, 0, 3.2, 3.6, 0.45), ['tongue-0-', FIRE, FEET, 0, 1.6, 0.6, 0.5, 1, 16, 3, 0, 's'],
  MOTES(FIRE, FEET, 0, 40, 2.2, 1, 3), ['soft-3', ASH, FEET, 0.4, 1.8, 0.07, 0.04, 0.8, 20, 3, 0.8, 'sn'],
];
const sickness: Part[] = [POOL(SICK, FEET, 0, 3, R * 1.1, 0.3), SHADOW(FEET, 0, 3, R, 0.3, SICK_INK), RING(SICK, FEET, 0, 2.8, R * 0.9, R * 0.7, 0.8), MOTES(SICK, FEET, 0, 38, -1, 1.8, R)];
const cart = (n: number, a: number, sabotage: boolean): Part[] => [
  ['cap-1.1', sabotage ? MID : VIOLET, BACK, 0.2, 2.4, 0.08, 0.08, 0.8 * a, 1, 0, 0, 'l'], POOL(VIOLET, FEET, 0, 2, 1.1, 0.35),
  ...[0, 1, 2].map((g) => [`gem-c${g}-${g}-0`, WHITE, BACK, 0.45 + g * 0.12, 1.1, 0.18, 0.18, 1, Math.ceil((n - g) / 3), 0, 0, 's'] as Part),
  ...(sabotage ? [POOL(PALE, FEET, 0.38, 0.22, 0.5, 0.7), ['claw-1-', BLACK, FEET, 0.35, 2.2, 0.6, 0.6, 1, 1, 0, 0, 'n'] as Part, ['star4', DUST, FEET, 0.4, 0.7, 0.05, 0.03, 1, 10, 1.8, 0, 'b'] as Part, PUFF(DUST, FEET, 0.4, 5, 0.6, 0.14, 0.8)] : []),
  RING(LIGHT, GRAVE, 1.4, 1, 0.5, 0.2, 0.8, 'ring-2-1.1'),
];
const follower: Part[] = [SHADOW(FEET, 0, 1.5, 1.3, 0.4), ['claw-1-', BLACK, FEET, 0, 1.5, 1.1, 1.1, 0.8, 1, 0, 0, 'n'], POOL(DEEP, FEET, 0, 0.6, 0.7, 0.8), ['disc', DEEP, FEET, 0, 0.6, 0.04, 0.02, 1, 6, 1, 0, 'bn']];

/** Each card's clip as the old game played it: its own, or its family's (fire, blood, fear, light, growth, sickness). */
export const CARD_CLIPS: Readonly<Record<CardId, readonly Part[]>> = {
  dreamDirective: [
    POOL(MID, FEET, 0, 3.4, R * 1.1, 0.3), ...[0, 0.45, 0.9, 1.35].map((t) => RING(LIGHT, FEET, t, 2.4, R * 0.2, R * 1.1, 0.55)),
    MOTES(PALE, FEET, 0, 26, 0.5, 2, R), ['glow-0.3', PALE, FEET, 0.3, 2.2, 0.15, 0.1, 1, 5, R * 0.8, 2.8, 's'],
  ],
  blessTheirBodies: [
    POOL(LIGHT, FEET, 0.2, 2.8, R, 0.28), RING(PALE, FEET, 0, 2.8, R * 0.6, R, 1, 'ring-4-1.1'), ['glow-0', VIOLET, FEET, 0.3, 2.5, 0.9, 0.9, 0.4, 4, R * 0.75, 0, 'gp'],
    ['beam', PALE, FEET, 0.3, 2.3, 0.3, 0.3, 0.5, 4, R * 0.75, 0, 'p'], MOTES(LAMP, FEET, 0.4, 18, 1.6, 1.5, R * 0.85), MOTES(PALE, FEET, 0.4, 18, 1.6, 1.5, R * 0.85),
  ],
  veinSight: [
    ['ray', PALE, FEET, 0.4, 2.7, R * 1.3, R * 1.3, 0.5, 12, 0, 0, 'o'], RING(LIGHT, FEET, 0.4, 1.8, 0.2, R * 2.6, 1, 'ring-16-0.7'),
    ['star4', LIGHT, FEET, 1.2, 1.2, 0.12, 0.08, 1, 7, R * 2.2, 0, 'sp'], ['glow-0', LIGHT, FEET, 1.2, 1.4, 0.45, 0.45, 0.35, 7, R * 2.2, 0, 'gsp'],
  ],
  crystalBloom,
  soothingMurmur: [
    ...[0, 0.35, 0.7, 1.05, 1.4].map((t, j) => RING(MID, FEET, t, 2, R * 0.16, R * 1.7, 0.75, j % 2 ? 'ring-8-0.7' : 'ring-8-1.1')),
    POOL(VIOLET, FEET, 0, 3, R * 1.1, 0.25), ['glow-0.3', LIGHT, CROWN, 0.4, 1.6, 0.12, 0.12, 1, 6, R * 1.3, 0.4, 's'],
  ],
  nightTerror: [
    SHADOW(FEET, 0, 3, R * 1.5, 0.75), ['claw-1-', BLACK, FEET, 0, 2.6, R * 0.55, R * 0.55, 0.95, 6, 0.3, 0, 'on'],
    ['claw-1-', DEEP, FEET, 0.2, 2.2, R * 0.55, R * 0.55, 0.6, 6, 0.3, 0, 'o'], ['glow-0.3', PALE, CROWN, 0.4, 2.2, 0.1, 0.1, 1, 8, R * 0.9, 0, 'p'],
  ],
  borrowedTongue: [
    ['cap-2', BODY, RIDE, 0, 2.6, 0.12, 0.12, 1, 1, 0, 0, 'ln'], ['cap-0.8', VIOLET, RIDE, 0, 2.6, 0.04, 0.04, 1, 1, 0, 0, 'l'],
    POOL(VIOLET, FEET, 0.7, 1.9, 0.9, 0.45), ['star4', PALE, CROWN, 0.9, 1.3, 0.13, 0.08, 1, 9, 1.4, 0.4, 'bs'],
  ],
  blackDew: [
    SHADOW(FEET, 0, 3.2, R * 1.4, 0.7), ['disc', BODY, FEET, 0.2, 1.4, 0.13, 0.13, 1, 12, R, -2.6, 'sp'],
    ['disc', BLACK, FEET, 0.55, 2.65, 0.1, 0.28, 0.9, 12, R, 0, 'gnsp'], ['glow-0.3', GOLD, FEET, 0, 1.8, 0.04, 0.03, 1, 25, R, -1, 's'],
  ],
  marrowFeast: [
    SHADOW(FEET, 0, 3, R * 1.3, 0.4), ['glow-0.3', BONE, FEET, 0, 1.8, 0.06, 0.04, 0.9, 26, R * 1.6, 0.8, 'is'], ['star4', BONE, FEET, 1.8, 0.7, 0.06, 0.03, 1, 14, 1.8, 0, 'b'],
    POOL(DEEP, FEET, 1.7, 1.1, 1.6, 0.6), RING(BONE, FEET, 1.4, 1, 1.6, 0.6, 1, 'ring-2-2.8'),
  ],
  creepingDark: [
    ['glow-0', BLACK, FEET, 0.2, 3, 0.35, 0.95, 0.5, 9, R * 0.9, 0, 'gns'], ['ray', MID, FEET, 0.5, 2.7, R * 0.5, R * 0.5, 0.5, 9, 0, 0, 'o'],
    POOL(DEEP, FEET, 0.8, 2.4, R * 0.7, 0.35), MOTES(DEEP, FEET, 0, 14, 0.25, 1.6, R * 0.8),
  ],
  blindEye: [
    ['cap-0.8', BONE, FEET, 0, 2.8, 0.12, 0.12, 0.85, 6, 0.5, 0, 'rn'], ['glow-0', BLACK, FEET, 0.3, 2.1, 1.3, 1.3, 0.6, 1, 2.2, 0, 'gnx'],
    ['ring-4-1.1', MID, FEET, 0.3, 2.1, 1, 1, 0.45, 1, 2.2, 0, 'gx'], ['soft-3', BONE, FEET, 0.8, 1.2, 0.06, 0.04, 0.7, 6, 0.6, 0, 'sx'],
  ],
  divertedCart: cart(7, 1, false),
  quickening: falseDawn,
  mend: crystalBloom,
  theCalling: [
    POOL(MID, FEET, 0, 3, 3.15, 0.3), ['cap-0.8', VIOLET, FEET, 0.2, 2, 0.06, 0.06, 0.85, 7, 3, 0, 'lsp'],
    ['ring-2-1.1', LIGHT, FEET, 0.9, 0.6, 0.15, 0.5, 0.8, 7, 3, 0, 'gsp'], RING(LIGHT, FEET, 0.15, 1.6, 0.2, 3.7, 0.8, 'ring-16-1.1'),
    ['star4', LIGHT, FEET, 0.9, 0.45, 0.08, 0.05, 1, 7, 3, 0, 'sp'],
  ],
  sermonOfAsh: purge,
  gildedTongue: falseDawn,
  devour: [],
  terrorize,
  sabotage: cart(4, 1, true),
  desecrate,
  sacrifice,
  frame: terrorize,
  caveIn: [
    PUFF(DUST, FEET, 0, 22, 2.6, 0.6, 1.8), ['soft-0', GRIT, FEET, 0, 1.4, 0.12, 0.12, 1, 6, 2.5, -3, 'sn'], ['soft-3', ASH, FEET, 0, 1.4, 0.05, 0.05, 0.9, 30, 3, -3, 'sn'],
    SHADOW(FEET, 0, 2.6, 3, 0.5, SMOKE), ['claw-1-', GRIT, FEET, 0, 2.6, 2.5, 2.5, 1, 3, 0.2, 0, 'on'], RING(GRIT, FEET, 0, 0.9, 1.25, 3.5, 1, 'ring-8-2.8'),
  ],
  badWater: sickness,
  robTheCart: cart(4, 0.55, false),
  madness: terrorize,
  bloodRite: sacrifice,
  riot: purge,
  assassinate: sacrifice,
  burnTheLedgers: falseDawn,
  silenceThePreacher: falseDawn,
  turnTheMob: falseDawn,
};
/** a follower's own act of evil: small and muted beside the god's */
export const FOLLOWER_EVIL = follower;
/** a paid stone burns at the grave, its embers carried off to the miracle */
export const BURN: Part[] = [
  ['@gem', -1, GRAVE, 0.2, 0.9, 0.22, 0.07, 1, 1, 0, 0.25], POOL(-1, GRAVE, 0.2, 1.2, 0.8, 0.5), ['glow-0.3', PALE, GRAVE, 0.2, 0.9, 0.5, 0.5, 0.6],
  ['glow-0.3', -1, RIDE, 0.25, 0.9, 0.06, 0.04, 1, 12, 0, 0, 's'], ['soft-3', ASH, GRAVE, 1, 1.1, 0.05, 0.03, 0.8, 6, 0.6, 0.8, 'bn'],
];

// ---- a strike, by grade (loop.ts pickStrike, crystal.ts crystalStrike and revealLight): the bite, the stone's light

/** pause before the bite, the light's hold, the whole length, glints at the reveal, rays, ground rings */
const PRE = [0.1, 0.12, 0.15, 0.3, 0.45, 0.85], HOLD = [0, 0.04, 0.12, 0.3, 0.45, 0.8], DUR = [1.05, 1.35, 1.75, 2.25, 2.8, 3.8];
const GLINTS = [0, 3, 6, 10, 14, 20], RAYS = [0, 2, 3, 4, 6, 16], RINGS = [0, 1, 2, 2, 3, 3];
function strike(g: number): Part[] {
  const pre = PRE[g]! + 0.05, hold = HOLD[g]!, rv = pre + (0.34 + g * 0.025) * 0.55, end = DUR[g]! * 0.85 + 0.05, ti = g * 0.6, k = hold + 0.9;
  const p: Part[] = [
    // the pick's bite: sparks and chips off the face, a breath of dust, a white flash
    ['star4', LAMP, FEET, 0, 0.26, 0.035, 0.02, 1, 6, 0.5, 0.3, 'b'], ['soft-3', DUST, FEET, 0, 0.55, 0.035, 0.03, 1, 3, 0.15, 0.2, 'bn'],
    ['glow-0.3', BONE, CROWN, 0, 0.14, 0.35, 0.3, 1], ['glow-0.3', BONE, CROWN, pre - 0.02, 0.24, 0.5, 0.4, 1],
    ['soft-3', DUST, FEET, pre, 0.8, 0.05, 0.04, 1, 6 + g * 2, 1.4, 0.3, 'bn'], PUFF(DUST, FEET, pre, 6, 0.7, 0.22), ['star4', LAMP, FEET, pre, 0.25, 0.04, 0.02, 1, 4, 1.6, 0, 'b'],
    // the light: a pool on the ground, the air glow round the stone, the stone itself, its glints
    POOL(-1, FEET, rv, hold + 1.1, 0.9 + ti * 0.55, 0.6), ['glow-0.3', -1, CROWN, rv, hold + 1.1, 0.45 + ti * 0.25, 0.45 + ti * 0.25, 0.75],
    ['@gem', -1, CROWN, rv, end - rv, 0.16 + g * 0.03, 0.16 + g * 0.03, 1, 1, 0, 0.1 + g * 0.06],
    ['glow-0', -1, FEET, rv + hold + 0.3, end - rv - hold - 0.3, 0.45 + g * 0.15, 0.45 + g * 0.15, 0.22 + g * 0.08, 1, 0, 0, 'g'],
    PUFF(DUST, FEET, pre + 0.34 + hold, 3 + g, 0.5, 0.12, 0.6),
  ];
  if (g >= 1) p.push(['star4', -1, CROWN, rv, 0.9 + g * 0.2, 0.05, 0.03, 1, GLINTS[g]!, 1.4 + g * 0.4, 1.6 + g * 0.4, 'b'], MOTES(-1, FEET, pre + 0.34 + hold, 2 + g * 2, 0.6, 1.1, 0.3));
  if (g >= 3) p.push(['star4', PALE, CROWN, rv, 0.5, 0.045, 0.02, 1, 8 + g * 4, 2.6, 2.4, 'b'], ['glow-0.3', -1, FEET, 0, pre + 0.25, 0.6, 0.6, 0.6, 1, 0, 0, 'g']);
  if (g >= 4) p.push(SHADOW(FEET, 0, rv + hold + 0.6, g >= 5 ? 6 : 3, g >= 5 ? 0.7 : 0.4));
  if (g >= 5) p.push(['glow-0.3', VIOLET, CROWN, rv - 0.5, 1.4, 0.06, 0.04, 1, 18, 3.2, 0, 'is']);
  // rays turning slowly round the stone, more and longer by grade (the rarest's alternate white and deep violet)
  if (RAYS[g]) p.push(['ray', -1, CROWN, rv, k + 0.3, (0.55 + ti * 0.55) * 0.5, (0.55 + ti * 0.55) * 0.5, 0.55, RAYS[g]!, 0, 0, g >= 5 ? 'oa' : 'o', 0.35 * (ti - 1)]);
  for (let j = 0; j < RINGS[g]!; j++) p.push(RING(-1, FEET, rv + 0.12 * j * k / 2.4, k / (2.4 - Math.min(j, 2) * 0.5), 0.25, 0.8 + ti * 0.38, 0.9, j ? 'ring-8-1.1' : 'ring-8-1.8'));
  return p;
}
export const STRIKES: readonly (readonly Part[])[] = [0, 1, 2, 3, 4, 5].map(strike);

/** The clips by event kind and variant. */
export const CLIPS: Record<string, readonly Part[]> = {
  heard: [...COIL, RING(VIOLET, FEET, 1.2, 1.3, 0.95, 0.45, 0.8, 'ring-4-1.1'), MOTES(PALE, FEET, 1.2, 5, 1.2)],
  refused: [...COIL, RING(GRAY, FEET, 1.2, 1.5, 0.4, 1.3, 0.7, 'ring-4-1.1'), ['soft-3', GRAY, FEET, 1.3, 1.2, 0.07, 0.03, 0.7, 16, 0.6, 0.8, 'b'], PUFF(DUST, FEET, 1.4, 8, 0.4, 0.3, 1.1)],
  turned: [
    ...[0, 0.2, 0.4].map((t) => RING(VIOLET, FEET, t, 1.2, 0.3, 3.6, 0.9, 'ring-8-1.8')),
    POOL(VIOLET, FEET, 0, 2.6, 1.6, 0.55), SPARK(PALE, FEET, 0.1, 18, 1.2), MOTES(VIOLET, FEET, 0.2, 10, 2.2, 1.6),
    ['beam', VIOLET, FEET, 0, 1.4, 0.45, 0.45, 0.5, 4, 0.5, 0, 's'],
    ['ring-2-0.7', VIOLET, CROWN, 0.12, 0.55, 0.12, 0.67, 1], ['glow-0.3', PALE, CROWN, 1.1, 0.6, 0.3, 0.15, 1], ['glow-0.3', VIOLET, CROWN, 1.55, 1.2, 0.4, 0.2, 1],
  ],
  lost: [['glow-0.3', LAMP, CROWN, 0, 0.7, 0.3, 0.05, 1], SPARK(LAMP, CROWN, 0.15, 7, 0.4), ['puff-1', SMOKE, CROWN, 0.62, 2.4, 0.3, 1.15, 0.5, 3, 0.2, 1.5, 'n']],
  devour: [
    SHADOW(FEET, 0, 2.2, 2.6, 0.85, INK), ['claw-0-', VIOLET, FEET, 0.1, 0.8, 1.2, 1.2, 1],
    ['claw-1-', PALE, FEET, 0.35, 0.7, 1, 1, 0.8], SPARK(VIOLET, FEET, 0.42, 20, 1.6, 0.12), MOTES(PALE, GRAVE, 0.9, 12, 1.5),
    RING(VIOLET, GRAVE, 0.9, 1, 1.5, 0.6),
  ],
  eat: [RING(VIOLET, GRAVE, 0.55, 0.23, 1.5, 0.6), SPARK(VIOLET, GRAVE, 0.72, 20, 1.6, 0.12), MOTES(PALE, GRAVE, 0.5, 12, 1.5), ['@gem', -1, GRAVE, 0, 0.75, 0.26, 0.1, 1, 5, 0.3, 0, 'b']],
  set: [SPARK(PALE, GRAVE, 0, 10, 0.6), SPARK(-1, GRAVE, 0.1, 8, 0.9, 0.1), ['ray', -1, GRAVE, 0, 1.2, 0.5, 0.9, 0.6, 8, 0, 0, 'o'], ['beam', PALE, GRAVE, 0, 1.6, 0.75, 0.75, 0.5]],
  unset: [SPARK(GRAY, GRAVE, 0, 7, 0.6), RING(PALE, GRAVE, 0, 0.6, 0.6, 1.2)],
  lieLow: [['puff-2', SMOKE, CROWN, 0.15, 0.6, 0.3, 0.5, 0.8, 1, 0, 0, 'n'], ['glow-0.05', VIOLET, CROWN, 0.7, 0.5, 0.2, 0.2, 1]],
  pray: [['beam', VIOLET, FEET, 0, 2, 0.86, 0.86, 0.55], MOTES(PALE, CROWN, 0, 8, 2), RING(VIOLET, FEET, 0.2, 1.4, 0.3, 1.9)],
  arrive: [RING(LAMP, FEET, 0, 1.3, 1.3, 0.7, 0.8, 'ring-4-1.1'), ['glyph-dot-1.7', PALE, CROWN, 0, 1.3, 0.3, 0.3, 1, 1, 0, 0.5], PUFF(DUST, FEET, 0, 6, 0.4)],
  balked: [RING(GRAY, FEET, 0, 1.2, 0.5, 1.1, 0.7, 'ring-4-1.1'), ['soft-3', GRAY, FEET, 0.1, 1, 0.06, 0.03, 0.6, 8, 0.5, 0.6, 'b']],
  pocket: [['@gem', -1, FEET, 0, 0.6, 0.22, 0.1, 1, 1, 0, 0.4], SPARK(PALE, FEET, 0.4, 4, 0.3)],
  cart: [['@gem', -1, FEET, 0, 0.6, 0.2, 0.15, 1, 1, 0, -0.2], PUFF(DUST, FEET, 0.4, 4, 0.3)],
  tribute: [['@gem', -1, BACK, 0, 1.4, 0.2, 0.2, 1, 1], RING(LIGHT, GRAVE, 1.3, 0.8, 0.4, 1.4)],
  // a stone of the town's tithe carried home: a glint from the tither to the grave, a burst and a ring as it lands
  tithe: [
    ['glow-0.3', -1, BACK, 0, 1.2, 0.12, 0.12, 1, 1], SPARK(-1, GRAVE, 1.2, 6, 0.6, 0.06), SPARK(PALE, GRAVE, 1.25, 4, 0.5, 0.05),
    ['glow-0.3', -1, GRAVE, 1.2, 0.6, 1.1, 1.1, 0.55], RING(-1, GRAVE, 1.2, 0.55, 0.4, 1.2, 1, 'ring-2-1.1'),
  ],
  offer: [MOTES(LIGHT, BACK, 0, 8, 0, 1.6), RING(LIGHT, GRAVE, 1.4, 1, 0.4, 1.6), ['@gem', -1, GRAVE, 1.4, 1.8, 0.26, 0.26, 1, 1, 0, 0.3], ['ray', -1, GRAVE, 1.7, 1.4, 0.5, 1, 0.5, 6, 0, 0, 'o']],
  count: [RING(BONE, FEET, 0, 1.4, 0.4, 1.6, 0.7, 'ring-2-1.1'), ['glyph-dot-1.7', BONE, FEET, 0.1, 1.6, 0.25, 0.25, 0.9, 5, 0.8, 0.3, 'o']],
  short: [RING(BLOOD, FEET, 0, 1.6, 0.4, 2, 0.8, 'ring-4-1.1'), ['glyph-low-2.4', BLOOD, CROWN, 0.1, 1.8, 0.4, 0.4, 1, 1, 0, 0.4]],
  search: [RING(STEEL, FEET, 0, 0.55, 1.4, 0.65, 1, 'ring-8-1.8'), RING(STEEL, FEET, 0.15, 0.55, 1.4, 0.65, 0.8, 'ring-8-1.8')],
  seized: [RING(STEEL, FEET, 0, 0.55, 1.4, 0.65, 1, 'ring-8-1.8'), SPARK(GOLD, FEET, 0.7, 12, 1), ['glyph-evil-2.4', BLOOD, CROWN, 0.7, 1.6, 0.4, 0.4, 1, 1, 0, 0.4]],
  exposed: [['glyph-evil-3.4', BLOOD, CROWN, 0, 1.9, 0.5, 0.5, 1, 1, 0, 0.5], RING(BLOOD, FEET, 0.7, 1, 0.5, 2.6, 0.9, 'ring-8-1.8'), SPARK(STEEL, FEET, 0.7, 10, 1)],
  enchant: [SPARK(VIOLET, GRAVE, 0, 14, 1), ['glyph-diamond-1.7', PALE, GRAVE, 0.1, 1.4, 0.25, 0.25, 1, 6, 1.4, 0.2, 'o'], RING(VIOLET, GRAVE, 0.2, 1, 0.3, 1.6)],
  curse: [['puff-2', SMOKE, GRAVE, 0, 1.6, 0.4, 1, 0.7, 4, 0.4, 1, 'n'], SPARK(BLOOD, GRAVE, 0.2, 12, 1.2), RING(BLOOD, GRAVE, 0.2, 1, 0.3, 1.6)],
  facet: [['star4', -1, GRAVE, 0, 0.3, 0.4, 0.1, 1, 4, 0.3, 0, 's'], ['ray', -1, GRAVE, 0.3, 1, 0.4, 0.8, 0.7, 6, 0, 0, 'o'], SPARK(PALE, GRAVE, 0.3, 10, 0.8)],
  recombine: [['@gem', -1, GRAVE, 0, 0.8, 0.22, 0.22, 1, 2, 1.4, 0, 'o'], ['glow-0.3', -1, GRAVE, 0.75, 0.8, 0.2, 1.2, 1], RING(-1, GRAVE, 0.8, 1, 0.4, 2)],
  made: [SPARK(GOLD, GRAVE, 0, 14, 1), ['glow-0.3', GOLD, GRAVE, 0, 1.2, 0.6, 0.2, 0.8], RING(GOLD, GRAVE, 0.2, 1, 0.3, 1.4)],
  given: [['glow-0.3', GOLD, RIDE, 0, 1.2, 0.15, 0.15, 1, 1], SPARK(GOLD, FEET, 1.1, 8, 0.6), ['glyph-diamond-1.7', GOLD, CROWN, 1.2, 1.2, 0.25, 0.25, 1, 1, 0, 0.4]],
  takenBack: [['glow-0.3', GOLD, BACK, 0, 1.2, 0.15, 0.15, 1, 1], RING(GOLD, FEET, 0, 0.8, 0.8, 0.3)],
  hold: [RING(VIOLET, FEET, 0, 2, 0.6, 4, 0.6, 'ring-16-1.8'), MOTES(VIOLET, FEET, 0.2, 10, 1.5, 1.8)],
  announced: BELL,
  council: [['ring-16-1.8', STEEL, FEET, 0, 0.8, 1.4, 0.65, 1, 2, 0, 0, 'gs'], SPARK(STEEL, FEET, 0.3, 10, 1), ['glyph-scout-2.4', STEEL, CROWN, 0, 2, 0.4, 0.4, 1, 1, 0, 0.3]],
  temple: [['tongue-0-', FIRE, FEET, 0, 1.1, 0.8, 0.8, 1, 16, 3, 0, 's'], MOTES(FIRE, FEET, 0, 20, 2.5, 2.4)],
  public: [['puff-1', DUST, FEET, 0, 1.6, 0.4, 1, 0.5, 12, 1.5, 0.6, 'bn'], SPARK(FIRE, FEET, 0.2, 14, 1.6)],
  answered: [RING(GOLD, FEET, 0, 2.6, 0.4, 2.4, 0.9, 'ring-4-1.8'), ['glyph-pray-1.7', GOLD, FEET, 0, 2.4, 0.25, 0.25, 1, 8, 2.4, 0, 'o'], SPARK(GOLD, FEET, 0.35, 18, 2), ['soft-3', GRAY, FEET, 0.35, 1.2, 0.06, 0.03, 0.6, 10, 1.5, 0.5, 'b']],
  yours: [RING(VIOLET, FEET, 0, 2, 0.5, 3, 0.8, 'ring-8-1.8'), MOTES(VIOLET, FEET, 0, 14, 2, 1.8)],
  theirs: [RING(GRAY, FEET, 0, 1.6, 0.5, 2.4, 0.6, 'ring-8-1.8')],
  hunger: [SHADOW(GRAVE, 0, 2, 3, 0.8, INK), RING(VIOLET, GRAVE, 0, 1.3, 2.2, 1, 0.8), ['claw-1-', INK, GRAVE, 0, 0.8, 1.5, 1.5, 0.9, 1, 0, 0, 'n']],
  rank: [MOTES(PALE, GRAVE, 0.5, 18, 2.5, 1.3), ['glyph-pray-2.4', VIOLET, GRAVE, 0.3, 2, 0.3, 0.3, 1, 8, 2.4, 0.2, 'o'], RING(PALE, GRAVE, 0.85, 1.2, 0.4, 4, 1, 'ring-8-2.8'), ['beam', VIOLET, GRAVE, 0.4, 2, 1.2, 1.2, 0.6, 6, 0.3, 0, 's']],
  ichor: [['disc', BLOOD, GRAVE, 0, 1.6, 0.1, 0.06, 1, 3, 0.4, 1.6, 's'], RING(BLOOD, GRAVE, 0, 1.2, 0.55, 0.55, 0.6)],
  /** a find of 1 in 10,000 or rarer (crystal.ts tailFind): the room dark, three rings, a needle up, an eight-rayed star turning */
  tail: [
    SHADOW(FEET, 0, 3.2, 7, 0.8, INK), ['glow-0.3', -1, FEET, 0, 1.4, 0.06, 0.04, 1, 26, 3.2, 0, 'is'], POOL(-1, FEET, 0.9, 2.3, 1.1, 0.7),
    ...[0.9, 1.22, 1.54].map((t) => RING(-1, FEET, t, 1.4, 0.4, 4.6, 0.9, 'ring-8-2.8')), ['beam', PALE, FEET, 0.88, 1.7, 0.1, 0.1, 0.9],
    ['ray', -1, CROWN, 0.9, 2.3, 0.8, 0.8, 0.6, 8, 0, 0, 'o', 0.4], ['star', -1, CROWN, 0.9, 2.3, 0.2, 0.2, 1],
    ['star4', -1, CROWN, 0.9, 0.8, 0.04, 0.02, 1, 22, 2.8, 3, 'b'], MOTES(-1, FEET, 0.9, 12, 2.2, 2),
  ],
  cache: [SPARK(VIOLET, FEET, 0.55, 14, 1.2, 0.1), SPARK(PALE, FEET, 0.55, 10, 0.9), RING(VIOLET, FEET, 0.4, 1.6, 0.4, 2.4)],
  relic: [MOTES(PALE, FEET, 0.4, 14, 2, 2), RING(PALE, FEET, 0.4, 1.6, 0.4, 2.4)],
  danger: [['puff-1', DUST, FEET, 0.3, 1.6, 0.3, 0.8, 0.6, 18, 1.4, 0.4, 'bn'], SPARK(DUST, FEET, 0.55, 18, 1.4)],
  loner: [['glow-0.3', LAMP, FEET, 0, 1.6, 0.08, 0.04, 0.9, 10, 2, 0, 'bs'], RING(LAMP, FEET, 0.4, 1.4, 1.8, 0.6)],
  seam: [['ray', VIOLET, FEET, 0.3, 2, 2, 4.2, 0.6, 5, 0, 0, 'o'], SPARK(PALE, FEET, 0.55, 12, 1.4)],
  shortcut: [MOTES(LAMP, FEET, 0, 16, 1, 2.2), RING(LAMP, FEET, 0.3, 1.6, 0.4, 2.4)],
  none: [RING(GRAY, FEET, 0, 1.8, 0.4, 1.6, 0.6)],
  /** dusk at the grave (world.ts dusk): ash falling, the dark flowing in from the edges and settling, a teal ring closing */
  dusk: [
    ['soft-3', ASH, GRAVE, 0, 2.2, 0.05, 0.03, 0.6, 34, 8, -1.5, 'sn'], ['soft-3', DEEP, GRAVE, 0, 2.2, 0.05, 0.03, 0.6, 34, 8, -1.5, 'sn'],
    ['glow-0', INK, GRAVE, 0, 3.2, 3.6, 3.6, 0.4, 10, 8.4, 0, 'gnio'], SHADOW(GRAVE, 0.8, 2.4, 7.2, 0.3, INK),
    ['ring-8-1.1', TEAL_DEEP, GRAVE, 0, 2.8, 8, 3.2, 0.45, 1, 0, 0, 'gn'],
  ],
  mark: [RING(VIOLET, FEET, 0, 2.2, 0.36, 0.36, 0.8, 'ring-2-0.7')],
};

/** The dawn's bell-wave (world.ts dawn): it runs up through the mine and the shaft to the pit head over WAVE_S. */
export const DAWN = { path: ['sump', 'lowgallery', 'grave', 'cartway', 'lift'] as const, wave: 3.6, fade: 1, width: 3, cold: STEEL, mid: 0xc3c9d8, core: 0xf2f2f3, lamp: LAMP, dust: DUST };

/** Which clip an event plays, by name. */
export function clipOf(e: GameEvent, s: ViewModel['state']): string | null {
  switch (e.kind) {
    case 'whisper': return e.ok ? 'heard' : 'refused';
    case 'routine': return e.routine === 'lieLow' || e.routine === 'pray' ? e.routine : 'heard';
    case 'moved': return e.ok ? 'arrive' : 'balked';
    case 'count': return e.short > 0 && !e.forgiven ? 'short' : 'count';
    case 'search': return e.found.length || e.item ? 'seized' : 'search';
    case 'play': return e.by === 'follower' ? 'follower' : e.card === 'devour' ? null : `card:${e.card}`;
    case 'item': return e.how;
    case 'threat': return e.how === 'landed' ? (s.threats.find((x) => x.id === e.threat)?.faction ?? 'council') : e.how;
    case 'building': return e.yours ? 'yours' : 'theirs';
    case 'starve': return 'hunger';
    case 'lashOut': return null;
    case 'gone': return 'lost';
    case 'ichor': return e.delta < 0 ? 'ichor' : null;
    case 'deepOpen': case 'vaultOpen': return 'cache';
    case 'found': return e.discovery;
    case 'strike': return `strike:${GRADES.indexOf(e.grade)}`;
    case 'turned': case 'lost': case 'devour': case 'eat': case 'set': case 'unset': case 'pocket': case 'cart':
    case 'tribute': case 'offer': case 'tithe': case 'exposed': case 'enchant': case 'curse': case 'facet': case 'recombine': case 'hold':
    case 'rank': case 'dawn': case 'dusk':
      return e.kind;
    default: return e.note ? 'mark' : null;
  }
}

/** A clip's parts by its name. */
export function partsOf(name: string): readonly Part[] {
  if (name.startsWith('card:')) return CARD_CLIPS[name.slice(5) as CardId]!;
  if (name.startsWith('strike:')) return STRIKES[Number(name.slice(7))]!;
  if (name === 'follower') return FOLLOWER_EVIL;
  return CLIPS[name]!;
}
