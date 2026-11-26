/**
 * Plans by the hour (#49): where a person means to be at a tick and what they are doing there, a pure function of
 * the seed, the day, the weather and the person. Day hands work the shift, night hands the night; children play
 * or go to school, elders keep the well; the week moves it (a rest day, the Flame's service, payday's drink,
 * market day) and the weather sends the people out of doors to shelter. A follower's routine colours their evening.
 * A plan knows the hour it holds until, so a person plans only when theirs can change.
 */
import { BALANCE } from '../../content/balance';
import { CALENDAR_EFFECTS } from '../../content/calendar';
import { WEATHER_RULES } from '../../content/weather';
import { DAY, type Stretch } from '../../content/day';
import { AT, DAY_TICKS, TPH, dayOf } from '../../content/clock';
import { ROLES, type RoleDef } from '../../content/roles';
import { AREAS, PLACES, type PlaceKind } from '../../content/world';
import type { Activity, GameState, Person, PlaceId, RoleId, Weekday } from '../../types';
import { area, inMine } from './area';
import { areaTicks } from './graph';
import { K, idKey, keyed } from './draw';
import { gatheringsOf } from './events';
import { calendarOf, indoorsAt } from './sky';

export interface Target { place: PlaceId; doing: Activity }

// ---------- what each area has nearest: derived once from the graph ----------

function nearestOf(kinds: readonly PlaceKind[]): Map<PlaceId, PlaceId> {
  const out = new Map<PlaceId, PlaceId>();
  const cands = Object.entries(PLACES).filter(([, d]) => kinds.includes(d.kind) && AREAS[d.area]!.region === 'town');
  for (const a of Object.keys(AREAS)) {
    let best = cands[0]![0], bd = Infinity;
    for (const [id, d] of cands) {
      const t = areaTicks(a, d.area);
      if (t < bd) { bd = t; best = id; }
    }
    out.set(a, best);
  }
  return out;
}
const TAVERN = nearestOf(['tavern']);
const CHAPEL = nearestOf(['chapel', 'temple']);
const MARKET = nearestOf(['market']);
const WASH = nearestOf(['washplace', 'well']);
const WELL = nearestOf(['well']);
/** An indoor place in each area to shelter from the weather (none: go home). */
const SHELTER = new Map<PlaceId, PlaceId>();
for (const [id, d] of Object.entries(PLACES)) if (d.indoor && !SHELTER.has(d.area) && AREAS[d.area]!.region === 'town') SHELTER.set(d.area, id);

// ---------- who a person is, from the seed ----------

const ROLE_DOING: Partial<Record<RoleId, Activity>> = { child: 'play', elder: 'talk', beggar: 'idle', washer: 'wash' };
/** What they do at their work. */
export function workDoing(r: RoleDef, role: RoleId, place: PlaceId): Activity {
  if (r.labour === 'dig' || r.labour === 'haul' || r.labour === 'sort') return r.labour;
  if (r.watches) return r.serves === 'temple' ? 'pray' : 'guard';
  if (r.serves === 'temple') return 'preach';
  const kind = PLACES[place]?.kind;
  return ROLE_DOING[role] ?? (kind === 'market' || kind === 'shop' ? 'trade' : kind === 'tavern' || kind === 'inn' ? 'drink' : 'work');
}

/** Day or night: a mixed trade's night hands are dealt by its share (`k`: the person's key). */
export function shiftOf(seed: number, p: Readonly<Person>, k = idKey(p.id)): 'day' | 'night' {
  const r = ROLES[p.role]!;
  if (r.shift !== 'mixed') return r.shift;
  const share = r.side === 'mine' ? BALANCE.nightShiftShare : (DAY.nightShare[p.role] ?? 0);
  return keyed(seed, K.shift, k) < share ? 'night' : 'day';
}

const HABITS = ['tavern', 'chapel', 'market', 'wash'] as const;
type Habit = (typeof HABITS)[number];
export function hasHabit(seed: number, p: Readonly<Person>, h: Habit, k = idKey(p.id)): boolean {
  if (h === 'chapel' && p.trait === 'pious') return true;
  return keyed(seed, K.habit, k, HABITS.indexOf(h)) < DAY.habit[h];
}
export const habitPlace = (h: Habit, home: PlaceId): PlaceId =>
  (h === 'tavern' ? TAVERN : h === 'chapel' ? CHAPEL : h === 'market' ? MARKET : WASH).get(area(home))!;
