/**
 * The grave (spec §7.2-7.3; inventory #28, 29): eating, setting and taking out stones, enchanting and recombining,
 * and what the set stones do at dawn (the Flame's price, Rot, Unstable, Weeping).
 */
import { BALANCE } from '../content/balance';
import { CRYSTAL, EFFECT, GRADES } from '../content/crystals';
import { CURSE_IDS, GRADE, MINE_TIER, MODS } from '../content/gems';
import { dayOf } from '../content/clock';
import { bonus } from './bonus';
import { addHeat, addHunger, addNether, ev, everyone, gainIchor, gainXp, here, maxIchor, type Ctx } from './core';
import { crackDown, crystalName, makeMod, modPool, oddCount, rollModTier, tierOf, veinLevel, worth, eatWorth } from './crystals';
import { active } from './influence';
import { benchWhy } from './town';
import { chance, pick, rand, weightedPick } from './rng';
import type { Crystal, GameState, Mod, ModId, Reason } from '../types';

const inPouch = (x: Crystal | undefined): x is Crystal => !!x && 'pouch' in x.at;
const gemcutter = (s: Readonly<GameState>): boolean => s.god.blessings.includes('gemcutter');

export function eatWhy(s: Readonly<GameState>, id: string): Reason[] {
  return inPouch(s.crystals[id]) ? [] : [{ key: 'why.notInPouch' }];
}
/** The Hunger a stone takes away when eaten: its feeding worth. */
export const eatHunger = (x: Crystal): number => eatWorth(x) * BALANCE.hungerPerValue;

/** Eat a stone: Hunger falls by its feeding worth; Nether for the gluttonous; XP for the soul. */
export function eat(c: Ctx, id: string): void {
  const x = c.s.crystals[id]!;
  addHunger(c, -eatHunger(x));
  addNether(c, bonus(c.s, 'eatNether') * worth(x));
  gainXp(c, BALANCE.xpEat + BALANCE.xpPerSoul * worth(x));
  ev(c, { kind: 'eat', crystal: id });
  delete c.s.crystals[id];
}

export function setWhy(s: Readonly<GameState>, id: string, socket: number): Reason[] {
  if (!inPouch(s.crystals[id])) return [{ key: 'why.notInPouch' }];
  if (socket < 0 || socket >= s.god.sockets.length) return [{ key: 'why.noSocket' }];
  return s.god.sockets[socket] ? [{ key: 'why.socketFull' }] : [];
}
export function set(c: Ctx, id: string, socket: number): void {
  c.s.god.sockets[socket] = id;
  c.s.crystals[id]!.at = { socket };
  ev(c, { kind: 'set', crystal: id });
}

export function unsetWhy(s: Readonly<GameState>, id: string): Reason[] {
  const x = s.crystals[id];
  return x && 'socket' in x.at ? [] : [{ key: 'why.notSet' }];
}
export function unset(c: Ctx, id: string): void {
  const s = c.s;
  const k = s.god.sockets.indexOf(id);
  s.god.sockets[k] = null;
  s.crystals[id]!.at = { pouch: true };
  s.god.ichor = Math.min(s.god.ichor, maxIchor(s));
  ev(c, { kind: 'unset', crystal: id });
  fadeEchoes(c);
}


export const enchantCost = (s: Readonly<GameState>, x: Crystal): number =>
  Math.max(1, Math.round(CRYSTAL.enchantCost[tierOf(x.grade)]! * (gemcutter(s) ? 0.5 : 1)));
export const recombineCost = (a: Crystal, b: Crystal): number => CRYSTAL.recombineCost[Math.max(tierOf(a.grade), tierOf(b.grade))]!;

function enchantPool(x: Crystal, keep: number | undefined): ModId[] {
  const own = new Set(x.mods.filter((_, i) => i !== keep).map((m) => m.id));
  return modPool(x.affinity, tierOf(x.grade), veinLevel(MINE_TIER, x.depth)).ids.filter((id) => !own.has(id));
}

export function enchantWhy(s: Readonly<GameState>, id: string, reroll?: number): Reason[] {
  const x = s.crystals[id];
  if (!x || !('pouch' in x.at || 'socket' in x.at)) return [{ key: 'why.notAtGrave' }];
  if (reroll === undefined ? x.mods.length >= x.slots : !x.mods[reroll]) return [{ key: 'why.noSlot' }];
  return enchantPool(x, reroll).length === 0 ? [{ key: 'why.nothingToAdd' }] : [];
}

