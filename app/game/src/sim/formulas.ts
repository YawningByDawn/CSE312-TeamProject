/**
 * The spec's formulas, implemented exactly (docs/spec.md, DECISIONS §3).
 * Every function here is pure and unit-tested against the spec's numbers.
 */
import { COMBAT } from '../content/combat';
import { MINING, WALK } from '../content/mine';
import { STATS } from '../content/stats';
import type { Standing } from '../types';

/** Standing → tier T (Influence/Direct/miracle cost multiplier). */
export const TIER: Readonly<Record<Standing, number>> = {
  mortal: 1,
  elite: 4.5,
  blessed: 20,
  demigod: 91,
  god: 410,
};

/** Open cards a draw deals (DECISIONS §43). */
export const DRAW_SLOTS = 3;

/**
 * Devotion value: V(D) = 5x + 25(x − 0.4)³ + 1.6, x = D/100.
 * V(0) = 0, V(40) = 3.6, V(100) = 12; flattest at 40.
 */
export function devotionValue(devotion: number): number {
  const x = devotion / 100;
  return 5 * x + 25 * (x - 0.4) ** 3 + 1.6;
}

/**
 * Base points needed to raise Devotion from d0 to d1 (closed-form integral of
 * 1/gainRate). 0→100 ≈ 193.3; 90→100 ≈ 40.3.
 */
export function basePointsBetween(d0: number, d1: number): number {
  const x0 = d0 / 100;
  const x1 = d1 / 100;
  return 100 * (x1 - x0 + (10 / 3) * ((x1 - 0.4) ** 3 - (x0 - 0.4) ** 3));
}

/**
 * Apply `base` points of Devotion gain starting at `devotion`, integrating the
 * Gain curve exactly (bisection on the closed form). Capped at 100.
 */
