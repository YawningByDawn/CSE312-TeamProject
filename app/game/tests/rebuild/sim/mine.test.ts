// The mine on foot (OVERHAUL, ov-mine): the walk's ground and hitboxes, the mining time, the ores' grades, the drop, the quota and the pocket.
import { describe, expect, it } from 'vitest';
import { DAY_TICK_S, NIGHT_TICKS } from '../../../src/content/clock';
import { BLOCKS, DROP, GROUND, MINING, ORE_SITES, POCKET, WALK, areaAt } from '../../../src/content/mine';
import { ROLES } from '../../../src/content/roles';
import { FIRST_MINER } from '../../../src/content/stats';
import { AT, DRESS, digSpots } from '../../../src/content/map';
import { AREAS, PLACES } from '../../../src/content/world';
import { makeSim } from '../../../src/sim';
import { pouchIds } from '../../../src/sim/core';
import { miningRarity, miningSeconds, oreOdds, walkSpeed } from '../../../src/sim/formulas';
import { clear } from '../../../src/sim/walk';
import { xyOf } from '../../../src/sim/world/xy';
import type { GameState } from '../../../src/types';

const { sim, query } = makeSim();

/** The first miner's day begun. */
function day(seed = 7): GameState {
  const s = sim.create(seed);
  s.people[FIRST_MINER.id]!.stats.hp = 1e6; // these tests are of the work: no skeleton (fight.test.ts) fells a host who stands about at it all day
  return s;
}
const ticks = (s: GameState, n: number): void => { for (let i = 0; i < n; i++) sim.step(s); };
/** The day played out to the dusk, a story's door answered. */
function toDusk(s: GameState): void {
  while (s.tick < s.until && s.phase === 'live') {
    if (s.pending?.kind === 'story') sim.act(s, { type: 'story', option: 1 });
    else sim.step(s);
  }
}
const heading = (s: GameState, dx: -1 | 0 | 1, dy: -1 | 0 | 1): void => void sim.act(s, { type: 'walk', dx, dy });
const miner = (s: GameState) => s.people[FIRST_MINER.id]!;
/** Where the host stands to work an ore: a step down from its seam's foot. */
const stand = (o: { x: number; y: number }): { x: number; y: number } => ({ x: o.x, y: o.y + 8 });
/** The body stood at an ore site. */
const at = (s: GameState, site: number): void => void Object.assign(s.body!, stand(ORE_SITES[site]!));
const site = (tier: number): number => ORE_SITES.findIndex((o) => o.tier === tier);

describe('the time formula', () => {
  it('a tier 1 ore takes 10 s at Strength 10 and Dexterity 10; each of the two is half the speed term; tiers 2 and 3 take longer', () => {
    expect(miningSeconds(1, { strength: 10, dexterity: 10 })).toBe(10);
    expect(miningSeconds(1, { strength: 20, dexterity: 10 })).toBeCloseTo(10 / 1.5, 9);
    expect(miningSeconds(1, { strength: 10, dexterity: 20 })).toBeCloseTo(10 / 1.5, 9);
    expect(miningSeconds(1, { strength: 20, dexterity: 20 })).toBe(5);
    expect(miningSeconds(1, { strength: 6, dexterity: 6 })).toBeCloseTo(10 / 0.6, 9);
    expect(miningSeconds(2, { strength: 10, dexterity: 10 })).toBeGreaterThan(10);
    expect(miningSeconds(3, { strength: 10, dexterity: 10 })).toBeGreaterThan(miningSeconds(2, { strength: 10, dexterity: 10 }));
  });

  it('the played day passes it: an ore is done in its seconds of ticks, not before', () => {
    const s = day();
    Object.assign(miner(s).stats, { strength: 10, dexterity: 10 });
    const i = site(1);
    at(s, i);
    expect(sim.act(s, { type: 'work' }).ok).toBe(true);
    const need = Math.ceil(10 / DAY_TICK_S);
    ticks(s, need - 1);
    expect([s.body!.ore, miner(s).pocket.length]).toEqual([i, 0]);
    ticks(s, 1);
    expect([s.body!.ore, miner(s).pocket.length, query.oreStands(s, i)]).toEqual([null, 1, false]);
    expect(s.body!.dug).toBe(1);
  });

  it('walking away ends the work, and the host\'s speed is the table\'s at Dexterity 10, a share more for each point', () => {
    const s = day();
    at(s, site(1));
    sim.act(s, { type: 'work' });
    ticks(s, 5);
    expect(s.body!.work).toBeGreaterThan(0);
    heading(s, 1, 0);
    ticks(s, 1);
    expect([s.body!.ore, s.body!.work]).toEqual([null, 0]);
    expect(walkSpeed(10)).toBe(WALK.speed);
    expect(walkSpeed(20)).toBeGreaterThan(walkSpeed(10));
    expect(walkSpeed(6)).toBeLessThan(walkSpeed(10));
  });
});

