/**
 * Crystals (spec §7, DECISIONS §15.10): the long-tail roll in layers (grade × base × affinity × modifiers × odd
 * effect × curse) from a vein level, as src/sim/crystals.ts rolled it; `oneIn` is the real rarity of the roll.
 * Set stones act through their modifier families (`lineTotal`) and fields (`fieldTotal`).
 */
import { CRYSTAL, EFFECT, GRADES, GRADE_VALUE, ODD_EFFECT_IDS, SET_POWER, SET_SIZE, type SetEffect } from '../content/crystals';
import {
  AFFINITY_IDS, BASES, BASE_BELOW, BASE_IDS, CURSE_IDS, GRADE, MINE_TIER, MINE_TIERS, MODS, MOD_IDS, MOD_RARE_AT,
  type MineTierId, type ModField, type StatLineId,
} from '../content/gems';
import { chance, nextU32, rand } from './rng';
import { uiText } from '../content/text';
import type { Affinity, BaseId, Crystal, GameState, Grade, Mod, ModId, OddEffectId, RngState } from '../types';

/** Vein level = (mine tier − 1) × 3 + depth (spec §6; this mine is tier I, so 1..3). */
export function veinLevel(tier: MineTierId, depth: number): number {
  return (tier - 1) * 3 + Math.max(1, Math.min(3, depth));
}

/** Highest modifier tier a vein level can roll. */
export function maxModTier(level: number): number {
  return Math.min(5, 1 + Math.ceil(level / 2));
}

/** Grade weights (percent, normalised) at a vein level. */
export function gradeWeightsAt(level: number): number[] {
  const depth = Math.max(1, Math.min(3, level));
  const w = MINE_TIERS[MINE_TIER].gradeWeights.map((x, i) => x * GRADE.depthShift ** (i * (depth - 1)));
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((x) => (x / sum) * 100);
}

export const tierOf = (g: Grade): number => GRADES.indexOf(g);
export const worth = (c: Crystal): number => GRADE_VALUE[c.grade];

// ---------- the roll (pure over an RngState) ----------

function pickGrade(rng: RngState, weights: readonly number[], luck: number, floor: number): number {
  const total = weights.reduce((a, b) => a + b, 0);
  const one = (): number => {
    let r = rand(rng) * total;
    for (let t = 0; t < weights.length; t++) {
      r -= weights[t]!;
      if (r < 0) return t;
    }
    return 0;
  };
  let t = one();
  let l = Math.max(0, luck);
  // Luck: L % chance of a second roll, keeping the better; each full 100 % is a sure extra roll.
  while (l > 0) {
    if (l >= 100 || chance(rng, l / 100)) t = Math.max(t, one());
    l -= 100;
  }
  return Math.max(t, floor);
}

function chancesOf(weights: readonly number[], luck: number, floor: number): number[] {
  const total = weights.reduce((a, b) => a + b, 0);
  const p = weights.map((w) => w / total);
  const cdf = (t: number): number => p.slice(0, t + 1).reduce((a, b) => a + b, 0);
  const extra = Math.floor(Math.max(0, luck) / 100);
  const rem = (Math.max(0, luck) % 100) / 100;
  const atMost = (t: number): number => {
    const c = cdf(t);
    return c ** (1 + extra) * (1 - rem + rem * c);
  };
  const out: number[] = [];
  for (let t = 0; t < 6; t++) {
    if (t < floor) out.push(0);
    else if (t === floor) out.push(atMost(t));
    else out.push(atMost(t) - atMost(t - 1));
  }
  return out;
}

/** One grade roll at a depth (1..3): a stone nobody keeps, counted in a cart. */
export function rollGrade(rng: RngState, luck: number, floor: number, depth: number): number {
  return pickGrade(rng, gradeWeightsAt(veinLevel(MINE_TIER, depth)), luck, floor);
}

const baseMemo = new Map<number, { ids: BaseId[]; w: number[] }>();
function baseTable(level: number): { ids: BaseId[]; w: number[] } {
  let m = baseMemo.get(level);
  if (!m) {
    const bias = MINE_TIERS[MINE_TIER].baseBias;
    const w = BASE_IDS.map((b) => BASES[b]!.weight * (bias[b] ?? 1) * (level >= BASES[b]!.minLevel ? 1 : BASE_BELOW));
    baseMemo.set(level, (m = { ids: BASE_IDS.slice(), w }));
  }
  return m;
}

const poolMemo = new Map<string, { ids: ModId[]; w: number[] }>();
/** The modifiers a stone of this affinity and grade can roll at a vein level (no curses). */
export function modPool(aff: Affinity, grade: number, level: number): { ids: ModId[]; w: number[] } {
  const key = `${aff}:${grade}:${level}`;
  let m = poolMemo.get(key);
  if (!m) {
    const ids = MOD_IDS.filter((id) => {
      const d = MODS[id]!;
      return !d.curse && (d.affinity === null || d.affinity === aff) && d.minGrade <= grade && d.minDepth <= level;
    });
    poolMemo.set(key, (m = { ids, w: ids.map((id) => MODS[id]!.weight) }));
  }
  return m;
}

