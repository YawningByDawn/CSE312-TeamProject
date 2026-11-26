// The fight (OVERHAUL, ov-combat): the skeletons' ramp by day, the host's blow from Strength, what a blow reaches, the Nether a slain one leaves, the hunt.
import { describe, expect, it } from 'vitest';
import { DAY_TICK_S, DAY_TICKS, dayOf } from '../../../src/content/clock';
import { COMBAT } from '../../../src/content/combat';
import { areaAt } from '../../../src/content/mine';
import { FIRST_MINER } from '../../../src/content/stats';
import { makeSim } from '../../../src/sim';
import { mobDamage, mobHp, swingDamage } from '../../../src/sim/formulas';
import { seedRng } from '../../../src/sim/rng';
import { clear } from '../../../src/sim/walk';
import type { GameState, Mob } from '../../../src/types';

const { sim } = makeSim();
const T = DAY_TICK_S;

function day(seed = 7): GameState {
  const s = sim.create(seed);
  expect(sim.act(s, { type: 'take', card: s.god.deal![0]! }).ok).toBe(true);
  while (s.pending?.kind === 'story') sim.act(s, { type: 'story', option: 1 });
  return s;
}
const ticks = (s: GameState, n: number): void => { for (let i = 0; i < n; i++) sim.step(s); };
const miner = (s: GameState) => s.people[FIRST_MINER.id]!;
/** A standing skeleton `dx, dy` from the body. */
function mob(s: GameState, dx: number, dy: number, hp = 1000): Mob {
  const b = s.body!;
  const m: Mob = { id: `m${s.next++}`, x: b.x + dx, y: b.y + dy, lx: b.x + dx, ly: b.y + dy, face: -1, dx: 0, dy: 0, walked: 0, hp, swing: -1, down: -1, stuck: 0 };
  s.mobs.push(m);
  return m;
}
const swingAt = (s: GameState, dx: number, dy: number): void => void sim.act(s, { type: 'swing', dx, dy });

describe('the ramp', () => {
  it('a skeleton\'s Hit Points and blow rise linearly by day from the table\'s first day', () => {
    expect([mobHp(1), mobDamage(1)]).toEqual([COMBAT.skeleton.hp, COMBAT.skeleton.damage]);
    for (const d of [2, 5, 20]) {
      expect(mobHp(d) - mobHp(d - 1)).toBeCloseTo(COMBAT.skeleton.hpPerDay, 9);
      expect(mobDamage(d) - mobDamage(d - 1)).toBeCloseTo(COMBAT.skeleton.damagePerDay, 9);
    }
  });

  it('one that comes on a later day carries that day\'s Hit Points', () => {
    const s = day();
    s.tick += 3 * DAY_TICKS; // three days on, the host still standing
    s.until += 3 * DAY_TICKS;
    const d = dayOf(s.tick);
    for (let i = 0; i < 800 && s.mobs.length === 0; i++) sim.step(s);
    expect(d).toBeGreaterThan(1);
    expect(s.mobs[0]!.hp).toBe(mobHp(d));
  });
});

describe('the host\'s blow', () => {
  it('is Strength\'s damage, and Dexterity changes neither it nor the swing\'s length', () => {
    expect(swingDamage(10)).toBe(20);
    expect(swingDamage(20)).toBe(40);
    const lasts = (dexterity: number): number => {
      const s = day();
      Object.assign(miner(s).stats, { dexterity });
      swingAt(s, 1, 0);
      let n = 0;
      while (s.body!.swing >= 0) { sim.step(s); n++; }
      return n;
    };
    expect(lasts(6)).toBe(lasts(20));
    expect(lasts(6) * T).toBeGreaterThanOrEqual(COMBAT.host.swing);
  });

  it('lands at its second of the swing on what is in front within reach, not before and not behind or beyond', () => {
    const s = day();
    Object.assign(miner(s).stats, { strength: 10 });
    s.mobs.length = 0;
    const front = mob(s, 20, 0), behind = mob(s, -20, 0), far = mob(s, 100, 0);
    swingAt(s, 1, 0);
    expect(s.mobs.map((m) => m.hp)).toEqual([1000, 1000, 1000]);
    ticks(s, Math.ceil(COMBAT.host.blow / T));
    expect([front.hp, behind.hp, far.hp]).toEqual([1000 - 20, 1000, 1000]);
    ticks(s, 6);
    expect(front.hp).toBe(980); // one swing, one blow
  });

  it('answers a click only once the swing before it is done, and ends the mining', () => {
    const s = day();
    s.body!.ore = 0;
    expect(sim.act(s, { type: 'swing', dx: 1, dy: 0 }).ok).toBe(true);
    expect(s.body!.ore).toBeNull();
    expect(sim.act(s, { type: 'swing', dx: 1, dy: 0 })).toMatchObject({ ok: false, why: [{ key: 'why.swinging' }] });
  });
});

