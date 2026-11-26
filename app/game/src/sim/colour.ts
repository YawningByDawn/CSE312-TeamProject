/**
 * Where the colour takes (OVERHAUL, ov-ui; content's COLOUR): an area is gray once the host has stood in it (dig.ts) and
 * coloured once the acts done there (`act`) are enough, over enough days, to cross its own hidden number; each coloured
 * neighbour lowers that number. The number is drawn from the seed and the area, so a run's colour is the same on a replay.
 */
import { dayOf } from '../content/clock';
import { COLOUR } from '../content/mine';
import { uiText } from '../content/text';
import { area, ev, nbrs, type Ctx } from './core';
import { K, idKey, keyed } from './world/draw';
import type { GameState, PlaceId } from '../types';

/** The acts an area needs now: its drawn number, lowered by each coloured neighbour (never under one). */
export function actsNeeded(s: Readonly<GameState>, a: PlaceId): number {
  const [lo, hi] = COLOUR.acts, near = nbrs(s, a).filter((n) => s.places[n]!.coloured).length;
  return Math.max(1, Math.ceil((lo + (hi - lo) * keyed(s.seed, K.colour, idKey(a))) * COLOUR.ease ** near));
}

function settle(c: Ctx, a: PlaceId): void {
  const ps = c.s.places[a]!;
  if (ps.coloured || ps.actDays < COLOUR.days || ps.acts < actsNeeded(c.s, a)) return;
  ps.coloured = true;
  ev(c, { kind: 'coloured', place: a, note: { key: 'host.coloured', slots: { place: uiText(`area.${a}.name`) } } });
}

/** One act done in `place`'s area on this day. */
export function act(c: Ctx, place: PlaceId): void {
  const a = area(place), ps = c.s.places[a]!, day = dayOf(c.s.tick);
  if (ps.coloured) return;
  ps.acts += 1;
  if (ps.lastAct !== day) [ps.lastAct, ps.actDays] = [day, ps.actDays + 1];
  settle(c, a);
}

/** The dawn: a neighbour that took colour yesterday may have brought another over its line. */
export function colourDawn(c: Ctx): void {
  for (const a in c.s.places) settle(c, a);
}
