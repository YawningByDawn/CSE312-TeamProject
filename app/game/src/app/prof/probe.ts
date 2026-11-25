// The probes' runtime (tools/probes.ts puts `__P.b(id)` / `__P.e()` around every named function of the profiled graph).
// Self time by edges: each probe reads the clock, credits the time since the last edge to the function on top of the
// stack, and reads the clock again; what lies between the two reads is the probes' own cost, kept apart. A rAF callback
// is a frame's segment: the frame is every callback of one rAF timestamp. Probes outside any callback (input events,
// timers, promise jobs) are between frames.
// Allocation: where the browser gives the exact heap, every other block of frames reads it at every edge too, and a
// function's allocation is the heap's growth while it is on top. A read costs microseconds and allocates, so those
// frames give the bytes and calls, and only the frames between give the times.

/** Frames kept: the window every report reads. */
export const N = 240;
/** Frames in a block: timed blocks and heap blocks alternate. */
const BLOCK = 30;

export interface Node {
  /** Function id (tools/probes.ts), or -1 for a root and below -1 for a rAF callback. */
  readonly fn: number;
  readonly label: string;
  readonly kids: Map<number, Node>;
  /** This frame: self ms, calls, allocated bytes, GPU draw calls and texture uploads (self), upload bytes. */
  self: number; calls: number; alloc: number; draws: number; uploads: number; upBytes: number;
  /** The ring: the frame number each slot holds, and that frame's values. */
  readonly at: Int32Array; readonly hSelf: Float32Array; readonly hCalls: Float32Array; readonly hAlloc: Float32Array;
  readonly hDraws: Float32Array; readonly hUploads: Float32Array; readonly hUpBytes: Float32Array;
  touched: boolean;
}

/** Each frame's totals, by ring slot; `heap` 1 marks a heap frame (its times are not used). */
export interface Frames {
  readonly cb: Float32Array; readonly interval: Float32Array; readonly probes: Float32Array; readonly gcs: Float32Array;
  readonly heapMB: Float32Array; readonly heap: Uint8Array; readonly at: Int32Array;
}

const names: string[] = [];
const node = (fn: number, label: string): Node => ({
  fn, label, kids: new Map(), self: 0, calls: 0, alloc: 0, draws: 0, uploads: 0, upBytes: 0,
  at: new Int32Array(N).fill(-1), hSelf: new Float32Array(N), hCalls: new Float32Array(N), hAlloc: new Float32Array(N),
  hDraws: new Float32Array(N), hUploads: new Float32Array(N), hUpBytes: new Float32Array(N), touched: false,
});

type Memory = { memory?: { usedJSHeapSize: number } };
/** The JS heap in exact bytes (Chromium with --enable-precise-memory-info), and the bytes one read allocates; else null. */
function exactHeap(): { read: () => number; cost: number } | null {
  const P = performance as Memory;
  if (!P.memory) return null;
  const read = (): number => P.memory!.usedJSHeapSize;
  const a = read();
  const probe = new Array<number>(8192).fill(0.5);
  if (read() - a < probe.length * 8) return null;
  const d: number[] = [];
  for (let i = 0; i < 9; i++) { const x = read(); d.push(read() - x); }
  return { read, cost: d.sort((x, y) => x - y)[4]! };
}

const now = (): number => performance.now();
const exact = exactHeap();
const read = exact?.read ?? ((): number => 0);
const hCost = exact?.cost ?? 0;
export const heapExact = exact !== null;

/** Work between frames, and the frames. */
export const idle = node(-1, 'between frames');
export const frame = node(-1, 'frame');
export const frames: Frames = {
  cb: new Float32Array(N), interval: new Float32Array(N), probes: new Float32Array(N), gcs: new Float32Array(N),
  heapMB: new Float32Array(N), heap: new Uint8Array(N), at: new Int32Array(N).fill(-1),
};
/** Frames closed so far; the open frame's ring slot is `count % N`. */
export let count = 0;

let top: Node = idle;
const stack: Node[] = [];
let sp = 0;
/** This frame reads the heap at every edge. */
let heap = false;
let last = now();
let h0 = 0;
/** Probe time since the segment began; in this frame's segments. */
let probeMs = 0;
let frameProbeMs = 0;
let gcs = 0;
const touched: Node[] = [];
let ts = -1;
let lastTs = -1;
let cbMs = 0;
const cbIds = new Map<string, number>();

