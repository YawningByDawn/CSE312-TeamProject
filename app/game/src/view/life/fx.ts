import { Container, Sprite, type Texture } from 'pixi.js';
import type { GameEvent, Layer, PlaceId, Query, UnitId, ViewModel } from '../../types';
import { AT, DRESS, MINE_FRAME } from '../../content/map';
import { PLACES } from '../../content/world';
import { GRADES } from '../../content/crystals';
import type { Atlas } from '../atlas';
import type { People } from './people';
import { Hoard, gemCellOf } from './hoard';
import { ALT, BURN, DAWN, GRADE_INK, GRAVE, CROWN, RIDE, BACK, clipOf, partsOf, type Part } from './clips';

// What happens, where it happens (#77, #81-89): each event's clip (clips.ts), a few parts of baked life-atlas cells,
// placed at the event's person (their feet or their wick), its place, or the grave, sized in that place's figure heights
// and grown by a stone's grade. A card plays at its target, else the grave; the dawn's bell-wave runs up its path.
// Every part is a sprite of one fixed pool: nothing is made per event. The grave's hoard is placed with them.

/** A playing clip: its parts from `start`, its anchors (world units), its figure height and its stone. */
interface Clip {
  parts: readonly Part[];
  start: number;
  unit: UnitId | null;
  /** feet, wick height above them, the grave */
  fx: number; fy: number; crown: number; gx: number; gy: number;
  u: number; gu: number;
  k: number;
  seed: number;
  ink: number;
  gem: string;
  end: number;
}

const POOL = 640;
/** a ray's blade: its half-width at the stone over its length, and every other ray's length (the old crystal.ts rays) */
const RAY_THIN = 0.06, RAY_SHORT = 0.62;
const smooth = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const inOut = (x: number): number => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
const hash = (a: number, b: number): number => {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};
/** a mine point (mine units) in world units */
const mx = (x: number): number => MINE_FRAME.x + x / MINE_FRAME.per;
const my = (y: number): number => MINE_FRAME.y + y / MINE_FRAME.per;
/** a figure's height in world units */
const U_MINE = 6;
export const GRAVE_AT = { x: mx(DRESS.points.graveEye.x), y: my(DRESS.points.graveEye.y) };
const placeAt = (p: PlaceId): [number, number] => [mx(AT[p]![0]), my(AT[p]![1])];
/** the dawn's path (world units), each point's distance along it, and its length */
const WAVE = DAWN.path.map(placeAt);
const ALONG = WAVE.map((_, i) => WAVE.slice(1, i + 1).reduce((d, p, j) => d + Math.hypot(p[0] - WAVE[j]![0], p[1] - WAVE[j]![1]), 0));
const LEN = ALONG[ALONG.length - 1]!;
/** the point `d` along the dawn's path */
function along(d: number, out: { x: number; y: number }): void {
  let i = 0;
  while (i < WAVE.length - 2 && ALONG[i + 1]! < d) i++;
  const a = WAVE[i]!, b = WAVE[i + 1]!, k = Math.max(0, Math.min(1, (d - ALONG[i]!) / (ALONG[i + 1]! - ALONG[i]! || 1)));
  out.x = a[0] + (b[0] - a[0]) * k; out.y = a[1] + (b[1] - a[1]) * k;
}

export interface Anchor { x: number; y: number; u: number; crown: number }
const at4 = { x: 0, y: 0, h: 0, crown: 0 };
/** Where something happened (world units): `unit`'s feet as shown, else `place`'s point; its figure height. */
export function anchor(unit: UnitId | undefined, place: PlaceId | undefined, people: People, out: Anchor): boolean {
  if (unit && people.where(unit, at4)) {
    out.x = at4.x; out.y = at4.y; out.u = at4.h; out.crown = at4.crown;
    return true;
  }
  if (!place) return false;
  const area = PLACES[place]?.area ?? place, at = AT[place] ?? AT[area];
  if (!at) return false;
  out.x = mx(at[0]); out.y = my(at[1]);
  out.u = U_MINE; out.crown = out.u * 0.9;
  return true;
}