describe('the grade weights', () => {
  it('a tier 1 ore is dull 90 %, a tier 3 ore dull 80 %, the rarest a tier 3 ore\'s blazing 0.5 %; royal and impossible never come', () => {
    const t1 = oreOdds(1, 1), t3 = oreOdds(3, 1);
    expect(t1).toHaveLength(4); // dull, clear, bright, blazing
    expect(t1[0]).toBeCloseTo(0.9, 9);
    expect(t3[0]).toBeCloseTo(0.8, 9);
    expect(t3[3]).toBeCloseTo(0.005, 9);
    expect(t1[3]).toBe(0);
    for (const tier of [1, 2, 3]) expect(oreOdds(tier, 1).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    expect(oreOdds(2, 1)[0]).toBeGreaterThan(oreOdds(3, 1)[0]!);
    expect(oreOdds(2, 1)[0]).toBeLessThan(oreOdds(1, 1)[0]!);
    expect(Math.max(...MINING.odds.map((o) => o[2]!))).toBe(0.5);
  });

  it('mining rarity is x1.5 at Devotion 100 and scales only the non-dull odds', () => {
    expect([miningRarity(0), miningRarity(100)]).toEqual([1, 1.5]);
    const plain = oreOdds(3, 1), keen = oreOdds(3, miningRarity(100));
    for (let g = 1; g < 4; g++) expect(keen[g]).toBeCloseTo(plain[g]! * 1.5, 9);
    expect(keen[0]).toBeCloseTo(1 - (1 - plain[0]!) * 1.5, 9);
    expect(keen.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
  });

  it('ores mined in a run give the table\'s grades, never past blazing', () => {
    const s = day(11);
    Object.assign(miner(s).stats, { strength: 20, dexterity: 20, devotion: 0 });
    const i = site(1), n = 400;
    const seen: Record<string, number> = {};
    for (let k = 0; k < n; k++) {
      s.ores.fill(-1);
      s.tick = NIGHT_TICKS + 1; // the same morning again: the dusk is not reached
      at(s, i);
      sim.act(s, { type: 'work' });
      ticks(s, Math.ceil(5 / DAY_TICK_S));
      const id = miner(s).pocket[k]!;
      seen[s.crystals[id]!.grade] = (seen[s.crystals[id]!.grade] ?? 0) + 1;
    }
    expect(Object.keys(seen).every((g) => ['dull', 'clear', 'bright'].includes(g))).toBe(true); // a tier 1 ore has no blazing in it
    expect(seen.dull! / n).toBeGreaterThan(0.85);
    expect(seen.dull! / n).toBeLessThan(0.95);
  });
});

describe('the ground and the hitboxes', () => {
  it('everyone\'s spots, the faces\' ore sites and the drop stand on free ground; every site is reachable from the drop\'s side only by walking', () => {
    const s = day();
    for (const p of Object.values(s.people)) {
      if (!('place' in p.at)) continue;
      const { x, y } = xyOf(p, s.tick);
      expect(clear(x, y), `${p.id} at ${x},${y}`).toBe(true);
    }
    expect(ORE_SITES.length).toBeGreaterThanOrEqual(10);
    expect(new Set(ORE_SITES.map((o) => o.tier))).toEqual(new Set([1, 2, 3]));
    for (const o of ORE_SITES) {
      expect(Math.hypot(o.x - DROP.x, o.y - DROP.y)).toBeGreaterThan(DROP.reach + MINING.reach);
      // a seam in a face the view shows: rock rising straight up from its foot, ground under it, no painted light on it
      const rise = MINING.face.rise * GROUND.cell;
      for (let dy = 4; dy <= rise; dy += 4) expect(areaAt(o.x, o.y - dy), `ore at ${o.x},${o.y} up ${dy}`).toBe(null);
      expect(areaAt(o.x, o.y + 4), `ore at ${o.x},${o.y}`).not.toBe(null);
      for (const l of DRESS.lights) expect(Math.hypot(l.x - o.x, l.y - o.y), `ore at ${o.x},${o.y} by a ${l.kind}`).toBeGreaterThanOrEqual(MINING.face.clear);
      // the host stands clear in reach of it
      const p = stand(o);
      expect(clear(p.x, p.y), `ore at ${o.x},${o.y}`).toBe(true);
      expect(Math.hypot(p.x - o.x, p.y - o.y)).toBeLessThanOrEqual(MINING.reach);
    }
    // every vein area, the grave the first miner works at among them, has ore to dig
    for (const [a, d] of Object.entries(AREAS)) if (d.vein > 0) expect(ORE_SITES.some((o) => (PLACES[o.place]?.area ?? o.place) === a), a).toBe(true);
    expect(digSpots().length).toBeGreaterThan(0);
    expect(clear(DROP.x, DROP.y + 50)).toBe(true);
  });

  it('rock stops the body and the set pieces of the dress stop it; it slides along what it meets', () => {
    const s = day();
    Object.assign(s.body!, { x: 100, y: 800 }); // the far west, in rock
    expect(clear(100, 800)).toBe(false);
    for (const b of BLOCKS) expect(clear(b.x, b.y)).toBe(false);
    // the grave's pit: walk east into it from the west, on every tick on free ground
    const pit = BLOCKS[1]!;
    Object.assign(s.body!, { x: pit.x - pit.rx - 40, y: pit.y });
    heading(s, 1, 0);
    for (let i = 0; i < 60; i++) {
      ticks(s, 1);
      expect(clear(s.body!.x, s.body!.y), `tick ${i} at ${s.body!.x},${s.body!.y}`).toBe(true);
    }
    // north-west from a gallery's heart into rock: it never ends on rock
    Object.assign(s.body!, { x: AT.lowgallery![0], y: AT.lowgallery![1] });
    heading(s, -1, -1);
    ticks(s, 200);
    expect(clear(s.body!.x, s.body!.y)).toBe(true);
    // at rest nothing moves
    heading(s, 0, 0);
    const [x, y] = [s.body!.x, s.body!.y];
    ticks(s, 10);
    expect([s.body!.x, s.body!.y]).toEqual([x, y]);
  });

  it('ground the host walks onto is explored: a face\'s ore sits on its own area\'s ground', () => {
    const s = day();
    for (const o of ORE_SITES) expect(areaAt(o.x, o.y)).toBe(PLACES[o.place]?.area ?? o.place);
    const deep = ORE_SITES.find((o) => o.tier === 3)!;
    s.places.sump!.explored = false;
    Object.assign(s.body!, stand(deep));
    heading(s, 0, 1);
    ticks(s, 1);
    expect(s.places.sump!.explored).toBe(true);
  });

  it('a walk covers its speed times the day\'s seconds on open ground, faster with Dexterity', () => {
    const s = day();
    const start = { x: DROP.x - 20, y: DROP.y + 100 };
    const walked = (dex: number): number => {
      miner(s).stats.dexterity = dex;
      Object.assign(s.body!, start, { walked: 0 });
      heading(s, -1, 0);
      ticks(s, 10);
      return s.body!.walked;
    };
    expect(walked(10)).toBeCloseTo(WALK.speed * DAY_TICK_S * 10, 3);
    expect(walked(20)).toBeGreaterThan(walked(10));
    expect(s.body!.face).toBe(-1);
  });
});

describe('the drop, the quota and the pocket', () => {
  it('the work key at the drop delivers the lowest stone into the lift\'s cart; away from the drop and ores it is refused; only a miner works', () => {
    const s = day();
    const m = miner(s);
    Object.assign(s.body!, { x: 600, y: 330 });
    expect(query.check(s, { type: 'work' }).why).toEqual([{ key: 'why.nothingToWork' }]);
    Object.assign(s.body!, { x: DROP.x, y: DROP.y + 40 });
    expect(query.check(s, { type: 'work' }).why).toEqual([{ key: 'why.nothingToDeliver' }]);
    for (const tier of [2, 0, 1]) m.pocket.push(`z${tier}`), s.crystals[`z${tier}`] = { id: `z${tier}`, grade: (['dull', 'clear', 'bright'] as const)[tier], at: { pocket: m.id } } as never;
    expect(sim.act(s, { type: 'work' }).ok).toBe(true);
    expect([m.pocket, s.body!.delivered, s.mine.carts.lift]).toEqual([['z2', 'z1'], 1, [0]]);
    expect(s.crystals.z0).toBeUndefined();
    m.role = 'hauler';
    expect(query.check(s, { type: 'work' }).why).toEqual([{ key: 'why.notMiner' }]);
  });

  it('a miner owes his trade\'s ores; short of them the Public\'s heat rises at the dusk, by the ore; the quota met, and up to three pocketed, it does not', () => {
    const quota = ROLES.digger!.quota;
    expect(quota).toBe(3);
    const heat = (delivered: number, pocketed: number): { heat: number; pouch: number } => {
      const s = day();
      const m = miner(s);
      s.body!.delivered = delivered;
      for (let i = 0; i < pocketed; i++) m.pocket.push(`p${i}`), s.crystals[`p${i}`] = { id: `p${i}`, grade: 'dull', at: { pocket: m.id } } as never;
      const before = s.factions.public.suspicion, pouch = pouchIds(s).length;
      toDusk(s);
      return { heat: s.factions.public.suspicion - before + 0, pouch: pouchIds(s).length - pouch };
    };
    const base = heat(quota, 0).heat; // the dusk's own cooling and rules
    expect(heat(quota, POCKET.free).heat).toBeCloseTo(base, 5);
    expect(heat(quota - 2, 0).heat - base).toBeCloseTo(2 * POCKET.shortEach, 5);
    expect(heat(quota, POCKET.free + 2).heat - base).toBeCloseTo(2 * POCKET.heatEach, 5);
    expect(heat(0, 0).heat - base).toBeCloseTo(quota * POCKET.shortEach, 5);
    // what is pocketed reaches the god's pouch
    expect(heat(quota, 3).pouch).toBe(3);
  });
});