const HABIT_DOING: Record<Habit, Activity> = { tavern: 'drink', chapel: 'pray', market: 'trade', wash: 'wash' };

/** The places of a follower's days their colour rides on: home, work, and the tavern seat and prayer bench they keep. */
export function haunts(seed: number, p: Readonly<Person>): PlaceId[] {
  const out = [p.home, p.work];
  if (hasHabit(seed, p, 'tavern')) out.push(habitPlace('tavern', p.home));
  if (hasHabit(seed, p, 'chapel')) out.push(habitPlace('chapel', p.home));
  return out;
}

/** What a plan read besides the clock and the person: the weather now, the day's crew and lift doors. */
export const WEATHER = 1, DOORS = 2;
/** The places the weather thins the crews of (rain and storm at the sump). */
const WEATHER_CREW = new Set(Object.values(WEATHER_RULES).flatMap((w) => w.effects.filter((e) => e.kind === 'crew').map((e) => e.target)));
const crewHits = (t: string | undefined, work: PlaceId): boolean => t === work || t === '*' || t === area(work);

/**
 * The share of a place's hands at work now: the calendar's crews (on a rest day the rest of the pit by `restCrew`),
 * times the weather's (rain and storm at the sump) and the crews the day's events set (a strike, a fever, a feast's
 * sore heads).
 */
function crew(s: Readonly<GameState>, wd: Weekday, work: PlaceId, r: RoleDef): number {
  let m = 1;
  const cal = CALENDAR_EFFECTS[wd];
  for (let i = 0; i < cal.length; i++) if (cal[i]!.kind === 'crew' && (cal[i]!.target === work || cal[i]!.target === '*')) m *= cal[i]!.value;
  if (m === 1 && wd === 'rest' && !r.watches && r.standing !== 'elite') m = r.side === 'mine' ? DAY.restCrew : 0;
  if (WEATHER_CREW.has(work) || WEATHER_CREW.has(area(work))) {
    now.uses |= WEATHER;
    const sky = WEATHER_RULES[s.weather].effects;
    for (let i = 0; i < sky.length; i++) if (sky[i]!.kind === 'crew' && crewHits(sky[i]!.target, work)) m *= sky[i]!.full;
  }
  now.uses |= DOORS;
  for (let i = 0; i < s.effects.length; i++) {
    const e = s.effects[i]!;
    if (e.kind === 'crew' && e.until > s.tick && crewHits(e.on, work)) m *= e.value!;
  }
  return m;
}

// ---------- the plan ----------

const T: Target = { place: '', doing: 'idle' };
const set = (place: PlaceId, doing: Activity): Target => { T.place = place; T.doing = doing; return T; };
/**
 * The plan being made, kept here so plans allocate nothing: the person, their key, the day, the hour `x` since dawn
 * (moved by their jitter); `hold`, the hour up to which the plan stands; `uses`, what else it read (`WEATHER`,
 * `DOORS`); `until`, the tick it holds until.
 */
const now = {
  s: null as unknown as Readonly<GameState>, p: null as unknown as Readonly<Person>, r: null as unknown as RoleDef,
  k: 0, day: 0, wd: 'work' as Weekday, x: 0, hold: 0, uses: 0, until: 0,
};
/** Is it before hour `a`? Then the plan holds until `a` at most. */
const lt = (a: number): boolean => {
  if (now.x >= a) return false;
  if (a < now.hold) now.hold = a;
  return true;
};
const ge = (a: number): boolean => !lt(a);
/** The whole hours `h` hours into a stretch: the plan holds until the next one. */
const hours = (h: number): number => {
  const n = Math.max(0, Math.floor(h));
  lt(now.x + n + 1 - h);
  return n;
};

/** Out of doors: the weather sends a share home each hour (an outdoor hand to the nearest roof). */
function out(place: PlaceId, doing: Activity): Target {
  if (PLACES[place]?.indoor !== false) return set(place, doing);
  const { s, p, k, day } = now;
  now.uses |= WEATHER;
  const share = indoorsAt(s.weather);
  if (share === 0) return set(place, doing);
  if (keyed(s.seed, K.shelter, k, hours(now.x) + 24 * day) >= share) return set(place, doing);
  return doing === 'guard' || doing === 'work' || doing === 'trade' ? set(SHELTER.get(area(place)) ?? p.home, 'idle') : set(p.home, 'talk');
}

