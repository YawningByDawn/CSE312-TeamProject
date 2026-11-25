import type { AtlasManifest, PlaceId, Visibility } from '../types';
import { boxBlur, clamp01, readTable, smooth, ss, u8, type Field } from './tables';
import mineM from '../../assets/fog/mine/manifest.json';
import mineUrl from '../../assets/fog/mine/fog.png?url';
import townM from '../../assets/fog/town/manifest.json';
import townUrl from '../../assets/fog/town/fog.png?url';
import maskM from '../../assets/valley/mask/manifest.json';
import maskUrl from '../../assets/valley/mask/valley.png?url';

// The view's fields, worked out off the main thread: fog.ts posts what changed and the time gone, and puts the bytes it
// gets back on the GPU. The fog (#68), per fog cell an active and a seen amount from assets/fog's static fields: each
// cell's three strongest zones with their weights (fronts follow the ground and bend round rock), a change creeping out
// from the zone's anchor over FADE_S, blurred, then cut by a noisy threshold into irregular fronts; only the cells a
// changed zone reaches are worked out. The stain (#69): a Sensed zone with Hold h shows the share h of its ground in
// colour, grown along an order field from where the colour comes in (`meets`: mouths and borders shared with coloured
// neighbours, its hearths, else its own start); the shown hold creeps to a new one, a living front running just ahead.
// The land's known-ground mask (#66), from assets/valley/mask, the town blocks' fog and the ending's reveal.

type Meets = { between: number[][]; own: number[][]; pit?: number[] };
export type FogManifest = AtlasManifest & { cell: number; gw: number; gh: number; zones: PlaceId[]; seenFloor: number; seenSink: number; hazePow: number; meets: Meets };
/** A zone as fog.ts asks for it: its visibility, Hold 0..1, the zones its colour comes in from (-1 up the pit), its hearths (x, y pairs). */
export interface ZoneAsk { vis: Visibility; hold: number; from: number[]; at: number[] }
/** The land's inputs: each town block's visibility, and how far the ending opens the land (seen, and coloured too). */
export interface LandAsk { blocks: Visibility[]; seen: number; colour: number }
/** Each place's zones when one changed (else null), the land's inputs when they changed, the seconds gone, set at once. */
export interface FieldAsk { zones: (ZoneAsk[] | null)[]; land: LandAsk | null; dt: number; now: boolean }
/** One place's rows from y0 worked out (null: none), its cells holding haze and the shimmer. */
export interface FogRows { y0: number; bytes: Uint8Array | null; haze: number; shimmer: number }
/** Each place's rows, the land's new mask (R seen x the town cut, G how gray, B the far weight; null: none), a fade runs on. */
export interface FieldAnswer { places: FogRows[]; land: Uint8Array | null; moving: boolean }

const VAL: Record<Visibility, readonly [number, number]> = { active: [1, 1], sensed: [0, 1], void: [0, 0] };
/** the zones a cell keeps; blur of a and of s (radius, passes) */
const K = 3, RA = 3, PA = 2, RS = 2, PS = 2;
/** seconds a visibility fade takes and its creeping front's width; the stain's creep to a new Hold (ease-out) and its soft width in order units */
const FADE_S = 1.1, CREEP_W = 0.4, STAIN_S = 2, STAIN_W = 0.06;
const D8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]] as const;
/** The town block whose road leads out. */
const GATE: PlaceId = 'citygate';

/** A binary min-heap of cells by distance; `pop` leaves the cell's distance in `top`. */
class Heap {
  private readonly c: number[] = [];
  private readonly d: number[] = [];
  top = 0;
  get size(): number { return this.c.length; }
  push(c: number, d: number): void {
    let n = this.c.length;
    this.c.push(c), this.d.push(d);
    for (let p = (n - 1) >> 1; n > 0 && this.d[p]! > d; n = p, p = (n - 1) >> 1) this.c[n] = this.c[p]!, this.d[n] = this.d[p]!;
    this.c[n] = c, this.d[n] = d;
  }
  pop(): number {
    this.top = this.d[0]!;
    const c0 = this.c[0]!, lc = this.c.pop()!, ld = this.d.pop()!, L = this.c.length;
    if (!L) return c0;
    let n = 0;
    for (let m = 1; m < L; n = m, m = n * 2 + 1) {
      if (m + 1 < L && this.d[m + 1]! < this.d[m]!) m++;
      if (this.d[m]! >= ld) break;
      this.c[n] = this.c[m]!, this.d[n] = this.d[m]!;
    }
    this.c[n] = lc, this.d[n] = ld;
    return c0;
  }
}

