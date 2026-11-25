/**
 * What every rule shares: the clock's arithmetic, the world graph, timed effects, and the god's and the people's
 * state changes (XP, Ichor, urges, heat, devotion, turning, loss), each in one place.
 */
import { BALANCE, TIES } from '../content/balance';
import { CALENDAR_EFFECTS, CART_DAY } from '../content/calendar';
import { AT, dayOf, nextAt } from '../content/clock';
import { EFFECT } from '../content/crystals';
import { WEATHER_RULES } from '../content/weather';
import { AREAS } from '../content/world';
import { ROLES } from '../content/roles';
import { THREAT } from '../content/threats';
import { applyGain, ichorMax, levelForXp, round1 } from './formulas';
import { blessed, bonus } from './bonus';
import { boonYours, buildingsIn, handsOf, heldByHands, holding } from './buildings';
import { worn } from './items';
import { newCrystal, oddCount, type RollOpts } from './crystals';
import { calendarOf } from './world/sky';
import { area, areaDef, inMine } from './world/area';
import { nbrs } from './world/graph';
import { roster } from './world/society';
import type { Effect, FactionId, GameEvent, GameState, GoneReason, Person, PlaceId, Tick, UnitId, World } from '../types';

/** One rule's working set: the state, the step's event list, the people's lives. */
export interface Ctx { s: GameState; out: GameEvent[]; w: World }

type Body = GameEvent extends infer E ? (E extends GameEvent ? Omit<E, 'tick'> : never) : never;
export function ev(c: Ctx, e: Body): void {
  c.out.push({ tick: c.s.tick, ...e } as GameEvent);
}


/** The shift that has not yet ended: a card's "tomorrow" lasts until its count. */
export const untilShiftEnd = (s: Readonly<GameState>): Tick => nextAt(s.tick, AT.shiftEnd);

// ---------- the world graph (content): rules work on areas, people are at places inside them ----------

export { area, areaDef, inMine, nbrs };

/** The Flame's light in an area: 2 at a lit source, 1 beside one, 0 dark (a snuffed area is dark). */
export function flameLight(s: Readonly<GameState>, a: PlaceId): 0 | 1 | 2 {
  if (has(s, 'snuffed', a)) return 0;
  const lit = (x: PlaceId): boolean => AREAS[x]!.flame && !s.places[x]!.desecrated && !has(s, 'snuffed', x);
  if (lit(a)) return 2;
  for (const n of nbrs(s, a)) if (lit(n)) return 1;
  return 0;
}


export function has(s: Readonly<GameState>, kind: Effect['kind'], on?: string): Effect | undefined {
  for (const e of s.effects) if (e.kind === kind && e.on === on && e.until > s.tick) return e;
  return undefined;
}
export function addEffect(s: GameState, kind: Effect['kind'], on: string | undefined, until: Tick, by?: UnitId, value?: number): void {
  const e = has(s, kind, on);
  if (e) e.until = Math.max(e.until, until);
  else s.effects.push({ kind, ...(on !== undefined ? { on } : {}), until, ...(by ? { by } : {}), ...(value !== undefined ? { value } : {}) });
}

/** A rule number the day opens or closes: by the weather, the weekday and the world's events. */
export type Door = 'strike' | 'search' | 'countTolerance' | 'notice' | 'crowd' | 'guards' | 'whisper' | 'whisperZone' | 'reach';
const ADDED: ReadonlySet<Door> = new Set(['guards', 'whisper', 'whisperZone', 'reach']);
/** Rules work on areas: a door on a place opens for its whole area. */
const hits = (t: string | undefined, a: string, b: string): boolean => t === '*' || (t !== undefined && (area(t) === a || area(t) === b));

/**
 * The day's door of `kind` on `on` (a place's area, a faction or a person; `also` a second place's area too),
 * from the weather now, the weekday (a cart day's count too) and the world's events in `s.effects`. A multiplier
 * (strike, search, countTolerance, notice, crowd) multiplies, 1 when closed; a count or odds (guards, whisper,
 * whisperZone, reach) adds, 0 when closed. Each source counts once however many of the places it names.
 */
