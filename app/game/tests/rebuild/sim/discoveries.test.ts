// Discoveries (spec §14.5, DECISIONS §106): what an area hides is found once, at dawn where a follower works or when
// the area takes root; a cache, a seam, a danger and a relic each do exactly what content's row says.
import { describe, expect, it } from 'vitest';
import { DISCOVERIES, DISCOVERY_NUMBERS } from '../../../src/content/discoveries';
import { uiText } from '../../../src/content/text';
import { AREAS } from '../../../src/content/world';
import { makeSim } from '../../../src/sim';
import { area, door, handMax, nbrs, setHold, type Ctx } from '../../../src/sim/core';
import { discover, discoverDawn } from '../../../src/sim/discoveries';
import { route } from '../../../src/sim/world';
import type { PlaceId } from '../../../src/types';

function begin(): Ctx {
  const { sim } = makeSim();
  const s = sim.create(7);
  return { s, out: [] };
}
const pouch = (c: Ctx): number => Object.values(c.s.crystals).filter((x) => 'pouch' in x.at).length;
const first = (kind: string): PlaceId => Object.keys(DISCOVERIES).find((a) => DISCOVERIES[a]!.kind === kind)!;

describe('discoveries', () => {
  it('every area has a row, and every finding has its words', () => {
    expect(Object.keys(AREAS).filter((a) => !(a in DISCOVERIES))).toEqual([]);
    for (const a in DISCOVERIES) if (DISCOVERIES[a]!.kind !== 'none') expect(uiText(`discovery.${a}.text`).length, a).toBeGreaterThan(0);
  });

  it('a cache puts its crystals in the pouch, once', () => {
    const c = begin();
    const a = first('cache');
    const was = pouch(c);
    discover(c, a);
    expect(pouch(c) - was).toBe(DISCOVERIES[a]!.crystals);
    expect(c.s.places[a]!.found && c.s.places[a]!.explored).toBe(true);
    expect(c.out.filter((e) => e.kind === 'found')).toHaveLength(1);
    discover(c, a);
    expect(pouch(c) - was).toBe(DISCOVERIES[a]!.crystals);
    expect(DISCOVERY_NUMBERS.cacheLuck).toBe(25);
  });

  it('a seam adds one seam to the vein; a danger raises its power by its amount', () => {
    const c = begin();
    const seam = first('seam');
    discover(c, seam);
    expect(c.s.places[seam]!.seam).toBe(1);
    const danger = first('danger');
    const h = DISCOVERIES[danger]!.heat!;
    const was = c.s.factions[h.track].suspicion;
    discover(c, danger);
    expect(c.s.factions[h.track].suspicion - was).toBeCloseTo(h.amount * door(c.s, 'notice', h.track), 5);
  });

  it('a relic comes into a free hand; with the hand full it waits', () => {
    const c = begin();
    const a = first('relic');
    c.s.god.hand = Array.from({ length: handMax(c.s) }, (_, i) => `full${i}`);
    discover(c, a);
    expect(c.s.places[a]!.found).toBe(false);
    c.s.god.hand.pop();
    discover(c, a);
    expect(c.s.places[a]!.found).toBe(true);
    expect(c.s.god.hand).toContain(DISCOVERIES[a]!.miracle);
  });

  it('a loner is made where they hide, easy to turn; a shortcut joins its edge to the routes and the reach', () => {
    const c = begin();
    const a = first('loner');
    discover(c, a);
    const p = c.s.people[`loner-${a}`]!;
    expect(p.name).toBe(uiText(`discovery.${a}.loner`));
    expect([p.home, p.trait, p.resistance, p.follower]).toEqual([a, 'grieving', DISCOVERY_NUMBERS.lonerResistance, false]);
    const sc = first('shortcut');
    const [x, y] = DISCOVERIES[sc]!.link!;
    expect(nbrs(c.s, x)).not.toContain(y);
    const far = route(c.s, x, y).path.length;
    discover(c, sc);
    expect(c.s.places[sc]!.found).toBe(true);
    expect(nbrs(c.s, x)).toContain(y);
    expect(nbrs(c.s, y)).toContain(x);
    expect(route(c.s, x, y).path).toEqual([x, y]);
    expect(far).toBeGreaterThan(2);
  });

  it('a follower finds what the area they work in hides at dawn, and so does a rooted area', () => {
    const c = begin();
    const worker = Object.values(c.s.people).find((x) => DISCOVERIES[area(x.work)]!.kind === 'cache')!;
    worker.follower = true;
    discoverDawn(c);
    expect(c.s.places[area(worker.work)]!.found).toBe(true);
    expect(c.out.find((e) => e.kind === 'found')).toMatchObject({ place: area(worker.work), unit: worker.id, discovery: 'cache' });
    const root = first('seam');
    setHold(c, root, 100);
    expect(c.s.places[root]!.found).toBe(false);
    discoverDawn(c);
    expect(c.s.places[root]!.found).toBe(true);
  });
});