/** A zone's fade (progress p 0..1, its ends [a, s]), its stain (order field, seeds' key, hold shown, the creep's ends and progress), its cells' box. */
interface Zone { vis: Visibility; p: number; from: number[]; to: number[]; ord: Float32Array | null; key: string; hold: number; hFrom: number; hTo: number; hp: number; box: number[] }
/** per cell and kept zone, as baked: zone index (255 none), weight, creep order, in 255ths */
type Kept = readonly [Uint8Array, Uint8Array, Uint8Array];

/** One place's fog field. */
export class FogField {
  readonly w: number;
  readonly h: number;
  /** per cell: active, seen and the stain's front as worked out; the haze weight */
  readonly a: Float32Array; readonly s: Float32Array; readonly front: Float32Array; private readonly cave: Float32Array;
  /** the colour and seen fields' kept zones; the threshold's noise and rim mix */
  private readonly A: Kept; private readonly S: Kept; private readonly n1: Float32Array; private readonly rim: Float32Array;
  /** the stain's tables: o (core zone, map art, haze weight: in the town the light's reach), t (step noise, grain, street) */
  private readonly o: Field; private readonly t: Field;
  private readonly zones: Zone[];
  /** the raw fields (colour, seen, seen over its membership), their blurred copies and the blurs' scratch */
  private readonly ra: Float32Array; private readonly rs: Float32Array; private readonly rsn: Float32Array;
  private readonly ba: Float32Array; private readonly bs: Float32Array; private readonly bk: Float32Array; private readonly tmp: Float32Array;
  /** the zones changed since the field was last worked out, or all of them; the living front's weight `value` last found */
  private readonly pend = new Set<number>();
  private all = true;
  private fr = 0;
  /** the cells the last update worked out [x0, y0, x1, y1), how many cells' bytes hold haze and the shimmer, the bytes (`write`) */
  readonly out = new Int32Array(4);
  haze = 0;
  shimmer = 0;
  readonly bytes: Uint8Array;

  constructor(f: Record<string, Field>, private readonly m: FogManifest) {
    const { gw, gh } = m, n = gw * gh, F = () => new Float32Array(n);
    [this.w, this.h, this.bytes] = [gw, gh, new Uint8Array(n * 4)];
    const pack = (pre: string): Kept => {
      const id = new Uint8Array(n * K), w = new Uint8Array(n * K), c = new Uint8Array(n * K);
      for (let k = 0; k < K; k++) for (let i = 0, t = f[`${pre}${k}`]!; i < n; i++) id[i * K + k] = t.r[i]!, w[i * K + k] = t.g[i]!, c[i * K + k] = t.b[i]!;
      return [id, w, c];
    };
    [this.A, this.S] = [pack('a'), pack('s')];
    const by = (t: Field, ch: 'r' | 'b') => Float32Array.from(t[ch], (v) => v / 255);
    [this.n1, this.rim, this.cave, this.o, this.t] = [by(f.n!, 'r'), by(f.n!, 'b'), by(f.o!, 'b'), f.o!, f.t!];
    this.zones = m.zones.map(() => ({ vis: 'void', p: 1, from: [0, 0], to: [0, 0], ord: null, key: '', hold: 0, hFrom: 0, hTo: 0, hp: 1, box: [gw, gh, 0, 0] }));
    [this.a, this.s, this.front, this.ra, this.rs, this.rsn, this.ba, this.bs, this.bk, this.tmp] = [F(), F(), F(), F(), F(), F(), F(), F(), F(), F()];
    for (const id of [this.A[0], this.S[0]]) {
      for (let j = 0; j < n * K; j++) {
        if (id[j] === 255) continue;
        const b = this.zones[id[j]!]!.box, x = Math.floor(j / K) % gw, y = Math.floor(j / K / gw);
        b[0] = Math.min(b[0]!, x), b[1] = Math.min(b[1]!, y), b[2] = Math.max(b[2]!, x + 1), b[3] = Math.max(b[3]!, y + 1);
      }
    }
  }

