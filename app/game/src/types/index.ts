// The cross-track contract of the game (docs/rebuild.md), with its seams in tracks.ts. Types only: no values.
// sim implements Sim and Query and owns GameState; content owns every table and word keyed by these ids;
// view and ui read Readonly<GameState> through Query and never write it; app owns the clock, the pump,
// input routing and the save. A change here is a change to every track: make it in one commit that
// updates every implementer.

// ---------- time (the live clock, LIVE row) ----------

/** Sim ticks since the run began (at the dusk); one day is DAY_TICKS (1200). */
export type Tick = number;
/** Hour of the day, 0..24, derived from the tick by the sim (`Query.hour`). One clock for day, light and animation. */
export type Hour = number;
export type Weekday = 'work' | 'payday' | 'cart' | 'flame' | 'rest';
export type Weather = 'clear' | 'overcast' | 'drizzle' | 'rain' | 'storm' | 'fog' | 'wind' | 'cold';
/** The part of the day the clock is in; dusk carries the offering, the ledger and the deal. */
export type DayPart = 'night' | 'dawn' | 'shift' | 'dusk';

// ---------- ids ----------
// Spec-fixed sets are unions; content-driven sets are string keys into content's tables (tests check them).

export type Seed = number;
export type UnitId = string;
/** A place in the one world graph: mine areas and faces, the pit head, every town building, home and street node. */
export type PlaceId = string;
export type CrystalId = string;
export type CardId = string;
export type BlessingId = string;
export type RoleId = string;
export type TraitId = string;
export type BaseId = string;
export type ModId = string;
export type OddEffectId = string;
export type ThreatId = string;
/** A world event's id (wedding, brawl, inspector...) from content's event table. */
export type StoryId = string;
/** bonus: the opening's last frame, pick 1 of 3. live: the clock runs. won: the mine is taken. lost: Ichor 0 or rooted out. */
export type Phase = 'live' | 'won' | 'lost';
export type Standing = 'mortal' | 'elite' | 'blessed' | 'demigod' | 'god';
export type FactionId = 'temple' | 'council' | 'public';
export type Grade = 'dull' | 'clear' | 'bright' | 'blazing' | 'royal' | 'impossible';
export type Affinity = 'hunger' | 'malice' | 'faith' | 'fear' | 'blood' | 'shadow' | 'stone' | 'echo' | 'flame';
export type Routine = 'pray' | 'offer' | 'lieLow' | 'delve' | 'skim';
export type Visibility = 'active' | 'sensed' | 'void';
export type CardKind = 'miracle' | 'evil';
/** The opposition's moves, by power: council, temple, public (content's THREATS). */
export type ThreatKind =
  | 'inspection' | 'crackdown' | 'lockdown'
  | 'vigil' | 'inquisitor' | 'purge' | 'crusade'
  | 'bolted' | 'mob' | 'riot';
/** What blunts a move: an act of evil, lying low, cooling the power, turning the one sent. */
export type Answer = 'evil' | 'hide' | 'cool' | 'agent';
/** What an area hides until a follower explores it (content's DISCOVERIES). */
export type DiscoveryKind = 'cache' | 'seam' | 'loner' | 'shortcut' | 'relic' | 'danger' | 'none';
/** How a person left: eaten by you, taken or burned by the powers, dead by any other hand, or marched off. */
export type GoneReason = 'devoured' | 'taken' | 'burned' | 'dead' | 'conscripted';
/**
 * What a person is doing, as the rules say. The view picks the people parts' pose and the life atlas's
 * props from it; nothing else decides a pose.
 */
export type Activity =
  | 'sleep' | 'walk' | 'dig' | 'haul' | 'sort' | 'work' | 'eat' | 'drink' | 'talk'
  | 'pray' | 'guard' | 'search' | 'idle' | 'offer' | 'mourn';

// ---------- state (owned by sim; plain JSON, the save is this) ----------

/** mulberry32's one uint32 (sim/rng.ts): a save resumes the exact stream. */
export interface RngState { s: number }

/** Devotion 0..100; the body's four 1..20; HP now (its top is `maxHp` in sim/host.ts). Resistance 0..100 is `Person.resistance`. */
export interface Stats { devotion: number; dexterity: number; intelligence: number; strength: number; endurance: number; hp: number }

/** Where a person is this tick. A walk names its route on the world graph; the view interpolates the content coords. */
export type Whereabouts =
  | { place: PlaceId; spot: number; doing: Activity }
  | { route: PlaceId[]; from: Tick; to: Tick; doing: 'walk' };

