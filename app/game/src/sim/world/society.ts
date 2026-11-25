/**
 * The people (#48): every trade's headcount from content's role table, the named people in their places, the
 * rest rolled from the seed: a name, a trait, a work place, stats, a home in a household, ties to kin, friends
 * and workmates, and the masters of the buildings; and the newcomers the rules find.
 */
import { BALANCE, TIES } from '../../content/balance';
import { dayOf } from '../../content/clock';
import { DIGGER_FACES, HEARTH_GROWN, HOME_SLOTS, MINER_HOMES, SHARED_HOME } from '../../content/day';
import { DISCOVERY_NUMBERS } from '../../content/discoveries';
import { BAD, CO, END, ON, VO, WORLD_WORDS } from '../../content/names';
import { PEOPLE } from '../../content/people';
import { ROLES } from '../../content/roles';
import { uiText } from '../../content/text';
import { TRAITS } from '../../content/traits';
import { PLACES } from '../../content/world';
import type { GameState, Person, PlaceId, RoleId, Stats, TieKind, TraitId, UnitId } from '../../types';
import { area, inMine } from './area';
import { areaTicks } from './graph';
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

function statsOf(seed: number, id: UnitId, bias: readonly [number, number, number]): Stats {
  const k = idKey(id);
  const roll = (i: number, lo: number, hi: number): number => lo + keyedInt(seed, K.stat, hi - lo + 1, k, i);
  const c = (v: number): number => Math.max(0, Math.min(100, v));
  return { devotion: 0, strength: c(roll(0, 25, 70) + bias[0]), intelligence: c(roll(1, 25, 70) + bias[1]), cunning: c(roll(2, 25, 70) + bias[2]), health: roll(3, 70, 100) };
}

const HOME_AREAS = Object.keys(HOME_SLOTS);
/** The nearest area with homes. */
const homeAreaNear = (a: PlaceId): PlaceId => (HOME_SLOTS[a] ? a : HOME_AREAS.reduce((b, c) => (areaTicks(a, c) < areaTicks(a, b) ? c : b)));

/** One of trade `role` at `work` (else dealt one), with a trait, stats and resistance from the seed and their id; homed later. */
function born(seed: number, id: UnitId, role: RoleId, work: PlaceId | undefined, name: string, trait?: TraitId): Person {
  const r = ROLES[role]!;
  const k = idKey(id);
  const w = work ?? (role === 'digger' ? weighted(DIGGER_FACES, keyed(seed, K.work, k)) : r.work[keyedInt(seed, K.work, r.work.length, k)]!);
  const t = trait ?? TRAIT_IDS[keyedInt(seed, K.trait, TRAIT_IDS.length, k)]!;
  const resist = BALANCE.personalResist[0] + keyedInt(seed, K.stat, BALANCE.personalResist[1] - BALANCE.personalResist[0] + 1, k, 9);
  return {
    id, name, role, trait: t, standing: r.standing, stats: statsOf(seed, id, r.bias),
    resistance: Math.max(0, Math.min(60, TRAITS[t]!.resistance + r.resistance + resist)),
    home: '', household: '', work: w, ties: [], masterOf: [], at: { place: w, spot: k & 63, doing: 'idle' },
    follower: false, routine: null, pocket: [], worn: [], caught: 0, gone: null,
  };
}

/**
 * A newcomer, made from the seed into a new `s.people` (so every roster of it is made again): a loner found where
 * they hide (`at`, their area: a digger in the mine, a beggar in the town, named by the discovery's words, easy to
 * turn), or fresh hands off the lift (a digger dealt onto a face, bunking in the bunks, one a day at most).
 */
