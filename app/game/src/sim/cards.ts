/**
 * The cards (spec §15.4, DECISIONS §43; inventory #32): the deal at dusk (and the opening's bonus deal), take one or
 * none, discard, reroll; what every miracle and act of evil does; followers' own acts and Malice breaking loose.
 */
import { BALANCE, PROFANE, TOWN } from '../content/balance';
import { uiText } from '../content/text';
import { CARD, CARDS, type CardArea, type CardDef } from '../content/cards';
import { AT, DAY_TICKS, dayOf, nextAt } from '../content/clock';
import { EFFECT } from '../content/crystals';
import { AREAS } from '../content/world';
import {
  addEffect, addHeat, addHunger, addMalice, addNether, area, door, ev, everyone, followers, mint, gainDevotion, gainIchor,
  flockOf, gainXp, handMax, heatAll, here, loseDevotion, loseIchor, peopleIn, remove, setHold, standingOf, stranger, tearWrit, untilShiftEnd, whereNow, type Ctx, type Flock,
} from './core';
import { bonus } from './bonus';
import { burnWorth, oddCount } from './crystals';
import { STAGE_DRAW, STAGE_TIER, STAGE_MAX_STANDING, devotionValue, miracleCost, miraclePower, faith, round1, standingRank } from './formulas';
import { hold, inReach, placeInReach, visibility, whisper, whisperOdds } from './influence';
import { chance, pick, weightedPick } from './rng';
import { bluntAll } from './threats';
import type { CardId, CardKind, GameState, Person, PlaceId, Reason, UnitId } from '../types';

const IDS = Object.keys(CARDS) as CardId[];
const def = (id: CardId): CardDef => CARDS[id]!;

/** The Nether the next card carries: the first since the deal is free, each later one `cardExtraFee` more. */
export const cardFee = (s: Readonly<GameState>): number => s.god.played * BALANCE.cardExtraFee;
/** An open slot of a deal is an act of evil with this chance: 0.3 at Malice 0, 0.7 at 100. */
export const evilShare = (s: Readonly<GameState>): number => Math.min(1, Math.max(0, BALANCE.offerEvilBase + BALANCE.offerEvilPerMalice * s.god.malice));
/** A miracle's price in crystal worth: base × the stage's tier, rounded (spec). */
export const cardCost = (s: Readonly<GameState>, id: CardId): number => miracleCost(def(id).cost ?? 0, STAGE_TIER[s.stage]);

/** The Malice an act of evil draws its strength from: 1, then 1.15, 1.3, 1.5 as it rises. */
export function evilBonus(malice: number): number {
  let m = 1;
  for (const st of BALANCE.evilBonusSteps) if (malice >= st.at) m = st.mult;
  return m;
}

/** Faith (spec): the praying followers' Devotion values over N^0.15. */
export function faithOf(s: Readonly<GameState>): number {
  const e: { devotion: number; headcount: number }[] = [];
  followers(s, (p) => { if (p.routine === 'pray' || p.routine === null) e.push({ devotion: p.stats.devotion, headcount: 1 }); });
  return faith(e);
}
/** Miracle power: the spec's Faith power, ×`satedPowerMult` while sated, × (1 + Miracle power lines). */
export function cardPower(s: Readonly<GameState>): number {
  const p = miraclePower(faithOf(s)) * (s.god.hunger < BALANCE.satedBelow ? BALANCE.satedPowerMult : 1);
  return round1(p * (1 + bonus(s, 'miraclePower')) * 100) / 100;
}



function areaOk(s: Readonly<GameState>, fl: Flock, a: PlaceId, kind: CardArea | undefined): boolean {
  if (visibility(s, a) === 'void') return false;
  const d = AREAS[a]!;
  switch (kind) {
    case 'face': return d.region === 'mine' && d.vein > 0;
    case 'seen': return !d.anchored && hold(s, a) < 100;
    case 'followers': return fl.at.has(a);
    case 'people': return placeInReach(s, fl, a) && peopleIn(s, a, stranger).length > 0;
    case 'shrine': return d.flame && !s.places[a]!.desecrated;
    case 'home': return everyone(s).some((p) => here(p) && stranger(p) && area(p.home) === a && AREAS[area(p.work)]!.vein > 0);
    // A crowd: enough strangers, as the day fills or empties the place (a market, a procession, the rain).
    case 'groups': return peopleIn(s, a, stranger).length * door(s, 'crowd', a) >= TOWN.crowdAt;
    default: return true;
  }
}