export interface Person {
  id: UnitId;
  name: string;
  role: RoleId;
  trait: TraitId;
  standing: Standing;
  stats: Stats;
  resistance: number;
  /** Where they sleep: the bunks (a loner found in hiding, the place they hide). */
  home: PlaceId;
  work: PlaceId;
  /** People they are tied to; what each tie is, read the same from both ends, is `Query.tieKind`. */
  ties: UnitId[];
  at: Whereabouts;
  follower: boolean;
  routine: Routine | null;
  /** Crystals pocketed on their person. */
  pocket: CrystalId[];
  /** Searches that caught them; at content's limit they are taken. */
  caught: number;
  gone: GoneReason | null;
  /** The day they went (with `gone`): the world's events that follow a going read it. */
  goneDay?: number;
  /** The day they were last whispered to (one whisper a person a day). */
  whispered?: number;
  /** The day the host last marked them: a whisper may reach them for `HOST.markDays` days from it. */
  marked?: number;
  /** The highest Devotion milestone (25/50/75/100) already paid out as XP. */
  mark?: number;
}

export interface PlaceState {
  id: PlaceId;
  /** 0..100: the share of the place in your colour. Influence is the sum. */
  hold: number;
  explored: boolean;
  /** In colour: the acts done here crossed the colour threshold (sim/colour.ts), or the grave and its ring at the start; never lost. */
  coloured: boolean;
  /** Acts done here that count toward the threshold, the days they were done on, and the last such day (-1: none). */
  acts: number;
  actDays: number;
  lastAct: number;
  /** What it hides (content's DISCOVERIES) was found: sticky, once a run. */
  found: boolean;
  /** Hold reached 100; lost again below content's `rootLostBelow` (and an Ichor with it). */
  rooted: boolean;
  /** Rich seams found here: each adds content's `seamBonus` to the face's strikes. */
  seam?: number;
  /** A Flame source fouled for good: its light no longer pushes colour back. */
  desecrated?: boolean;
}

/**
 * Everything that lasts a while, in one list: a lockdown on a place, a card's "tomorrow", a blessed or
 * sick person, a faction looking away. It holds until `until`; `on` is the place, person or faction it is on.
 */
export interface Effect {
  kind: 'lockdown' | 'snuffed' | 'veinSight' | 'bloom' | 'divert' | 'rob' | 'sabotage' | 'blindEye' | 'noSearch'
    | 'blessed' | 'sick' | 'dream' | 'sure' | 'used'
    /**
     * On a faction, a power's own state: resting after a move (`rest`), the crusade's burning (`kindling`). The rest
     * are a world event's doors (content's worldEvents): a rule number at a place, an area, a faction or a person.
     */
    | 'rest' | 'kindling'
    | 'crew' | 'strike' | 'search' | 'guards' | 'notice' | 'whisper' | 'whisperZone' | 'countTolerance' | 'crowd' | 'reach';
  on?: string;
  until: Tick;
  /** Who did it (a follower robbing a cart keeps the share). */
  by?: UnitId;
  /** Its strength: the Malice bonus a robbed or sabotaged cart was struck with; a multiplier (crew, strike, search, notice, countTolerance, crowd), a count (guards), odds added (whisper, whisperZone, reach). */
  value?: number;
}

export interface Mod { id: ModId; tier: number; value: number; curse: boolean }

export interface Crystal {
  id: CrystalId;
  /** The roll's own seed: the view's baked shape is chosen from it, the name and numbers come from it. */
  seed: number;
  grade: Grade;
  base: BaseId;
  affinity: Affinity;
  mods: Mod[];
  odd: OddEffectId | null;
  /** Modifier slots: the grade's slots plus the base's. */
  slots: number;
  /** The depth it was struck at (1..3): enchanting draws from that vein level's pool. */
  depth: number;
  /** A Flame stone profaned by an act of evil: no price, no quarrel. */
  profaned?: boolean;
  /** The real odds of this roll: 1 in `oneIn`. The reveal, sound and effect scale with it. */
  oneIn: number;
  name: string;
  /** Where it is: the grave pouch, a socket, a person's pocket, a cart. */
  at: { pouch: true } | { socket: number } | { pocket: UnitId } | { cart: PlaceId };
}

/** A power's heat, its level, and the highest level whose move it has called (falls back with the level). */
export interface Faction { suspicion: number; level: 0 | 1 | 2 | 3 | 4; called: number }

/** An opposition move walking the world: announced, then it lands unless answered. */
export interface Threat {
  id: ThreatId;
  faction: FactionId;
  kind: ThreatKind;
  target: PlaceId | UnitId;
  lands: Tick;
  /** The people walking it (guards, the inquisitor, the mob): visible in the world. */
  walkers: UnitId[];
}

