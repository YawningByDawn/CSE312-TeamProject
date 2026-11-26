/**
 * Colour and voice (spec §2, §8; inventory #17-23): Hold per area creeping at dawn, what is seen, who is in reach,
 * the whisper's odds and price, the routines, the move, and the ties that help.
 */
import { BALANCE, TIES } from '../content/balance';
import { EFFECT } from '../content/crystals';
import { ROLES } from '../content/roles';
import { TRAITS } from '../content/traits';
import { AREAS, DEEP, PLACES } from '../content/world';
import {
  ev, addHeat, area, areaDef, asleep, convert, digs, door, everyone, followers, gainDevotion, has, here, loseDevotion,
  flockCount, most, nbrs, setHold, standingOf, whereNow, type Ctx, type Flock,
} from './core';
import { bonus } from './bonus';
import { act } from './colour';
import { oddCount } from './crystals';
import { uiText } from '../content/text';
import { TIER, conversionOdds, conversionTerms, devotionValue, directCost, influenceCost, round1 } from './formulas';
import { markLeft } from './host';
import { rand } from './rng';
import { haunts, route } from './world';
import type { GameState, Person, PlaceId, Reason, Routine, Visibility } from '../types';

// Hold lives on areas (`s.places` is keyed by area id); every read below takes any place and looks at its area.

export const hold = (s: Readonly<GameState>, p: PlaceId): number => s.places[area(p)]?.hold ?? 0;
export const active = (s: Readonly<GameState>, p: PlaceId): boolean => s.places[area(p)]?.coloured ?? false;

export function visibility(s: Readonly<GameState>, p: PlaceId): Visibility {
  const a = area(p);
  if (active(s, a)) return 'active';
  if (s.places[a]?.explored) return 'sensed';
  for (const n of nbrs(s, a)) if (active(s, n)) return 'sensed';
  return 'void';
}


/** Colour a follower soaks into a place in half a day (lying low: none). */
function stainOf(p: Person, sleeping: boolean): number {
  if (p.routine === 'lieLow') return 0;
  return (BALANCE.holdBase + BALANCE.holdPerV * devotionValue(p.stats.devotion)) * (sleeping ? BALANCE.holdAsleep : 1);
}

const gainBuf = new Map<PlaceId, number>();
const pushBuf = new Map<PlaceId, number>();
const add = (m: Map<PlaceId, number>, p: PlaceId, n: number): void => { m.set(p, (m.get(p) ?? 0) + n); };

/**
 * Dawn: colour creeps from the places of followers' days (the bunks asleep; work and the shrine awake), seeps from
 * coloured neighbours, is pushed back by the Flame and the watch.
 */
export function creep(c: Ctx): void {
  const s = c.s;
  gainBuf.clear();
  pushBuf.clear();
  followers(s, (p) => {
    for (const at of haunts(s.seed, p)) add(gainBuf, area(at), stainOf(p, at === p.home));
  });
  const beacon = oddCount(s, 'beacon');
  const best = beacon > 0 ? most(flockCount(s, (p) => area(p.work))) : null;
  if (best) add(gainBuf, best, EFFECT.beaconHold * beacon);
  for (const p of everyone(s)) {
    if (p.follower || !here(p)) continue;
    const role = ROLES[p.role]!;
    const at = area(p.work);
    if (!role.watches || asleep(p) || has(s, 'snuffed', at)) continue;
    add(pushBuf, at, BALANCE.watcherPush);
    if (role.serves === 'council' && hold(s, at) >= BALANCE.stainNoticeAt) addHeat(c, 'council', BALANCE.stainNoticeGov, 'stainSeen');
  }
  // The day's guards, posted or called away, push like watchers (more or fewer of them).
  for (const id in AREAS) {
    const g = door(s, 'guards', id);
    if (g !== 0 && !has(s, 'snuffed', id)) add(pushBuf, id, g * BALANCE.watcherPush);
  }
  for (const id in AREAS) {
    if (!AREAS[id]!.flame || s.places[id]!.desecrated || has(s, 'snuffed', id)) continue;
    add(pushBuf, id, BALANCE.wardPush);
    for (const n of nbrs(s, id)) add(pushBuf, n, BALANCE.wardPushNear);
  }
  const spread = 1 + bonus(s, 'stain');
  for (const id in s.places) {
    const ps = s.places[id]!;
    if (AREAS[id]!.anchored) continue;
    let seep = 0;
    for (const n of nbrs(s, id)) {
      const nh = hold(s, n);
      if (nh >= BALANCE.seepFrom) seep += (AREAS[n]!.anchored ? BALANCE.graveSeepRate : BALANCE.seepRate) * Math.max(0, nh - ps.hold - BALANCE.seepGap);
    }
    const gain = (gainBuf.get(id) ?? 0) * spread + Math.min(BALANCE.seepCap, seep);
    let delta = gain - (pushBuf.get(id) ?? 0);
    if (gain === 0 && !ps.rooted && !gainBuf.has(id)) delta -= BALANCE.holdFade;
    setHold(c, id, ps.hold + delta);
  }
}


