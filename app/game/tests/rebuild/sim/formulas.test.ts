// The spec formulas (docs/spec.md, DECISIONS §3), exact: ported from tests/sim/formulas.test.ts and spec-formulas.test.ts.
import { describe, expect, it } from 'vitest';
import {
  TIER,
  STAGE_TIER,
  STAGE_DRAW,
  applyGain,
  basePointsBetween,
  conversionOdds,
  devotionValue,
  directCost,
  faith,
  ichorMax,
  influenceCost,
  levelForXp,
  XP_THRESHOLDS,
  miracleCost,
  miraclePower,
  netherMultiplier,
  ODDS_MAX,
  ODDS_MIN,
  STAGE_MAX_STANDING,
  STANDING_ORDER,
  round1,
  standingRank,
} from '../../../src/sim/formulas';
import { CARDS } from '../../../src/content/cards';
import { CRYSTAL, GRADE_VALUE } from '../../../src/content/crystals';
import { BASES } from '../../../src/content/gems';
import { burnWorth, veinLevel } from '../../../src/sim/crystals';
import { makeSim } from '../../../src/sim';
import { everyone, flockOf } from '../../../src/sim/core';
import { inReach } from '../../../src/sim/influence';
import type { GameState } from '../../../src/types';
describe('Devotion value V(D) = 5x + 25(x − 0.4)³ + 1.6', () => {
  it('matches the spec anchor points', () => {
    expect(devotionValue(0)).toBeCloseTo(0, 10);
    expect(devotionValue(40)).toBeCloseTo(3.6, 10);
    expect(devotionValue(100)).toBeCloseTo(12, 10);
  });

  it('is the exact cubic at arbitrary points', () => {
    for (const d of [7, 25, 33.3, 61, 88]) {
      const x = d / 100;
      expect(devotionValue(d)).toBeCloseTo(5 * x + 25 * (x - 0.4) ** 3 + 1.6, 12);
    }
  });

  it('has its maximum (12) at D = 100 and is monotonic', () => {
    let prev = -Infinity;
    for (let d = 0; d <= 100; d += 0.5) {
      const v = devotionValue(d);
      expect(v).toBeGreaterThan(prev);
      expect(v).toBeLessThanOrEqual(12 + 1e-12);
      prev = v;
    }
  });

  it('is flattest at D = 40 (minimum slope) and worth more at both ends', () => {
    const slope = (d: number) => (devotionValue(d + 0.01) - devotionValue(d - 0.01)) / 0.02;
    const s40 = slope(40);
    for (const d of [5, 20, 30, 35, 45, 50, 60, 80, 95]) expect(slope(d)).toBeGreaterThan(s40);
    // Top end steepest of all.
    expect(slope(95)).toBeGreaterThan(slope(5));
  });
});

describe('Devotion gain: Gain = Base / (1 + 10(x − 0.4)²)', () => {
  /** the spec's gain, which `basePointsBetween` and `applyGain` integrate in closed form */
  const gain = (base: number, d: number): number => base / (1 + 10 * (d / 100 - 0.4) ** 2);

  it('0 → 100 costs ≈ 193 base points (integrated in small steps)', () => {
    let d = 0;
    let base = 0;
    const step = 0.001;
    while (d < 100) {
      d += gain(step, d);
      base += step;
    }
    expect(base).toBeGreaterThan(192);
    expect(base).toBeLessThan(194.5);
    expect(basePointsBetween(0, 100)).toBeCloseTo(193.33, 1);
  });

  it('the last 10 Devotion (90 → 100) cost ≈ 40 base points', () => {
    let d = 90;
    let base = 0;
    const step = 0.001;
    while (d < 100) {
      d += gain(step, d);
      base += step;
    }
    expect(base).toBeGreaterThan(39);
    expect(base).toBeLessThan(41.5);
    expect(basePointsBetween(90, 100)).toBeCloseTo(40.33, 1);
  });

  it('is harder at both ends and hardest at the top', () => {
    expect(basePointsBetween(0, 10)).toBeGreaterThan(basePointsBetween(35, 45));
    expect(basePointsBetween(90, 100)).toBeGreaterThan(basePointsBetween(0, 10));
  });

  it('applyGain integrates exactly along the curve', () => {
    for (const [d0, b] of [
      [0, 10],
      [12, 8],
      [40, 5],
      [70, 25],
      [95, 3],
    ] as const) {
      const d1 = applyGain(d0, b);
      expect(basePointsBetween(d0, d1)).toBeCloseTo(b, 6);
    }
    expect(applyGain(50, 1000)).toBe(100);
    expect(applyGain(100, 5)).toBe(100);
    expect(applyGain(30, 0)).toBe(30);
  });
});

