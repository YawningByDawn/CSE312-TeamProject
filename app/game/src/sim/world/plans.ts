/**
 * Plans by the hour (#49): where a person means to be at a tick and what they are doing there, a pure function of
 * the seed, the day, the weather and the person. Everyone works the day and sleeps the night in the bunks; the week
 * moves it (a rest day, the Flame's service, payday's chits). A follower's routine colours their evening. A plan knows the
 * hour it holds until, so a person plans only when theirs can change.
 */
import { BALANCE } from '../../content/balance';
import { CALENDAR_EFFECTS } from '../../content/calendar';
import { WEATHER_RULES } from '../../content/weather';
import { DAY, type Stretch } from '../../content/day';
import { AT, DAY_TICKS, TPH, dayOf } from '../../content/clock';
import { ROLES, type RoleDef } from '../../content/roles';
import type { Activity, GameState, Person, PlaceId, Weekday } from '../../types';
import { area } from './area';
import { K, idKey, keyed } from './draw';
import { gatheringsOf } from './events';
import { calendarOf } from './sky';

export interface Target { place: PlaceId; doing: Activity }

/** The Flame's shrine: where the faithful pray. */
export const CHAPEL: PlaceId = 'kilnshrine';

// ---------- who a person is, from the seed ----------

/** What they do at their work. */
export function workDoing(r: RoleDef): Activity {
  if (r.labour) return r.labour;
  if (r.watches) return r.serves === 'temple' ? 'pray' : 'guard';
  return 'work';
}

/** Does `p` keep the shrine? A pious one always does. */
export function hasHabit(seed: number, p: Readonly<Person>, k = idKey(p.id)): boolean {
  return p.trait === 'pious' || keyed(seed, K.habit, k, 0) < DAY.habit;
}

/** The places of a follower's days their colour rides on: home, work, and the shrine they keep. */
export function haunts(seed: number, p: Readonly<Person>): PlaceId[] {
  const out = [p.home, p.work];
  if (hasHabit(seed, p)) out.push(CHAPEL);
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
  if (m === 1 && wd === 'rest' && !r.watches && r.standing !== 'elite') m = DAY.restCrew;
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

/**
 * Where `p` (key `k`) means to be now and what they are doing (one shared result: copy it before the next call);
 * `planned()` then says until which tick it holds and what else it read.
 */
export function plan(s: Readonly<GameState>, p: Readonly<Person>, k = idKey(p.id)): Target {
  // each one's day turns within the hour after dawn, by who they are, so the mine does not replan at once; until
  // then their hours run on past 24
  const turn = k % TPH;
  const day = dayOf(s.tick - turn);
  const j = (keyed(s.seed, K.jitter, k, day) * 2 - 1) * DAY.jitter;
  const dawn = s.tick - turn - ((s.tick - turn + AT.dusk - AT.dawn) % DAY_TICKS);
  now.s = s; now.p = p; now.r = ROLES[p.role]!; now.k = k; now.day = day; now.wd = calendarOf(day).kind;
  now.x = (s.tick - dawn) / TPH - j; now.hold = 24 + turn / TPH - j; now.uses = 0; now.until = Infinity;
  const to = gathered(s, p) ?? grownDay();
  now.until = Math.max(s.tick + 1, Math.min(now.until, Math.ceil(dawn + (now.hold + j) * TPH)));
  return to;
}

/** At a gathering of the day's events they come to (the mourners, the searchers), if one is on. */
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
  if (wd === 'flame' && !r.watches && ge(sv.from) && lt(sv.to) && goesToService()) return set(CHAPEL, 'pray');
  const own = DAY.hours[p.role] ?? NONE;
  for (let i = 0; i < own.length; i++) {
    const st = own[i]!;
    if ((!st.days || st.days.includes(wd)) && ge(st.from) && lt(st.to)) return stretch(st, now.x - st.from);
  }
  const D = DAY.day;
  if (lt(D.leave)) return set(p.home, 'eat');
  if (lt(D.off)) {
    if (ge(D.meal) && lt(D.meal + D.mealFor)) return set(keyed(seed, K.meal, k, day) < DAY.pitKitchen ? 'pitkitchen' : p.work, 'eat');
    return atWork(now.x - D.leave);
  }
  let off = D.off;
  if (wd === 'payday') {
    if (lt(off + DAY.pay)) return set('overseer', 'talk');
    off += DAY.pay;
  }
  if (lt(off + D.outFor)) return evening();
  return lt(D.sleep) ? set(p.home, 'talk') : bed();
}

/** In the bunks past the evening: asleep till the dawn, and up from it (a person still on yesterday's hours is up too). */
function bed(): Target {
  return set(now.p.home, lt(24 - DAY.jitter) ? 'sleep' : 'eat');
}
const NONE: readonly Stretch[] = [];

/** Where a stretch of a trade's own hours has them, `h` hours into it. */
function stretch(st: Stretch, h: number): Target {
  const { p, r } = now;
  const doing = st.doing ?? workDoing(r);
  switch (st.at) {
    case 'work': return atWork(h);
    case 'rounds': return set(r.rounds![hours(h) % (st.stops ?? r.rounds!.length)]!, doing);
    case 'home': return set(p.home, st.doing ?? 'talk');
    case 'evening': return evening();
    default: return set(st.at, doing);
  }
}

/** At work `h` hours into the shift: at their place, or walking their rounds an hour a stop. */
function atWork(h: number): Target {
  const { p, r } = now;
  return set(r.rounds ? r.rounds[hours(h) % r.rounds.length]! : p.work, workDoing(r));
}

function goesToService(): boolean {
  const { s, p, k, day } = now;
  return p.trait === 'pious' || keyed(s.seed, K.service, k, day) < (hasHabit(s.seed, p, k) ? DAY.serviceGoes.habit : DAY.serviceGoes.other);
}

/** The evening out: a follower's routine, else the shrine if the day calls for it, else the bunks. */
function evening(): Target {
  const { s, p, k, day, wd } = now;
  if (p.follower) {
    switch (p.routine) {
      case 'pray': return set(p.home, 'pray');
      case 'offer': return set('grave', 'offer');
      case 'lieLow': return set(p.home, 'talk');
      default: break;
    }
  }
  return hasHabit(s.seed, p, k) && keyed(s.seed, K.evening, k, day) < DAY.evening[wd] ? set(CHAPEL, 'pray') : set(p.home, 'talk');
}

/** A day off work: the shrine, the bunks, the evening. */
function restDay(): Target {
  const { s, p, k, wd } = now;
  const R = DAY.rest;
  if (lt(R.chapel)) return set(p.home, 'eat');
  if (lt(R.home)) return hasHabit(s.seed, p, k) || wd === 'flame' ? set(CHAPEL, 'pray') : set(p.home, 'talk');
  if (lt(R.back)) return set(p.home, 'talk');
  return lt(R.sleep) ? evening() : bed();
}
