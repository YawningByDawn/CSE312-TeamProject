/**
 * src/sim, the rules. Owns the run's state (`GameState`) and every change to it: `makeSim()` gives the pump's
 * `Sim` (create, step one tick, act, legal) and the `Query` the view, the ui and the audio read (checks, odds, stats,
 * goal, slots), never writing. Reads content's tables (balance, cards, crystals, gems, world, clock, stages, threats,
 * stories, blessings) and src/sim/world, the people's lives; its one RNG lives in the state (rng.ts).
 * No DOM, IO, wall clock or Math.random. One rule area a file: the god's day (god), the mine's (mining), colour and the
 * whisper (influence), the cards, the grave and its stones (grave, crystals, bonus), the powers' moves (threats), the
 * stories, discoveries; core.ts holds what they share.
 * Tick 0 is the dusk; the run waits in `bonus` on the first deal, and the take wakes the god at the first dawn (host.ts:
 * the day is played as a possessed follower, marks, the fall). The night is the player's turn: the clock stands (`step` does nothing at `until`) and each action point spent moves `until` on by its share of the
 * night (`nightUntil`), a `sleep` to the dawn; the day then passes by itself, dawn to dusk, where the action points
 * refill. Each tick the hour's rules run: dawn, the shift's swings, its end, dusk.
 */
import { BALANCE } from '../content/balance';
import { AT, NIGHT_TICKS, TPH, dayOf, hourOf, isDay, nextAt, partOf, tod } from '../content/clock';
import { AREAS, NEIGHBOURS, PLACES } from '../content/world';
import { dealCards, discard, discardWhy, cardCost, play, playWhy, reroll, rerollWhy, take, takeWhy, cardFee, cardTargets, payment, faithOf } from './cards';
import { bonus } from './bonus';
import { digs, ev, everyone, flockOf, influence, pouchIds, presence, settleRank, type Ctx, type Flock } from './core';
import { burnWorth } from './crystals';
import { XP_THRESHOLDS, maxHp, round1 } from './formulas';
import { colourDawn } from './colour';
import { dawnHost, dayWhy, duskHost, bodyOf, hostOf, hosts, mark, markLeft, marksToday, mend, near, picking, possess, relieve, revive, reviveWhy } from './host';
import { bodyTick, oreSeconds, oreStands, work, workAt } from './dig';
import { fightTick, swing } from './fight';
import { ORE_SITES } from '../content/mine';
import { FIRST_MINER } from '../content/stats';
import { decayAt, godDawn, godDusk, hungerRise, maliceRise, netherIncome, pickBlessing } from './god';
import {
  eat, eatHunger, eatWhy, enchant, enchantCost, enchantWhy, graveDawn, recombine, recombineCost, recombineWhy, set, setWhy, unset, unsetWhy,
} from './grave';
import {
  creep, devotionDay, directNether, move, moveAp, moveOdds, moveWhy, routineWhy, visibility, whisper, whisperCost, whisperOdds, whisperOddsWhy, whisperWhy,
} from './influence';
import { discoverDawn } from './discoveries';
import { duskStones, shiftEnd, shiftTick } from './mining';
import { chooseStory, pendingSlots, storyRoll, storyWhy } from './stories';
import { answer, answerNether, answerWhy, crossings, powersDawn, powersDusk } from './threats';
import { newCrystal } from './crystals';
import { seedRng } from './rng';
import { calendarOf, echoes, populateWorld, stepWorld, tieKind } from './world';
import { CARDS } from '../content/cards';
import type { Action, Check, GameEvent, GameState, Query, Reason, Routine, Sim, Weekday } from '../types';

const ROUTINES: readonly Routine[] = ['pray', 'offer', 'lieLow', 'delve', 'skim'];

const weekdayOf = (t: number): Weekday => calendarOf(dayOf(t)).kind;

/** Drops the effects whose time is up. */
function pruneEffects(s: GameState): void {
  const fx = s.effects;
  let n = 0;
  for (let i = 0; i < fx.length; i++) if (fx[i]!.until > s.tick) fx[n++] = fx[i]!;
  fx.length = n;
}

