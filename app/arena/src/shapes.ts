// The shapes creatures are drawn from: bodies, feet, tails, wings, fins, eyes. Each draws at a radius of 1, facing +x.
//
// Three things make them look alive, all set per creature by drawAnimal (the `pose`):
// - Light from the top left of the screen, wherever the creature faces: every solid fill is a gradient, lighter on
//   the lit side, and big round parts get a soft gloss. Lines never get thinner than about a pixel on screen.
// - A rig, when the view keeps one: a chain of joints that trails the creature's hip, each a fixed distance behind
//   the last and bending no more than a set angle from it (after argonaut's animal-proc-anim and its distance and
//   angle constraints). Tails, serpent bodies and tentacles are drawn along it, so they swing and curl through turns.
// - Planted feet, with a rig: a foot stays where it stood until its resting spot has moved too far, then steps,
//   lifting as it goes, in a diagonal gait (the two diagonals take turns) or, for two feet, one at a time.
// Without a rig (icons, the tree) tails sway on a sine and feet patter in place, as before.

export type Ctx = CanvasRenderingContext2D;
export type Draw = (c: Ctx, t: number, mv: number) => void;

export const TAU = Math.PI * 2;

/** The local x of the hip, where the rig's chain starts. */
export const HIP = -0.3;

export interface Foot {
  x: number; // where it stands, in world px
  y: number;
  fromX: number;
  fromY: number;
  step: number; // 0 to 1 through a step; 1 when planted
}

/** A creature's rig, kept by the view between frames. Positions are in world px. */
export interface Rig {
  chain: [number, number][]; // joints from the hip back
  link: number; // px between joints
  feet: Foot[]; // by the order the drawing asks for them
  next: number; // the next foot this frame
  x: number; // the creature, this frame
  y: number;
  a: number;
  r: number;
  dt: number;
}

interface Pose {
  lx: number; // the light's direction in the creature's own space
  ly: number;
  bucket: number; // the light's direction, in sixteenths of a turn
  minLine: number; // the thinnest line, in its own units
  shade: boolean;
  rig: Rig | null;
  t: number;
}

const pose: Pose = { lx: -0.6, ly: -0.8, bucket: 0, minLine: 0, shade: false, rig: null, t: 0 };

/** Whether creatures are lit and glossed; the page turns it off when frames run slow. */
export const quality = { shade: true };

const LIGHT = Math.atan2(-0.8, -0.55); // from the top left of the screen

/** Sets up the light, line and rig for drawing one creature at angle a; px is how many screen px a unit is. */
export function setPose(a: number, px: number, rig: Rig | null, t: number): void {
  const local = LIGHT - a;
  pose.bucket = (Math.round((local / TAU) * 16) % 16 + 16) % 16;
  const snapped = (pose.bucket / 16) * TAU;
  pose.lx = Math.cos(snapped);
  pose.ly = Math.sin(snapped);
  pose.minLine = px > 0 ? 1.1 / px : 0;
  pose.shade = quality.shade && px >= 9; // too small to see shading: keep it cheap
  pose.rig = rig;
  pose.t = t;
  if (rig) rig.next = 0;
}

/** Back to plain drawing, for anything drawn after a creature. */
export function clearPose(): void {
  pose.shade = false;
  pose.rig = null;
  pose.minLine = 0;
}

/** Moves a rig on to a creature at x, y facing a (making one if it has none, or it has grown or jumped): the chain's
 * first joint at its hip, each next joint a link behind the one before, turned from it no more than a set angle. */
