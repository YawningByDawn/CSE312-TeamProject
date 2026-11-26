import type { Container } from 'pixi.js';
import type { Action, CardId, Check, CrystalId, DayPart, EventKind, Facility, GameEvent, GameState, GroupId, Hour, Person, PlaceId, Reason, Seed, StageId, Tick, UnitId, Visibility, Weekday } from './index';

// The seams of the cross-track contract (index.ts): the sim's interface, the view model, the tracks' interfaces, the save,
// the atlases, the debug API and the profiler's report.

// ---------- the sim (src/sim implements; deterministic from seed, tick and the action log) ----------

export interface CreateOptions { stage?: StageId }

export interface Sim {
  create(seed: Seed, opts?: CreateOptions): GameState;
  /** One tick: advance the clock, run whatever the hour holds. Mutates `s`; returns what happened. */
  step(s: GameState): GameEvent[];
  /** Apply a player action now. Refused actions change nothing and return the reasons. */
  act(s: GameState, a: Action): { ok: boolean; why: Reason[]; events: GameEvent[] };
  /** Every legal action (bots, tests). */
  legal(s: Readonly<GameState>): Action[];
}

/** The seam between the rules (src/sim, rb-sim) and the people's lives (src/sim/world, rb-world). */
export interface World {
  /** Everyone, with homes, work, households and ties, from the seed and content's tables. */
  populate(s: GameState): void;
  /** One tick of lives: whereabouts by the hour, calendar, weather, world events, the opposition's walkers. */
  step(s: GameState, out: GameEvent[]): void;
  /** The world's echoes of an action's rule events (`out` from `from` on), the one path a tick's take too. */
  echo(s: GameState, out: GameEvent[], from: number): void;
  members(s: Readonly<GameState>, g: GroupId): UnitId[];
  /** The groups a person is one of: their household, crew, chapel flock and watch. */
  groupsOf(s: Readonly<GameState>, p: Readonly<Person>): GroupId[];
  /** Where the group is gathered now, or null (a group whisper lands only then). */
  together(s: Readonly<GameState>, g: GroupId): PlaceId | null;
  /** Shortest route on content's world graph, by the shortcuts found, and its length in ticks. */
  route(s: Readonly<GameState>, from: PlaceId, to: PlaceId): { path: PlaceId[]; ticks: number };
  /** What `a`'s tie to `b` is, read the same from both ends. */
  tieKind(s: Readonly<GameState>, a: Readonly<Person>, b: Readonly<Person>): TieKind;
  /** A newcomer from the seed, into `s.people`: the loner a discovery finds at area `at`, or fresh hands off the lift. */
  spawn(s: GameState, kind: 'loner' | 'fresh', at: PlaceId): Person;
}

/** Read helpers ui and view use instead of re-deriving rules. All pure; no allocation per frame for scalars. */
/** What a tie is: household, a debt seen from either end, a rivalry, love, or plain friendship. */
export type TieKind = 'kin' | 'owes' | 'owed' | 'rival' | 'lover' | 'friend';

/** The stats menu's numbers. */
export interface GodStats {
  /** Nether at dusk tonight. */
  nether: number;
  faith: number;
  influence: number;
  presence: number;
  xpToNext: number;
  hungerRise: number;
  maliceRise: number;
  /** Heat each power cools at dawn. */
  cooling: number;
}

export interface Query {
  check(s: Readonly<GameState>, a: Action): Check;
  /** What `a`'s tie to `b` is. */
  tieKind(s: Readonly<GameState>, a: UnitId, b: UnitId): TieKind;
  hour(tick: Tick): Hour;
  day(tick: Tick): number;
  weekday(tick: Tick): Weekday;
  part(tick: Tick): DayPart;
  /** 0..1 daylight: the one light curve. */
  daylight(hour: Hour): number;
  visibility(s: Readonly<GameState>, place: PlaceId): Visibility;
  /** People you can whisper to now, and why each is in reach. */
  reach(s: Readonly<GameState>): UnitId[];
  /** Nether a night, Faith, Influence, XP to next rank: the stats menu's numbers. */
  stats(s: Readonly<GameState>): GodStats;
  /** The god's urges as their state words (sated / starving...). */
  urge(s: Readonly<GameState>, which: 'hunger' | 'malice'): string;
  /** Unlocked facilities and why each locked one is locked. */
  facilities(s: Readonly<GameState>): { facility: Facility; open: boolean; why: Reason[] }[];
  /** The goal in plain words: what to do next to reach the watershed or the ending. */
  goal(s: Readonly<GameState>): Reason;
  /** What a stone counts for burnt into `card`'s miracle (its own nature half again), and the Hunger eating it takes away. */
  worth(s: Readonly<GameState>, crystal: CrystalId, card?: CardId): { burn: number; hunger: number };
  /** The slots the pending story's words fill (its numbers, who and where), or null with no story pending. */
  storySlots(s: Readonly<GameState>): Record<string, string | number> | null;
  /** A whisper's odds on a person now, with each term that moves them (`odds.<term>`, `pct` signed points). */
  odds(s: Readonly<GameState>, unit: UnitId): { odds: number; why: Reason[] };
  /** The groups a person is one of (household, crew, chapel flock, watch): each a `whisperGroup` target. */
  groups(s: Readonly<GameState>, unit: UnitId): GroupId[];
  /** The homes whose hearth is yours: each seeds its area's colour at dawn in the town (balance's GIFTS.hearth). */
  hearths(s: Readonly<GameState>): PlaceId[];
}

