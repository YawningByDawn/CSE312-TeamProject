// The shapes creatures are drawn from: bodies, feet, tails, wings, fins, eyes. Each draws at a radius of 1, facing +x.

export type Ctx = CanvasRenderingContext2D;
export type Draw = (c: Ctx, t: number, mv: number) => void;

export const TAU = Math.PI * 2;

export function ell(c: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): void {
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, TAU);
}

export function paint(c: Ctx, fill: string, stroke?: string): void {
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.stroke();
  }
}

export function poly(c: Ctx, pts: readonly (readonly [number, number])[]): void {
  c.beginPath();
  for (const [i, [x, y]] of pts.entries()) {
    if (i === 0) c.moveTo(x, y);
    else c.lineTo(x, y);
  }
  c.closePath();
}

/** Four feet that step as the creature moves. */
export function feet(c: Ctx, t: number, mv: number, x: number, y: number, rx: number, ry: number, fill: string, stroke: string, rate = 9): void {
  for (const [i, sx, sy] of [[0, 1, 1], [1, 1, -1], [1, -1, 1], [0, -1, -1]] as const) {
    const step = Math.sin(t * rate + i * Math.PI) * 0.14 * mv;
    ell(c, sx * x + step, sy * y, rx, ry);
    paint(c, fill, stroke);
  }
}

/** Two big hind feet, for the creatures that walk upright. */
export function stride(c: Ctx, t: number, mv: number, x: number, y: number, rx: number, ry: number, fill: string, stroke: string): void {
  for (const s of [-1, 1]) {
    const step = Math.sin(t * 9 + (s > 0 ? Math.PI : 0)) * 0.22 * mv;
    ell(c, x + step, s * y, rx, ry);
    paint(c, fill, stroke);
    c.beginPath();
    for (const k of [-1, 0, 1]) {
      c.moveTo(x + step + rx * 0.8, s * y + k * ry * 0.5);
      c.lineTo(x + step + rx * 1.25, s * y + k * ry * 0.7);
    }
    c.stroke();
  }
}

export function eyes(c: Ctx, x: number, y: number, r: number, fill = '#24170e'): void {
  for (const s of [-1, 1]) {
    ell(c, x, s * y, r, r);
    paint(c, fill);
    ell(c, x + r * 0.35, s * y - r * 0.35, r * 0.35, r * 0.35);
    paint(c, 'rgba(255,255,255,0.8)');
  }
}

/** Eyes that shine, for the mythical ones. */
export function glowEyes(c: Ctx, x: number, y: number, r: number, color: string): void {
  c.save();
  c.shadowColor = color;
  c.shadowBlur = 8;
  for (const s of [-1, 1]) {
    ell(c, x, s * y, r, r * 0.8);
    paint(c, color);
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
}

/** A tail from x0 back `len`, `w` wide at the root and tapering, swaying as it goes; returns its tip. */
export function tail(c: Ctx, t: number, mv: number, x0: number, len: number, w: number, fill: string, stroke: string, sway = 0.3): { x: number; y: number; a: number } {
  const n = 10;
  const mid: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    mid.push([x0 - len * s, Math.sin(t * 4 - s * 2.4) * sway * s * (0.35 + mv)]);
  }
  c.beginPath();
  for (let i = 0; i <= n; i++) c.lineTo(mid[i]![0], mid[i]![1] - (w / 2) * (1 - (i / n) * 0.9));
  for (let i = n; i >= 0; i--) c.lineTo(mid[i]![0], mid[i]![1] + (w / 2) * (1 - (i / n) * 0.9));
  c.closePath();
  paint(c, fill, stroke);
  const [ex, ey] = mid[n]!;
  const [px, py] = mid[n - 1]!;
  return { x: ex, y: ey, a: Math.atan2(ey - py, ex - px) };
}

/** A long body along a wave, thick at the front and thin at the tail: snakes and serpents. Returns the head's place. */
export function serpent(c: Ctx, t: number, mv: number, from: number, to: number, w: number, fill: string, stroke: string, amp = 0.32): { x: number; y: number; a: number; pts: [number, number][] } {
  const n = 16;
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const x = from + ((to - from) * i) / n;
    pts.push([x, Math.sin(t * 5 - x * 2.2) * amp * (0.45 + mv * 0.55) * (0.3 + (0.7 * (n - i)) / n)]);
  }
  c.lineCap = 'round';
  for (const [color, extra] of [[stroke, 0.08], [fill, 0]] as const) {
    c.strokeStyle = color;
    for (let i = 0; i < n; i++) {
      c.lineWidth = w * (0.35 + (0.65 * (i + 1)) / n) + extra;
      c.beginPath();
      c.moveTo(pts[i]![0], pts[i]![1]);
      c.lineTo(pts[i + 1]![0], pts[i + 1]![1]);
      c.stroke();
    }
  }
  const [hx, hy] = pts[n]!;
  const [px, py] = pts[n - 1]!;
  return { x: hx, y: hy, a: Math.atan2(hy - py, hx - px), pts };
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
  paint(c, fill, stroke);
}

