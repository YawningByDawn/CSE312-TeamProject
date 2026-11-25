/**
 * The sim (inventory #9-12): `makeSim(world)` gives the `Sim` the pump steps and the `Query` the view and the ui read.
 * Tick 0 is the opening's night; the run waits in `bonus` on the first deal, and the take begins the clock. Each tick
 * the action points refill (`apMax` a day) and the hour's rules run: dawn, the shift's swings, its end, dusk.
 */
import { BALANCE } from '../content/balance';
import { GIFTS } from '../content/gifts';
import { AT, DAY_TICKS, dayOf, hourOf, partOf, tod } from '../content/clock';
import { AREAS, NEIGHBOURS, PLACES } from '../content/world';
import { dealCards, discard, discardWhy, cardCost, play, playWhy, reroll, rerollWhy, take, takeWhy, cardFee, cardTargets, payment, faithOf } from './cards';
import { bonus } from './bonus';
import { FACILITIES, benchOpen, facilities, hearths } from './buildings';
import { benchWhy, give, giveWhy, itemsDawn, make, makeCost, openVault, takeBack, takeBackWhy, vaultWhy } from './town';
import { ev, everyone, flockOf, influence, pouchIds, presence, settleRank, type Ctx, type Flock } from './core';
import { burnWorth } from './crystals';
import { XP_THRESHOLDS, round1 } from './formulas';
import { decayAt, godDawn, godDusk, hungerRise, maliceRise, netherIncome, pickBlessing } from './god';
import {
  chooseCut, chooseCutWhy, eat, eatHunger, eatWhy, enchant, enchantCost, enchantWhy, facet, facetCost, facetWhy, graveDawn, recombine, recombineCost,
  recombineWhy, set, setWhy, unset, unsetWhy,
} from './grave';
import {
  creep, devotionDay, directNether, groupPrice, groupWhy, inReach, move, moveAp, moveOdds, moveWhy, routineWhy, visibility, whisper,
  whisperCost, whisperGroup, whisperOdds, whisperOddsWhy, whisperWhy,
} from './influence';
import { discoverDawn } from './discoveries';
import { giftActions, giftWhy, giftsDawn, useGift } from './gifts';
import { duskStones, shiftEnd, shiftTick } from './mining';
import { townShiftEnd } from './tithe';
import { chooseStory, pendingSlots, storyDawn, storyWhy } from './stories';
import { answer, answerNether, answerWhy, crossings, powersDawn, powersDusk } from './threats';
import { newCrystal } from './crystals';
import { seedRng } from './rng';
import { calendarOf, tieKind } from './world';
import { CARDS } from '../content/cards';
import type { Action, Check, Facility, GameEvent, GameState, GroupId, JewelForm, Query, Reason, Routine, Sim, Weekday, World } from '../types';

const ROUTINES: readonly Routine[] = ['pray', 'offer', 'lieLow', 'delve', 'skim', 'preach', 'standWatch'];
const FORMS: readonly JewelForm[] = ['ring', 'amulet', 'circlet'];

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
    places[a] = { id: a, hold: anchored ? 100 : 0, explored: anchored, found: anchored, rooted: anchored, yours: false };
  }
  for (const a in AREAS) if (AREAS[a]!.anchored) for (const n of NEIGHBOURS[a]!) places[n]!.hold = BALANCE.graveRingStart;
  return {
    v: 2, seed, rng: seedRng(seed), tick: 0, phase: 'bonus', stage: 'whisper', weather: 'clear', wind: 0,
    god: {
      level: 1, xp: 0, nether: 0, ichor: BALANCE.startIchor, hunger: BALANCE.startHunger, malice: BALANCE.startMalice, ap: 0, apMax: 0, sockets: [], blessings: [],
      hand: [], deal: null, rerolls: 0, played: 0, free: 0, boost: 0,
    },
    people: {}, places, crystals: {}, items: {},
    factions: { temple: { suspicion: 0, level: 0, called: 0 }, council: { suspicion: 0, level: 0, called: 0 }, public: { suspicion: 0, level: 0, called: 0 } },
    threats: [], pending: null, effects: [], next: 1, mine: { carts: {}, expected: 0, shortDays: 0, delve: 0 },
    flags: { deepOpen: false, vaultOpen: false, surfaceRooted: false, seals: 0, shadeDay: 0 },
    ledger: { crystals: 0, nether: 0, turned: 0, lost: 0, suspicion: { temple: 0, council: 0, public: 0 } },
    tally: { turned: 0, peak: 0, whispers: 0, gift: null },
  };
}

