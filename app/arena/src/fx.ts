import type { Biome } from './types';

// Effects: what skills look like going off, and the weather of each biome. Everything here grows with a skill's
// level (0 to 5): more particles, wider rings, longer trails. Particles live in world units; weather in screen space.

const TAU = Math.PI * 2;

/** Each skill style: its main colour and a lighter one. */
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
  frost: ['#8adcff', '#f0fcff'],
  storm: ['#ffe84a', '#e8f4ff'],
};

type Shape = 'dot' | 'glow' | 'shard' | 'streak' | 'bubble' | 'puff' | 'spark';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  r: number;
  color: string;
  shape: Shape;
  rise: number; // drift up (negative y) a second
  spin: number;
  rot: number;
}

interface Ring {
  x: number;
  y: number;
  r0: number;
  r1: number;
  t0: number;
  dur: number;
  color: string;
  width: number;
  follow?: number; // a creature's id to stay on
}

interface Vortex {
  x: number;
  y: number;
  r: number;
  t0: number;
  dur: number;
  style: string;
  arms: number;
  follow: number;
}

interface Crack {
  x: number;
  y: number;
  angles: number[];
  len: number;
  t0: number;
  color: string;
}

interface Bolt {
  pts: [number, number][];
  t0: number;
  color: string;
}

interface Flake {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  phase: number;
}

/** How each style throws its particles: the shape, how fast they rise, how long they last. */
const STYLE_PARTICLE: Record<string, { shape: Shape; rise: number; life: number; size: number }> = {
  dust: { shape: 'puff', rise: 10, life: 0.6, size: 7 },
  quake: { shape: 'shard', rise: 0, life: 0.6, size: 5 },
  roar: { shape: 'streak', rise: 0, life: 0.35, size: 3 },
  wind: { shape: 'streak', rise: 0, life: 0.4, size: 2.5 },
  fire: { shape: 'glow', rise: 60, life: 0.7, size: 6 },
  venom: { shape: 'bubble', rise: 25, life: 0.8, size: 5 },
  ink: { shape: 'puff', rise: 0, life: 0.9, size: 11 },
  water: { shape: 'dot', rise: -40, life: 0.6, size: 4 },
  gaze: { shape: 'spark', rise: 0, life: 0.45, size: 3 },
  frost: { shape: 'shard', rise: 0, life: 0.8, size: 5 },
  storm: { shape: 'spark', rise: 0, life: 0.35, size: 3 },
};

export class Fx {
  private parts: Particle[] = [];
  private rings: Ring[] = [];
  private vortices: Vortex[] = [];
  private cracks: Crack[] = [];
  private bolts: Bolt[] = [];
  private trails = new Map<number, { x: number; y: number }[]>();
  private flakes: Flake[] = [];