function pickW<T>(rng: RngState, ids: readonly T[], w: readonly number[], skip: ReadonlySet<T>): { id: T; p: number } | null {
  let total = 0;
  for (let i = 0; i < ids.length; i++) if (!skip.has(ids[i]!)) total += w[i]!;
  if (total <= 0) return null;
  let r = rand(rng) * total;
  for (let i = 0; i < ids.length; i++) {
    if (skip.has(ids[i]!)) continue;
    r -= w[i]!;
    if (r < 0) return { id: ids[i]!, p: w[i]! / total };
  }
  return null;
}

/** A modifier's tier at a grade and vein level (centred on the grade, capped by the level). */
export function rollModTier(rng: RngState, grade: number, level: number): number {
  const r = rand(rng);
  const t = GRADE.modTier[grade]! + (r < 0.2 ? -1 : r > 0.8 ? 1 : 0) + Math.floor(MINE_TIERS[MINE_TIER].modTierBonus);
  return Math.max(1, Math.min(maxModTier(level), t));
}

/** One modifier (value from its tier; Flame stones' modifiers are half again as strong). */
export function makeMod(id: ModId, tier: number, aff: Affinity): Mod {
  const d = MODS[id]!;
  const raw = d.values[tier - 1] ?? d.values[0]!;
  const value = d.family === 'actionPoint' || d.field ? raw : aff === 'flame' ? Math.max(1, Math.round(raw * 1.5)) : raw;
  return { id, tier, value, curse: !!d.curse };
}

export interface RollOpts {
  depth?: number;
  luck?: number;
  floor?: number;
  /** Force the grade (the vault, blessings, the start stones). */
  tier?: number;
}

export interface Roll {
  seed: number;
  tier: number;
  base: BaseId;
  affinity: Affinity;
  mods: Mod[];
  slots: number;
  odd: OddEffectId | null;
  oneIn: number;
}

/** Roll a whole crystal (deterministic for the RngState). */
export function rollCrystal(rng: RngState, o: RollOpts = {}): Roll {
  const level = veinLevel(MINE_TIER, o.depth ?? 1);
  const luck = o.luck ?? 0;
  const floor = o.floor ?? 0;
  const gw = gradeWeightsAt(level);
  const tier = o.tier !== undefined ? Math.max(0, Math.min(5, Math.round(o.tier))) : pickGrade(rng, gw, luck, floor);
  let p = o.tier !== undefined ? 1 : chancesOf(gw, luck, floor)[tier]!;
  const bt = baseTable(level);
  const bp = pickW(rng, bt.ids, bt.w, new Set())!;
  p *= bp.p;
  const aw = MINE_TIERS[MINE_TIER].affinityWeights;
  const ap = pickW(rng, AFFINITY_IDS, AFFINITY_IDS.map((a) => aw[a]), new Set())!;
  p *= ap.p;
  const slots = GRADE.slots[tier]! + (BASES[bp.id]!.inherent.slots ?? 0);
  const lo = GRADE.filledMin[tier]!;
  const hi = GRADE.filledMax[tier]!;
  const n = Math.min(slots, lo + Math.floor(rand(rng) * (hi - lo + 1)));
  const pool = modPool(ap.id, tier, level);
  const taken = new Set<ModId>();
  const mods: Mod[] = [];
  for (let i = 0; i < n; i++) {
    if (chance(rng, GRADE.curseChance)) {
      const k = CURSE_IDS.filter((x) => !taken.has(x));
      const id = k[Math.floor(rand(rng) * k.length)];
      if (id) {
        taken.add(id);
        mods.push(makeMod(id, rollModTier(rng, tier, level), ap.id));
        p *= GRADE.curseChance / CURSE_IDS.length;
        continue;
      }
    }
    const pick = pickW(rng, pool.ids, pool.w, taken);
    if (!pick) break;
    taken.add(pick.id);
    mods.push(makeMod(pick.id, rollModTier(rng, tier, level), ap.id));
    p *= Math.min(1, MODS[pick.id]!.weight / MOD_RARE_AT);
  }
  let odd: OddEffectId | null = null;
  if (chance(rng, GRADE.effectChance[tier]!)) {
    odd = ODD_EFFECT_IDS[Math.floor(rand(rng) * ODD_EFFECT_IDS.length)]!;
    p *= GRADE.effectChance[tier]! / ODD_EFFECT_IDS.length;
  }
  const seed = nextU32(rng);
  return { seed, tier, base: bp.id, affinity: ap.id, mods, slots, odd, oneIn: Math.max(1, Math.round(1 / p)) };
}

/** The stone's own short name: prefix + base + suffix ("Keen Tooth of the Pit"). */
export function crystalName(base: string, mods: readonly Mod[]): string {
  const pre = mods.find((m) => MODS[m.id]!.slot === 'prefix');
  const suf = mods.find((m) => MODS[m.id]!.slot === 'suffix');
  return [pre && uiText(`mod.${pre.id}.name`), uiText(`base.${base}.name`), suf && uiText(`mod.${suf.id}.name`)].filter(Boolean).join(' ');
}