export function spawn(s: GameState, kind: 'loner' | 'fresh', at: PlaceId): Person {
  const day = dayOf(s.tick);
  const loner = kind === 'loner';
  const id = loner ? `loner-${at}` : `fresh-${day}`;
  const name = loner ? uiText(`discovery.${at}.loner`) : makeName(s.seed, 200000 + day, new Set(roster(s).all.map((p) => p.name)));
  const p = born(s.seed, id, loner && !inMine(at) ? 'beggar' : 'digger', loner ? at : undefined, name, loner ? 'grieving' : undefined);
  if (loner) p.resistance = DISCOVERY_NUMBERS.lonerResistance;
  p.home = loner ? at : 'bunks';
  p.household = `house:${p.home}`;
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
  house(seed, all);
  tie(seed, all);
  for (const [place, d] of Object.entries(PLACES)) {
    const master = d.officer ? all.find((p) => p.id === d.officer) : d.facility ? all.find((p) => p.work === place) : undefined;
    master?.masterOf.push(place);
  }
  s.people = Object.fromEntries(all.map((p) => [p.id, p]));
  return all;
}

/** Homes and households: a shared house for those who live where they serve; the rest dealt into their area's homes. */
function house(seed: number, all: Person[]): void {
  const byArea = new Map<PlaceId, Person[]>();
  const young: Person[] = [];
  for (const p of all) {
    const shared = SHARED_HOME[p.role];
    if (shared) { p.home = shared; p.household = `house:${shared}`; continue; }
    if (p.role === 'child' || p.role === 'elder') { young.push(p); continue; }
    const k = idKey(p.id);
    const a = ROLES[p.role]!.side === 'mine' ? weighted(MINER_HOMES, keyed(seed, K.home, k)) : homeAreaNear(area(p.work));
    (byArea.get(a) ?? byArea.set(a, []).get(a)!).push(p);
  }
  const hearths: { home: PlaceId; kids: number; old: number; size: number }[] = [];
  for (const [a, ps] of byArea) {
    const h = Math.min(HOME_SLOTS[a]!, Math.max(1, Math.round(ps.length / HEARTH_GROWN)));
    const base = hearths.length;
    for (let i = 0; i < h; i++) hearths.push({ home: `home:${a}:${i}`, kids: 0, old: 0, size: 0 });
    ps.sort((x, y) => keyed(seed, K.hearth, idKey(x.id)) - keyed(seed, K.hearth, idKey(y.id)));
    ps.forEach((p, i) => { const hh = hearths[base + (i % h)]!; p.home = hh.home; hh.size++; });
  }
  for (const p of young) {
    const kid = p.role === 'child';
    let best = hearths[0]!;
    for (const hh of hearths) if ((kid ? hh.kids : hh.old) * 100 + hh.size < (kid ? best.kids : best.old) * 100 + best.size) best = hh;
    if (kid) best.kids++; else best.old++;
    best.size++;
    p.home = best.home;
  }
  for (const p of all) if (!p.household) p.household = `house:${p.home}`;
}

/** Each grown person's own draws, in the order their ties are made: kin in another hearth, a lender, a rival workmate, a lover. */
const DRAWN = ['kin', 'owes', 'rival', 'lover'] as const;
const DRAW_ODDS = [0.16, 0.2, 0.11, 0.09];
const LENDERS = new Set(['moneylender', 'tavernkeeper', 'peddler', 'fence']);

/** Whom the draws choose among: the people as the ties were made, the grown (not children), the lenders, each work's hands. */
interface Pools { all: readonly Person[]; order: Map<UnitId, number>; grown: Person[]; lenders: Person[]; works: Map<PlaceId, Person[]> }
function poolsOf(all: readonly Person[]): Pools {
  const grown = all.filter((p) => p.role !== 'child');
  const lenders = grown.filter((p) => LENDERS.has(p.role));
  const works = new Map<PlaceId, Person[]>();
  for (const p of all) (works.get(p.work) ?? works.set(p.work, []).get(p.work)!).push(p);
  return { all, order: new Map(all.map((p, i) => [p.id, i])), grown, lenders, works };
}
/** Whom `p`'s draw `j` of `DRAWN` names, if it comes up. */
function drawn(seed: number, p: Readonly<Person>, j: number, x: Pools): Person | null {
  const k = idKey(p.id);
  if (p.role === 'child' || keyed(seed, K.tie, k, 10 + j) >= DRAW_ODDS[j]!) return null;
  const pool = j === 1 ? (x.lenders.length ? x.lenders : x.grown) : j === 2 ? x.works.get(p.work)! : x.grown;
  return pool[keyedInt(seed, K.tie, pool.length, k, 20 + j)]!;
}

