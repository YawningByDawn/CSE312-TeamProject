// The whisper (inventory #19, #20): its odds with a reason for each term; a move priced at Direct Nether; the grave's seep
// and a stone's worth.
import { describe, expect, it } from 'vitest';
import { dayOf } from '../../../src/content/clock';
import { uiText } from '../../../src/content/text';
import { makeSim } from '../../../src/sim';
import { area, setHold, standingOf, type Ctx } from '../../../src/sim/core';
import { directNether } from '../../../src/sim/influence';
import { PLACES } from '../../../src/content/world';
import type { GameEvent } from '../../../src/types';

const { sim, query } = makeSim();
function live(): Ctx {
  const s = sim.create(7);
  while (s.tick < s.until) (s.pending?.kind === 'story' ? sim.act(s, { type: 'story', option: 1 }) : sim.step(s)); // the first day played to its dusk: the night is the god's
  s.god.nether = 500;
  s.god.ap = s.god.apMax = 50;
  s.until = Infinity; // the clock runs: these tests step ticks, not turns
  for (const p of Object.values(s.people)) p.marked = dayOf(s.tick); // a whisper reaches the marked
  return { s, out: [] };
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

  it('a move is priced at Direct Nether; it posts anywhere seen but the lift', () => {
    const c = live();
    const p = Object.values(c.s.people).find((x) => standingOf(x) === 'mortal' && 'place' in x.at)!;
    p.follower = true;
    const to = (a: string): string => Object.keys(PLACES).find((id) => area(id) === a && id !== p.work)!;
    const target = to('eastworks');
    setHold(c, 'eastworks', 60);
    setHold(c, 'lift', 60);
    const check = query.check(c.s, { type: 'move', unit: p.id, to: target });
    expect(check.why).toEqual([]);
    expect(check.nether).toBe(directNether(p));
    expect(check.nether).toBeGreaterThan(0);
    expect(query.check(c.s, { type: 'move', unit: p.id, to: to('lift') }).why).toEqual([{ key: 'why.noPost' }]);
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