export function stepRig(rig: Rig | undefined, x: number, y: number, a: number, r: number, dt: number): Rig {
  const link = r * 0.24;
  const hx = x + Math.cos(a) * HIP * r;
  const hy = y + Math.sin(a) * HIP * r;
  if (!rig || rig.link !== link || Math.hypot(rig.chain[0]![0] - hx, rig.chain[0]![1] - hy) > r * 4) {
    rig = { chain: [], link, feet: [], next: 0, x, y, a, r, dt: 0 };
    for (let i = 0; i < 13; i++) rig.chain.push([hx - Math.cos(a) * link * i, hy - Math.sin(a) * link * i]);
  }
  rig.dt = dt;
  const ch = rig.chain;
  ch[0] = [hx, hy];
  let anchor = a;
  const limit = Math.PI / 9;
  for (let i = 1; i < ch.length; i++) {
    const [px, py] = ch[i - 1]!;
    const [cx, cy] = ch[i]!;
    let ang = Math.atan2(py - cy, px - cx);
    const diff = Math.atan2(Math.sin(ang - anchor), Math.cos(ang - anchor));
    if (diff > limit) ang = anchor + limit;
    else if (diff < -limit) ang = anchor - limit;
    ch[i] = [px - Math.cos(ang) * link, py - Math.sin(ang) * link];
    anchor = ang;
  }
  return rig;
}

// ---- colour

