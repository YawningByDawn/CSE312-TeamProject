/**
 * The god in a host (OVERHAUL; content's STATS, HOST, FIRST_MINER): at each dawn the god possesses one follower, the
 * first miner always among the choices, and plays the day as them; at the dusk it lets go. By day the host marks
 * people near them (a whisper at night reaches only the marked); a host at 0 HP has fallen and the first miner takes over
 * at once; hit points come from Strength and Endurance and mend with Endurance.
 */
import { TPH, dayOf, isDay } from '../content/clock';
import { FIRST_MINER, HOST, STATS } from '../content/stats';
import { ev, everyone, here, pouchIds, remove, spend, whereNow, type Ctx } from './core';
import { act } from './colour';
import { settleDay, spawn, workWhy } from './dig';
import { maxHp } from './formulas';
import { xyOf } from './world/xy';
import type { Action, Body, GameState, Person, Reason, UnitId } from '../types';

type Check = Reason[];

const first = (s: Readonly<GameState>): Person => s.people[FIRST_MINER.id]!;
/** Down: out of HP, or gone from the world. */
export const fell = (p: Readonly<Person>): boolean => p.stats.hp <= 0 || p.gone !== null;

/** Whom the god possesses now, if they stand. */
export const hostOf = (s: Readonly<GameState>): Person | null => {
  const h = s.host === null ? null : s.people[s.host]!;
  return h && !fell(h) ? h : null;
};

/** The dawn's list: the first miner, then the living followers. */
export function hosts(s: Readonly<GameState>): UnitId[] {
  return [FIRST_MINER.id, ...everyone(s).filter((p) => p.follower && here(p) && p.id !== FIRST_MINER.id).map((p) => p.id)];
}

/** Days a person's mark has left, today counted. */
export function markLeft(s: Readonly<GameState>, p: Readonly<Person>): number {
  return p.marked === undefined ? 0 : Math.max(0, p.marked + HOST.markDays - dayOf(s.tick));
}

/** The marks made today. */
export const marksToday = (s: Readonly<GameState>): number => everyone(s).filter((p) => p.marked === dayOf(s.tick)).length;

/** The standing host's body in the mine, with the host. */
export function bodyOf(s: Readonly<GameState>): { host: Person; body: Body } | null {
  const host = hostOf(s);
  return host && s.body ? { host, body: s.body } : null;
}

/** The people the host could mark from where they stand: not yours, within `HOST.markReach` of the body, the nearest first. */
export function near(s: Readonly<GameState>): UnitId[] {
  const h = bodyOf(s);
  if (!h) return [];
  const d = (p: Person): number => { const o = xyOf(p, s.tick); return Math.hypot(o.x - h.body.x, o.y - h.body.y); };
  return everyone(s).filter((p) => p !== h.host && here(p) && !p.follower).map((p) => [p, d(p)] as const)
    .filter(([, k]) => k <= HOST.markReach).sort((a, b) => a[1] - b[1] || (a[0].id < b[0].id ? -1 : 1)).map(([p]) => p.id);
}

/** Why the day's actions are refused (`mark`, `possess`, `walk`, `work`); empty: allowed. */
export function dayWhy(s: Readonly<GameState>, a: Action): Check {
  if (a.type === 'possess') {
    if (s.host === a.unit && s.body !== null) return [{ key: 'why.hosting' }];
    return hosts(s).includes(a.unit) ? [] : [{ key: 'why.notOffered' }];
  }
  const on = bodyOf(s);
  if (a.type === 'walk') return on ? [] : [{ key: 'why.noHost' }];
  if (a.type === 'work') return on ? workWhy(s, on.host, on.body) : [{ key: 'why.noHost' }];
  if (a.type === 'swing') return !on ? [{ key: 'why.noHost' }] : on.body.swing >= 0 ? [{ key: 'why.swinging' }] : [];
  if (a.type !== 'mark') return [{ key: 'why.day' }];
  const p = s.people[a.target];
  if (!hostOf(s)) return [{ key: 'why.noHost' }];
  if (!p || !here(p)) return [{ key: 'why.noOne' }];
  if (p.follower) return [{ key: 'why.already' }];
  if (!near(s).includes(p.id)) return [{ key: 'why.notNear' }];
  if (p.marked === dayOf(s.tick)) return [{ key: 'why.marked' }];
  return marksToday(s) >= HOST.marksPerDay ? [{ key: 'why.marksSpent', slots: { n: HOST.marksPerDay } }] : [];
}

