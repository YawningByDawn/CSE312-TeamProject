/**
 * The one world (DECISIONS §6, §7, §13.1–13.3): the mine and the town on one graph. Areas are where the rules
 * work (Hold, visibility, reach, searches, wards); places are where people are (a face, the tavern, a home), each
 * inside one area. A mine area is also the one place in it under the same id, plus a few side rooms.
 * Names and blurbs are words (`place.<id>.name`, `place.<id>.blurb`).
 */
import { BALANCE } from './balance';
import type { Facility, FactionId, Gift, PlaceId, Region, UnitId } from '../types';

export type AreaKind =
  | 'grave' | 'gallery' | 'junction' | 'tunnel' | 'shrine' | 'quarters' | 'post' | 'shaft' | 'works' | 'loop' | 'pool'
  | 'pithead' | 'shanties' | 'graveyard' | 'yard' | 'smelter' | 'square' | 'well' | 'gardens' | 'houses' | 'temple'
  | 'hall' | 'barracks' | 'gate';

export interface AreaDef {
  region: Region;
  kind: AreaKind;
  /** Mine depth: 1 upper galleries, 2 lower workings, 3 the Deep (sealed until opened). 0 in the town. */
  depth: number;
  /** Crystal richness of its vein (0: none). */
  vein: number;
  /** Lit by the Flame (the gold shrine, the temple). */
  flame: boolean;
  /** Watched by the Council: a follower who walks in unsanctioned raises its heat. */
  watched: boolean;
  /** Always yours (the grave). */
  anchored: boolean;
  /** A follower standing here opens the way to the next stage (the pit head). */
  gate: boolean;
  /** Shut while the Council's lockdown lasts. */
  sealable: boolean;
  /** Public eyes: multiplies the public heat each follower standing here draws. */
  exposure: number;
  /** Extra heat per follower head per dawn in a watched block. */
  patrol: { faction: FactionId; perHead: number } | null;
  /** Work a follower can do here beyond their trade. */
  yield: 'gather' | 'fence' | 'skim' | null;
}

const MINE: Omit<AreaDef, 'kind' | 'depth'> = {
  region: 'mine', vein: 0, flame: false, watched: false, anchored: false, gate: false, sealable: false, exposure: 1, patrol: null, yield: null,
};
const TOWN: Omit<AreaDef, 'kind' | 'depth'> = { ...MINE, region: 'town', exposure: BALANCE.townExposure };
const mine = (kind: AreaKind, depth: number, o: Partial<AreaDef> = {}): AreaDef => ({ ...MINE, kind, depth, ...o });
const town = (kind: AreaKind, o: Partial<AreaDef> = {}): AreaDef => ({ ...TOWN, kind, depth: 0, ...o });
const council = (perHead: number): AreaDef['patrol'] => ({ faction: 'council', perHead });
const temple = (perHead: number): AreaDef['patrol'] => ({ faction: 'temple', perHead });

export const AREAS: Readonly<Record<PlaceId, AreaDef>> = {
  // the mine: 12 areas
  grave: mine('grave', 2, { vein: 1, anchored: true }),
  heartvein: mine('gallery', 2, { vein: 2 }),
  cartway: mine('junction', 1),
  westdrift: mine('tunnel', 1, { vein: 1 }),
  kilnshrine: mine('shrine', 1, { flame: true }),
  bunks: mine('quarters', 1),
  overseer: mine('post', 1, { watched: true }),
  lift: mine('shaft', 1, { watched: true, sealable: true }),
  sorting: mine('works', 1, { yield: 'skim' }),
  eastworks: mine('works', 1, { vein: 2 }),
  lowgallery: mine('loop', 2, { vein: 1 }),
  sump: mine('pool', 3, { vein: 1 }),
  // the town of Deepwell: 13 blocks
  minehead: town('pithead', { gate: true, sealable: true }),
  slagrows: town('shanties', { exposure: BALANCE.shantyExposure }),
  gravefield: town('graveyard', { yield: 'gather', patrol: temple(BALANCE.graveyardCultPerHead) }),
  haulyard: town('yard'),
  smeltery: town('smelter', { yield: 'skim' }),
  market: town('square', { yield: 'fence', exposure: BALANCE.marketExposure }),
  wellsquare: town('well', { exposure: BALANCE.marketExposure }),
  sporegardens: town('gardens'),
  highwarrens: town('houses', { patrol: temple(BALANCE.templeCultPerHead) }),
  kilntemple: town('temple', { flame: true, patrol: temple(BALANCE.templeCultPerHead) }),
  tallyhall: town('hall', { watched: true, patrol: council(BALANCE.keepGovPerHead) }),
  garrison: town('barracks', { watched: true, patrol: council(BALANCE.keepGovPerHead) }),
  citygate: town('gate', { watched: true, patrol: council(BALANCE.keepGovPerHead) }),
};

