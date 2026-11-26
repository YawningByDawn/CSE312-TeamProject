// The town's tithe and the town's standing boons (DECISIONS §113): your crews in the town skim ceil(n × titheTown)
// rolls, the first crew one more a link of the crystals' road of yours; the tally house counts the tithe, not the lift;
// what is not found reaches the grave; with the school yours, a household with a child there is in reach.
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../../src/content/balance';
import { GIFTS } from '../../../src/content/gifts';
import { makeSim } from '../../../src/sim';
import { buildingYours, handsOf } from '../../../src/sim/buildings';
import { area, convert, flockOf, setHold, type Ctx } from '../../../src/sim/core';
import { inReach } from '../../../src/sim/influence';
import { titheCrews, townShiftEnd } from '../../../src/sim/tithe';
import { inMine } from '../../../src/sim/world/area';
import type { PlaceId } from '../../../src/types';

const { sim } = makeSim();
function town(): Ctx {
  const s = sim.create(7, { stage: 'shade' });
  s.phase = 'live';
  return { s, out: [] };
}
function own(c: Ctx, place: PlaceId): void {
  const m = handsOf(c.s, place).master;
  if (m) convert(c, m, 40);
  else setHold(c, area(place), 100);
  for (const p of Object.values(c.s.people)) if (p.work === place && !p.follower && p.gone === null) convert(c, p, 40);
}
/** Turn everyone who lives and works in the town at `work`. */
function crew(c: Ctx, work: PlaceId): number {
  const ps = Object.values(c.s.people).filter((p) => p.work === work && !inMine(p.home) && p.gone === null);
  for (const p of ps) convert(c, p, 40);
  return ps.length;
}

describe("the town's tithe", () => {
  it('a crew skims ceil(n × titheTown) rolls, at most titheMaxPerGroup; the road adds a roll a link to the first crew', () => {
    const c = town();
    const n = crew(c, 'market');
    const rolls = Math.min(BALANCE.titheMaxPerGroup, Math.ceil(n * BALANCE.titheTown));
    expect(titheCrews(c.s).find((t) => t.work === 'market')!.rolls).toBe(rolls);
    own(c, 'stables');
    expect(buildingYours(c.s, 'stables')).toBe(true);
    const first = titheCrews(c.s)[0]!;
    const base = Math.min(BALANCE.titheMaxPerGroup, Math.ceil(Object.values(c.s.people).filter((p) => p.follower && p.work === first.work && !inMine(p.home)).length * BALANCE.titheTown));
    const links = ['haulyard', 'stables', 'cartshed'].filter((b) => buildingYours(c.s, b)).length;
    expect(first.rolls).toBe(base + links * GIFTS.road.tithe);
  });

  it('the tally house counts the tithe in the town, the lift counts nothing; what is not found reaches the grave', () => {
    const c = town();
    crew(c, 'market');
    crew(c, 'smelter');
    townShiftEnd(c);
    const counts = c.out.filter((e) => e.kind === 'count');
    expect(counts.map((e) => e.place)).toEqual(['tallyhouse']);
    const took = c.out.filter((e) => e.kind === 'pocket').map((e) => (e as { crystal: string }).crystal);
    const home = c.out.filter((e) => e.kind === 'tithe').map((e) => (e as { crystal: string }).crystal);
    const found = c.out.flatMap((e) => (e.kind === 'search' ? e.found : []));
    expect([...home, ...found].sort()).toEqual([...took].sort());
    for (const id of home) expect('pouch' in c.s.crystals[id]!.at).toBe(true);
  });
});

describe("the town's boons", () => {
  it('with the school yours, a household with a child there is in reach wherever they are', () => {
    const c = town();
    const child = Object.values(c.s.people).find((p) => p.role === 'child' && p.work === 'school')!;
    // one of the household who works in the town (a miner is in reach where they work, beside the grave)
    const kin = Object.values(c.s.people).find((p) => p.household === child.household && p.work !== 'school' && !inMine(p.work) && p.standing !== 'elite')!;
    for (const a in c.s.places) if (a !== 'grave') Object.assign(c.s.places[a]!, { hold: 0, rooted: false });
    for (const p of Object.values(c.s.people)) p.follower = false;
    const fl = flockOf(c.s);
    expect(fl.taught.size).toBe(0);
    expect(inReach(c.s, fl, kin)).toBe(false);
    expect(inReach(c.s, { ...fl, taught: new Set([kin.household]) }, kin)).toBe(true);
    own(c, 'school');
    expect(flockOf(c.s).taught.has(child.household)).toBe(true);
  });
});