export function door(s: Readonly<GameState>, kind: Door, on: string, also: string = on): number {
  const a = area(on);
  const b = area(also);
  const add = ADDED.has(kind);
  let v = add ? 0 : 1;
  for (const e of WEATHER_RULES[s.weather].effects) if (e.kind === kind && hits(e.target, a, b)) v = add ? v + e.full : v * e.full;
  const day = calendarOf(dayOf(s.tick));
  for (const e of CALENDAR_EFFECTS[day.kind]) if (e.kind === kind && hits(e.target, a, b)) v = add ? v + e.value : v * e.value;
  if (kind === 'countTolerance' && day.carts) v *= CART_DAY.value;
  for (const e of s.effects) if (e.kind === kind && e.until > s.tick && hits(e.on, a, b)) v = add ? v + e.value! : v * e.value!;
  return v;
}


/** Cards the hand holds at most. */
export const handMax = (s: Readonly<GameState>): number => BALANCE.handMax + bonus(s, 'hand');
export const maxIchor = (s: Readonly<GameState>): number => ichorMax(s.god.level, bonus(s, 'ichorMax'));
/** Action points and sockets for the god's rank (sockets never shrink). */
export function settleRank(s: GameState): void {
  const g = s.god;
  g.apMax = BALANCE.apBase + (g.level - 1) + bonus(s, 'ap');
  const n = BALANCE.socketsBase + (g.level - 1) + bonus(s, 'sockets');
  while (g.sockets.length < n) g.sockets.push(null);
}

export function gainXp(c: Ctx, n: number): void {
  if (n <= 0) return;
  c.s.god.xp = round1(c.s.god.xp + n);
  ev(c, { kind: 'xp', delta: n });
}

/** Ranks the XP has earned (capped at Whisper III until the pit head took root): each one an AP, a socket, Ichor, a blessing pick. */
export function rankUp(c: Ctx): void {
  const g = c.s.god;
  const cap = c.s.flags.surfaceRooted ? BALANCE.winLevel : BALANCE.whisperLevelCap;
  const to = Math.min(cap, levelForXp(g.xp));
  while (g.level < to) {
    g.level += 1;
    settleRank(c.s);
    gainIchor(c, BALANCE.levelUpHeal);
    ev(c, { kind: 'rank', level: g.level });
  }
}

export function gainIchor(c: Ctx, n: number): void {
  const g = c.s.god;
  const to = Math.min(maxIchor(c.s), g.ichor + n);
  if (to > g.ichor) ev(c, { kind: 'ichor', delta: round1(to - g.ichor) });
  g.ichor = to;
}

/** Ichor lost; at zero the run ends. Stone Skin spares the first loss of each day. */
export function loseIchor(c: Ctx, n: number, why: string): void {
  const s = c.s;
  if (blessed(s, 'stoneSkin') && !has(s, 'used', 'stoneSkin')) {
    addEffect(s, 'used', 'stoneSkin', nextAt(s.tick, AT.dawn));
    n -= 1;
  }
  if (n <= 0 || s.phase !== 'live') return;
  s.god.ichor = Math.max(0, s.god.ichor - n);
  ev(c, { kind: 'ichor', delta: -n, note: { key: `ichor.${why}` } });
  if (s.god.ichor <= 0) end(c, false, 'ichor');
}

/** The writ against the pit head takes a seal; at the last the shaft is sealed and the run is lost. */
export function addSeal(c: Ctx): void {
  const s = c.s;
  s.flags.seals += 1;
  if (s.flags.seals >= THREAT.writMax) end(c, false, 'sealed');
}

/** The writ loses `n` seals: the Magistrate turned tears it all, the ledgers burned or the records forged tear one. */
export function tearWrit(c: Ctx, n: number, by: 'magistrate' | 'evil' | 'records'): void {
  const s = c.s;
  const was = s.flags.seals;
  s.flags.seals = Math.max(0, was - n);
  if (s.flags.seals !== was) ev(c, { kind: 'story', story: 'writ', note: { key: `writ.torn.${by}${s.flags.seals > 0 ? '.some' : ''}`, slots: { n: s.flags.seals } } });
}