describe('a slain skeleton', () => {
  it('falls at 0 Hit Points, lies a while, then is gone; Nether comes of some of them, the table\'s amount', () => {
    let drops = 0;
    const N = 120;
    for (let seed = 1; seed <= N; seed++) {
      const s = day();
      s.rng = seedRng(seed);
      s.mobs.length = 0;
      const m = mob(s, 15, 0, 1);
      const before = s.god.nether;
      swingAt(s, 1, 0);
      ticks(s, 2);
      expect(m.hp).toBe(0);
      expect(m.down).toBeGreaterThanOrEqual(0);
      const got = s.god.nether - before;
      expect([0, COMBAT.skeleton.drop]).toContain(Math.round(got * 10) / 10);
      if (got > 0) drops++;
    }
    expect(drops).toBeGreaterThan(N * 0.3);
    expect(drops).toBeLessThan(N * 0.7);
    const s = day();
    s.mobs.length = 0;
    const m = mob(s, 15, 0, 1);
    swingAt(s, 1, 0);
    ticks(s, 2 + Math.ceil(COMBAT.corpse / T));
    expect(s.mobs.includes(m)).toBe(false);
  });
});

describe('the hunt', () => {
  it('skeletons come now and then, never more than the table\'s few at once, on clear ground out past the lit ground', () => {
    const s = day();
    let most = 0, seen = 0;
    const known = new Set<string>();
    for (let i = 0; i < 400; i++) {
      sim.step(s);
      most = Math.max(most, s.mobs.length);
      for (const m of s.mobs) if (!known.has(m.id)) {
        known.add(m.id);
        seen++;
        expect(clear(m.lx, m.ly)).toBe(true);
      }
    }
    expect(seen).toBeGreaterThan(0);
    expect(most).toBeLessThanOrEqual(COMBAT.spawn.max);
  });

  it('one walks to the host and strikes them for the day\'s damage once its blow lands, and a host at 0 Hit Points has fallen', () => {
    const s = day();
    s.mobs.length = 0;
    const b = s.body!;
    const m = mob(s, COMBAT.skeleton.reach + 3, 0);
    const hp = miner(s).stats.hp;
    let n = 0;
    while (miner(s).stats.hp === hp && n++ < 40) ticks(s, 1);
    expect(miner(s).stats.hp).toBeCloseTo(hp - mobDamage(dayOf(s.tick)), 9);
    expect(m.x).toBeLessThan(b.x + COMBAT.skeleton.reach + 3);
    miner(s).stats.hp = 1;
    n = 0;
    while (s.mobs.length > 0 && n++ < 80) ticks(s, 1);
    expect(s.mobs).toHaveLength(0); // the host fell: the dark takes them back
    expect(miner(s).stats.hp).toBeGreaterThan(1); // and the first miner stands whole in a new body (§125)
    expect(s.body).not.toBeNull();
  });

  it('one that cannot get on (rock between) is lost in the dark after the table\'s seconds', () => {
    const s = day();
    s.mobs.length = 0;
    const b = s.body!;
    let rock: [number, number] | null = null; // the nearest rock to the host, 100..400 units off
    for (let r = 100; r <= 400 && !rock; r += 10) for (let a = 0; a < 360 && !rock; a += 15) {
      const x = b.x + r * Math.cos((a * Math.PI) / 180), y = b.y + r * Math.sin((a * Math.PI) / 180);
      if (areaAt(x, y) === null) rock = [x, y];
    }
    expect(rock).not.toBeNull();
    const m = mob(s, 0, 0);
    Object.assign(m, { x: rock![0], y: rock![1], lx: rock![0], ly: rock![1] }); // in rock no step is clear
    ticks(s, Math.ceil(COMBAT.spawn.lost / T) - 1);
    expect(s.mobs.includes(m)).toBe(true);
    ticks(s, 1);
    expect(s.mobs.includes(m)).toBe(false);
  });

  it('they are gone at the dusk', () => {
    const s = day();
    s.tick = s.until - 3;
    mob(s, 100, 0);
    ticks(s, 3);
    expect(s.mobs).toHaveLength(0);
  });
});
