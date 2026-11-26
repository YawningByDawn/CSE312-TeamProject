// A building's gift (docs/town.md §3, GIFTS): once a building that gives it is yours, useGift spends an action and its
// Nether and rests its days; rumour, debt, food, records and guards each do exactly what the table says.
import { describe, expect, it } from 'vitest';
import { GIFTS } from '../../../src/content/gifts';
import { AT, DAY_TICKS, tod } from '../../../src/content/clock';
import { makeSim } from '../../../src/sim';
import { handsOf, hearths } from '../../../src/sim/buildings';
import { giftsDawn } from '../../../src/sim/gifts';
import { addSeal, area, convert, has, setHold, type Ctx } from '../../../src/sim/core';
import { tieKind } from '../../../src/sim/world';
import type { Action, PlaceId } from '../../../src/types';

const { sim } = makeSim();
function town(): Ctx {
  const s = sim.create(7, { stage: 'shade' });
  s.phase = 'live';
  s.god.nether = 500;
  s.god.ap = s.god.apMax = 50;
  s.until = Infinity; // the clock runs: these tests step ticks, not turns
  return { s, out: [] };
}
/** Turn a building's master and hands; one nobody masters is yours with its ground rooted. */
function own(c: Ctx, place: PlaceId): void {
  const m = handsOf(c.s, place).master;
  if (m) convert(c, m, 40);
  else setHold(c, area(place), 100);
  for (const p of Object.values(c.s.people)) if (p.work === place && !p.follower && p.gone === null) convert(c, p, 40);
}
const act = (c: Ctx, a: Action) => sim.act(c.s, a);
/** Step until the next dawn has run. */
function toDawn(c: Ctx): void {
  do sim.step(c.s); while (tod(c.s.tick) !== AT.dawn);
}

describe("a building's gift", () => {
  it('is refused until a building that gives it is yours; costs an action and its Nether; rests its days', () => {
    const c = town();
    const a: Action = { type: 'useGift', gift: 'rumour', target: 'temple' };
    expect(act(c, a).why).toEqual([{ key: 'why.noGift' }]);
    own(c, 'tavern');
    c.s.factions.temple.suspicion = 30;
    const [ap, n] = [c.s.god.ap, c.s.god.nether];
    expect(act(c, a).ok).toBe(true);
    expect([ap - c.s.god.ap, n - c.s.god.nether]).toEqual([GIFTS.ap, GIFTS.rumour.nether]);
    expect(c.s.factions.temple.suspicion).toBe(30 - GIFTS.rumour.cool);
    expect(act(c, a).why).toEqual([{ key: 'why.resting' }]);
    c.s.tick += GIFTS.rumour.rest * DAY_TICKS;
    expect(act(c, a).ok).toBe(true);
  });

  it('debt: one who owes resists 25 less, and the Council stirs', () => {
    const c = town();
    own(c, 'pawnshop');
    const p = Object.values(c.s.people).find((q) => !q.follower && q.ties.some((id) => tieKind(c.s, q, c.s.people[id]!) === 'owes'))!;
    const free = Object.values(c.s.people).find((q) => !q.follower && q.ties.every((id) => tieKind(c.s, q, c.s.people[id]!) !== 'owes'))!;
    expect(act(c, { type: 'useGift', gift: 'debt', target: free.id }).why).toEqual([{ key: 'why.noDebt' }]);
    p.resistance = 40;
    expect(act(c, { type: 'useGift', gift: 'debt', target: p.id }).ok).toBe(true);
    expect(p.resistance).toBe(40 + GIFTS.debt.resist);
  });

  it('food: laid for a dawn ahead, one per area a day; poisoned the rest fall sick and one dies; blessed yours gain Devotion', () => {
    const c = town();
    own(c, 'bakery');
    const home = (a: string) => Object.values(c.s.people).filter((p) => p.gone === null && area(p.home) === a);
    const [bad, good] = ['slagrows', 'highwarrens'];
    const mine = home(good)[0]!;
    convert(c, mine, 40);
    expect(act(c, { type: 'useGift', gift: 'food', target: bad, mode: 'poison', day: 1 }).ok).toBe(true);
    expect(act(c, { type: 'useGift', gift: 'food', target: bad, mode: 'bless', day: 1 }).why).toEqual([{ key: 'why.resting' }]);
    c.s.effects = c.s.effects.filter((e) => e.kind !== 'used');
    expect(act(c, { type: 'useGift', gift: 'food', target: bad, mode: 'bless', day: 1 }).why).toEqual([{ key: 'why.foodLaid' }]);
    expect(act(c, { type: 'useGift', gift: 'food', target: good, mode: 'bless', day: 1 }).ok).toBe(true);
    const victims = home(bad).filter((p) => !p.follower);
    const public0 = c.s.factions.public.suspicion;
    toDawn(c);
    expect(victims.filter((p) => p.gone === 'dead')).toHaveLength(GIFTS.food.deaths);
    expect(victims.filter((p) => p.gone === null).every((p) => has(c.s, 'sick', p.id))).toBe(true);
    expect(c.s.factions.public.suspicion).toBeGreaterThan(public0);
    expect(mine.stats.devotion).toBeGreaterThan(40);
  });

  it('records: a seal falls from the writ, and the Council stirs', () => {
    const c = town();
    own(c, 'scriptorium');
    expect(act(c, { type: 'useGift', gift: 'records' }).why).toEqual([{ key: 'why.noSeal' }]);
    addSeal(c);
    addSeal(c);
    expect(act(c, { type: 'useGift', gift: 'records' }).ok).toBe(true);
    expect(c.s.flags.seals).toBe(2 - GIFTS.records.seals);
  });

  it('guards: no searches until the count, and the watch leaves one area alone at the next dawn', () => {
    const c = town();
    own(c, 'barracks');
    expect(act(c, { type: 'useGift', gift: 'guards', target: 'market' }).ok).toBe(true);
    expect(has(c.s, 'noSearch')).toBeTruthy();
    expect(has(c.s, 'lookAway', 'market')).toBeTruthy();
  });

  it('the hearth: in the town a household more than half yours seeds its area each dawn; half is not enough', () => {
    const c = town();
    const home = Object.values(c.s.people).find((p) => p.home.startsWith('home:'))!.home;
    const house = Object.values(c.s.people).filter((p) => p.home === home && p.gone === null);
    const a = area(home);
    const seeded = (): number => {
      setHold(c, a, 10);
      giftsDawn(c);
      return Math.round((c.s.places[a]!.hold - 10) / GIFTS.hearth.hold);
    };
    for (const p of house.slice(0, Math.floor(house.length / 2))) convert(c, p, 40);
    expect(hearths(c.s)).not.toContain(home);
    const others = seeded();
    convert(c, house[Math.floor(house.length / 2)]!, 40);
    expect(hearths(c.s)).toContain(home);
    expect(seeded()).toBe(others + 1);
  });
});
