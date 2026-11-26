import { describe, expect, it } from 'vitest';
import { instrument } from '../../../tools/probes';
import { P, close, frame, frames, nameOf, segment, type Node } from '../../../src/app/prof/probe';

// The profiled graph's contract: every named function is probed under a name a person can find, nothing anonymous
// is, relative imports load their profiled copies, and a frame's rows (self times, unattributed, probes) sum to it.

const SAMPLE = `import { a } from './a';
import { b } from '../sim/b.ts';
import type { T } from '../types';
import map from './map.json';
import { P } from './prof/probe';
function decl(n) { return n + 1; }
const arrow = (n) => ({ n });
const obj = { method(x) { return x; }, prop: (x) => x * 2, get g() { return 1; } };
class Box { constructor() { this.v = 0; } add(n) { [1, 2].forEach((k) => { this.v += k; }); return this.v + n; } }
async function later() {}
function outer() { return { inner() { return 3; } }; }
`;

describe('probes', () => {
  it('names every named function by file and line, and nothing anonymous, async or an accessor', () => {
    const p = instrument(SAMPLE, 'app/x.ts', 40);
    expect(p.names).toEqual([
      'decl (app/x.ts:6)', 'arrow (app/x.ts:7)', 'obj.method (app/x.ts:8)', 'obj.prop (app/x.ts:8)',
      'Box.constructor (app/x.ts:9)', 'Box.add (app/x.ts:9)', 'outer (app/x.ts:11)', 'outer.inner (app/x.ts:11)',
    ]);
    expect(p.code).toContain('__P.n(40, ');
    expect(p.code).toContain(`from './a?prof'`);
    expect(p.code).toContain(`from '../sim/b.ts?prof'`);
    expect(p.code).toContain(`from './map.json'`);
    expect(p.code).toContain(`from './prof/probe'`);
    expect(p.code.split('\n').length).toBe(SAMPLE.split('\n').length);
  });

  it('a frame: the probed functions run as before, and self times, unattributed and probes sum to the callback', () => {
    const src = `function fib(n) { return n < 2 ? n : fib(n - 1) + fib(n - 2); }
const twice = (n) => fib(n) * 2;
out.twice = twice;`;
    const code = instrument(src, 'sim/f.ts', 0).code.replace(/^import[^;]*;/, '');
    const m = {} as { twice: (n: number) => number };
    new Function('__P', 'out', code)(P, m);
    let got = 0;
    segment(function loop() { got = m.twice(15); }, 1);
    close();
    expect(got).toBe(1220);
    const s = 0; // the first frame's ring slot
    const nodes: Node[] = [];
    const walk = (n: Node): void => { for (const k of n.kids.values()) { nodes.push(k); walk(k); } };
    walk(frame);
    const calls = (name: string): number => nodes.filter((n) => nameOf(n).startsWith(name)).reduce((t, n) => t + n.hCalls[s]!, 0);
    expect(calls('twice')).toBe(1);
    expect(calls('fib')).toBe(1973);
    expect(calls('rAF loop')).toBe(1);
    const rows = nodes.reduce((t, n) => t + n.hSelf[s]!, 0) + frames.probes[s]!;
    expect(Math.abs(rows - frames.cb[s]!)).toBeLessThan(1e-3); // the ring keeps float32
  });
});