export function placeInReach(s: Readonly<GameState>, fl: Flock, p: PlaceId): boolean {
  const a = area(p);
  if (active(s, a)) return true;
  // A day that carries whispers (the wind, the bells in it) reaches one area further.
  const far = door(s, 'reach', a) >= 1;
  for (const n of nbrs(s, a)) {
    if (active(s, n)) return true;
    if (far) for (const m of nbrs(s, n)) if (active(s, m)) return true;
  }
  return fl.at.has(a);
}

/** A person you can whisper to now: a mortal on or beside your colour, tied to a follower, or in your followers' reach. */
export function inReach(s: Readonly<GameState>, fl: Flock, p: Readonly<Person>): boolean {
  if (!here(p) || p.follower || standingOf(p) !== 'mortal') return false;
  if (placeInReach(s, fl, whereNow(p, s.tick))) return true;
  if (!areaDef(p.work).sealable && placeInReach(s, fl, p.work)) return true;
  return tiedFollower(s, p) !== null;
}

/** The first follower tied to this person, if any. */
function tiedFollower(s: Readonly<GameState>, p: Readonly<Person>): Person | null {
  for (const id of p.ties) {
    const t = s.people[id];
    if (t?.follower && here(t)) return t;
  }
  return null;
}


/** Resistance as the whisper meets it: the person's own, the Temple's vigils, the mine's wariness of a growing flock. */
export function resistance(s: Readonly<GameState>, fl: Flock, p: Readonly<Person>): number {
  const vigil = BALANCE.cultWaryResist * Math.min(3, s.factions.temple.level);
  const wary = BALANCE.warinessPerFollower * Math.max(0, fl.heads - BALANCE.warinessFree);
  return Math.max(0, Math.min(BALANCE.resistanceCap, p.resistance + vigil + wary));
}

/** Signed whole points of odds, as a reason shows them. */
const pct = (v: number): string => `${v < 0 ? '−' : '+'}${Math.abs(Math.round(v * 100))}`;

/**
 * A whisper's odds on `p`, and each term that moves them as a reason (`odds.<term>`, `pct` its signed points): the
 * formula's terms, then each piece of its bonus by name.
 */