function blank(seed: number): GameState {
  // The grave is yours and rooted; the ground beside it opens with `graveRingStart` Hold.
  const places: GameState['places'] = {};
  for (const a in AREAS) {
    const anchored = AREAS[a]!.anchored;
    places[a] = { id: a, hold: anchored ? 100 : 0, explored: anchored, coloured: anchored, acts: 0, actDays: 0, lastAct: -1, found: anchored, rooted: anchored };
  }
  for (const a in AREAS) {
    if (!AREAS[a]!.anchored) continue;
    for (const n of NEIGHBOURS[a]!) [places[n]!.hold, places[n]!.coloured] = [BALANCE.graveRingStart, BALANCE.graveRingStart >= BALANCE.colouredAt];
  }
  return {
    v: 7, seed, rng: seedRng(seed), tick: 0, until: 0, phase: 'bonus', weather: 'clear', wind: 0,
    god: {
      level: 1, xp: 0, nether: 0, ichor: BALANCE.startIchor, hunger: BALANCE.startHunger, malice: BALANCE.startMalice, ap: 0, apMax: 0, sockets: [], blessings: [],
      hand: [], deal: null, rerolls: 0, played: 0, free: 0, boost: 0,
    },
    people: {}, places, crystals: {},
    factions: { temple: { suspicion: 0, level: 0, called: 0 }, council: { suspicion: 0, level: 0, called: 0 }, public: { suspicion: 0, level: 0, called: 0 } },
    threats: [], pending: null, host: null, body: null, mobs: [], ores: ORE_SITES.map(() => -1), effects: [], next: 1, mine: { carts: {}, expected: 0, shortDays: 0, delve: 0 },
    flags: { deepOpen: false, liftRooted: false },
    ledger: { crystals: 0, nether: 0, turned: 0, lost: 0, suspicion: { temple: 0, council: 0, public: 0 } },
    tally: { turned: 0, peak: 0, whispers: 0, gift: null },
  };
}

/** What an action costs now: action points, Nether, crystal worth; the odds of a chance action. */
function price(s: Readonly<GameState>, fl: Flock, a: Action): Omit<Check, 'ok' | 'why'> {
  const none = { ap: 0, nether: 0, crystals: 0 };
  switch (a.type) {
    case 'whisper': {
      const p = s.people[a.target];
      return p ? { ap: s.god.free > 0 ? 0 : 1, nether: whisperCost(s, fl, p), crystals: 0, odds: whisperOdds(s, fl, p) } : none;
    }
    case 'setRoutine': return s.people[a.unit] ? { ap: 1, nether: directNether(s.people[a.unit]!), crystals: 0 } : none;
    case 'move': {
      const p = s.people[a.unit];
      return p ? { ap: moveAp(s, p, a.to), nether: directNether(p), crystals: 0, odds: moveOdds(s, p, a.to) } : none;
    }
    case 'play': return { ap: 0, nether: cardFee(s), crystals: s.god.hand.includes(a.card) ? cardCost(a.card) : 0 };
    case 'enchant': return s.crystals[a.crystal] ? { ap: 0, nether: enchantCost(s, s.crystals[a.crystal]!), crystals: 0 } : none;
    case 'recombine': return s.crystals[a.a] && s.crystals[a.b] ? { ap: 0, nether: recombineCost(s.crystals[a.a]!, s.crystals[a.b]!), crystals: 0 } : none;
    case 'answer': return { ap: 1, nether: answerNether(s, a.threat), crystals: 0 };
    default: return none;
  }
}

/** The tick the night has run to once the action points held are spent: each point is 1/`apMax` of the night, the last the dawn. */
function nightUntil(s: Readonly<GameState>): number {
  const g = s.god;
  return nextAt(s.tick, AT.dawn) - Math.round((NIGHT_TICKS * Math.max(0, g.ap)) / g.apMax);
}

