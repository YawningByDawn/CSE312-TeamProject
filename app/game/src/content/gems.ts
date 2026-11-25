/**
 * Crystal tables (DECISIONS §15.10 D): bases, affinities, modifiers, grades, the mine. Every weight is relative
 * inside its table; percentages in the comments are of the whole table.
 * Words (words/gems.ts): `affinity.<id>.name`, `.word`; `base.<id>.name`, `.line`; `mod.<id>.name`, a curse's `.price`.
 */
import type { Affinity, BaseId, ModId } from '../types';

export type StatLineId =
  | 'nether'
  | 'hungerSlow'
  | 'maliceSlow'
  | 'whisperOdds'
  | 'strikeLuck'
  | 'strikeRate'
  | 'miraclePower'
  | 'calm'
  | 'ichor'
  | 'devotion'
  | 'stain'
  | 'actionPoint';

export const AFFINITY_IDS: readonly Affinity[] = ['hunger', 'malice', 'faith', 'fear', 'blood', 'shadow', 'stone', 'echo', 'flame'];

/** A base's inherent property: a fixed modifier-family bonus, an extra slot, or a use multiplier. */
export interface BaseInherent {
  family?: StatLineId;
  value?: number;
  slots?: number;
  /** Counts this many times its value when burnt for a miracle. */
  burnMult?: number;
  /** Feeds this many times its value when eaten. */
  eatMult?: number;
}

export interface BaseDef {
  /** Relative weight (the whole table sums to 100: these are percentages). */
  weight: number;
  minLevel: number;
  inherent: BaseInherent;
}

const b = (weight: number, minLevel: number, inherent: BaseInherent = {}): BaseDef => ({ weight, minLevel, inherent });

/** 35 bases, 24 % down to 0.001 %; `minLevel` = the vein level they need (below it: a sliver of a chance, ×BASE_BELOW). */
export const BASES: Readonly<Record<BaseId, BaseDef>> = {
  shard: b(24, 1),
  chip: b(18, 1, { eatMult: 1.25 }),
  tooth: b(12, 1, { family: 'hungerSlow', value: 0.5 }),
  bead: b(10, 1, { family: 'stain', value: 2 }),
  plate: b(8, 1, { family: 'calm', value: 2 }),
  needle: b(6, 1, { family: 'whisperOdds', value: 2 }),
  sliver: b(5, 1, { burnMult: 1.25 }),
  pebble: b(4, 1, { family: 'strikeLuck', value: 2 }),
  flake: b(3.5, 1, { family: 'calm', value: 3 }),
  nodule: b(3, 1, { family: 'hungerSlow', value: 1 }),
  knot: b(2, 1, { family: 'maliceSlow', value: 1 }),
  twin: b(1.5, 1, { slots: 1 }),
  geode: b(1.1, 1, { eatMult: 2 }),
  cage: b(0.8, 1, { family: 'devotion', value: 1 }),
  spiral: b(0.5, 1, { family: 'stain', value: 6 }),
  spire: b(0.35, 1, { family: 'nether', value: 1 }),
  cluster: b(0.25, 1, { slots: 1, burnMult: 1.25 }),
  prism: b(0.15, 2, { family: 'miraclePower', value: 5 }),
  lens: b(0.1, 2, { family: 'strikeRate', value: 4 }),
  druse: b(0.07, 2, { family: 'strikeLuck', value: 6 }),
  eye: b(0.04, 2, { family: 'calm', value: 6 }),
  tear: b(0.025, 2, { family: 'devotion', value: 2 }),
  hand: b(0.015, 3, { family: 'strikeRate', value: 10 }),
  heart: b(0.01, 3, { family: 'ichor', value: 1 }),
  seed: b(0.006, 3, { family: 'nether', value: 4 }),
  crown: b(0.004, 4, { slots: 1, burnMult: 1.5 }),
  bell: b(0.003, 4, { family: 'whisperOdds', value: 8 }),
  door: b(0.002, 5, { family: 'strikeLuck', value: 25 }),
  skull: b(0.0015, 5, { family: 'maliceSlow', value: 3, burnMult: 2 }),
  throne: b(0.0012, 6, { family: 'actionPoint', value: 1 }),
  egg: b(0.001, 6, { family: 'devotion', value: 3, slots: 1 }),
  key: b(0.001, 7, { slots: 2 }),
  tongue: b(0.001, 8, { family: 'whisperOdds', value: 15 }),
  womb: b(0.001, 9, { family: 'devotion', value: 6, slots: 1 }),
  godshard: b(0.001, 13, { family: 'actionPoint', value: 2, slots: 2, burnMult: 3 }),
};
/** Weight multiplier for a base below its vein level. */
export const BASE_BELOW = 0.02;
export const BASE_IDS = Object.keys(BASES) as BaseId[];

