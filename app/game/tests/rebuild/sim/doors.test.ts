// The day's doors (DECISIONS §104): the weather's, the weekday's and the world's events' effects open or close a
// rule number where they fall; multipliers multiply, counts and odds add, a door on a place opens its whole area.
import { describe, expect, it } from 'vitest';
import { NEIGHBOURS } from '../../../src/content/world';
import { makeSim } from '../../../src/sim';
import { addHeat, door, flockOf, type Ctx } from '../../../src/sim/core';
import { placeInReach, whisperOdds } from '../../../src/sim/influence';
import type { Effect } from '../../../src/types';

function begin(): Ctx {
  const { sim } = makeSim();
  const s = sim.create(4);
  s.weather = 'clear';
  return { s, out: [] };
}
const open = (c: Ctx, kind: Effect['kind'], on: string, value: number, until = c.s.tick + 100): void => {
  c.s.effects.push({ kind, on, until, value });
};

describe("the day's doors", () => {
  it('multipliers multiply and counts add; a door on a place opens its area; a lapsed door is shut', () => {
    const c = begin();
    const strike = door(c.s, 'strike', 'heartvein');
    open(c, 'strike', 'heartvein', 1.25);
    open(c, 'strike', '*', 0.8);
    expect(door(c.s, 'strike', 'heartvein')).toBeCloseTo(strike * 1.25 * 0.8);
    const guards = door(c.s, 'guards', 'bunks');
    open(c, 'guards', 'pitkitchen', 2);
    open(c, 'guards', 'bunks', -1);
    open(c, 'guards', 'bunks', 5, c.s.tick);
    expect(door(c.s, 'guards', 'bunks')).toBe(guards + 1);
  });

  it('a whisper door on a person adds to their odds', () => {
    const c = begin();
    const fl = flockOf(c.s);
    const p = Object.values(c.s.people).find((x) => !x.follower && whisperOdds(c.s, fl, x) > 0.06 && whisperOdds(c.s, fl, x) < 0.8)!;
    const was = whisperOdds(c.s, fl, p);
    open(c, 'whisper', p.id, 0.1);
    expect(whisperOdds(c.s, fl, p)).toBeCloseTo(was + 0.1, 3);
  });

  it('a notice door multiplies a power’s heat gains', () => {
    const c = begin();
    c.s.factions.council.suspicion = 0;
    addHeat(c, 'council', 10, 'talk');
    const plain = c.s.factions.council.suspicion;
    c.s.factions.council.suspicion = 0;
    open(c, 'notice', 'council', 2);
    addHeat(c, 'council', 10, 'talk');
    expect(c.s.factions.council.suspicion).toBeCloseTo(plain * 2, 1);
  });

  it('a reach door carries whispers one area further', () => {
    const c = begin();
    const fl = flockOf(c.s);
    const areas = Object.keys(c.s.places);
    const near = areas.filter((a) => placeInReach(c.s, fl, a));
    open(c, 'reach', '*', 1);
    const reached = areas.filter((a) => !near.includes(a) && placeInReach(c.s, fl, a));
    expect(reached.length).toBeGreaterThan(0);
    for (const a of reached) expect(NEIGHBOURS[a]!.some((n) => near.includes(n)), a).toBe(true);
  });
});