function unitOk(s: Readonly<GameState>, fl: Flock, p: Person, id: CardId): boolean {
  const d = def(id);
  if (!here(p)) return false;
  if (d.target === 'follower') return p.follower;
  if (id === 'devour' && p.follower) return true;
  if (p.follower) return false;
  if (d.elite) return standingOf(p) === 'elite' && standingRank('elite') <= standingRank(STAGE_MAX_STANDING[s.stage]) && placeInReach(s, fl, whereNow(p, s.tick));
  return standingOf(p) === 'mortal' && inReach(s, fl, p);
}

/** A card may be aimed at this person or area id now. */
function targetOk(s: Readonly<GameState>, fl: Flock, id: CardId, t: string): boolean {
  const d = def(id);
  if (d.target === 'area') return Object.hasOwn(AREAS, t) && areaOk(s, fl, t, d.area);
  return Object.hasOwn(s.people, t) && unitOk(s, fl, s.people[t]!, id);
}

/** Every legal target of a card: person or area ids; [] for a card aimed at nothing. */
export function cardTargets(s: Readonly<GameState>, fl: Flock, id: CardId): string[] {
  const d = def(id);
  if (d.target === 'none') return [];
  return Object.keys(d.target === 'area' ? AREAS : s.people).filter((t) => targetOk(s, fl, id, t));
}

/** A card can be played now: it is aimed at nothing, or something takes it (the first found answers). */
function playable(s: Readonly<GameState>, fl: Flock, id: CardId): boolean {
  const d = def(id);
  if (d.target === 'none') return true;
  for (const t in d.target === 'area' ? AREAS : s.people) if (targetOk(s, fl, id, t)) return true;
  return false;
}

/** In the pool tonight: rank, stage, a shrine left to foul, an announced move to answer. */
export function inPool(s: Readonly<GameState>, id: CardId): boolean {
  const d = def(id);
  if (d.minLevel > s.god.level || (d.shadeOnly && s.stage !== 'shade')) return false;
  if (id === 'desecrate' && !Object.keys(AREAS).some((a) => AREAS[a]!.flame && !s.places[a]!.desecrated)) return false;
  if (d.answers && !s.threats.some((t) => t.faction === d.answers)) return false;
  return true;
}


/**
 * A deal: the acts that answer an announced move lead; then the sure miracles and acts of evil the set stones and
 * blessings add, and the stage's open slots (evil with `evilShare`). Never a card held, never twice; a card with a
 * target now before one without; on a reroll, not the cards just thrown back while others remain.
 */
export function dealCards(s: GameState, thrown: readonly CardId[] = []): CardId[] {
  const g = s.god;
  const out: CardId[] = [];
  const fl = flockOf(s);
  const free = (id: CardId): boolean => inPool(s, id) && !g.hand.includes(id) && !out.includes(id);
  // asked once a card a deal: nothing a pick does changes who or what a card could take
  const can = new Map<CardId, boolean>();
  const aimed = (id: CardId): boolean => can.get(id) ?? (can.set(id, playable(s, fl, id)), can.get(id)!);
  for (const id of IDS) if (def(id).answers && free(id)) out.push(id);
  const pickOf = (kind: CardKind): CardId | undefined => {
    const pool = IDS.filter((id) => def(id).kind === kind && free(id));
    for (const tier of [pool.filter((id) => aimed(id) && !thrown.includes(id)), pool.filter((id) => !thrown.includes(id)), pool]) {
      if (tier.length > 0) return weightedPick(s.rng, tier, (id) => def(id).weight);
    }
    return undefined;
  };
  const kinds: CardKind[] = [];
  for (let i = 0; i < bonus(s, 'dealMiracles'); i++) kinds.push('miracle');
  for (let i = 0; i < bonus(s, 'dealEvils'); i++) kinds.push('evil');
  const slots = STAGE_DRAW[s.stage];
  for (let i = 0; i < slots; i++) kinds.push(chance(s.rng, evilShare(s)) ? 'evil' : 'miracle');
  const size = kinds.length;
  for (const kind of kinds) {
    if (out.length >= size) break;
    const id = pickOf(kind) ?? pickOf(kind === 'miracle' ? 'evil' : 'miracle');
    if (id) out.push(id);
  }
  return out.slice(0, size);
}

