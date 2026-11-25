/**
 * The powers' moves (DECISIONS §15.14, §100; inventory #35-40): a power whose heat crosses into a level calls that
 * level's move; at dusk a power at rest with nothing pending may announce one move whose floor its heat has passed,
 * days ahead. Every move walks the world (its agent and target) and lands at dusk unless answered: an item, an
 * Elite's favour, the power's act of evil, cooling the power below the floor, turning the agent, standing watch. The
 * lockdown's raids, the crusade's torches and the ward's push run at dawn; the writ's seals close the pit head.
 */
import { BALANCE } from '../content/balance';
import { AT, DAY_TICKS, dayOf, nextAt } from '../content/clock';
import { ROLES } from '../content/roles';
import { ANSWER_ITEM, FAVOUR, THREAT, THREATS, THREAT_KINDS } from '../content/threats';
import { AREAS, LIFT_LINK } from '../content/world';
import {
  FACTIONS, addEffect, addHeat, addSeal, area, destroyItem, door, ev, everyone, flameLight, flockCount, followers, has, here, loseDevotion, most, peopleIn, loseIchor, pushBack, remove, standingOf, whereNow, type Ctx,
} from './core';
import { directNether } from './influence';
import { chance, pick, weightedPick } from './rng';
import { noticeWearers } from './town';
import { ITEM } from '../content/items';
import type { FactionId, GameState, Person, PlaceId, Reason, Threat, ThreatKind } from '../types';

/** The move each power calls on crossing into a level. */
const AT_LEVEL: Readonly<Record<FactionId, (ThreatKind | undefined)[]>> = { temple: [], council: [], public: [] };
for (const k of THREAT_KINDS) if (THREATS[k].level) AT_LEVEL[THREATS[k].faction][THREATS[k].level!] = k;

const resting = (s: Readonly<GameState>, f: FactionId): boolean => has(s, 'rest', f) !== undefined;
/** Shade for `lateDays` days: the town has lost patience. */
export const late = (s: Readonly<GameState>): boolean => s.flags.shadeDay > 0 && dayOf(s.tick) - s.flags.shadeDay >= THREAT.lateDays;
const floorOf = (s: Readonly<GameState>, k: ThreatKind): number => (THREATS[k].floor ?? 0) - (late(s) ? THREAT.lateFloor : 0);
/** A follower lying low is hidden from a search with `lieLowCover`. */
const hides = (s: GameState, p: Person): boolean => p.routine === 'lieLow' && chance(s.rng, BALANCE.lieLowCover);

/** The area where most of your followers work (not the grave), or null. */
const stronghold = (s: Readonly<GameState>): PlaceId | null => most(flockCount(s, (f) => (AREAS[area(f.work)]!.anchored ? null : area(f.work))));

/** The followers a move falls on: where they live (the levy), work (a search) or stand (the rest). */
function exposed(s: Readonly<GameState>, t: Threat): Person[] {
  const out: Person[] = [];
  const by = t.kind === 'levy' ? 'home' : t.kind === 'inspection' || t.kind === 'crackdown' ? 'work' : 'now';
  followers(s, (f) => {
    const at = by === 'home' ? f.home : by === 'work' ? f.work : whereNow(f, s.tick);
    if (area(at) === t.target) out.push(f);
  });
  return out;
}