// ---------------------------------------------------------------------------
// Modifiers
// ---------------------------------------------------------------------------

/** Mods fields a strange modifier may add to (additive). */
export type ModField =
  | 'tolerance'
  | 'freeWhispers'
  | 'seep'
  | 'offerExtra'
  | 'rerolls'
  | 'eatNether'
  | 'miracleDraw'
  | 'evilDraw'
  | 'blessingChoices'
  | 'searchCut'
  | 'tributeOdds';

export interface ModDef {
  id: ModId;
  slot: 'prefix' | 'suffix';
  /** The stat family it adds to, or null for a strange modifier (`field`). */
  family: StatLineId | null;
  field?: ModField;
  /** Only in this affinity's pool (null = every pool). */
  affinity: Affinity | null;
  weight: number;
  minGrade: number;
  minDepth: number;
  /** Value by modifier tier 1..5. */
  values: readonly number[];
  /** A curse: strong, with a price (a negative amount on another family or field). */
  curse?: { family?: StatLineId; field?: ModField; values: readonly number[] };
}

/** Family values by modifier tier 1..5 (strength 1×). */
export const FAMILY_VALUES: Readonly<Record<StatLineId, readonly number[]>> = {
  nether: [1, 2, 3, 5, 8],
  hungerSlow: [1, 1, 2, 2, 3],
  maliceSlow: [1, 1, 2, 2, 3],
  whisperOdds: [2, 3, 5, 8, 12],
  strikeLuck: [4, 6, 9, 13, 20],
  strikeRate: [3, 5, 8, 11, 15],
  miraclePower: [5, 8, 12, 16, 25],
  calm: [3, 5, 8, 12, 18],
  ichor: [1, 1, 1, 2, 3],
  devotion: [1, 1, 2, 3, 4],
  stain: [3, 5, 8, 11, 15],
  actionPoint: [1, 1, 1, 1, 1],
};

const scaled = (f: StatLineId, k: number): number[] => FAMILY_VALUES[f].map((v) => (f === 'actionPoint' ? v : Math.max(1, Math.round(v * k))));

const mods: ModDef[] = [];

/** Plain modifiers: four per family, `<family>1..4`, prefix and suffix alternating, weakest-commonest first. */
const PLAIN: readonly Exclude<StatLineId, 'actionPoint'>[] = [
  'nether', 'hungerSlow', 'maliceSlow', 'whisperOdds', 'strikeLuck', 'strikeRate', 'miraclePower', 'calm', 'ichor', 'devotion', 'stain',
];
const PLAIN_WEIGHTS = [1, 0.6, 0.25, 0.08];
const PLAIN_STRENGTH = [1, 1.25, 1.5, 2];
const PLAIN_MIN_GRADE = [0, 0, 2, 3];
for (const fam of PLAIN) {
  for (let i = 0; i < 4; i++) {
    mods.push({
      id: `${fam}${i + 1}`,
      slot: i % 2 ? 'suffix' : 'prefix',
      family: fam,
      affinity: null,
      weight: PLAIN_WEIGHTS[i]!,
      minGrade: PLAIN_MIN_GRADE[i]!,
      minDepth: i === 3 ? 2 : 1,
      values: scaled(fam, PLAIN_STRENGTH[i]!),
    });
  }
}
mods.push({ id: 'actionPoint1', slot: 'suffix', family: 'actionPoint', affinity: null, weight: 0.004, minGrade: 3, minDepth: 2, values: [1, 1, 1, 1, 1] });