/** Dusk: nothing played since, the rerolls back, the cards on the table. */
export function deal(c: Ctx): void {
  const g = c.s.god;
  g.played = 0;
  g.rerolls = bonus(c.s, 'rerolls');
  g.deal = dealCards(c.s);
  ev(c, { kind: 'deal', cards: g.deal.slice() });
}

export function takeWhy(s: Readonly<GameState>, card: CardId | null): Reason[] {
  const g = s.god;
  if (!g.deal) return [{ key: 'why.noDeal' }];
  if (card === null) return s.phase === 'bonus' ? [{ key: 'why.pickOne' }] : [];
  if (!g.deal.includes(card)) return [{ key: 'why.notDealt' }];
  return g.hand.length >= handMax(s) ? [{ key: 'why.handFull' }] : [];
}
/** One card of the deal into the hand, or none; the rest go back. The opening's take begins the run. */
export function take(c: Ctx, card: CardId | null): void {
  const g = c.s.god;
  g.deal = null;
  if (card) g.hand.push(card);
  ev(c, { kind: 'took', card });
}

export const discardWhy = (s: Readonly<GameState>, card: CardId): Reason[] => (s.god.hand.includes(card) ? [] : [{ key: 'why.notHeld' }]);
export function discard(c: Ctx, card: CardId): void {
  c.s.god.hand.splice(c.s.god.hand.indexOf(card), 1);
  ev(c, { kind: 'discarded', card });
}

export const rerollWhy = (s: Readonly<GameState>): Reason[] =>
  !s.god.deal ? [{ key: 'why.noDeal' }] : s.god.rerolls <= 0 ? [{ key: 'why.noRerolls' }] : [];
export function reroll(c: Ctx): void {
  const g = c.s.god;
  const thrown = g.deal!;
  g.rerolls -= 1;
  g.deal = dealCards(c.s, thrown);
  ev(c, { kind: 'deal', cards: g.deal.slice() });
}


/** What the stones offered count for a miracle (own nature half again), and the Ichor Blood Price adds (null: short). */
export function payment(s: Readonly<GameState>, id: CardId, pay: readonly string[]): { worth: number; ichor: number | null } {
  let worth = 0;
  for (const x of pay) worth += burnWorth(s.crystals[x]!, def(id).nature ?? null);
  const short = cardCost(s, id) - worth;
  if (short <= 0) return { worth, ichor: 0 };
  if (oddCount(s, 'bloodPrice') === 0) return { worth, ichor: null };
  const n = Math.ceil(short / EFFECT.bloodPriceValuePerIchor);
  return { worth, ichor: s.god.ichor - n >= 1 ? n : null };
}

export function playWhy(s: Readonly<GameState>, fl: Flock, id: CardId, pay: readonly string[], target: string | undefined): Reason[] {
  if (!s.god.hand.includes(id)) return [{ key: 'why.notHeld' }];
  const d = def(id);
  if (d.target === 'none' ? target !== undefined : target === undefined || !targetOk(s, fl, id, target)) return [{ key: 'why.target' }];
  if (d.kind === 'evil') return pay.length > 0 ? [{ key: 'why.evilUnpaid' }] : [];
  if (new Set(pay).size !== pay.length || pay.some((x) => !s.crystals[x] || !('pouch' in s.crystals[x]!.at))) return [{ key: 'why.notInPouch' }];
  return payment(s, id, pay).ichor === null ? [{ key: 'why.cost', slots: { n: cardCost(s, id) } }] : [];
}

