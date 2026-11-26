// Whole-run checks on the src sim: one seed plus one action log gives one state; a dawn save continues identically;
// a quiet tick allocates nothing; the god's day formulas exactly as the spec states them.
import { describe, expect, it } from 'vitest';
import { BALANCE, PROFANE, TIES } from '../../../src/content/balance';
import { area, remove, type Ctx } from '../../../src/sim/core';
import { AT, DAY_TICKS, NIGHT_TICKS, dayOf, isDay, tod } from '../../../src/content/clock';
import { cardFee, evilShare } from '../../../src/sim/cards';
import { decayAt, emberAt, hungerRise, maliceRise, netherIncome } from '../../../src/sim/god';
import { makeSim } from '../../../src/sim';
import type { Action, GameEvent, GameState, Sim } from '../../../src/types';

/** The script: take the first card dealt, then try the first whisper the rules allow each fiftieth step; sleep whenever the clock stands. */
function play(sim: Sim, s: GameState, ticks: number, log: Action[]): void {
  for (let i = 0; i < ticks && s.phase === 'live'; i++) {
    if (s.pending?.kind === 'blessing') act(sim, s, { type: 'pickBlessing', blessing: s.pending.offers[0]! }, log);
    if (s.pending?.kind === 'story') act(sim, s, { type: 'story', option: 1 }, log);
    if (s.god.deal) act(sim, s, { type: 'take', card: null }, log);
    if (s.body === null && isDay(s.tick)) act(sim, s, sim.legal(s).find((a) => a.type === 'possess')!, log);
    if (i % 50 === 0) {
      const w = sim.legal(s).find((a) => a.type === (isDay(s.tick) ? 'mark' : 'whisper'));
      if (w) act(sim, s, w, log);
    }
    if (s.tick >= s.until) act(sim, s, { type: 'sleep' }, log);
    sim.step(s);
  }
}
function act(sim: Sim, s: GameState, a: Action, log: Action[]): void {
  if (sim.act(s, a).ok) log.push(a);
}
/** A run begun and its first day played out: the god at the first dusk, the night its own. */
function begin(sim: Sim, seed: number): GameState {
  const s = sim.create(seed);
  expect(s.phase).toBe('bonus');
  const gift = s.god.deal![0]!;
  expect(sim.act(s, { type: 'take', card: gift }).ok).toBe(true);
  expect(s.phase).toBe('live');
  expect(s.tally.gift).toBe(gift);
  expect(s.host).toBe('g01');
  while (s.tick < s.until) {
    if (s.pending?.kind === 'story') sim.act(s, { type: 'story', option: 1 });
    else if (s.pending?.kind === 'blessing') sim.act(s, { type: 'pickBlessing', blessing: s.pending.offers[0]! });
    else sim.step(s);
  }
  expect(tod(s.tick)).toBe(AT.dusk);
  return s;
}

