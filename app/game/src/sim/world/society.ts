/**
 * The people (#48): every trade's headcount from content's role table, the named people in their places, the
 * rest rolled from the seed: a name, a trait, a work place, stats, a bunk, ties to kin, friends and workmates; and
 * the newcomers the rules find.
 */
import { BALANCE, TIES } from '../../content/balance';
import { dayOf } from '../../content/clock';
import { DIGGER_FACES } from '../../content/day';
import { DISCOVERY_NUMBERS } from '../../content/discoveries';
import { BAD, CO, END, ON, VO, WORLD_WORDS } from '../../content/names';
import { PEOPLE } from '../../content/people';
import { ROLES, type RoleDef } from '../../content/roles';
import { FIRST_MINER, STATS, type BodyStats } from '../../content/stats';
import { maxHp } from '../formulas';
import { uiText } from '../../content/text';
import { TRAITS } from '../../content/traits';
import type { GameState, Person, PlaceId, RoleId, Stats, TieKind, TraitId, UnitId } from '../../types';
import { K, idKey, keyed, keyedInt, weighted } from './draw';

const TRAIT_IDS = Object.keys(TRAITS);
const TIE_CAP = 6;

/** A plain, short name (DECISIONS §13.3): three syllable shapes, never a bad or a human-world word, never twice. */
export function makeName(seed: number, n: number, used: Set<string>): string {
  for (let tries = 0; tries < 400; tries++) {
    const d = (i: number): number => keyed(seed, K.name, n, tries * 8 + i);
    const at = <T>(xs: readonly T[], i: number): T => xs[Math.floor(d(i) * xs.length)]!;
    const r = d(0);
    const name = r < 0.42 ? at(ON, 1) + at(VO, 2) + at(CO, 3)
      : r < 0.8 ? at(ON, 1) + at(VO, 2) + at(['', 'r', 'l', 'n', 's'], 3) + at(END, 4)
        : at(ON, 1) + at(VO, 2) + at(CO, 3) + at(['a', 'o', 'e', 'i'], 4);
    if (name.length < 3 || name.length > 7 || BAD.has(name) || WORLD_WORDS.has(name.toLowerCase()) || used.has(name) || /(.)\1\1/i.test(name)) continue;
    used.add(name);
    return name;
  }
  throw new Error(`makeName: no free name for ${n}`);
}

/** The body's four from the seed and the trade's bias; the first miner's are content's, weak for good. */
function statsOf(seed: number, id: UnitId, bias: RoleDef['bias']): Stats {
  const k = idKey(id);
  const [lo, hi] = STATS.roll;
  const roll = (i: number): number => Math.max(STATS.min, Math.min(STATS.max, lo + keyedInt(seed, K.stat, hi - lo + 1, k, i) + bias[i]!));
  const body: BodyStats = id === FIRST_MINER.id ? FIRST_MINER.stats : { strength: roll(0), dexterity: roll(1), intelligence: roll(2), endurance: roll(3) };
  return { devotion: 0, ...body, hp: maxHp(body) };
}

/** One of trade `role` at `work` (else dealt one), with a trait, stats and resistance from the seed and their id. */
function born(seed: number, id: UnitId, role: RoleId, work: PlaceId | undefined, name: string, trait?: TraitId): Person {
  const r = ROLES[role]!;
  const k = idKey(id);
  const w = work ?? (role === 'digger' ? weighted(DIGGER_FACES, keyed(seed, K.work, k)) : r.work[keyedInt(seed, K.work, r.work.length, k)]!);
  const t = trait ?? TRAIT_IDS[keyedInt(seed, K.trait, TRAIT_IDS.length, k)]!;
  const resist = BALANCE.personalResist[0] + keyedInt(seed, K.stat, BALANCE.personalResist[1] - BALANCE.personalResist[0] + 1, k, 9);
  return {
    id, name, role, trait: t, standing: r.standing, stats: statsOf(seed, id, r.bias),
    resistance: Math.max(0, Math.min(60, TRAITS[t]!.resistance + r.resistance + resist)),
    home: 'bunks', work: w, ties: [], at: { place: w, spot: k & 63, doing: 'idle' },
    follower: false, routine: null, pocket: [], caught: 0, gone: null,
  };
}

/**
 * A newcomer, made from the seed into a new `s.people` (so every roster of it is made again): a loner found where
 * they hide (`at`, their area: a digger named by the discovery's words, easy to turn), or fresh hands off the lift
 * (a digger dealt onto a face, bunking in the bunks, one a day at most).
 */
export function spawn(s: GameState, kind: 'loner' | 'fresh', at: PlaceId): Person {
  const day = dayOf(s.tick);
  const loner = kind === 'loner';
  const id = loner ? `loner-${at}` : `fresh-${day}`;
  const name = loner ? uiText(`discovery.${at}.loner`) : makeName(s.seed, 200000 + day, new Set(roster(s).all.map((p) => p.name)));
  const p = born(s.seed, id, 'digger', loner ? at : undefined, name, loner ? 'grieving' : undefined);
  if (loner) p.resistance = DISCOVERY_NUMBERS.lonerResistance;
  p.home = loner ? at : 'bunks';
  p.at = { place: p.home, spot: idKey(id) & 63, doing: 'idle' };
  s.people = { ...s.people, [id]: p };
  return p;
}

