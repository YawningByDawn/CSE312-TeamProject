/**
 * The mine's day (spec §6; inventory #24, 26, 27): strikes through the shift, the Deep dug toward, the count at
 * shift end and the searches it brings, the tribute and the offering at dusk, the grave's seep.
 */
import { BALANCE } from '../content/balance';
import { AT, DAY_TICKS, dayOf, tod } from '../content/clock';
import { EFFECT, GRADE_VALUE, GRADES } from '../content/crystals';
import { CARD } from '../content/cards';
import { ITEM } from '../content/items';
import { ROLES } from '../content/roles';
import { STAGES } from '../content/stages';
import { DEEP } from '../content/world';
import {
  addEffect, addHeat, area, areaDef, asleep, cash, digs, door, ev, everyone, followers, gainCrystal, has, here, inMine, mint, nbrs, pocketTo, remove,
  untilShiftEnd, whereNow, type Ctx,
} from './core';
import { bonus } from './bonus';
import { newCrystal, oddCount, rollGrade, tierOf } from './crystals';
import { round1 } from './formulas';
import { worn } from './items';
import { chance, rand } from './rng';
import { evidence } from './town';
import { calendarOf, liftRuns } from './world';
import { idKey } from './world/draw';
import type { GameState, Person, PlaceId } from '../types';

/** A face's depth for the roll: the Deep counts as the lower workings until it is opened. */
export function workDepth(s: Readonly<GameState>, at: PlaceId): number {
  const d = areaDef(at).depth || 1;
  return area(at) === DEEP && s.stage === 'whisper' && !s.flags.deepOpen ? BALANCE.sealedDepth : d;
}

const sick = (s: Readonly<GameState>, p: Readonly<Person>): boolean => !!has(s, 'sick', p.id);
/** Watches for the Council: a guard, an overseer, a soldier, a captain. */
export const councilEye = (p: Readonly<Person>): boolean => ROLES[p.role]!.watches && ROLES[p.role]!.serves === 'council';
const face = (s: Readonly<GameState>, at: PlaceId): number => 1 + (s.places[area(at)]?.seam ?? 0) * BALANCE.seamBonus;

/** One swing's chance to free a stone. */
export function strikeChance(s: Readonly<GameState>, p: Readonly<Person>): number {
  let q = BALANCE.strikeChance * face(s, p.work) * (1 + (p.stats.strength - 50) / BALANCE.strengthSpan) * door(s, 'strike', p.work);
  if (p.follower) {
    q *= BALANCE.followerStrike * (1 + bonus(s, 'strikeRate') + worn(s, p, 'strikeRate') / 100);
    if (has(s, 'blessed', p.id)) q *= 1 + CARD.blessStrike;
    if (has(s, 'dream', p.id)) q *= 2;
  }
  return Math.min(0.95, q);
}

/** Each tick of the shift: a digger at their face swings `strikeRolls` times a day (more under Crystal Bloom), spread over the shift. */
export function shiftTick(c: Ctx): void {
  const s = c.s;
  const k = tod(s.tick) - AT.shift;
  const span = AT.shiftEnd - AT.shift;
  for (const p of everyone(s)) {
    if (!here(p) || !digs(p) || sick(s, p) || p.routine === 'delve' || whereNow(p, s.tick) !== p.work) continue;
    const rolls = BALANCE.strikeRolls + (has(s, 'bloom', p.work) ? CARD.bloomRolls : 0);
    const h = idKey(p.id) / 4294967296;
    for (let r = 0; r < rolls; r++) if (Math.floor(((r + h) / rolls) * span) === k) swing(c, p);
  }
}