describe('the run', () => {
  it('one seed and one action log give one state', () => {
    const run = (seed: number): { s: GameState; log: Action[] } => {
      const { sim } = makeSim();
      const s = begin(sim, seed);
      const log: Action[] = [];
      play(sim, s, 4 * DAY_TICKS, log);
      return { s, log };
    };
    const a = run(7);
    expect(a.s.tick).toBeGreaterThan(3 * DAY_TICKS);
    expect(a.log.some((x) => x.type === 'whisper')).toBe(true);
    expect(JSON.stringify(run(7))).toBe(JSON.stringify(a));
    expect(JSON.stringify(run(8).s)).not.toBe(JSON.stringify(a.s));
  });

  it('a dawn save continues identically', () => {
    const { sim } = makeSim();
    const s = begin(sim, 11);
    let save = '';
    for (let i = 0; i < 3 * DAY_TICKS && !save; i++) {
      if (s.tick >= s.until) sim.act(s, { type: 'sleep' });
      for (const e of sim.step(s)) if (e.kind === 'dawn' && s.tick > DAY_TICKS) save = JSON.stringify(s);
    }
    expect(save).not.toBe('');
    const resumed = JSON.parse(save) as GameState;
    play(sim, s, 2 * DAY_TICKS, []);
    play(makeSim().sim, resumed, 2 * DAY_TICKS, []);
    expect(JSON.stringify(resumed)).toBe(JSON.stringify(s));
  });

  it('the opening: the grave rooted, the ground beside it coloured, the next ring sensed', () => {
    const { sim, query } = makeSim();
    const s = sim.create(7);
    const seen = (a: string): string => query.visibility(s, a);
    expect(s.places.grave!.rooted).toBe(true);
    expect([seen('grave'), seen('heartvein'), seen('cartway')]).toEqual(['active', 'active', 'active']);
    expect(s.places.cartway!.hold).toBe(BALANCE.graveRingStart);
    expect(['westdrift', 'bunks', 'sorting', 'eastworks', 'lowgallery'].map(seen)).toEqual(Array(5).fill('sensed'));
    expect(['kilnshrine', 'overseer', 'lift', 'sump'].map(seen)).toEqual(Array(4).fill('void'));
  });

  it('a quiet tick returns the one empty list', () => {
    const { sim } = makeSim();
    const s = begin(sim, 3);
    s.until = 10;
    const first = sim.step(s);
    expect(first.length).toBe(0);
    expect(sim.step(s)).toBe(first);
  });

  it("an action's rule events echo in the world as a tick's do: an act of evil bolts the doors", () => {
    const { sim } = makeSim();
    const s = begin(sim, 5);
    s.god.hand.push('bloodRite');
    s.god.nether = 100;
    const r = sim.act(s, { type: 'play', card: 'bloodRite', pay: [] });
    expect(r.ok).toBe(true);
    expect(r.events.some((e) => e.kind === 'story' && e.story === 'boltedDoors')).toBe(true);
  });

  it("a god's card names where it lands: the person or the area it is aimed at", () => {
    const { sim } = makeSim();
    const s = begin(sim, 5);
    s.god.nether = 100;
    for (const [card, field] of [['frame', 'unit'], ['terrorize', 'place']] as const) {
      s.god.hand.push(card);
      const a = sim.legal(s).find((x) => x.type === 'play' && x.card === card && x.target);
      expect(a).toBeDefined();
      const e = sim.act(s, a!).events.find((x) => x.kind === 'play');
      expect(e?.[field]).toBe(a!.type === 'play' && a!.target);
    }
  });

  it('evil done at the grave profanes the hallowed Flame stones there: the Temple feels 4 a stone', () => {
    const { sim } = makeSim();
    const s = begin(sim, 5);
    const flame = Object.values(s.crystals).filter((x) => 'pouch' in x.at).slice(0, 2);
    for (const x of flame) x.affinity = 'flame';
    s.god.hand.push('bloodRite');
    s.god.nether = 100;
    const r = sim.act(s, { type: 'play', card: 'bloodRite', pay: [] });
    expect(r.ok).toBe(true);
    expect(flame.map((x) => s.crystals[x.id]?.profaned)).toEqual([true, true]);
    expect(r.events.find((e) => e.kind === 'story' && e.story === 'profane')?.note?.slots?.n).toBe(2);
    expect(r.events.some((e) => e.kind === 'suspicion' && e.note?.key === 'heat.profaned')).toBe(true);
    expect(Math.min(PROFANE.heatCap, 2 * PROFANE.heat)).toBe(8);
  });

  it('a refused action changes nothing', () => {
    const { sim } = makeSim();
    const s = begin(sim, 5);
    const before = JSON.stringify(s);
    const r = sim.act(s, { type: 'eat', crystal: 'nope' });
    expect(r.ok).toBe(false);
    expect(r.why.length).toBeGreaterThan(0);
    expect(JSON.stringify(s)).toBe(before);
  });

});