/** Why an action is refused now (empty: it may be taken). */
function why(s: Readonly<GameState>, fl: Flock, a: Action): Reason[] {
  if (s.phase === 'won' || s.phase === 'lost') return [{ key: 'why.over' }];
  if (s.phase === 'bonus') return a.type === 'take' ? takeWhy(s, a.card) : [{ key: 'why.pickBonus' }];
  if (s.pending?.kind === 'story') return a.type === 'story' ? storyWhy(s, a.option) : [{ key: 'why.pending' }];
  if (s.pending) return s.pending.kind === 'blessing' && a.type === 'pickBlessing' ? (s.pending.offers.includes(a.blessing) ? [] : [{ key: 'why.notOffered' }]) : [{ key: 'why.pending' }];
  if (isDay(s.tick)) return dayWhy(s, a);
  const day = dayOf(s.tick);
  const r = ((): Reason[] => {
    switch (a.type) {
      case 'sleep': return [];
      case 'whisper': return whisperWhy(s, fl, s.people[a.target], day);
      case 'setRoutine': return routineWhy(s, s.people[a.unit], a.routine);
      case 'move': return moveWhy(s, s.people[a.unit], a.to);
      case 'take': return takeWhy(s, a.card);
      case 'discard': return discardWhy(s, a.card);
      case 'reroll': return rerollWhy(s);
      case 'play': return playWhy(s, fl, a.card, a.pay, a.target);
      case 'eat': return eatWhy(s, a.crystal);
      case 'set': return setWhy(s, a.crystal, a.socket);
      case 'unset': return unsetWhy(s, a.crystal);
      case 'enchant': return enchantWhy(s, a.crystal, a.reroll);
      case 'recombine': return recombineWhy(s, a.a, a.b);
      case 'answer': return answerWhy(s, a.threat);
      case 'revive': return reviveWhy(s, a.unit);
      case 'pickBlessing': return [{ key: 'why.notOffered' }];
      default: return [{ key: 'why.closed' }];
    }
  })();
  if (r.length > 0) return r;
  const p = price(s, fl, a);
  if (p.ap > s.god.ap) return [{ key: 'why.ap', slots: { n: p.ap } }];
  return p.nether > s.god.nether ? [{ key: 'why.nether', slots: { n: round1(p.nether) } }] : [];
}

/** Apply an action whose why is empty: its price paid (a free whisper spends the free one), then its rule. */
function apply(c: Ctx, fl: Flock, a: Action): void {
  const s = c.s;
  const g = s.god;
  const p = price(s, fl, a);
  g.ap -= p.ap;
  if (p.ap > 0) s.until = Math.max(s.until, nightUntil(s));
  g.nether = round1(g.nether - p.nether);
  if (g.free > 0 && a.type === 'whisper') g.free -= 1;
  switch (a.type) {
    case 'whisper': whisper(c, s.people[a.target]!, dayOf(s.tick), p.odds!); break;
    case 'setRoutine':
      s.people[a.unit]!.routine = a.routine;
      ev(c, { kind: 'routine', unit: a.unit, routine: a.routine });
      break;
    case 'move': move(c, s.people[a.unit]!, a.to, p.odds!); break;
    case 'take':
      take(c, a.card);
      if (s.phase === 'bonus') { s.phase = 'live'; s.tally.gift = a.card; }
      break;
    case 'discard': discard(c, a.card); break;
    case 'reroll': reroll(c); break;
    case 'sleep': s.until = Math.max(s.until, nextAt(s.tick, AT.dawn)); break;
    case 'play': play(c, a.card, a.pay, a.target); break;
    case 'eat': eat(c, a.crystal); break;
    case 'set': set(c, a.crystal, a.socket); break;
    case 'unset': unset(c, a.crystal); break;
    case 'enchant': enchant(c, a.crystal, a.reroll); break;
    case 'recombine': recombine(c, a.a, a.b); break;
    case 'answer': answer(c, a.threat); break;
    case 'mark': mark(c, s.people[a.target]!); break;
    case 'walk': [s.body!.dx, s.body!.dy] = [a.dx, a.dy]; break;
    case 'work': work(c, hostOf(s)!, s.body!); break;
    case 'swing': swing(s.body!, a.dx, a.dy); break;
    case 'possess': possess(c, a.unit); break;
    case 'revive': revive(c, a.unit); break;
    case 'pickBlessing': pickBlessing(c, a.blessing); break;
    case 'story': chooseStory(c, a.option); break;
    default: break;
  }
}

