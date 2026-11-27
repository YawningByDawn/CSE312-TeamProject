// The arena's messages, as the hub (app/websocket/arena.go) sends them.

export interface Ability {
  name: string;
  kind: 'charge' | 'stomp' | 'spit' | 'pull';
  style: string; // dust, quake, roar, wind, fire, venom, ink, water or gaze
  cooldown: number;
}

export interface Species {
  name: string;
  tier: number;
  hp: number; // health, full
  atk: number; // what a bite takes, before levels
  r: number;
  speed: number;
  view: number; // the height of the world a player of it sees
  habitat: 'land' | 'sea' | 'amph' | 'air';
  hides: boolean;
  next: number[]; // what it can evolve into
  ability: Ability;
}

export interface FoodKind {
  name: string;
  r: number;
  xp: number;
  hunger: number;
  sea: boolean;
  full: boolean; // feeds big creatures as much as small ones
}

/** A place that grows food: a ginkgo tree, termite mound, nest, bones, sea vent, or a pond's lilies. */
export interface Source {
  kind: 'tree' | 'mound' | 'nest' | 'bones' | 'vent' | 'lilies';
  x: number;
  y: number;
  r: number;
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
  coast: number[]; // the sea starts coast[i] px from the west, at y = i * coastStep
  coastStep: number;
  needs: number[]; // xp to gain at each tier before evolving
  maxLevel: number;
  species: Species[];
  foods: FoodKind[];
  ponds: Circle[];
  bushes: Circle[];
  kelp: Circle[];
  islands: Circle[];
  tar: Circle[];
  rocks: Circle[]; // crags on land: only climbers (up to climbTier) and fliers get on
  reefs: Circle[]; // and at sea
  sources: Source[];
  climbTier: number;
}

export interface MeAlive {
  alive: true;
  id: number;
  sp: number;
  xp: number;
  progress: number; // xp toward the next evolution
  hp: number;
  maxHp: number;
  hunger: number;
  cooldown: number; // seconds until the boost is ready
  abilityCd: number;
  kills: number;
  offer: number[] | null; // what it may evolve into now
  points: number;
  bite: number; // levels
  ability: number;
  health: number;
  speed: number;
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

/** id, x, y, angle, species, hp %, flags, name */
export type CreatureRow = [number, number, number, number, number, number, number, string];
/** id, x, y, kind */
export type FoodRow = [number, number, number, number];
/** 0 food or 1 creature, its id, the id of who ate it */
export type EatRow = [number, number, number];
/** id, x, y, the species that spat it */
export type ShotRow = [number, number, number, number];

export interface StateMessage {
  type: 'state';
  t: number;
  x: number;
  y: number;
  me: MeAlive | MeDead | null;
  c: CreatureRow[];
  f: FoodRow[];
  p: ShotRow[];
  e: EatRow[];
  lb: BoardRow[];
}

export const HIDDEN = 1;
export const BOOSTING = 2;
export const BOT = 4;
export const GUARDED = 8;
export const WET = 16;
export const USING = 32; // its ability
export const CHARGING = 64;
export const HURT = 128; // just now

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
  shots: Map<number, { id: number; x: number; y: number; sp: number }>;
  eaten: EatRow[];
  board: BoardRow[];
  played: boolean; // its events have been shown
}
