/**
 * src/sim/world, the people's lives, which the rules import. Owns who lives in the world
 * (society: every trade's headcount, the named people, bunks, ties), where each is and what they do by the hour
 * (plans), the routes on content's world graph (graph, area), the calendar and the weather (sky), the world's events
 * and the day's feed (events), and the keyed draws they roll (draw). Reads content's world, day, clock, calendar,
 * weather, roles, people, names, traits, worldEvents and discoveries, and the rules' whereabouts (sim/core); writes
 * only the people (populated, placed, newcomers), the weather and wind, and events.
 * Everyone is placed by their plan, walking the world graph between places, the opposition's walkers on their way.
 * A person plans when they arrive and when their plan can change: its hour comes, or the weather or a crew door it
 * read turns, or their routine does.
 */
import { TPH, dayOf } from '../../content/clock';
import type { Activity, Effect, GameEvent, GameState, PlaceId, Threat, Weather } from '../../types';
import { whereNow } from '../core';
import { K, keyedInt } from './draw';
import { dawnOf, stepEvents, variants } from './events';
import { route } from './graph';
import { DOORS, WEATHER, plan, planned, haunts, type Target } from './plans';
import { populate as settle, roster, type Roster } from './society';
import { weatherAt, windAt } from './sky';

export { calendarOf, regimeOf, weatherAt } from './sky';
export { echoes, eventsOf } from './events';
export { makeName, spawn, tieKind } from './society';
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

/** What turned since the last tick that plans read: `WEATHER`, `DOORS` (a crew door opened or shut). */
function turned(s: Readonly<GameState>, L: Lives): number {
  let t = 0;
  if (s.weather !== L.weather) { L.weather = s.weather; t |= WEATHER; }
  let n = 0;
  for (let i = 0; i < s.effects.length; i++) {
    const e = s.effects[i]!;
    if (e.kind !== 'crew' || e.until <= s.tick) continue;
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
  const dest = t.place;
  if (at.place === dest) {
    const doing = dest === t.place ? t.doing : t.doing === 'sleep' ? 'sleep' : 'idle';
    if (at.doing !== doing) at.doing = doing;
    return;
  }
  const way = route(s, at.place, dest);
  p.at = { route: way.path, from: s.tick, to: s.tick + Math.max(1, way.ticks), doing: 'walk' };
}

/** Everyone, with bunks, work and ties, from the seed and content's tables, each where their plan has them. */
export function populateWorld(s: GameState): void {
  settle(s);
  s.weather = weatherAt(s.seed, s.tick);
  s.wind = windAt(s.seed, s.tick);
  const r = roster(s);
  for (let i = 0; i < r.all.length; i++) {
    const p = r.all[i]!;
    const t = plan(s, p, r.key[i]);
    p.at = { place: t.place, spot: r.key[i]! & 63, doing: t.doing };
  }
}

/** One tick of lives: whereabouts by the hour, calendar, weather, world events, the opposition's walkers. */
export function stepWorld(s: GameState, out: GameEvent[]): void {
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
  stepEvents(s, out);
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
}