export interface God {
  level: number; // Divinity 1..15 (slice: 1..6, 7 ends it)
  xp: number;
  nether: number;
  ichor: number;
  hunger: number;
  malice: number;
  /** Action points: regenerate over the day on the clock (LIVE); fractional between whole points. */
  ap: number;
  apMax: number;
  sockets: (CrystalId | null)[];
  blessings: BlessingId[];
  /** Cards held, at most content's hand size. */
  hand: CardId[];
  /** The set of three dealt at dusk on the table: take one into the hand or none. */
  deal: CardId[] | null;
  rerolls: number;
  /** Cards played since the last deal: the first is free, each later one costs Nether. */
  played: number;
  /** Whispers that cost no action point until the next dusk (Murmur, Borrowed Tongue). */
  free: number;
  /** Whisper odds added until the next dusk (Borrowed Tongue). */
  boost: number;
}

/** A choice the player owes before the clock moves on: a blessing pick, a world event's door. */
export type Pending =
  | { kind: 'blessing'; offers: BlessingId[] }
  | { kind: 'story'; story: StoryId; options: number; unit?: UnitId; unit2?: UnitId; place?: PlaceId; count?: number };

/**
 * The possessed host's body in the mine (mine units, sim/walk.ts): where it stands and faces, its heading (0 0 at rest), the
 * distance walked, the ore it works (an index of content's `ORE_SITES`) with the seconds worked on it, and the day's tallies:
 * stones dug, stones delivered to the drop.
 */
export interface Body {
  x: number; y: number; face: 1 | -1; dx: number; dy: number; walked: number; ore: number | null; work: number; dug: number; delivered: number;
  /** The pick swing: seconds into it (-1 at rest) and the unit vector it aims along (OVERHAUL, ov-combat). */
  swing: number; ax: number; ay: number;
}

/**
 * A skeleton out of the mine's dark (OVERHAUL, ov-combat): only Hit Points and a blow (content's COMBAT), walking the host's ground.
 * `lx, ly` are where it stood a tick ago (the view shows it moving from there); `swing` the seconds into its blow (-1 at rest);
 * `down` the seconds since it was slain (-1 standing), `stuck` the seconds it has been walking and getting nowhere.
 */
export interface Mob { id: UnitId; x: number; y: number; lx: number; ly: number; face: 1 | -1; dx: number; dy: number; walked: number; hp: number; swing: number; down: number; stuck: number }

export interface GameState {
  /** The state's shape: a save of another is dropped. */
  v: 7;
  seed: Seed;
  rng: RngState;
  tick: Tick;
  /** The tick the clock runs to: it stands there (the player's turn, the night) until an action moves it on or the day sets it. */
  until: Tick;
  phase: Phase;
  weather: Weather;
  /** The way the wind blows, radians in the world frame (0 east, a quarter turn south), set with the weather by the hour. */
  wind: number;
  god: God;
  people: Record<UnitId, Person>;
  places: Record<PlaceId, PlaceState>;
  crystals: Record<CrystalId, Crystal>;
  factions: Record<FactionId, Faction>;
  threats: Threat[];
  pending: Pending | null;
  /** Who the god possesses: set at a dawn, null at the dusk and the host's fall, and at a dawn until the player picks. */
  host: UnitId | null;
  /** The host's body in the mine while they stand by day; null otherwise. */
  body: Body | null;
  /** The skeletons about the host, by day while a host stands; none otherwise. */
  mobs: Mob[];
  /** The day each ore site was last mined (-1: never): it stands again from the next day. */
  ores: number[];
  effects: Effect[];
  /** The next id for a crystal or a threat. */
  next: number;
  /**
   * The mine's day: each face's cart (grades) and what the Council expects of the day's swings, until the count;
   * short counts in a row; follower-days dug toward the Deep.
   */
  mine: { carts: Record<PlaceId, number[]>; expected: number; shortDays: number; delve: number };
  /** The Deep is open; the lift (the way up) took root. Sticky facts the rules gate on. */
  flags: { deepOpen: boolean; liftRooted: boolean };
  /** The day's running ledger, cleared at dawn: what the day gave and cost. */
  ledger: { crystals: number; nether: number; turned: number; lost: number; suspicion: Record<FactionId, number> };
  /**
   * The whole run, never cleared (the defeat's lines): everyone ever turned, the most followers at once, whispers
   * spoken, the card kept from the opening's deal.
   */
  tally: { turned: number; peak: number; whispers: number };
}

// ---------- actions (the only way anything changes the state) ----------

