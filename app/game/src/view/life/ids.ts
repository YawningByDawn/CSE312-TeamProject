import type { Hold } from './rig';

// A figure's part names as numbers and its variant keys (rig.ts poses with them, looks.ts finds cells by them).
/** Part names as numbers (interned once at load): a painted part has its role's paint at `id` and a follower's at `id + 1`. */
const NAMES = new Map<string, number>();
export const NAME_LIST: string[] = [];
export function nameId(name: string): number {
  let i = NAMES.get(name);
  if (i === undefined) NAMES.set(name, (i = NAME_LIST.push(name) - 1));
  return i;
}
/** a painted part's pair (`<base>:n`, `<base>:f`), by its `n` id */
export function paintId(base: string): number {
  const n = nameId(base + ':n');
  if (nameId(base + ':f') !== n + 1) throw new Error(`paint pair ${base} out of order`);
  return n;
}
const P = (base: string): number => paintId(base);
export const ID = {
  bk: nameId('bk'), tr: nameId('tr'), tell: nameId('tl:f'), ct: P('ct'), gp: P('gp'), im: nameId('im'),
  hb: nameId('hb'), hu: nameId('hu'), cr: P('cr'), ho: nameId('ho'), hk: nameId('hk'), wk: P('wk'), gl: P('gl'),
  leg: (['f', 'n'] as const).map((s) => ({ thi: nameId('thi' + s), shi: nameId('shi' + s), shc: nameId('shc' + s), thc: nameId('thc' + s), bd: nameId('bd' + s), ft: nameId('ft' + s) })),
  arm: (['f', 'n'] as const).map((s) => ({ uai: nameId('uai' + s), fai: nameId('fai' + s), fac: nameId('fac' + s), uac: nameId('uac' + s), hd: [nameId(`hd${s}0`), nameId(`hd${s}1`)] })),
};
/** A hold's painted props by id: near, far, back load, on the ground (-1: none). */
export interface HoldIds { near: number; far: number; back: number; ground: number }
export function holdIds(h: Hold): HoldIds {
  return { near: h.near ? P('pn:' + h.near) : -1, far: h.far ? P('pf:' + h.far) : -1, back: h.back ? P('ld:' + h.back) : -1, ground: h.ground ? P('pg:' + h.ground) : -1 };
}
export const LANTERN = P('pn:lantern');

/** Bins of up to five, packed (each -6..57) into one small integer (under 2^30): a part's variant key. */
export const pack = (a = 0, b = 0, c = 0, d = 0, e = 0): number => ((((a + 6) * 64 + b + 6) * 64 + c + 6) * 64 + d + 6) * 64 + e + 6;
/** The first `n` bins of a key into `out`. */
export function unpack(k: number, n: number, out: number[]): number[] {
  out.length = n;
  for (let i = 4; i >= 0; i--) { if (i < n) out[i] = (k % 64) - 6; k = Math.floor(k / 64); }
  return out;
}
