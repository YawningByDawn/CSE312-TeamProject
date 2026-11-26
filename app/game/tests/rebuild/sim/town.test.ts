// The town (DECISIONS §110, §111): a building is yours while its master and more than half of its hands are; one nobody
// masters goes with its ground; a bench of a building of yours is open, and each closed one says why.
import { describe, expect, it } from 'vitest';
import { uiText } from '../../../src/content/text';
import { PLACES } from '../../../src/content/world';
import { makeSim } from '../../../src/sim';
import { buildingYours, facilities, handsOf } from '../../../src/sim/buildings';
import { convert, setHold, type Ctx } from '../../../src/sim/core';

function town(): Ctx {
  const { sim } = makeSim();
  const s = sim.create(7, { stage: 'shade' });
  s.phase = 'live';
  return { s, out: [] };
}

describe('the town', () => {
  it('every bench is closed at first, and each says why in words that fill', () => {
    const c = town();
    for (const f of facilities(c.s)) {
      expect(f.open, f.facility).toBe(false);
      expect(f.why.length, f.facility).toBeGreaterThan(0);
      for (const r of f.why) expect(uiText(r.key, r.slots).length).toBeGreaterThan(0);
    }
  });

  it('the forge is yours once its master and more than half of its hands are', () => {
    const c = town();
    const h = handsOf(c.s, 'forge');
    const hands = Object.values(c.s.people).filter((p) => p.work === 'forge' && p !== h.master && p.standing !== 'elite' && p.gone === null);
    expect(h.master).not.toBe(null);
    convert(c, h.master!, 30);
    for (const p of hands.slice(0, Math.floor(hands.length / 2))) convert(c, p, 30);
    expect(buildingYours(c.s, 'forge')).toBe(hands.length === 0);
    for (const p of hands.slice(Math.floor(hands.length / 2))) convert(c, p, 30);
    expect(buildingYours(c.s, 'forge')).toBe(true);
    expect(facilities(c.s).find((f) => f.facility === 'jewelry')!.open).toBe(true);
    expect(c.out.filter((e) => e.kind === 'building' && e.place === 'forge')).toEqual([expect.objectContaining({ yours: true })]);
  });

  it('a building nobody masters goes with its ground', () => {
    const c = town();
    const well = Object.keys(PLACES).find((p) => PLACES[p]!.unmastered && PLACES[p]!.area === 'wellsquare')!;
    expect(buildingYours(c.s, well)).toBe(false);
    setHold(c, 'wellsquare', 100);
    expect(buildingYours(c.s, well)).toBe(true);
    expect(c.out.some((e) => e.kind === 'building' && e.place === well && e.yours)).toBe(true);
  });
});