export class Fx implements Layer {
  readonly name = 'fx';
  /** its own render group: a pooled sprite shown, hidden or re-blended re-collects the effects, not the whole world */
  readonly root = new Container({ isRenderGroup: true });
  private readonly pool: Sprite[] = [];
  private readonly clips: Clip[] = [];
  private readonly where: Anchor = { x: 0, y: 0, u: 0, crown: 0 };
  private readonly seen = { x: 0, y: 0, h: 0, crown: 0 };
  private readonly pt = { x: 0, y: 0 };
  private readonly frames = new Map<string, Texture[]>();
  private readonly hoard: Hoard;
  private dawn = -1;
  private used = 0;
  private serial = 0;

  constructor(private readonly q: Query, private readonly life: Atlas, private readonly people: People) {
    this.root.eventMode = 'none';
    this.hoard = new Hoard(life, GRAVE_AT.x, GRAVE_AT.y);
    this.root.addChild(this.hoard.root);
    for (let i = 0; i < POOL; i++) {
      const s = this.root.addChild(new Sprite());
      s.visible = false;
      this.pool.push(s);
    }
  }

  frame(vm: ViewModel): boolean {
    const t = vm.time;
    for (const e of vm.fresh) this.play(e, vm);
    let n = 0;
    for (let i = this.clips.length - 1; i >= 0; i--) if (this.clips[i]!.end <= t) this.clips.splice(i, 1);
    for (const c of this.clips) n = this.place(c, t, n);
    if (this.dawn >= 0) n = this.wave(t - this.dawn, n);
    const was = this.used;
    for (let i = n; i < was; i++) this.pool[i]!.visible = false;
    this.used = n;
    const hoard = this.hoard.frame(vm);
    return n > 0 || was > 0 || hoard;
  }

  /** An event's clip, anchored now; nothing when it happened out of sight. */
  private play(e: GameEvent, vm: ViewModel): void {
    if (e.kind === 'dawn') { this.dawn = vm.time; return; }
    const name = clipOf(e, vm.state);
    if (!name) return;
    const s = vm.state, w = this.where, parts = partsOf(name);
    const c: Clip = {
      parts, start: vm.time, unit: null, fx: GRAVE_AT.x, fy: GRAVE_AT.y, crown: U_MINE * 0.9, gx: GRAVE_AT.x, gy: GRAVE_AT.y,
      u: U_MINE, gu: U_MINE, k: 1, seed: this.serial, ink: GRADE_INK[2]!, gem: 'gem-c2-0-0', end: 0,
    };
    const onPerson = !!e.unit && this.people.where(e.unit, this.seen);
    if (anchor(e.unit, e.place, this.people, w)) {
      if (onPerson) c.unit = e.unit!;
      else if (this.q.visibility(s, PLACES[e.place!]?.area ?? e.place!) === 'void') return;
      c.fx = w.x; c.fy = w.y; c.u = w.u; c.crown = w.crown;
    } else if (e.kind !== 'play' && parts.some((p) => p[2] !== GRAVE)) return;
    // the stone: its grade's ink and shape, a rarer one bigger and longer (a strike's clip is its grade's own)
    const cid = 'crystal' in e ? e.crystal : null;
    const crystal = cid ? s.crystals[cid] : undefined;
    const grade = e.kind === 'strike' ? e.grade : crystal?.grade;
    if (grade) {
      const g = GRADES.indexOf(grade);
      c.ink = GRADE_INK[g]!;
      c.gem = crystal ? gemCellOf(crystal) : `gem-c${g}-${(this.serial + g) % 3}-0`;
      if (e.kind !== 'strike') c.k = 1 + 0.25 * g + ((crystal?.oneIn ?? 1) >= 10000 ? 0.5 : 0) + ((crystal?.oneIn ?? 1) >= 100000 ? 0.5 : 0);
    }
    this.push(c);
    if (e.kind === 'strike' && e.oneIn >= 10000) this.push({ ...c, parts: partsOf('tail'), start: c.start + [0.1, 0.12, 0.15, 0.3, 0.45, 0.85][GRADES.indexOf(e.grade)]! + 0.05 });
    // each stone paid for a miracle burns at the grave, its embers carried to where the miracle lands
    if (e.kind === 'play') e.burnt.slice(0, 4).forEach((_, i) => this.push({ ...c, parts: BURN, gx: GRAVE_AT.x + (i - 1.5) * 0.45 * U_MINE, seed: c.seed + i + 1 }));
  }