/** Affinity-only modifiers: three per affinity, `<affinity>1..3` (common prefix, uncommon suffix, deep prefix). */
const AFF: Readonly<Record<Affinity, readonly [StatLineId, StatLineId, StatLineId]>> = {
  hunger: ['hungerSlow', 'nether', 'strikeRate'],
  malice: ['maliceSlow', 'miraclePower', 'stain'],
  faith: ['devotion', 'whisperOdds', 'ichor'],
  fear: ['calm', 'whisperOdds', 'stain'],
  blood: ['ichor', 'strikeRate', 'miraclePower'],
  shadow: ['calm', 'stain', 'nether'],
  stone: ['strikeLuck', 'strikeRate', 'hungerSlow'],
  echo: ['whisperOdds', 'devotion', 'strikeLuck'],
  flame: ['miraclePower', 'nether', 'devotion'],
};
for (const aff of AFFINITY_IDS) {
  AFF[aff].forEach((fam, i) => {
    mods.push({
      id: `${aff}${i + 1}`,
      slot: i === 1 ? 'suffix' : 'prefix',
      family: fam,
      affinity: aff,
      weight: [0.5, 0.15, 0.03][i]!,
      minGrade: [0, 1, 3][i]!,
      minDepth: [1, 1, 2][i]!,
      values: scaled(fam, [1.5, 1.75, 2.5][i]!),
    });
  });
}

/** Strange modifiers: they touch a rule, not a stat. */
const strange = (id: string, slot: ModDef['slot'], field: ModField, affinity: Affinity | null, weight: number, minGrade: number, minDepth: number, values: number[]): ModDef =>
  ({ id, slot, family: null, field, affinity, weight, minGrade, minDepth, values });
mods.push(
  strange('falseWeights', 'suffix', 'tolerance', 'stone', 0.12, 1, 1, [1, 2, 3, 4, 6]),
  strange('murmuring', 'prefix', 'freeWhispers', 'fear', 0.04, 2, 1, [1, 1, 1, 1, 2]),
  strange('gravebound', 'prefix', 'seep', 'stone', 0.03, 2, 2, [1, 1, 1, 1, 2]),
  strange('tithing', 'prefix', 'offerExtra', 'faith', 0.05, 1, 1, [1, 1, 1, 1, 2]),
  strange('loaded', 'prefix', 'rerolls', null, 0.05, 1, 1, [1, 1, 1, 1, 2]),
  strange('gluttonous', 'prefix', 'eatNether', 'hunger', 0.08, 0, 1, [1, 1, 2, 2, 3]),
  strange('prophetic', 'prefix', 'miracleDraw', 'faith', 0.01, 3, 2, [1, 1, 1, 1, 1]),
  strange('spiteDrawn', 'suffix', 'evilDraw', 'malice', 0.02, 2, 1, [1, 1, 1, 1, 1]),
  strange('seers', 'suffix', 'blessingChoices', 'echo', 0.0003, 4, 3, [1, 1, 1, 1, 1]),
  strange('lightFingered', 'prefix', 'searchCut', 'shadow', 0.1, 0, 1, [5, 8, 12, 18, 25]),
  strange('dutiful', 'prefix', 'tributeOdds', 'faith', 0.15, 0, 1, [4, 6, 9, 13, 20]),
  strange('firstNight', 'suffix', 'blessingChoices', null, 0.00025, 5, 3, [1, 1, 1, 1, 2]),
);

