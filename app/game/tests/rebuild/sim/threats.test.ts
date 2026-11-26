// The powers' moves (DECISIONS §15.14, §100): a crossing calls its level's move, which lands at dusk unless answered;
// cooling below the floor fizzles it; a favour blunts every move of the Elite's power; the writ's seals end the run.
import { describe, expect, it } from 'vitest';
import { TIES } from '../../../src/content/balance';
import { FAVOUR, THREAT } from '../../../src/content/threats';
import { makeSim } from '../../../src/sim';
import { play } from '../../../src/sim/cards';
import { addSeal, convert, type Ctx } from '../../../src/sim/core';
import { answer, crossings, powersDusk } from '../../../src/sim/threats';
import type { GameState } from '../../../src/types';

function begin(stage?: 'shade'): Ctx {
  const { sim } = makeSim();
  const s = sim.create(4, stage ? { stage } : undefined);
  sim.act(s, { type: 'take', card: s.god.deal![0]! });
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

  it("an Elite's favour blunts every move of their power, blinds it, and costs them devotion", () => {
    const c = begin();
    const ids = Object.keys(c.s.people).slice(0, 6);
    const priest = Object.values(c.s.people).find((p) => p.role === 'highpriest')!;
    turn(c.s, [...ids, priest.id]);
    priest.trait = 'pious';
    temple(c, 80);
    const t = c.s.threats.find((x) => x.kind === 'purge')!;
    answer(c, t.id, 'favour');
    expect(c.s.threats.filter((x) => x.faction === 'temple')).toEqual([]);
    expect(c.s.effects.some((e) => e.kind === 'blind' && e.on === 'temple')).toBe(true);
    expect(priest.stats.devotion).toBe(40 - FAVOUR.devotion);
  });

  it('the writ: the run is lost at its last seal', () => {
    const c = begin('shade');
    for (let i = 0; i < THREAT.writMax - 1; i++) addSeal(c);
    expect(c.s.phase).toBe('live');
    addSeal(c);
    expect(c.s.phase).toBe('lost');
  });

  it('the writ is torn: one seal by the ledgers burned, every seal by the Magistrate turned', () => {
    const c = begin('shade');
    for (let i = 0; i < 3; i++) addSeal(c);
    c.s.god.hand.push('burnTheLedgers');
    c.s.god.nether = 100;
    play(c, 'burnTheLedgers', [], undefined);
    expect(c.s.flags.seals).toBe(2);
    const m = Object.values(c.s.people).find((p) => p.role === 'magistrate')!;
    convert(c, m, 30);
    expect(c.s.flags.seals).toBe(0);
    expect(c.out.some((e) => e.kind === 'story' && e.story === 'writ')).toBe(true);
  });
});
