// The people's lives over one seeded week: who they are, where they are by the hour, the routes they take.
import { describe, expect, it } from 'vitest';
import { DAY_TICKS, sinceDawn, dayOf } from '../../../src/content/clock';
import { BAD, WORLD_WORDS } from '../../../src/content/names';
import { ROLES } from '../../../src/content/roles';
import { NEIGHBOURS, PLACES } from '../../../src/content/world';
import { area } from '../../../src/sim/core';
import { calendarOf, populateWorld, stepWorld, weatherAt } from '../../../src/sim/world';
import { shiftOf } from '../../../src/sim/world/plans';
import { spellAt } from '../../../src/sim/world/sky';
import type { GameEvent, GameState, Person, PlaceId } from '../../../src/types';

const fresh = (seed: number): GameState => {
  const z = { suspicion: 0, level: 0 };
  const s = {
    seed, tick: 0, weather: 'clear', stage: 'whisper', people: {}, places: {}, threats: [], effects: [], crystals: {}, items: {}, flags: {},
    factions: { temple: { ...z }, council: { ...z }, public: { ...z } }, mine: { carts: {}, expected: 0, shortDays: 0, delve: 0 },
    ledger: { crystals: 0, nether: 0, turned: 0, lost: 0, suspicion: { temple: 0, council: 0, public: 0 } },
    god: { blessings: [], sockets: [], level: 1 },
  } as unknown as GameState;
  populateWorld(s);
  return s;
};
/** The first tick of day `d` (its dawn). */
const dawn = (d: number): number => d * DAY_TICKS - 650; // a run begins at the dusk: day 1's dawn is 11 hours on
const at = (p: Person): PlaceId | null => ('place' in p.at ? p.at.place : null);
const run = (s: GameState, to: number, each?: (s: GameState) => void): GameEvent[] => {
  const out: GameEvent[] = [];
  while (s.tick < to) {
    s.tick++;
    stepWorld(s, out);
    each?.(s);
  }
  return out;
};
const adjacent = (a: PlaceId, b: PlaceId): boolean => area(a) === area(b) || NEIGHBOURS[area(a)]!.includes(area(b));

describe('the people', () => {
  const s = fresh(7);
  const ps = Object.values(s.people);

  it('every trade at its headcount, named people in place, each with a name, a home and a household', () => {
    expect(ps.length).toBe(Object.values(ROLES).reduce((n, r) => n + r.count, 0));
    expect(ps.length).toBeGreaterThan(460);
    expect(new Set(ps.map((p) => p.name)).size).toBe(ps.length);
    for (const p of ps) {
      expect(p.home, p.id).toBeTruthy();
      expect(p.household, p.id).toBe(`house:${p.home}`);
      if (p.id.startsWith('u')) {
        expect(ROLES[p.role]!.work, p.id).toContain(p.work);
        expect(BAD.has(p.name) || WORLD_WORDS.has(p.name.toLowerCase()), p.name).toBe(false);
        expect(p.name.length >= 3 && p.name.length <= 7, p.name).toBe(true);
      }
    }
    expect(s.people.g17!.work).toBe('overseer');
  });

  it('ties go both ways; children live in households with grown people; facilities have masters', () => {
    for (const p of ps) for (const t of p.ties) expect(s.people[t]!.ties, `${p.id}-${t}`).toContain(p.id);
    for (const p of ps.filter((q) => q.role === 'child')) expect(ps.some((q) => q.home === p.home && q.role !== 'child' && q.role !== 'elder'), p.id).toBe(true);
    for (const [id, d] of Object.entries(PLACES)) if (d.facility && !d.officer) expect(ps.some((p) => p.masterOf.includes(id)), id).toBe(true);
    expect(s.people.e01!.masterOf).toContain('councilhall');
  });

  it('the same seed gives the same people', () => {
    expect(JSON.stringify(fresh(7).people)).toBe(JSON.stringify(s.people));
  });
});

