import { reloadFlipped } from '../content/flags';
import { bound } from '../content/keys';
import { centreOn } from '../view/camera';
import type { Bind, Camera, View } from '../types';
import type { Pump } from './pump';

// The player's hands: the pointer picks by the view's own hit areas, drag pans 1:1, wheel, pinch and keys zoom toward
// a goal the camera eases to, and the keys bound to the stats, the characters, back (settings) and the film skip. The canvas
// gets the pointer only where the ui lets it through (#ui is pointer-events: none outside its panels). In a match of the
// shared mine the move keys steer the player's miner through the hub, a click swings their pick, and the camera follows them.

const ZOOM_MIN = 0;
const ZOOM_MAX = 1.15;
/** Zoom per wheel notch (100 px of deltaY) and per second of a held zoom key. */
const ZOOM_NOTCH = 0.25;
const ZOOM_KEY = 1.2;
/** Screen px a second a held pan key moves. */
const PAN_KEY = 900;
/** The camera closes this share of the way to its goal each 1/60 s. */
const EASE = 0.2;
/** A press that moves less than this is a click, not a drag. */
const CLICK_PX = 5;
/** The zoom the camera goes in to on a day's host: a person about 75 px tall. */
const HOST_ZOOM = 0.1;
/** The skip key held this long skips a film. */
const SKIP_HOLD_S = 1;
/** The zoom the camera goes in to as a match begins: a miner about 55 px tall, a good stretch of the mine around them. */
const MATCH_ZOOM = 0.3;

/** The held binds' pan (x, y) and zoom. */
const MOVES: Partial<Record<Bind, [number, number, number]>> = {
  left: [-1, 0, 0], right: [1, 0, 0], up: [0, -1, 0], down: [0, 1, 0], zoomOut: [0, 0, 1], zoomIn: [0, 0, -1],
};
const MOVE_BINDS = Object.keys(MOVES) as Bind[];

export class Input {
  /** Where the camera eases to; drag moves both at once. */
  private readonly goal = { x: 0, y: 0, zoom: 1 };
  /** The screen point the zoom holds still, and whether a zoom is easing. */
  private readonly anchor = { x: 0, y: 0, on: false };
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private press: { x: number; y: number; moved: boolean } | null = null;
  private pinchD = 0;
  private readonly held = new Set<Bind>();
  private spaceHeld = -1;
  /** Whom the camera has gone in to follow: the zoom is set once as a day's host begins, the player's own after. */
  private hosted: string | null = null;
  /** A film held the camera at the last update. */
  private filming = false;
  /** The match the camera has gone in to, and the heading last sent to the hub. */
  private matched: object | null = null;
  private readonly sent = { dx: 0, dy: 0 };
  private w = 1;
  private h = 1;