export function end(c: Ctx, won: boolean, why: string): void {
  if (c.s.phase !== 'live') return;
  c.s.phase = won ? 'won' : 'lost';
  ev(c, { kind: 'end', won, why: { key: `end.${why}` } });
}

function gauge(c: Ctx, k: 'hunger' | 'malice', n: number): void {
  const g = c.s.god, to = round1(Math.max(0, Math.min(100, g[k] + n)));
  if (to !== g[k]) ev(c, { kind: k, delta: round1(to - g[k]) });
  g[k] = to;
}
export const addHunger = (c: Ctx, n: number): void => gauge(c, 'hunger', n);
export const addMalice = (c: Ctx, n: number): void => gauge(c, 'malice', n);
export function addNether(c: Ctx, n: number, why?: string): void {
  if (n === 0) return;
  c.s.god.nether = round1(c.s.god.nether + n);
  c.s.ledger.nether = round1(c.s.ledger.nether + n);
  ev(c, { kind: 'nether', delta: round1(n), ...(why ? { note: { key: `nether.${why}` } } : {}) });
}


const THRESHOLDS: readonly number[] = [25, 50, 75, 100];
export const FACTIONS: readonly FactionId[] = ['temple', 'council', 'public'];
/** The same heat to every power. */
export const heatAll = (c: Ctx, amount: number, why: string): void => { for (const f of FACTIONS) addHeat(c, f, amount, why); };

/**
 * Suspicion moves: a rise is cut by calm (and the Temple's by Pale Light) and is nothing while the faction looks
 * away. The level climbs at each threshold and falls only `rearmGap` below it.
 */
export function addHeat(c: Ctx, f: FactionId, amount: number, why: string): void {
  const s = c.s;
  let n = amount;
  if (n > 0) {
    if (has(s, 'blind', f)) return;
    n *= (1 - bonus(s, 'calm')) * door(s, 'notice', f);
    if (f === 'temple' && oddCount(s, 'paleLight') > 0) n *= EFFECT.paleLightMult;
  }
  const fa = s.factions[f];
  const was = fa.suspicion;
  fa.suspicion = round1(Math.max(0, Math.min(100, was + n)));
  if (fa.suspicion === was) return;
  s.ledger.suspicion[f] = round1(s.ledger.suspicion[f] + fa.suspicion - was);
  const from = fa.level;
  while (fa.level < 4 && fa.suspicion >= THRESHOLDS[fa.level]!) fa.level = (fa.level + 1) as 1 | 2 | 3 | 4;
  while (fa.level > 0 && fa.suspicion < THRESHOLDS[fa.level - 1]! - BALANCE.rearmGap) fa.level = (fa.level - 1) as 0 | 1 | 2 | 3;
  ev(c, { kind: 'suspicion', faction: f, level: fa.level, was: from, note: { key: `heat.${why}`, slots: { n: round1(fa.suspicion - was) } } });
}


export const here = (p: Readonly<Person>): boolean => p.gone === null;
/** Everyone ever, in the order they came (gone too): the world's roster, made once for a `s.people`. */
export const everyone = (s: Readonly<GameState>): readonly Person[] => roster(s).all;
/** Where they are now: their place, or the stretch of the route they are on. */
export function whereNow(p: Readonly<Person>, t: Tick): PlaceId {
  const a = p.at;
  if ('place' in a) return a.place;
  const k = Math.min(a.route.length - 1, Math.max(0, Math.floor(((t - a.from) / Math.max(1, a.to - a.from)) * a.route.length)));
  return a.route[k]!;
}
/** The living people standing in an area now. */
export const peopleIn = (s: Readonly<GameState>, a: PlaceId, f: (p: Person) => boolean): Person[] =>
  everyone(s).filter((p) => here(p) && area(whereNow(p, s.tick)) === a && f(p));
