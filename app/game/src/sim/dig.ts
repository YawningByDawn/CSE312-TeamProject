/**
 * The host at work in the mine (OVERHAUL, ov-mine; content's MINING, DROP, POCKET, ROLES' quota): the body walks (walk.ts),
 * a miner works the ore in reach for its seconds and draws its crystal from the ore's own grade table, delivers stones at
 * the pit's drop, and at the dusk the day's quota and pocket are weighed against the Public's heat. Content's tables hold
 * every number; the host's own (Strength, Dexterity, Devotion) set the speed, the seconds and the rarity.
 */
import { DAY_TICK_S, dayOf } from '../content/clock';
import { GRADE_VALUE, GRADES } from '../content/crystals';
import { DROP, MINING, ORE_SITES, POCKET, areaAt } from '../content/mine';
import { ROLES } from '../content/roles';
import { addHeat, area, cash, digs, ev, type Ctx } from './core';
import { act } from './colour';
import { newCrystal, tierOf } from './crystals';
import { miningRarity, miningSeconds, oreOdds, walkSpeed } from './formulas';
import { rand } from './rng';
import { walk } from './walk';
import { xyOf } from './world/xy';
import type { Body, GameState, Person, Reason } from '../types';

/** A body for `p` where they stand now, resting. */
export function spawn(s: Readonly<GameState>, p: Readonly<Person>): Body {
  const { x, y } = xyOf(p, s.tick);
  return { x, y, face: 1, dx: 0, dy: 0, walked: 0, ore: null, work: 0, dug: 0, delivered: 0, swing: -1, ax: 1, ay: 0 };
}

/** The ore site stands: not mined today. */
export const oreStands = (s: Readonly<GameState>, site: number): boolean => s.ores[site] !== dayOf(s.tick);

/** The nearest standing ore within reach of the body, as its site index. */
function oreNear(s: Readonly<GameState>, b: Readonly<Body>): number | null {
  let best: number | null = null, d: number = MINING.reach;
  for (let i = 0; i < ORE_SITES.length; i++) {
    const k = Math.hypot(ORE_SITES[i]!.x - b.x, ORE_SITES[i]!.y - b.y);
    if (k <= d && oreStands(s, i)) [best, d] = [i, k];
  }
  return best;
}

const atDrop = (b: Readonly<Body>): boolean => Math.hypot(DROP.x - b.x, DROP.y - b.y) <= DROP.reach;

/** What the work key does the host at `b`: mine the ore in reach, else deliver at the drop; null: neither. */
export function workAt(s: Readonly<GameState>, b: Readonly<Body>): { mine: number } | 'drop' | null {
  const ore = oreNear(s, b);
  return ore !== null ? { mine: ore } : atDrop(b) ? 'drop' : null;
}

export const oreSeconds = (p: Readonly<Person>, site: number): number => miningSeconds(ORE_SITES[site]!.tier, p.stats);

/** Why the work key is refused the host `p` at `b` (empty: allowed). */
export function workWhy(s: Readonly<GameState>, p: Readonly<Person>, b: Readonly<Body>): Reason[] {
  if (!digs(p)) return [{ key: 'why.notMiner' }];
  const w = workAt(s, b);
  if (w === null) return [{ key: 'why.nothingToWork' }];
  return w === 'drop' && p.pocket.length === 0 ? [{ key: 'why.nothingToDeliver' }] : [];
}

/** The work key: at an ore start (or, on the ore being worked, stop) mining it; at the drop deliver the lowest stone pocketed. */
export function work(c: Ctx, p: Person, b: Body): void {
  const w = workAt(c.s, b)!;
  if (w === 'drop') return deliver(c, p, b);
  [b.ore, b.work] = [b.ore === w.mine ? null : w.mine, 0];
}

/** The lowest stone of the pocket goes into the lift's cart as the grade it is. */
function deliver(c: Ctx, p: Person, b: Body): void {
  const s = c.s;
  const id = [...p.pocket].sort((x, y) => GRADE_VALUE[s.crystals[x]!.grade] - GRADE_VALUE[s.crystals[y]!.grade] || (x < y ? -1 : 1))[0]!;
  (s.mine.carts[area('lift')] ??= []).push(tierOf(s.crystals[id]!.grade));
  ev(c, { kind: 'cart', unit: p.id, place: 'lift', crystal: id });
  p.pocket.splice(p.pocket.indexOf(id), 1);
  delete s.crystals[id];
  b.delivered += 1;
  act(c, 'lift');
}

/** One tick of the host's day: a heading walks (and ends any mining); an ore in hand takes its seconds, then gives its crystal. */
export function bodyTick(c: Ctx, p: Person, b: Body): void {
  const s = c.s;
  if (b.swing >= 0) return; // a swing holds the feet (fight.ts)
  if (b.dx !== 0 || b.dy !== 0) {
    [b.ore, b.work] = [null, 0];
    walk(b, walkSpeed(p.stats.dexterity), DAY_TICK_S);
    const at = areaAt(b.x, b.y);
    if (at) s.places[at]!.explored = true; // ground the host has stood on is no longer dark
    return;
  }
  if (b.ore === null) return;
  if (!oreStands(s, b.ore) || oreNear(s, b) !== b.ore) {
    [b.ore, b.work] = [null, 0];
    return;
  }
  b.work += DAY_TICK_S;
  if (b.work < oreSeconds(p, b.ore)) return;
  const site = ORE_SITES[b.ore]!;
  const odds = oreOdds(site.tier, miningRarity(p.stats.devotion));
  let r = rand(s.rng), g = 0;
  while (g < odds.length - 1 && (r -= odds[g]!) >= 0) g++;
  const x = newCrystal(s, { pocket: p.id }, { tier: g, depth: site.tier });
  x.oneIn = Math.round(x.oneIn / odds[g]!);
  p.pocket.push(x.id);
  s.ores[b.ore] = dayOf(s.tick);
  [b.ore, b.work, b.dug] = [null, 0, b.dug + 1];
  ev(c, { kind: 'strike', unit: p.id, place: site.place, crystal: x.id, grade: GRADES[g]!, oneIn: x.oneIn });
  act(c, site.place);
}

/**
 * The dusk, a standing host's day weighed: each ore of the trade's quota not delivered, and each stone pocketed over the
 * free few, heats the Public; what is pocketed goes to the god's pouch as tribute.
 */
export function settleDay(c: Ctx, p: Person, b: Body): void {
  const short = Math.max(0, ROLES[p.role]!.quota - b.delivered), over = Math.max(0, p.pocket.length - POCKET.free);
  if (short > 0) addHeat(c, 'public', short * POCKET.shortEach, 'quotaShort');
  if (over > 0) addHeat(c, 'public', over * POCKET.heatEach, 'pocketed');
  for (const id of [...p.pocket]) cash(c, p, id, 'tribute');
}