/** The cheapest stones in the pouch that pay a miracle (fewest first by worth), or null. */
function cheapestPay(s: Readonly<GameState>, card: string): string[] | null {
  const pouch = pouchIds(s).sort((x, y) => burnWorth(s.crystals[x]!, null) - burnWorth(s.crystals[y]!, null) || (x < y ? -1 : 1));
  const pay: string[] = [];
  for (const id of pouch) {
    if (payment(s, card, pay).ichor !== null) break;
    pay.push(id);
  }
  return payment(s, card, pay).ichor !== null ? pay : null;
}

export function makeSim(): { sim: Sim; query: Query } {
  const out: GameEvent[] = [];
  const c: Ctx = { s: null as unknown as GameState, out };

  function dawn(c: Ctx): void {
    const s = c.s;
    const l = s.ledger;
    l.crystals = l.nether = l.turned = l.lost = 0;
    l.suspicion.temple = l.suspicion.council = l.suspicion.public = 0;
    ev(c, { kind: 'dawn', weekday: weekdayOf(s.tick) });
    dawnHost(c);
    graveDawn(c);
    creep(c);
    colourDawn(c);
    devotionDay(c);
    discoverDawn(c);
    if (s.phase === 'live') godDawn(c);
    if (s.phase === 'live') powersDawn(c);
    storyRoll(c, BALANCE.eventChance);
    s.until = nextAt(s.tick, AT.dusk);
  }

  const sim: Sim = {
    create(seed) {
      const s = blank(seed);
      populateWorld(s);
      settleRank(s);
      s.god.ap = s.god.apMax;
      for (const t of BALANCE.startTiers) newCrystal(s, { pouch: true }, { tier: t });
      s.god.rerolls = bonus(s, 'rerolls');
      s.god.free = bonus(s, 'freeWhispers');
      s.god.deal = dealCards(s);
      return s;
    },

    step(s) {
      out.length = 0;
      if (s.phase !== 'live' || s.pending || s.tick >= s.until || picking(s)) return out;
      c.s = s;
      s.tick += 1;
      const t = tod(s.tick);
      if (t === AT.dawn) dawn(c);
      if (t === AT.shift) ev(c, { kind: 'shiftStart', weekday: weekdayOf(s.tick) });
      if (t >= AT.shift && t < AT.shiftEnd) shiftTick(c);
      const on = bodyOf(s);
      if (on && isDay(s.tick)) {
        bodyTick(c, on.host, on.body);
        fightTick(c, on.host, on.body);
      } else s.mobs.length = 0;
      if (t === AT.shiftEnd) {
        shiftEnd(c);
        ev(c, { kind: 'shiftEnd', weekday: weekdayOf(s.tick) });
      }
      if (t === AT.dusk && s.phase === 'live') {
        duskHost(c);
        duskStones(c);
        powersDusk(c);
        if (s.phase === 'live') godDusk(c);
        ev(c, { kind: 'dusk', weekday: weekdayOf(s.tick) });
      }
      if (t === AT.night) ev(c, { kind: 'night', weekday: weekdayOf(s.tick) });
      if (t % TPH === 0 && !isDay(s.tick) && s.phase === 'live') storyRoll(c, BALANCE.nightEventChance);
      mend(s);
      if (s.phase === 'live') crossings(c);
      if (s.phase === 'live') stepWorld(s, out);
      pruneEffects(s);
      relieve(c);
      return out;
    },

    act(s, a) {
      const fl = flockOf(s);
      const r = why(s, fl, a);
      if (r.length > 0) return { ok: false, why: r, events: [] };
      const events: GameEvent[] = [];
      const ctx = { s, out: events };
      const opening = s.phase === 'bonus';
      apply(ctx, fl, a);
      if (opening && s.phase === 'live') {
        s.tick = NIGHT_TICKS; // the first gift taken, the god wakes at the first dawn
        dawn(ctx);
      }
      relieve(ctx);
      if (s.phase === 'live') echoes(s, events, 0, events.length);
      return { ok: true, why: [], events };
    },

    legal(s) {
      const fl = flockOf(s);
      const all: Action[] = [];
      const g = s.god;
      for (const card of g.deal ?? []) all.push({ type: 'take', card });
      all.push({ type: 'take', card: null }, { type: 'reroll' }, { type: 'sleep' });
      if (s.pending?.kind === 'blessing') for (const blessing of s.pending.offers) all.push({ type: 'pickBlessing', blessing });
      if (s.pending?.kind === 'story') for (let option = 1; option <= s.pending.options; option++) all.push({ type: 'story', option });
      for (const unit of hosts(s)) all.push({ type: 'possess', unit });
      for (const target of near(s)) all.push({ type: 'mark', target });
      if (s.body) all.push({ type: 'work' });
      for (const p of everyone(s)) {
        const id = p.id;
        if (p.gone === 'dead') all.push({ type: 'revive', unit: id });
        if (!p.follower) {
          all.push({ type: 'whisper', target: id });
          continue;
        }
        for (const routine of ROUTINES) all.push({ type: 'setRoutine', unit: id, routine });
        for (const to in PLACES) all.push({ type: 'move', unit: id, to });
      }
      for (const card of g.hand) {
        all.push({ type: 'discard', card });
        const pay = cheapestPay(s, card) ?? [];
        const targets = cardTargets(s, fl, card);
        if (targets.length === 0) all.push({ type: 'play', card, pay });
        for (const target of targets) all.push({ type: 'play', card, pay, target });
      }
      const pouch = pouchIds(s);
      const empty = g.sockets.indexOf(null);
      for (const crystal of pouch) {
        all.push({ type: 'eat', crystal }, { type: 'set', crystal, socket: empty }, { type: 'enchant', crystal });
        for (const b of pouch) if (crystal < b) all.push({ type: 'recombine', a: crystal, b });
      }
      for (const id of g.sockets) if (id) all.push({ type: 'unset', crystal: id }, { type: 'enchant', crystal: id });
      for (const t of s.threats) all.push({ type: 'answer', threat: t.id });
      return all.filter((a) => why(s, fl, a).length === 0);
    },
  };

  const query: Query = {
    check(s, a) {
      const fl = flockOf(s);
      const r = why(s, fl, a);
      return { ok: r.length === 0, why: r, ...price(s, fl, a) };
    },
    tieKind: (s, a, b) => tieKind(s, s.people[a]!, s.people[b]!),
    hour: hourOf,
    day: dayOf,
    weekday: weekdayOf,
    part: partOf,
    sun: (h) => Math.sin(((h - 6) / 12) * Math.PI),
    daylight(h) { return Math.max(0, this.sun(h)); },
    visibility,
    stats(s) {
      const next = XP_THRESHOLDS[s.god.level];
      return {
        nether: netherIncome(s), faith: round1(faithOf(s)), influence: influence(s), presence: presence(s),
        xpToNext: next === undefined ? 0 : round1(next - s.god.xp), hungerRise: hungerRise(s), maliceRise: maliceRise(s), cooling: decayAt(s.god.level),
      };
    },
    urge(s, which) {
      const v = which === 'hunger' ? s.god.hunger : s.god.malice;
      if (which === 'hunger') return v >= 100 ? 'ravenous' : v >= BALANCE.starvingAt ? 'starving' : v < BALANCE.satedBelow ? 'sated' : 'peckish';
      return v >= 100 ? 'outburst' : v >= BALANCE.seethingAt ? 'seething' : v >= BALANCE.maliceRestlessAt ? 'restless' : 'calm';
    },
    goal(s) {
      if (!s.flags.liftRooted) return { key: 'goal.rootLift' };
      return { key: 'goal.rank', slots: { n: BALANCE.takenLevel } };
    },
    worth(s, crystal, card) {
      const x = s.crystals[crystal]!;
      return { burn: burnWorth(x, card ? CARDS[card]!.nature ?? null : null), hunger: round1(eatHunger(x)) };
    },
    storySlots: pendingSlots,
    odds: (s, unit) => whisperOddsWhy(s, flockOf(s), s.people[unit]!),
    hosts,
    near,
    workAt(s) { const on = bodyOf(s); return on && digs(on.host) ? workAt(s, on.body) : null; },
    oreStands,
    oreSeconds(s, site) { return oreSeconds(hostOf(s) ?? s.people[FIRST_MINER.id]!, site); },
    markLeft: (s, unit) => markLeft(s, s.people[unit]!),
    marksToday,
    maxHp: (p) => maxHp(p.stats),
    picking,
  };
  return { sim, query };
}