/** Neither yours nor an echo of one. */
export const stranger = (p: Readonly<Person>): boolean => !p.follower && !p.echoOf;
export const asleep =(p: Readonly<Person>): boolean => 'place' in p.at && p.at.doing === 'sleep';
export const digs = (p: Readonly<Person>): boolean => ROLES[p.role]!.labour === 'dig' && inMine(p.work);
export const loyal = (p: Readonly<Person>): boolean => p.trait === 'loyal';
export const standingOf = (p: Readonly<Person>) => ROLES[p.role]!.standing;

export function gainDevotion(c: Ctx, p: Person, base: number): void {
  if (base <= 0) return;
  p.stats.devotion = applyGain(p.stats.devotion, base);
  for (const [at, xp] of BALANCE.xpDevotionMarks) {
    if (p.stats.devotion >= at && (p.mark ?? 0) < at) {
      p.mark = at;
      gainXp(c, xp);
    }
  }
}

/** Devotion lost (the loyal lose half); at zero a follower lapses. */
/** After a change to a person: each building of `holding` before it that changed hands says so (one left masterless goes with its ground, unsaid). */
function handsMoved(c: Ctx, was: readonly [PlaceId, boolean][]): void {
  for (const [b, y] of was) if (heldByHands(c.s, b) === !y) ev(c, { kind: 'building', place: b, yours: !y });
}

export function loseDevotion(c: Ctx, p: Person, n: number): void {
  p.stats.devotion = round1(Math.max(0, p.stats.devotion - (loyal(p) ? n / 2 : n)));
  if (p.stats.devotion > 0 || !p.follower) return;
  const was = holding(c.s, p);
  p.follower = false;
  p.routine = null;
  p.resistance += 10;
  dropPocket(c.s, p);
  ev(c, { kind: 'lost', unit: p.id, note: { key: 'people.lapsed', slots: { name: p.name } } });
  handsMoved(c, was);
}

export function convert(c: Ctx, p: Person, devotion: number): void {
  const was = holding(c.s, p);
  p.follower = true;
  p.routine = 'pray';
  p.stats.devotion = Math.max(1, Math.min(100, devotion));
  p.mark = Math.floor(p.stats.devotion / 25) * 25;
  c.s.ledger.turned += 1;
  const t = c.s.tally;
  t.turned += 1;
  t.peak = Math.max(t.peak, heads(c.s));
  ev(c, { kind: 'turned', unit: p.id, place: whereNow(p, c.s.tick) });
  gainXp(c, standingOf(p) === 'elite' ? BALANCE.xpElite : BALANCE.xpFollower);
  if (p.role === 'magistrate') tearWrit(c, c.s.flags.seals, 'magistrate');
  handsMoved(c, was);
}

/** Hold changes in one area: rooting at 100 pays XP once, falling below `rootLostBelow` costs an Ichor. */
export function setHold(c: Ctx, id: PlaceId, to: number): void {
  const s = c.s;
  const ps = s.places[id]!;
  const def = AREAS[id]!;
  // the grave is always yours; after the watershed so is every mine area that took root
  if (def.anchored || (ps.rooted && s.stage === 'shade' && def.region === 'mine')) return;
  const was = ps.hold;
  ps.hold = round1(Math.max(0, Math.min(100, to)));
  if (ps.hold === was) return;
  if (ps.hold >= BALANCE.colouredAt) ps.explored = true;
  ev(c, { kind: 'hold', place: id, hold: ps.hold, was });
  if (ps.hold >= 100 && !ps.rooted) {
    ps.rooted = true;
    gainXp(c, inMine(id) ? BALANCE.xpZone : BALANCE.xpTownZone);
    if (def.gate && !s.flags.surfaceRooted) {
      s.flags.surfaceRooted = true;
      addHeat(c, 'council', BALANCE.gateAlarmGov, 'gate');
      addHeat(c, 'temple', BALANCE.gateAlarmCult, 'gate');
    }
  } else if (ps.rooted && ps.hold < BALANCE.rootLostBelow) {
    ps.rooted = false;
    loseIchor(c, BALANCE.zoneLostIchor, 'purged');
  } else return;
  // a building nobody masters goes with its ground
  for (const b of buildingsIn(id)) if (!handsOf(s, b).master) ev(c, { kind: 'building', place: b, yours: ps.rooted });
}