describe('the turn: the night is the player\'s, the day passes by itself', () => {
  const night = (seed: number): { sim: Sim; s: GameState } => {
    const { sim } = makeSim();
    const s = begin(sim, seed);
    s.god.nether = 500;
    for (const p of Object.values(s.people)) p.marked = dayOf(s.tick); // a whisper reaches the marked
    return { sim, s };
  };
  /** Run the clock to where it stands now (the dawn sets the day's end after it), answering any story's door. */
  const run = (sim: Sim, s: GameState, out: GameEvent[] = []): GameEvent[] => {
    const to = s.until;
    while (s.phase === 'live') {
      if (s.pending?.kind === 'story') sim.act(s, { type: 'story', option: 1 });
      else if (s.pending || s.tick >= to) break;
      else out.push(...sim.step(s));
    }
    return out;
  };

  it('starts at the dusk, and no time passes until an action is taken', () => {
    const { sim, s } = night(9);
    expect(tod(s.tick)).toBe(AT.dusk);
    expect(s.until).toBe(s.tick);
    expect(sim.step(s)).toEqual([]);
    expect(s.tick).toBe(DAY_TICKS);
  });

  it('each action point spent runs the night on by its share; the last reaches dawn', () => {
    const { sim, s } = night(9);
    expect(s.god.ap).toBe(s.god.apMax);
    const cap = s.god.apMax;
    for (let n = 1; n <= cap; n++) {
      const w = sim.legal(s).find((a) => a.type === 'whisper');
      expect(sim.act(s, w!).ok).toBe(true);
      expect(s.until).toBe(DAY_TICKS + (n === cap ? NIGHT_TICKS : Math.round((NIGHT_TICKS * n) / cap)));
    }
    const out = run(sim, s);
    expect(s.tick).toBe(DAY_TICKS + NIGHT_TICKS);
    expect(out.some((e) => e.kind === 'dawn')).toBe(true);
    expect(tod(s.tick)).toBe(AT.dawn);
  });

  it('an action that costs no action point leaves the clock where it stands', () => {
    const { sim, s } = night(9);
    s.god.hand.push('mend');
    expect(sim.act(s, { type: 'discard', card: 'mend' }).ok).toBe(true);
    expect(s.until).toBe(s.tick);
  });

  it('sleeping skips the rest of the night to dawn, and the day then runs dawn to dusk by itself', () => {
    const { sim, s } = night(9);
    expect(sim.act(s, { type: 'sleep' }).ok).toBe(true);
    expect(s.until).toBe(DAY_TICKS + NIGHT_TICKS);
    run(sim, s);
    expect(tod(s.tick)).toBe(AT.dawn);
    expect(s.until).toBe(DAY_TICKS + NIGHT_TICKS + AT.dusk - AT.dawn);
    expect(sim.act(s, { type: 'sleep' }).why).toEqual([{ key: 'why.day' }]);
    const day = run(sim, s);
    expect(tod(s.tick)).toBe(AT.dusk);
    expect(day.some((e) => e.kind === 'dusk')).toBe(true);
    expect(day.filter((e) => e.note).length).toBeGreaterThan(0); // what the day card lists
    expect(s.god.ap).toBe(s.god.apMax);
    expect(sim.act(s, { type: 'sleep' }).ok).toBe(true);
  });

  it('refuses every action by day but the host\'s own (marks, walking, work), a pending choice excepted', () => {
    const { sim, s } = night(9);
    sim.act(s, { type: 'sleep' });
    run(sim, s);
    expect(sim.legal(s).every((a) => a.type === 'mark' || a.type === 'work')).toBe(true);
    expect(sim.act(s, { type: 'whisper', target: Object.keys(s.people)[0]! }).why).toEqual([{ key: 'why.day' }]);
  });

  it('random events roll in the ticks the night runs through', () => {
    const was = BALANCE.nightEventChance;
    (BALANCE as { nightEventChance: number }).nightEventChance = 1;
    try {
      const { sim, s } = night(9);
      if (s.pending?.kind === 'story') sim.act(s, { type: 'story', option: 1 }); // at chance 1 the dusk's own roll may ask first
      sim.act(s, { type: 'sleep' });
      const out = run(sim, s);
      const told = out.filter((e) => e.kind === 'story' && e.story !== 'day' && e.story !== 'life' && !isDay(e.tick ?? 0));
      expect(told.length).toBeGreaterThan(0);
    } finally {
      (BALANCE as { nightEventChance: number }).nightEventChance = was;
    }
  });
});

