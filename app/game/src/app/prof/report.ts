import { pageQuery } from '../../content/flags';
import type { ProfReport, ProfRow } from '../../types';
import { textures } from './gpu';
import { N, count, frame, frames, heapExact, idle, nameOf, type Node } from './probe';

// The report over the window's frames: times from the timed frames, bytes from the heap frames, counts from all.

/** The sim's tick: the probe whose subtree is one tick (src/sim/index.ts makeSim's `sim.step`). */
const TICK = 'sim.step (';

interface Sum {
  /** ms and calls in timed frames; bytes and calls in heap frames; calls, draws, uploads in all. */
  self: number; callsT: number; alloc: number; callsA: number; calls: number; draws: number; uploads: number; up: number;
  /** self ms by ring slot, for the worst frame */
  worst: Float64Array;
}
const sum = (): Sum => ({ self: 0, callsT: 0, alloc: 0, callsA: 0, calls: 0, draws: 0, uploads: 0, up: 0, worst: new Float64Array(N) });
/** What a sum is divided by: timed frames (or ticks), heap frames, all. */
interface Per { t: number; a: number; all: number }

/** Add `n`'s own window (not its kids') to `into`. */
function add(into: Sum, n: Node, slots: number[]): Sum {
  for (const s of slots) {
    if (n.at[s] !== frames.at[s]) continue;
    const c = n.hCalls[s]!;
    into.calls += c; into.draws += n.hDraws[s]!; into.uploads += n.hUploads[s]!; into.up += n.hUpBytes[s]!;
    if (frames.heap[s]) { into.alloc += n.hAlloc[s]!; into.callsA += c; } else {
      into.self += n.hSelf[s]!;
      into.callsT += c;
      into.worst[s] = into.worst[s]! + n.hSelf[s]!;
    }
  }
  return into;
}

function merge(into: Sum, s: Sum): void {
  into.self += s.self; into.callsT += s.callsT; into.alloc += s.alloc; into.callsA += s.callsA; into.calls += s.calls;
  into.draws += s.draws; into.uploads += s.uploads; into.up += s.up;
  for (let i = 0; i < N; i++) into.worst[i] = into.worst[i]! + s.worst[i]!;
}

/** Every node under `root`, depth first. */
function each(root: Node, f: (n: Node) => void): void {
  for (const k of root.kids.values()) { f(k); each(k, f); }
}

/** The probed functions under `root`, by name, each path's window added. */
function group(root: Node, slots: number[]): Map<string, Sum> {
  const by = new Map<string, Sum>();
  each(root, (n) => {
    if (n.fn < 0) return;
    const k = nameOf(n);
    let s = by.get(k);
    if (!s) by.set(k, (s = sum()));
    add(s, n, slots);
  });
  return by;
}

function rows(by: Map<string, Sum>, per: Per, cb: number): ProfRow[] {
  const out: ProfRow[] = [];
  for (const [name, s] of by) {
    if (s.calls === 0) continue;
    const ms = per.t ? s.self / per.t : 0;
    out.push({
      name, ms, worst: Math.max(...s.worst), pct: cb > 0 ? (100 * ms) / cb : 0, calls: s.calls / per.all,
      kb: heapExact && per.a ? s.alloc / per.a / 1024 : null, draws: s.draws / per.all, uploads: s.uploads / per.all,
    });
  }
  return out.sort((a, b) => b.ms - a.ms || b.calls - a.calls);
}

/** Inclusive ms of `n` per timed frame. */
function inclusive(n: Node, slots: number[]): number {
  let t = add(sum(), n, slots).self;
  for (const k of n.kids.values()) t += inclusive(k, slots);
  return t;
}

let resolution = 0;
/** The clock's step, measured once at install. */
export const setResolution = (ms: number): void => { resolution = ms; };