/** A person leaves the world. A devoured or killed one's soul hardens into a crystal for the grave. */
export function remove(c: Ctx, p: Person, why: GoneReason, soulLuck?: number): void {
  if (!here(p)) return;
  const was = p.follower;
  const held = holding(c.s, p);
  p.gone = why;
  p.goneDay = dayOf(c.s.tick);
  p.follower = false;
  p.routine = null;
  dropPocket(c.s, p);
  handsMoved(c, held);
  if (was) {
    c.s.ledger.lost += 1;
    ev(c, { kind: 'lost', unit: p.id, note: { key: `people.${why}`, slots: { name: p.name } } });
    if (why === 'taken' || why === 'burned' || why === 'dead') addMalice(c, BALANCE.maliceOnLoss);
  } else if (why !== 'devoured') ev(c, { kind: 'gone', unit: p.id }); // the devoured have their own event
  if (soulLuck !== undefined) mint(c, { luck: soulLuck });
  if (why === 'devoured' || why === 'taken' || why === 'burned') tiesNotice(c, p, why === 'devoured' ? why : 'taken');
}

/** Hold pushed back in area `a` by `n`. */
export const pushBack = (c: Ctx, a: PlaceId, n: number): void => setHold(c, a, c.s.places[a]!.hold - n);

/**
 * One gone, devoured by you or taken or burned by the powers: those tied to them notice. The devoured one's ties harden (yours
 * lose Devotion), the town talks and the colour of their home recedes; the taken one's soften toward you, and yours
 * among them feed your Malice.
 */
function tiesNotice(c: Ctx, p: Person, why: 'devoured' | 'taken'): void {
  const s = c.s;
  if (s.phase !== 'live') return;
  const ties = p.ties.map((id) => s.people[id]!).filter(here);
  if (ties.length === 0) return;
  ev(c, { kind: 'story', story: 'ties', unit: p.id, place: p.home, note: { key: `tie.${why}.${ties.length > 1 ? 'many' : 'one'}`, slots: { name: p.name, n: ties.length } } });
  let yours = 0;
  for (const t of ties) {
    if (t.follower) yours++;
    if (why === 'taken') { if (!t.follower) t.resistance = Math.max(0, t.resistance - TIES.takenSoften); }
    else if (t.follower) loseDevotion(c, t, TIES.devouredDevotion);
    else t.resistance += TIES.devouredResist;
  }
  if (why === 'taken') return addMalice(c, Math.min(TIES.maliceCap, yours * TIES.malice));
  addHeat(c, 'public', Math.min(TIES.noticeCap, ties.length * TIES.noticeHeat), 'tiesTalk');
  pushBack(c, area(p.home), TIES.devouredHold);
}

/** A crystal reaches the grave's pouch. */
export const pouchIds = (s: Readonly<GameState>): string[] => Object.keys(s.crystals).filter((id) => 'pouch' in s.crystals[id]!.at);
export function gainCrystal(c: Ctx, id: string): void {
  const x = c.s.crystals[id]!;
  x.at = { pouch: true };
  c.s.ledger.crystals += 1;
}
/** A new stone for the pouch: its id. */
export const mint = (c: Ctx, o: RollOpts = {}): string => { const id = newCrystal(c.s, { pouch: true }, o).id; gainCrystal(c, id); return id; };
/** A stone from a follower's pocket reaches the pouch, as tribute, offering or tithe. */
export function cash(c: Ctx, p: Person, id: string, kind: 'tribute' | 'offer' | 'tithe'): void {
  p.pocket.splice(p.pocket.indexOf(id), 1);
  gainCrystal(c, id);
  ev(c, { kind, unit: p.id, crystal: id });
}