// ---------- the view model (app builds once per frame; view and ui read it) ----------

/** One continuous zoom over the one world: 0 a face close-up ... 1 the mine ... 2 the town ... 3 the valley. */
export interface Camera { x: number; y: number; zoom: number }

/** A scripted shot the view plays over the live world (opening, watershed, ending) or a take (a rare find). */
export type Film =
  | { kind: 'opening'; t: number }
  | { kind: 'watershed'; t: number }
  | { kind: 'ending'; t: number }
  | { kind: 'take'; event: GameEvent; t: number };

export type Focus = { unit: UnitId } | { place: PlaceId } | { crystal: CrystalId } | null;

/** The open menu: app owns it (keys I, P, Esc and the ui's buttons send it); the ui draws it. */
export type Menu = 'stats' | 'people' | 'settings' | null;

export interface ViewModel {
  /** The title is up: no run has begun; `state` is the run Begin starts. */
  title: boolean;
  /** The day the one save resumes at (Continue), or null when there is none. */
  saved: number | null;
  settings: Readonly<Settings>;
  state: Readonly<GameState>;
  /** 0..1 between the last tick and the next: the view interpolates walks with it. */
  alpha: number;
  /** Render seconds since boot: animation frames are picked from it (frozen while paused). */
  time: number;
  camera: Camera;
  focus: Focus;
  hover: Focus;
  film: Film | null;
  paused: boolean;
  menu: Menu;
  /** Events since the last frame, for effects and notes; app clears it after the frame. */
  fresh: readonly GameEvent[];
}

// ---------- the seams between tracks ----------

/** The world on the canvas (src/view). Places baked sprites and picks frames; draws nothing itself. */
export interface View {
  load(onProgress: (k: number) => void): Promise<void>;
  frame(vm: ViewModel): void;
  /** Screen point to the thing under it, by the scene graph's own hit areas. */
  pick(x: number, y: number, vm: ViewModel): Focus;
  /**
   * The screen point (CSS px) over a person as shown, a place or the grave, as the last frame stood it; false when it
   * is not on screen (another region than the camera's, not shown, or past the canvas's edge).
   */
  where(target: Focus | 'grave', out: { x: number; y: number }): boolean;
  /** Seconds a film runs, so app knows when to release the clock. */
  filmLength(kind: Film['kind']): number;
  /** The film's camera at its `t`, from `from`, the camera it began on: app's one camera takes it while a film plays. */
  filmPose(film: Film, from: Readonly<Camera>, out: Camera): void;
  /** Screen px per world unit at a zoom: app turns a drag into a camera move with it. */
  scale(zoom: number): number;
  resize(w: number, h: number): void;
}

/** The stage's layers bottom to top. rb-view owns the world layers, rb-life the rest. */
export type LayerName =
  | 'ground' | 'stain' | 'props' | 'people' | 'fx' | 'above' | 'weather' | 'fog' | 'grade' | 'lit' | 'land' | 'notes';

/** One layer of the one PixiJS stage. The view makes `root` and orders it by name; the layer only places sprites in it. */
export interface Layer {
  readonly name: LayerName;
  readonly root: Container;
  /** Place this frame's sprites; true when anything it shows changed (the view renders only then). */
  frame(vm: ViewModel): boolean;
}

/** What the DOM interface asks app to do; app turns intents into sim actions or camera moves. */
export type Intent =
  | { kind: 'act'; action: Action }
  | { kind: 'focus'; focus: Focus }
  | { kind: 'pause'; paused: boolean }
  | { kind: 'skipFilm' }
  | { kind: 'menu'; menu: Menu }
  | { kind: 'newRun'; seed?: Seed }
  /** Back to the title (from the defeat or the ending): a fresh run waits behind it. */
  | { kind: 'title' }
  | { kind: 'continue' }
  | { kind: 'settings'; patch: Partial<Settings> };

/** Volumes 0..1, the interface's size, whether the hints teach, and the hints already taught (kept across runs). */
export interface Settings { master: number; music: number; sfx: number; ambience: number; uiSize: 'small' | 'medium' | 'large'; hints: boolean; seenHints: string[] }