describe('a seeded week', () => {
  const s = fresh(7);
  const ps = Object.values(s.people);
  const dayHands = ps.filter((p) => shiftOf(7, p) === 'day' && !ROLES[p.role]!.rounds && ROLES[p.role]!.side === 'mine' && ROLES[p.role]!.labour === 'dig');
  const sleepers = ps.filter((p) => shiftOf(7, p) === 'day' && !ROLES[p.role]!.watches && p.role !== 'tavernkeeper' && p.role !== 'innkeeper');
  const faces = new Map<number, number>();
  const sleeping = new Map<number, number>();
  const tavern = new Map<number, number>();
  const pray = new Map<number, number>();
  let badHops = 0, walks = 0;
  // the plans' own rhythm: the world events' doors (a strike, a levy's thin crews) are shut as they open
  run(s, dawn(8), (st) => {
    st.effects.length = 0;
    const x = sinceDawn(st.tick), d = dayOf(st.tick);
    const here = (xs: Person[]): Person[] => xs.filter((p) => !p.gone);
    if (x === 3) faces.set(d, here(dayHands).filter((p) => at(p) === p.work && 'place' in p.at && p.at.doing === 'dig').length / here(dayHands).length);
    if (x === 22) sleeping.set(d, here(sleepers).filter((p) => at(p) === p.home && 'place' in p.at && p.at.doing === 'sleep').length / here(sleepers).length);
    if (x === 13) tavern.set(d, ps.filter((p) => 'place' in p.at && p.at.doing === 'drink').length);
    if (x === 2.5) pray.set(d, ps.filter((p) => 'place' in p.at && p.at.doing === 'pray').length);
    for (const p of ps) {
      const a = p.at;
      if (!('route' in a) || a.from !== st.tick) continue;
      walks++;
      for (let i = 1; i < a.route.length; i++) if (!adjacent(a.route[i - 1]!, a.route[i]!)) badHops++;
    }
  });

  it('on a work day the day shift is at the face in the morning, and everyone is home asleep at night', () => {
    for (const d of [1, 2, 4]) {
      expect(calendarOf(d).kind).toBe('work');
      expect(faces.get(d)!, `day ${d}`).toBeGreaterThan(0.85);
    }
    for (const d of [1, 2, 3, 4, 5, 6, 7]) expect(sleeping.get(d)!, `day ${d}`).toBeGreaterThan(0.9);
  });

  it('every walk is a route on the world graph', () => {
    expect(walks).toBeGreaterThan(1000);
    expect(badHops).toBe(0);
  });

  it('each weekday has its rhythm: rest empties the faces, the Flame fills the chapels, payday the taverns', () => {
    expect(calendarOf(7).kind).toBe('rest');
    expect(faces.get(7)!).toBeLessThan(faces.get(1)! / 2);
    expect(calendarOf(6).kind).toBe('flame');
    expect(pray.get(6)!).toBeGreaterThan(pray.get(1)! * 3);
    expect(calendarOf(5).kind).toBe('payday');
    expect(tavern.get(5)!).toBeGreaterThan(tavern.get(1)!);
  });

  it('a dawn save continues identically', () => {
    const a = fresh(7);
    run(a, dawn(2));
    const b = JSON.parse(JSON.stringify(a)) as GameState;
    run(a, dawn(3));
    run(b, dawn(3));
    expect(JSON.stringify(b.people)).toBe(JSON.stringify(a.people));
  });
});

describe('the weather', () => {
  it('the wind blows from the west, wandering by the hour within its 120 degrees, turning further only as a spell of weather comes', () => {
    const s = fresh(6);
    const deg: number[] = [];
    let jumps = 0, spell = NaN;
    run(s, dawn(6), (st) => {
      if (st.tick % 50) return;
      const d = (st.wind * 180) / Math.PI, step = Math.abs(d - (deg.at(-1) ?? d));
      const sp = dayOf(st.tick) * 10 + spellAt(st.seed, st.tick);
      // an hour's wander is a few degrees; each spell veers or backs it by its own turn and a jitter of up to 15
      if (step >= 5) { jumps++; expect(sp).not.toBe(spell); }
      spell = sp;
      deg.push(d);
    });
    expect(Math.min(...deg)).toBeGreaterThanOrEqual(-60 - 45 - 15);
    expect(Math.max(...deg)).toBeLessThanOrEqual(60 + 20 + 15);
    expect(Math.max(...deg) - Math.min(...deg)).toBeGreaterThan(10);
    expect(jumps).toBeGreaterThan(5);
  });

  it('a storm stops the lift: nobody sets off on a ride while it blows', () => {
    // Seed 6 storms through the afternoon of day 2.
    expect(weatherAt(6, dawn(2) + 8 * 50)).toBe('storm');
    const s = fresh(6);
    let stormTicks = 0, ridesInStorm = 0, rides = 0;
    const events = run(s, dawn(3), (st) => {
      if (st.weather === 'storm') stormTicks++;
      for (const p of Object.values(st.people)) {
        if (!('route' in p.at) || p.at.from !== st.tick || p.at.doing !== 'ride') continue;
        rides++;
        if (st.weather === 'storm') ridesInStorm++;
      }
    });
    expect(stormTicks).toBeGreaterThan(50);
    expect(rides).toBeGreaterThan(100);
    expect(ridesInStorm).toBe(0);
    expect(events.some((e) => e.kind === 'weather' && e.weather === 'storm')).toBe(true);
  });
});

describe('the cost', () => {
  it('a tick of 460+ lives takes under 0.3 ms in node', () => {
    const s = fresh(11);
    run(s, dawn(1));
    const out: GameEvent[] = [];
    const t0 = performance.now();
    for (let i = 0; i < DAY_TICKS; i++) {
      s.tick++;
      stepWorld(s, out);
    }
    expect((performance.now() - t0) / DAY_TICKS).toBeLessThan(0.3);
  });
});
