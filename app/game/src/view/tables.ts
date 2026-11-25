import type { AtlasManifest } from '../types';

// The view's numbers, with no PixiJS (the field worker reads them too): baked tables (one texel a cell, never filtered)
// read to bytes, the box blur, easing, hashing, and the change check every layer renders by.

/** A table's cell: its three channels, w x h bytes each. */
export interface Field { w: number; h: number; r: Uint8Array; g: Uint8Array; b: Uint8Array }

/** A baked file's response; a missing one throws. */
export async function fetched(url: string): Promise<Response> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`${url}: ${res.status}`);
  return res;
}

/** Every cell of a table picture, exact: no colour conversion, no premultiplied alpha. */
export async function readTable(m: AtlasManifest, url: string): Promise<Record<string, Field>> {
  const bm = await createImageBitmap(await (await fetched(url)).blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const g = new OffscreenCanvas(bm.width, bm.height).getContext('2d', { willReadFrequently: true })!;
  g.drawImage(bm, 0, 0);
  bm.close();
  const all = g.getImageData(0, 0, m.w, m.h).data, out: Record<string, Field> = {};
  for (const [name, [x0, y0, w, h]] of Object.entries(m.cells)) {
    const f: Field = (out[name] = { w, h, r: new Uint8Array(w * h), g: new Uint8Array(w * h), b: new Uint8Array(w * h) });
    for (let i = 0; i < w * h; i++) {
      const j = ((y0 + Math.floor(i / w)) * m.w + x0 + (i % w)) * 4;
      f.r[i] = all[j]!, f.g[i] = all[j + 1]!, f.b[i] = all[j + 2]!;
    }
  }
  return out;
}

/** 0..1 as a byte. */
export const u8 = (v: number): number => (v <= 0 ? 0 : v >= 1 ? 255 : Math.round(v * 255));
export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const ss = (t: number): number => t * t * (3 - 2 * t);
export const smooth = (e0: number, e1: number, x: number): number => ss(clamp01((x - e0) / (e1 - e0)));
/** `v` to the nearest 1/n: amounts that close count as one, the screen moving in steps no eye tells apart. */
export const quant = (v: number, n: number): number => Math.round(v * n) / n;
export const hex = (c: string): number => parseInt(c.slice(1), 16);
export const mod = (v: number, m: number): number => ((v % m) + m) % m;
export const hash = (a: number, b: number, c: number): number => {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Bilinear over a w x h grid at (fx, fy) in cells, `at(x, y)` a cell's value (the caller clamps or zeroes the edges). */
export function bilinear(at: (x: number, y: number) => number, fx: number, fy: number): number {
  const x = Math.floor(fx), y = Math.floor(fy), tx = fx - x, ty = fy - y;
  return (at(x, y) * (1 - tx) + at(x + 1, y) * tx) * (1 - ty) + (at(x, y + 1) * (1 - tx) + at(x + 1, y + 1) * tx) * ty;
}

/** Whether a layer's inputs differ from those it last showed (`shown` takes them): a layer renders only on a change. */
export function differs(shown: number[], a: number, b = 0, c = 0, d = 0, e = 0): boolean {
  if (shown[0] === a && shown[1] === b && shown[2] === c && shown[3] === d && shown[4] === e) return false;
  shown[0] = a, shown[1] = b, shown[2] = c, shown[3] = d, shown[4] = e;
  return true;
}

/** the vertical pass's running sum per column, in doubles (as a lone running sum is) */
let cols = new Float64Array(0);

/** The w x h field's box blur of radius r, `passes` times, edges clamped; both passes walk rows in memory order. */
export function boxBlur(src: Float32Array, w: number, h: number, r: number, passes: number, tmp: Float32Array): void {
  const inv = 1 / (2 * r + 1);
  if (cols.length < w) cols = new Float64Array(w);
  const acc = cols;
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {
      const row = y * w, last = row + w - 1;
      let a = 0;
      for (let k = -r; k <= r; k++) a += src[k <= 0 ? row : k >= w ? last : row + k]!;
      for (let x = 0; x < w; x++) {
        tmp[row + x] = a * inv;
        const add = x + r + 1, sub = x - r;
        a += src[add < w ? row + add : last]! - src[sub > 0 ? row + sub : row]!;
      }
    }
    acc.fill(0, 0, w);
    for (let k = -r; k <= r; k++) for (let x = 0, row = (k <= 0 ? 0 : k >= h ? h - 1 : k) * w; x < w; x++) acc[x] = acc[x]! + tmp[row + x]!;
    for (let y = 0; y < h; y++) {
      const row = y * w, add = Math.min(h - 1, y + r + 1) * w, sub = Math.max(0, y - r) * w;
      for (let x = 0; x < w; x++) {
        src[row + x] = acc[x]! * inv;
        acc[x] = acc[x]! + (tmp[add + x]! - tmp[sub + x]!);
      }
    }
  }
}