  private push(c: Clip): void {
    c.end = c.start + Math.max(...c.parts.map((p) => p[3] + p[4])) * Math.sqrt(c.k) + 0.1;
    this.serial++;
    this.clips.push(c);
  }

  /** Lay out one clip's parts from pool sprite `n`; the next free sprite. */
  private place(c: Clip, t: number, n: number): number {
    if (c.unit && this.people.where(c.unit, this.seen)) {
      c.fx = this.seen.x; c.fy = this.seen.y; c.crown = this.seen.crown;
    }
    const sk = Math.sqrt(c.k), age = (t - c.start) / sk;
    for (let pi = 0; pi < c.parts.length; pi++) {
      const [cell, tint, at, t0, dur, r0, r1, a, count = 1, spread = 0, rise = 0, how = '', turn = 0] = c.parts[pi]!;
      const m = Math.round(count * (count > 1 ? sk : 1));
      const stag = how.includes('s') && m > 1 ? (dur * 0.5) / m : 0;
      const ring = how.includes('o'), line = how.includes('l'), gem = cell === '@gem' || cell.startsWith('gem-');
      for (let i = 0; i < m; i++) {
        const u = (age - t0 - i * stag) / dur;
        if (u < 0 || u >= 1 || n >= POOL) continue;
        const sp = this.pool[n++]!;
        const fig = at === GRAVE ? c.gu : c.u;
        const h1 = how.includes('p') ? hash(c.seed, i) : hash(c.seed ^ (pi * 977), i), h2 = hash(i * 31 + (how.includes('p') ? 0 : pi), c.seed);
        const x0 = at === GRAVE ? c.gx : c.fx, y0 = at === GRAVE ? c.gy : at === CROWN ? c.fy - c.crown : c.fy;
        let x = x0, y = y0, sx = x0, sy = y0, rot = 0;
        if (at === RIDE || at === BACK) {
          const k = smooth(at === RIDE ? u : 1 - u), arc = Math.sin(Math.PI * k) * 0.25;
          x = c.gx + (c.fx - c.gx) * k + (line ? 0 : (h1 - 0.5) * fig * 0.3);
          y = c.gy + (c.fy - c.u * 0.5 - c.gy) * k - arc * Math.hypot(c.fx - c.gx, c.fy - c.gy);
          if (at === BACK) { sx = c.fx; sy = c.fy - c.u * 0.5; } else { sx = c.gx; sy = c.gy; }
        } else if (spread > 0 || ring) {
          const ang = ring ? (i / m) * Math.PI * 2 : h1 * Math.PI * 2, inward = how.includes('i') ? 1 - smooth(u) * (ring ? 0.55 : 1) : 1;
          const d = (ring ? 1 : how.includes('b') ? smooth(u) : 0.3 + 0.7 * h2) * spread * fig * c.k * inward;
          const sy2 = how.includes('g') || at !== CROWN ? 0.45 : 1;
          if (how.includes('r')) { const f = m > 1 ? (i / (m - 1)) * 2 - 1 : 0; x += f * d; y -= d * 0.2 * (1 - Math.abs(f)); }
          else if (how.includes('x')) x += (u * 2 - 1) * spread * fig;
          else { x += Math.cos(ang) * d; y += Math.sin(ang) * d * sy2; }
          if (cell === 'ray') rot = ang + turn * age;
          if (line) { const g = smooth(Math.min(1, u * 3)); x = x0 + (x - x0) * g; y = y0 + (y - y0) * g; }
        }
        y -= rise >= 0 ? rise * fig * u : -rise * fig * (1 - u);
        if (how.includes('c')) y -= 0.55 * fig; // at the chest
        const r = (r0 + (r1 - r0) * u) * fig * (count > 1 ? 1 : sk);
        const name = cell === '@gem' ? c.gem : cell;
        const tex = this.tex(name, u);
        sp.texture = tex;
        const cl = this.life.cell(name.endsWith('-') ? `${name}0` : name);
        if (line) {
          // a line from where it starts to where it has reached: a capsule stretched between them
          const lx = x - sx, ly = y - sy, len = Math.hypot(lx, ly);
          sp.anchor.set(0.5, 0.5);
          sp.position.set((x + sx) / 2, (y + sy) / 2);
          sp.rotation = Math.atan2(ly, lx);
          sp.scale.set(Math.max(len, r * 2) / tex.frame.width, (r * 2) / tex.frame.height);
        } else {
          sp.anchor.set(cl[5] / cl[2], cl[6] / cl[3]);
          const sc = gem ? (r * 2) / tex.frame.height : (r * 2) / tex.frame.width;
          // a ray is a thin blade (its cell a unit wedge), every other one shorter
          if (cell === 'ray') sp.scale.set(sc * (i % 2 ? RAY_SHORT : 1), sc * RAY_THIN);
          else sp.scale.set(sc, how.includes('g') ? sc * 0.4 : sc);
          sp.rotation = rot;
          sp.position.set(x, y);
        }
        sp.tint = how.includes('a') && i % 2 ? ALT : tint < 0 ? c.ink : tint;
        sp.blendMode = how.includes('n') || gem ? 'normal' : 'add';
        sp.alpha = a * Math.min(1, u / 0.15) * Math.min(1, (1 - u) / 0.5);
        sp.visible = true;
      }
    }
    return n;
  }

