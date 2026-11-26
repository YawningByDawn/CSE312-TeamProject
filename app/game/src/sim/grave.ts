/**
 * The grave (spec §7.2-7.3; inventory #28, 29): eating, setting and taking out stones, enchanting and recombining,
 * and what the set stones do at dawn (the Flame's price, Rot, Unstable, Weeping).
 */
import { BALANCE } from '../content/balance';
import { BLESSING } from '../content/blessings';
import { CRYSTAL, EFFECT, GRADES } from '../content/crystals';
import { CURSE_IDS, GRADE, MINE_TIER, MODS } from '../content/gems';
import { dayOf } from '../content/clock';
import { bonus } from './bonus';
import { addHeat, addHunger, addNether, ev, everyone, gainIchor, gainXp, here, maxIchor, type Ctx } from './core';
import { crackDown, crystalName, makeMod, modPool, oddCount, rollModTier, tierOf, veinLevel, worth, eatWorth } from './crystals';
import { active } from './influence';
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
}


export const enchantCost = (s: Readonly<GameState>, x: Crystal): number =>
  Math.max(1, Math.round(CRYSTAL.enchantCost[tierOf(x.grade)]! * (gemcutter(s) ? BLESSING.cutCostMult : 1)));
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
  const tier = top + (top < 5 && chance(s.rng, grafter ? BLESSING.graftGradeUp : CRYSTAL.gradeUp) ? 1 : 0);
  const base = rand(s.rng) < 0.5 ? x.base : y.base;
  const affinity = rand(s.rng) < 0.5 ? x.affinity : y.affinity;
  const extra = (p: Crystal): number => Math.max(0, p.slots - GRADE.slots[tierOf(p.grade)]!);
  const slots = GRADE.slots[tier]! + (grafter ? BLESSING.graftCap : 0) + Math.max(extra(x), extra(y));
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