function credit(t: number): void {
  const n = top;
  n.self += t - last;
  if (heap) {
    const d = read() - h0 - hCost;
    if (d >= 0) n.alloc += d; else gcs++;
  }
  if (!n.touched) { n.touched = true; touched.push(n); }
}

/** The probes. */
export const P = {
  /** Module probe names, in id order from `first`. */
  n(first: number, list: string[]): void { for (let i = 0; i < list.length; i++) names[first + i] = list[i]!; },
  b(id: number): void {
    const t = now();
    credit(t);
    const n0 = top;
    let n = n0.kids.get(id);
    if (!n) n0.kids.set(id, (n = node(id, '')));
    n.calls++;
    stack[sp++] = n0;
    top = n;
    if (heap) h0 = read();
    last = now();
    probeMs += last - t;
  },
  e(): void {
    const t = now();
    credit(t);
    top = stack[--sp]!;
    if (heap) h0 = read();
    last = now();
    probeMs += last - t;
  },
};

/** A probe's name: `fn (file:line)`. */
export const nameOf = (n: Node): string => (n.fn >= 0 ? (names[n.fn] ?? `#${n.fn}`) : n.label);

/** A GPU draw call, or a texture upload of `bytes`, to the function on top. */
export function draw(): void { top.draws++; if (!top.touched) { top.touched = true; touched.push(top); } }
export function upload(bytes: number): void {
  top.uploads++;
  top.upBytes += bytes;
  if (!top.touched) { top.touched = true; touched.push(top); }
}

/** Run a rAF callback as a segment of the frame at `stamp`: its time outside every probe is its own node's. */
export function segment(cb: FrameRequestCallback, stamp: number): void {
  if (stamp !== ts) {
    if (ts >= 0) close();
    lastTs = ts;
    ts = stamp;
  }
  const t = now();
  credit(t);
  const label = `rAF ${cb.name || '(anonymous)'}`;
  let id = cbIds.get(label);
  if (id === undefined) cbIds.set(label, (id = -2 - cbIds.size));
  let n = frame.kids.get(id);
  if (!n) frame.kids.set(id, (n = node(id, label)));
  n.calls++;
  top = n;
  if (heap) h0 = read();
  last = now();
  probeMs = last - t;
  try { cb(stamp); } finally {
    const t1 = now();
    credit(t1);
    top = idle;
    cbMs += t1 - t;
    frameProbeMs += probeMs;
    if (heap) h0 = read();
    last = now();
  }
}

/** The frame ends: every node it touched writes its ring slot; the next frame is timed or reads the heap. */
export function close(): void {
  const s = count % N;
  for (let i = 0; i < touched.length; i++) {
    const n = touched[i]!;
    n.at[s] = count;
    n.hSelf[s] = n.self; n.hCalls[s] = n.calls; n.hAlloc[s] = n.alloc;
    n.hDraws[s] = n.draws; n.hUploads[s] = n.uploads; n.hUpBytes[s] = n.upBytes;
    n.self = n.calls = n.alloc = n.draws = n.uploads = n.upBytes = 0;
    n.touched = false;
  }
  touched.length = 0;
  frames.at[s] = count;
  frames.cb[s] = cbMs;
  frames.interval[s] = lastTs >= 0 ? ts - lastTs : 0;
  frames.probes[s] = frameProbeMs;
  frames.gcs[s] = gcs;
  frames.heap[s] = heap ? 1 : 0;
  frames.heapMB[s] = ((performance as Memory).memory?.usedJSHeapSize ?? 0) / (1024 * 1024);
  cbMs = frameProbeMs = gcs = 0;
  count++;
  heap = exact !== null && Math.floor(count / BLOCK) % 2 === 1;
  if (heap) h0 = read();
}

/** The clock's step in ms: the smallest step it was seen to take. */
export function resolution(): number {
  let min = Infinity;
  for (let i = 0; i < 50; i++) {
    const a = now();
    let b = now();
    while (b === a) b = now();
    min = Math.min(min, b - a);
  }
  return min;
}
