// A small figure's box (src/view/life/rig.ts BOX, the stamp's slot in stamps.ts): every part of every baked step of
// every look's clips, in each weather that moves a body outward, lies inside it, so no stamped figure is cut at its
// slot's edge. A follower's paint and the hood change no part's place (the hood only covers the wick).
import { describe, expect, it } from 'vitest';
import { BOX, Body, PART, bucket, type Hold, type LookBody, type Series } from '../../../src/view/life/rig';
import { holdIds, nameId, NAME_LIST, unpack } from '../../../src/view/life/ids';
import type { Weather } from '../../../src/types';
import people from '../../../assets/people/people.json';
import poses from '../../../assets/poses/poses.json';

interface LookData { id: string; role: string; hk: number; kit: LookBody['kit']; rest: LookBody['rest']; rainHood: boolean; k: { lo: number }; parts: Record<string, number[][]>; cells: { lo: number[] } }
const P = poses as unknown as { holds: (string | number | null)[][]; series: (Omit<Series, 'f'> & { f: number[] })[]; roles: Record<string, Record<string, number>>; looks: Record<string, number[]> };
const series: Series[] = P.series.map((s) => ({ ...s, f: Float32Array.from(s.f) }));
const holds: Hold[] = P.holds.map((h) => ({ near: h[0] as string | null, far: h[1] as string | null, back: h[2] as string | null, cart: !!h[3], ground: h[4] as string | null, gx: h[5] as number, gy: h[6] as number, twoHand: !!h[7] }));
const ids = holds.map(holdIds);
/** the weathers that move a body outward: none, the storm's lean, the fog's lamp held out (the cold hugs it in) */
const WEATHER: Weather[] = ['clear', 'storm', 'fog'];

describe('stamps', () => {
  it('holds every small step of every look inside the slot box', () => {
    const box = { x0: 0, x1: 0, y0: 0, y1: 0 }, who = { x0: '', x1: '', y0: '', y1: '' };
    for (const d of people as unknown as LookData[]) {
      const x = P.looks[d.id]!, look: LookBody = { hk: d.hk, hunch: x[0]!, tilt: x[1]!, seed: x[2]!, kit: d.kit, rest: d.rest, rainHood: d.rainHood };
      const variants = new Map<number, number[][]>();
      for (const [name, vs] of Object.entries(d.parts)) variants.set(nameId(name), vs);
      // the cell a part shows (people.ts Look.cell: the variant nearest its bins), in its part's frame: x0, y0, x1, y1
      const seen = new Map<number, number[] | null>();
      const reach = (id: number, bins: number): number[] | null => {
        const key = id * 2 ** 30 + bins;
        if (!seen.has(key)) seen.set(key, cell(id, bins));
        return seen.get(key)!;
      };
      const cell = (id: number, bins: number): number[] | null => {
        const list = variants.get(id);
        if (!list) return null;
        const want = unpack(bins, list[0]!.length - 2, []);
        let best = list[0]!, bestD = Infinity;
        for (const x of list) {
          let dd = 0;
          for (let k = 0; k < want.length; k++) dd = dd * 64 + Math.min(63, Math.abs(x[k]! - want[k]!));
          if (dd < bestD) { bestD = dd; best = x; }
        }
        const o = best[best.length - 2]! * 6, c = d.cells.lo, K = d.k.lo;
        return [c[o + 4]!, c[o + 5]!, c[o + 4]! + K * c[o + 2]!, c[o + 5]! + K * c[o + 3]!];
      };
      for (const [clip, ix] of Object.entries(P.roles[d.role]!)) {
        const s = series[ix]!;
        const b = new Body();
        b.play(clip, s, -10);
        for (const w of WEATHER) for (let step = 0; step < s.n; step++) {
          b.evaluate(0, ((step + 0.5) / s.n) * s.dur, clip !== 'collapse', holds, ids, look, w, 1, 0.3);
          b.layout(look, 0, 0, 1, 0.5, 0, 0.3);
          for (let i = 0; i < b.n; i++) {
            const o = i * PART, r = reach(b.parts[o]!, b.parts[o + 1]!);
            if (!r) continue;
            const [a, bb, c, dd, e, f] = [b.parts[o + 3]!, b.parts[o + 4]!, b.parts[o + 5]!, b.parts[o + 6]!, b.parts[o + 7]!, b.parts[o + 8]!];
            for (const [px, py] of [[r[0]!, r[1]!], [r[2]!, r[1]!], [r[0]!, r[3]!], [r[2]!, r[3]!]] as const) {
              const X = a * px + c * py + e, Y = bb * px + dd * py + f;
              if (X < box.x0 || X > box.x1 || Y < box.y0 || Y > box.y1) {
                const at = `${d.id} ${clip} step ${step} ${w} part ${NAME_LIST[b.parts[o]!]}`;
                if (X < box.x0) { box.x0 = X; who.x0 = at; }
                if (X > box.x1) { box.x1 = X; who.x1 = at; }
                if (Y < box.y0) { box.y0 = Y; who.y0 = at; }
                if (Y > box.y1) { box.y1 = Y; who.y1 = at; }
              }
            }
          }
        }
      }
    }
    const inside = box.x0 >= BOX.x0 && box.x1 <= BOX.x1 && box.y0 >= BOX.y0 && box.y1 <= BOX.y1;
    expect(inside, JSON.stringify({ box, who })).toBe(true);
  });

  it('rounds a figure up to a quarter octave, never past the small size', () => {
    expect(bucket(0.69)).toBeCloseTo(2 ** -0.5);
    expect(bucket(0.5)).toBeCloseTo(0.5);
    expect(bucket(0.45)).toBeCloseTo(2 ** -1);
    expect(bucket(0.3)).toBeCloseTo(2 ** -1.5);
  });
});