/** A new crystal into the state at `at` (the roll draws from the state's RNG). */
export function newCrystal(s: GameState, at: Crystal['at'], o: RollOpts = {}): Crystal {
  const r = rollCrystal(s.rng, o);
  const c: Crystal = {
    id: `x${s.next++}`, seed: r.seed, grade: GRADES[r.tier]!, base: r.base, affinity: r.affinity as Affinity, mods: r.mods,
    slots: r.slots, depth: Math.max(1, Math.min(3, o.depth ?? 1)), odd: r.odd, oneIn: r.oneIn, name: crystalName(r.base, r.mods), at,
  };
  s.crystals[c.id] = c;
  return c;
}

/** Drop one grade (Unstable cracking): slots shrink, the last modifier goes if over. */
export function crackDown(c: Crystal): void {
  const t = tierOf(c.grade);
  if (t <= 0) return;
  c.grade = GRADES[t - 1]!;
  c.slots = Math.max(1, c.slots - (GRADE.slots[t]! - GRADE.slots[t - 1]!));
  while (c.mods.length > c.slots) c.mods.pop();
}

// ---------- reading a crystal ----------

/** What a stone feeds when eaten (Hunger stones ×1.5, the base's `eatMult`). */
export function eatWorth(c: Crystal): number {
  return worth(c) * (BASES[c.base]!.inherent.eatMult ?? 1) * (c.affinity === 'hunger' ? CRYSTAL.hungerEat : 1);
}

/** What a stone counts for burnt into a miracle of `nature` (own nature ×1.5, the base's `burnMult`). */
export function burnWorth(c: Crystal, nature: Affinity | null): number {
  return Math.round(worth(c) * (BASES[c.base]!.inherent.burnMult ?? 1) * (nature && c.affinity === nature ? CRYSTAL.burnMatch : 1) * 10) / 10;
}

/** Each set stone in socket order (no allocation: the callback walks them). */
function eachSet(s: Readonly<GameState>, f: (c: Crystal) => void): void {
  for (const id of s.god.sockets) {
    const c = id ? s.crystals[id] : undefined;
    if (c) f(c);
  }
}

/** Set stones of an affinity (resonance: two strengthen each other, three wake the set power). */
export function setCount(s: Readonly<GameState>, a: Affinity): number {
  let n = 0;
  eachSet(s, (c) => { if (c.affinity === a) n += 1; });
  return n;
}

/** What the awake set powers (`SET_SIZE` set stones of one affinity, content's `SET_POWER`) add to `e`. */
export function setBonus(s: Readonly<GameState>, e: SetEffect): number {
  let v = 0;
  for (const a of AFFINITY_IDS) if (setCount(s, a) >= SET_SIZE) v += SET_POWER[a][e] ?? 0;
  return v;
}

/** A hallowed (unprofaned) Flame stone is set: it quarrels with the rest and costs its price each day. */
export function hallowed(s: Readonly<GameState>): number {
  let n = 0;
  eachSet(s, (c) => { if (c.affinity === 'flame' && !c.profaned) n += 1; });
  return n;
}

/** A modifier family summed over the set stones: × Unstable, resonance and Flame's quarrel; curse prices; base properties. */
export function lineTotal(s: Readonly<GameState>, id: StatLineId): number {
  const quarrel = hallowed(s) > 0;
  let n = 0;
  eachSet(s, (c) => {
    let k = 1;
    if (id !== 'actionPoint') {
      if (c.odd === 'unstable') k *= EFFECT.unstableMult;
      if (setCount(s, c.affinity) >= 2) k *= CRYSTAL.resonance2;
      if (quarrel && c.affinity !== 'flame') k *= CRYSTAL.flameQuarrel;
    }
    for (const m of c.mods) {
      const d = MODS[m.id];
      if (!d) continue;
      if (d.family === id) n += m.value * k;
      if (d.curse?.family === id) n += d.curse.values[m.tier - 1] ?? 0;
    }
    const inh = BASES[c.base]!.inherent;
    if (inh.family === id) n += inh.value ?? 0;
  });
  return Math.round(n * 10) / 10;
}

/** A strange-modifier field summed over the set stones (and curse prices). */
export function fieldTotal(s: Readonly<GameState>, f: ModField): number {
  let n = 0;
  eachSet(s, (c) => {
    for (const m of c.mods) {
      const d = MODS[m.id];
      if (!d) continue;
      if (d.field === f) n += m.value;
      if (d.curse?.field === f) n += d.curse.values[m.tier - 1] ?? 0;
    }
  });
  return n;
}

/** Set stones carrying this odd effect. */
export function oddCount(s: Readonly<GameState>, e: OddEffectId): number {
  let n = 0;
  eachSet(s, (c) => { if (c.odd === e) n += 1; });
  return n;
}