/** What an action costs now: action points, Nether, crystal worth; the odds of a chance action. */
function price(s: Readonly<GameState>, w: World, fl: Flock, a: Action): Omit<Check, 'ok' | 'why'> {
  const none = { ap: 0, nether: 0, crystals: 0 };
  switch (a.type) {
    case 'whisper': {
      const p = s.people[a.target];
      return p ? { ap: s.god.free > 0 ? 0 : 1, nether: whisperCost(s, fl, p), crystals: 0, odds: whisperOdds(s, fl, p) } : none;
    }
    case 'whisperGroup': {
      const g = groupPrice(s, w, fl, a.group, dayOf(s.tick));
      return g ? { ap: s.god.free > 0 ? 0 : 1, nether: g.nether, crystals: 0, odds: g.odds } : none;
    }
    case 'setRoutine': return s.people[a.unit] ? { ap: 1, nether: directNether(s.people[a.unit]!), crystals: 0 } : none;
    case 'move': {
      const p = s.people[a.unit];
      return p ? { ap: moveAp(s, w, p, a.to), nether: directNether(p), crystals: 0, odds: moveOdds(s, w, p, a.to) } : none;
    }
    case 'play': return { ap: 0, nether: cardFee(s), crystals: s.god.hand.includes(a.card) ? cardCost(s, a.card) : 0 };
    case 'enchant': return s.crystals[a.crystal] ? { ap: 0, nether: enchantCost(s, s.crystals[a.crystal]!), crystals: 0 } : none;
    case 'recombine': return s.crystals[a.a] && s.crystals[a.b] ? { ap: 0, nether: recombineCost(s.crystals[a.a]!, s.crystals[a.b]!), crystals: 0 } : none;
    case 'facet': return s.crystals[a.crystal] ? { ap: 0, nether: facetCost(s, s.crystals[a.crystal]!), crystals: 0 } : none;
    case 'answer': return { ap: 1, nether: answerNether(s, a.threat, a.with), crystals: 0 };
    case 'useGift': return { ap: GIFTS.ap, nether: GIFTS[a.gift].nether, crystals: 0 };
    case 'forge': return { ap: 0, nether: makeCost(s, 'jewelry', a.crystal), crystals: 0 };
    case 'craft': return { ap: 0, nether: makeCost(s, a.facility, a.crystal), crystals: 0 };
    default: return none;
  }
}

/** Why an action is refused now (empty: it may be taken). */
function why(s: Readonly<GameState>, w: World, fl: Flock, a: Action): Reason[] {
  if (s.phase === 'won' || s.phase === 'lost') return [{ key: 'why.over' }];
  if (s.phase === 'bonus') return a.type === 'take' ? takeWhy(s, a.card) : [{ key: 'why.pickBonus' }];
  if (s.pending?.kind === 'story') return a.type === 'story' ? storyWhy(s, a.option) : [{ key: 'why.pending' }];
  if (s.pending?.kind === 'facet') return a.type === 'chooseCut' ? chooseCutWhy(s, a.index) : [{ key: 'why.pending' }];
  if (s.pending) return s.pending.kind === 'blessing' && a.type === 'pickBlessing' ? (s.pending.offers.includes(a.blessing) ? [] : [{ key: 'why.notOffered' }]) : [{ key: 'why.pending' }];
  const day = dayOf(s.tick);
  const r = ((): Reason[] => {
    switch (a.type) {
      case 'whisper': return whisperWhy(s, fl, s.people[a.target], day);
      case 'whisperGroup': return groupWhy(s, w, fl, a.group, day);
      case 'setRoutine': return routineWhy(s, s.people[a.unit], a.routine);
      case 'move': return moveWhy(s, w, s.people[a.unit], a.to);
      case 'take': return takeWhy(s, a.card);
      case 'discard': return discardWhy(s, a.card);
      case 'reroll': return rerollWhy(s);
      case 'play': return playWhy(s, fl, a.card, a.pay, a.target);
      case 'eat': return eatWhy(s, a.crystal);
      case 'set': return setWhy(s, a.crystal, a.socket);
      case 'unset': return unsetWhy(s, a.crystal);
      case 'enchant': return enchantWhy(s, a.crystal, a.reroll);
      case 'recombine': return recombineWhy(s, a.a, a.b);
      case 'facet': return facetWhy(s, a.crystal);
      case 'answer': return answerWhy(s, a.threat, a.with);
      case 'forge': return benchWhy(s, 'jewelry', a.crystal);
      case 'craft': return benchWhy(s, a.facility, a.crystal);
      case 'give': return giveWhy(s, a.item, a.unit, a.by);
      case 'takeBack': return takeBackWhy(s, a.item);
      case 'openVault': return vaultWhy(s);
      case 'useGift': return giftWhy(s, w, a);
      case 'pickBlessing': return [{ key: 'why.notOffered' }];
      default: return [{ key: 'why.closed' }];
    }
  })();
  if (r.length > 0) return r;
  const p = price(s, w, fl, a);
  if (p.ap > s.god.ap) return [{ key: 'why.ap', slots: { n: p.ap } }];
  return p.nether > s.god.nether ? [{ key: 'why.nether', slots: { n: round1(p.nether) } }] : [];
}

