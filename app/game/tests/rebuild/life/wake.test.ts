// A figure laid out at time t shows the same parts at every later time before its `Body.wake` (the wick's frame, a
// blink, a burst, a flutter): the people layer skips it until then (src/view/life/people.ts, `Shown.until`).
import { describe, expect, it } from 'vitest';
import { Body, PART, type Hold, type LookBody, type Series } from '../../../src/view/life/rig';
import { holdIds } from '../../../src/view/life/ids';
import people from '../../../assets/people/people.json';
import poses from '../../../assets/poses/poses.json';

interface LookData { id: string; role: string; hk: number; kit: LookBody['kit']; rest: LookBody['rest']; rainHood: boolean; parts: Record<string, number[][]> }
const P = poses as unknown as { holds: (string | number | null)[][]; series: (Omit<Series, 'f'> & { f: number[] })[]; roles: Record<string, Record<string, number>>; looks: Record<string, number[]> };
const series: Series[] = P.series.map((s) => ({ ...s, f: Float32Array.from(s.f) }));
const holds: Hold[] = P.holds.map((h) => ({ near: h[0] as string | null, far: h[1] as string | null, back: h[2] as string | null, cart: !!h[3], ground: h[4] as string | null, gx: h[5] as number, gy: h[6] as number, twoHand: !!h[7] }));
const ids = holds.map(holdIds);

describe('wake', () => {
  it('leaves a calm figure unchanged until its wake', () => {
    for (const d of people as unknown as LookData[]) {
      const x = P.looks[d.id]!, look: LookBody = { hk: d.hk, hunch: x[0]!, tilt: x[1]!, seed: x[2]!, kit: d.kit, rest: d.rest, rainHood: d.rainHood, outline: 'o:tr' in d.parts };
      const ix = P.roles[d.role]!.idle!, s = series[ix]!;
      const b = new Body();
      b.play('idle', s, -10);
      const draw = (t: number): number[] => {
        b.evaluate(t, 0.5 * s.dur / s.n, true, holds, ids, look, 'clear', 1, 0.3);
        b.layout(look, 0, 0, 1, 0.5, t, 0.3);
        return Array.from(b.parts.subarray(0, b.n * PART));
      };
      for (const t0 of [0, 1.37, 4.2, 9.9]) {
        const first = draw(t0), wake = b.wake;
        expect(wake, d.id).toBeGreaterThanOrEqual(t0);
        for (let k = 1; k < 8; k++) expect(draw(t0 + ((wake - t0) * k) / 8.001), `${d.id} at ${t0}`).toEqual(first);
      }
    }
  });
});