export type Action =
  | { type: 'pickBlessing'; blessing: BlessingId }
  | { type: 'whisper'; target: UnitId }
  | { type: 'setRoutine'; unit: UnitId; routine: Routine }
  | { type: 'move'; unit: UnitId; to: PlaceId }
  | { type: 'take'; card: CardId | null }
  | { type: 'discard'; card: CardId }
  | { type: 'reroll' }
  | { type: 'play'; card: CardId; pay: CrystalId[]; target?: UnitId | PlaceId }
  | { type: 'eat'; crystal: CrystalId }
  | { type: 'set'; crystal: CrystalId; socket: number }
  | { type: 'unset'; crystal: CrystalId }
  | { type: 'enchant'; crystal: CrystalId; reroll?: number }
  | { type: 'recombine'; a: CrystalId; b: CrystalId }
  /** Lay every follower exposed to the move low: the one answer that is an action. */
  | { type: 'answer'; threat: ThreatId }
  | { type: 'story'; option: number }
  /** By day: the host marks someone near them, whom a whisper may then reach. */
  | { type: 'mark'; target: UnitId }
  /** By day: the host's heading (each -1, 0 or 1), held until the next; the body walks it each tick. */
  | { type: 'walk'; dx: -1 | 0 | 1; dy: -1 | 0 | 1 }
  /** By day: the host swings the pick toward (dx, dy), the click's direction, once the swing before it is done. */
  | { type: 'swing'; dx: number; dy: number }
  /** By day: the work key, at an ore mine it (again: stop), at the drop deliver the lowest stone pocketed. */
  | { type: 'work' }
  /** At the dawn: pick the follower (or the first miner) to possess for the day. */
  | { type: 'possess'; unit: UnitId }
  /** At night: burn stones to bring a fallen follower back at full HP. */
  | { type: 'revive'; unit: UnitId }
  /** Skip the rest of the night to dawn. */
  | { type: 'sleep' };

/** Why an action is refused, or why its odds are what they are: a content word key plus slots. */
export interface Reason { key: string; slots?: Record<string, string | number> }

/** What an action would cost and do, shown before the player commits (odds say why). */
export interface Check {
  ok: boolean;
  why: Reason[];
  ap: number;
  nether: number;
  crystals: number;
  /** 0..1 for chance actions (whisper, move), else undefined. */
  odds?: number;
}

// ---------- events (the sim's output each step; view, ui and audio react, never the sim) ----------

interface At { tick: Tick; place?: PlaceId; unit?: UnitId }
/** A line for the day's feed, the note under the host's plate (a click looks at where it happened). */
export interface Note { key: string; slots?: Record<string, string | number> }

export type GameEvent = At & (
  | { kind: 'dawn' | 'shiftStart' | 'shiftEnd' | 'dusk' | 'night'; weekday: Weekday }
  | { kind: 'weather'; weather: Weather }
  /** A strike: a follower's stone is a crystal in their pocket; anyone else's is a grade in the face's cart. */
  | { kind: 'strike'; crystal: CrystalId | null; grade: Grade; oneIn: number }
  /** A stone's way: a pocket, a cart, a follower's tribute or offering at dusk, or the grave's own seep (`place` grave). */
  | { kind: 'pocket' | 'cart' | 'tribute' | 'offer' | 'seep'; crystal: CrystalId }
  | { kind: 'count'; short: number; forgiven: boolean }
  | { kind: 'search'; found: CrystalId[] }
  | { kind: 'whisper'; ok: boolean; odds: number }
  /** `lost`: a follower lapses or leaves the world; `gone`: anyone else leaves it (burned, taken, dead). */
  | { kind: 'turned' | 'lost' | 'gone' }
  | { kind: 'routine'; routine: Routine }
  | { kind: 'moved'; ok: boolean; to: PlaceId }
  | { kind: 'deal'; cards: CardId[] }
  | { kind: 'took' | 'discarded'; card: CardId | null }
  | { kind: 'play'; card: CardId; cardKind: CardKind; by: 'god' | 'follower'; burnt: CrystalId[] }
  | { kind: 'eat' | 'set' | 'unset' | 'enchant' | 'curse' | 'recombine'; crystal: CrystalId }
  | { kind: 'devour' }
  /** The god takes a host (`unit`) at the dawn and lets go at the dusk or the host's fall; a mark and a revival name their person. */
  | { kind: 'possess' | 'release' | 'marked' | 'revived' | 'coloured' }
  /** A blow lands on `unit` (the host or a skeleton) for `amount`; a skeleton slain (`unit`) may leave Nether. */
  | { kind: 'hit'; amount: number }
  | { kind: 'slain'; nether: number }
  | { kind: 'hold'; hold: number; was: number }
  | { kind: 'suspicion'; faction: FactionId; level: number; was: number }
  | { kind: 'threat'; threat: ThreatId; how: 'announced' | 'landed' | 'answered' }
  | { kind: 'ichor' | 'hunger' | 'malice' | 'nether' | 'xp'; delta: number }
  | { kind: 'starve' | 'lashOut' }
  | { kind: 'rank'; level: number }
  | { kind: 'deepOpen' }
  /** What an area hid is found (`place`; `unit` the follower who found it). */
  | { kind: 'found'; discovery: DiscoveryKind }
  | { kind: 'story'; story: StoryId }
  | { kind: 'end'; won: boolean; why: Reason }
) & { note?: Note };

export type EventKind = GameEvent['kind'];

export type * from './tracks';
