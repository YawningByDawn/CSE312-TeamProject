// The host (OVERHAUL, ov-core): the body stats, hit points, the day played as a possessed follower, the dawn's pick, the marks a
// whisper needs, the host's fall, and the revival of the fallen.
import { describe, expect, it } from 'vitest';
import { AT, NIGHT_TICKS, isDay, nextAt } from '../../../src/content/clock';
import { FIRST_MINER, HOST, STATS } from '../../../src/content/stats';
import { makeSim } from '../../../src/sim';
import { everyone, here, type Ctx } from '../../../src/sim/core';
import { maxHp } from '../../../src/sim/formulas';
import { hurt, mend } from '../../../src/sim/host';
import { xyOf } from '../../../src/sim/world/xy';
import type { GameEvent, GameState, Person } from '../../../src/types';

const { sim, query } = makeSim();

/** A run opened: the first gift taken, the day of the first dawn begun in the first miner. */
function begin(seed = 7): GameState {
  const s = sim.create(seed);
  expect(sim.act(s, { type: 'take', card: s.god.deal![0]! }).ok).toBe(true);
  return s;
}
/** Answer what stops the clock (a story, a blessing). */
function settle(s: GameState): void {
  if (s.pending?.kind === 'story') sim.act(s, { type: 'story', option: 1 });
  else if (s.pending?.kind === 'blessing') sim.act(s, { type: 'pickBlessing', blessing: s.pending.offers[0]! });
}
/** Step to where the clock ends now (the dusk by day, the dawn once slept), answering what stops it; the events it made. */
function run(s: GameState, to = s.until): GameEvent[] {
  const out: GameEvent[] = [];
  while (s.tick < to && s.phase === 'live' && !query.picking(s)) {
    if (s.pending) settle(s);
    else out.push(...sim.step(s));
  }
  return out;
}
/** From the day to the dusk, the night slept to the next dawn. */
function nextDawn(s: GameState): void {
  if (isDay(s.tick)) run(s);
  settle(s);
  expect(sim.act(s, { type: 'sleep' }).ok).toBe(true);
  run(s);
  settle(s);
}
const dusk = (s: GameState): number => nextAt(s.tick, AT.dusk);
const ctx = (s: GameState): Ctx => ({ s, out: [] });
/** Strangers set down on the host's body: markable. */
function beside(s: GameState, n = 1): Person[] {
  const host = s.people[s.host!]!;
  const out = everyone(s).filter((p) => !p.follower && p !== host && here(p)).slice(0, n);
  for (const p of out) p.at = { place: 'bunks', spot: 0, doing: 'idle' };
  Object.assign(s.body!, xyOf(out[0]!, s.tick));
  return out;
}
const follower = (s: GameState): Person => {
  const f = everyone(s).find((p) => p.id !== FIRST_MINER.id)!;
  Object.assign(f, { follower: true, routine: 'pray' });
  f.stats.devotion = 30;
  return f;
};

describe('the body stats', () => {
  it('everyone has the four at 1..20 averaging 10, Devotion 0 and full HP; the first miner has his table', () => {
    const s = sim.create(7);
    const all = everyone(s);
    const rest = all.filter((p) => p.id !== FIRST_MINER.id);
    const body = [(p: Person) => p.stats.dexterity, (p: Person) => p.stats.intelligence, (p: Person) => p.stats.strength, (p: Person) => p.stats.endurance];
    for (const p of all) {
      for (const f of body) {
        expect(f(p)).toBeGreaterThanOrEqual(STATS.min);
        expect(f(p)).toBeLessThanOrEqual(STATS.max);
      }
      expect([p.stats.devotion, p.stats.hp]).toEqual([0, maxHp(p.stats)]);
    }
    for (const f of body) {
      const mean = rest.reduce((n, p) => n + f(p), 0) / rest.length;
      expect(mean).toBeGreaterThan(9.5);
      expect(mean).toBeLessThan(11.5);
    }
    expect(s.people[FIRST_MINER.id]!.stats).toMatchObject(FIRST_MINER.stats);
  });

  it('max HP is a base plus Strength and Endurance; Endurance mends an hour at a time', () => {
    expect(maxHp({ strength: 10, endurance: 10 })).toBe(STATS.hpBase + 10 * STATS.hpPerStrength + 10 * STATS.hpPerEndurance);
    expect(maxHp({ strength: 20, endurance: 10 })).toBeGreaterThan(maxHp({ strength: 10, endurance: 10 }));
    expect(maxHp({ strength: 10, endurance: 20 })).toBeGreaterThan(maxHp({ strength: 20, endurance: 10 }));
    const s = sim.create(7);
    const p = s.people.g02!;
    p.stats.hp = 10;
    s.tick = 51;
    mend(s);
    expect(p.stats.hp).toBe(10); // not on the hour
    s.tick = 100;
    mend(s);
    expect(p.stats.hp).toBeCloseTo(10 + STATS.regenPerEndurance * p.stats.endurance, 5);
    p.stats.hp = maxHp(p.stats) - 0.1;
    mend(s);
    expect(p.stats.hp).toBe(maxHp(p.stats));
  });
});

