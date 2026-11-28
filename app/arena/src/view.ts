import { BODY_COLOR, drawAnimal, drawShadow } from './animals';
import { Fx, STYLE_COLOR } from './fx';
import { biomeAt } from './geo';
import type { Net } from './net';
import { drawCover, drawFood, drawGround, drawPonds, drawTerrain, type Rect } from './scene';
import { BOOSTING, BOT, BURNING, CHARGING, DAZED, GUARDED, HIDDEN, HURT, TAIL_BIT, USING, WET, type Biome, type BoardRow, type Creature, type MeAlive, type MeDead, type Snap, type Species, type World } from './types';

// The world as one frame sees it: a little in the past, between the two snapshots either side of that moment, so
// creatures glide at any tick rate. A snapshot's events play as the frame passes it: food and prey slide into
// whoever ate them, and abilities flash.

const TAU = Math.PI * 2;
const SPECTATOR_VIEW = 1100;
// outlines while playing: red for what can eat you, green for what you can eat
const PREDATOR = '#ff3b30';
const PREY = '#3ddc57';
const MAX_ASPECT = 2.4; // the hub sends a view up to this many times as wide as it is high

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
  biome: Biome | null; // where the camera is
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
  private fx = new Fx();
  private echoes = new Map<number, { x: number; y: number; a: number }[]>(); // where charging creatures just were
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
      return { me: null, board: [], camX: this.camX, camY: this.camY, scale: 1, mine: null, threat: 0, biome: null };
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

    drawPonds(c, world, v, t);
    drawTerrain(c, world, v, t);
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
    for (const id of this.echoes.keys()) if (!byId.get(id) || !(byId.get(id)!.flags & CHARGING)) this.echoes.delete(id);
    drawCover(c, world, v, t);
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
    // weak spots: where a creature bigger than me can be bitten without biting back
    for (const d of drawn) if (visible(d) && !(d.flags & HIDDEN) && ring(d) === PREDATOR) this.weakSpot(c, d, t, scale);
    const biome = biomeAt(world, this.camX, this.camY);

    // the weather, then names and hp, in screen space
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.fx.weather(c, w, h, biome, t, dt);
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
      biome,
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
    if (d.flags & CHARGING) { // afterimages: more, the higher the skill
      const trail = this.echoes.get(d.id) ?? [];
      trail.push({ x: d.x, y: d.y, a: d.a });
      while (trail.length > 3 + d.lv * 2) trail.shift();
      this.echoes.set(d.id, trail);
      for (const [i, e] of trail.slice(0, -1).entries()) {
        c.globalAlpha = alpha * 0.12 * (i + 1);
        drawAnimal(c, d.s.name, e.x, e.y, r, e.a, t + d.id, 1, 1.15);
      }
      c.globalAlpha = alpha;
      this.fx.emit(d.s.ability.style, d.x - Math.cos(d.a) * r, d.y - Math.sin(d.a) * r, 1 + Math.floor(d.lv / 2), 60 + d.lv * 15, 1, d.a + Math.PI);
    }
    if (d.flags & BURNING && Math.random() < 0.6) this.fx.emit('fire', d.x + (Math.random() - 0.5) * r, d.y + (Math.random() - 0.5) * r, 1, 30);
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
    if (d.flags & BURNING) {
      c.beginPath();
      c.arc(d.x, d.y, r * 0.95, 0, TAU);
      c.fillStyle = `rgba(255,110,20,${0.25 + Math.sin(t * 12) * 0.1})`;
      c.fill();
    }
    if (d.flags & DAZED) { // stars circling its head
      for (let k = 0; k < 3; k++) {
        const a = t * 5 + (k * TAU) / 3;
        const sx = d.x + Math.cos(d.a) * r * 0.4 + Math.cos(a) * r * 0.55;
        const sy = d.y + Math.sin(d.a) * r * 0.4 + Math.sin(a) * r * 0.3;
        c.beginPath();
        for (let n = 0; n < 10; n++) {
          const sa = (n / 10) * TAU - Math.PI / 2;
          const sr = n % 2 ? 2.5 : 6;
          c.lineTo(sx + Math.cos(sa) * sr, sy + Math.sin(sa) * sr);
        }
        c.closePath();
        c.fillStyle = '#ffe45a';
        c.fill();
      }
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

  /** A predator's weak spot: a pulsing target at its tail, flashing when it is bitten there. */
  private weakSpot(c: CanvasRenderingContext2D, d: Drawn, t: number, scale: number): void {
    const R = d.s.r;
    const x = d.x - Math.cos(d.a) * R * 0.95;
    const y = d.y - Math.sin(d.a) * R * 0.95;
    const r = Math.max(R * 0.5, 11 / scale);
    const bitten = d.flags & TAIL_BIT;
    const pulse = (Math.sin(t * 5 + d.id) + 1) / 2;
    const color = bitten ? '#ff5a3a' : '#ffd23a';
    const px = 1 / scale; // a screen pixel, in world units
    c.save();
    c.beginPath();
    c.arc(x, y, r * (0.95 + pulse * 0.12), 0, TAU);
    c.fillStyle = bitten ? 'rgba(255,90,58,0.45)' : `rgba(255,210,58,${0.22 + pulse * 0.18})`;
    c.fill();
    c.lineWidth = 3.5 * px;
    c.strokeStyle = 'rgba(40,30,10,0.55)';
    c.stroke();
    c.setLineDash([6 * px, 4 * px]);
    c.lineDashOffset = -t * 24 * px;
    c.lineWidth = 3 * px;
    c.strokeStyle = color;
    c.stroke();
    c.setLineDash([]);
    // two fangs in the middle: bite here
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(x + s * 5 * px - 4 * px, y - 5 * px);
      c.lineTo(x + s * 5 * px + 4 * px, y - 5 * px);
      c.lineTo(x + s * 5 * px, y + 7 * px);
      c.closePath();
      c.fillStyle = '#fffaf0';
      c.fill();
      c.lineWidth = 1.5 * px;
      c.strokeStyle = 'rgba(40,30,10,0.8)';
      c.stroke();
    }
    c.restore();
  }

  /** Shots in flight, between A and B: glowing, trailing balls in the colours of whoever spat them. */
  private shots(c: CanvasRenderingContext2D, A: Snap, B: Snap, k: number, world: World, t: number): void {
    const ids = new Set<number>();
    for (const sb of B.shots.values()) {
      ids.add(sb.id);
      const sa = A.shots.get(sb.id);
      const x = sa ? lerp(sa.x, sb.x, k) : sb.x;
      const y = sa ? lerp(sa.y, sb.y, k) : sb.y;
      const s = world.species[sb.sp]!;
      const ang = sa ? Math.atan2(sb.y - sa.y, sb.x - sa.x) : 0;
      this.fx.shot(c, sb.id, x, y, ang, (7 + 1.3 * s.tier) * (1 + 0.12 * sb.lv), s.ability.style, sb.lv, t);
    }
    this.fx.keepTrails(ids);
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
      if (cr.flags & TAIL_BIT && !(before && before.flags & TAIL_BIT)) {
        const sp = world.species[cr.sp]!;
        this.burst(cr.x - Math.cos(cr.a) * sp.r * 0.9, cr.y - Math.sin(cr.a) * sp.r * 0.9, sp.r * 0.3, '#ff5a3a', 12);
      }
      if (!(cr.flags & USING) || (before && before.flags & USING)) continue;
      const sp = world.species[cr.sp]!;
      const { kind, style } = sp.ability;
      const grow = 1 + 0.12 * cr.lv; // skills reach further with their level, as on the server
      const mouthX = cr.x + Math.cos(cr.a) * sp.r;
      const mouthY = cr.y + Math.sin(cr.a) * sp.r;
      if (kind === 'stomp') this.fx.stomp(cr.x, cr.y, sp.r, (sp.r * 2.6 + 40) * grow, style, cr.lv, t, cr.id);
      else if (kind === 'pull') this.fx.pull(cr.x, cr.y, (sp.r * 4 + 60) * grow, style, cr.lv, t, cr.id);
      else this.fx.burst(mouthX, mouthY, style, cr.lv, cr.a);
    }
    for (const sh of prev?.shots.values() ?? []) { // shots that are gone burst where they were
      if (s.shots.has(sh.id)) continue;
      this.fx.impact(sh.x, sh.y, world.species[sh.sp]!.ability.style, sh.lv, t);
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
    this.fx.draw(c, t, dt, (id) => byId.get(id));
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
