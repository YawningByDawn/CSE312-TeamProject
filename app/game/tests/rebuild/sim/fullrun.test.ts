// Whole runs on the src sim, played by the decent bot (scripts/bots/play.ts) through Sim.act on the live clock, on
// the seeds the old game's full run used. Each day what the screen relies on holds: every action the rules list is one
// Query.check allows, a waiting choice has an answer, the clock moves a day a day, the gauges stay in range, nothing
// the bot sends is refused and a stone and a card decision are on offer.
import { describe, expect, it } from 'vitest';
import { DAY_TICKS } from '../../../src/content/clock';
import { playRun } from '../../../scripts/bots/play';
import type { GameState, Query, Sim } from '../../../src/types';

/** What the screen would show wrong or could not do on this day, as lines (none: the day is sound). */
function dayFaults(s: GameState, sim: Sim, q: Query, lastTick: number): string[] {
  const out: string[] = [];
  const day = q.day(s.tick);
  if (lastTick >= 0 && s.tick - lastTick !== DAY_TICKS) out.push(`day ${day}: the clock moved ${s.tick - lastTick} ticks`);
  const legal = sim.legal(s);
  for (const a of legal) if (!q.check(s, a).ok) out.push(`day ${day}: listed but refused ${JSON.stringify(a)}`);
  if (s.pending && legal.length === 0) out.push(`day ${day}: a ${s.pending.kind} waits with no answer`);
  const g = s.god;
  for (const [k, v] of [['hunger', g.hunger], ['malice', g.malice]] as const) if (v < 0 || v > 100) out.push(`day ${day}: ${k} ${v}`);
  if (g.ichor < 0 || g.nether < 0 || g.ap < 0) out.push(`day ${day}: ichor ${g.ichor} nether ${g.nether} ap ${g.ap}/${g.apMax}`);
  for (const id in s.places) {
    const h = s.places[id]!.hold;
    if (h < 0 || h > 100) out.push(`day ${day}: ${id} hold ${h}`);
  }
  return out;
}

describe('a whole run, the decent bot', () => {
  for (const seed of [7, 3, 2]) {
    it(`seed ${seed}: each day sound to the end or day 75`, () => {
      const faults: string[] = [];
      let last = -1;
      const r = playRun(seed, 'decent', {
        maxDays: 75,
        onDawn: (s, sim, q) => {
          faults.push(...dayFaults(s, sim, q, last));
          // the opening night is shorter than a day: the clock is checked from the first dawn
          last = q.day(s.tick) >= 1 ? s.tick : -1;
        },
      });
      expect(faults).toEqual([]);
      expect(r.refused).toEqual([]);
      expect(r.why).not.toMatch(/^stuck/);
      expect(r.noCrystalDays + r.noCardDays).toBeLessThanOrEqual(3); // the table's average is under one a run (BALANCE.md)
    }, 240_000);
  }
});