  constructor(private readonly pump: Pump, private readonly view: View, canvas: HTMLCanvasElement) {
    Object.assign(this.goal, pump.vm.camera);
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerup', (e) => this.up(e));
    canvas.addEventListener('pointercancel', (e) => this.up(e));
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoomBy(e.offsetX, e.offsetY, (e.deltaY * (e.deltaMode === 1 ? 33 : 1) / 100) * ZOOM_NOTCH);
    }, { passive: false });
    window.addEventListener('keydown', (e) => this.key(e, true));
    window.addEventListener('keyup', (e) => this.key(e, false));
    window.addEventListener('blur', () => (this.held.clear(), this.steer()));
  }

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
  }

  /** The camera and its goal at once: it holds there (`__hg.camera`). */
  jump(c: Partial<Camera>): void {
    Object.assign(this.pump.vm.camera, c);
    Object.assign(this.goal, this.pump.vm.camera);
    this.anchor.on = false;
  }

  /** Each frame before the pump's: held keys, the skip key's hold, the camera easing to its goal. */
  update(dt: number): void {
    const vm = this.pump.vm;
    if (this.spaceHeld >= 0 && vm.film && (this.spaceHeld += dt) >= SKIP_HOLD_S) {
      this.spaceHeld = -1;
      this.pump.send({ kind: 'skipFilm' });
    }
    // a film owns the camera: the goal rides with it to its last pose, so play resumes where the film left it
    if (vm.film || this.filming) {
      Object.assign(this.goal, vm.camera);
      this.anchor.on = false;
      this.filming = !!vm.film;
      if (vm.film) return;
    }
    let dx = 0, dy = 0, dz = 0;
    for (const b of this.held) {
      const [x, y, z] = MOVES[b]!;
      dx += x, dy += y, dz += z;
    }
    const host = vm.hostAt, me = vm.match?.shown.find((p) => p.me);
    if (vm.match !== this.matched) {
      // a match begins (the zoom goes in once) or ends (the title stands again)
      this.matched = vm.match;
      this.sent.dx = this.sent.dy = 0;
      if (vm.match) this.goal.zoom = MATCH_ZOOM, this.anchor.on = false, this.steer();
    }
    if (me) {
      centreOn(me.x, me.y, this.goal);
      dx = dy = 0;
    } else if (host.on) {
      // the host's day: the move keys steer the host (not the camera), which follows them
      if (this.hosted !== vm.state.host) {
        this.hosted = vm.state.host;
        this.goal.zoom = HOST_ZOOM;
        this.anchor.on = false;
        this.steer();
      }
      centreOn(host.x, host.y, this.goal);
      dx = dy = 0;
    } else this.hosted = null;
    const s = this.view.scale(this.goal.zoom);
    this.goal.x += (dx * PAN_KEY * dt) / s;
    this.goal.y += (dy * PAN_KEY * dt) / s;
    if (dz) this.zoomBy(this.w / 2, this.h / 2, dz * ZOOM_KEY * dt);
    const cam = vm.camera;
    const k = 1 - (1 - EASE) ** (dt * 60);
    if (this.anchor.on) {
      // the world point under the anchor stays under it while the zoom eases
      const before = this.view.scale(cam.zoom);
      const wx = cam.x + (this.anchor.x - this.w / 2) / before;
      const wy = cam.y + (this.anchor.y - this.h / 2) / before;
      cam.zoom += (this.goal.zoom - cam.zoom) * k;
      const after = this.view.scale(cam.zoom);
      cam.x = this.goal.x = wx - (this.anchor.x - this.w / 2) / after;
      cam.y = this.goal.y = wy - (this.anchor.y - this.h / 2) / after;
      if (Math.abs(this.goal.zoom - cam.zoom) < 1e-3) cam.zoom = this.goal.zoom, this.anchor.on = false;
    } else {
      cam.x += (this.goal.x - cam.x) * k;
      cam.y += (this.goal.y - cam.y) * k;
      cam.zoom += (this.goal.zoom - cam.zoom) * k;
    }
  }

  private zoomBy(sx: number, sy: number, dz: number): void {
    this.goal.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, this.goal.zoom + dz));
    this.anchor.x = sx;
    this.anchor.y = sy;
    this.anchor.on = true;
  }

  private down(e: PointerEvent): void {
    this.pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    if (this.pointers.size === 1) this.press = { x: e.offsetX, y: e.offsetY, moved: false };
    else this.press = null, (this.pinchD = this.spread());
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  private move(e: PointerEvent): void {
    const vm = this.pump.vm;
    const p = this.pointers.get(e.pointerId);
    if (!p) {
      vm.hover = vm.match ? null : this.view.pick(e.offsetX, e.offsetY, vm);
      return;
    }
    const dx = e.offsetX - p.x, dy = e.offsetY - p.y;
    p.x = e.offsetX;
    p.y = e.offsetY;
    if (this.pointers.size >= 2) {
      const d = this.spread();
      if (this.pinchD > 0 && d > 0) this.zoomBy(this.mid('x'), this.mid('y'), -Math.log2(d / this.pinchD));
      this.pinchD = d;
      return;
    }
    if (this.press && Math.hypot(e.offsetX - this.press.x, e.offsetY - this.press.y) >= CLICK_PX) this.press.moved = true;
    if (!this.press?.moved) return;
    const s = this.view.scale(vm.camera.zoom);
    vm.camera.x = this.goal.x -= dx / s;
    vm.camera.y = this.goal.y -= dy / s;
  }

  private up(e: PointerEvent): void {
    this.pointers.delete(e.pointerId);
    const vm = this.pump.vm;
    if (this.press && !this.press.moved) {
      if (vm.match) this.strike(e.offsetX, e.offsetY);
      else if (vm.hostAt.on && !vm.film) this.swing(e.offsetX, e.offsetY);
      else this.pump.send({ kind: 'focus', focus: this.view.pick(e.offsetX, e.offsetY, vm) });
    }
    this.press = null;
    this.pinchD = 0;
  }

  /** A click on a day's host's mine: they swing toward it (from their feet on the screen). */
  private swing(sx: number, sy: number): void {
    const cam = this.pump.vm.camera, at = { x: 0, y: 0 }, h = this.pump.vm.hostAt, k = this.view.scale(cam.zoom);
    centreOn(h.x, h.y, at);
    this.pump.act({ type: 'swing', dx: sx - (this.w / 2 + (at.x - cam.x) * k), dy: sy - (this.h / 2 + (at.y - cam.y) * k) });
  }

  /** A click in a match: the player's miner swings toward it. */
  private strike(sx: number, sy: number): void {
    const me = this.pump.vm.match?.shown.find((p) => p.me);
    if (!me) return;
    const cam = this.pump.vm.camera, at = { x: 0, y: 0 }, k = this.view.scale(cam.zoom);
    centreOn(me.x, me.y, at);
    this.pump.matchStrike(sx - (this.w / 2 + (at.x - cam.x) * k), sy - (this.h / 2 + (at.y - cam.y) * k));
  }

  private spread(): number {
    const [a, b] = this.pointers.values();
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  private mid(axis: 'x' | 'y'): number {
    const [a, b] = this.pointers.values();
    return a && b ? (a[axis] + b[axis]) / 2 : 0;
  }

  /** The held move keys as the host's heading, sent to the sim (or in a match the hub) when it holds another. */
  private steer(): void {
    const vm = this.pump.vm, body = vm.state.body;
    let dx = 0, dy = 0;
    for (const b of this.held) dx += MOVES[b]![0], dy += MOVES[b]![1];
    const [hx, hy] = [Math.sign(dx) as -1 | 0 | 1, Math.sign(dy) as -1 | 0 | 1];
    if (vm.match) {
      if (this.sent.dx !== hx || this.sent.dy !== hy) this.pump.matchMove((this.sent.dx = hx), (this.sent.dy = hy));
      return;
    }
    if (!vm.hostAt.on || !body) return;
    if (body.dx !== hx || body.dy !== hy) this.pump.act({ type: 'walk', dx: hx, dy: hy });
  }

  private key(e: KeyboardEvent, down: boolean): void {
    if (e.ctrlKey || e.metaKey || e.altKey || (e.target as Element).closest?.('input, textarea, select')) return;
    const vm = this.pump.vm;
    const on = (b: Bind): boolean => bound(vm.settings, b, e);
    const moves = MOVE_BINDS.filter(on);
    if (!down) {
      for (const b of moves) this.held.delete(b);
      this.steer();
      if (on('skip')) this.spaceHeld = -1;
      return;
    }
    if (moves.length > 0) {
      if ((!vm.title || vm.match) && !vm.film) for (const b of moves) this.held.add(b);
      this.steer();
      return;
    }
    if (e.repeat) return;
    if (on('profiler')) {
      // the profiler is a page of its own (src/app/boot.ts): its key reloads into it or out of it
      e.preventDefault();
      reloadFlipped('prof');
    } else if (on('back')) {
      this.pump.send(vm.film ? { kind: 'skipFilm' } : { kind: 'menu', menu: vm.menu ? null : 'settings' });
    } else if (on('skip') && vm.film) {
      e.preventDefault();
      this.spaceHeld = 0;
    } else if (on('mark') && !vm.title && !vm.film) {
      this.pump.markNearest();
    } else if (on('work') && !vm.title && !vm.film) {
      this.pump.act({ type: 'work' });
    } else if ((on('stats') || on('people')) && !vm.title && !vm.film) {
      const menu = on('stats') ? 'stats' : 'people';
      this.pump.send({ kind: 'menu', menu: vm.menu === menu ? null : menu });
    }
  }
}