/** Ties: the draws of `DRAWN`, the household, and friends among workmates (a small crew) or neighbours. */
function tie(seed: number, all: Person[]): void {
  const link = (a: Person, b: Person): void => {
    if (a === b || a.ties.includes(b.id) || a.ties.length >= TIE_CAP || b.ties.length >= TIE_CAP) return;
    a.ties.push(b.id);
    b.ties.push(a.id);
  };
  const x = poolsOf(all);
  const homes = new Map<PlaceId, Person[]>();
  const areas = new Map<PlaceId, Person[]>();
  for (const p of all) {
    (homes.get(p.home) ?? homes.set(p.home, []).get(p.home)!).push(p);
    (areas.get(area(p.home)) ?? areas.set(area(p.home), []).get(area(p.home))!).push(p);
  }
  for (const p of x.grown)
    for (let j = 0; j < DRAWN.length; j++) {
      const q = drawn(seed, p, j, x);
      if (q && q.household !== p.household) link(p, q);
    }
  for (const [home, ps] of homes) if (home.startsWith('home:')) for (const a of ps) for (const b of ps) if (a.ties.length < 4) link(a, b);
  for (const p of x.grown) {
    const k = idKey(p.id);
    const mates = x.works.get(p.work)!;
    const pool = mates.length <= TIES.workmatesMax ? mates : areas.get(area(p.home))!;
    for (let i = 0; i < 4 && p.ties.length < 2; i++) link(p, pool[keyedInt(seed, K.tie, pool.length, k, 2 + i)]!);
  }
}

/**
 * Everyone in the order they were made, each one's key and place in it, the households, the trades and the grown
 * (neither child nor elder): made once for a `s.people` (a load makes another).
 */
export interface Roster {
  all: Person[]; key: Uint32Array; index: Map<UnitId, number>; house: Map<string, Person[]>; role: Map<RoleId, Person[]>; grown: Person[];
}
const ROSTERS = new WeakMap<object, Roster>();
export const grown = (p: Readonly<Person>): boolean => p.role !== 'child' && p.role !== 'elder';
export function roster(s: Readonly<GameState>): Roster {
  let r = ROSTERS.get(s.people);
  if (!r) {
    const all = Object.values(s.people);
    const house = new Map<string, Person[]>();
    const role = new Map<RoleId, Person[]>();
    for (const p of all) {
      (house.get(p.household) ?? house.set(p.household, []).get(p.household)!).push(p);
      (role.get(p.role) ?? role.set(p.role, []).get(p.role)!).push(p);
    }
    r = { all, key: Uint32Array.from(all, (p) => idKey(p.id)), index: new Map(all.map((p, i) => [p.id, i])), house, role, grown: all.filter(grown) };
    ROSTERS.set(s.people, r);
  }
  return r;
}

/** The pools the ties were drawn from: of the seed's people as born, never the living (who change work, and newcomers join). */
let made: { seed: number; x: Pools } | null = null;
const poolsFor = (seed: number): Pools => (made?.seed === seed ? made.x : (made = { seed, x: poolsOf(bear(seed)) }).x);

/**
 * What a tie between two tied people is: kin of one hearth, else the first draw that made it (a sibling elsewhere,
 * a debt, a rival, a lover), else friends. The ties are made in that order, so the earliest draw naming the other is it.
 */
export function tieKind(s: Readonly<GameState>, a: Readonly<Person>, b: Readonly<Person>): TieKind {
  if (a.household === b.household && a.home.startsWith('home:')) return 'kin';
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