  /** A zone's visibility and stain: each creeps there (over FADE_S, STAIN_S), or is there at once. */
  set(zone: number, { vis, hold, from, at }: ZoneAsk, now: boolean): void {
    const Z = this.zones[zone]!, h = vis === 'void' ? 0 : hold, key = `${from}|${at}`;
    if (key !== Z.key && (h > 0 || Z.hold > 0)) Z.key = key, Z.ord = this.order(zone, from, at), this.pend.add(zone);
    if (now || Math.abs(Z.hTo - h) > 1e-4) {
      if (now) Z.hold = h;
      Z.hFrom = Z.hold, Z.hTo = h, Z.hp = now ? 1 : 0;
      this.pend.add(zone);
    }
    if (Z.vis === vis && !now) return;
    const k = ss(Z.p);
    Z.from = Z.from.map((v, j) => v + (Z.to[j]! - v) * k);
    Z.vis = vis, Z.to = [...VAL[vis]], Z.p = now ? 1 : 0;
    this.pend.add(zone);
  }

  /** Advance the fades by `dt` s; true when the field was worked out again. */
  update(dt: number): boolean {
    this.zones.forEach((Z, z) => {
      if (Z.p < 1) Z.p = Math.min(1, Z.p + dt / FADE_S), this.pend.add(z);
      if (Z.hp < 1) {
        Z.hp = Math.min(1, Z.hp + dt / STAIN_S);
        Z.hold = Z.hFrom + (Z.hTo - Z.hFrom) * (1 - (1 - Z.hp) ** 3);
        this.pend.add(z);
      }
    });
    if (!this.all && this.pend.size === 0) return false;
    let d = this.all ? [0, 0, this.w, this.h] : [this.w, this.h, 0, 0];
    for (const z of this.all ? [] : this.pend) {
      const b = this.zones[z]!.box;
      d = [Math.min(d[0]!, b[0]!), Math.min(d[1]!, b[1]!), Math.max(d[2]!, b[2]!), Math.max(d[3]!, b[3]!)];
    }
    this.all = false;
    this.pend.clear();
    if (d[2]! <= d[0]! || d[3]! <= d[1]!) return false;
    this.rebuild(d[0]!, d[1]!, d[2]!, d[3]!);
    return true;
  }

  /** One field (0 colour, with the stain; 1 seen) at cell i from its kept zones; `sum` gets the weights' total. */
  private value(i: number, j: 0 | 1, sum?: { w: number }): number {
    const kept = j ? this.S : this.A, id = kept[0], zw = kept[1], creep = kept[2];
    let v = 0;
    for (let k = 0; k < K; k++) {
      const ik = i * K + k, z = id[ik]!;
      if (z === 255) break;
      const Z = this.zones[z]!, a = Z.from[j]!, b = Z.to[j]!, w = zw[ik]! / 255;
      let x = b;
      if (Z.p < 1) {
        const up = Z.to[0]! + Z.to[1]! >= Z.from[0]! + Z.from[1]!, c = (up ? creep[ik]! : 255 - creep[ik]!) / 255;
        x = a + (b - a) * ss(clamp01((Z.p * (1 + CREEP_W) - c) / CREEP_W));
      }
      // the stain: the zone's ground up to its Hold is in colour where it is seen, its front just ahead
      const o = Z.ord, hold = Z.hold;
      if (j === 0 && x < 1 && o && Z.vis !== 'void' && (hold > 0 || Z.hp < 1)) {
        const e = hold * (1 + STAIN_W), oi = o[i]!, s0 = Z.from[1]!, dd = (oi - e) / 0.09;
        x = Math.max(x, ss(clamp01((e - oi) / STAIN_W)) * (s0 + (Z.to[1]! - s0) * ss(Z.p)));
        if (hold < 0.999 && dd > -0.3 && dd < 1) this.fr += w * (dd < 0 ? 1 + dd / 0.3 : 1 - dd) * Math.min(1, hold * 12 + (Z.hp < 1 ? 0.5 : 0));
      }
      v += w * x;
      if (sum) sum.w += w;
    }
    return v;
  }