const parsed = new Map<string, [number, number, number]>();
function rgb(hex: string): [number, number, number] {
  let v = parsed.get(hex);
  if (!v) {
    const n = parseInt(hex.slice(1), 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    parsed.set(hex, v);
  }
  return v;
}

function mix(hex: string, to: number, k: number): string {
  const [r, g, b] = rgb(hex);
  const f = (v: number): number => Math.round(v + (to - v) * k);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

const shades = new WeakMap<Ctx, Map<string, CanvasGradient>>();

/** A fill lit from the light's side: lighter there, darker away from it. Made once a colour and direction. */
function lit(c: Ctx, hex: string): CanvasGradient {
  let cache = shades.get(c);
  if (!cache) {
    cache = new Map();
    shades.set(c, cache);
  }
  const key = `${hex}${pose.bucket}`;
  let g = cache.get(key);
  if (!g) {
    g = c.createLinearGradient(pose.lx * 1.15, pose.ly * 1.15, -pose.lx * 1.15, -pose.ly * 1.15);
    g.addColorStop(0, mix(hex, 255, 0.28));
    g.addColorStop(0.45, hex);
    g.addColorStop(1, mix(hex, 0, 0.3));
    cache.set(key, g);
  }
  return g;
}

const glosses = new WeakMap<Ctx, CanvasGradient[]>();

/** A soft highlight on a unit circle, toward the light: one a direction, drawn in an ellipse's own space. */
function gloss(c: Ctx, bucket: number): CanvasGradient {
  let list = glosses.get(c);
  if (!list) {
    list = [];
    glosses.set(c, list);
  }
  let g = list[bucket];
  if (!g) {
    const a = (bucket / 16) * TAU;
    const gx = Math.cos(a) * 0.42;
    const gy = Math.sin(a) * 0.42;
    g = c.createRadialGradient(gx, gy, 0, gx, gy, 0.85);
    g.addColorStop(0, 'rgba(255,255,255,0.32)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.08)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    list[bucket] = g;
  }
  return g;
}

// ---- paths and paint

let lastEll: { x: number; y: number; rx: number; ry: number; rot: number } | null = null;

export function ell(c: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): void {
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, TAU);
  lastEll = { x, y, rx, ry, rot };
}

/** Fills the current path, lit, and strokes it. A big ellipse gets a gloss too. */
export function paint(c: Ctx, fill: string, stroke?: string): void {
  const solid = fill.length === 7 && fill[0] === '#';
  c.fillStyle = pose.shade && solid ? lit(c, fill) : fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    if (c.lineWidth < pose.minLine) c.lineWidth = pose.minLine;
    c.stroke();
  }
  const e = lastEll;
  lastEll = null;
  if (pose.shade && solid && e && e.rx * e.ry >= 0.06) {
    c.save();
    c.translate(e.x, e.y);
    c.rotate(e.rot);
    c.scale(e.rx, e.ry);
    const local = Math.atan2(pose.ly, pose.lx) - e.rot;
    c.beginPath();
    c.arc(0, 0, 1, 0, TAU);
    c.fillStyle = gloss(c, (Math.round((local / TAU) * 16) % 16 + 16) % 16);
    c.fill();
    c.restore();
  }
}

export function poly(c: Ctx, pts: readonly (readonly [number, number])[]): void {
  c.beginPath();
  for (const [i, [x, y]] of pts.entries()) {
    if (i === 0) c.moveTo(x, y);
    else c.lineTo(x, y);
  }
  c.closePath();
  lastEll = null;
}

// ---- the rig

function toLocal(r: Rig, wx: number, wy: number): [number, number] {
  const dx = wx - r.x;
  const dy = wy - r.y;
  const cos = Math.cos(r.a);
  const sin = Math.sin(r.a);
  return [(dx * cos + dy * sin) / r.r, (-dx * sin + dy * cos) / r.r];
}

function toWorld(r: Rig, lx: number, ly: number): [number, number] {
  const cos = Math.cos(r.a);
  const sin = Math.sin(r.a);
  return [r.x + (lx * cos - ly * sin) * r.r, r.y + (lx * sin + ly * cos) * r.r];
}

/** The point u units behind the hip along the rig, in the creature's own space, and the way back along it there. */
function along(r: Rig, u: number): { x: number; y: number; a: number } {
  let left = u * r.r;
  const ch = r.chain;
  let i = 0;
  while (i < ch.length - 2 && left > r.link) {
    left -= r.link;
    i++;
  }
  const [ax, ay] = ch[i]!;
  const [bx, by] = ch[i + 1]!;
  const k = left / r.link; // may run past the last joint: carry on the same way
  const [x, y] = toLocal(r, ax + (bx - ax) * k, ay + (by - ay) * k);
  const [x0, y0] = toLocal(r, ax, ay);
  const [x1, y1] = toLocal(r, bx, by);
  return { x, y, a: Math.atan2(y1 - y0, x1 - x0) };
}

/** A point on the body's line, `back` units behind local x = 0, pushed `side` units across it: straight ahead of the
 * hip, along the rig behind it. Without a rig, straight back. */
export function spine(back: number, side = 0): { x: number; y: number; a: number } {
  const x = -back;
  const r = pose.rig;
  if (!r || x >= HIP) return { x, y: side, a: Math.PI };
  const p = along(r, HIP - x);
  return { x: p.x - Math.sin(p.a) * side, y: p.y + Math.cos(p.a) * side, a: p.a };
}

/** A tail from x0 back `len`, `w` wide at the root and tapering; it follows the rig, or sways. Returns its tip. */
export function tail(c: Ctx, t: number, mv: number, x0: number, len: number, w: number, fill: string, stroke: string, sway = 0.3): { x: number; y: number; a: number } {
  const n = 12;
  const mid: [number, number][] = [];
  const dir: number[] = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    if (pose.rig) {
      const wiggle = Math.sin(t * 3 - s * 3) * 0.04 * s * (1 + mv);
      const p = spine(-x0 + len * s, wiggle);
      mid.push([p.x, p.y]);
      dir.push(p.a);
    } else {
      mid.push([x0 - len * s, Math.sin(t * 4 - s * 2.4) * sway * s * (0.35 + mv)]);
      dir.push(Math.PI);
    }
  }
  const half = (i: number): number => (w / 2) * (1 - (i / n) * 0.9);
  c.beginPath();
  for (let i = 0; i <= n; i++) c.lineTo(mid[i]![0] + Math.sin(dir[i]!) * half(i), mid[i]![1] - Math.cos(dir[i]!) * half(i));
  for (let i = n; i >= 0; i--) c.lineTo(mid[i]![0] - Math.sin(dir[i]!) * half(i), mid[i]![1] + Math.cos(dir[i]!) * half(i));
  c.closePath();
  lastEll = null;
  paint(c, fill, stroke);
  const [ex, ey] = mid[n]!;
  const [px, py] = mid[n - 1]!;
  return { x: ex, y: ey, a: Math.atan2(ey - py, ex - px) };
}

