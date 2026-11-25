/**
 * The people's lives (src/sim/world implements `World`): everyone placed by their plan, walking the world graph
 * between places and riding the lift between the mine and the town, the weather by the hour, the opposition's
 * walkers on their way, and the groups that gather. A person plans when they arrive and when their plan can change:
 * its hour comes, or the weather or a crew or lift door it read turns, or their routine does.
 */
import { TPH, dayOf } from '../../content/clock';
import { TOWN } from '../../content/balance';
import { TRAVEL } from '../../content/world';
import type { Activity, Effect, GameEvent, GameState, GroupId, Person, PlaceId, Threat, UnitId, Weather, World } from '../../types';
import { standingOf, whereNow } from '../core';
import { inMine } from './area';
import { K, keyedInt } from './draw';
import { dawnOf, echoes, stepEvents, variants } from './events';
import { route } from './graph';
import { DOORS, WEATHER, habitPlace, plan, planned, shiftOf, hasHabit, haunts, type Target } from './plans';
import { populate, roster, spawn, tieKind, type Roster } from './society';
import { liftRuns, weatherAt, windAt } from './sky';

export { calendarOf, indoorsAt, liftRuns, regimeOf, weatherAt } from './sky';
export { eventsOf } from './events';
export { makeName, tieKind } from './society';
export { haunts, route };

const SEARCHERS = new Set<Threat['kind']>(['inspection', 'purge', 'inquisitor', 'crusade']);

/**
 * What each person's plan holds to, made with the roster: the tick it holds until, what else it read, the routine it
 * read, and whether they walk for a threat (`chase`: the tick they last did, `threat`: whose). The weather and the
 * crew and lift doors the plans read, to see them turn.
 */
interface Lives {
  until: Int32Array; uses: Uint8Array; routine: (string | null)[];
  chase: Int32Array; chased: Uint8Array; threat: Uint16Array;
  weather: Weather | ''; doors: Effect[]; ndoors: number;
}
const LIVES = new WeakMap<Roster, Lives>();
function livesOf(r: Roster): Lives {
  let L = LIVES.get(r);
  if (!L) {
    const n = r.all.length;
    L = {
      until: new Int32Array(n), uses: new Uint8Array(n), routine: new Array<string | null>(n).fill(null),
      chase: new Int32Array(n).fill(-1), chased: new Uint8Array(n), threat: new Uint16Array(n), weather: '', doors: [], ndoors: 0,
    };
    LIVES.set(r, L);
  }
  return L;
}

/** What turned since the last tick that plans read: `WEATHER`, `DOORS` (a crew or lift door opened or shut). */
function turned(s: Readonly<GameState>, L: Lives): number {
  let t = 0;
  if (s.weather !== L.weather) { L.weather = s.weather; t |= WEATHER; }
  let n = 0;
  for (let i = 0; i < s.effects.length; i++) {
    const e = s.effects[i]!;
    if ((e.kind !== 'crew' && e.kind !== 'liftStop') || e.until <= s.tick) continue;
    if (L.doors[n] !== e) { L.doors[n] = e; t |= DOORS; }
    n++;
  }
  if (n !== L.ndoors) { L.ndoors = n; t |= DOORS; }
  return t;
}

const W: Target = { place: '', doing: 'idle' };
/** An opposition walker's way: to the place the move lands on, or to the person it is after. */
function walking(s: Readonly<GameState>, th: Threat): Target {
  const them = s.people[th.target];
  W.place = them ? whereNow(them, s.tick) : th.target;
  W.doing = SEARCHERS.has(th.kind) ? 'search' : 'guard';
  return W;
}

/** Person `i` arrives, or looks at their plan and sets out on the next leg toward where they mean to be. */
function live(s: GameState, r: Roster, L: Lives, i: number): void {
  const p = r.all[i]!;
  const a = p.at;
  const walker = L.chase[i] === s.tick;
  if ('route' in a) p.at = { place: a.route[a.route.length - 1]!, spot: r.key[i]! & 63, doing: 'idle' };
  L.chased[i] = walker ? 1 : 0;
  L.routine[i] = p.follower ? p.routine : null;
  let t: Target;
  if (walker) {
    t = walking(s, s.threats[L.threat[i]!]!);
    L.until[i] = s.tick + 1;
    L.uses[i] = 0;
  } else {
    t = plan(s, p, r.key[i]);
    const made = planned();
    L.until[i] = made.until;
    L.uses[i] = made.uses;
  }
  const at = p.at as { place: PlaceId; spot: number; doing: Activity };
  let dest = t.place;
  if (inMine(at.place) !== inMine(dest)) {
    const up = inMine(at.place);
    L.uses[i] |= WEATHER | DOORS;
    if (!liftRuns(s)) dest = up ? 'bunks' : p.home;
    else if (at.place === (up ? 'lift' : 'pithead')) {
      p.at = { route: up ? ['lift', 'pithead'] : ['pithead', 'lift'], from: s.tick, to: s.tick + TRAVEL.lift, doing: 'ride' };
      return;
    } else dest = up ? 'lift' : 'pithead';
  }
  if (at.place === dest) {
    const doing = dest === t.place ? t.doing : t.doing === 'sleep' ? 'sleep' : 'idle';
    if (at.doing !== doing) at.doing = doing;
    return;
  }
  const way = route(s, at.place, dest);
  p.at = { route: way.path, from: s.tick, to: s.tick + Math.max(1, way.ticks), doing: 'walk' };
}