export function mark(c: Ctx, p: Person): void {
  p.marked = dayOf(c.s.tick);
  ev(c, { kind: 'marked', unit: p.id, place: whereNow(p, c.s.tick), note: { key: 'host.marked', slots: { name: p.name } } });
  act(c, whereNow(p, c.s.tick));
}

export function possess(c: Ctx, unit: UnitId): void {
  c.s.host = unit;
  c.s.body = spawn(c.s, c.s.people[unit]!);
  ev(c, { kind: 'possess', unit, note: { key: 'host.possess', slots: { name: c.s.people[unit]!.name } } });
}

/** One person back in the world at full HP, at home: a follower again if their Devotion stands. */
function raise(p: Person): void {
  p.gone = null;
  delete p.goneDay;
  p.follower = p.stats.devotion > 0;
  p.routine = p.follower ? 'pray' : null;
  p.stats.hp = maxHp(p.stats);
  p.at = { place: p.home, spot: 'place' in p.at ? p.at.spot : 0, doing: 'idle' };
}

/**
 * The dawn: the first miner is back if he fell, then the one choice is made for the player (the list holds only him). With
 * more on the list the pick opens on the last host if they are still on it, else on the first miner: someone is always
 * possessed, the pick only says whom.
 */
export function dawnHost(c: Ctx): void {
  const s = c.s;
  if (fell(first(s))) raise(first(s));
  const list = hosts(s);
  if (list.length === 1) possess(c, list[0]!);
  else if (s.host === null || !list.includes(s.host)) s.host = FIRST_MINER.id;
}

/** By day, when the host in a body has fallen the first miner takes over at once, whole and at home, the skeletons gone. Called after whatever may hurt (a tick, an action). */
export function relieve(c: Ctx): void {
  const s = c.s;
  if (!s.body || !isDay(s.tick) || hostOf(s)) return;
  if (fell(first(s))) raise(first(s));
  s.mobs.length = 0;
  possess(c, FIRST_MINER.id);
}

/** The dusk: a standing host's day is weighed (dig.ts), and the god lets go of the body; the host stays the one the plate shows. */
export function duskHost(c: Ctx): void {
  const s = c.s;
  const on = bodyOf(s);
  if (on) settleDay(c, on.host, on.body);
  if (s.host !== null) ev(c, { kind: 'release', unit: s.host });
  s.body = null;
  s.mobs.length = 0;
}

/** A follower who fell (dead, with Devotion left) may be revived at night for stones. */
export function reviveWhy(s: Readonly<GameState>, unit: UnitId): Check {
  const p = s.people[unit];
  if (!p || p.gone !== 'dead' || p.stats.devotion <= 0) return [{ key: 'why.notFallen' }];
  return pouchIds(s).length < HOST.reviveStones ? [{ key: 'why.stones', slots: { n: HOST.reviveStones } }] : [];
}

export function revive(c: Ctx, unit: UnitId): void {
  const p = c.s.people[unit]!;
  spend(c, HOST.reviveStones);
  raise(p);
  ev(c, { kind: 'revived', unit, note: { key: 'host.revived', slots: { name: p.name } } });
}

/**
 * The only way a person loses HP: down to `floor` (a rule may spare them), and at 0 they die, but for the first miner, who
 * only falls (he stands again at the dawn).
 */
export function hurt(c: Ctx, p: Person, n: number, floor = 0): void {
  p.stats.hp = Math.max(floor, p.stats.hp - n);
  if (p.stats.hp <= 0 && p.id !== FIRST_MINER.id) remove(c, p, 'dead');
}

/** Each hour the living mend by their Endurance. */
export function mend(s: GameState): void {
  if (s.tick % TPH !== 0) return;
  for (const p of everyone(s)) {
    const top = maxHp(p.stats);
    if (here(p) && p.stats.hp > 0 && p.stats.hp < top) p.stats.hp = Math.min(top, p.stats.hp + STATS.regenPerEndurance * p.stats.endurance);
  }
}

/** Is the player holding the clock for their pick: it is day and the god has not yet entered a body. */
export const picking = (s: Readonly<GameState>): boolean => s.body === null && isDay(s.tick);