describe("the god's day (spec §4, §5)", () => {
  const fresh = (): GameState => {
    const { sim } = makeSim();
    return begin(sim, 9);
  };

  it('Hunger rises 4 + Divinity + one per 4 followers', () => {
    const s = fresh();
    expect(hungerRise(s)).toBe(BALANCE.hungerRiseBase + 1);
    for (const id of Object.keys(s.people).slice(0, 8)) s.people[id]!.follower = true;
    s.god.level = 2;
    expect(hungerRise(s)).toBe(4 + 2 + 2);
  });

  it('the god wakes at Hunger 30 and Malice 10', () => {
    const s = makeSim().sim.create(9);
    expect([s.god.hunger, s.god.malice]).toEqual([BALANCE.startHunger, BALANCE.startMalice]);
  });

  it('Malice rises 4 + Divinity', () => {
    const s = fresh();
    s.god.level = 3;
    expect(maliceRise(s)).toBe(7);
  });

  it('the Ember fades from 24 by one a day to 8', () => {
    expect(emberAt(1)).toBe(24);
    expect(emberAt(5)).toBe(20);
    expect(emberAt(40)).toBe(8);
  });

  it('Nether with no followers is the Ember; starving takes 40 %', () => {
    const s = fresh();
    s.tick = DAY_TICKS;
    expect(netherIncome(s)).toBe(emberAt(1));
    s.god.hunger = BALANCE.starvingAt;
    expect(netherIncome(s)).toBe(Math.round(emberAt(1) * 0.6 * 10) / 10);
  });

  it('heat cools max(1, 2 − 0.15·(L − 1)) a dawn', () => {
    expect(decayAt(1)).toBe(2);
    expect(decayAt(3)).toBeCloseTo(1.7);
    expect(decayAt(9)).toBe(1);
  });

  it('a deal slot is evil with 0.3 + 0.004·Malice; each card after the first costs 8 Nether more', () => {
    const s = fresh();
    s.god.malice = 0;
    expect(evilShare(s)).toBeCloseTo(0.3);
    s.god.malice = 100;
    expect(evilShare(s)).toBeCloseTo(0.7);
    s.god.played = 2;
    expect(cardFee(s)).toBe(16);
  });
});

describe("a going's ties notice (TIES)", () => {
  const setup = (seed: number) => {
    const { sim } = makeSim();
    const s = begin(sim, seed);
    const p = Object.values(s.people).find((x) => x.ties.length >= 2)!;
    const [mine, theirs] = p.ties.map((id) => s.people[id]!);
    Object.assign(mine!, { follower: true, routine: 'pray', trait: 'curious' });
    mine!.stats.devotion = 50;
    return { c: { s, out: [] } as Ctx, p, mine: mine!, theirs: theirs! };
  };

  it('devoured: their ties harden by 8, yours lose 8 Devotion, the town talks, the home recedes 3 Hold', () => {
    const { c, p, mine, theirs } = setup(4);
    const home = area(p.home);
    c.s.places[home]!.hold = 40;
    const r = theirs.resistance;
    remove(c, p, 'devoured');
    expect(theirs.resistance).toBe(r + TIES.devouredResist);
    expect(mine.stats.devotion).toBe(50 - TIES.devouredDevotion);
    expect(c.s.factions.public.suspicion).toBeGreaterThan(0);
    expect(c.s.places[home]!.hold).toBe(40 - TIES.devouredHold);
    expect(c.out.some((e) => e.kind === 'story' && e.story === 'ties')).toBe(true);
  });

  it('taken: they fall (gone, not lost: never yours), their ties soften by 5, yours feed Malice by 1 each', () => {
    const { c, p, theirs } = setup(4);
    const r = theirs.resistance;
    const m = c.s.god.malice;
    remove(c, p, 'taken');
    expect(c.out.filter((e) => e.kind === 'gone' || e.kind === 'lost').map((e) => [e.kind, e.unit])).toEqual([['gone', p.id]]);
    expect(theirs.resistance).toBe(Math.max(0, r - TIES.takenSoften));
    expect(c.s.god.malice).toBe(m + TIES.malice);
  });
});