function target(s: GameState, k: ThreatKind): string | null {
  const town = (a: PlaceId): boolean => AREAS[a]!.region === 'town' && !AREAS[a]!.anchored;
  switch (k) {
    case 'inspection': case 'crackdown': {
      const n = flockCount(s, (f) => area(f.work));
      const graveToo = s.factions.council.suspicion >= BALANCE.inspectGraveAt;
      const pool = Object.keys(AREAS).filter((a) => AREAS[a]!.region === 'mine' && (!AREAS[a]!.anchored || graveToo));
      return weightedPick(s.rng, pool, (a) => 1 + BALANCE.inspectFlockWeight * (n.get(a) ?? 0)) ?? null;
    }
    case 'purge': {
      let best: Person | null = null;
      const lit = (p: Person): number => (flameLight(s, area(whereNow(p, s.tick))) > 0 ? 1 : 0);
      followers(s, (f) => {
        if (!best || lit(f) > lit(best) || (lit(f) === lit(best) && f.stats.devotion > best.stats.devotion)) best = f;
      });
      return best ? (best as Person).id : null;
    }
    case 'levy': return most(flockCount(s, (f) => (town(area(f.home)) ? area(f.home) : null)));
    case 'ward': case 'burning': {
      const pool = Object.keys(AREAS).filter((a) => town(a) && s.places[a]!.hold > 0 && !(k === 'ward' && s.places[a]!.rooted));
      return pool.sort((a, b) => s.places[b]!.hold - s.places[a]!.hold || (a < b ? -1 : 1))[0] ?? null;
    }
    case 'inquisitor': case 'mob': case 'riot': case 'crusade': return stronghold(s);
    case 'lockdown': return LIFT_LINK[0];
    default: return LIFT_LINK[1];
  }
}

/** The one sent: a stranger who serves the power on this stage's side; the mob is the strangers where it lands. */
function agents(s: GameState, f: FactionId, at: string): string[] {
  if (f === 'public') return peopleIn(s, at, (p) => !p.follower).slice(0, THREAT.mobMax).map((p) => p.id);
  const side = s.stage === 'whisper' ? 'mine' : 'town';
  const a = pick(s.rng, everyone(s).filter((p) => {
    const r = ROLES[p.role]!;
    return here(p) && !p.follower && r.serves === f && r.watches && r.side === side;
  }));
  return a ? [a.id] : [];
}

/** A move called: it walks from now and lands at `lands` (a move nothing answers lands at once). */
function call(c: Ctx, k: ThreatKind, lands: number): void {
  const s = c.s;
  if (s.threats.some((t) => t.kind === k)) return;
  const at = target(s, k);
  if (at === null) return;
  const d = THREATS[k];
  const t: Threat = { id: `t${s.next++}`, faction: d.faction, kind: k, target: at, lands, walkers: agents(s, d.faction, at) };
  s.threats.push(t);
  ev(c, { kind: 'threat', threat: t.id, how: 'announced' });
  if (d.answers.length === 0) land(c, t);
}

/** Each tick: a power whose heat crossed into a level calls that level's move, landing at the next dusk. */
export function crossings(c: Ctx): void {
  for (let i = 0; i < FACTIONS.length; i++) {
    const f = FACTIONS[i]!;
    const fa = c.s.factions[f];
    if (fa.called > fa.level) fa.called = fa.level;
    while (fa.called < fa.level && c.s.phase === 'live') {
      fa.called += 1;
      const k = AT_LEVEL[f][fa.called];
      if (k && (!THREATS[k].stage || THREATS[k].stage === c.s.stage)) call(c, k, nextAt(c.s.tick, AT.dusk));
    }
  }
}

/** The crusade gathers once the god reaches `crusadeLevel` in Shade, `crusadeWarn` days off. */
export function crusadeAtRank(c: Ctx, was: number): void {
  const s = c.s;
  if (s.stage === 'shade' && was < THREAT.crusadeLevel && s.god.level >= THREAT.crusadeLevel) {
    call(c, 'crusade', nextAt(s.tick, AT.dusk) + (THREAT.crusadeWarn - 1) * DAY_TICKS);
  }
}