describe('Faith = Σ V(Dᵢ) / N^0.15', () => {
  it('is zero with no followers', () => {
    expect(faith([])).toBe(0);
  });

  it('matches the formula', () => {
    const f = faith([
      { devotion: 20, headcount: 1 },
      { devotion: 60, headcount: 1 },
    ]);
    expect(f).toBeCloseTo((devotionValue(20) + devotionValue(60)) / 2 ** 0.15, 12);
  });

  it('×10 followers ≈ ×7 Faith', () => {
    const one = faith([{ devotion: 50, headcount: 1 }]);
    const ten = faith(Array.from({ length: 10 }, () => ({ devotion: 50, headcount: 1 })));
    expect(ten / one).toBeCloseTo(10 ** 0.85, 10);
    expect(ten / one).toBeGreaterThan(6.9);
    expect(ten / one).toBeLessThan(7.2);
  });

  it('a group counts every member at its average Devotion', () => {
    const group = faith([{ devotion: 45, headcount: 12 }]);
    const individuals = faith(Array.from({ length: 12 }, () => ({ devotion: 45, headcount: 1 })));
    expect(group).toBeCloseTo(individuals, 10);
  });
});

describe('Nether = Faith × 1.5^(L−1) × (4/3)^floor((L−1)/3)', () => {
  it('×1.5 per level, ×2 at each new stage', () => {
    expect(netherMultiplier(1)).toBe(1);
    expect(netherMultiplier(2)).toBeCloseTo(1.5, 12);
    expect(netherMultiplier(3)).toBeCloseTo(2.25, 12);
    expect(netherMultiplier(4) / netherMultiplier(3)).toBeCloseTo(2, 12);
    expect(netherMultiplier(7) / netherMultiplier(6)).toBeCloseTo(2, 12);
  });

  it('hits the spec anchors: ×4.5 L4, ×20.3 L7, ×91.1 L10, ×410 L13, ≈×923 L15', () => {
    expect(netherMultiplier(4)).toBeCloseTo(4.5, 10);
    expect(netherMultiplier(7)).toBeCloseTo(20.25, 10);
    expect(Math.round(netherMultiplier(7) * 10) / 10).toBe(20.3);
    expect(Math.round(netherMultiplier(10) * 10) / 10).toBe(91.1);
    expect(Math.round(netherMultiplier(13))).toBe(410);
    expect(Math.round(netherMultiplier(15))).toBe(923);
  });
});

describe('Influence and Direct costs', () => {
  it('T table: Mortal 1, Elite 4.5, Blessed 20, Demigod 91, God 410', () => {
    expect(TIER).toEqual({ mortal: 1, elite: 4.5, blessed: 20, demigod: 91, god: 410 });
  });

  it('Influence = 6 · S^0.85 · T · (1 + Resistance/50)', () => {
    expect(influenceCost(1, 1, 0)).toBeCloseTo(6, 12);
    expect(influenceCost(1, 1, 50)).toBeCloseTo(12, 12);
    expect(influenceCost(1, 1, 25)).toBeCloseTo(9, 12);
    expect(influenceCost(20, 4.5, 30)).toBeCloseTo(6 * 20 ** 0.85 * 4.5 * 1.6, 9);
    expect(influenceCost(1, TIER.god, 0)).toBeCloseTo(2460, 9);
  });

  it('Direct = S^0.85 · T', () => {
    expect(directCost(1, 1)).toBe(1);
    expect(directCost(10, 1)).toBeCloseTo(10 ** 0.85, 12);
    expect(directCost(16, 4.5)).toBeCloseTo(16 ** 0.85 * 4.5, 12);
  });
});