  /**
   * The raw fields again over the cells [x0, x1) x [y0, y1) the changed zones reach, then blurred and cut over that
   * rect grown by the blurs' reach (from a copy grown once more, so the blur there is the whole grid's).
   */
  private rebuild(x0: number, y0: number, x1: number, y1: number): void {
    const { w, h, tmp } = this, sink = this.m.seenSink, floor = this.m.seenFloor, sum = { w: 0 };
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = y * w + x;
      this.fr = sum.w = 0;
      this.ra[i] = this.value(i, 0);
      this.front[i] = this.fr;
      const sv = (this.rs[i] = this.value(i, 1, sum));
      this.rsn[i] = sum.w > 1e-4 ? Math.min(1, sv / sum.w) : 0;
    }
    const R = Math.max(RA * PA, RS * PS + 2 * sink), grow = (v: number, by: number, max: number) => Math.min(max, Math.max(0, v + by));
    const ox0 = grow(x0, -R, w), oy0 = grow(y0, -R, h), ox1 = grow(x1, R, w), oy1 = grow(y1, R, h);
    this.out.set([ox0, oy0, ox1, oy1]);
    const ex0 = grow(ox0, -R, w), ey0 = grow(oy0, -R, h), ew = grow(ox1, R, w) - ex0, eh = grow(oy1, R, h) - ey0;
    const ba = this.ba.subarray(0, ew * eh), bs = this.bs.subarray(0, ew * eh), bk = this.bk.subarray(0, ew * eh);
    for (let y = 0, from = ey0 * w + ex0; y < eh; y++, from += w) {
      ba.set(this.ra.subarray(from, from + ew), y * ew);
      bs.set(this.rs.subarray(from, from + ew), y * ew);
      bk.set(this.rsn.subarray(from, from + ew), y * ew);
    }
    // colour drains to gray over a long soft distance; gray sinks into black a little faster; the seen sink: a wider
    // blur of the membership-normalised seen field, about 0.5 at the front and 1 deep inside
    boxBlur(ba, ew, eh, RA, PA, tmp);
    boxBlur(bs, ew, eh, RS, PS, tmp);
    if (sink > 0) boxBlur(bk, ew, eh, RS, PS, tmp), boxBlur(bk, ew, eh, sink, 2, tmp);
    for (let y = oy0; y < oy1; y++) for (let x = ox0; x < ox1; x++) {
      const i = y * w + x, b = (y - ey0) * ew + x - ex0, nz = this.n1[i]! - 0.5, lo = this.rim[i]! - 0.5;
      let av = ba[b]!, sv = bs[b]!;
      // irregular fronts: a noisy threshold reshapes the soft ramp (0 and 1 stay put)
      if (av > 0.001 && av < 0.999) av = ss(clamp01((av - Math.min(0.7, Math.max(0.3, 0.5 + nz * 0.9 + lo * 0.5)) + 0.3) / 0.6));
      else av = av >= 0.999 ? 1 : 0;
      if (sv > 0.001 && sv < 0.999) {
        const thr = Math.min(0.72, Math.max(0.28, 0.5 + nz * 1.2 + lo * 0.6));
        sv = ss(clamp01((sv - thr + 0.28) / 0.56) * (sv < floor ? 0 : 1) * clamp01((sv - floor) / 0.08 + (floor ? 0 : 1)));
      } else sv = sv >= 0.999 ? 1 : 0;
      if (sink > 0 && sv > 0) sv *= clamp01((bk[b]! - 0.5) / 0.48) ** 2;
      // Active implies seen: colour never shows where the world is Void
      this.a[i] = Math.min(av, sv);
      this.s[i] = sv;
    }
  }

  /** Whether a fade runs on. */
  get moving(): boolean {
    return this.zones.some((Z) => Z.p < 1 || Z.hp < 1);
  }

  /**
   * The order zone z's ground takes colour in: 0..1 the share of its ground coloured before a cell (2 off its ground), by
   * a Dijkstra from its seeds over the `t` table's noisy step costs. The mine's runs over the cells the zone has any
   * weight in (its own cheaper), seeds snapped onto them; the town's over the block's own lit cells, streets cheaper,
   * from its borders with the blocks its colour comes from too.
   */
  private order(z: number, from: readonly number[], at: readonly number[]): Float32Array {
    const { w, h, o, t } = this, n = w * h, { cell, meets } = this.m, town = !!meets.pit, [zid, zw] = this.A;
    const inR = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      if (town) inR[i] = o.r[i] === z && o.b[i]! >= 5 ? 1 : 0;
      else for (let k = 0; k < K; k++) if (zid[i * K + k] === z && zw[i * K + k]! > 5) inR[i] = 1;
    }
    const dist = new Float32Array(n).fill(Infinity), heap = new Heap();
    const seed = (c: number, d: number) => {
      if (c >= 0 && inR[c] && d < dist[c]!) dist[c] = d, heap.push(c, d);
    };
    const seedAt = (x: number, y: number, d = 0) => {
      const sx = Math.floor(x / cell), sy = Math.floor(y / cell);
      if (town) return seed(sx >= 0 && sy >= 0 && sx < w && sy < h ? sy * w + sx : -1, d);
      // the nearest of the zone's cells (a seed may sit just outside them)
      let best = -1, bd = Infinity;
      for (let dy = -12; dy <= 12; dy++) for (let dx = -12; dx <= 12; dx++) {
        const xx = sx + dx, yy = sy + dy, q = dx * dx + dy * dy;
        if (xx >= 0 && yy >= 0 && xx < w && yy < h && inR[yy * w + xx] && q < bd) bd = q, best = yy * w + xx;
      }
      seed(best, d);
    };
    for (const f of from) {
      if (f < 0) {
        if (meets.pit) seedAt(meets.pit[0]!, meets.pit[1]!, meets.pit[2]);
        continue;
      }
      for (const b of meets.between) if (b[0] === z && b[1] === f) seedAt(b[2]!, b[3]!, b[4]);
      if (town) {
        for (let i = 0; i < n; i++) {
          const x = i % w;
          if ((x > 0 && o.r[i - 1] === f) || (x < w - 1 && o.r[i + 1] === f) || o.r[i - w] === f || o.r[i + w] === f) seed(i, 0);
        }
      }
    }
    for (let k = 0; k < at.length; k += 2) seedAt(at[k]!, at[k + 1]!);
    if (!heap.size) seedAt(meets.own[z]![0]!, meets.own[z]![1]!);
    const cost = Float32Array.from(t.r, (v, i) => (town ? cell * (0.55 + (v / 255) * 0.9) * (t.b[i] ? 0.7 : 1) : 0.45 + 1.4 * (v / 255) ** 1.5 + (o.r[i] === z ? 0 : 0.6)));
    while (heap.size) {
      const c = heap.pop(), d0 = heap.top;
      if (d0 > dist[c]!) continue;
      const x = c % w, y = (c / w) | 0;
      for (const [dx, dy, l] of D8) {
        const nx = x + dx, ny = y + dy, q = ny * w + nx;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || !inR[q]) continue;
        const nd = d0 + l * (town ? cost[q]! : 0.5 * (cost[c]! + cost[q]!));
        if (nd < dist[q]!) dist[q] = nd, heap.push(q, nd);
      }
    }
    // ranked by the zone's ground: its map art (the mine's own cells of it)
    const ground: number[] = [];
    for (let i = 0; i < n; i++) if (inR[i] && o.g[i] && (town || o.r[i] === z) && dist[i]! < Infinity) ground.push(dist[i]!);
    ground.sort((a, b) => a - b);
    const G = Math.max(1, ground.length), out = new Float32Array(n).fill(2);
    for (let i = 0; i < n; i++) {
      if (!inR[i]) continue;
      if (dist[i] === Infinity) {
        out[i] = town ? 1 : 1.2;
        continue;
      }
      let lo = 0, hi = ground.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (ground[mid]! < dist[i]!) lo = mid + 1;
        else hi = mid;
      }
      // the mine's fine grain: its front is never a smooth contour
      out[i] = town ? Math.min(1, lo / G) : lo / G + (t.g[i]! / 255 - 0.5) * 0.05;
    }
    return out;
  }

  /**
   * The cells the last update worked out into `bytes`: R the haze weight, G seen, B active, A the stain's front; and
   * the count of cells whose bytes hold haze (seen, not active, in the haze's reach) and the shimmer.
   */
  write(): void {
    const o = this.out, b = this.bytes;
    const count = (j: number, k: number) => {
      if (b[j]! > 0 && b[j + 1]! > 0) this.haze += b[j + 2]! < 255 ? k : 0, this.shimmer += b[j + 3]! > 0 ? k : 0;
    };
    for (let y = o[1]!; y < o[3]!; y++) for (let x = o[0]!; x < o[2]!; x++) {
      const i = y * this.w + x, j = i * 4;
      count(j, -1);
      b[j] = u8(this.cave[i]!), b[j + 1] = u8(this.s[i]!), b[j + 2] = u8(this.a[i]!), b[j + 3] = u8(this.front[i]!);
      count(j, 1);
    }
  }
}