/** One who leaves your side loses what they carry: the stones in their pocket and the things they wear. */
export function dropPocket(s: GameState, p: Person): void {
  for (const id of p.pocket) delete s.crystals[id];
  p.pocket.length = 0;
  for (const id of p.worn.slice()) destroyItem(s, id);
}
/** A thing gone: off its wearer, it and its stone. */
export function destroyItem(s: GameState, id: string): void {
  const it = s.items[id]!;
  const w = it.wearer ? s.people[it.wearer]!.worn : [];
  if (w.includes(id)) w.splice(w.indexOf(id), 1);
  delete s.crystals[it.crystal];
  delete s.items[id];
}

/** Stones in a person's pocket, as ids (the pocket is the truth; a crystal's `at` mirrors it). */
export function pocketTo(s: GameState, p: Person, id: string): void {
  s.crystals[id]!.at = { pocket: p.id };
  p.pocket.push(id);
}

export function followers(s: Readonly<GameState>, f: (p: Person) => void): void {
  const all = roster(s).all;
  for (let i = 0; i < all.length; i++) if (all[i]!.follower && all[i]!.gone === null) f(all[i]!);
}

/** Your followers counted by the area `at` names for each (null: not counted). */
export function flockCount(s: Readonly<GameState>, at: (f: Person) => PlaceId | null): Map<PlaceId, number> {
  const n = new Map<PlaceId, number>();
  followers(s, (f) => { const a = at(f); if (a !== null) n.set(a, (n.get(a) ?? 0) + 1); });
  return n;
}
/** The area counted most, ties to the first by id; null for none. */
export const most = (n: ReadonlyMap<PlaceId, number>): PlaceId | null => [...n.keys()].sort((a, b) => n.get(b)! - n.get(a)! || (a < b ? -1 : 1))[0] ?? null;
export const heads = (s: Readonly<GameState>): number => {
  let n = 0;
  followers(s, () => { n += 1; });
  return n;
};

/** Influence: the Hold of every area summed; Presence is a hundredth of it. */
export function influence(s: Readonly<GameState>): number {
  let n = 0;
  for (const id in s.places) n += s.places[id]!.hold;
  return round1(n);
}
export const presence = (s: Readonly<GameState>): number => round1(influence(s) / 100);

/**
 * The flock as it stands now: its headcount, how many stand in each area, the homes and posts it holds, and the
 * god's Presence. One pass over the people and the areas; a rule that asks of many people (every whisper, every
 * target) takes it once and asks it of each.
 */
export interface Flock {
  heads: number;
  at: ReadonlyMap<PlaceId, number>;
  homes: ReadonlySet<PlaceId>;
  works: ReadonlySet<PlaceId>;
  /** The strongest worn whisper help of a follower standing in each area. */
  help: ReadonlyMap<PlaceId, number>;
  presence: number;
  /** In the town, the households with a child at a school of yours: what children repeat at home puts them in reach. */
  taught: ReadonlySet<string>;
}
export function flockOf(s: Readonly<GameState>): Flock {
  const at = new Map<PlaceId, number>();
  const help = new Map<PlaceId, number>();
  const homes = new Set<PlaceId>();
  const works = new Set<PlaceId>();
  let n = 0;
  followers(s, (f) => {
    n += 1;
    const a = area(whereNow(f, s.tick));
    at.set(a, (at.get(a) ?? 0) + 1);
    const h = worn(s, f, 'whisperHelp');
    if (h > (help.get(a) ?? 0)) help.set(a, h);
    homes.add(f.home);
    works.add(f.work);
  });
  const taught = new Set<string>();
  const schools = s.stage === 'shade' ? boonYours(s, 'lesson') : [];
  if (schools.length) for (const p of everyone(s)) if (here(p) && p.role === 'child' && schools.includes(p.work)) taught.add(p.household);
  return { heads: n, at, homes, works, help, presence: presence(s), taught };
}
