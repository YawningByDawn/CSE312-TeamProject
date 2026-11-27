// The arena's messages, as the hub (app/websocket/arena.go) sends them.

export interface Species {
  name: string;
  r: number;
  xp: number; // xp it takes to become this species
  speed: number;
  view: number; // the height of the world a player of it sees
  hides: boolean;
  swims: boolean;
}

export interface FoodKind {
  name: string;
  r: number;
  xp: number;
  hunger: number;
}

export interface Circle {
  x: number;
  y: number;
  r: number;
}

export interface World {
  type: 'world';
  w: number;
  h: number;
  tick: number; // state messages a second
  boost: number; // seconds between boosts
  species: Species[];
  foods: FoodKind[];
  ponds: Circle[];
  bushes: Circle[];
}

export interface MeAlive {
  alive: true;
  id: number;
  sp: number;
  xp: number;
  hp: number;
  hunger: number;
  cooldown: number;
  kills: number;
}

export interface MeDead {
  alive: false;
  by: string; // '' when they starved
  bySp: number;
  sp: number;
  xp: number;
  kills: number;
  secs: number;
}

export interface BoardRow {
  name: string;
  xp: number;
  sp: number;
  bot?: boolean;
}

/** id, x, y, angle, tier, hp, flags, name */
export type CreatureRow = [number, number, number, number, number, number, number, string];
/** id, x, y, kind */
export type FoodRow = [number, number, number, number];
/** 0 food or 1 creature, its id, the id of who ate it */
export type EatRow = [number, number, number];

export interface StateMessage {
  type: 'state';
  t: number;
  x: number;
  y: number;
  me: MeAlive | MeDead | null;
  c: CreatureRow[];
  f: FoodRow[];
  e: EatRow[];
  lb: BoardRow[];
}

export const HIDDEN = 1;
export const BOOSTING = 2;
export const BOT = 4;
export const GUARDED = 8;
export const WET = 16;

export interface Creature {
  id: number;
  x: number;
  y: number;
  a: number;
  sp: number;
  hp: number;
  flags: number;
  name: string;
}

export interface Food {
  id: number;
  x: number;
  y: number;
  kind: number;
}

/** One state message, kept to interpolate between. */
export interface Snap {
  t: number;
  x: number;
  y: number;
  me: MeAlive | MeDead | null;
  creatures: Map<number, Creature>;
  food: Map<number, Food>;
  eaten: EatRow[];
  board: BoardRow[];
  played: boolean; // its events have been shown
}