/**
 * Where `p` (key `k`) means to be now and what they are doing (one shared result: copy it before the next call);
 * `planned()` then says until which tick it holds and what else it read.
 */
export function plan(s: Readonly<GameState>, p: Readonly<Person>, k = idKey(p.id)): Target {
  // each one's day turns within the hour after dawn, by who they are, so the town does not replan at once; until
  // then their hours run on past 24
  const turn = k % TPH;
  const day = dayOf(s.tick - turn);
  const j = (keyed(s.seed, K.jitter, k, day) * 2 - 1) * DAY.jitter;
  const dawn = s.tick - turn - ((s.tick - turn + AT.dusk - AT.dawn) % DAY_TICKS);
  now.s = s; now.p = p; now.r = ROLES[p.role]!; now.k = k; now.day = day; now.wd = calendarOf(day).kind;
  now.x = (s.tick - dawn) / TPH - j; now.hold = 24 + turn / TPH - j; now.uses = 0; now.until = Infinity;
  const to = gathered(s, p) ?? (p.role === 'child' ? childDay() : p.role === 'elder' ? elderDay() : grownDay());
  now.until = Math.max(s.tick + 1, Math.min(now.until, Math.ceil(dawn + (now.hold + j) * TPH)));
  return to;
}

/** At a gathering of the day's events they come to (a wedding's guests, the mourners, the searchers), if one is on. */
function gathered(s: Readonly<GameState>, p: Readonly<Person>): Target | null {
  const gs = gatheringsOf(s, p.id);
  if (!gs) return null;
  for (let i = 0; i < gs.length; i++) {
    const g = gs[i]!;
    if (s.tick < g.from) { now.until = Math.min(now.until, g.from); return null; }
    if (s.tick < g.to) { now.until = Math.min(now.until, g.to); return set(g.place, g.doing); }
  }
  return null;
}
/** The last plan's tick it holds until (from then it may change), and what else it read. */
export const planned = (): Readonly<{ until: number; uses: number }> => now;

function grownDay(): Target {
  const { s, p, r, k, day, wd } = now;
  const seed = s.seed;
  if (keyed(seed, K.crew, k, day) >= crew(s, wd, p.work, r)) return restDay();
  const sv = DAY.service;
  if (wd === 'flame' && !r.watches && ge(sv.from) && lt(sv.to) && goesToService()) return out(CHAPEL.get(area(p.home))!, 'pray');
  const own = DAY.hours[p.role] ?? NONE;
  for (let i = 0; i < own.length; i++) {
    const st = own[i]!;
    if ((!st.days || st.days.includes(wd)) && ge(st.from) && lt(st.to)) return stretch(st, now.x - st.from);
  }
  const kind = PLACES[p.work]?.kind;
  if (kind === 'tavern' || kind === 'inn') {
    const L = DAY.late;
    if (lt(L.wake) || ge(L.close)) return set(p.home, 'sleep');
    return lt(L.open) ? set(p.home, 'eat') : atWork(now.x - L.open);
  }
  if (shiftOf(seed, p, k) === 'night') {
    const N = DAY.night;
    if (lt(N.eat)) return atWork(now.x + 24 - N.leave);
    if (lt(N.sleep)) return set(p.home, 'eat');
    if (lt(N.rise)) return set(p.home, 'sleep');
    if (lt(N.rise + N.outFor)) return evening();
    if (lt(N.leave)) return set(p.home, 'eat');
    return atWork(now.x - N.leave);
  }
  const D = DAY.day;
  if (lt(0)) return set(p.home, 'sleep');
  if (lt(D.leave)) return set(p.home, 'eat');
  if (lt(D.off)) {
    if (ge(D.meal) && lt(D.meal + D.mealFor)) {
      if (inMine(p.work)) return set(keyed(seed, K.meal, k, day) < DAY.pitKitchen ? 'pitkitchen' : p.work, 'eat');
      return set(area(p.home) === area(p.work) ? p.home : p.work, 'eat');
    }
    return atWork(now.x - D.leave);
  }
  let off = D.off;
  if (wd === 'payday' && r.side === 'mine') {
    if (lt(off + DAY.pay)) return set('pithead', 'trade');
    off += DAY.pay;
  }
  if (lt(off + D.outFor)) return evening();
  return lt(D.sleep) ? set(p.home, 'talk') : set(p.home, 'sleep');
}
const NONE: readonly Stretch[] = [];

