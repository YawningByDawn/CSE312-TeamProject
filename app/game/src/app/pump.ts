import type { Action, Audio, Camera, Film, GameEvent, GameState, Intent, Net, Query, Reason, Seed, Settings, Sim, Ui, View, ViewModel } from '../types';
import { playTps } from '../content/clock';
import { clearSave, readSave, readSettings, writeSave, writeSettings } from './save';
import { MatchFeed } from './match';

/** A strike this rare or rarer plays its take. */
const TAKE_ONE_IN = 10000;

export interface Tracks { sim: Sim; query: Query; view: View; ui: Ui; audio: Audio }

/**
 * The one pump: real seconds in, whole sim ticks out at `playTps` (the day's `DAY_SECONDS`, a night's actions' `NIGHT_SECONDS`), and one `ViewModel` a frame for the view, the
 * ui and the audio. Time passes only up to the state's `until` (the night's actions and the day move it); a film, the
 * title, a pending choice and any phase but `live` hold it too. The vm is one object for the run's life: a frame
 * writes its fields, never allocates it. A match of the shared mine (`net`, the hub's) stands over the title while it
 * plays: the clock holds, and the match's moves and strikes go to the hub.
 */
export class Pump {
  readonly vm: ViewModel;
  /** Real time not yet turned into a tick, in ticks. */
  private carry = 0;
  private readonly fresh: GameEvent[] = [];
  /** The run's state: the sim mutates it; the vm hands it on read-only. */
  private state: GameState;
  /** The film whose camera is posed, and the camera it began on. */
  private posed: Film | null = null;
  private readonly from: Camera = { x: 0, y: 0, zoom: 1 };

  private readonly feed: MatchFeed | null;

  /** `filmRate`: films play this many times faster (`?fast=1`); `net` the hub, where the build has one, and `me` who is logged in. */
  constructor(private readonly t: Tracks, seed: Seed, private readonly filmRate: number, private readonly net: Net | null = null, me: () => string | null = () => null) {
    this.feed = net && new MatchFeed(net, me);
    const settings = readSettings();
    t.audio.settings(settings);
    this.state = t.sim.create(seed);
    this.vm = {
      title: true, saved: readSave()?.day ?? null, settings, state: this.state, alpha: 0, time: 0, dt: 0,
      camera: { x: 0, y: 0, zoom: 1 }, hostAt: { on: false, x: 0, y: 0, walked: 0, moving: false }, focus: null, hover: null, film: null, menu: null, fresh: this.fresh,
      match: null,
    };
  }

  /** The host's body before the last tick (`on` off: there was none): the view shows it moving from here to where it is now. */
  private readonly before = { on: false, x: 0, y: 0, walked: 0 };

  private stepOnce(): void {
    const b = this.state.body, o = this.before;
    [o.on, o.x, o.y, o.walked] = b ? [true, b.x, b.y, b.walked] : [false, 0, 0, 0];
    this.take(this.t.sim.step(this.state));
  }

  /** The host's body as shown this frame: the last tick's move, `alpha` of the way. */
  private showHost(): void {
    const b = this.state.body, h = this.vm.hostAt, o = this.before;
    h.on = !!b;
    if (!h.on) return;
    const k = o.on ? this.vm.alpha : 1;
    h.x = o.x + (b!.x - o.x) * k;
    h.y = o.y + (b!.y - o.y) * k;
    h.walked = o.walked + (b!.walked - o.walked) * k;
    h.moving = o.on && b!.walked > o.walked;
  }

  /** The clock runs: a live run with nothing held and time owed (the night's actions, the day). */
  running(): boolean {
    const vm = this.vm;
    return !vm.title && !vm.match && vm.film === null && vm.state.phase === 'live' && vm.state.pending === null && vm.state.tick < vm.state.until && !this.t.query.picking(vm.state);
  }

  /** One frame of `dt` real seconds: films and the clock move, then the view, ui and audio read the vm. */
  frame(dt: number): void {
    this.advance(dt);
    const vm = this.vm;
    this.t.view.frame(vm);
    this.t.ui.frame(vm);
    this.t.audio.frame(vm);
    this.fresh.length = 0;
  }