describe('Miracle cost = base × stage tier T, rounded', () => {
  it('Whisper tier 1, Shade tier 4.5', () => {
    expect(STAGE_TIER.whisper).toBe(1);
    expect(STAGE_TIER.shade).toBe(4.5);
    expect(miracleCost(3, 1)).toBe(3);
    expect(miracleCost(3, 4.5)).toBe(14); // 13.5 rounds up
    expect(miracleCost(4, 4.5)).toBe(18);
  });

  it('power = 1 + log10(1 + Faith)/2', () => {
    expect(miraclePower(0)).toBe(1);
    expect(miraclePower(9)).toBeCloseTo(1.5, 12);
    expect(miraclePower(99)).toBeCloseTo(2, 12);
  });
});

describe('Conversion odds', () => {
  // The divisor is content's number; the formula is checked at an explicit one.
  const div = 150;
  const base = {
    presence: 1,
    resistance: 20,
    traitFit: 0,
    followersInZone: 0,
    publicSuspicion: 0,
    seething: false,
    bonus: 0,
    resistDivisor: div,
  };
  const p0 = 0.55 + 0.04 - 20 / div;

  it('p = 0.55 + 0.04·Presence − R/div + fit + 0.05·followers(max .15) − public/200 − seething', () => {
    expect(conversionOdds(base)).toBeCloseTo(p0, 12);
    expect(conversionOdds({ ...base, traitFit: 0.15, followersInZone: 2 })).toBeCloseTo(p0 + 0.15 + 0.1, 12);
    expect(conversionOdds({ ...base, followersInZone: 9 })).toBeCloseTo(p0 + 0.15, 12);
    expect(conversionOdds({ ...base, publicSuspicion: 40 })).toBeCloseTo(p0 - 0.2, 12);
    expect(conversionOdds({ ...base, seething: true })).toBeCloseTo(p0 - 0.15, 12);
    // The draft's literal R/100 is still what an explicit divisor of 100 gives.
    expect(conversionOdds({ ...base, resistDivisor: 100 })).toBeCloseTo(0.39, 12);
  });

  it('trait fit is clamped to ±0.15 and odds to 5–95 %', () => {
    expect(conversionOdds({ ...base, traitFit: 0.5 })).toBeCloseTo(p0 + 0.15, 12);
    expect(conversionOdds({ ...base, resistance: 100, traitFit: -0.15, seething: true, publicSuspicion: 100 })).toBe(0.05);
    expect(conversionOdds({ ...base, resistance: 0, presence: 6, followersInZone: 5, traitFit: 0.15, bonus: 0.1 })).toBe(0.95);
  });
});

describe('God progression', () => {
  it('Ichor max = 10 + 2·(L − 1)', () => {
    expect(ichorMax(1)).toBe(10);
    expect(ichorMax(4)).toBe(16);
    expect(ichorMax(1, 4)).toBe(14);
  });

  it('levels follow the XP thresholds', () => {
    // Thresholds are a design number (DECISIONS §15.13), not a spec formula: check the curve, not its values.
    expect(XP_THRESHOLDS).toEqual([0, 100, 250, 560, 950, 1800, 3400]);
    expect(levelForXp(0)).toBe(1);
    for (let i = 1; i < XP_THRESHOLDS.length; i++) {
      expect(levelForXp(XP_THRESHOLDS[i]! - 0.5)).toBe(i);
      expect(levelForXp(XP_THRESHOLDS[i]!)).toBe(i + 1);
    }
  });
});

describe('levels and standing', () => {
  it('standing ranks follow the tiers (Mortal, Elite, Blessed, Demigod, God); Whisper reaches Mortals, Shade Elites', () => {
    expect(STANDING_ORDER).toEqual(['mortal', 'elite', 'blessed', 'demigod', 'god']);
    expect(STANDING_ORDER.map(standingRank)).toEqual([0, 1, 2, 3, 4]);
    expect(STAGE_MAX_STANDING).toEqual({ whisper: 'mortal', shade: 'elite' });
  });

  it('the odds clamp at 5–95 % (§13.10 D)', () => {
    const base = { presence: 0, traitFit: 0, followersInZone: 0, publicSuspicion: 0, seething: false, bonus: 0, resistDivisor: 150 };
    expect(ODDS_MIN).toBe(0.05);
    expect(ODDS_MAX).toBe(0.95);
    expect(conversionOdds({ ...base, resistance: 400 })).toBe(ODDS_MIN);
    expect(conversionOdds({ ...base, resistance: 0, bonus: 2 })).toBe(ODDS_MAX);
  });

  it('round1 rounds to one decimal', () => {
    expect([round1(1.04), round1(1.05), round1(-2.26), round1(3)]).toEqual([1, 1.1, -2.3, 3]);
  });

  it('vein level = (mine tier − 1) × 3 + depth; this mine is tier I, depth 1–3', () => {
    expect([0, 1, 2, 3, 4].map((d) => veinLevel(1, d))).toEqual([1, 1, 2, 3, 3]);
  });
});