/** The Deep: sealed until a Delve or a discovery opens it. */
export const DEEP: PlaceId = 'sump';
/** The lift joins the mine to the town. */
export const LIFT_LINK: readonly [PlaceId, PlaceId] = ['lift', 'minehead'];

/** The ways between areas: the mine's tunnels (DECISIONS §6), the lift, the town's streets (§7). */
export const AREA_EDGES: readonly (readonly [PlaceId, PlaceId])[] = [
  ['grave', 'heartvein'], ['grave', 'cartway'], ['heartvein', 'eastworks'], ['cartway', 'westdrift'], ['cartway', 'sorting'],
  ['cartway', 'lowgallery'], ['cartway', 'bunks'], ['westdrift', 'kilnshrine'], ['westdrift', 'bunks'], ['bunks', 'overseer'],
  ['overseer', 'lift'], ['sorting', 'eastworks'], ['sorting', 'lift'], ['lowgallery', 'sump'], ['sump', 'eastworks'],
  LIFT_LINK,
  ['minehead', 'slagrows'], ['minehead', 'haulyard'], ['slagrows', 'wellsquare'], ['slagrows', 'gravefield'], ['haulyard', 'smeltery'],
  ['haulyard', 'market'], ['smeltery', 'market'], ['market', 'wellsquare'], ['wellsquare', 'sporegardens'], ['wellsquare', 'highwarrens'],
  ['market', 'tallyhall'], ['tallyhall', 'garrison'], ['tallyhall', 'highwarrens'], ['highwarrens', 'kilntemple'], ['sporegardens', 'kilntemple'],
  ['garrison', 'citygate'], ['market', 'citygate'],
];

/** Each area's neighbours, in edge order. */
export const NEIGHBOURS: Readonly<Record<PlaceId, readonly PlaceId[]>> = Object.fromEntries(
  Object.keys(AREAS).map((a) => [a, AREA_EDGES.flatMap(([x, y]) => (x === a ? [y] : y === a ? [x] : []))]),
);

/** Travel in ticks: one area to the next, the lift's ride, and between two places of one area. */
export const TRAVEL = { hop: 9, lift: 15, within: 3 } as const;

/** What a place is, as the people's days use it (work, meals, prayer, sleep, shelter). */
export type PlaceKind =
  | 'face' | 'gallery' | 'works' | 'junction' | 'shrine' | 'quarters' | 'post' | 'shaft' | 'pool' | 'grave' | 'stable'
  | 'yard' | 'tavern' | 'chapel' | 'temple' | 'market' | 'well' | 'washplace' | 'shop' | 'workshop' | 'hall'
  | 'barracks' | 'gate' | 'graveyard' | 'gardens' | 'street' | 'school' | 'inn' | 'road';

export interface PlaceDef {
  area: PlaceId;
  kind: PlaceKind;
  indoor: boolean;
  /** The bench a building gives once it is yours (#30, #119). */
  facility?: Facility;
  /** The gift a building gives once it is yours, used as an action (`useGift`). */
  gift?: Gift;
  /**
   * What a building gives standing, once it is yours (balance's GIFTS): a link of the crystals' road adds a tithe roll a
   * day; the school puts every household with a child there in reach. A home's is the hearth.
   */
  boon?: 'road' | 'lesson';
  /** Mastered by an officer of the three powers when nobody there is titled. */
  officer?: UnitId;
  /** Nobody masters it: it is yours when its area takes root. */
  unmastered?: true;
}