/** The seed's people as they are born: trades, works, names, before homes and ties. */
function bear(seed: number): Person[] {
  const used = new Set(PEOPLE.map((p) => p.name.split(' ').pop()!));
  const all: Person[] = [];
  let n = 0;
  for (const [role, r] of Object.entries(ROLES)) {
    const named = PEOPLE.filter((p) => p.role === role);
    for (let i = 0; i < r.count; i++) {
      const def = named[i];
      const id = def?.id ?? `u${++n}`;
      all.push(born(seed, id, role, def?.work, def?.name ?? makeName(seed, n, used), def?.trait));
    }
  }
  return all;
}

/** Everyone into `s.people`, placed where their plan has them at `s.tick` (`at` is set by the world's first step). */
export function populate(s: GameState): Person[] {
  const seed = s.seed;
  const all = bear(seed);
  tie(seed, all);
  s.people = Object.fromEntries(all.map((p) => [p.id, p]));
  return all;
}

/** Each person's own draws, in the order their ties are made: kin, a lender, a rival workmate, a lover. */
const DRAWN = ['kin', 'owes', 'rival', 'lover'] as const;
const DRAW_ODDS = [0.16, 0.2, 0.11, 0.09];

/** Whom the draws choose among: the people as the ties were made, each work's hands. */
interface Pools { all: readonly Person[]; order: Map<UnitId, number>; works: Map<PlaceId, Person[]> }
function poolsOf(all: readonly Person[]): Pools {
  const works = new Map<PlaceId, Person[]>();
  for (const p of all) (works.get(p.work) ?? works.set(p.work, []).get(p.work)!).push(p);
  return { all, order: new Map(all.map((p, i) => [p.id, i])), works };
}
/** Whom `p`'s draw `j` of `DRAWN` names, if it comes up. */
function drawn(seed: number, p: Readonly<Person>, j: number, x: Pools): Person | null {
  const k = idKey(p.id);
  if (keyed(seed, K.tie, k, 10 + j) >= DRAW_ODDS[j]!) return null;
  const pool = j === 2 ? x.works.get(p.work)! : x.all;
  return pool[keyedInt(seed, K.tie, pool.length, k, 20 + j)]!;
}

/** Ties: the draws of `DRAWN`, and friends among workmates (a small crew) or anyone. */
function tie(seed: number, all: Person[]): void {
  const link = (a: Person, b: Person): void => {
    if (a === b || a.ties.includes(b.id) || a.ties.length >= TIE_CAP || b.ties.length >= TIE_CAP) return;
    a.ties.push(b.id);
    b.ties.push(a.id);
  };
  const x = poolsOf(all);
  for (const p of all)
    for (let j = 0; j < DRAWN.length; j++) {
      const q = drawn(seed, p, j, x);
      if (q) link(p, q);
    }
  for (const p of all) {
    const k = idKey(p.id);
    const mates = x.works.get(p.work)!;
    const pool = mates.length <= TIES.workmatesMax ? mates : all;
    for (let i = 0; i < 4 && p.ties.length < 2; i++) link(p, pool[keyedInt(seed, K.tie, pool.length, k, 2 + i)]!);
  }
}

/** Everyone in the order they were made, each one's key and place in it, and the trades: made once for a `s.people` (a load makes another). */
export interface Roster { all: Person[]; key: Uint32Array; index: Map<UnitId, number>; role: Map<RoleId, Person[]> }
const ROSTERS = new WeakMap<object, Roster>();
export function roster(s: Readonly<GameState>): Roster {
  let r = ROSTERS.get(s.people);
  if (!r) {
    const all = Object.values(s.people);
    const role = new Map<RoleId, Person[]>();
    for (const p of all) (role.get(p.role) ?? role.set(p.role, []).get(p.role)!).push(p);
    r = { all, key: Uint32Array.from(all, (p) => idKey(p.id)), index: new Map(all.map((p, i) => [p.id, i])), role };
    ROSTERS.set(s.people, r);
  }
  return r;
}

/** The pools the ties were drawn from: of the seed's people as born, never the living (who change work, and newcomers join). */
let made: { seed: number; x: Pools } | null = null;
const poolsFor = (seed: number): Pools => (made?.seed === seed ? made.x : (made = { seed, x: poolsOf(bear(seed)) }).x);

/**
 * What a tie between two tied people is: the first draw that made it (kin, a debt, a rival, a lover), else friends.
 * The ties are made in that order, so the earliest draw naming the other is it.
 */
export function tieKind(s: Readonly<GameState>, a: Readonly<Person>, b: Readonly<Person>): TieKind {
  const x = poolsFor(s.seed);
  let best = Infinity;
  let kind: TieKind = 'friend';
  for (const [p, q] of [[a, b], [b, a]] as const) {
    const i = x.order.get(p.id);
    if (i === undefined) continue;
    for (let j = 0; j < DRAWN.length; j++) {
      const o = i * DRAWN.length + j;
      if (o < best && drawn(s.seed, x.all[i]!, j, x)?.id === q.id) { best = o; kind = j === 1 && p === b ? 'owed' : DRAWN[j]!; }
    }
  }
  return kind;
}
