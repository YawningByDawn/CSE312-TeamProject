// The colour threshold (OVERHAUL, ov-ui): gray once the host has stood in an area, colour once enough acts there over enough days
// cross a hidden, seeded number that each coloured neighbour lowers.
import { describe, expect, it } from 'vitest';
import { DAY_TICKS } from '../../../src/content/clock';
import { COLOUR } from '../../../src/content/mine';
import { AREAS, NEIGHBOURS } from '../../../src/content/world';
import { makeSim } from '../../../src/sim';
import { act, actsNeeded } from '../../../src/sim/colour';
import { visibility } from '../../../src/sim/influence';
import { setHold, type Ctx } from '../../../src/sim/core';
import type { GameState } from '../../../src/types';

const { sim } = makeSim();
const begin = (seed = 7): GameState => {
  const s = sim.create(seed);
  sim.act(s, { type: 'take', card: s.god.deal![0]! });
  return s;
};
/** `n` acts at `place` on day `d` of the run (the clock set to it). */
function acts(s: GameState, place: string, n: number, d: number): void {
  s.tick = d * DAY_TICKS + 400;
  for (let i = 0; i < n; i++) act({ s, out: [] } as Ctx, place);
}
/** An area no one has coloured and none of whose neighbours is coloured. */
const far = (s: GameState): string => Object.keys(AREAS).find((a) => !s.places[a]!.coloured && NEIGHBOURS[a]!.every((n) => !s.places[n]!.coloured))!;

describe('the colour threshold', () => {
  it('each area has its own number from the seed, within the content range and never under one, the same on a replay', () => {
    const [a, b, c] = [begin(7), begin(7), begin(8)];
    const need = (s: GameState): number[] => Object.keys(AREAS).map((id) => actsNeeded(s, id));
    expect(need(a)).toEqual(need(b));
    expect(need(c)).not.toEqual(need(a));
    const id = far(a);
    expect(actsNeeded(a, id)).toBeGreaterThanOrEqual(COLOUR.acts[0]);
    expect(actsNeeded(a, id)).toBeLessThanOrEqual(COLOUR.acts[1]);
  });

  it('gray is only being there: it takes colour on enough acts over enough days, and the acts of one day are not enough', () => {
    const s = begin();
    const id = far(s), need = actsNeeded(s, id);
    expect(visibility(s, id)).not.toBe('active');
    setHold({ s, out: [] } as Ctx, id, 80); // followers' stain is Hold: it makes the place seen, never coloured
    expect([s.places[id]!.explored, s.places[id]!.coloured, visibility(s, id)]).toEqual([true, false, 'sensed']);
    acts(s, id, need + 3, 3);
    expect(s.places[id]!.coloured).toBe(false);
    acts(s, id, 1, 3 + COLOUR.days - 1);
    expect(s.places[id]!.coloured).toBe(true);
    expect(visibility(s, id)).toBe('active');
  });

  it('too few acts over many days is not enough', () => {
    const s = begin();
    const id = far(s), need = actsNeeded(s, id);
    for (let d = 3; d < 3 + need - 1; d++) acts(s, id, 1, d);
    expect(s.places[id]!.coloured).toBe(false);
    acts(s, id, 1, 3 + need);
    expect(s.places[id]!.coloured).toBe(true);
  });

  it('each coloured neighbour lowers an area\'s number, and a coloured area stays so when its Hold is gone', () => {
    const s = begin();
    const id = far(s), nb = NEIGHBOURS[id]![0]!, need = actsNeeded(s, id);
    s.places[nb]!.coloured = true;
    expect(actsNeeded(s, id)).toBeLessThan(need);
    expect(actsNeeded(s, id)).toBeGreaterThanOrEqual(1);
    s.places[nb]!.hold = 0;
    expect(visibility(s, nb)).toBe('active');
  });
});
