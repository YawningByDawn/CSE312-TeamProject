/**
 * The town's buildings (docs/town.md §3, DECISIONS §110). A building is yours while its master is yours and more than
 * half of those who work there are (with nobody else working there, its master alone); one nobody masters is yours while
 * its area has taken root. It is read from the people, never stored. A bench (content's PLACES `facility`) is open
 * while a building that gives it is yours.
 */
import { TOWN } from '../content/balance';
import { uiText } from '../content/text';
import { AREAS, PLACES } from '../content/world';
import type { Facility, GameState, Person, PlaceId, Reason } from '../types';
import { roster } from './world/society';

export const FACILITIES: readonly Facility[] = ['faceting', 'jewelry', 'falseWeights', 'profaning', 'draughts', 'lamps', 'clothing', 'brew'];
/** Every place grouped by what `key` says of it (undefined: none). */
export function placesBy<K>(key: (id: PlaceId) => K | undefined): Map<K, PlaceId[]> {
  const m = new Map<K, PlaceId[]>();
  for (const id in PLACES) { const k = key(id); if (k !== undefined) m.set(k, [...(m.get(k) ?? []), id]); }
  return m;
}
const BENCHES = new Map<Facility, PlaceId[]>(FACILITIES.map((f) => [f, Object.keys(PLACES).filter((id) => PLACES[id]!.facility === f)]));
const town = (place: PlaceId): boolean => PLACES[place] !== undefined && AREAS[PLACES[place]!.area]!.region === 'town';
/** Every town building of each area. */
const IN_AREA = placesBy((id) => (town(id) ? PLACES[id]!.area : undefined));
export const buildingsIn = (a: PlaceId): readonly PlaceId[] => IN_AREA.get(a) ?? [];

/** Who holds a building: its master, and how many of those who work there are yours. */
export function handsOf(s: Readonly<GameState>, place: PlaceId): { master: Person | null; yours: number; of: number } {
  let master: Person | null = null;
  let yours = 0;
  let of = 0;
  for (const p of roster(s).all) {
    if (p.gone !== null) continue;
    if (p.masterOf.includes(place)) master = p;
    else if (p.work === place && p.standing !== 'elite' && !TOWN.notWorkers.includes(p.role)) {
      of += 1;
      if (p.follower) yours += 1;
    }
  }
  return { master, yours, of };
}

/** A mastered building's holding by its people, or null when nobody masters it (it goes with its ground). */
export function heldByHands(s: Readonly<GameState>, place: PlaceId): boolean | null {
  const h = handsOf(s, place);
  return h.master ? h.master.follower && (h.of === 0 || h.yours * 2 > h.of) : null;
}

export const buildingYours = (s: Readonly<GameState>, place: PlaceId): boolean =>
  heldByHands(s, place) ?? s.places[PLACES[place]!.area]!.rooted;

/** The mastered town buildings `p` works in or masters, each with whether it is yours: what their turning or loss can move. */
export function holding(s: Readonly<GameState>, p: Readonly<Person>): [PlaceId, boolean][] {
  const out: [PlaceId, boolean][] = [];
  for (const b of [p.work, ...p.masterOf]) {
    const y = town(b) ? heldByHands(s, b) : null;
    if (y !== null) out.push([b, y]);
  }
  return out;
}

const BOONS = placesBy((id) => PLACES[id]!.boon);
/** The buildings of yours that give a standing boon (content's PLACES `boon`). */
export const boonYours = (s: Readonly<GameState>, b: 'road' | 'lesson'): PlaceId[] => BOONS.get(b)!.filter((p) => buildingYours(s, p));

/** The homes (`home:<area>:<slot>`, one a household) whose hearth is yours: more than half of the household here are. */
export function hearths(s: Readonly<GameState>): PlaceId[] {
  const lean = new Map<PlaceId, number>();
  for (const p of roster(s).all) if (p.gone === null && p.home.startsWith('home:')) lean.set(p.home, (lean.get(p.home) ?? 0) + (p.follower ? 1 : -1));
  return [...lean.keys()].filter((home) => lean.get(home)! > 0);
}

export const benchOpen =(s: Readonly<GameState>, f: Facility): boolean => BENCHES.get(f)!.some((b) => buildingYours(s, b));

/** Why a building is not yours: its master and hands to turn, or its area to root. */
function notYet(s: Readonly<GameState>, place: PlaceId): Reason {
  const h = handsOf(s, place);
  const name = uiText(`place.${place}.name`);
  if (!h.master) return { key: 'why.rootIt', slots: { place: name } };
  return { key: 'facility.locked', slots: { place: name, master: h.master.name, yours: h.yours, total: h.of } };
}

/** Each bench: open, or why each building that gives it is not yours. */
export function facilities(s: Readonly<GameState>): { facility: Facility; open: boolean; why: Reason[] }[] {
  return FACILITIES.map((facility) => {
    const open = benchOpen(s, facility);
    return { facility, open, why: open ? [] : BENCHES.get(facility)!.map((b) => notYet(s, b)) };
  });
}
