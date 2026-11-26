import type { AtlasManifest, PlaceId, Visibility } from '../types';
import { boxBlur, clamp01, readTable, ss, u8, type Field } from './tables';
import mineM from '../../assets/fog/mine/manifest.json';
import mineUrl from '../../assets/fog/mine/fog.png?url';

// The view's fields, worked out off the main thread: fog.ts posts what changed and the time gone, and puts the bytes it
// gets back on the GPU. The fog (#68), per fog cell an active and a seen amount from assets/fog's static fields: each
// cell's three strongest zones with their weights (fronts follow the ground and bend round rock), a change creeping out
// from the zone's anchor over FADE_S, blurred, then cut by a noisy threshold into irregular fronts; only the cells a
// changed zone reaches are worked out.

export type FogManifest = AtlasManifest & { cell: number; gw: number; gh: number; zones: PlaceId[]; seenFloor: number; seenSink: number };
/** The zones' visibility when one changed (else null), the seconds gone, set at once. */
export interface FieldAsk { zones: Visibility[] | null; dt: number; now: boolean }
/** The rows from y0 worked out (null: none). */
export interface FogRows { y0: number; bytes: Uint8Array | null }
/** The rows, and whether a fade runs on. */
export interface FieldAnswer { rows: FogRows; moving: boolean }

const VAL: Record<Visibility, readonly [number, number]> = { active: [1, 1], sensed: [0, 1], void: [0, 0] };
/** the zones a cell keeps; blur of a and of s (radius, passes) */
const K = 3, RA = 3, PA = 2, RS = 2, PS = 2;
/** seconds a visibility fade takes and its creeping front's width */
const FADE_S = 1.1, CREEP_W = 0.4;

/** A zone's fade (progress p 0..1, its ends [a, s]) and its cells' box. */
interface Zone { vis: Visibility; p: number; from: number[]; to: number[]; box: number[] }
/** per cell and kept zone, as baked: zone index (255 none), weight, creep order, in 255ths */
type Kept = readonly [Uint8Array, Uint8Array, Uint8Array];

/** One place's fog field. */
export class FogField {
  readonly w: number;
  readonly h: number;
  /** per cell: active and seen as worked out */
  readonly a: Float32Array; readonly s: Float32Array;
  /** the colour and seen fields' kept zones; the threshold's noise and rim mix */
  private readonly A: Kept; private readonly S: Kept; private readonly n1: Float32Array; private readonly rim: Float32Array;
  private readonly zones: Zone[];
  /** the raw fields (colour, seen, seen over its membership), their blurred copies and the blurs' scratch */
  private readonly ra: Float32Array; private readonly rs: Float32Array; private readonly rsn: Float32Array;
  private readonly ba: Float32Array; private readonly bs: Float32Array; private readonly bk: Float32Array; private readonly tmp: Float32Array;
  /** the zones changed since the field was last worked out, or all of them */
  private readonly pend = new Set<number>();
  private all = true;
  /** the cells the last update worked out [x0, y0, x1, y1), the bytes (`write`) */
  readonly out = new Int32Array(4);
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
    [this.n1, this.rim] = [by(f.n!, 'r'), by(f.n!, 'b')];
    this.zones = m.zones.map(() => ({ vis: 'void', p: 1, from: [0, 0], to: [0, 0], box: [gw, gh, 0, 0] }));
    [this.a, this.s, this.ra, this.rs, this.rsn, this.ba, this.bs, this.bk, this.tmp] = [F(), F(), F(), F(), F(), F(), F(), F(), F()];
    for (const id of [this.A[0], this.S[0]]) {
      for (let j = 0; j < n * K; j++) {
        if (id[j] === 255) continue;
        const b = this.zones[id[j]!]!.box, x = Math.floor(j / K) % gw, y = Math.floor(j / K / gw);
        b[0] = Math.min(b[0]!, x), b[1] = Math.min(b[1]!, y), b[2] = Math.max(b[2]!, x + 1), b[3] = Math.max(b[3]!, y + 1);
      }
    }
  }

  /** A zone's visibility: it creeps there (over FADE_S), or is there at once. */
  set(zone: number, vis: Visibility, now: boolean): void {
    const Z = this.zones[zone]!;
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

  /** One field (0 colour, 1 seen) at cell i from its kept zones; `sum` gets the weights' total. */
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
      sum.w = 0;
      this.ra[i] = this.value(i, 0);
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
    return this.zones.some((Z) => Z.p < 1);
  }

  /** The cells the last update worked out into `bytes`: G seen, B active. */
  write(): void {
    const o = this.out, b = this.bytes;
    for (let y = o[1]!; y < o[3]!; y++) for (let x = o[0]!; x < o[2]!; x++) {
      const i = y * this.w + x, j = i * 4;
      b[j + 1] = u8(this.s[i]!), b[j + 2] = u8(this.a[i]!);
    }
  }
}

void readTable(mineM as unknown as AtlasManifest, mineUrl).then((table) => {
  const f = new FogField(table, mineM as unknown as FogManifest);
  self.onmessage = ({ data }: MessageEvent<FieldAsk>) => {
    data.zones?.forEach((v, z) => f.set(z, v, data.now));
    let rows: FogRows = { y0: 0, bytes: null };
    if (f.update(data.dt)) {
      f.write();
      rows = { y0: f.out[1]!, bytes: f.bytes.slice(f.out[1]! * f.w * 4, f.out[3]! * f.w * 4) };
    }
    const out: FieldAnswer = { rows, moving: f.moving };
    self.postMessage(out, { transfer: rows.bytes ? [rows.bytes.buffer] : [] });
  };
  self.postMessage('ready');
});