/**
 * The land's mask from assets/valley/mask's fields (k: the cell's block, edge fade, town cut; d: distance past the bowl
 * floor, the far weight; road: distance along and to the road): known as far as the blocks next to it are, farther the
 * more of the town is held, up the road past the gate block, and round the town out to the reveal's reach.
 */
function landMask({ k, d, road: r }: Record<string, Field>): (ask: LandAsk) => Uint8Array {
  const w = k!.w, h = k!.h, n = w * h, gate = townM.zones.indexOf(GATE), raw = new Float32Array(n), tmp = new Float32Array(n);
  const dist = Float32Array.from(d!.r, (v, i) => (v << 8) | d!.g[i]!), roadAt = Float32Array.from(r!.r, (v, i) => (v << 8) | r!.g[i]!);
  return ({ blocks, seen: rv, colour: rc }) => {
    const B = blocks.map((v) => ({ colour: v === 'active' ? 1 : 0, seen: v === 'void' ? 0 : 1 })), g = B[gate]!;
    const fa = B.reduce((t, b) => t + b.colour, 0) / B.length, fs = B.reduce((t, b) => t + b.seen, 0) / B.length;
    // how far the knowledge reaches past the rim and up the road (units); the reveal opens the land round the town
    const Rs = 1000 + 2200 * fs + 3200 * fa + rv * 22000, Rc = 700 + 3600 * fa + rc * 22000, Ws = rv * 26000, Wc = rc * 26000;
    const roadS = g.seen * (1600 + 7000 * fa * g.colour) + rv * 20000, roadC = g.colour * (900 + 4000 * fa) + rc * 20000;
    const C = new Float32Array(n), S = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const b = B[k!.r[i]!], di = dist[i]!, rd = r!.b[i]! * 4, ra = roadAt[i]!;
      const c = Math.max(b ? b.colour * smooth(Rc, Rc - 700, di) : 0, smooth(700, 300, rd) * smooth(roadC, roadC - 700, ra), rc * smooth(Wc, Wc - 2000, di));
      S[i] = Math.max(b ? b.seen * smooth(Rs, Rs - 1000, di) : 0, smooth(900, 380, rd) * smooth(roadS, roadS - 900, ra), rv * smooth(Ws, Ws - 2000, di), c) * (k!.g[i]! / 255);
      C[i] = Math.min(c, S[i]!);
    }
    // erode then blur: the soft edge stays inside the known side (unknown cells keep exact 0)
    for (const v of [C, S]) {
      raw.set(v);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let m = 1;
        for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) m = Math.min(m, xx < 0 || yy < 0 || xx >= w || yy >= h ? 0 : raw[yy * w + xx]!);
        v[y * w + x] = m;
      }
      boxBlur(v, w, h, 1, 1, tmp);
    }
    const bytes = new Uint8Array(n * 4);
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      const s = S[i]!;
      bytes[j] = u8(s * (k!.b[i]! / 255)), bytes[j + 1] = u8(s > 0.002 ? 1 - C[i]! / s : 0), bytes[j + 2] = d!.b[i]!, bytes[j + 3] = 255;
    }
    return bytes;
  };
}