/** A long body from `from` (its tail end, behind) to `to` (its head), thick at the front and thin at the tail:
 * snakes and serpents. With a rig the body lies along the creature's own path, slithering as it goes. Returns the
 * head's place and the body's points. */
export function serpent(c: Ctx, t: number, mv: number, from: number, to: number, w: number, fill: string, stroke: string, amp = 0.32): { x: number; y: number; a: number; pts: [number, number][] } {
  const n = 18;
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const x = from + ((to - from) * i) / n;
    const fade = 0.3 + (0.7 * (n - i)) / n;
    if (pose.rig) {
      const p = spine(-x, Math.sin(t * 6 - x * 3) * amp * 0.35 * (0.25 + mv) * fade);
      pts.push([p.x, p.y]);
    } else {
      pts.push([x, Math.sin(t * 5 - x * 2.2) * amp * (0.45 + mv * 0.55) * fade]);
    }
  }
  c.lineCap = 'round';
  lastEll = null;
  const width = (i: number): number => w * (0.35 + (0.65 * (i + 1)) / n);
  const strokes: [string | CanvasGradient, number][] = [[stroke, 0.08], [pose.shade && fill.length === 7 ? lit(c, fill) : fill, 0], ['rgba(255,255,255,0.16)', -0.62]];
  for (const [color, extra] of strokes) {
    c.strokeStyle = color;
    for (let i = 0; i < n; i++) {
      c.lineWidth = Math.max(0.01, extra < 0 ? width(i) * 0.25 : width(i) + extra);
      c.beginPath();
      c.moveTo(pts[i]![0], pts[i]![1] + (extra < 0 ? -width(i) * 0.18 : 0));
      c.lineTo(pts[i + 1]![0], pts[i + 1]![1] + (extra < 0 ? -width(i) * 0.18 : 0));
      c.stroke();
    }
  }
  const [hx, hy] = pts[n]!;
  const [px, py] = pts[n - 1]!;
  return { x: hx, y: hy, a: Math.atan2(hy - py, hx - px), pts };
}

/** A serpent's points with the way each faces (toward the head), for laying patterns along its body. */
export function bodyLine(pts: [number, number][]): { x: number; y: number; a: number }[] {
  return pts.map(([x, y], i) => {
    const [ax, ay] = pts[Math.max(0, i - 1)]!;
    const [bx, by] = pts[Math.min(pts.length - 1, i + 1)]!;
    return { x, y, a: Math.atan2(by - ay, bx - ax) };
  });
}

/** A point `side` units across a body line at p. */
export function across(p: { x: number; y: number; a: number }, side: number, ahead = 0): [number, number] {
  return [p.x + Math.cos(p.a) * ahead - Math.sin(p.a) * side, p.y + Math.sin(p.a) * ahead + Math.cos(p.a) * side];
}

// ---- feet

const STEP_TIME = 0.14; // seconds a step takes

/** Where a planted foot is drawn, in local units, and how high it is lifted (0 to 1); null without a rig. */
function plant(ix: number, iy: number, reach: number, group: number[], partner: (i: number) => boolean): { x: number; y: number; lift: number } | null {
  const r = pose.rig;
  if (!r) return null;
  const k = r.next++;
  const [wx, wy] = toWorld(r, ix, iy);
  let f = r.feet[k];
  if (!f) {
    f = { x: wx, y: wy, fromX: wx, fromY: wy, step: 1 };
    r.feet[k] = f;
  }
  const d = Math.hypot(wx - f.x, wy - f.y);
  if (d > reach * r.r * 4) { // it jumped: stand where it is
    f.x = f.fromX = wx;
    f.y = f.fromY = wy;
    f.step = 1;
  } else if (f.step >= 1 && d > reach * r.r && !group.some(partner)) {
    f.fromX = f.x;
    f.fromY = f.y;
    f.step = 0;
  }
  if (f.step < 1) {
    f.step = Math.min(1, f.step + r.dt / STEP_TIME);
    // step to a little past the resting spot, ahead of where the body is going
    const e = 1 - (1 - f.step) * (1 - f.step);
    const [ax, ay] = toWorld(r, ix + 0.18, iy);
    f.x = f.fromX + (ax - f.fromX) * e;
    f.y = f.fromY + (ay - f.fromY) * e;
  }
  const [lx, ly] = toLocal(r, f.x, f.y);
  return { x: lx, y: ly, lift: f.step < 1 ? Math.sin(f.step * Math.PI) : 0 };
}