/** Dusk: due moves land (or fizzle); each power at rest with nothing pending may announce its next. */
export function powersDusk(c: Ctx): void {
  const s = c.s;
  for (const t of s.threats.filter((x) => x.lands <= s.tick)) {
    if (s.phase !== 'live') return;
    if (s.threats.includes(t)) land(c, t);
  }
  for (const f of FACTIONS) {
    if (s.phase !== 'live' || resting(s, f) || s.threats.some((t) => t.faction === f)) continue;
    const heat = s.factions[f].suspicion;
    const pool = THREAT_KINDS.filter((k) => {
      const d = THREATS[k];
      return d.faction === f && (d.weight ?? 0) > 0 && (!d.stage || d.stage === s.stage) && heat >= floorOf(s, k);
    });
    let k = pool.length > 0 ? weightedPick(s.rng, pool, (x) => THREATS[x].weight!) : undefined;
    if (!k && f === 'council' && s.stage === 'whisper' && heat >= floorOf(s, 'inspection')
      && chance(s.rng, BALANCE.inspectChance + heat * BALANCE.inspectChancePer)) k = heat >= floorOf(s, 'crackdown') ? 'crackdown' : 'inspection';
    if (!k) continue;
    const warn = heat >= 75 ? THREAT.warnHostile : THREAT.warn;
    call(c, k, s.tick + warn * DAY_TICKS);
  }
}

function rest(c: Ctx, t: Threat): void {
  const s = c.s;
  const days = t.kind === 'inspection' ? BALANCE.inspectRest : late(s) ? THREAT.restLate : THREAT.rest;
  addEffect(s, 'rest', t.faction, nextAt(s.tick, AT.dusk) + (days - 1) * DAY_TICKS);
}

function drop(c: Ctx, t: Threat, how: 'landed' | 'answered'): void {
  c.s.threats = c.s.threats.filter((x) => x !== t);
  ev(c, { kind: 'threat', threat: t.id, how });
  rest(c, t);
}

/** What blunts a move by itself when it lands: its power cooled below the floor, its agent turned, a watch kept. */
function fizzles(s: Readonly<GameState>, t: Threat): boolean {
  const d = THREATS[t.kind];
  if (d.answers.includes('cool') && d.floor !== undefined && s.factions[t.faction].suspicion < floorOf(s, t.kind) && !(t.kind === 'writ' && late(s))) return true;
  if (d.answers.includes('agent') && t.walkers.length > 0 && t.walkers.every((id) => s.people[id]!.follower || !here(s.people[id]!))) return true;
  if (!d.answers.includes('watch')) return false;
  let watched = false;
  followers(s, (f) => { if (f.routine === 'standWatch' && area(whereNow(f, s.tick)) === t.target) watched = true; });
  return watched;
}

/** Raid or torches at dawn: each follower working in the stronghold is taken or burned with `p`, at most `raidMax`. */
function sweep(c: Ctx, p: number, why: 'taken' | 'burned'): void {
  const s = c.s;
  const a = stronghold(s);
  if (!a) return;
  const hit: Person[] = [];
  followers(s, (f) => { if (hit.length < THREAT.raidMax && area(f.work) === a && !hides(s, f) && chance(s.rng, p)) hit.push(f); });
  for (const f of hit) remove(c, f, why);
  pushBack(c, a, BALANCE.raidPush);
}