/** Apply an action whose why is empty: its price paid (a free whisper spends the free one), then its rule. */
function apply(c: Ctx, fl: Flock, a: Action): void {
  const s = c.s;
  const g = s.god;
  const p = price(s, c.w, fl, a);
  g.ap -= p.ap;
  g.nether = round1(g.nether - p.nether);
  if (g.free > 0 && (a.type === 'whisper' || a.type === 'whisperGroup')) g.free -= 1;
  switch (a.type) {
    case 'whisper': whisper(c, [s.people[a.target]!], dayOf(s.tick), p.odds!); break;
    case 'whisperGroup': whisperGroup(c, c.w, a.group, dayOf(s.tick), p.odds!); break;
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
    case 'play': play(c, a.card, a.pay, a.target); break;
    case 'eat': eat(c, a.crystal); break;
    case 'set': set(c, a.crystal, a.socket); break;
    case 'unset': unset(c, a.crystal); break;
    case 'enchant': enchant(c, a.crystal, a.reroll); break;
    case 'recombine': recombine(c, a.a, a.b); break;
    case 'facet': facet(c, a.crystal); break;
    case 'chooseCut': chooseCut(c, a.index); break;
    case 'answer': answer(c, a.threat, a.with); break;
    case 'pickBlessing': pickBlessing(c, a.blessing); break;
    case 'story': chooseStory(c, a.option); break;
    case 'forge': make(c, 'jewelry', a.crystal, a.form); break;
    case 'craft': make(c, a.facility, a.crystal); break;
    case 'give': give(c, a.item, a.unit); break;
    case 'takeBack': takeBack(c, a.item); break;
    case 'openVault': openVault(c); break;
    case 'useGift': useGift(c, a); break;
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

export function makeSim(w: World): { sim: Sim; query: Query } {
  const out: GameEvent[] = [];
  const c: Ctx = { s: null as unknown as GameState, out, w };

  function dawn(): void {
    const s = c.s;
    const l = s.ledger;
    l.crystals = l.nether = l.turned = l.lost = 0;
    l.suspicion.temple = l.suspicion.council = l.suspicion.public = 0;
    s.god.ap = Math.min(s.god.ap, s.god.apMax); // Quickening's AP is for its day only
    ev(c, { kind: 'dawn', weekday: weekdayOf(s.tick) });
    graveDawn(c);
    itemsDawn(c);
    giftsDawn(c);
    creep(c);
    devotionDay(c);
    discoverDawn(c);
    if (s.phase === 'live') godDawn(c);
    if (s.phase === 'live') powersDawn(c);
    storyDawn(c);
  }

  const sim: Sim = {
    create(seed, opts) {
      const s = blank(seed);
      w.populate(s);
      if (opts?.stage === 'shade') {
        s.stage = 'shade';
        s.god.level = BALANCE.shadeLevel;
        s.god.xp = XP_THRESHOLDS[BALANCE.shadeLevel - 1]!;
        s.flags.surfaceRooted = true;
      }
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
      if (s.phase !== 'live' || s.pending) return out;
      c.s = s;
      s.tick += 1;
      const g = s.god;
      // AP is held as a whole count of 1/DAY_TICKS steps, re-read each tick, so it never drifts off a whole number
      if (g.ap < g.apMax) g.ap = Math.min(g.apMax, (Math.round(g.ap * DAY_TICKS) + g.apMax) / DAY_TICKS);
      const t = tod(s.tick);
      if (t === AT.dawn) dawn();
      if (t === AT.shift) ev(c, { kind: 'shiftStart', weekday: weekdayOf(s.tick) });
      if (t >= AT.shift && t < AT.shiftEnd) shiftTick(c);
      if (t === AT.shiftEnd) {
        shiftEnd(c);
        townShiftEnd(c);
        ev(c, { kind: 'shiftEnd', weekday: weekdayOf(s.tick) });
      }
      if (t === AT.dusk && s.phase === 'live') {
        duskStones(c);
        powersDusk(c);
        if (s.phase === 'live') godDusk(c);
        ev(c, { kind: 'dusk', weekday: weekdayOf(s.tick) });
      }
      if (t === AT.night) ev(c, { kind: 'night', weekday: weekdayOf(s.tick) });
      if (s.phase === 'live') crossings(c);
      if (s.phase === 'live') w.step(s, out);
      pruneEffects(s);
      return out;
    },

    act(s, a) {
      const fl = flockOf(s);
      const r = why(s, w, fl, a);
      if (r.length > 0) return { ok: false, why: r, events: [] };
      const events: GameEvent[] = [];
      apply({ s, out: events, w }, fl, a);
      if (s.phase === 'live') w.echo(s, events, 0);
      return { ok: true, why: [], events };
    },

    legal(s) {
      const fl = flockOf(s);
      const all: Action[] = [];
      const g = s.god;
      for (const card of g.deal ?? []) all.push({ type: 'take', card });
      all.push({ type: 'take', card: null }, { type: 'reroll' });
      if (s.pending?.kind === 'blessing') for (const blessing of s.pending.offers) all.push({ type: 'pickBlessing', blessing });
      if (s.pending?.kind === 'story') for (let option = 1; option <= s.pending.options; option++) all.push({ type: 'story', option });
      if (s.pending?.kind === 'facet') for (let index = 0; index < s.pending.cuts.length; index++) all.push({ type: 'chooseCut', index });
      const groups = new Set<GroupId>();
      for (const p of everyone(s)) {
        const id = p.id;
        if (!p.follower) {
          all.push({ type: 'whisper', target: id });
          if (s.stage === 'shade') for (const group of w.groupsOf(s, p)) groups.add(group);
          continue;
        }
        for (const routine of ROUTINES) all.push({ type: 'setRoutine', unit: id, routine });
        for (const to in PLACES) all.push({ type: 'move', unit: id, to });
      }
      for (const group of groups) all.push({ type: 'whisperGroup', group });
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
        all.push({ type: 'eat', crystal }, { type: 'set', crystal, socket: empty }, { type: 'enchant', crystal }, { type: 'facet', crystal });
        for (const b of pouch) if (crystal < b) all.push({ type: 'recombine', a: crystal, b });
      }
      for (const id of g.sockets) if (id) all.push({ type: 'unset', crystal: id }, { type: 'enchant', crystal: id });
      for (const f of FACILITIES.filter((x) => x !== 'faceting' && benchOpen(s, x))) {
        for (const crystal of pouch) {
          if (f === 'jewelry') for (const form of FORMS) all.push({ type: 'forge', crystal, form });
          else all.push({ type: 'craft', facility: f as Exclude<Facility, 'faceting' | 'jewelry'>, crystal });
        }
      }
      for (const item in s.items) {
        all.push({ type: 'takeBack', item });
        for (const p of everyone(s)) if (p.follower) all.push({ type: 'give', item, unit: p.id });
      }
      all.push({ type: 'openVault' }, ...giftActions(s));
      for (const t of s.threats) {
        all.push({ type: 'answer', threat: t.id, with: 'favour' }, { type: 'answer', threat: t.id, with: 'hide' });
        for (const id in s.items) all.push({ type: 'answer', threat: t.id, with: id });
      }
      return all.filter((a) => why(s, w, fl, a).length === 0);
    },
  };

  const query: Query = {
    check(s, a) {
      const fl = flockOf(s);
      const r = why(s, w, fl, a);
      return { ok: r.length === 0, why: r, ...price(s, w, fl, a) };
    },
    tieKind: (s, a, b) => tieKind(s, s.people[a]!, s.people[b]!),
    hour: hourOf,
    day: dayOf,
    weekday: weekdayOf,
    part: partOf,
    daylight: (h) => Math.max(0, Math.sin(((h - 6) / 12) * Math.PI)),
    visibility,
    reach(s) {
      const fl = flockOf(s);
      return everyone(s).filter((p) => inReach(s, fl, p)).map((p) => p.id);
    },
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
    facilities,
    goal(s) {
      if (s.stage === 'shade') return { key: 'goal.vault' };
      if (!s.flags.surfaceRooted) return { key: 'goal.rootPithead' };
      return { key: 'goal.rank', slots: { n: BALANCE.shadeLevel } };
    },
    worth(s, crystal, card) {
      const x = s.crystals[crystal]!;
      return { burn: burnWorth(x, card ? CARDS[card]!.nature ?? null : null), hunger: round1(eatHunger(x)) };
    },
    storySlots: pendingSlots,
    odds: (s, unit) => whisperOddsWhy(s, flockOf(s), s.people[unit]!),
    groups: (s, unit) => w.groupsOf(s, s.people[unit]!),
    hearths,
  };
  return { sim, query };
}