  /** `dt` real seconds of render time, film and clock, drawing nothing. */
  advance(dt: number): void {
    const vm = this.vm;
    vm.dt = dt;
    vm.time += dt;
    const film = vm.film;
    if (film) {
      film.t = Math.min(film.t + dt * this.filmRate, this.t.view.filmLength(film.kind));
      this.pose(film);
      if (film.t >= this.t.view.filmLength(film.kind)) vm.film = null;
    } else if (this.running()) {
      this.carry += dt * playTps(this.state.tick);
      while (this.carry >= 1) {
        this.carry -= 1;
        this.stepOnce();
        if (!this.running()) this.carry = 0;
      }
    }
    vm.alpha = this.carry;
    this.showHost();
    // a match begins with nothing picked or open but the settings
    if (this.feed?.frame(vm) === 'began') {
      vm.focus = vm.hover = null;
      if (vm.menu !== 'settings') vm.menu = null;
    }
  }

  /** In a match: the heading the move keys hold (each -1, 0 or 1). */
  matchMove(dx: number, dy: number): void {
    this.net?.move(dx, dy);
  }

  /** In a match: a swing of the pick toward (dx, dy) from the player's feet. */
  matchStrike(dx: number, dy: number): void {
    this.net?.strike(dx, dy);
  }

  /** The camera a film holds at its `t`, from the camera it began on: a film ends, played or skipped, on its last pose. */
  private pose(film: Film): void {
    if (film !== this.posed) {
      this.posed = film;
      Object.assign(this.from, this.vm.camera);
    }
    this.t.view.filmPose(film, this.from, this.vm.camera);
  }

  /** `n` ticks at once, held or not (tests and shots). */
  ticks(n: number): void {
    for (let i = 0; i < n; i++) this.stepOnce();
  }

  /** What the sim did: into this frame's fresh events; a dawn replaces the save. */
  take(events: GameEvent[]): void {
    const vm = this.vm;
    for (const e of events) {
      this.fresh.push(e);
      if (e.kind === 'dawn') {
        vm.saved = this.t.query.day(e.tick);
        writeSave({ day: vm.saved, state: this.state });
      // a find of 1 in 10,000 or rarer holds the clock while the camera goes to it and back
      } else if (e.kind === 'dusk') {
        // the dusk card opens alone: a person, the grave or a menu (not settings) gives way to it
        vm.focus = null;
        if (vm.menu !== 'settings') vm.menu = null;
      } else if (e.kind === 'strike' && e.oneIn >= TAKE_ONE_IN && !vm.film) vm.film = { kind: 'take', event: e, t: 0 };
      else if (e.kind === 'end') {
        clearSave();
        vm.saved = null;
      }
    }
  }

  /** The mark key: the host marks whoever stands nearest (nothing when no one does). */
  markNearest(): void {
    const target = this.t.query.near(this.state)[0];
    if (target !== undefined) this.act({ type: 'mark', target });
  }

  act(a: Action): { ok: boolean; why: Reason[] } {
    const r = this.t.sim.act(this.state, a);
    if (a.type === 'possess') this.before.on = false; // a new body shows where it stands, not moving from the last
    this.take(r.events);
    return r;
  }

  send(i: Intent): void {
    const vm = this.vm;
    switch (i.kind) {
      case 'act': {
        this.act(i.action);
        return;
      }
      // a menu and a focus close each other (settings stands over the rest and leaves them)
      case 'focus':
        vm.focus = i.focus;
        if (i.focus && vm.menu !== 'settings') vm.menu = null;
        return;
      case 'menu':
        vm.menu = i.menu;
        if (i.menu && i.menu !== 'settings') vm.focus = null;
        return;
      case 'skipFilm':
        if (vm.film) {
          vm.film.t = this.t.view.filmLength(vm.film.kind);
          this.pose(vm.film);
        }
        vm.film = null;
        return;
      case 'newRun':
        this.begin(this.t.sim.create(i.seed ?? Math.floor(Math.random() * 0x7fffffff)));
        vm.film = { kind: 'opening', t: 0 };
        return;
      case 'title':
        this.begin(this.t.sim.create(Math.floor(Math.random() * 0x7fffffff)));
        vm.title = true;
        return;
      case 'continue': {
        const save = readSave();
        if (save) this.begin(save.state);
        return;
      }
      case 'settings':
        vm.settings = { ...vm.settings, ...i.patch } satisfies Settings;
        writeSettings(vm.settings);
        this.t.audio.settings(vm.settings);
        return;
    }
  }

  /** A run begins on `state`: the title goes, nothing held but what the state holds. */
  begin(state: GameState): void {
    const vm = this.vm;
    this.state = vm.state = state;
    vm.title = false;
    vm.film = null;
    vm.menu = null;
    vm.focus = vm.hover = null;
    this.carry = 0;
    this.before.on = false;
  }
}