void Promise.all(([[mineM, mineUrl], [townM, townUrl]] as const).map(async ([m, url]) => new FogField(await readTable(m as unknown as AtlasManifest, url), m as unknown as FogManifest))).then((places) => {
  /** the land's mask, its table read on the first ask for it (the land shows after the first screen) */
  let land: Promise<(ask: LandAsk) => Uint8Array> | null = null;
  self.onmessage = async ({ data }: MessageEvent<FieldAsk>) => {
    const mask = data.land && (await (land ??= readTable(maskM as unknown as AtlasManifest, maskUrl).then(landMask)))(data.land);
    const out: FieldAnswer = {
      places: places.map((f, k) => {
        data.zones[k]?.forEach((v, z) => f.set(z, v, data.now));
        if (!f.update(data.dt)) return { y0: 0, bytes: null, haze: f.haze, shimmer: f.shimmer };
        f.write();
        return { y0: f.out[1]!, bytes: f.bytes.slice(f.out[1]! * f.w * 4, f.out[3]! * f.w * 4), haze: f.haze, shimmer: f.shimmer };
      }),
      land: mask,
      moving: places.some((f) => f.moving),
    };
    self.postMessage(out, { transfer: [...out.places.flatMap((p) => (p.bytes ? [p.bytes.buffer] : [])), ...(mask ? [mask.buffer] : [])] });
  };
  self.postMessage('ready');
});
