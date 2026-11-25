/**
 * Where the one world graph lies (#50): every area, place and home lot a point, every step of a route a line, every
 * place its standing spots. The data is map.json; each region has its own frame. The town is TOWN.w by TOWN.h town
 * units; the mine is MINE.w by MINE.h mine units, nested in the pit head's floor at (MINE.x, MINE.y) at 1/MINE.per.
 * A place's point and spots are in its region's frame. The lift's ride (lift to minehead) has no line: it runs down
 * the shaft from SHAFT.town to SHAFT.mine.
 */
import raw from './map.json';
import rawDress from './dress.json';
import type { Activity, PlaceId } from '../types';

/** x, y pairs, flat. */
export type Line = readonly number[];
/** x, y, facing (1 right, -1 left) triples, flat. */
export type SpotList = readonly number[];

interface MapData {
  town: { w: number; h: number };
  mine: { x: number; y: number; w: number; h: number; per: number };
  shaft: { mine: [number, number]; town: [number, number] };
  trees: [number, number][];
  at: Record<PlaceId, [number, number]>;
  ways: Record<string, Line>;
  spots: Record<PlaceId, Partial<Record<Activity | '*', SpotList>>>;
}
const MAP = raw as unknown as MapData;

export const TOWN = MAP.town;
export const MINE_FRAME = MAP.mine;
export const SHAFT = MAP.shaft;
/** The town's cap-trees' feet (town units), in the order assets/town bakes them. */
export const TREES: readonly (readonly [number, number])[] = MAP.trees;
/** Each area's, place's and home lot's point (a building's doorstep, an area's heart). */
export const AT: Readonly<Record<PlaceId, readonly [number, number]>> = MAP.at;

/** map.json stores each way one way (`a>b`); both directions are read from here. */
const WAYS = new Map<string, Line>();
for (const [k, line] of Object.entries(MAP.ways)) {
  const [a, b] = k.split('>');
  const back: number[] = [];
  for (let i = line.length - 2; i >= 0; i -= 2) back.push(line[i]!, line[i + 1]!);
  WAYS.set(k, line).set(`${b}>${a}`, back);
}

/** The line walked between two neighbours of a route (a place and its area, or two areas), from `a` to `b`. */
export function way(a: PlaceId, b: PlaceId): Line {
  const line = WAYS.get(`${a}>${b}`);
  if (!line) throw new Error(`no way ${a}-${b}`);
  return line;
}

/** A light burning in the mine (mine units): its pool's reach `r`, colour and strength `k`, its halo and squash. */
export interface MineLight { x: number; y: number; r: number; color: string; k: number; kind: string; area: PlaceId; bloom?: number; sy?: number }
export interface MineFlame { x: number; y: number; size: number; kind: 'torch' | 'candle' | 'brazier' | 'shrine' | 'lamp' | 'tally'; area: PlaceId }
export interface MineGlint { x: number; y: number; size: number; area: PlaceId }
/**
 * The mine's dressing (#59), from dress.json: every prop and set piece is in the lit picture (assets' lit-1 and
 * night-1); what moves over it is here: the lights' flicker, the flames, the crystals' glints, and the points the
 * films and effects aim at.
 */
export const DRESS = rawDress as unknown as {
  lights: readonly MineLight[];
  flames: readonly MineFlame[];
  glints: readonly MineGlint[];
  points: {
    shrineFire: { x: number; y: number }; shrineEye: { x: number; y: number };
    graveEye: { x: number; y: number; rx: number; ry: number }; crystalHeart: { x: number; y: number };
    liftWheel: { x: number; y: number }; tallyLamp: { x: number; y: number };
  };
};

/**
 * Where people stand at a place for what they do: `doing`'s own spots (a face to dig, a cot to sleep) or the place's
 * standing room (`*`). A person's stable spot number wraps over the list. Indoor town places and homes have none:
 * their people are inside.
 */
export const spotsOf = (place: PlaceId, doing: Activity): SpotList | undefined => {
  const s = MAP.spots[place];
  return s && (s[doing] ?? s['*']);
};