const stepping = (i: number): boolean => {
  const f = pose.rig?.feet[i];
  return !!f && f.step < 1;
};

/** Four feet. With a rig they stay planted and step in a diagonal gait; without one they patter in place. */
export function feet(c: Ctx, t: number, mv: number, x: number, y: number, rx: number, ry: number, fill: string, stroke: string, rate = 9): void {
  const base = pose.rig ? pose.rig.next : 0;
  const order = [[0, 1, 1], [1, 1, -1], [1, -1, 1], [0, -1, -1]] as const;
  for (const [phase, sx, sy] of order) {
    // the other diagonal's feet: this one waits while they are in the air
    const others = order.map((o, j) => (o[0] !== phase ? base + j : -1)).filter((j) => j >= 0);
    const p = plant(sx * x, sy * y, 0.42, others, stepping);
    if (p) {
      ell(c, p.x, p.y, rx * (1 + p.lift * 0.3), ry * (1 + p.lift * 0.3));
    } else {
      const step = Math.sin(t * rate + phase * Math.PI) * 0.14 * mv;
      ell(c, sx * x + step, sy * y, rx, ry);
    }
    paint(c, fill, stroke);
  }
}

/** Two big hind feet, for the creatures that walk upright: one steps while the other stands. */
export function stride(c: Ctx, t: number, mv: number, x: number, y: number, rx: number, ry: number, fill: string, stroke: string): void {
  const base = pose.rig ? pose.rig.next : 0;
  for (const [n, s] of [-1, 1].entries()) {
    const p = plant(x, s * y, 0.5, [base + (1 - n)], stepping);
    const fx = p ? p.x : x + Math.sin(t * 9 + (s > 0 ? Math.PI : 0)) * 0.22 * mv;
    const fy = p ? p.y : s * y;
    const grow = p ? 1 + p.lift * 0.3 : 1;
    ell(c, fx, fy, rx * grow, ry * grow);
    paint(c, fill, stroke);
    c.beginPath();
    for (const k of [-1, 0, 1]) {
      c.moveTo(fx + rx * 0.8, fy + k * ry * 0.5);
      c.lineTo(fx + rx * 1.25, fy + k * ry * 0.7);
    }
    c.stroke();
  }
}

// ---- eyes

/** Whether the creature is blinking: a blink of about a tenth of a second every few seconds. */
function blinking(): boolean {
  return (pose.t * 0.23) % 1 < 0.03;
}

export function eyes(c: Ctx, x: number, y: number, r: number, fill = '#24170e'): void {
  for (const s of [-1, 1]) {
    if (blinking()) {
      c.beginPath();
      c.moveTo(x - r, s * y);
      c.lineTo(x + r, s * y);
      c.strokeStyle = fill;
      c.lineWidth = Math.max(r * 0.5, pose.minLine);
      c.stroke();
      continue;
    }
    ell(c, x, s * y, r, r);
    c.fillStyle = fill;
    c.fill();
    lastEll = null;
    ell(c, x + r * 0.35, s * y - r * 0.35, r * 0.35, r * 0.35);
    c.fillStyle = 'rgba(255,255,255,0.85)';
    c.fill();
    lastEll = null;
  }
}

