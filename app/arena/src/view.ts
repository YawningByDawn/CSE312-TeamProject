import { BODY_COLOR, drawAnimal, drawShadow } from './animals';
import type { Net } from './net';
import { drawCover, drawFood, drawGround, drawPonds, type Rect } from './scene';
import { BOOSTING, BOT, CHARGING, GUARDED, HIDDEN, HURT, USING, WET, type BoardRow, type Creature, type MeAlive, type MeDead, type Snap, type Species, type World } from './types';

// The world as one frame sees it: a little in the past, between the two snapshots either side of that moment, so
// creatures glide at any tick rate. A snapshot's events play as the frame passes it: food and prey slide into
// whoever ate them, and abilities flash.

const TAU = Math.PI * 2;
const SPECTATOR_VIEW = 1100;
// outlines while playing: red for what can eat you, green for what you can eat
const PREDATOR = '#ff3b30';
const PREY = '#3ddc57';
const MAX_ASPECT = 2.4; // the hub sends a view up to this many times as wide as it is high

/** The colours of each ability style: its main colour and a lighter one. */
export const STYLE_COLOR: Record<string, [string, string]> = {
  dust: ['#c9a66b', '#efdcb4'],
  quake: ['#8a6a3a', '#d8b878'],
  roar: ['#ffffff', '#fff3a8'],
  wind: ['#e8f4ff', '#ffffff'],
  fire: ['#ff7a1a', '#ffe27a'],
  venom: ['#7fd23a', '#d8ff8a'],
  ink: ['#3a2250', '#7a5a9a'],
  water: ['#5fc8f0', '#d8f6ff'],
  gaze: ['#ffd23a', '#fff8c8'],
};

export interface Hooks {
  spawned(me: MeAlive): void;
  died(me: MeDead): void;
  evolved(sp: number): void;
  ate(name: string, sp: number): void;
}

/** What the HUD and the input need from a frame. */
export interface Frame {
  me: MeAlive | MeDead | null;
  board: BoardRow[];
  camX: number;
  camY: number;
  scale: number;
  mine: { x: number; y: number; r: number } | null; // my creature on screen, CSS px
  threat: number; // 0 to 1: how close something that could eat me is
}

interface Ghost {
  food: boolean;
  kind: number; // food kind or species
  x: number;
  y: number;
  a: number;
  by: number;
  t0: number;
  dur: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  r: number;
  color: string;
}

interface Float {
  text: string;
  x: number;
  y: number;
  t0: number;
  color: string;
}

/** An ability going off: a ring that spreads (a stomp) or closes in (a pull) round a creature. */
interface Wave {
  id: number;
  x: number;
  y: number;
  r0: number;
  r1: number;
  t0: number;
  style: string;
}

const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;

function lerpAngle(a: number, b: number, k: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return a + d * k;
}

interface Drawn extends Creature {
  mv: number; // 0 to 1, for the legs
  s: Species;
}

export class View {
  private viewH = SPECTATOR_VIEW;
  private camX = 2000;
  private camY = 3000;
  private ghosts: Ghost[] = [];
  private particles: Particle[] = [];
  private floats: Float[] = [];
  private waves: Wave[] = [];
  private last: MeAlive | MeDead | null = null;
  private drift = 0; // the menu's slow pan with no server

  constructor(private hooks: Hooks) {}

