// The whisper (inventory #19, #20): its odds with a reason for each term; a gathered group whispered to as one, in the
// town only and only while together; the run's tally of whispers, turnings and the most followers at once.
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../../src/content/balance';
import { AT, tod } from '../../../src/content/clock';
import { uiText } from '../../../src/content/text';
import { makeSim } from '../../../src/sim';
import { area, setHold, standingOf, type Ctx } from '../../../src/sim/core';
import { directNether } from '../../../src/sim/influence';
import { groupsOf, members, together } from '../../../src/sim/world';
import { PLACES } from '../../../src/content/world';
import type { GameEvent, GameState, GroupId } from '../../../src/types';

const { sim, query } = makeSim();
function live(stage?: 'shade'): Ctx {
  const s = sim.create(7, stage ? { stage } : undefined);
  s.phase = 'live';
  s.god.nether = 500;
  s.god.ap = s.god.apMax = 50;
  s.until = Infinity; // the clock runs: these tests step ticks, not turns
  return { s, out: [] };
}
/** Step to the next night, when households sleep at home together. */
function toNight(s: GameState): void {
  do sim.step(s); while (tod(s.tick) !== AT.night + 30);
}
/** A household of strangers sleeping at home together, its home coloured so it is in reach. */
function sleepingHouse(c: Ctx): GroupId {
  toNight(c.s);
  const p = Object.values(c.s.people).find((x) => x.home.startsWith('home:') && !x.follower && together(c.s, x.household) === x.home)!;
  setHold(c, area(p.home), 60);
  return p.household;
}

describe('the whisper', () => {
  it('its odds come with a reason for each term, in words that fill', () => {
    const c = live();
    const id = sim.legal(c.s).find((a) => a.type === 'whisper')!;
    const target = (id as { target: string }).target;
    const o = query.odds(c.s, target);
    expect(o.odds).toBe(query.check(c.s, id).odds);
    expect(o.why.slice(0, 3).map((r) => r.key)).toEqual(['odds.base', 'odds.presence', 'odds.resistance']);
    for (const r of o.why) expect(uiText(r.key, r.slots)).not.toMatch(/[{}]/);
  });

  it('a group is whispered to only in the town, only while together, and one roll turns or softens every one there', () => {
    const w = live();
    const house = sleepingHouse(w);
    expect(sim.act(w.s, { type: 'whisperGroup', group: house }).why).toEqual([{ key: 'why.shade' }]);

    const c = live('shade');
    const g = sleepingHouse(c);
    const there = members(c.s, g).map((id) => c.s.people[id]!).filter((p) => 'place' in p.at && p.at.place === c.s.people[members(c.s, g)[0]!]!.home);
    const before = there.map((p) => p.resistance);
    const check = query.check(c.s, { type: 'whisperGroup', group: g });
    expect(check.ok).toBe(true);
    expect(check.odds).toBeGreaterThan(0);
    const r = sim.act(c.s, { type: 'whisperGroup', group: g });
    const e = r.events.find((x): x is Extract<GameEvent, { kind: 'whisper' }> => x.kind === 'whisper')!;
    expect(e.group).toBe(g);
    if (e.ok) expect(there.every((p) => p.follower)).toBe(true);
    else there.forEach((p, i) => expect(p.resistance).toBe(before[i]! + BALANCE.failedWhisperResistance));
    const all = members(c.s, g).every((id) => c.s.people[id]!.follower);
    expect(sim.act(c.s, { type: 'whisperGroup', group: g }).why).toEqual([{ key: all ? 'why.already' : 'why.allHeard' }]);
    expect(c.s.tally.whispers).toBe(1);
    expect(c.s.tally.turned).toBe(e.ok ? there.length : 0);
    expect(c.s.tally.peak).toBe(Object.values(c.s.people).filter((p) => p.follower && p.gone === null).length);
  });

  it('a crew off its shift is not together', () => {
    const c = live('shade');
    toNight(c.s);
    const p = Object.values(c.s.people).find((x) => groupsOf(c.s, x)[1]?.endsWith(':day') && x.home.startsWith('home:'))!;
    expect(sim.act(c.s, { type: 'whisperGroup', group: groupsOf(c.s, p)[1]! }).why).toEqual([{ key: 'why.notTogether' }]);
  });

  it('a move is priced at Direct Nether; it posts anywhere seen but the lift and the gate', () => {
    const c = live('shade');
    const p = Object.values(c.s.people).find((x) => standingOf(x) === 'mortal' && x.work !== 'minehead' && 'place' in x.at)!;
    p.follower = true;
    for (const a of ['minehead', 'lift', 'citygate']) setHold(c, a, 60);
    const to = (a: string): string => Object.keys(PLACES).find((id) => area(id) === a)!;
    const check = query.check(c.s, { type: 'move', unit: p.id, to: to('minehead') });
    expect(check.why).toEqual([]);
    expect(check.nether).toBe(directNether(p));
    expect(check.nether).toBeGreaterThan(0);
    for (const a of ['lift', 'citygate']) expect(query.check(c.s, { type: 'move', unit: p.id, to: to(a) }).why).toEqual([{ key: 'why.noPost' }]);
  });

  it('an Elite is one of no group: each is whispered to alone', () => {
    const s = sim.create(7, { stage: 'shade' });
    const people = Object.values(s.people);
    const elites = people.filter((p) => standingOf(p) === 'elite');
    expect(elites.length).toBeGreaterThan(0);
    for (const p of elites) expect(groupsOf(s, p)).toEqual([]);
    for (const p of people) for (const g of groupsOf(s, p))
      for (const id of members(s, g)) expect(standingOf(s.people[id]!)).not.toBe('elite');
  });

  it("the grave's seep is told at dusk as a stone reaching the grave", () => {
    const c = live();
    const seeps: GameEvent[] = [];
    for (let i = 0; i < 3 * 1200 && seeps.length === 0; i++) {
      c.s.until = Infinity; // each dawn sets the day's end; this test runs days on
      if (c.s.pending) c.s.pending = null; // a story's door is not what is tested
      seeps.push(...sim.step(c.s).filter((e) => e.kind === 'seep'));
    }
    expect(seeps[0]).toMatchObject({ place: 'grave' });
    expect('pouch' in c.s.crystals[(seeps[0] as { crystal: string }).crystal]!.at).toBe(true);
  });

  it("a stone's worth: eating it takes away the Hunger it says", () => {
    const c = live();
    const id = Object.keys(c.s.crystals).find((x) => 'pouch' in c.s.crystals[x]!.at)!;
    c.s.god.hunger = 95;
    const { hunger } = query.worth(c.s, id);
    expect(sim.act(c.s, { type: 'eat', crystal: id }).ok).toBe(true);
    expect(c.s.god.hunger).toBeCloseTo(Math.max(0, 95 - hunger), 1);
  });
});
