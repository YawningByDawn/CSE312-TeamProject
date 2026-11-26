import { Container, Sprite } from 'pixi.js';
import type { Affinity, Crystal, ViewModel } from '../../types';
import { GRADES } from '../../content/crystals';
import type { Atlas } from '../atlas';

// The grave's hoard (#82): each socket's stone on the hole's front rim, standing in a pool of its grade's light with
// its affinity's colour at its heart, pulsing, motes circling it; the pouch's loose stones heaped either side. All in
// town units round the grave's eye; it moves on a step of the clock (STEP_HZ) and when the stones change.

const STEP_HZ = 10;
/** the hole's centre below the eye, the rim's radius and squash, a set stone's and a loose one's height (town units) */
const HOLE_DY = 7.6, RIM = 12.6, RIM_SY = 0.36, SET_H = 6, LOOSE_H = 4.2;
/** a heap's distance from the hole, its fall per stone and squash; at most this many loose stones shown */
const HEAP = 16.5, HEAP_DROP = 0.8, LOOSE_MAX = 12;
/** the aura: radius by tier, alpha, pulse period */
const AURA_R = 6.5, AURA_A = 0.42, PULSE = 3.4;
const TIER_LIGHT = [0x9a8fa6, 0xc8bfe0, 0xcfaef0, 0xb48ef0, 0xe0b8ff, 0xffffff];
const ACCENT: Record<Affinity, number> = {
  stone: 0x40c4b2, faith: 0xff84c4, echo: 0x32e8ff, blood: 0xec283a, hunger: 0xff8a22, shadow: 0x5a2a88, malice: 0x74e840, fear: 0xc4eeff, flame: 0xffcc4c,
};

interface Seat { pool: Sprite; heart: Sprite; motes: Sprite[]; x: number; y: number }

export class Hoard {
  readonly root = new Container();
  private seats: Seat[] = [];
  private shown = { key: '', step: -1 };

  constructor(private readonly life: Atlas, private readonly gx: number, private readonly gy: number) {}

  /** Place the hoard; true when what it shows changed. */
  frame(vm: ViewModel): boolean {
    const s = vm.state, sh = this.shown;
    const set = s.god.sockets.map((id) => (id ? s.crystals[id] : undefined));
    const key = set.map((c) => c?.id ?? '-').join() + '|' + Object.values(s.crystals).filter((c) => 'pouch' in c.at).length;
    const step = Math.floor(vm.time * STEP_HZ);
    if (key === sh.key && (step === sh.step || this.seats.length === 0)) return false;
    if (key !== sh.key) this.build(set, Object.values(s.crystals).filter((c) => 'pouch' in c.at));
    sh.key = key; sh.step = step;
    const t = step / STEP_HZ;
    for (const seat of this.seats) {
      const p = 0.85 + 0.15 * Math.sin((t / PULSE) * Math.PI * 2 + seat.x);
      seat.pool.alpha = AURA_A * p;
      seat.heart.alpha = 0.55 * p;
      seat.motes.forEach((m, i) => {
        const a = t * 0.9 + (i / seat.motes.length) * Math.PI * 2;
        m.position.set(seat.x + Math.cos(a) * 2.2, seat.y - SET_H * 0.5 + Math.sin(a) * 0.8 - ((t * 0.7 + i * 0.37) % 1) * 1.5);
      });
    }
    return true;
  }

  private build(set: (Crystal | undefined)[], pouch: Crystal[]): void {
    for (const c of this.root.removeChildren()) c.destroy();
    this.seats = [];
    const hx = this.gx, hy = this.gy + HOLE_DY, n = set.length;
    const glow = (name: string, tint: number, x: number, y: number, r: number, sy = 1): Sprite => {
      const g = this.root.addChild(this.life.sprite(name));
      g.blendMode = 'add';
      g.tint = tint;
      g.position.set(x, y);
      const k = (2 * r) / g.texture.frame.width;
      g.scale.set(k, k * sy);
      return g;
    };
    const stone = (c: Crystal, x: number, y: number, h: number): Sprite => {
      const g = this.root.addChild(this.life.sprite(gemCellOf(c)));
      g.position.set(x, y);
      g.scale.set(h / g.texture.frame.height);
      return g;
    };
    set.forEach((c, i) => {
      if (!c) return;
      const a = Math.PI * (0.2 + (0.6 * i) / Math.max(1, n - 1));
      const x = hx - Math.cos(a) * RIM, y = hy + 0.4 + Math.sin(a) * RIM * RIM_SY;
      const tier = GRADES.indexOf(c.grade);
      const pool = glow('glow-0.2', TIER_LIGHT[tier]!, x, y, AURA_R * (0.9 + 0.12 * tier), 0.5);
      const heart = glow('glow-0.3', ACCENT[c.affinity], x, y - SET_H * 0.4, SET_H * 0.6);
      stone(c, x, y, SET_H);
      const motes = Array.from({ length: Math.round(2 + 1.3 * tier * 0.6) }, () => glow('glow-0.3', TIER_LIGHT[tier]!, x, y, 0.25));
      this.seats.push({ pool, heart, motes, x, y });
    });
    pouch.slice(0, LOOSE_MAX).forEach((c, i) => {
      const side = i % 2 ? 1 : -1, k = Math.floor(i / 2);
      stone(c, hx + side * (HEAP + k * 0.9), hy + k * HEAP_DROP * 0.5, LOOSE_H);
    });
  }
}

/** The baked cell of a crystal: its grade's shape by its seed, an impossible one's hue. */
export function gemCellOf(c: Pick<Crystal, 'grade' | 'seed'>): string {
  const g = GRADES.indexOf(c.grade);
  return `gem-c${g}-${c.seed % 3}-${g === 5 ? (c.seed >>> 2) % 6 : 0}`;
}
