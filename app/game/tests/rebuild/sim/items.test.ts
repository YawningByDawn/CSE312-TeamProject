// Made things (spec §7.4-7.5, DECISIONS §111): a bench of yours folds a pouch stone into a thing for its Nether; worn by
// one of yours it lends its powers, given to anyone else it is its curse; a search finds it as proof; the vault wins.
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../../src/content/balance';
import { DAY_TICKS } from '../../../src/content/clock';
import { CRYSTAL } from '../../../src/content/crystals';
import { ITEM, ITEMS } from '../../../src/content/items';
import { makeSim } from '../../../src/sim';
import { handsOf } from '../../../src/sim/buildings';
import { area, convert, whereNow, type Ctx } from '../../../src/sim/core';
import { newCrystal, tierOf } from '../../../src/sim/crystals';
import { exposure, itemPower, worn } from '../../../src/sim/items';
import { searchOne } from '../../../src/sim/mining';
import { itemsDawn, noticeWearers } from '../../../src/sim/town';
import type { PlaceId } from '../../../src/types';

const { sim } = makeSim();
function town(): Ctx {
  const s = sim.create(7, { stage: 'shade' });
  s.phase = 'live';
  s.until = Infinity; // the clock runs: these tests step ticks, not turns
  s.god.nether = 500;
  return { s, out: [] };
}
/** Turn a building's master and every hand. */
function own(c: Ctx, place: PlaceId): void {
  convert(c, handsOf(c.s, place).master!, 40);
  for (const p of Object.values(c.s.people)) if (p.work === place && !p.follower && p.gone === null) convert(c, p, 40);
}
const stone = (c: Ctx, tier = 1): string => newCrystal(c.s, { pouch: true }, { tier }).id;
const made = (c: Ctx): string => Object.keys(c.s.items).at(-1)!;
const stranger = (c: Ctx) => Object.values(c.s.people).find((p) => !p.follower && p.gone === null && p.standing !== 'elite')!;