/** Curses: strong, with a price (only from enchanting, or the rare deep roll). */
const curse = (id: string, slot: ModDef['slot'], family: StatLineId, price: NonNullable<ModDef['curse']>): ModDef =>
  ({ id, slot, family, affinity: null, weight: 0.02, minGrade: 0, minDepth: 1, values: scaled(family, 3), curse: price });
mods.push(
  curse('gnawingCurse', 'prefix', 'nether', { family: 'hungerSlow', values: [-1, -1, -2, -2, -3] }),
  curse('bitterCurse', 'suffix', 'miraclePower', { family: 'maliceSlow', values: [-1, -1, -2, -2, -3] }),
  curse('brandedCurse', 'prefix', 'stain', { family: 'calm', values: [-3, -5, -8, -12, -18] }),
  curse('leechCurse', 'prefix', 'devotion', { family: 'ichor', values: [-1, -1, -1, -1, -2] }),
  curse('shrillCurse', 'prefix', 'whisperOdds', { field: 'tolerance', values: [-1, -2, -3, -4, -6] }),
  curse('greedCurse', 'suffix', 'strikeRate', { field: 'searchCut', values: [-5, -8, -12, -18, -25] }),
  curse('hollowCurse', 'prefix', 'strikeLuck', { family: 'nether', values: [-1, -1, -2, -3, -5] }),
  curse('thirstCurse', 'suffix', 'calm', { family: 'hungerSlow', values: [-1, -1, -2, -2, -3] }),
);

export const MODS: Readonly<Record<ModId, ModDef>> = Object.fromEntries(mods.map((m) => [m.id, m]));
export const MOD_IDS: readonly ModId[] = mods.map((m) => m.id);
export const CURSE_IDS: readonly ModId[] = mods.filter((m) => m.curse).map((m) => m.id);

/** A modifier counts as rare in `oneIn` below this weight (its class probability = weight / RARE_AT). */
export const MOD_RARE_AT = 0.5;

// ---------------------------------------------------------------------------
// Grades and the mine
// ---------------------------------------------------------------------------

/** Modifier slots by grade step (Dull..Impossible), and how many arrive filled. */
export const GRADE = {
  slots: [1, 2, 2, 3, 4, 5] as readonly number[],
  /** Each depth below the first multiplies grade i's weight by depthShift^i. */
  depthShift: 1.25,
  filledMin: [1, 1, 2, 2, 3, 4] as readonly number[],
  filledMax: [1, 2, 2, 3, 4, 5] as readonly number[],
  /** Central modifier tier by grade (capped by the vein level's `maxModTier`). */
  modTier: [1, 1, 2, 2, 3, 3] as readonly number[],
  /** Chance of an odd effect (the rarest layer), by grade. */
  effectChance: [0.0005, 0.002, 0.008, 0.03, 0.1, 0.4] as readonly number[],
  /** Chance a natural roll carries a curse instead of a plain modifier. */
  curseChance: 0.004,
};

/** Mine tiers: this game has one mine, tier I. */
export type MineTierId = 1;

export interface MineTierDef {
  /** Grade weights (percent) at depth 1. */
  gradeWeights: readonly number[];
  affinityWeights: Readonly<Record<Affinity, number>>;
  /** Base weight multipliers ("some types more common there"). */
  baseBias: Readonly<Partial<Record<BaseId, number>>>;
  /** Added to every modifier's tier roll. */
  modTierBonus: number;
}

export const MINE_TIERS: Readonly<Record<MineTierId, MineTierDef>> = {
  1: {
    gradeWeights: [62, 27, 8.5, 2.2, 0.28, 0.02],
    affinityWeights: { stone: 26, hunger: 20, fear: 13, malice: 11, blood: 9, shadow: 9, faith: 6, echo: 4, flame: 2 },
    baseBias: { chip: 1.3, pebble: 1.3, tooth: 1.2 },
    modTierBonus: 0,
  },
};

/** This mine. */
export const MINE_TIER: MineTierId = 1;