export function whisperOddsWhy(s: Readonly<GameState>, fl: Flock, p: Readonly<Person>): { odds: number; why: Reason[] } {
  const at = area(whereNow(p, s.tick));
  const tie = tiedFollower(s, p);
  const pieces: [string, number, Record<string, string>?][] = [
    ['crystals', bonus(s, 'whisperOdds') + s.god.boost],
    ['asleep', asleep(p) ? BALANCE.sleeperBonus + (oddCount(s, 'sleepwalker') > 0 ? EFFECT.sleepwalkerOdds : 0) : 0],
    ['kinship', oddCount(s, 'kinship') > 0 && fl.works.has(p.work) ? EFFECT.kinshipOdds : 0],
    tie ? ['tie', TIES.odds, { name: tie.name }] : ['tie', 0],
    // the day's doors: on them, and the strongest of where they are, work and live
    ['day', door(s, 'whisper', p.id) + Math.max(door(s, 'whisperZone', whereNow(p, s.tick)), door(s, 'whisperZone', p.work), door(s, 'whisperZone', p.home))],
  ];
  let b = 0;
  for (const x of pieces) b += x[1];
  const near = fl.at.get(at) ?? 0;
  const res = resistance(s, fl, p);
  const presence = Math.min(BALANCE.presenceOddsCap, fl.presence);
  const inputs = {
    presence, resistance: res, traitFit: TRAITS[p.trait]!.whisperFit, followersInZone: near,
    publicSuspicion: s.factions.public.suspicion, seething: s.god.malice >= BALANCE.seethingAt, bonus: b, resistDivisor: BALANCE.oddsResistDivisor,
  };
  const t = conversionTerms(inputs);
  const why: Reason[] = [
    { key: 'odds.base', slots: { pct: pct(t.base) } },
    { key: 'odds.presence', slots: { pct: pct(t.presence), n: presence } },
    { key: 'odds.resistance', slots: { pct: pct(t.resistance), n: Math.round(res) } },
  ];
  if (t.trait) why.push({ key: 'odds.trait', slots: { pct: pct(t.trait), trait: uiText(`trait.${p.trait}.name`) } });
  if (t.nearby) why.push({ key: 'odds.nearby', slots: { pct: pct(t.nearby), n: near } });
  if (t.public) why.push({ key: 'odds.public', slots: { pct: pct(t.public) } });
  if (t.seething) why.push({ key: 'odds.seething', slots: { pct: pct(t.seething) } });
  for (const [k, v, slots] of pieces) if (v) why.push({ key: `odds.${k}`, slots: { pct: pct(v), ...slots } });
  return { odds: Math.round(conversionOdds(inputs) * 1000) / 1000, why };
}

export const whisperOdds = (s: Readonly<GameState>, fl: Flock, p: Readonly<Person>): number => whisperOddsWhy(s, fl, p).odds;

export const whisperCost = (s: Readonly<GameState>, fl: Flock, p: Readonly<Person>): number =>
  round1(influenceCost(1, TIER[standingOf(p)], resistance(s, fl, p)));
const flameTouched = (s: Readonly<GameState>, p: Readonly<Person>): boolean =>
  p.trait === 'pious' || ROLES[p.role]!.serves === 'temple' || areaDef(whereNow(p, s.tick)).flame;

export function whisperWhy(s: Readonly<GameState>, fl: Flock, p: Readonly<Person> | undefined, day: number): Reason[] {
  if (!p || !here(p)) return [{ key: 'why.noOne' }];
  if (p.follower) return [{ key: 'why.already' }];
  if (standingOf(p) !== 'mortal') return [{ key: 'why.tooGreat' }];
  if (p.whispered === day) return [{ key: 'why.whisperedToday' }];
  if (markLeft(s, p) === 0) return [{ key: 'why.notMarked' }];
  if (!inReach(s, fl, p)) return [{ key: 'why.outOfReach' }];
  return [];
}

/**
 * One whisper to a person: the price paid, one roll; a turned soul, or a softened one.
 */
export function whisper(c: Ctx, p: Person, day: number, odds: number): boolean {
  const s = c.s;
  p.whispered = day;
  s.tally.whispers += 1;
  const ok = rand(s.rng) < odds;
  ev(c, { kind: 'whisper', unit: p.id, place: whereNow(p, s.tick), ok, odds });
  act(c, whereNow(p, s.tick));
  const touched = flameTouched(s, p);
  if (ok) {
    if (s.phase === 'live') convert(c, p, BALANCE.convertDevotion + (p.trait === 'grieving' ? BALANCE.grievingConvertBonus : 0));
    if (touched) addHeat(c, 'temple', BALANCE.kilnConvertCult, 'flameTurned');
    const at = area(whereNow(p, s.tick));
    if (s.places[at]!.hold < 100) setHold(c, at, s.places[at]!.hold + BALANCE.convertHold);
  } else {
    p.resistance += BALANCE.failedWhisperResistance;
    addHeat(c, 'public', BALANCE.failedWhisperPublic, 'whisperHeard');
    if (touched) addHeat(c, 'temple', BALANCE.kilnFailCult, 'flameHeard');
  }
  return ok;
}

