// The powers' moves (DECISIONS §15.14, §100): a crossing calls its level's move, which lands at dusk unless answered;
// cooling below the floor fizzles it.
import { describe, expect, it } from 'vitest';
import { TIES } from '../../../src/content/balance';
import { THREAT } from '../../../src/content/threats';
import { makeSim } from '../../../src/sim';
import type { Ctx } from '../../../src/sim/core';
import { crossings, powersDusk } from '../../../src/sim/threats';
import type { GameState } from '../../../src/types';

function begin(): Ctx {
  const { sim } = makeSim();
  const s = sim.create(4);
  return { s, out: [] };
}
function turn(s: GameState, ids: string[]): void {
  for (const id of ids) Object.assign(s.people[id]!, { follower: true, routine: 'pray', stats: { ...s.people[id]!.stats, devotion: 40 } });
}
function temple(c: Ctx, heat: number): void {
  Object.assign(c.s.factions.temple, { suspicion: heat, level: 3, called: 2 });
  crossings(c);
}

describe("the powers' moves", () => {
  it('the Temple crossing into level 3 calls the purge: at dusk it burns a follower, their ties soften, it spends its heat', () => {
    const c = begin();
    const ids = Object.keys(c.s.people).slice(0, 6);
    turn(c.s, ids);
    temple(c, 80);
    const t = c.s.threats.find((x) => x.kind === 'purge')!;
    expect(ids).toContain(t.target);
    const ties = c.s.people[t.target]!.ties.map((id) => c.s.people[id]!).filter((p) => !p.follower);
    for (const p of ties) p.resistance = 50;
    c.s.tick = t.lands;
    powersDusk(c);
    expect(c.s.people[t.target]!.gone).toBe('burned');
    expect(ties.length).toBeGreaterThan(0);
    for (const p of ties) expect(p.resistance).toBe(50 - TIES.takenSoften);
    expect(c.s.factions.temple.suspicion).toBe(80 - THREAT.purgeCool);
    expect(c.s.threats.some((x) => x.id === t.id)).toBe(false);
  });

  it('a power cooled below the floor by dusk: the move fizzles', () => {
    const c = begin();
    turn(c.s, Object.keys(c.s.people).slice(0, 6));
    temple(c, 80);
    const t = c.s.threats.find((x) => x.kind === 'purge')!;
    c.s.factions.temple.suspicion = 10;
    c.s.tick = t.lands;
    powersDusk(c);
    expect(c.s.people[t.target]!.gone).toBe(null);
    expect(c.out.some((e) => e.kind === 'threat' && e.threat === t.id && e.how === 'answered')).toBe(true);
  });
});