const p = (area: PlaceId, kind: PlaceKind, indoor: boolean, o: Partial<PlaceDef> = {}): PlaceDef => ({ area, kind, indoor, ...o });

/** Every place but the homes (`home:<area>:<slot>`, one per household, made from the seed). */
export const PLACES: Readonly<Record<PlaceId, PlaceDef>> = {
  // the mine (underground counts as indoor)
  grave: p('grave', 'grave', true),
  heartvein: p('heartvein', 'gallery', true),
  cartway: p('cartway', 'junction', true),
  beaststalls: p('cartway', 'stable', true),
  westdrift: p('westdrift', 'face', true),
  kilnshrine: p('kilnshrine', 'shrine', true),
  bunks: p('bunks', 'quarters', true),
  pitkitchen: p('bunks', 'quarters', true),
  overseer: p('overseer', 'post', true),
  lift: p('lift', 'shaft', true),
  sorting: p('sorting', 'works', true),
  eastworks: p('eastworks', 'face', true),
  lowgallery: p('lowgallery', 'face', true),
  powderstore: p('lowgallery', 'works', true),
  sump: p('sump', 'pool', true),
  pumphouse: p('sump', 'works', true),
  // the rows
  pithead: p('minehead', 'yard', false, { unmastered: true }),
  tallyhouse: p('minehead', 'hall', true, { facility: 'falseWeights' }),
  lamphouse: p('minehead', 'workshop', true, { facility: 'lamps' }),
  rows: p('slagrows', 'street', false),
  tavern: p('slagrows', 'tavern', true, { gift: 'rumour' }),
  tannery: p('slagrows', 'workshop', true, { facility: 'clothing' }),
  graveyard: p('gravefield', 'graveyard', false, { unmastered: true }),
  // the works
  haulyard: p('haulyard', 'yard', false, { boon: 'road' }),
  stables: p('haulyard', 'stable', true, { boon: 'road' }),
  cartshed: p('haulyard', 'workshop', true, { boon: 'road' }),
  smelter: p('smeltery', 'workshop', true),
  forge: p('smeltery', 'workshop', true, { facility: 'jewelry' }),
  // the market
  market: p('market', 'market', false, { officer: 'e04', gift: 'food' }),
  gemworks: p('market', 'workshop', true, { facility: 'faceting' }),
  bakery: p('market', 'shop', true, { gift: 'food' }),
  chandlery: p('market', 'shop', true, { gift: 'food' }),
  pawnshop: p('market', 'shop', true, { gift: 'debt' }),
  well: p('wellsquare', 'well', false, { unmastered: true }),
  washplace: p('wellsquare', 'washplace', false, { unmastered: true }),
  apothecary: p('wellsquare', 'shop', true, { facility: 'draughts' }),
  alehouse: p('wellsquare', 'tavern', true, { gift: 'rumour' }),
  school: p('wellsquare', 'school', true, { boon: 'lesson' }),
  loomhouse: p('wellsquare', 'workshop', true, { facility: 'clothing' }),
  gardens: p('sporegardens', 'gardens', false, { facility: 'brew' }),
  brewhouse: p('sporegardens', 'workshop', true, { facility: 'brew' }),
  pottery: p('sporegardens', 'workshop', true, { facility: 'brew' }),
  // temple hill
  highhouses: p('highwarrens', 'street', false),
  chapel: p('highwarrens', 'chapel', true, { facility: 'profaning' }),
  temple: p('kilntemple', 'temple', true, { facility: 'profaning', officer: 'e03' }),
  templesteps: p('kilntemple', 'street', false),
  // the keep
  councilhall: p('tallyhall', 'hall', true, { officer: 'e01' }),
  vault: p('tallyhall', 'hall', true, { officer: 'e01' }),
  scriptorium: p('tallyhall', 'workshop', true, { officer: 'e01', gift: 'records' }),
  barracks: p('garrison', 'barracks', true, { officer: 'e02', gift: 'guards' }),
  drillyard: p('garrison', 'yard', false, { officer: 'e02', gift: 'guards' }),
  gate: p('citygate', 'gate', false, { officer: 'e02' }),
  inn: p('citygate', 'inn', true),
  road: p('citygate', 'road', false, { unmastered: true }),
  ropewalk: p('citygate', 'workshop', false),
};