describe('the turn', () => {
  it('the run opens at the first dawn in the first miner, the day his; the dusk ends the possession', () => {
    const s = begin();
    expect([s.tick, isDay(s.tick), s.host]).toEqual([NIGHT_TICKS, true, FIRST_MINER.id]);
    expect(s.until).toBe(dusk(s));
    expect(query.check(s, { type: 'whisper', target: 'g02' }).why).toEqual([{ key: 'why.day' }]);
    const kinds = run(s).map((e) => e.kind);
    expect(kinds).toContain('release');
    expect([s.host, s.body, isDay(s.tick)]).toEqual([FIRST_MINER.id, null, false]); // the body is let go; the plate keeps the host
  });

  it('at a dawn with followers the clock waits for the pick: the first miner and the followers are on the list', () => {
    const s = begin();
    run(s);
    const f = follower(s);
    nextDawn(s);
    expect([s.host, s.body, query.picking(s), query.hosts(s)]).toEqual([FIRST_MINER.id, null, true, [FIRST_MINER.id, f.id]]); // the pick opens on someone
    const tick = s.tick;
    expect(sim.step(s)).toEqual([]);
    expect(s.tick).toBe(tick);
    expect(query.check(s, { type: 'possess', unit: 'g03' }).why).toEqual([{ key: 'why.notOffered' }]);
    expect(sim.act(s, { type: 'possess', unit: f.id }).ok).toBe(true);
    expect([s.host, query.picking(s), s.body !== null]).toEqual([f.id, false, true]);
    expect(query.check(s, { type: 'possess', unit: f.id }).why).toEqual([{ key: 'why.hosting' }]);
    // by day the host may be swapped for another on the list
    expect(sim.act(s, { type: 'possess', unit: FIRST_MINER.id }).ok).toBe(true);
    expect([s.host, s.body !== null]).toEqual([FIRST_MINER.id, true]);
    sim.step(s);
    expect(s.tick).toBe(tick + 1);
  });
});

describe('marks', () => {
  it('the host marks one near them, three a day; a mark holds three days, and a whisper needs it', () => {
    const s = begin();
    const near = beside(s, 4);
    expect(query.near(s)).toEqual(expect.arrayContaining(near.map((p) => p.id)));
    const far = everyone(s).find((p) => !p.follower && !query.near(s).includes(p.id) && p.id !== FIRST_MINER.id)!;
    expect(query.check(s, { type: 'mark', target: far.id }).why).toEqual([{ key: 'why.notNear' }]);
    for (const p of near.slice(0, 3)) expect(sim.act(s, { type: 'mark', target: p.id }).ok).toBe(true);
    expect(query.check(s, { type: 'mark', target: near[0]!.id }).why).toEqual([{ key: 'why.marked' }]);
    expect(query.check(s, { type: 'mark', target: near[3]!.id }).why).toEqual([{ key: 'why.marksSpent', slots: { n: HOST.marksPerDay } }]);
    expect(query.markLeft(s, near[3]!.id)).toBe(0);
    // a whisper in the night of the day and of the two after reaches them; the third night after does not
    for (const left of [3, 2, 1, 0]) {
      expect(query.markLeft(s, near[0]!.id)).toBe(left);
      run(s);
      const why = query.check(s, { type: 'whisper', target: near[0]!.id }).why.map((w) => w.key);
      expect(why.includes('why.notMarked')).toBe(left === 0);
      nextDawn(s);
    }
  });

  it('a mark cannot be made at night, on a follower, or with no host standing', () => {
    const s = begin();
    const [p] = beside(s);
    p!.follower = true;
    expect(query.check(s, { type: 'mark', target: p!.id }).why).toEqual([{ key: 'why.already' }]);
    p!.follower = false;
    s.people[FIRST_MINER.id]!.stats.hp = 0;
    expect(query.check(s, { type: 'mark', target: p!.id }).why).toEqual([{ key: 'why.noHost' }]);
    s.people[FIRST_MINER.id]!.stats.hp = 50;
    run(s);
    expect(query.check(s, { type: 'mark', target: p!.id }).why).toEqual([{ key: 'why.closed' }]);
  });
});