function swing(c: Ctx, p: Person): void {
  const s = c.s;
  if (!has(s, 'sabotage', p.work)) s.mine.expected += BALANCE.strikeChance * BALANCE.rarityMean * BALANCE.councilExpect;
  if (!chance(s.rng, strikeChance(s, p))) return;
  const depth = workDepth(s, p.work);
  if (p.follower && p.routine !== 'lieLow') {
    const luck = bonus(s, 'strikeLuck') + worn(s, p, 'strikeLuck') + (has(s, 'veinSight', p.work) ? CARD.veinSightLuck : 0);
    let floor = 0;
    if (oddCount(s, 'lodestone') > 0 && !has(s, 'used', 'lodestone')) {
      floor = EFFECT.lodestoneTier;
      addEffect(s, 'used', 'lodestone', untilShiftEnd(s));
    }
    const x = newCrystal(s, { pocket: p.id }, { depth, luck, floor });
    p.pocket.push(x.id);
    ev(c, { kind: 'strike', unit: p.id, place: p.work, crystal: x.id, grade: x.grade, oneIn: x.oneIn });
    if (chance(s.rng, EFFECT.twinChance * oddCount(s, 'twinning'))) {
      const twin = newCrystal(s, { pocket: p.id }, { depth, tier: Math.max(0, tierOf(x.grade) - 1) });
      p.pocket.push(twin.id);
      ev(c, { kind: 'strike', unit: p.id, place: p.work, crystal: twin.id, grade: twin.grade, oneIn: twin.oneIn });
    }
    return;
  }
  const g = rollGrade(s.rng, 0, 0, depth);
  (s.mine.carts[p.work] ??= []).push(g);
  ev(c, { kind: 'strike', unit: p.id, place: p.work, crystal: null, grade: GRADES[g]!, oneIn: 1 });
}

// ---------- shift end: the Deep, the skim, the carts, the count, the searches ----------

export function shiftEnd(c: Ctx): void {
  delve(c);
  handIn(c);
  skim(c);
  carts(c);
  // The count and the searches are at the lift while the god is in the mine (in the town they are the tithe's): a
  // stopped lift (a storm, lightning on the gear) brings nobody up to them.
  if (c.s.stage === 'whisper' && liftRuns(c.s)) {
    count(c);
    searches(c);
  }
  clearCarts(c);
}

function clearCarts(c: Ctx): void {
  c.s.mine.carts = {};
  c.s.mine.expected = 0;
}

/** Each delver's day digs toward the Deep (and may hurt them); the last one opens it. */
function delve(c: Ctx): void {
  const s = c.s;
  if (s.flags.deepOpen) return;
  const delvers: Person[] = [];
  followers(s, (p) => { if (p.routine === 'delve' && digs(p) && !sick(s, p)) delvers.push(p); });
  for (const p of delvers) {
    s.mine.delve += 1;
    if (chance(s.rng, BALANCE.delveHurt)) addEffect(s, 'sick', p.id, s.tick + 2 * DAY_TICKS);
  }
  if (s.mine.delve < BALANCE.delveDays) return;
  s.flags.deepOpen = true;
  ev(c, { kind: 'deepOpen', place: DEEP });
  followers(s, (p) => { if (p.routine === 'delve') p.routine = 'pray'; });
}

/** Lying low, a miner hands their stones in at the cart: they are counted, and gone. */
function handIn(c: Ctx): void {
  const s = c.s;
  followers(s, (p) => {
    if (p.routine !== 'lieLow' || !inMine(p.work) || p.pocket.length === 0) return;
    const cart = (s.mine.carts[area(p.work)] ??= []);
    for (const id of p.pocket) {
      cart.push(tierOf(s.crystals[id]!.grade));
      delete s.crystals[id];
    }
    p.pocket.length = 0;
  });
}

/** A skimming hauler or sorter lifts a stone from a cart before the count (Magpie: twice as often). */
function skim(c: Ctx): void {
  const s = c.s;
  const taken = new Map<PlaceId, number>();
  const q = BALANCE.skimChance * (oddCount(s, 'magpie') > 0 ? EFFECT.magpieMult : 1);
  followers(s, (p) => {
    const at = area(p.work);
    if (p.routine !== 'skim' || (taken.get(at) ?? 0) >= STAGES[s.stage].skimCap || !chance(s.rng, q)) return;
    const from = s.mine.carts[at]?.length ? at : Object.keys(s.mine.carts).sort().find((z) => s.mine.carts[z]!.length > 0);
    if (!from) return;
    const g = s.mine.carts[from]!.shift()!;
    const x = newCrystal(s, { pocket: p.id }, { tier: g, depth: workDepth(s, from) });
    p.pocket.push(x.id);
    taken.set(at, (taken.get(at) ?? 0) + 1);
    ev(c, { kind: 'pocket', unit: p.id, place: from, crystal: x.id });
  });
}

