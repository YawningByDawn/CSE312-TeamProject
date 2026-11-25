/**
 * The crystal numbers (DECISIONS §15.5, §15.10; spec §7): grades and their worth, crafting prices, resonance,
 * the odd effects and their numbers. Data only; the words are content's ui text, keyed by these ids.
 */
import type { Grade, OddEffectId } from '../types';

/** The grades in order (index = the grade's tier 0..5) and what each is worth eaten or burnt. */
export const GRADES: readonly Grade[] = ['dull', 'clear', 'bright', 'blazing', 'royal', 'impossible'];
export const GRADE_VALUE: Readonly<Record<Grade, number>> = { dull: 1, clear: 2, bright: 4, blazing: 8, royal: 16, impossible: 32 };

export const CRYSTAL = {
  /** Nether to enchant, by grade (Gemcutter halves it). */
  enchantCost: [2, 3, 5, 8, 12, 18] as readonly number[],
  /** Chance an enchantment comes out a curse (Gemcutter: never). */
  enchantCurse: 0.08,
  /** Nether to recombine, by the higher grade. */
  recombineCost: [2, 3, 4, 6, 9, 13] as readonly number[],
  /** Chance a recombination steps the grade up (Grafter: 25 %). */
  gradeUp: 0.1,
  /** Nether to facet, by grade (gem workshop). */
  facetCost: [3, 4, 6, 9, 13, 18] as readonly number[],
  /** Two set stones of one affinity: their modifiers ×1.25; three wake the set power. */
  resonance2: 1.25,
  /** Flame beside anything quarrels: the other set stones' modifiers ×0.8. */
  flameQuarrel: 0.8,
  /** A burnt stone of the miracle's own nature counts ×1.5. */
  burnMatch: 1.5,
  /** Hunger stones feed ×1.5 when eaten. */
  hungerEat: 1.5,
  /** Flame is hallowed: while set, each day Hunger +2 and the Temple +1 (until profaned). */
  flameHunger: 2,
  flameTemple: 1,
} as const;

/** The odd effects, in the order the roll indexes them; `flaw`: can come out of a flaw when cutting. */
export const ODD_EFFECTS: Readonly<Record<OddEffectId, { flaw: boolean }>> = {
  echo: { flaw: true },
  secondSight: { flaw: false },
  loaded: { flaw: false },
  lodestone: { flaw: false },
  twinning: { flaw: false },
  murmur: { flaw: false },
  bloodPrice: { flaw: true },
  heavyHeart: { flaw: false },
  glutton: { flaw: false },
  feast: { flaw: false },
  paleLight: { flaw: false },
  rot: { flaw: false },
  weeping: { flaw: true },
  prophet: { flaw: false },
  spite: { flaw: true },
  kinship: { flaw: false },
  tithe: { flaw: false },
  unstable: { flaw: true },
  hush: { flaw: false },
  beacon: { flaw: false },
  magpie: { flaw: false },
  sleepwalker: { flaw: false },
};
export const ODD_EFFECT_IDS = Object.keys(ODD_EFFECTS) as OddEffectId[];

/** The odd effects' numbers. */
export const EFFECT = {
  echoChance: 0.3,
  echoMax: 2,
  echoHeatMult: 2,
  lodestoneTier: 2,
  twinChance: 0.12,
  bloodPriceValuePerIchor: 3,
  heavyHeartTolerance: 4,
  gluttonNetherPerValue: 2,
  feastMult: 1.5,
  paleLightMult: 0.6,
  rotResistance: -8,
  weepingEvery: 3,
  weepingHunger: 2,
  spiteMalice: 1,
  kinshipOdds: 0.15,
  unstableMult: 1.5,
  unstableCrack: 0.06,
  beaconHold: 4,
  magpieMult: 2,
  sleepwalkerOdds: 0.15,
} as const;