  frame(c: CanvasRenderingContext2D, w: number, h: number, dpr: number, net: Net, now: number, dt: number): Frame {
    const world = net.world;
    const snaps = net.snaps;
    const t = now;
    if (!world || snaps.length === 0) {
      this.drift += dt * 30;
      this.place(c, w, h, dpr, 1000 + this.drift, 1000 + this.drift * 0.4, 1, world, t);
      return { me: null, board: [], camX: this.camX, camY: this.camY, scale: 1, mine: null, threat: 0 };
    }

    const rt = net.serverNow() - (1.2 / world.tick + 0.03);
    let bi = snaps.findIndex((s) => s.t > rt);
    if (bi === -1) bi = snaps.length - 1;
    const A = snaps[Math.max(0, bi - 1)]!;
    const B = snaps[bi]!;
    const k = B === A ? 1 : Math.max(0, Math.min(1, (rt - A.t) / (B.t - A.t)));
    for (let i = 0; i < snaps.length; i++) {
      const s = snaps[i]!;
      if (s.t <= rt && !s.played) this.play(s, snaps[i - 1], t, world);
    }
    const cur = rt >= B.t ? B : A; // the latest snapshot the frame has passed
    const me = cur.me;

    // creatures, between A and B
    const drawn: Drawn[] = [];
    const byId = new Map<number, Drawn>();
    const span = Math.max(0.001, B.t - A.t);
    for (const cb of B.creatures.values()) {
      const ca = A.creatures.get(cb.id);
      const s = world.species[cb.sp]!;
      const d: Drawn = ca
        ? { ...cb, s, x: lerp(ca.x, cb.x, k), y: lerp(ca.y, cb.y, k), a: lerpAngle(ca.a, cb.a, k), mv: Math.min(1, Math.hypot(cb.x - ca.x, cb.y - ca.y) / span / s.speed) }
        : { ...cb, s, mv: 0 };
      drawn.push(d);
      byId.set(d.id, d);
    }
    drawn.sort((p, q) => p.s.tier - q.s.tier || (p.s.habitat === 'air' ? 1 : 0) - (q.s.habitat === 'air' ? 1 : 0));
    const myId = me?.alive ? me.id : -1;
    const mine = byId.get(myId);
    const mySpecies = me?.alive ? world.species[me.sp]! : null;

    // the camera: on my creature, else where the hub is looking
    const tx = mine ? mine.x : lerp(A.x, B.x, k);
    const ty = mine ? mine.y : lerp(A.y, B.y, k);
    if (mine) {
      this.camX = tx;
      this.camY = ty;
    } else {
      const ease = Math.min(1, dt * 4);
      this.camX += (tx - this.camX) * ease;
      this.camY += (ty - this.camY) * ease;
    }
    const wantH = mySpecies ? mySpecies.view : SPECTATOR_VIEW;
    this.viewH += (wantH - this.viewH) * Math.min(1, dt * 2.5);
    // a portrait screen sees a quarter more than the species' view up and down, so it is not too narrow; the hub's
    // view reaches that far
    const scale = Math.max(h / (this.viewH * (h > w ? 1.25 : 1)), w / (this.viewH * MAX_ASPECT));
    const v = this.place(c, w, h, dpr, this.camX, this.camY, scale, world, t);

    drawPonds(c, world.ponds, v, t);
    for (const f of cur.food.values()) {
      const kind = world.foods[f.kind]!;
      if (f.x + kind.r > v.x0 && f.x - kind.r < v.x1 && f.y + kind.r > v.y0 && f.y - kind.r < v.y1) drawFood(c, kind.name, f.x, f.y, kind.r, t, f.id);
    }

    const visible = (d: Drawn): boolean => {
      const r = d.s.r * 2;
      return d.x + r > v.x0 && d.x - r < v.x1 && d.y + r > v.y0 && d.y - r < v.y1;
    };
    for (const d of drawn) {
      if (!visible(d) || d.flags & WET && d.s.habitat !== 'air') continue;
      const lift = d.s.habitat === 'air' ? 0.7 : 0; // fliers cast their shadow further off
      drawShadow(c, d.x + d.s.r * lift, d.y + d.s.r * lift * 1.3, d.s.r * (1 - lift * 0.25));
    }
    const myTier = mySpecies ? mySpecies.tier : -1;
    const ring = (d: Drawn): string | null => (myTier < 0 || d === mine || d.s.tier === myTier ? null : d.s.tier > myTier ? PREDATOR : PREY);
    for (const d of drawn) {
      if (!visible(d) || d === mine && d.flags & HIDDEN) continue;
      this.creature(c, d, t, d.flags & HIDDEN && d.flags & WET && d.s.habitat === 'amph' ? 0.3 : 1, d.flags & HIDDEN ? null : ring(d), scale);
    }
    drawCover(c, world.bushes, world.kelp, v, t);
    if (mine && mine.flags & HIDDEN) {
      this.creature(c, mine, t, 0.6, null, scale);
      c.beginPath();
      c.arc(mine.x, mine.y, mine.s.r + 6, 0, TAU);
      c.setLineDash([6, 6]);
      c.strokeStyle = 'rgba(255,255,255,0.8)';
      c.lineWidth = 2;
      c.stroke();
      c.setLineDash([]);
    }
    this.shots(c, A, B, k, world, t);
    this.effects(c, world, byId, t, dt);

    // names and hp, in screen space
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    let threat = 0;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (const d of drawn) {
      if (!visible(d) || (d.flags & HIDDEN && d !== mine)) continue;
      const r = d.s.r;
      const sx = (d.x - this.camX) * scale + w / 2;
      const sy = (d.y - this.camY) * scale + h / 2;
      if (mine && d.s.tier > myTier) {
        const gap = Math.hypot(d.x - mine.x, d.y - mine.y) - r - mine.s.r;
        threat = Math.max(threat, Math.min(1, 1 - gap / 320));
      }
      const top = sy - r * scale - 12;
      const label = d === mine ? '#fff3a8' : myTier < 0 || d.s.tier === myTier ? '#ffffff' : d.s.tier < myTier ? '#c9ffb0' : '#ffb3a6';
      c.font = `${d.flags & BOT ? 'italic ' : ''}600 13px ui-rounded, "Nunito", "Segoe UI", system-ui, sans-serif`;
      c.lineWidth = 3;
      c.strokeStyle = 'rgba(30,45,25,0.75)';
      c.strokeText(d.name, sx, top);
      c.fillStyle = label;
      c.fillText(d.name, sx, top);
      if (d.hp < 100) {
        const bw = Math.max(30, r * scale * 1.4);
        const by = sy + r * scale + 9;
        c.fillStyle = 'rgba(30,45,25,0.6)';
        c.fillRect(sx - bw / 2 - 1, by - 1, bw + 2, 6);
        c.fillStyle = d.hp > 50 ? '#7bd65a' : d.hp > 25 ? '#f2c14e' : '#ef5b4c';
        c.fillRect(sx - bw / 2, by, (bw * d.hp) / 100, 4);
      }
    }
    return {
      me,
      board: cur.board,
      camX: this.camX,
      camY: this.camY,
      scale,
      mine: mine ? { x: (mine.x - this.camX) * scale + w / 2, y: (mine.y - this.camY) * scale + h / 2, r: mine.s.r * scale } : null,
      threat: Math.max(0, threat),
    };
  }