/** Where a god's card lands, for its event: the person or the area it is aimed at. */
const aimed = (id: CardId, t: string | undefined): { unit?: UnitId; place?: PlaceId } =>
  t === undefined ? {} : def(id).target === 'area' ? { place: t } : { unit: t };

/** Play a card from the hand (its why is empty, its fee paid): the stones burnt, then what it does. */
export function play(c: Ctx, id: CardId, pay: readonly string[], target: string | undefined): void {
  const s = c.s;
  const g = s.god;
  g.played += 1;
  g.hand.splice(g.hand.indexOf(id), 1);
  if (def(id).kind === 'evil') {
    ev(c, { kind: 'play', card: id, cardKind: 'evil', by: 'god', burnt: [], ...aimed(id, target) });
    evil(c, id, target, { half: false });
    return;
  }
  const { worth, ichor } = payment(s, id, pay);
  for (const x of pay) delete s.crystals[x];
  ev(c, { kind: 'play', card: id, cardKind: 'miracle', by: 'god', burnt: pay.slice(), ...aimed(id, target) });
  gainXp(c, BALANCE.xpPerSoul * worth);
  if (ichor) loseIchor(c, ichor, 'bloodPrice');
  if (s.phase === 'live' || s.phase === 'bonus') miracle(c, id, target);
}

const resist = (p: Person, d: number): void => { p.resistance = round1(Math.max(-60, p.resistance + d)); };
const untilDusk = (s: Readonly<GameState>): number => nextAt(s.tick, AT.dusk);

function miracle(c: Ctx, id: CardId, target: string | undefined): void {
  const s = c.s;
  const g = s.god;
  const P = cardPower(s);
  const p = target ? s.people[target] : undefined;
  const a = target && !p ? target : undefined;
  switch (id) {
    case 'dreamDirective':
      gainDevotion(c, p!, CARD.dreamDevotion * P);
      addEffect(s, 'sure', p!.id, untilDusk(s));
      addEffect(s, 'dream', p!.id, untilShiftEnd(s));
      break;
    case 'blessTheirBodies':
      for (const f of peopleIn(s, a!, (x) => x.follower)) {
        gainDevotion(c, f, CARD.blessDevotion * P);
        addEffect(s, 'blessed', f.id, s.tick + CARD.blessDays * DAY_TICKS);
      }
      break;
    case 'veinSight': addEffect(s, 'veinSight', a, untilShiftEnd(s)); break;
    case 'crystalBloom': addEffect(s, 'bloom', a, untilShiftEnd(s)); break;
    case 'soothingMurmur': heatAll(c, -round1(CARD.soothe * P), 'soothed'); break;
    case 'nightTerror': resist(p!, CARD.terrorResistance * P); break;
    case 'borrowedTongue': g.free += 1; g.boost += CARD.tongueOdds; break;
    case 'blackDew':
      addEffect(s, 'snuffed', a, s.tick + CARD.dewDays * DAY_TICKS);
      setHold(c, a!, s.places[a!]!.hold + CARD.dewHold);
      break;
    case 'marrowFeast': addHunger(c, -CARD.marrowHunger * P); gainIchor(c, 1); break;
    case 'creepingDark': setHold(c, a!, s.places[a!]!.hold + CARD.creepHold * P); break;
    case 'blindEye': addEffect(s, 'blindEye', undefined, untilShiftEnd(s)); break;
    case 'divertedCart': addEffect(s, 'divert', a, untilShiftEnd(s)); break;
    case 'quickening': g.ap += CARD.quickenAp; break;
    case 'mend': gainIchor(c, CARD.mendIchor); break;
    case 'theCalling':
      for (const x of peopleIn(s, a!, (q) => stranger(q) && standingOf(q) === 'mortal')) {
        whisper(c, [x], dayOf(s.tick), Math.max(0.05, Math.min(0.95, whisperOdds(s, flockOf(s), x) * CARD.callingOddsMult)));
        if (s.phase !== 'live') break;
      }
      break;
    case 'sermonOfAsh': for (const x of peopleIn(s, a!, stranger)) resist(x, CARD.sermonResistance * P); break;
    case 'gildedTongue': addEffect(s, 'gilded', undefined, untilDusk(s)); g.free += 1; break;
  }
}

