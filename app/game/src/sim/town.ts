/**
 * The town's benches and the things they make (spec §7.4-7.5, vision §4, DECISIONS §111): forge a jewel at the jewelry
 * bench, craft each other bench's thing, give one to a follower to wear or to anyone else as its curse (used up), take
 * one back; a worn draught or brew is used up after its days; and the vault in the keep, once the council hall is yours.
 */
import { BALANCE } from '../content/balance';
import { AT, DAY_TICKS, nextAt } from '../content/clock';
import { FACILITY_ITEM, ITEM } from '../content/items';
import { ROLES } from '../content/roles';
import { uiText } from '../content/text';
import { benchOpen, buildingYours } from './buildings';
import { addEffect, addHeat, area, destroyItem, end, ev, everyone, here, loseIchor, mint, remove, standingOf, whereNow, type Ctx } from './core';
import { round1 } from './formulas';
import { rand } from './rng';
import { exposure, itemDef, itemPower } from './items';
import type { Facility, GameState, ItemKind, JewelForm, Person, Reason } from '../types';


export function benchWhy(s: Readonly<GameState>, f: Facility, crystal: string): Reason[] {
  if (!benchOpen(s, f)) return [{ key: 'why.bench', slots: { bench: uiText(`facility.${f}.name`) } }];
  const x = s.crystals[crystal];
  return x && 'pouch' in x.at ? [] : [{ key: 'why.notInPouch' }];
}

/** Nether to make a thing of a stone: by its grade; jewelry at half with a smelter of yours for its metal. */
export function makeCost(s: Readonly<GameState>, f: Facility, crystal: string): number {
  const x = s.crystals[crystal];
  if (!x) return 0;
  return round1(ITEM.makeCost[x.grade] * (f === 'jewelry' && buildingYours(s, 'smelter') ? ITEM.metalForgeCost : 1));
}

/** The stone is folded into a new thing at hand (its Nether paid by the action). */
export function make(c: Ctx, f: Facility, crystal: string, form?: JewelForm): void {
  const s = c.s;
  const kind: ItemKind = f === 'jewelry' ? 'jewel' : FACILITY_ITEM[f as keyof typeof FACILITY_ITEM];
  const id = `i${s.next++}`;
  s.items[id] = { id, kind, ...(form ? { form } : {}), crystal, wearer: null };
  s.crystals[crystal]!.at = { item: id };
  ev(c, { kind: 'item', item: id, how: 'made' });
}


/** A follower who lives, works or stands in the area beside `p` (`by`, if named): the hand a cursed gift goes by. */
function giftHand(s: Readonly<GameState>, p: Readonly<Person>, by: string | undefined): boolean {
  const at = area(whereNow(p, s.tick));
  const hand = (f: Readonly<Person>): boolean => here(f) && f.follower && (f.home === p.home || f.work === p.work || area(whereNow(f, s.tick)) === at);
  if (by !== undefined) return !!s.people[by] && hand(s.people[by]!);
  return everyone(s).some(hand);
}

/** Worn by a follower with room (one thing, an Elite two); a curse only by a follower's hand beside them. */
export function giveWhy(s: Readonly<GameState>, item: string, unit: string, by?: string): Reason[] {
  const it = s.items[item];
  if (!it || it.wearer !== null) return [{ key: 'why.noItem' }];
  const p = s.people[unit];
  if (!p || !here(p)) return [{ key: 'why.noOne' }];
  if (p.follower) return p.worn.length >= (standingOf(p) === 'elite' ? 2 : 1) ? [{ key: 'why.wornFull', slots: { name: p.name } }] : [];
  return giftHand(s, p, by) ? [] : [{ key: 'why.noHand' }];
}