  /** Sets the world transform for a camera and draws the ground; returns the world's visible rect. */
  private place(c: CanvasRenderingContext2D, w: number, h: number, dpr: number, cx: number, cy: number, scale: number, world: World | null, t: number): Rect {
    c.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (w / 2 - cx * scale), dpr * (h / 2 - cy * scale));
    const v = { x0: cx - w / 2 / scale, y0: cy - h / 2 / scale, x1: cx + w / 2 / scale, y1: cy + h / 2 / scale };
    drawGround(c, world, v, t);
    return v;
  }

  /** Draws a creature, outlined in `ring` (red: it can eat me; green: I can eat it) and flashing red when just hurt. */
  private creature(c: CanvasRenderingContext2D, d: Drawn, t: number, alpha: number, ring: string | null, scale: number): void {
    const r = d.s.r;
    c.globalAlpha = alpha;
    if (ring) {
      c.beginPath();
      c.arc(d.x, d.y, r + 3 / scale, 0, TAU);
      c.fillStyle = ring;
      c.globalAlpha = alpha * 0.22;
      c.fill();
      c.globalAlpha = alpha * 0.95;
      c.lineWidth = 3.5 / scale;
      c.strokeStyle = ring;
      c.stroke();
      c.globalAlpha = alpha;
    }
    if (d.flags & (BOOSTING | CHARGING)) {
      const [main] = STYLE_COLOR[d.flags & CHARGING ? d.s.ability.style : 'wind'] ?? ['#fff'];
      c.strokeStyle = d.flags & CHARGING ? main : 'rgba(255,255,255,0.6)';
      c.lineWidth = d.flags & CHARGING ? 5 : 3;
      c.lineCap = 'round';
      for (const s of [-0.5, 0, 0.5]) {
        const ox = Math.cos(d.a + Math.PI) * r;
        const oy = Math.sin(d.a + Math.PI) * r;
        const px = -Math.sin(d.a) * s * r;
        const py = Math.cos(d.a) * s * r;
        const len = d.flags & CHARGING ? 2.6 : 1.9;
        c.beginPath();
        c.moveTo(d.x + ox * 1.1 + px, d.y + oy * 1.1 + py);
        c.lineTo(d.x + ox * len + px, d.y + oy * len + py);
        c.stroke();
      }
    }
    if (d.flags & WET && !(d.flags & HIDDEN) && d.s.habitat !== 'sea' && d.s.habitat !== 'air') {
      c.strokeStyle = 'rgba(255,255,255,0.5)';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(d.x, d.y, r * (1.15 + Math.sin(t * 4 + d.id) * 0.08), 0, TAU);
      c.stroke();
    }
    drawAnimal(c, d.s.name, d.x, d.y, r, d.a, t + d.id, d.mv, d.flags & (BOOSTING | CHARGING) ? 1.1 : 1);
    if (d.flags & HURT) {
      c.beginPath();
      c.arc(d.x, d.y, r * 0.95, 0, TAU);
      c.fillStyle = 'rgba(255,40,30,0.38)';
      c.fill();
    }
    if (d.flags & GUARDED) {
      c.strokeStyle = `rgba(255,255,255,${0.45 + Math.sin(t * 10) * 0.25})`;
      c.lineWidth = 3;
      c.beginPath();
      c.arc(d.x, d.y, r + 8, 0, TAU);
      c.stroke();
    }
    c.globalAlpha = 1;
  }

  /** Shots in flight, between A and B: glowing balls in the colours of whoever spat them. */
  private shots(c: CanvasRenderingContext2D, A: Snap, B: Snap, k: number, world: World, t: number): void {
    for (const sb of B.shots.values()) {
      const sa = A.shots.get(sb.id);
      const x = sa ? lerp(sa.x, sb.x, k) : sb.x;
      const y = sa ? lerp(sa.y, sb.y, k) : sb.y;
      const s = world.species[sb.sp]!;
      const [main, light] = STYLE_COLOR[s.ability.style] ?? ['#fff', '#fff'];
      const r = 7 + 1.3 * s.tier;
      c.save();
      c.shadowColor = main;
      c.shadowBlur = 14;
      const ang = sa ? Math.atan2(sb.y - sa.y, sb.x - sa.x) : 0;
      c.beginPath();
      c.ellipse(x, y, r * 1.5, r, ang, 0, TAU);
      c.fillStyle = main;
      c.fill();
      c.beginPath();
      c.arc(x + Math.cos(ang) * r * 0.3, y + Math.sin(ang) * r * 0.3, r * (0.5 + Math.sin(t * 20) * 0.08), 0, TAU);
      c.fillStyle = light;
      c.fill();
      c.restore();
    }
  }

  /** A snapshot's events, as the frame reaches it: what was eaten, abilities going off, and what changed for me. */
  private play(s: Snap, prev: Snap | undefined, t: number, world: World): void {
    s.played = true;
    const me = s.me;
    const was = this.last;
    this.last = me;
    for (const [isCreature, id, by] of s.eaten) {
      if (!isCreature) {
        const f = prev?.food.get(id);
        if (f) this.ghosts.push({ food: true, kind: f.kind, x: f.x, y: f.y, a: 0, by, t0: t, dur: 0.18 });
        continue;
      }
      const cr = prev?.creatures.get(id);
      if (!cr) continue;
      const sp = world.species[cr.sp]!;
      this.ghosts.push({ food: false, kind: cr.sp, x: cr.x, y: cr.y, a: cr.a, by, t0: t, dur: 0.3 });
      this.burst(cr.x, cr.y, sp.r, BODY_COLOR[sp.name] ?? '#fff', 14);
      if (was?.alive && by === was.id) this.hooks.ate(cr.name, cr.sp);
    }
    for (const cr of s.creatures.values()) {
      const before = prev?.creatures.get(cr.id);
      if (!(cr.flags & USING) || (before && before.flags & USING)) continue;
      const sp = world.species[cr.sp]!;
      const { kind, style } = sp.ability;
      if (kind === 'stomp') this.waves.push({ id: cr.id, x: cr.x, y: cr.y, r0: sp.r, r1: sp.r * 2.6 + 40, t0: t, style });
      else if (kind === 'pull') this.waves.push({ id: cr.id, x: cr.x, y: cr.y, r0: sp.r * 4 + 60, r1: sp.r, t0: t, style });
      else this.burst(cr.x + Math.cos(cr.a) * sp.r, cr.y + Math.sin(cr.a) * sp.r, sp.r * 0.4, (STYLE_COLOR[style] ?? ['#fff'])[0], 8);
    }
    if (me?.alive && was?.alive && me.id === was.id) {
      const mine = s.creatures.get(me.id);
      const sp = world.species[me.sp]!;
      if (me.xp > was.xp && mine) this.floats.push({ text: `+${me.xp - was.xp}`, x: mine.x, y: mine.y - sp.r, t0: t, color: '#fff3a8' });
      if (me.sp !== was.sp) {
        this.hooks.evolved(me.sp);
        if (mine) this.burst(mine.x, mine.y, sp.r * 1.4, '#fff3a8', 26);
      }
    }
    if (me?.alive && !(was?.alive && was.id === me.id)) this.hooks.spawned(me);
    if (me && !me.alive && was?.alive) this.hooks.died(me);
  }

  private burst(x: number, y: number, r: number, color: string, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const sp = 60 + Math.random() * 140;
      this.particles.push({ x: x + Math.cos(a) * r * 0.5, y: y + Math.sin(a) * r * 0.5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 0.4 + Math.random() * 0.3, r: 2 + Math.random() * 3, color });
    }
  }

  private effects(c: CanvasRenderingContext2D, world: World, byId: Map<number, Drawn>, t: number, dt: number): void {
    this.waves = this.waves.filter((wv) => {
      const p = (t - wv.t0) / 0.45;
      if (p >= 1) return false;
      const at = byId.get(wv.id);
      const x = at?.x ?? wv.x;
      const y = at?.y ?? wv.y;
      const [main, light] = STYLE_COLOR[wv.style] ?? ['#fff', '#fff'];
      const ease = 1 - (1 - p) * (1 - p);
      for (const [i, color] of [main, light].entries()) {
        const r = lerp(wv.r0, wv.r1, Math.max(0, ease - i * 0.15));
        c.globalAlpha = (1 - p) * (i ? 0.5 : 0.8);
        c.strokeStyle = color;
        c.lineWidth = 10 * (1 - p) + 2;
        c.beginPath();
        c.arc(x, y, Math.max(1, r), 0, TAU);
        c.stroke();
      }
      c.globalAlpha = 1;
      return true;
    });
    this.ghosts = this.ghosts.filter((g) => {
      const p = (t - g.t0) / g.dur;
      if (p >= 1) return false;
      const eater = byId.get(g.by);
      const e = p * p;
      const x = eater ? lerp(g.x, eater.x, e) : g.x;
      const y = eater ? lerp(g.y, eater.y, e) : g.y;
      c.globalAlpha = 1 - p * 0.6;
      if (g.food) {
        const kind = world.foods[g.kind]!;
        drawFood(c, kind.name, x, y, kind.r * (1 - p * 0.7), t, 0);
      } else {
        const s = world.species[g.kind]!;
        drawAnimal(c, s.name, x, y, s.r * (1 - p * 0.75), g.a + p * 4, t, 0);
      }
      c.globalAlpha = 1;
      return true;
    });
    this.particles = this.particles.filter((q) => {
      q.life += dt;
      if (q.life >= q.max) return false;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vx *= 1 - dt * 3;
      q.vy *= 1 - dt * 3;
      c.globalAlpha = 1 - q.life / q.max;
      c.fillStyle = q.color;
      c.beginPath();
      c.arc(q.x, q.y, q.r, 0, TAU);
      c.fill();
      c.globalAlpha = 1;
      return true;
    });
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    this.floats = this.floats.filter((f) => {
      const p = (t - f.t0) / 0.9;
      if (p >= 1) return false;
      c.globalAlpha = 1 - p;
      c.font = '700 18px ui-rounded, "Nunito", "Segoe UI", system-ui, sans-serif';
      c.lineWidth = 4;
      c.strokeStyle = 'rgba(30,45,25,0.7)';
      c.strokeText(f.text, f.x, f.y - 20 - p * 40);
      c.fillStyle = f.color;
      c.fillText(f.text, f.x, f.y - 20 - p * 40);
      c.globalAlpha = 1;
      return true;
    });
  }
}