  /** Throws n particles of a style out from x, y. */
  emit(style: string, x: number, y: number, n: number, speed: number, spread = TAU, dir = 0): void {
    const p = STYLE_PARTICLE[style] ?? STYLE_PARTICLE.dust!;
    const [main, light] = STYLE_COLOR[style] ?? ['#fff', '#fff'];
    for (let i = 0; i < n && this.parts.length < 900; i++) {
      const a = dir + (Math.random() - 0.5) * spread;
      const v = speed * (0.4 + Math.random() * 0.8);
      this.parts.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: p.life * (0.7 + Math.random() * 0.6),
        r: p.size * (0.6 + Math.random() * 0.8), color: Math.random() < 0.5 ? main : light, shape: p.shape, rise: p.rise,
        spin: (Math.random() - 0.5) * 8, rot: Math.random() * TAU,
      });
    }
  }

  /** A stomp: shockwaves out to its reach, cracks in the ground, and debris; more of each as the level grows. */
  stomp(x: number, y: number, r: number, reach: number, style: string, lv: number, t: number, follow: number): void {
    const [main, light] = STYLE_COLOR[style] ?? ['#fff', '#fff'];
    const waves = 1 + Math.ceil(lv / 2);
    for (let i = 0; i < waves; i++) {
      this.rings.push({ x, y, r0: r, r1: reach * (1 - i * 0.12), t0: t + i * 0.08, dur: 0.5, color: i % 2 ? light : main, width: 10 + lv * 2, follow });
    }
    this.rings.push({ x, y, r0: r * 0.5, r1: r * 1.6, t0: t, dur: 0.25, color: '#ffffff', width: 6 }); // the flash
    if (style !== 'water' && style !== 'roar' && style !== 'wind') {
      const n = 6 + lv * 2;
      this.cracks.push({ x, y, angles: Array.from({ length: n }, (_, k) => (k / n) * TAU + Math.random() * 0.4), len: reach * 0.8, t0: t, color: style === 'fire' ? '#ff7a1a' : style === 'frost' ? '#bff0ff' : '#3a2a18' });
    }
    for (let k = 0; k < 2 + lv; k++) this.emit(style, x, y, 8, reach * 1.6);
    if (style === 'storm' || lv >= 4) this.lightning(x, y, reach, main, 2 + lv);
  }

  /** A pull: a vortex spinning in from its reach, and particles sucked along. */
  pull(x: number, y: number, reach: number, style: string, lv: number, t: number, follow: number): void {
    this.vortices.push({ x, y, r: reach, t0: t, dur: 0.6 + lv * 0.05, style, arms: 3 + Math.floor(lv / 2), follow });
    const n = 18 + lv * 8;
    const [main, light] = STYLE_COLOR[style] ?? ['#fff', '#fff'];
    for (let i = 0; i < n && this.parts.length < 900; i++) {
      const a = Math.random() * TAU;
      const d = reach * (0.6 + Math.random() * 0.4);
      const px = x + Math.cos(a) * d;
      const py = y + Math.sin(a) * d;
      const inward = d * 1.6;
      const swirl = a + Math.PI / 2;
      this.parts.push({
        x: px, y: py, vx: -Math.cos(a) * inward + Math.cos(swirl) * inward * 0.6, vy: -Math.sin(a) * inward + Math.sin(swirl) * inward * 0.6,
        life: 0, max: 0.55, r: 3 + Math.random() * 4, color: i % 2 ? main : light, shape: 'dot', rise: 0, spin: 0, rot: 0,
      });
    }
  }

  /** A flash at the mouth as a creature spits, or at the start of a charge. */
  burst(x: number, y: number, style: string, lv: number, dir: number, spread = 1.2): void {
    this.emit(style, x, y, 6 + lv * 3, 160 + lv * 30, spread, dir);
  }

  /** A shot landing: a splash in its style, bigger with its level. */
  impact(x: number, y: number, style: string, lv: number, t: number): void {
    const [main] = STYLE_COLOR[style] ?? ['#fff'];
    this.rings.push({ x, y, r0: 4, r1: 30 + lv * 10, t0: t, dur: 0.3, color: main, width: 5 + lv });
    this.emit(style, x, y, 10 + lv * 5, 140 + lv * 30);
    if (style === 'storm') this.lightning(x, y, 50 + lv * 15, main, 2 + Math.floor(lv / 2));
  }

  /** Jagged bolts out from a point. */
  lightning(x: number, y: number, reach: number, color: string, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const pts: [number, number][] = [[x, y]];
      let px = x;
      let py = y;
      for (let k = 1; k <= 6; k++) {
        px = x + Math.cos(a) * reach * (k / 6) + (Math.random() - 0.5) * reach * 0.18;
        py = y + Math.sin(a) * reach * (k / 6) + (Math.random() - 0.5) * reach * 0.18;
        pts.push([px, py]);
      }
      this.bolts.push({ pts, t0: performance.now() / 1000, color });
    }
  }

  /** A shot in flight: a glowing ball with a trail behind it, both bigger with its level. */
  shot(c: CanvasRenderingContext2D, id: number, x: number, y: number, ang: number, r: number, style: string, lv: number, t: number): void {
    const [main, light] = STYLE_COLOR[style] ?? ['#fff', '#fff'];
    const trail = this.trails.get(id) ?? [];
    trail.push({ x, y });
    if (trail.length > 8 + lv * 3) trail.shift();
    this.trails.set(id, trail);
    c.save();
    c.lineCap = 'round';
    for (let i = 1; i < trail.length; i++) {
      const k = i / trail.length;
      c.globalAlpha = k * 0.7;
      c.strokeStyle = i % 2 ? main : light;
      c.lineWidth = r * 1.6 * k;
      c.beginPath();
      c.moveTo(trail[i - 1]!.x, trail[i - 1]!.y);
      c.lineTo(trail[i]!.x, trail[i]!.y);
      c.stroke();
    }
    c.globalAlpha = 1;
    c.shadowColor = main;
    c.shadowBlur = 14 + lv * 4;
    c.beginPath();
    c.ellipse(x, y, r * 1.5, r, ang, 0, TAU);
    c.fillStyle = main;
    c.fill();
    c.beginPath();
    c.arc(x + Math.cos(ang) * r * 0.3, y + Math.sin(ang) * r * 0.3, r * (0.55 + Math.sin(t * 20) * 0.08), 0, TAU);
    c.fillStyle = light;
    c.fill();
    c.restore();
    if (Math.random() < 0.4 + lv * 0.1) this.emit(style, x, y, 1, 30); // sparks shed along the way
  }

  /** Forgets the trails of shots that are gone. */
  keepTrails(ids: Set<number>): void {
    for (const id of this.trails.keys()) if (!ids.has(id)) this.trails.delete(id);
  }

  draw(c: CanvasRenderingContext2D, t: number, dt: number, at: (id: number) => { x: number; y: number } | undefined): void {
    this.cracks = this.cracks.filter((k) => {
      const p = (t - k.t0) / 0.9;
      if (p >= 1) return false;
      c.globalAlpha = 1 - p;
      c.strokeStyle = k.color;
      c.lineWidth = 4 * (1 - p) + 1;
      c.lineCap = 'round';
      for (const a of k.angles) {
        const grow = Math.min(1, p * 5);
        c.beginPath();
        c.moveTo(k.x, k.y);
        let x = k.x;
        let y = k.y;
        for (let s = 1; s <= 4; s++) {
          const d = k.len * grow * (s / 4);
          x = k.x + Math.cos(a + Math.sin(s * 3 + a) * 0.18) * d;
          y = k.y + Math.sin(a + Math.sin(s * 3 + a) * 0.18) * d;
          c.lineTo(x, y);
        }
        c.stroke();
      }
      c.globalAlpha = 1;
      return true;
    });
    this.rings = this.rings.filter((g) => {
      const p = (t - g.t0) / g.dur;
      if (p >= 1) return false;
      if (p < 0) return true;
      const pos = g.follow !== undefined ? at(g.follow) : undefined;
      const x = pos?.x ?? g.x;
      const y = pos?.y ?? g.y;
      const ease = 1 - (1 - p) * (1 - p);
      c.globalAlpha = (1 - p) * 0.85;
      c.strokeStyle = g.color;
      c.lineWidth = g.width * (1 - p) + 1.5;
      c.beginPath();
      c.arc(x, y, Math.max(1, g.r0 + (g.r1 - g.r0) * ease), 0, TAU);
      c.stroke();
      c.globalAlpha = 1;
      return true;
    });
    this.vortices = this.vortices.filter((v) => {
      const p = (t - v.t0) / v.dur;
      if (p >= 1) return false;
      const pos = at(v.follow);
      const x = pos?.x ?? v.x;
      const y = pos?.y ?? v.y;
      const [main, light] = STYLE_COLOR[v.style] ?? ['#fff', '#fff'];
      const r = v.r * (1 - p * 0.75);
      c.lineCap = 'round';
      for (let k = 0; k < v.arms; k++) {
        const start = (k / v.arms) * TAU + t * 7;
        c.globalAlpha = (1 - p) * 0.8;
        c.strokeStyle = k % 2 ? main : light;
        c.lineWidth = 6 * (1 - p) + 2;
        c.beginPath();
        for (let s = 0; s <= 24; s++) {
          const f = s / 24;
          const a = start + f * 4.2;
          const d = r * (1 - f * 0.85);
          c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
        }
        c.stroke();
      }
      c.globalAlpha = (1 - p) * 0.25;
      c.beginPath();
      c.arc(x, y, r, 0, TAU);
      c.fillStyle = main;
      c.fill();
      c.globalAlpha = 1;
      return true;
    });
    const now = performance.now() / 1000;
    this.bolts = this.bolts.filter((b) => {
      const p = (now - b.t0) / 0.25;
      if (p >= 1) return false;
      c.save();
      c.globalAlpha = 1 - p;
      c.shadowColor = b.color;
      c.shadowBlur = 12;
      for (const [w, color] of [[5, b.color], [2, '#ffffff']] as const) {
        c.strokeStyle = color;
        c.lineWidth = w;
        c.beginPath();
        for (const [x, y] of b.pts) c.lineTo(x, y);
        c.stroke();
      }
      c.restore();
      return true;
    });
    this.parts = this.parts.filter((q) => {
      q.life += dt;
      if (q.life >= q.max) return false;
      q.x += q.vx * dt;
      q.y += q.vy * dt - q.rise * dt;
      q.vx *= 1 - dt * 3;
      q.vy *= 1 - dt * 3;
      q.rot += q.spin * dt;
      const k = 1 - q.life / q.max;
      c.globalAlpha = k;
      c.fillStyle = q.color;
      c.strokeStyle = q.color;
      switch (q.shape) {
        case 'glow':
          c.save();
          c.shadowColor = q.color;
          c.shadowBlur = 10;
          c.beginPath();
          c.arc(q.x, q.y, q.r * (0.5 + k * 0.5), 0, TAU);
          c.fill();
          c.restore();
          break;
        case 'shard':
          c.save();
          c.translate(q.x, q.y);
          c.rotate(q.rot);
          c.beginPath();
          c.moveTo(-q.r, 0);
          c.lineTo(0, -q.r * 0.5);
          c.lineTo(q.r, 0);
          c.lineTo(0, q.r * 0.5);
          c.closePath();
          c.fill();
          c.restore();
          break;
        case 'streak':
          c.lineWidth = q.r;
          c.lineCap = 'round';
          c.beginPath();
          c.moveTo(q.x, q.y);
          c.lineTo(q.x - q.vx * 0.06, q.y - q.vy * 0.06);
          c.stroke();
          break;
        case 'bubble':
          c.lineWidth = 1.5;
          c.beginPath();
          c.arc(q.x, q.y, q.r, 0, TAU);
          c.stroke();
          break;
        case 'puff':
          c.globalAlpha = k * 0.55;
          c.beginPath();
          c.arc(q.x, q.y, q.r * (1.6 - k * 0.6), 0, TAU);
          c.fill();
          break;
        case 'spark':
          c.lineWidth = 2;
          c.beginPath();
          c.moveTo(q.x - q.r, q.y);
          c.lineTo(q.x + q.r, q.y);
          c.moveTo(q.x, q.y - q.r);
          c.lineTo(q.x, q.y + q.r);
          c.stroke();
          break;
        default:
          c.beginPath();
          c.arc(q.x, q.y, q.r * k + 0.5, 0, TAU);
          c.fill();
      }
      c.globalAlpha = 1;
      return true;
    });
  }

  /** The weather of the biome the camera is in, over the whole screen: embers rising in the Ashen Peaks, snow in
   * Frostmarch, fireflies in Mirewood. */
  weather(c: CanvasRenderingContext2D, w: number, h: number, biome: Biome | null, t: number, dt: number): void {
    const want = biome === 'volcano' ? 60 : biome === 'tundra' ? 110 : biome === 'swamp' ? 26 : 0;
    while (this.flakes.length < want) {
      this.flakes.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 20, vy: 0, r: 1 + Math.random() * 2.5, phase: Math.random() * TAU });
    }
    if (this.flakes.length > want) this.flakes.length = want;
    for (const f of this.flakes) {
      if (biome === 'tundra') {
        f.x += (f.vx + Math.sin(t + f.phase) * 15) * dt;
        f.y += (30 + f.r * 12) * dt;
      } else if (biome === 'volcano') {
        f.x += (f.vx + Math.sin(t * 2 + f.phase) * 10) * dt;
        f.y -= (25 + f.r * 10) * dt;
      } else {
        f.x += Math.sin(t * 0.7 + f.phase) * 12 * dt;
        f.y += Math.cos(t * 0.9 + f.phase) * 12 * dt;
      }
      if (f.y > h + 10) f.y = -10;
      if (f.y < -10) f.y = h + 10;
      if (f.x > w + 10) f.x = -10;
      if (f.x < -10) f.x = w + 10;
      if (biome === 'tundra') {
        c.fillStyle = 'rgba(255,255,255,0.85)';
        c.beginPath();
        c.arc(f.x, f.y, f.r, 0, TAU);
        c.fill();
      } else {
        const glow = biome === 'volcano' ? (Math.sin(t * 5 + f.phase) > 0 ? '#ff8a2a' : '#ffd23a') : 'rgba(220,255,120,0.9)';
        c.save();
        c.globalAlpha = biome === 'swamp' ? (Math.sin(t * 2 + f.phase) + 1) / 2 : 0.85;
        c.shadowColor = glow;
        c.shadowBlur = 8;
        c.fillStyle = glow;
        c.beginPath();
        c.arc(f.x, f.y, f.r, 0, TAU);
        c.fill();
        c.restore();
      }
    }
  }
}