export function applyGain(devotion: number, base: number): number {
  if (base <= 0) return devotion;
  if (devotion >= 100) return 100;
  if (basePointsBetween(devotion, 100) <= base) return 100;
  let lo = devotion;
  let hi = 100;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (basePointsBetween(devotion, mid) < base) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** One follower entry for Faith: a unit at average Devotion with `headcount` members. */
export interface FaithEntry {
  devotion: number;
  headcount: number;
}

/**
 * Faith = Σ V(Dᵢ) / N^0.15, N = follower headcount (groups count every
 * member at the group's average Devotion). ×10 followers ≈ ×7 Faith.
 */
export function faith(entries: readonly FaithEntry[]): number {
  let n = 0;
  let sum = 0;
  for (const e of entries) {
    if (e.headcount <= 0) continue;
    n += e.headcount;
    sum += e.headcount * devotionValue(e.devotion);
  }
  if (n <= 0) return 0;
  return sum / n ** 0.15;
}

/** Nether multiplier: 1.5^(L−1) × (4/3)^floor((L−1)/3). */
export function netherMultiplier(level: number): number {
  return 1.5 ** (level - 1) * (4 / 3) ** Math.floor((level - 1) / 3);
}

/** InfluenceCost = 6 · S^0.85 · T · (1 + Resistance/50). */
export function influenceCost(size: number, tier: number, resistance: number): number {
  return 6 * size ** 0.85 * tier * (1 + resistance / 50);
}

/** DirectCost = S^0.85 · T. */
export function directCost(size: number, tier: number): number {
  return size ** 0.85 * tier;
}

/** Miracle power from Faith: 1 + log10(1 + Faith)/2. */
export function miraclePower(faithValue: number): number {
  return 1 + Math.log10(1 + Math.max(0, faithValue)) / 2;
}

/** Ichor maximum: 10 + 2·(L − 1) (+ bonuses). */
export function ichorMax(level: number, bonus = 0): number {
  return 10 + 2 * (level - 1) + bonus;
}

/** Cumulative XP needed to *reach* level L (index L−1). L1 = 0 ... L7 = 2600. */
export const XP_THRESHOLDS: readonly number[] = [0, 100, 250, 560, 950, 1800, 3400];

/** Level for a cumulative XP total (1..7 within the build scope). */
export function levelForXp(xp: number): number {
  let level = 1;
  for (let i = 0; i < XP_THRESHOLDS.length; i++) {
    if (xp >= (XP_THRESHOLDS[i] ?? Infinity)) level = i + 1;
  }
  return level;
}

/** Inputs to the conversion-odds formula (DECISIONS §4). */
export interface OddsInputs {
  presence: number;
  resistance: number;
  /** Trait whisper-fit, already in [−0.15, 0.15]. */
  traitFit: number;
  followersInZone: number;
  publicSuspicion: number;
  seething: boolean;
  /** Flat additive bonuses (Sweet Voice +0.10, events). */
  bonus: number;
  /** Resistance divisor (DECISIONS Round 2: 150; Round 1 draft: 100). */
  resistDivisor?: number;
}

export const ODDS_MIN = 0.05;
export const ODDS_MAX = 0.95;

/**
 * p = clamp(0.55 + 0.04·Presence − Resistance/150 + traitFit
 *          + 0.05·followersInZone (max 0.15) − publicSuspicion/200
 *          − (Malice ≥ 70 ? 0.15 : 0), 0.05, 0.95)
 */
export function conversionOdds(i: OddsInputs): number {
  const t = conversionTerms(i);
  const raw = t.base + t.presence + t.resistance + t.trait + t.nearby + t.public + t.seething + t.bonus;
  return Math.max(ODDS_MIN, Math.min(ODDS_MAX, raw));
}

/** Each term of p before the clamp, signed, in the formula's order: the odds and their reasons read the same terms. */
export function conversionTerms(i: OddsInputs): {
  base: number; presence: number; resistance: number; trait: number; nearby: number; public: number; seething: number; bonus: number;
} {
  return {
    base: 0.55,
    presence: 0.04 * i.presence,
    resistance: -i.resistance / (i.resistDivisor ?? 150),
    trait: Math.max(-0.15, Math.min(0.15, i.traitFit)),
    nearby: Math.min(0.15, 0.05 * i.followersInZone),
    public: -i.publicSuspicion / 200,
    seething: i.seething ? -0.15 : 0,
    bonus: i.bonus,
  };
}

/** Max HP: a base, Strength and Endurance (content's STATS). */
export const maxHp = (st: { strength: number; endurance: number }): number => STATS.hpBase + STATS.hpPerStrength * st.strength + STATS.hpPerEndurance * st.endurance;

/** Seconds an ore of `tier` (1..3) takes a body: its table seconds over the speed term, Strength and Dexterity each half of it (10 and 10: the table's). */
export const miningSeconds = (tier: number, st: { strength: number; dexterity: number }): number =>
  MINING.seconds[tier - 1]! / ((0.5 * st.strength + 0.5 * st.dexterity) / MINING.norm);

/** Units a second a body walks: the table's at Dexterity 10, a share more or less for each point. */
export const walkSpeed = (dexterity: number): number => WALK.speed * (1 + WALK.perDexterity * (dexterity - 10));

/** Mining rarity, a person's own value from Devotion: 1 at none, x1.5 at 100. */
export const miningRarity = (devotion: number): number => 1 + (MINING.rarityPerDevotion * devotion) / 100;

/** The chance of each grade (dull, clear, bright, blazing) from an ore of `tier`: the table's non-dull odds times `rarity`, dull the rest; sums to 1. */
export function oreOdds(tier: number, rarity: number): number[] {
  const up = MINING.odds[tier - 1]!.map((p) => (p * rarity) / 100);
  return [1 - up.reduce((a, b) => a + b, 0), ...up];
}

/** The host's blow: the table's damage for each point of Strength. */
export const swingDamage = (strength: number): number => COMBAT.host.perStrength * strength;

/** A skeleton's Hit Points and a blow's damage on `day` (1 from the first dawn): the table's, plus its step for each day since the first. */
export const mobHp = (day: number): number => COMBAT.skeleton.hp + COMBAT.skeleton.hpPerDay * (day - 1);
export const mobDamage = (day: number): number => COMBAT.skeleton.damage + COMBAT.skeleton.damagePerDay * (day - 1);

/** Round to one decimal (Nether is displayed and charged at 0.1 precision). */
export function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