describe('made things', () => {
  it('the forge folds a pouch stone into a jewel for its Nether, once the bench is yours', () => {
    const c = town();
    const x = stone(c, 2);
    expect(sim.act(c.s, { type: 'forge', crystal: x, form: 'ring' }).why[0]!.key).toBe('why.bench');
    own(c, 'forge');
    const was = c.s.god.nether;
    expect(sim.act(c.s, { type: 'forge', crystal: x, form: 'ring' }).ok).toBe(true);
    expect(was - c.s.god.nether).toBeCloseTo(ITEM.makeCost[c.s.crystals[x]!.grade], 5);
    expect(c.s.items[made(c)]).toMatchObject({ kind: 'jewel', form: 'ring', crystal: x, wearer: null });
    expect(c.s.crystals[x]!.at).toEqual({ item: made(c) });
  });

  it('the gem workshop re-cuts a stone for facetCost by grade: three cuts, the clock waits, the chosen one is the stone', () => {
    const c = town();
    const x = stone(c, 3);
    const cr = c.s.crystals[x]!;
    expect(cr.mods.length).toBeGreaterThan(1);
    own(c, 'gemworks');
    const was = c.s.god.nether;
    expect(sim.act(c.s, { type: 'facet', crystal: x }).ok).toBe(true);
    expect(was - c.s.god.nether).toBe(CRYSTAL.facetCost[3]);
    const p = c.s.pending!;
    if (p.kind !== 'facet') return expect.fail('no cuts offered');
    expect(p.cuts).toHaveLength(3);
    expect(p.cuts[2]!.length).toBe(cr.mods.length - 1);
    expect(sim.step(c.s)).toEqual([]);
    expect(sim.act(c.s, { type: 'whisper', target: stranger(c).id }).why).toEqual([{ key: 'why.pending' }]);
    const cut = p.cuts[1]!;
    expect(sim.act(c.s, { type: 'chooseCut', index: 1 }).ok).toBe(true);
    expect(c.s.pending).toBe(null);
    expect(c.s.crystals[x]!.mods).toEqual(cut);
    // the next re-cut offers another set
    sim.act(c.s, { type: 'facet', crystal: x });
    expect(c.s.pending).not.toBe(null);
  });

  it('worn by one of yours it lends its line by grade; taken back it lends nothing', () => {
    const c = town();
    own(c, 'tallyhouse');
    const x = stone(c, 3);
    expect(sim.act(c.s, { type: 'craft', facility: 'falseWeights', crystal: x }).ok).toBe(true);
    const it = made(c);
    const f = Object.values(c.s.people).find((p) => p.follower)!;
    expect(sim.act(c.s, { type: 'give', item: it, unit: f.id }).ok).toBe(true);
    const w = ITEMS.weights.worn[0]!;
    expect(worn(c.s, f, 'falseWeights')).toBe(w.value + w.perGrade! * tierOf(c.s.crystals[x]!.grade));
    expect(sim.act(c.s, { type: 'takeBack', item: it }).ok).toBe(true);
    expect(worn(c.s, f, 'falseWeights')).toBe(0);
  });

  it('a draught worn is used up after its days', () => {
    const c = town();
    own(c, 'apothecary');
    sim.act(c.s, { type: 'craft', facility: 'draughts', crystal: stone(c) });
    const it = made(c);
    const f = Object.values(c.s.people).find((p) => p.follower)!;
    sim.act(c.s, { type: 'give', item: it, unit: f.id });
    expect(c.s.items[it]!.until).toBe(c.s.tick + itemPower(c.s, c.s.items[it]!, 'draught') * DAY_TICKS);
    c.s.tick = c.s.items[it]!.until!;
    itemsDawn(c);
    expect(c.s.items[it]).toBeUndefined();
    expect(f.worn).toEqual([]);
  });

  it('given to one not yours it is its curse, and it is used up', () => {
    const c = town();
    own(c, 'forge');
    const x = stone(c);
    sim.act(c.s, { type: 'forge', crystal: x, form: 'ring' });
    const it = made(c);
    const p = stranger(c);
    p.resistance = 40;
    // by the hand of one of yours beside them: not one who lives, works and stands elsewhere
    const far = Object.values(c.s.people).find((f) => f.follower && f.home !== p.home && f.work !== p.work && area(whereNow(f, c.s.tick)) !== area(whereNow(p, c.s.tick)))!;
    expect(sim.act(c.s, { type: 'give', item: it, unit: p.id, by: far.id }).why).toEqual([{ key: 'why.noHand' }]);
    const hand = Object.values(c.s.people).find((q) => q !== p && q.home === p.home && !q.follower && q.gone === null)!;
    convert(c, hand, 40);
    expect(sim.act(c.s, { type: 'give', item: it, unit: p.id, by: hand.id }).ok).toBe(true);
    expect(p.resistance).toBe(40 + ITEMS.ring.gift.resist!);
    expect(c.s.items[it]).toBeUndefined();
    expect(c.s.crystals[x]).toBeUndefined();
  });

  it('a search finds what a follower wears: heat by its exposure, and the wearer is taken', () => {
    const c = town();
    own(c, 'forge');
    sim.act(c.s, { type: 'forge', crystal: stone(c), form: 'circlet' });
    const it = made(c);
    const f = Object.values(c.s.people).find((p) => p.follower)!;
    sim.act(c.s, { type: 'give', item: it, unit: f.id });
    const heat = exposure(c.s, c.s.items[it]!) * ITEM.exposureHeat;
    c.s.factions.council.suspicion = 0;
    searchOne(c, f);
    expect(c.s.factions.council.suspicion).toBeCloseTo(heat, 5);
    expect(f.gone).toBe('taken');
    expect(c.s.items[it]).toBeUndefined();
  });

  it('watching eyes notice a wearer with odds × (1 − Cunning/200): proof, and the wearer is taken', () => {
    const c = town();
    own(c, 'forge');
    sim.act(c.s, { type: 'forge', crystal: stone(c), form: 'ring' });
    const it = made(c);
    const f = Object.values(c.s.people).find((p) => p.follower)!;
    sim.act(c.s, { type: 'give', item: it, unit: f.id });
    f.stats.cunning = 200;
    noticeWearers(c, [f], 1);
    expect(f.gone).toBe(null);
    f.stats.cunning = 0;
    noticeWearers(c, [f], 1);
    expect(f.gone).toBe('taken');
    expect(c.s.items[it]).toBeUndefined();
    expect([ITEM.informerNotice, ITEM.hunterNotice]).toEqual([0.5, 0.35]);
  });

  it('the vault opens once the council hall is yours: its stones, and the run is won', () => {
    const c = town();
    expect(sim.act(c.s, { type: 'openVault' }).why[0]!.key).toBe('why.vaultShut');
    own(c, 'councilhall');
    const before = Object.keys(c.s.crystals).length;
    expect(sim.act(c.s, { type: 'openVault' }).ok).toBe(true);
    expect(Object.keys(c.s.crystals).length - before).toBe(1 + BALANCE.vaultRoyal);
    expect(c.s.phase).toBe('won');
  });
});