export function report(): ProfReport {
  const slots: number[] = [];
  for (let s = 0; s < N; s++) if (frames.at[s]! >= 0) slots.push(s);
  const timed = slots.filter((s) => !frames.heap[s]);
  const heaped = slots.filter((s) => frames.heap[s]);
  const per: Per = { t: timed.length, a: heaped.length, all: Math.max(1, slots.length) };
  const meanT = (a: Float32Array): number => (timed.length ? timed.reduce((t, s) => t + a[s]!, 0) / timed.length : 0);
  const cbs = timed.map((s) => frames.cb[s]!).sort((a, b) => a - b);
  // a timed frame's interval counts when the frame before it was timed too
  const ivs = timed.filter((s) => {
    const p = (s + N - 1) % N;
    return frames.at[p] === frames.at[s]! - 1 && !frames.heap[p] && frames.interval[s]! > 0;
  }).map((s) => frames.interval[s]!).sort((a, b) => a - b);
  const iv = ivs.length ? ivs[ivs.length >> 1]! : 0;
  const cb = meanT(frames.cb), probes = meanT(frames.probes);

  const unatt = sum();
  for (const seg of frame.kids.values()) add(unatt, seg, slots);
  const fns = group(frame, slots);
  const tot = sum();
  for (const s of fns.values()) merge(tot, s);
  merge(tot, unatt);

  // the ticks: every `sim.step` path's subtree, per step
  const tick = new Map<string, Sum>();
  const steps = sum();
  each(frame, (n) => {
    if (n.fn < 0 || !nameOf(n).startsWith(TICK)) return;
    const own = add(sum(), n, slots);
    merge(steps, own);
    const within = group(n, slots);
    within.set(nameOf(n), own);
    for (const [k, s] of within) {
      const t = tick.get(k) ?? sum();
      merge(t, s);
      tick.set(k, t);
    }
  });
  let tickMs = 0;
  for (const s of tick.values()) tickMs += s.self;

  const tree: ProfReport['tree'] = [];
  const walk = (n: Node, depth: number): void => {
    const kids = [...n.kids.values()].map((k) => ({ k, ms: inclusive(k, timed) / Math.max(1, per.t) })).sort((a, b) => b.ms - a.ms);
    for (const { k, ms } of kids) {
      if (ms < Math.max(0.005, cb * 0.005) || tree.length >= 80) continue;
      tree.push({ depth, name: nameOf(k), ms, calls: add(sum(), k, slots).calls / per.all });
      walk(k, depth + 1);
    }
  };
  walk(frame, 0);

  const work = cb - probes;
  const last = (count - 1 + N) % N;
  return {
    frames: slots.length, timer: resolution, heapExact,
    frame: {
      cb, cbP95: cbs.length ? cbs[Math.floor(cbs.length * 0.95)]! : 0, cbWorst: cbs.length ? cbs[cbs.length - 1]! : 0,
      interval: iv, dropped: ivs.filter((v) => v > Math.max(20, iv * 1.5)).length, probes,
      unattributed: per.t ? unatt.self / per.t : 0,
      attributed: work > 0 && per.t ? (100 * (tot.self - unatt.self)) / per.t / work : 100,
      calls: tot.calls / per.all, draws: tot.draws / per.all, uploads: tot.uploads / per.all, uploadKB: tot.up / per.all / 1024,
      allocKB: heapExact && per.a ? tot.alloc / per.a / 1024 : null, gcs: heaped.reduce((t, s) => t + frames.gcs[s]!, 0),
    },
    memory: {
      heapMB: frames.heapMB[last]!, textures: textures.n, textureMB: textures.bytes / (1024 * 1024),
      domNodes: document.getElementsByTagName('*').length,
    },
    tick: {
      perFrame: steps.calls / per.all, ms: steps.callsT ? tickMs / steps.callsT : 0,
      rows: rows(tick, { t: steps.callsT, a: steps.callsA, all: Math.max(1, steps.calls) }, 0).map((r) => ({ ...r, worst: 0 })),
    },
    functions: rows(fns, per, cb),
    between: rows(group(idle, slots), per, cb),
    tree,
  };
}

const f = (v: number, d = 2): string => v.toFixed(d);
const line = (r: ProfRow): string =>
  `  ${f(r.ms, 3).padStart(8)} ${f(r.pct, 1).padStart(5)}% ${f(r.worst, 2).padStart(7)} ${f(r.calls, 1).padStart(9)} ${(r.kb === null ? '-' : f(r.kb, 1)).padStart(8)} ${f(r.draws, 1).padStart(6)} ${f(r.uploads, 1).padStart(5)}  ${r.name}`;
const head = '        ms     %   worst  calls/f     KB/f  draws upl.  function (file:line)';

/** The report as text: what Copy report gives. */
export function text(r: ProfReport = report()): string {
  const x = r.frame;
  return [
    `HUNGRY GOD profiler (rebuild) - ${r.frames} frames, ${location.pathname}${pageQuery()}, ${new Date().toISOString()}`,
    `clock step ${f(r.timer, 3)} ms; heap ${r.heapExact ? 'exact: every other 30 frames read it (bytes), the rest are timed' : 'not exact: allocation not measured'}`,
    `frame: callback ${f(x.cb)} ms (p95 ${f(x.cbP95)}, worst ${f(x.cbWorst)}), interval ${f(x.interval, 1)} ms, ${x.dropped} long intervals`,
    `  named functions ${f(x.attributed, 1)}% of the callback without probes; unattributed ${f(x.unattributed, 3)} ms; probes ${f(x.probes)} ms (the profiler's own cost)`,
    `  ${f(x.calls, 0)} calls/f, ${x.allocKB === null ? '-' : f(x.allocKB, 1)} KB/f allocated, ${x.gcs} GCs in the heap frames`,
    `gpu: ${f(x.draws, 1)} draw calls/f, ${f(x.uploads, 2)} uploads/f (${f(x.uploadKB, 1)} KB/f), ${r.memory.textures} textures ${f(r.memory.textureMB, 1)} MB`,
    `memory: heap ${f(r.memory.heapMB, 1)} MB, ${r.memory.domNodes} DOM nodes`,
    `sim: ${f(r.tick.perFrame)} ticks/f, ${f(r.tick.ms, 3)} ms a tick`,
    '', 'FUNCTIONS per frame, by self time', head, ...r.functions.map(line),
    '', 'SIM TICK per tick', head, ...r.tick.rows.map(line),
    '', 'BETWEEN FRAMES per frame', head, ...r.between.map(line),
    '', 'CALL TREE inclusive ms per frame',
    ...r.tree.map((t) => `  ${f(t.ms, 3).padStart(8)} ${f(t.calls, 1).padStart(9)}  ${'  '.repeat(t.depth)}${t.name}`),
  ].join('\n');
}