/** A group's members: `house:<home>`, `crew:<work>:<shift>`, `flock:<place>` (who keep that chapel), `watch:<shift>`; never an Elite. */
function members(s: Readonly<GameState>, g: GroupId): UnitId[] {
  const out: UnitId[] = [];
  const [kind, x, y] = g.split(':', 3) as [string, string, string | undefined];
  const r = roster(s);
  for (let i = 0; i < r.all.length; i++) {
    const p = r.all[i]!;
    if (p.gone || standingOf(p) === 'elite') continue;
    const k = r.key[i];
    const ok = kind === 'house' ? p.household === g
      : kind === 'crew' ? p.work === x && shiftOf(s.seed, p, k) === y
        : kind === 'flock' ? hasHabit(s.seed, p, 'chapel', k) && haunts(s.seed, p).includes(x)
          : kind === 'watch' ? (p.role === 'soldier' || p.role === 'watchman' || p.role === 'sergeant') && shiftOf(s.seed, p, k) === x
            : false;
    if (ok) out.push(p.id);
  }
  return out;
}

/** The groups `p` is one of, in `members`' terms: their household, their crew, the flock of their chapel, the watch. */
function groupsOf(s: Readonly<GameState>, p: Readonly<Person>): GroupId[] {
  if (standingOf(p) === 'elite') return [];
  const shift = shiftOf(s.seed, p);
  const out = [p.household, `crew:${p.work}:${shift}`];
  if (hasHabit(s.seed, p, 'chapel')) out.push(`flock:${habitPlace('chapel', p.home)}`);
  if (p.role === 'soldier' || p.role === 'watchman' || p.role === 'sergeant') out.push(`watch:${shift}`);
  return out;
}

/** Where most of the group stands now, if that is at least content's share of it and two of them. */
function together(s: Readonly<GameState>, g: GroupId): PlaceId | null {
  const ms = members(s, g);
  const count = new Map<PlaceId, number>();
  let best: PlaceId | null = null, most = 0;
  for (const id of ms) {
    const a = s.people[id]!.at;
    if (!('place' in a)) continue;
    const n = (count.get(a.place) ?? 0) + 1;
    count.set(a.place, n);
    if (n > most) { most = n; best = a.place; }
  }
  return most >= TOWN.gatherMin && most >= TOWN.gatherShare * ms.length ? best : null;
}

export const world: World = {
  populate(s) {
    populate(s);
    s.weather = weatherAt(s.seed, s.tick);
    s.wind = windAt(s.seed, s.tick);
    const r = roster(s);
    for (let i = 0; i < r.all.length; i++) {
      const p = r.all[i]!;
      const t = plan(s, p, r.key[i]);
      p.at = { place: t.place, spot: r.key[i]! & 63, doing: t.doing };
    }
  },
  step(s: GameState, out: GameEvent[]) {
    if (s.tick % TPH === 0) {
      s.wind = windAt(s.seed, s.tick);
      const w = weatherAt(s.seed, s.tick);
      const dawn = s.tick === dawnOf(dayOf(s.tick));
      if (w !== s.weather || dawn) {
        s.weather = w;
        const key = `weather.${w}.${dawn ? 'dawn' : 'turn'}`;
        out.push({ tick: s.tick, kind: 'weather', weather: w, note: { key: `${key}.${keyedInt(s.seed, K.note, variants(key), s.tick)}` } });
      }
    }
    stepEvents(s, out, world);
    const r = roster(s);
    const L = livesOf(r);
    const turn = turned(s, L);
    for (let t = 0; t < s.threats.length; t++)
      for (let w = 0, ws = s.threats[t]!.walkers; w < ws.length; w++) {
        const i = r.index.get(ws[w]!);
        if (i !== undefined && L.chase[i] !== s.tick) { L.chase[i] = s.tick; L.threat[i] = t; }
      }
    // each one keeps on while walking, or while their plan holds and nothing it read has turned
    for (let i = 0; i < r.all.length; i++) {
      const p = r.all[i]!;
      const a = p.at;
      if (p.gone || ('route' in a ? s.tick < a.to
        : L.chase[i] !== s.tick && !L.chased[i] && s.tick < L.until[i]! && !(L.uses[i]! & turn) && L.routine[i] === (p.follower ? p.routine : null))) continue;
      live(s, r, L, i);
    }
  },
  echo: (s, out, from) => echoes(s, out, world, from, out.length),
  members,
  groupsOf,
  together,
  route,
  tieKind,
  spawn,
};
