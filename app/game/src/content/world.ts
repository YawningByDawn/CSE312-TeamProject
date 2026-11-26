/**
 * The one world (DECISIONS §6): the mine's graph. Areas are where the rules work (Hold, visibility, reach, searches);
 * places are where people are (a face, the bunks), each inside one area. A mine area is also the one place in it under
 * the same id, plus a few side rooms.
 * Names and blurbs are words (`place.<id>.name`, `place.<id>.blurb`).
 */
import type { PlaceId } from '../types';

export type AreaKind = 'grave' | 'gallery' | 'junction' | 'tunnel' | 'shrine' | 'quarters' | 'post' | 'shaft' | 'works' | 'loop' | 'pool';

export interface AreaDef {
  kind: AreaKind;
  /** Mine depth: 1 upper galleries, 2 lower workings, 3 the Deep (sealed until opened). */
  depth: number;
  /** Crystal richness of its vein (0: none). */
  vein: number;
  /** Lit by the Flame (the gold shrine). */
  flame: boolean;
  /** Watched by the Council: a follower who walks in unsanctioned raises its heat. */
  watched: boolean;
  /** Always yours (the grave). */
  anchored: boolean;
  /** Rooted, it ends the run: the way up (the lift) is yours once the god has reached `BALANCE.takenLevel`. */
  gate: boolean;
  /** Shut while the Council's lockdown lasts. */
  sealable: boolean;
  /** Work a follower can do here beyond their trade. */
  yield: 'gather' | 'fence' | 'skim' | null;
}

const mine = (kind: AreaKind, depth: number, o: Partial<AreaDef> = {}): AreaDef => ({
  vein: 0, flame: false, watched: false, anchored: false, gate: false, sealable: false, yield: null, kind, depth, ...o,
});

export const AREAS: Readonly<Record<PlaceId, AreaDef>> = {
  grave: mine('grave', 2, { vein: 1, anchored: true }),
  heartvein: mine('gallery', 2, { vein: 2 }),
  cartway: mine('junction', 1),
  westdrift: mine('tunnel', 1, { vein: 1 }),
  kilnshrine: mine('shrine', 1, { flame: true }),
  bunks: mine('quarters', 1),
  overseer: mine('post', 1, { watched: true }),
  lift: mine('shaft', 1, { watched: true, sealable: true, gate: true }),
  sorting: mine('works', 1, { yield: 'skim' }),
  eastworks: mine('works', 1, { vein: 2 }),
  lowgallery: mine('loop', 2, { vein: 1 }),
  sump: mine('pool', 3, { vein: 1 }),
};

/** The Deep: sealed until a Delve or a discovery opens it. */
export const DEEP: PlaceId = 'sump';
/** The way up: the lockdown shuts it and the run ends when it is yours. */
export const LIFT: PlaceId = 'lift';

/** The ways between areas: the mine's tunnels (DECISIONS §6). */
export const AREA_EDGES: readonly (readonly [PlaceId, PlaceId])[] = [
  ['grave', 'heartvein'], ['grave', 'cartway'], ['heartvein', 'eastworks'], ['cartway', 'westdrift'], ['cartway', 'sorting'],
  ['cartway', 'lowgallery'], ['cartway', 'bunks'], ['westdrift', 'kilnshrine'], ['westdrift', 'bunks'], ['bunks', 'overseer'],
  ['overseer', 'lift'], ['sorting', 'eastworks'], ['sorting', 'lift'], ['lowgallery', 'sump'], ['sump', 'eastworks'],
];

/** Each area's neighbours, in edge order. */
export const NEIGHBOURS: Readonly<Record<PlaceId, readonly PlaceId[]>> = Object.fromEntries(
  Object.keys(AREAS).map((a) => [a, AREA_EDGES.flatMap(([x, y]) => (x === a ? [y] : y === a ? [x] : []))]),
);

/** Travel in ticks: one area to the next, and between two places of one area. */
export const TRAVEL = { hop: 9, within: 3 } as const;

/** What a place is, as the people's days use it (work, meals, prayer, sleep, shelter). */
export type PlaceKind = 'face' | 'gallery' | 'works' | 'junction' | 'shrine' | 'quarters' | 'post' | 'shaft' | 'pool' | 'grave' | 'stable';

export interface PlaceDef {
  area: PlaceId;
  kind: PlaceKind;
  indoor: boolean;
}

const p = (area: PlaceId, kind: PlaceKind): PlaceDef => ({ area, kind, indoor: true });

/** Every place (underground counts as indoor). */
export const PLACES: Readonly<Record<PlaceId, PlaceDef>> = {
  grave: p('grave', 'grave'),
  heartvein: p('heartvein', 'gallery'),
  cartway: p('cartway', 'junction'),
  beaststalls: p('cartway', 'stable'),
  westdrift: p('westdrift', 'face'),
  kilnshrine: p('kilnshrine', 'shrine'),
  bunks: p('bunks', 'quarters'),
  pitkitchen: p('bunks', 'quarters'),
  overseer: p('overseer', 'post'),
  lift: p('lift', 'shaft'),
  sorting: p('sorting', 'works'),
  eastworks: p('eastworks', 'face'),
  lowgallery: p('lowgallery', 'face'),
  powderstore: p('lowgallery', 'works'),
  sump: p('sump', 'pool'),
  pumphouse: p('sump', 'works'),
};