/**
 * An act of evil. `by`: a follower acting on their own (an Echo's heat twice); `half`: a follower's own act sates
 * half and teaches nothing; `quiet`: no heat (Hush); `noXp`: Malice breaking loose teaches nothing.
 */
export function evil(c: Ctx, id: CardId, target: string | undefined, o: { by?: Person; half: boolean; quiet?: boolean; noXp?: boolean }): void {
  const s = c.s;
  const d = def(id);
  const p = target ? s.people[target] : undefined;
  const a = target && !p ? target : undefined;
  const b = o.by || !d.bonus ? 1 : evilBonus(s.god.malice);
  let hunger = (d.hunger ?? 0) * b;
  switch (id) {
    case 'devour': {
      const own = p!.follower;
      hunger = (own ? CARD.devourFollowerHunger : d.hunger!) * b * (oddCount(s, 'feast') > 0 ? EFFECT.feastMult : 1);
      remove(c, p!, 'devoured', (own ? CARD.devourFollowerSoulLuck : CARD.devourSoulLuck) * b);
      if (oddCount(s, 'feast') > 0) gainIchor(c, 1);
      ev(c, { kind: 'devour', unit: p!.id });
      break;
    }
    case 'terrorize': for (const x of peopleIn(s, a!, stranger)) resist(x, CARD.terrorizeResistance * b); break;
    case 'sabotage': addEffect(s, 'sabotage', a, untilShiftEnd(s), undefined, b); break;
    case 'desecrate': s.places[a!]!.desecrated = true; break;
    case 'sacrifice':
      addNether(c, round1(CARD.sacrificeNetherPerV * devotionValue(p!.stats.devotion) * b));
      remove(c, p!, 'dead');
      break;
    case 'frame': remove(c, p!, 'taken'); addHeat(c, 'council', CARD.frameCouncil, 'thiefCaught'); break;
    case 'caveIn': {
      const victims = everyone(s).filter((x) => here(x) && stranger(x) && area(x.work) === a).slice(0, CARD.caveInKills[1]);
      const n = Math.min(victims.length, chance(s.rng, 0.5) ? CARD.caveInKills[1]! : CARD.caveInKills[0]!);
      for (const v of victims.slice(0, n)) remove(c, v, 'dead');
      break;
    }
    case 'badWater':
      for (const x of everyone(s)) if (here(x) && stranger(x) && area(x.home) === a) addEffect(s, 'sick', x.id, s.tick + Math.round(b) * DAY_TICKS);
      break;
    case 'robTheCart': addEffect(s, 'rob', a, untilShiftEnd(s), o.by?.id, b); break;
    case 'madness': remove(c, p!, 'taken'); addEffect(s, 'noSearch', undefined, untilShiftEnd(s)); break;
    case 'bloodRite': followers(s, (f) => loseDevotion(c, f, CARD.bloodRiteDevotion)); break;
    case 'burnTheLedgers':
      bluntAll(c, 'council');
      tearWrit(c, 1, 'evil');
      break;
    case 'riot': {
      const crowd = peopleIn(s, a!, stranger);
      const n = crowd.length ? Math.max(1, Math.round(crowd.length * Math.min(1, CARD.riotThin * b))) : 0;
      for (let i = 0; i < n && s.phase === 'live'; i++) {
        const v = pick(s.rng, crowd.filter(here));
        if (v) remove(c, v, 'dead');
      }
      addEffect(s, 'noSearch', undefined, untilShiftEnd(s));
      break;
    }
    case 'assassinate': {
      remove(c, p!, 'burned');
      mint(c, { luck: CARD.assassinateLuck * b, floor: 2 });
      break;
    }
    default:
      if (d.answers) bluntAll(c, d.answers);
  }
  if (s.phase !== 'live') return;
  profane(c, a ? area(a) : p ? area(whereNow(p, s.tick)) : 'grave');
  const relief = o.half ? d.malice! / 2 : d.malice! * bonus(s, 'maliceMult');
  const before = s.god.malice;
  addMalice(c, -relief);
  if (hunger > 0) addHunger(c, -(o.half ? hunger / 2 : hunger));
  if (!o.quiet) for (const h of d.heat ?? []) addHeat(c, h.faction, round1(h.amount), 'evil');
  if (!o.half && !o.noXp) gainXp(c, round1((before - s.god.malice) / BALANCE.xpEvilDivisor));
}