/** Where a stretch of a trade's own hours has them, `h` hours into it. */
function stretch(st: Stretch, h: number): Target {
  const { p, r } = now;
  const doing = st.doing ?? workDoing(r, p.role, p.work);
  switch (st.at) {
    case 'work': return atWork(h);
    case 'rounds': return out(r.rounds![hours(h) % (st.stops ?? r.rounds!.length)]!, doing);
    case 'home': return set(p.home, st.doing ?? 'talk');
    case 'evening': return evening();
    default: return out(st.at, doing);
  }
}

/** At work `h` hours into the shift: at their place, or walking their rounds an hour a stop. */
function atWork(h: number): Target {
  const { p, r } = now;
  const place = r.rounds ? r.rounds[hours(h) % r.rounds.length]! : p.work;
  const doing = workDoing(r, p.role, p.work);
  return r.outdoor ? out(place, doing) : set(place, doing);
}

function goesToService(): boolean {
  const { s, p, k, day } = now;
  if (p.trait === 'pious') return true;
  return keyed(s.seed, K.service, k, day) < (hasHabit(s.seed, p, 'chapel', k) ? DAY.serviceGoes.habit : DAY.serviceGoes.other);
}

/** The evening out: a follower's routine, else a habit if the day calls for it, else home with the family. */
function evening(): Target {
  const { s, p, k, day, wd } = now;
  if (p.follower) {
    switch (p.routine) {
      case 'preach': return set(TAVERN.get(area(p.home))!, 'preach');
      case 'pray': return set(p.home, 'pray');
      case 'offer': return inMine(p.work) ? set('grave', 'offer') : set(p.home, 'offer');
      case 'standWatch': return out(WELL.get(area(p.home))!, 'guard');
      case 'lieLow': return set(p.home, 'talk');
      default: break;
    }
  }
  const u = keyed(s.seed, K.evening, k, day);
  for (let i = 0; i < HABITS.length; i++) {
    const h = HABITS[i]!;
    if (hasHabit(s.seed, p, h, k) && u < DAY.evening[h][wd]) return out(habitPlace(h, p.home), HABIT_DOING[h]);
  }
  return set(p.home, 'talk');
}

/** A day off work: wash, chapel, market, family, the well, the evening, home. */
function restDay(): Target {
  const { s, p, k, wd } = now;
  const R = DAY.rest;
  const seed = s.seed;
  if (lt(R.wake) || ge(R.sleep)) return set(p.home, 'sleep');
  if (lt(R.wash)) return set(p.home, 'eat');
  if (lt(R.chapel)) return hasHabit(seed, p, 'wash', k) ? out(habitPlace('wash', p.home), 'wash') : set(p.home, 'talk');
  if (lt(R.market)) return hasHabit(seed, p, 'chapel', k) || wd === 'flame' ? out(habitPlace('chapel', p.home), 'pray') : set(p.home, 'talk');
  if (lt(R.home)) return hasHabit(seed, p, 'market', k) ? out(habitPlace('market', p.home), 'trade') : set(p.home, 'talk');
  if (lt(R.well)) return set(p.home, 'talk');
  if (lt(R.back)) return out(WELL.get(area(p.home))!, 'talk');
  return evening();
}

function childDay(): Target {
  const { p, wd } = now;
  const C = DAY.child;
  if (lt(C.wake) || ge(C.sleep)) return set(p.home, 'sleep');
  if (lt(C.out)) return set(p.home, 'eat');
  const school = p.work === 'school' && wd !== 'rest' && wd !== 'flame';
  if (lt(C.eat)) return school ? set('school', 'work') : out(p.work, 'play');
  if (lt(C.back)) return set(p.home, 'eat');
  if (lt(C.home)) return out(p.work, 'play');
  return set(p.home, 'talk');
}

function elderDay(): Target {
  const { p } = now;
  const E = DAY.elder;
  if (lt(E.wake) || ge(E.sleep)) return set(p.home, 'sleep');
  if (lt(E.well)) return set(p.home, 'eat');
  if (lt(E.home)) return out(WELL.get(area(p.home))!, 'talk');
  if (lt(E.out)) return set(p.home, 'talk');
  if (lt(E.back)) return out(p.work, 'talk');
  return set(p.home, 'talk');
}
