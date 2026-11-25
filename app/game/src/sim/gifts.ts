/**
 * A building's gift (docs/town.md §3; content's PLACES `gift`, balance's GIFTS; DECISIONS §112): once a building that
 * gives it is yours, `useGift` spends an action and its Nether, and it rests `rest` days. Rumour cools a power; debt
 * softens one who owes; food is laid in a town area for a dawn up to `days` ahead (poison or bless); records forge a
 * seal off the writ; guards look away (no searches until the count, and the watch leaves one area's colour alone).
 * A home gives the hearth, standing: in the town a household more than half yours seeds its area's colour each dawn.
 */
import { GIFTS } from '../content/gifts';
import { AT, DAY_TICKS, nextAt } from '../content/clock';
import { AREAS, PLACES } from '../content/world';
import { uiText } from '../content/text';
import { buildingYours, hearths, placesBy } from './buildings';
import { FACTIONS, addEffect, addHeat, area, ev, everyone, gainDevotion, has, here, remove, setHold, tearWrit, untilShiftEnd, type Ctx } from './core';
import { pick } from './rng';
import type { Action, FactionId, GameState, Gift, PlaceId, Reason, World } from '../types';

type UseGift = Extract<Action, { type: 'useGift' }>;
const restKey = (g: Gift): string => `gift:${g}`;
/** The buildings that give each gift. */
const GIVERS = placesBy((id) => PLACES[id]!.gift);

/** The first building of yours that gives `g`, or undefined. */
export const giver = (s: Readonly<GameState>, g: Gift): PlaceId | undefined => GIVERS.get(g)?.find((b) => buildingYours(s, b));
const townArea = (a: string | undefined): a is PlaceId => !!a && !!AREAS[a] && AREAS[a]!.region === 'town';
/** The dawn food laid `day` days ahead lands on. */
const landing = (s: Readonly<GameState>, day: number): number => nextAt(s.tick, AT.dawn) + (day - 1) * DAY_TICKS;
/** A tavern regular of a rumour-giving tavern of yours costs `regularsCost` of the Nether to turn. */
export const regularsMult = (s: Readonly<GameState>, haunts: readonly PlaceId[]): number =>
  (GIVERS.get('rumour') ?? []).some((b) => haunts.includes(b) && buildingYours(s, b)) ? GIFTS.rumour.regularsCost : 1;

export function giftWhy(s: Readonly<GameState>, w: World, a: UseGift): Reason[] {
  const g = a.gift;
  if (!giver(s, g)) return [{ key: 'why.noGift' }];
  if (has(s, 'used', restKey(g))) return [{ key: 'why.resting' }];
  const t = a.target;
  switch (g) {
    case 'rumour': return t && FACTIONS.includes(t as FactionId) ? [] : [{ key: 'why.badTarget' }];
    case 'debt': {
      const p = t ? s.people[t] : undefined;
      return p && here(p) && !p.follower && p.ties.some((id) => w.tieKind(s, p, s.people[id]!) === 'owes') ? [] : [{ key: 'why.noDebt' }];
    }
    case 'food': {
      const d = a.day ?? 1;
      if (!townArea(t) || (a.mode !== 'poison' && a.mode !== 'bless') || !Number.isInteger(d) || d < 1 || d > GIFTS.food.days) return [{ key: 'why.badTarget' }];
      const at = landing(s, d) + 1;
      return s.effects.some((e) => e.kind === 'food' && e.on === t && e.until === at) ? [{ key: 'why.foodLaid' }] : [];
    }
    case 'records': return s.flags.seals > 0 ? [] : [{ key: 'why.noSeal' }];
    case 'guards': return townArea(t) ? [] : [{ key: 'why.badTarget' }];
  }
}