function land(c: Ctx, t: Threat): void {
  const s = c.s;
  if (fizzles(s, t)) return drop(c, t, 'answered');
  drop(c, t, 'landed');
  const lasting = (k: 'lockdown' | 'kindling', days: number): void => addEffect(s, k, t.faction, nextAt(s.tick, AT.dawn) + (days - 1) * DAY_TICKS);
  switch (t.kind) {
    case 'bolted':
      for (const p of everyone(s)) if (!p.follower) p.resistance += THREAT.boltedResist;
      break;
    case 'inspection': case 'crackdown': {
      const mult = t.kind === 'crackdown' ? BALANCE.inspectCrackdownMult : 1;
      for (const f of exposed(s, t)) {
        if (hides(s, f)) continue;
        if (f.pocket.length > 0 || f.routine === 'skim' || f.routine === 'delve') {
          if (!chance(s.rng, BALANCE.inspectCatch * mult * door(s, 'search', f.work))) continue;
          addHeat(c, 'council', BALANCE.inspectCaughtHeat, 'caught');
          remove(c, f, 'taken');
        } else if ((f.routine === 'pray' || f.routine === null) && chance(s.rng, BALANCE.inspectSeen * mult)) {
          addHeat(c, 'council', BALANCE.inspectSeenHeat, 'seenAtPrayer');
          loseDevotion(c, f, BALANCE.inspectDevotion);
        }
      }
      if (AREAS[t.target]!.anchored) {
        const set = s.god.sockets.filter((x) => x !== null).length;
        addHeat(c, 'council', Math.min(BALANCE.inspectSetCap, set * BALANCE.inspectSetHeat), 'graveSeen');
        loseIchor(c, BALANCE.hunterIchor, 'hunter');
      }
      if (t.kind === 'crackdown') {
        addHeat(c, 'council', -BALANCE.crackdownCool, 'crackdown');
        if (s.stage === 'shade') addSeal(c);
      }
      break;
    }
    case 'lockdown':
      lasting('lockdown', THREAT.lockdownDays[s.stage]);
      if (s.stage === 'shade') addSeal(c);
      break;
    case 'writ':
      addSeal(c);
      addHeat(c, 'council', -THREAT.writCool, 'writ');
      break;
    case 'levy': {
      let n = 0;
      for (const f of exposed(s, t)) {
        if (n >= THREAT.levyMax || f.routine === 'lieLow' || !chance(s.rng, THREAT.levyPersonChance)) continue;
        remove(c, f, 'conscripted');
        n += 1;
      }
      break;
    }
    case 'inquisitor': {
      const heard = exposed(s, t).filter((f) => !hides(s, f));
      for (const f of heard) loseDevotion(c, f, f.trait === 'pious' ? BALANCE.cantorSongPious : BALANCE.cantorSong);
      noticeWearers(c, heard, ITEM.hunterNotice);
      for (const p of peopleIn(s, t.target, (x) => !x.follower)) p.resistance += THREAT.songResist;
      // He stays while the Temple is Alarmed: he walks on to wherever your faithful gather next.
      if (s.factions.temple.level >= 2) call(c, 'inquisitor', nextAt(s.tick, AT.dusk));
      break;
    }
    case 'purge': {
      const p = s.people[t.target];
      if (p && here(p) && p.follower) remove(c, p, 'burned');
      addHeat(c, 'temple', -THREAT.purgeCool, 'fed');
      break;
    }
    case 'ward':
      addEffect(s, 'ward', t.target, s.tick + THREAT.wardDays * DAY_TICKS);
      pushBack(c, t.target, THREAT.wardHold);
      break;
    case 'crusade': lasting('kindling', THREAT.crusadeDays); break;
    case 'mob': case 'riot': {
      const pool = exposed(s, t).filter((f) => f.routine !== 'lieLow');
      for (let i = 0; i < BALANCE.mobVictims + (t.kind === 'riot' ? 1 : 0) && pool.length > 0; i++) {
        const v = pick(s.rng, pool)!;
        pool.splice(pool.indexOf(v), 1);
        v.stats.health = Math.max(0, v.stats.health - BALANCE.mobHarm);
        if (v.stats.health <= 0) remove(c, v, 'dead');
        else loseDevotion(c, v, THREAT.mobDevotion);
      }
      addHeat(c, 'public', -(t.kind === 'riot' ? THREAT.riotCool : THREAT.mobCool), 'bloodSpent');
      if (t.kind === 'riot') for (const f of ['temple', 'council'] as const) addHeat(c, f, THREAT.riotHeat, 'riot');
      break;
    }
    case 'burning':
      pushBack(c, t.target, THREAT.burnHold);
      addHeat(c, 'public', -THREAT.burnCool, 'burning');
      break;
    case 'vigil': break;
  }
}