/** Add a modifier to an open slot, or reroll the one named; a small chance it comes out a curse (never for Old Facets). */
export function enchant(c: Ctx, id: string, reroll?: number): void {
  const s = c.s;
  const x = s.crystals[id]!;
  const t = tierOf(x.grade);
  const level = veinLevel(MINE_TIER, x.depth);
  let mod: Mod;
  const curses = CURSE_IDS.filter((k) => !x.mods.some((m) => m.id === k));
  if (!gemcutter(s) && curses.length > 0 && chance(s.rng, CRYSTAL.enchantCurse)) {
    mod = makeMod(pick(s.rng, curses)!, rollModTier(s.rng, t, level), x.affinity);
    ev(c, { kind: 'curse', crystal: id });
  } else mod = makeMod(weightedPick(s.rng, enchantPool(x, reroll), (k) => MODS[k]!.weight)!, rollModTier(s.rng, t, level), x.affinity);
  if (reroll === undefined) x.mods.push(mod);
  else x.mods[reroll] = mod;
  x.name = crystalName(x.base, x.mods);
  ev(c, { kind: 'enchant', crystal: id });
}

export function recombineWhy(s: Readonly<GameState>, a: string, b: string): Reason[] {
  const x = s.crystals[a];
  const y = s.crystals[b];
  return a === b || !inPouch(x) || !inPouch(y) ? [{ key: 'why.notInPouch' }] : [];
}

/** Two stones become one: a parent's base, a parent's affinity, both parents' modifiers up to the cap, the higher grade (maybe a step up). */
export function recombine(c: Ctx, a: string, b: string): void {
  const s = c.s;
  const x = s.crystals[a]!;
  const y = s.crystals[b]!;
  const grafter = s.god.blessings.includes('grafter');
  const top = Math.max(tierOf(x.grade), tierOf(y.grade));
  const tier = top + (top < 5 && chance(s.rng, grafter ? 0.25 : CRYSTAL.gradeUp) ? 1 : 0);
  const base = rand(s.rng) < 0.5 ? x.base : y.base;
  const affinity = rand(s.rng) < 0.5 ? x.affinity : y.affinity;
  const extra = (p: Crystal): number => Math.max(0, p.slots - GRADE.slots[tierOf(p.grade)]!);
  const slots = GRADE.slots[tier]! + (grafter ? 1 : 0) + Math.max(extra(x), extra(y));
  const pool = [...x.mods, ...y.mods.filter((m) => !x.mods.some((n) => n.id === m.id))];
  const mods: Mod[] = [];
  while (mods.length < slots && pool.length > 0) mods.push(pool.splice(Math.floor(rand(s.rng) * pool.length), 1)[0]!);
  const odd = x.odd && y.odd ? (rand(s.rng) < 0.5 ? x.odd : y.odd) : (x.odd ?? y.odd);
  const id = `x${s.next++}`;
  s.crystals[id] = {
    id, seed: (x.seed ^ y.seed) >>> 0, grade: GRADES[tier]!, base, affinity, mods, slots, depth: Math.max(x.depth, y.depth), odd,
    oneIn: Math.max(x.oneIn, y.oneIn), name: crystalName(base, mods), at: { pouch: true },
  };
  delete s.crystals[a];
  delete s.crystals[b];
  ev(c, { kind: 'recombine', crystal: id });
}

// ---------- the gem workshop's re-cut (DECISIONS §72) ----------

/** A line whose number a re-cut can reshape (fields and action points stay as they are). */
const reshapes = (m: Mod): boolean => !!MODS[m.id] && !MODS[m.id]!.field && MODS[m.id]!.family !== 'actionPoint';
/** The values a gentle or bold cut can give a line: round(v × 0.8 … 1.4), never below 1. */
const cutRange = (v: number): [number, number] => [Math.max(1, Math.round(v * 0.8)), Math.max(1, Math.round(v * 1.4 - 1e-9))];
const cutSig = (ms: readonly Mod[]): string => ms.map((m) => `${m.id}:${m.value}${m.curse ? '!' : ''}`).join(',');
const setSig = (cuts: readonly Mod[][]): string => cuts.map(cutSig).sort().join('|');
/** The third cut drops line `k`; the rest grow half again. */
const dropCut = (x: Crystal, k: number): Mod[] => x.mods.filter((_, j) => j !== k).map((m) => ({ ...m, value: reshapes(m) ? Math.round(m.value * 1.5) : m.value }));

export const facetCost = (s: Readonly<GameState>, x: Crystal): number =>
  Math.max(1, Math.round(CRYSTAL.facetCost[tierOf(x.grade)]! * (gemcutter(s) ? 0.5 : 1)));

/** Can a re-cut ever offer anything but what the stone is: a number that can move, or two lines whose dropping differs. */
export function canFacet(x: Crystal): boolean {
  if (x.mods.some((m) => reshapes(m) && cutRange(m.value)[0] < cutRange(m.value)[1])) return true;
  return x.mods.length > 1 && new Set(x.mods.map((_, k) => cutSig(x.mods.filter((_, j) => j !== k)))).size > 1;
}