/** Every gift action the rules allow now (bots, tests): each target, and for food each way and day. */
export function giftActions(s: Readonly<GameState>): UseGift[] {
  const out: UseGift[] = [];
  const towns = Object.keys(AREAS).filter(townArea);
  for (const f of FACTIONS) out.push({ type: 'useGift', gift: 'rumour', target: f });
  for (const p of everyone(s)) if (!p.follower && p.ties.length > 0) out.push({ type: 'useGift', gift: 'debt', target: p.id });
  for (const a of towns) {
    out.push({ type: 'useGift', gift: 'guards', target: a });
    for (const mode of ['poison', 'bless'] as const) for (let day = 1; day <= GIFTS.food.days; day++) out.push({ type: 'useGift', gift: 'food', target: a, mode, day });
  }
  out.push({ type: 'useGift', gift: 'records' });
  return out;
}

/** Use a gift whose why is empty (its action point and Nether paid by the caller). */
export function useGift(c: Ctx, a: UseGift): void {
  const s = c.s;
  const g = a.gift;
  addEffect(s, 'used', restKey(g), s.tick + GIFTS[g].rest * DAY_TICKS);
  const t = a.target;
  const slots: Record<string, string | number> = {};
  switch (g) {
    case 'rumour':
      addHeat(c, t as FactionId, -GIFTS.rumour.cool, 'rumour');
      slots.power = uiText(`power.${t}`);
      break;
    case 'debt': {
      const p = s.people[t!]!;
      p.resistance = Math.max(0, p.resistance + GIFTS.debt.resist);
      addHeat(c, 'council', GIFTS.debt.council, 'debtCalled');
      slots.name = p.name;
      break;
    }
    case 'food':
      addEffect(s, 'food', t, landing(s, a.day ?? 1) + 1, undefined, a.mode === 'bless' ? 1 : -1);
      slots.place = uiText(`area.${t}.name`);
      slots.n = a.day ?? 1;
      break;
    case 'records':
      tearWrit(c, GIFTS.records.seals, 'records');
      addHeat(c, 'council', GIFTS.records.council, 'records');
      break;
    case 'guards':
      addEffect(s, 'noSearch', undefined, untilShiftEnd(s));
      addEffect(s, 'lookAway', t, nextAt(s.tick, AT.dawn) + 1);
      slots.place = uiText(`area.${t}.name`);
      break;
  }
  const key = g === 'food' ? `gift.food.${a.mode}` : `gift.${g}.used`;
  ev(c, { kind: 'story', story: 'gift', place: giver(s, g)!, ...(g === 'debt' ? { unit: t } : {}), note: { key, slots } });
}

/**
 * Dawn: in the town each hearth of yours seeds its area's colour (`GIFTS.hearth`); the food laid for today lands.
 * Blessed: yours who live there gain Devotion. Poisoned: the rest fall sick, some die.
 */
export function giftsDawn(c: Ctx): void {
  const s = c.s;
  if (s.stage === 'shade') for (const h of hearths(s)) setHold(c, area(h), s.places[area(h)]!.hold + GIFTS.hearth.hold);
  for (const e of s.effects) {
    if (e.kind !== 'food' || e.until !== s.tick + 1) continue;
    const at = e.on!;
    const home = everyone(s).filter((p) => here(p) && area(p.home) === at);
    if (e.value! > 0) {
      const fs = home.filter((p) => p.follower);
      for (const p of fs) gainDevotion(c, p, GIFTS.food.devotion);
      ev(c, { kind: 'story', story: 'gift', place: at, note: { key: 'gift.food.blessed', slots: { place: uiText(`area.${at}.name`), n: fs.length } } });
      continue;
    }
    const victims = home.filter((p) => !p.follower);
    for (const p of victims) addEffect(s, 'sick', p.id, s.tick + GIFTS.food.sick * DAY_TICKS);
    let dead = 0;
    for (let i = 0; i < GIFTS.food.deaths && s.phase === 'live'; i++) {
      const v = pick(s.rng, victims.filter(here));
      if (!v) break;
      remove(c, v, 'dead', 0);
      dead++;
    }
    if (s.phase !== 'live') return;
    addHeat(c, 'public', GIFTS.food.public, 'poisonedBread');
    ev(c, { kind: 'story', story: 'gift', place: at, note: { key: 'gift.food.poisoned', slots: { place: uiText(`area.${at}.name`), n: victims.length, dead } } });
  }
}