/** To a follower: worn (a draught or brew for its days). To anyone else: its curse, and it is used up. */
export function give(c: Ctx, item: string, unit: string): void {
  const s = c.s;
  const it = s.items[item]!;
  const p = s.people[unit]!;
  if (p.follower) {
    it.wearer = p.id;
    p.worn.push(it.id);
    const days = itemPower(s, it, 'draught');
    if (days > 0) it.until = s.tick + days * DAY_TICKS;
    ev(c, { kind: 'item', item, unit: p.id, how: 'given', note: { key: 'item.worn', slots: { name: p.name } } });
    return;
  }
  const g = itemDef(it).gift;
  const reached = g.reach === 'one' ? [p] : everyone(s).filter((q) => here(q) && !q.follower && (
    g.reach === 'work' ? q.work === p.work : g.reach === 'household' ? q.household === p.household : q.home === p.home));
  for (const q of reached) {
    if (g.resist) q.resistance = Math.max(0, q.resistance + g.resist);
    if (g.odds) addEffect(s, 'whisper', q.id, nextAt(s.tick, AT.dawn), undefined, g.odds);
  }
  if (g.sick) addEffect(s, 'sick', p.id, s.tick + g.sick * DAY_TICKS);
  if (g.heat) addHeat(c, g.heat.faction, g.heat.amount, 'gift');
  const serves = ROLES[p.role]!.serves;
  if (g.cool && serves && standingOf(p) === 'elite') addHeat(c, serves, -g.cool, 'eliteLooksAway');
  const k = it.form ?? it.kind;
  destroyItem(s, item);
  ev(c, {
    kind: 'item', item, unit: p.id, how: 'given',
    note: { key: `item.${k}.gift`, slots: { days: g.sick ?? 0, n: -(g.resist ?? 0), pct: Math.round((g.odds ?? 0) * 100) } },
  });
}

export const takeBackWhy = (s: Readonly<GameState>, item: string): Reason[] =>
  !s.items[item] ? [{ key: 'why.noItem' }] : s.items[item]!.wearer === null ? [{ key: 'why.notWorn' }] : [];

export function takeBack(c: Ctx, item: string): void {
  const it = c.s.items[item]!;
  const p = c.s.people[it.wearer!]!;
  p.worn.splice(p.worn.indexOf(item), 1);
  it.wearer = null;
  delete it.until;
  ev(c, { kind: 'item', item, unit: p.id, how: 'takenBack' });
}

/** Dawn: a worn draught or brew whose days are over is used up. */
export function itemsDawn(c: Ctx): void {
  for (const id in c.s.items) if ((c.s.items[id]!.until ?? Infinity) <= c.s.tick) destroyItem(c.s, id);
}

/**
 * What a search finds worn on a follower is proof: each thing raises the Council's heat by its exposure × `exposureHeat`
 * and is lost (a relic found and broken wounds you), and the wearer is taken.
 */
export function evidence(c: Ctx, p: Person): void {
  for (const id of p.worn.slice()) {
    const it = c.s.items[id]!;
    addHeat(c, 'council', exposure(c.s, it) * ITEM.exposureHeat, 'madeThing');
    ev(c, { kind: 'exposed', item: id, unit: p.id });
    destroyItem(c.s, id);
    if (it.kind === 'relic') loseIchor(c, BALANCE.relicIchor, 'relic');
  }
  remove(c, p, 'taken');
}

/** Watching eyes (an informer heard out, the Inquisitor's song) notice what yours wear: each wearer with `odds` × (1 − Cunning/200). */
export function noticeWearers(c: Ctx, ps: readonly Person[], odds: number): void {
  for (const p of ps) if (here(p) && p.follower && p.worn.length > 0 && rand(c.s.rng) < odds * (1 - p.stats.cunning / 200)) evidence(c, p);
}


export function vaultWhy(s: Readonly<GameState>): Reason[] {
  if (s.stage !== 'shade') return [{ key: 'why.shade' }];
  if (s.flags.vaultOpen) return [{ key: 'why.vaultOpen' }];
  return buildingYours(s, 'councilhall') ? [] : [{ key: 'why.vaultShut' }];
}

/** The vault opened: an Impossible stone and `vaultRoyal` Royal ones to the grave, the Council's cry, and the run is won. */
export function openVault(c: Ctx): void {
  const s = c.s;
  s.flags.vaultOpen = true;
  mint(c, { tier: 5 });
  for (let i = 0; i < BALANCE.vaultRoyal; i++) mint(c, { tier: 4 });
  ev(c, { kind: 'vaultOpen', place: 'vault' });
  addHeat(c, 'council', BALANCE.vaultCouncil, 'vault');
  end(c, true, 'vault');
}