export function facetWhy(s: Readonly<GameState>, id: string): Reason[] {
  const r = benchWhy(s, 'faceting', id);
  if (r.length > 0) return r;
  return canFacet(s.crystals[id]!) ? [] : [{ key: 'why.cutAsIs' }];
}

/** One roll of the three cuts: a gentle and a bold one reshape each line ×0.8–1.4; the third drops one for strength. */
function rollCuts(s: GameState, x: Crystal): Mod[][] {
  const out: Mod[][] = [];
  for (let i = 0; i < 3; i++) {
    if (i === 2 && x.mods.length > 1) out.push(dropCut(x, Math.floor(rand(s.rng) * x.mods.length)));
    else out.push(x.mods.map((m) => ({ ...m, value: reshapes(m) ? Math.max(1, Math.round(m.value * (0.8 + 0.6 * rand(s.rng)))) : m.value })));
  }
  return out;
}

/**
 * A paid re-cut always changes something: the set differs from the stone's last offered set and one cut differs from
 * the stone. It rolls again from the seeded rng until both hold; past 24 tries one cut takes the first other value or
 * line the stone allows, so it always ends.
 */
function cutsFor(s: GameState, x: Crystal): Mod[][] {
  const ok = (o: Mod[][]): boolean => setSig(o) !== x.lastCuts && o.some((m) => cutSig(m) !== cutSig(x.mods));
  let out = rollCuts(s, x);
  for (let t = 0; !ok(out) && t < 24; t++) out = rollCuts(s, x);
  if (ok(out)) return out;
  for (let i = 0; i < out.length; i++) {
    const tries = i === 2 && x.mods.length > 1
      ? x.mods.map((_, k) => dropCut(x, k))
      : x.mods.flatMap((m, k) => {
        if (!reshapes(m)) return [];
        const [lo, hi] = cutRange(m.value);
        return Array.from({ length: hi - lo + 1 }, (_, v) => out[i]!.map((y, j) => (j === k ? { ...y, value: lo + v } : y)));
      });
    for (const t of tries) {
      const next = out.map((o, j) => (j === i ? t : o));
      if (ok(next)) return next;
    }
  }
  return out;
}

/** Pay the re-cut and offer its three cuts; the clock waits for the choice. */
export function facet(c: Ctx, id: string): void {
  const s = c.s;
  const x = s.crystals[id]!;
  const cuts = cutsFor(s, x);
  x.lastCuts = setSig(cuts);
  s.pending = { kind: 'facet', crystal: id, cuts };
}

export const chooseCutWhy = (s: Readonly<GameState>, index: number): Reason[] =>
  s.pending?.kind !== 'facet' ? [{ key: 'why.closed' }] : s.pending.cuts[index] ? [] : [{ key: 'why.pickOne' }];

/** The chosen cut becomes the stone: its lines, a new face (seed) and name. */
export function chooseCut(c: Ctx, index: number): void {
  const p = c.s.pending as Extract<GameState['pending'], { kind: 'facet' }>;
  const x = c.s.crystals[p.crystal]!;
  c.s.pending = null;
  x.mods = p.cuts[index]!.map((m) => ({ ...m }));
  x.seed = (x.seed * 1664525 + 1013904223) >>> 0;
  x.name = crystalName(x.base, x.mods);
  ev(c, { kind: 'facet', crystal: x.id });
}


export function graveDawn(c: Ctx): void {
  const s = c.s;
  for (const id of s.god.sockets) {
    const x = id ? s.crystals[id] : undefined;
    if (!x) continue;
    if (x.affinity === 'flame' && !x.profaned) {
      addHunger(c, CRYSTAL.flameHunger);
      addHeat(c, 'temple', CRYSTAL.flameTemple, 'flamePrice');
    }
    if (x.odd === 'rot') rot(c);
    if (x.odd === 'unstable' && chance(s.rng, EFFECT.unstableCrack)) {
      if (tierOf(x.grade) === 0) {
        s.god.sockets[s.god.sockets.indexOf(x.id)] = null;
        delete s.crystals[x.id];
      } else crackDown(x);
      ev(c, { kind: 'unset', crystal: x.id });
      fadeEchoes(c);
    }
  }
  const weeping = oddCount(s, 'weeping');
  if (weeping > 0 && dayOf(s.tick) % EFFECT.weepingEvery === 0) gainIchor(c, weeping);
}

/** Rot: someone on your colour softens. */
function rot(c: Ctx): void {
  const s = c.s;
  const pool = everyone(s).filter((p) => here(p) && !p.follower && active(s, p.home));
  if (pool.length > 0) pool[Math.floor(rand(s.rng) * pool.length)]!.resistance += EFFECT.rotResistance;
}

/** An Echo copy fades when the stone that called it is no longer set. */
export function fadeEchoes(c: Ctx): void {
  const s = c.s;
  for (const p of everyone(s)) if (p.echoOf && here(p) && oddCount(s, 'echo') === 0) p.gone = 'left';
}