/** Dawn: the lockdown raids your stronghold, the crusade's torches burn there, a ward pushes your colour back. */
export function powersDawn(c: Ctx): void {
  const s = c.s;
  const lock = has(s, 'lockdown', 'council');
  if (lock) {
    sweep(c, THREAT.raidTaken, 'taken');
    if (lock.until <= s.tick + DAY_TICKS) s.factions.council.suspicion = Math.min(s.factions.council.suspicion, THREAT.lockdownSpent);
  }
  if (s.phase === 'live' && has(s, 'kindling', 'temple')) sweep(c, THREAT.torchBurned, 'burned');
  for (const e of s.effects) if (e.kind === 'ward' && e.on && e.until > s.tick) pushBack(c, e.on, BALANCE.wardPush);
}

/** Every pending move of a power fails at once, and its lockdown or crusade ends (a favour, its act of evil). */
export function bluntAll(c: Ctx, f: FactionId): void {
  for (const t of c.s.threats.filter((x) => x.faction === f)) drop(c, t, 'answered');
  for (const e of c.s.effects) if ((e.kind === 'lockdown' || e.kind === 'kindling') && e.on === f) e.until = c.s.tick;
}


/** The turned Elite of a power whose favour is ready, the most devoted first. */
function favourer(s: Readonly<GameState>, f: FactionId): Person | null {
  let best: Person | null = null;
  followers(s, (p) => {
    if (standingOf(p) !== 'elite' || ROLES[p.role]!.serves !== f || has(s, 'used', p.id)) return;
    if (!best || p.stats.devotion > best.stats.devotion) best = p;
  });
  return best;
}

export function answerWhy(s: Readonly<GameState>, id: string, by: string): Reason[] {
  const t = s.threats.find((x) => x.id === id);
  if (!t) return [{ key: 'why.noThreat' }];
  const answers = THREATS[t.kind].answers;
  if (by === 'favour') return !answers.includes('favour') ? [{ key: 'why.notAnswer' }] : favourer(s, t.faction) ? [] : [{ key: 'why.noFavour' }];
  if (by === 'hide') return !answers.includes('hide') ? [{ key: 'why.notAnswer' }] : exposed(s, t).some((f) => f.routine !== 'lieLow') ? [] : [{ key: 'why.noneToHide' }];
  const it = s.items[by];
  if (!it || it.wearer !== null) return [{ key: 'why.noItem' }];
  return answers.some((a) => ANSWER_ITEM[a] === it.kind) ? [] : [{ key: 'why.notAnswer' }];
}

/** Hiding costs each follower laid low their Direct Nether; every answer costs one action point. */
export function answerNether(s: Readonly<GameState>, id: string, by: string): number {
  const t = s.threats.find((x) => x.id === id);
  if (!t || by !== 'hide') return 0;
  let n = 0;
  for (const f of exposed(s, t)) if (f.routine !== 'lieLow') n += directNether(f);
  return Math.round(n * 10) / 10;
}

export function answer(c: Ctx, id: string, by: string): void {
  const s = c.s;
  const t = s.threats.find((x) => x.id === id)!;
  if (by === 'hide') {
    for (const f of exposed(s, t)) if (f.routine !== 'lieLow') {
      f.routine = 'lieLow';
      ev(c, { kind: 'routine', unit: f.id, routine: 'lieLow' });
    }
    return;
  }
  if (by === 'favour') {
    const e = favourer(s, t.faction)!;
    bluntAll(c, t.faction);
    addEffect(s, 'blind', t.faction, s.tick + FAVOUR.nights * DAY_TICKS);
    addEffect(s, 'used', e.id, s.tick + FAVOUR.cooldown * DAY_TICKS);
    loseDevotion(c, e, FAVOUR.devotion);
    return;
  }
  destroyItem(s, by);
  drop(c, t, 'answered');
}