/**
 * Evil done where hallowed Flame stones lie (the grave's sockets and pouch, or the pockets of those in the area)
 * profanes them: no more price, no more quarrel; the Temple feels each, `PROFANE.heat` a stone up to `heatCap`.
 */
function profane(c: Ctx, at: PlaceId): void {
  const s = c.s;
  let n = 0;
  for (const id in s.crystals) {
    const x = s.crystals[id]!;
    if (x.affinity !== 'flame' || x.profaned) continue;
    const w = x.at;
    const there = at === 'grave' ? 'pouch' in w || 'socket' in w : 'pocket' in w && here(s.people[w.pocket]!) && area(whereNow(s.people[w.pocket]!, s.tick)) === at;
    if (!there) continue;
    x.profaned = true;
    n++;
  }
  if (n === 0) return;
  ev(c, { kind: 'story', story: 'profane', place: at, note: { key: n > 1 ? 'profane.many' : 'profane.one', slots: { n, where: uiText(`area.${at}.name`) } } });
  addHeat(c, 'temple', Math.min(PROFANE.heatCap, n * PROFANE.heat), 'profaned');
}


/** The target a follower's own act takes: someone beside them, their face, their home, the people where they stand. */
function ownTarget(s: Readonly<GameState>, f: Person, id: CardId): string | null | undefined {
  const d = def(id);
  const at = area(whereNow(f, s.tick));
  if (d.target === 'none') return null;
  if (d.target === 'unit') return peopleIn(s, at, (x) => stranger(x) && standingOf(x) === 'mortal')[0]?.id;
  if (d.area === 'face') return AREAS[area(f.work)]!.vein > 0 ? area(f.work) : undefined;
  if (d.area === 'home') return area(f.home);
  if (d.area === 'people') return peopleIn(s, at, stranger).length > 0 ? at : undefined;
  return undefined;
}

/** Dawn: with Malice high, a follower may do evil of their own (min(0.4, Malice/200)): half the sating, no lesson. */
export function followersEvil(c: Ctx): void {
  const s = c.s;
  const p = Math.min(BALANCE.followerEvilMax, s.god.malice * BALANCE.followerEvilPerMalice);
  if (p <= 0 || !chance(s.rng, p)) return;
  const pool: Person[] = [];
  followers(s, (f) => { if (f.routine !== 'lieLow') pool.push(f); });
  const f = pick(s.rng, pool);
  if (!f) return;
  const card = pick(s.rng, IDS.filter((id) => def(id).followerAct && (!def(id).shadeOnly || s.stage === 'shade') && ownTarget(s, f, id) !== undefined));
  if (!card) return;
  ev(c, { kind: 'play', card, cardKind: 'evil', by: 'follower', burnt: [], unit: f.id });
  evil(c, card, ownTarget(s, f, card) ?? undefined, { by: f, half: true, quiet: oddCount(s, 'hush') > 0 });
}

/** Malice at 100: an act of evil from the pool plays itself on a target it can take; it teaches nothing. */
export function lashOut(c: Ctx): void {
  const s = c.s;
  const fl = flockOf(s);
  const card = pick(s.rng, IDS.filter((id) => def(id).kind === 'evil' && !def(id).answers && inPool(s, id) && playable(s, fl, id)));
  if (!card) return;
  const target = def(card).target === 'none' ? undefined : pick(s.rng, cardTargets(s, fl, card));
  ev(c, { kind: 'lashOut' });
  ev(c, { kind: 'play', card, cardKind: 'evil', by: 'god', burnt: [], ...aimed(card, target) });
  evil(c, card, target, { half: false, noXp: true });
}