export function routineWhy(s: Readonly<GameState>, p: Readonly<Person> | undefined, r: Routine): Reason[] {
  if (!p || !p.follower || !here(p)) return [{ key: 'why.notYours' }];
  if (p.routine === r) return [{ key: 'why.alreadyDoing' }];
  const lvl = s.god.level;
  switch (r) {
    case 'delve': return lvl < 2 ? [{ key: 'why.rank', slots: { n: 2 } }] : !digs(p) ? [{ key: 'why.notDigger' }] : s.flags.deepOpen ? [{ key: 'why.deepOpen' }] : [];
    case 'skim': return lvl < 3 ? [{ key: 'why.rank', slots: { n: 3 } }] : ROLES[p.role]!.labour !== 'haul' && ROLES[p.role]!.labour !== 'sort' ? [{ key: 'why.notHauler' }] : [];
    default: return [];
  }
}
export const directNether = (p: Readonly<Person>): number => round1(directCost(1, TIER[standingOf(p)]));

/** The places of a person's usual day: home, work and the way between. */
function offPath(s: Readonly<GameState>, p: Readonly<Person>, to: PlaceId): number {
  const usual = route(s, p.home, p.work).path;
  if (usual.includes(to) || to === p.home || to === p.work) return 0;
  return Math.max(1, route(s, p.work, to).path.length - 1);
}

export function moveOdds(s: Readonly<GameState>, p: Readonly<Person>, to: PlaceId): number {
  if (has(s, 'sure', p.id)) return 1;
  const raw = BALANCE.moveBase - BALANCE.movePerStep * offPath(s, p, to) + (p.stats.devotion - 50) / BALANCE.moveDevotionSpan;
  return Math.max(BALANCE.moveMin, Math.min(BALANCE.moveMax, Math.round(raw * 100) / 100));
}
export const moveAp = (s: Readonly<GameState>, p: Readonly<Person>, to: PlaceId): number =>
  offPath(s, p, to) >= BALANCE.moveFarAt ? 2 : 1;

export function moveWhy(s: Readonly<GameState>, p: Readonly<Person> | undefined, to: PlaceId): Reason[] {
  if (!p || !p.follower || !here(p)) return [{ key: 'why.notYours' }];
  if (standingOf(p) !== 'mortal') return [{ key: 'why.tooGreat' }];
  if (!PLACES[to] || to === p.work) return [{ key: 'why.nowhere' }];
  const def = areaDef(to);
  if (def.kind === 'shaft') return [{ key: 'why.noPost' }];
  if (visibility(s, to) === 'void') return [{ key: 'why.unseen' }];
  if (area(to) === DEEP && !s.flags.deepOpen) return [{ key: 'why.deepSealed' }];
  if (route(s, p.work, to).path.length === 0) return [{ key: 'why.noWay' }];
  return [];
}

export function move(c: Ctx, p: Person, to: PlaceId, odds: number): void {
  const ok = odds >= 1 || rand(c.s.rng) < odds;
  ev(c, { kind: 'moved', unit: p.id, ok, to });
  if (ok) {
    p.work = to;
    return;
  }
  addHeat(c, 'council', BALANCE.moveFailCouncil, 'newPost');
  loseDevotion(c, p, BALANCE.moveFailDevotion);
}


/** Dawn: prayer and offering deepen devotion; the set stones' Fervour; Dream Directive's sure step lasts the day. */
export function devotionDay(c: Ctx): void {
  const s = c.s;
  const fervour = bonus(s, 'devotion');
  followers(s, (p) => {
    const b = has(s, 'blessed', p.id) ? 1.5 : 1;
    const base = p.routine === 'pray' ? BALANCE.prayDevotion * (p.trait === 'pious' ? 1.5 : 1) * b : p.routine === 'offer' ? (BALANCE.prayDevotion / 2) * b : 0;
    gainDevotion(c, p, base + fervour);
  });
}