/** Diverted, robbed or sabotaged carts give their share to the grave (or the robber) on the way to the lift. */
function carts(c: Ctx): void {
  const s = c.s;
  for (const at of Object.keys(s.mine.carts).sort()) {
    const cart = s.mine.carts[at]!;
    const divert = has(s, 'divert', at);
    const rob = has(s, 'rob', at) ?? has(s, 'sabotage', at);
    if (!divert && !rob) continue;
    cart.sort((a, b) => b - a);
    const k = divert ? cart.length : Math.min(cart.length, Math.ceil(cart.length * CARD.robShare * (rob!.value ?? 1)));
    const mine: number[] = [];
    for (let i = 0; i < cart.length && mine.length < k; i += 2) mine.push(i);
    for (let i = 1; i < cart.length && mine.length < k; i += 2) mine.push(i);
    const thief = (divert ?? rob)!.by ? s.people[(divert ?? rob)!.by!] : undefined;
    for (const i of mine) {
      const x = newCrystal(s, { pouch: true }, { tier: cart[i]!, depth: workDepth(s, at) });
      if (thief && here(thief)) pocketTo(s, thief, x.id);
      else gainCrystal(c, x.id);
      ev(c, { kind: 'cart', place: at, crystal: x.id });
    }
    s.mine.carts[at] = cart.filter((_, i) => !mine.includes(i));
  }
}

/**
 * What a count forgives: a share of what is expected plus a floor (×`overseerTolerance` when its keeper is yours: the
 * overseer at the lift, the tally house in the town), Heavy Heart and every false weight a follower wears.
 */
export function tolerance(s: Readonly<GameState>, expected: number, kept: boolean, at: PlaceId): number {
  let weights = 0;
  followers(s, (p) => { weights += worn(s, p, 'falseWeights'); });
  const base = (BALANCE.tallyTolerance * expected + BALANCE.tallyFloor) * (kept ? BALANCE.overseerTolerance : 1);
  return round1((base + bonus(s, 'tolerance') + weights) * door(s, 'countTolerance', at));
}

/** The count at the lift: what came up against what the Council expects. */
function count(c: Ctx): void {
  const s = c.s;
  if (!calendarOf(dayOf(s.tick)).count) return;
  const expected = round1(s.mine.expected);
  let counted = 0;
  for (const at in s.mine.carts) if (!has(s, 'sabotage', at)) for (const g of s.mine.carts[at]!) counted += GRADE_VALUE[GRADES[g]!];
  let overseer = false;
  followers(s, (p) => { if (p.role === 'overseer') overseer = true; });
  reckon(c, 'lift', round1(Math.max(0, expected - counted)), tolerance(s, expected, overseer, 'lift'));
}

/** A count `short` against its tolerance: badly short, the Council's heat and a short day (searches likelier). */
export function reckon(c: Ctx, at: PlaceId, short: number, tol: number): void {
  const s = c.s;
  const heat = has(s, 'blindEye') || short <= tol ? 0 : round1(Math.min(BALANCE.tallyHeatCap, (short - tol) * BALANCE.tallyHeatPerValue));
  ev(c, { kind: 'count', place: at, short, forgiven: heat === 0 });
  if (heat > 0) {
    addHeat(c, 'council', heat, 'countShort');
    s.mine.shortDays += 1;
  } else s.mine.shortDays = Math.max(0, s.mine.shortDays - 1);
}

export function searchDayChance(s: Readonly<GameState>): number {
  if (has(s, 'blindEye') || has(s, 'noSearch')) return 0;
  return Math.min(BALANCE.searchMax, s.mine.shortDays * BALANCE.searchPerShortDay + s.factions.council.suspicion * BALANCE.searchPerCouncil);
}

/**
 * One carrier's chance to be searched where the search is (`on`, and `also` for its doors): none lying low, carrying
 * nothing, or where the guards look away; half with a guard of yours there; less for the cunning and the guard-blind.
 */