/** Eyes that shine, for the mythical ones. */
export function glowEyes(c: Ctx, x: number, y: number, r: number, color: string): void {
  c.save();
  c.shadowColor = color;
  c.shadowBlur = 8;
  for (const s of [-1, 1]) {
    ell(c, x, s * y, r, blinking() ? r * 0.15 : r * 0.8);
    c.fillStyle = color;
    c.fill();
    lastEll = null;
  }
  c.restore();
}

/** A wavy outline round an ellipse: fur, spines, a mane. */
export function shag(c: Ctx, x: number, y: number, rx: number, ry: number, bumps: number, depth: number, from = 0, to = TAU): void {
  c.beginPath();
  const n = bumps * 2;
  for (let i = 0; i <= n; i++) {
    const a = from + ((to - from) * i) / n;
    const k = i % 2 ? 1 - depth : 1;
    const px = x + Math.cos(a) * rx * k;
    const py = y + Math.sin(a) * ry * k;
    if (i === 0) c.moveTo(px, py);
    else c.lineTo(px, py);
  }
  c.closePath();
  // fur is round too: it takes a gloss like an ellipse would
  lastEll = to - from >= TAU - 0.01 ? { x, y, rx, ry, rot: 0 } : null;
}

/** Wings spread to both sides, flapping: feathered, or membranes with bones. */
export function wings(c: Ctx, t: number, x: number, span: number, fill: string, stroke: string, feathered: boolean): void {
  const flap = 0.88 + Math.sin(t * 7) * 0.12;
  for (const s of [-1, 1]) {
    const tipX = x + 0.05;
    const tipY = s * span * flap;
    const rootX = x - 0.75;
    const rootY = s * 0.28;
    const n = feathered ? 6 : 3;
    const edge: [number, number][] = [];
    for (let k = 1; k <= n; k++) edge.push([tipX + (rootX - tipX) * (k / n), tipY + (rootY - tipY) * (k / n)]);
    c.beginPath();
    c.moveTo(x + 0.2, s * 0.22);
    c.quadraticCurveTo(x + 0.5, tipY * 0.55, tipX, tipY);
    let [px, py] = [tipX, tipY];
    for (const [ex, ey] of edge) {
      // feathers bulge out; a membrane sags in between its bones
      const bulge = feathered ? -0.09 : 0.14;
      c.quadraticCurveTo((px + ex) / 2 + bulge, (py + ey) / 2 + s * Math.abs(bulge) * (feathered ? 1 : -1.6), ex, ey);
      [px, py] = [ex, ey];
    }
    c.closePath();
    lastEll = null;
    paint(c, fill, stroke);
    c.beginPath();
    for (const [ex, ey] of [[tipX, tipY] as [number, number], ...edge.slice(0, -1)]) {
      c.moveTo(x + 0.15, s * 0.25);
      c.lineTo(ex, ey);
    }
    c.strokeStyle = stroke;
    c.stroke();
  }
}

/** Paddles on both sides at x, y, swept back. */
export function flippers(c: Ctx, t: number, mv: number, x: number, y: number, len: number, fill: string, stroke: string): void {
  for (const s of [-1, 1]) {
    const beat = Math.sin(t * 6 + x) * 0.25 * (0.3 + mv);
    ell(c, x - len * 0.4, s * (y + len * 0.35), len * 0.55, len * 0.2, s * (0.6 + beat));
    paint(c, fill, stroke);
  }
}

/** A crescent tail fin at x. */
export function tailFin(c: Ctx, x: number, h: number, fill: string, stroke: string): void {
  c.beginPath();
  c.moveTo(x + 0.1, 0);
  c.quadraticCurveTo(x - 0.1, -h * 0.4, x - 0.35, -h);
  c.quadraticCurveTo(x - 0.15, 0, x - 0.35, h);
  c.quadraticCurveTo(x - 0.1, h * 0.4, x + 0.1, 0);
  lastEll = null;
  paint(c, fill, stroke);
}