  /** The dawn's bell-wave `age` s in: warm pools trailing a bright front up the path, a ring and glints at each stop. */
  private wave(age: number, n: number): number {
    const D = DAWN, end = D.wave + D.fade;
    if (age >= end) { this.dawn = -1; return n; }
    const w = D.width * U_MINE, f = inOut(age / D.wave), front = f * LEN, fade = 1 - smooth((age - D.wave) / D.fade), p = this.pt;
    const put = (cell: string, x: number, y: number, r: number, a: number, tint: number, g: boolean): void => {
      if (a <= 0.004 || n >= POOL) return;
      const sp = this.pool[n++]!, tex = this.life.texture(cell), cl = this.life.cell(cell), sc = (2 * r) / tex.frame.width;
      sp.texture = tex;
      sp.anchor.set(cl[5] / cl[2], cl[6] / cl[3]);
      sp.scale.set(sc, g ? sc * 0.4 : sc);
      sp.rotation = 0;
      sp.position.set(x, y);
      sp.tint = tint;
      sp.blendMode = 'add';
      sp.alpha = Math.min(1, a);
      sp.visible = true;
    };
    for (let j = 1; j <= 4 && front - j * w * 1.1 >= 0; j++) {
      along(front - j * w * 1.1, p);
      put('glow-0', p.x, p.y, w * 1.05, 0.2 * fade * (1 - j / 5), D.mid, true);
    }
    along(front, p);
    const lead = fade * Math.min(1, age / 0.3);
    put('glow-0', p.x, p.y, w * 1.3, 0.5 * lead, D.cold, true);
    put('glow-0.2', p.x, p.y, w * 0.5, 0.6 * lead, D.core, true);
    WAVE.forEach((m, i) => {
      const h = (f - ALONG[i]! / LEN) * D.wave;
      if (h < 0 || h > 1.4) return;
      put('ring-8-2.8', m[0], m[1], U_MINE * (0.5 + 2.6 * (1 - (1 - Math.min(1, h / 1.2)) ** 2)), (1 - smooth((h - 0.2) / 1.2)) * fade, D.cold, true);
      for (let k = 0; k < 5 && h < 1.2; k++) {
        const ang = hash(i, k) * Math.PI * 2, d = 0.8 * U_MINE * Math.sqrt(hash(k, i));
        put('glow-0.3', m[0] + Math.cos(ang) * d, m[1] + Math.sin(ang) * d * 0.45 - 1.4 * U_MINE * h, 0.05 * U_MINE, (1 - h / 1.2) * fade, D.lamp, false);
      }
    });
    return n;
  }

  /** A cell's texture; a name ending `-` steps through its frames over the part's life. */
  private tex(cell: string, u: number): Texture {
    if (!cell.endsWith('-')) return this.life.texture(cell);
    let f = this.frames.get(cell);
    if (!f) {
      f = [];
      for (let i = 0; this.life.m.cells[`${cell}${i}`]; i++) f.push(this.life.texture(`${cell}${i}`));
      this.frames.set(cell, f);
    }
    return f[Math.min(f.length - 1, Math.floor(u * f.length))]!;
  }
}