export function searchEachChance(s: Readonly<GameState>, p: Readonly<Person>, guard: boolean, on: PlaceId, also: PlaceId = on): number {
  if (p.routine === 'lieLow' || (p.pocket.length === 0 && p.worn.length === 0) || has(s, 'lookAway', area(on))) return 0;
  const blind = 1 - Math.min(ITEM.blindMax, worn(s, p, 'guardBlind') / 100);
  return Math.min(0.95, BALANCE.searchEach * bonus(s, 'searchMult') * (guard ? 0.5 : 1) * blind * (1 - p.stats.cunning / 300) * door(s, 'search', on, also));
}

/** Searches at the lift: a stash found is lost and the follower marked; caught twice, they are taken. */
function searches(c: Ctx): void {
  const s = c.s;
  if (!chance(s.rng, searchDayChance(s))) return;
  const met: Person[] = [];
  let guard = false;
  followers(s, (p) => {
    if (inMine(p.work)) met.push(p);
    if (councilEye(p) && inMine(p.work) && areaDef(p.work).watched) guard = true;
  });
  for (const p of met) if (chance(s.rng, searchEachChance(s, p, guard, 'lift', p.work))) searchOne(c, p);
}

export function searchOne(c: Ctx, p: Person): void {
  const s = c.s;
  let value = 0;
  // a second, hidden pocket: the search finds only half
  const found = p.pocket.splice(0, worn(s, p, 'secondPocket') > 0 ? Math.ceil(p.pocket.length / 2) : p.pocket.length);
  for (const id of found) value += GRADE_VALUE[s.crystals[id]!.grade];
  for (const id of found) delete s.crystals[id];
  p.caught += 1;
  ev(c, { kind: 'search', unit: p.id, place: whereNow(p, s.tick), found });
  if (value > 0) addHeat(c, 'council', round1(value * BALANCE.searchHeatPerValue), 'caughtWithStones');
  if (p.worn.length > 0) evidence(c, p);
  else if (p.caught >= BALANCE.caughtTaken) remove(c, p, 'taken');
}

// ---------- dusk: tribute, offering, the grave's seep ----------

export const tributeChance = (s: Readonly<GameState>, p: Readonly<Person>): number =>
  Math.min(BALANCE.tributeMax, BALANCE.tributeBase + p.stats.devotion / BALANCE.tributePerDevotion) + bonus(s, 'tributeOdds');

export function duskStones(c: Ctx): void {
  const s = c.s;
  const extra = bonus(s, 'offerExtra');
  const offering: Person[] = [];
  followers(s, (p) => {
    if (p.routine === 'pray' && p.pocket.length > 0 && chance(s.rng, tributeChance(s, p))) cash(c, p, p.pocket[0]!, 'tribute');
    if (p.routine === 'offer') offering.push(p);
  });
  for (const p of offering) {
    for (let i = 0; i < extra; i++) p.pocket.push(newCrystal(s, { pocket: p.id }, { tier: 0 }).id);
    if (p.pocket.length === 0) continue;
    spotted(c, p);
    for (const id of p.pocket.slice()) cash(c, p, id, 'offer');
  }
  const seep = dayOf(s.tick) > 1 ? BALANCE.graveSeep + bonus(s, 'seep') : 0;
  for (let i = 0; i < seep; i++) ev(c, { kind: 'seep', place: 'grave', crystal: mint(c, { tier: 0 }) });
}

/** An offering walked to the grave past an awake watcher may be seen (once a walk). */
function spotted(c: Ctx, p: Person): void {
  const s = c.s;
  const at = area(p.work);
  const on = new Set<PlaceId>([at, ...nbrs(s, at)]);
  for (const w of everyone(s)) {
    if (!here(w) || w.follower || asleep(w) || !councilEye(w) || !on.has(area(whereNow(w, s.tick)))) continue;
    if (rand(s.rng) < BALANCE.offerSpot * (1 - p.stats.cunning / 200)) return addHeat(c, 'council', BALANCE.offerSpotHeat, 'offeringSeen');
  }
}