describe("the god's means (spec §8): actions, sockets, and what a verb costs", () => {
  const live = (seed: number, stage?: 'shade') => {
    const { sim, query } = makeSim();
    const s = sim.create(seed, stage ? { stage } : undefined);
    sim.act(s, { type: 'take', card: null });
    return { s, query };
  };
  /** the first person a whisper reaches now */
  const reached = (s: GameState): string => everyone(s).find((p) => inReach(s, flockOf(s), p))!.id;

  it('actions and sockets: 3 + (Divinity − 1) each', () => {
    for (const stage of [undefined, 'shade'] as const) {
      const { s } = live(5, stage);
      expect(s.god.apMax).toBe(3 + (s.god.level - 1));
      expect(s.god.sockets.length).toBe(3 + (s.god.level - 1));
    }
  });

  it('a whisper costs one action and its Influence in Nether: 6 · T · (1 + Resistance/50) for one Mortal', () => {
    const { s, query } = live(7);
    const id = reached(s);
    const p = s.people[id]!;
    const c = query.check(s, { type: 'whisper', target: id });
    expect(c.ap).toBe(1);
    // nobody yours yet: no vigil, no wariness, so the person's own Resistance is what the whisper meets
    expect(c.nether).toBeCloseTo(influenceCost(1, TIER.mortal, p.resistance), 1);
  });

  it("a routine costs one action and the follower's Direct Nether, S^0.85 · T", () => {
    const { s, query } = live(7);
    const p = s.people[reached(s)]!;
    p.follower = true;
    p.routine = 'pray';
    const c = query.check(s, { type: 'setRoutine', unit: p.id, routine: 'lieLow' });
    expect([c.ap, c.nether]).toEqual([1, round1(directCost(1, TIER.mortal))]);
  });
});

describe('a stone burnt and its miracle (spec §7)', () => {
  it('burnt, a stone pays grade value × its base’s burn multiplier, ×1.5 for the miracle’s own nature, to 0.1', () => {
    const s = makeSim().sim.create(2);
    const stones = Object.values(s.crystals);
    expect(stones.length).toBeGreaterThan(0);
    for (const x of stones) {
      const plain = Math.round(GRADE_VALUE[x.grade] * (BASES[x.base]!.inherent.burnMult ?? 1) * 10) / 10;
      expect(burnWorth(x, null)).toBe(plain);
      expect(burnWorth(x, x.affinity)).toBe(Math.round(GRADE_VALUE[x.grade] * (BASES[x.base]!.inherent.burnMult ?? 1) * CRYSTAL.burnMatch * 10) / 10);
      expect(burnWorth(x, x.affinity === 'stone' ? 'hunger' : 'stone')).toBe(plain);
    }
    expect(CRYSTAL.burnMatch).toBe(1.5);
  });

  it('the deal lays three cards in Whisper, four in Shade (one more a major rank)', () => {
    const { sim } = makeSim();
    expect(sim.create(3).god.deal).toHaveLength(STAGE_DRAW.whisper);
    expect(sim.create(3, { stage: 'shade' }).god.deal).toHaveLength(STAGE_DRAW.shade);
    expect([STAGE_DRAW.whisper, STAGE_DRAW.shade]).toEqual([3, 4]);
  });

  it('every Whisper miracle has a base of 2–6 stones', () => {
    for (const d of Object.values(CARDS).filter((c) => c.kind === 'miracle' && !c.shadeOnly)) {
      expect(d.cost).toBeGreaterThanOrEqual(2);
      expect(d.cost).toBeLessThanOrEqual(6);
    }
  });
});