/** The DOM HUD and cards (src/ui). */
export interface Ui {
  /** `where` is the view's: the notes stand where things happen. */
  mount(root: HTMLElement, send: (i: Intent) => void, q: Query, where: View['where']): void;
  frame(vm: ViewModel): void;
}

/**
 * content's sound for an event kind: an sfx name of assets/audio/manifest.json; or a field of the event, or of the
 * crystal it names, choosing among names (a number chooses `up` or `down` by its move against the event's `was`, or
 * against 0); or null, silent (the number shows in the HUD).
 */
export type SoundCue = string | { by: string; names: Record<string, string> } | null;
/** A film's sound beat: `at` seconds into it, an sfx or a stinger of the manifest. */
export interface FilmBeat { at: number; sfx?: string; stinger?: string }
/** content's sound tables: what audio plays for each event kind and each film. */
export interface SoundTables { cues: Record<EventKind, SoundCue>; films: Record<Film['kind'], FilmBeat[]> }

/** Baked sounds (src/audio): one cue per event kind, beds by stage, hour and weather. */
export interface Audio {
  load(): Promise<void>;
  frame(vm: ViewModel): void;
  settings(s: Settings): void;
}

/** The one save: replaced at each dawn; an older day's save is dropped. */
export interface Save { day: number; state: GameState }

/**
 * Every baked atlas ships as assets/<name>/<file> plus manifest.json in this one shape (the life atlas's).
 * cells: name -> [x, y, w, h, k, ax, ay]: the cell's rect in the picture, k px per world unit, its origin.
 * clips: name -> cell names in frame order at fps. levels: halved copies <file>@1..@n for distance.
 */
export interface AtlasManifest {
  file: string;
  w: number;
  h: number;
  levels: number;
  cells: Record<string, [number, number, number, number, number, number, number]>;
  clips?: Record<string, { fps: number; frames: string[]; loop: boolean }>;
}

/** `window.__hg`: the debug and test API (app). `app.time` is what tools/shot.py --settle waits on. */
export interface DebugApi {
  app: { readonly time: number };
  state(): Readonly<GameState>;
  act(a: Action): { ok: boolean; why: Reason[] };
  /** What the interface would ask (a focus, a menu, a new run): shots reach each panel through it. */
  send(i: Intent): void;
  /** Run the sim this many ticks at once (tests and shots). */
  ticks(n: number): void;
  /** Advance render time (films, animation) by seconds. */
  advance(seconds: number): void;
  /** An event taken as if the sim had made it, the state untouched: shots reach what the dice rarely give (a strike's grade, a take). */
  show(e: GameEvent): void;
  camera(c: Partial<Camera>): void;
  legal(): Action[];
  /** The profiler's report, on the profiled page only (`?prof=1`, F3; src/app/prof). */
  prof?(): ProfReport;
  /** The same as the text Copy report gives. */
  profText?(): string;
  /** The multiplayer socket, in a build that names one (src/app/net.ts). */
  net?: Net;
}

/** The multiplayer socket: who is on, and game messages to and from the other players. */
export interface Net {
  /** the players the hub has on, this one included (names as the hub sends them) */
  players: string[];
  open: boolean;
  /** `data` to every other player; dropped while the socket is not open */
  send(data: unknown): void;
  onGame(f: (from: string, data: unknown) => void): void;
}

/** One function's cost, per frame (or per sim tick): mean over the window, its worst frame, its share of the callback. */
export interface ProfRow {
  /** `name (file:line)`, file relative to src. */
  name: string;
  ms: number;
  worst: number;
  pct: number;
  calls: number;
  /** KB allocated (self), or null where the browser gives no exact heap. */
  kb: number | null;
  draws: number;
  uploads: number;
}

/**
 * The profiled page's report over its last frames (src/app/prof). The frame is every rAF callback of one display
 * frame; its functions' self times, `unattributed` (callback time outside every probed function) and `probes` (the
 * profiler's own cost) sum to `cb`.
 */
export interface ProfReport {
  frames: number;
  /** The clock's step in ms (Chromium: 0.005 when cross-origin isolated, else 0.1, jittered). */
  timer: number;
  heapExact: boolean;
  frame: {
    cb: number; cbP95: number; cbWorst: number; interval: number; dropped: number;
    probes: number; unattributed: number;
    /** Percent of the callback without probes that named functions hold. */
    attributed: number;
    calls: number; draws: number; uploads: number; uploadKB: number; allocKB: number | null; gcs: number;
  };
  memory: { heapMB: number; textures: number; textureMB: number; domNodes: number };
  /** The sim's ticks: per frame, ms each, and each function's cost per tick. */
  tick: { perFrame: number; ms: number; rows: ProfRow[] };
  functions: ProfRow[];
  /** Work between frames (input, timers, promise jobs), per frame. */
  between: ProfRow[];
  /** The call tree: inclusive ms per frame by path, largest branches. */
  tree: { depth: number; name: string; ms: number; calls: number }[];
}