describe('the fall', () => {
  it('a host at 0 HP dies and the first miner takes over at once, whole, at home; the day plays on; a follower stays dead', () => {
    const s = begin();
    const f = follower(s);
    expect(sim.act(s, { type: 'possess', unit: f.id }).ok).toBe(true);
    s.mobs.push({ x: 0, y: 0, hp: 30, down: -1 } as unknown as GameState['mobs'][number]);
    hurt(ctx(s), f, f.stats.hp);
    expect([f.stats.hp, f.gone, s.host]).toEqual([0, 'dead', f.id]);
    sim.step(s);
    expect([s.host, query.picking(s), s.body !== null, s.mobs.length]).toEqual([FIRST_MINER.id, false, true, 0]);
    run(s);
    expect([isDay(s.tick), f.gone]).toEqual([false, 'dead']);
  });

  it('the host plate has someone through the night, and a day never opens without a body', () => {
    const s = begin();
    for (let d = 0; d < 3; d++) {
      expect(s.host).not.toBeNull();
      expect(s.body !== null || !isDay(s.tick)).toBe(true);
      nextDawn(s);
    }
  });

  it('the first miner who falls is up again at once, free, with the stats he began with; the day plays on', () => {
    const s = begin();
    const first = s.people[FIRST_MINER.id]!;
    const stats = { ...first.stats };
    hurt(ctx(s), first, 1000);
    expect([first.stats.hp, first.gone]).toEqual([0, null]);
    sim.step(s);
    expect(first.stats).toEqual({ ...stats, hp: maxHp(stats) });
    expect([s.host, s.body !== null, query.check(s, { type: 'walk', dx: 1, dy: 0 }).why]).toEqual([FIRST_MINER.id, true, []]);
    first.gone = 'dead'; // even gone, he stands again
    first.stats.hp = 0;
    sim.step(s);
    expect([first.gone, first.stats.hp, s.host]).toEqual([null, maxHp(stats), FIRST_MINER.id]);
    nextDawn(s);
    expect([s.host, s.body !== null]).toEqual([FIRST_MINER.id, true]);
  });

  it('a fallen follower is revived for stones, at full HP, a follower again; a stranger is not', () => {
    const s = begin();
    const f = follower(s);
    const stranger = everyone(s).find((p) => p.id !== FIRST_MINER.id && p !== f)!;
    hurt(ctx(s), f, 1000);
    hurt(ctx(s), stranger, 1000);
    run(s);
    expect(query.check(s, { type: 'revive', unit: stranger.id }).why).toEqual([{ key: 'why.notFallen' }]);
    const pouch = (): string[] => Object.keys(s.crystals).filter((id) => 'pouch' in s.crystals[id]!.at);
    const stones = pouch().length;
    expect(stones).toBeGreaterThanOrEqual(HOST.reviveStones);
    const held = s.crystals;
    s.crystals = {};
    expect(query.check(s, { type: 'revive', unit: f.id }).why).toEqual([{ key: 'why.stones', slots: { n: HOST.reviveStones } }]);
    s.crystals = held;
    expect(sim.act(s, { type: 'revive', unit: f.id }).ok).toBe(true);
    expect([f.gone, f.follower, f.stats.hp]).toEqual([null, true, maxHp(f.stats)]);
    expect(pouch().length).toBe(stones - HOST.reviveStones);
  });
});
