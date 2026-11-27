// The creatures, drawn from shapes: each at a radius of 1, facing +x, onto a context already moved, turned and scaled
// to the creature. `t` is seconds, for legs, tails and wings; `mv` is how fast it moves, 0 to 1. Drawings are found
// by species name, so the server's species list can change order freely.

type Ctx = CanvasRenderingContext2D;
type Draw = (c: Ctx, t: number, mv: number) => void;

const TAU = Math.PI * 2;

function ell(c: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): void {
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, TAU);
}

function paint(c: Ctx, fill: string, stroke?: string): void {
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.stroke();
  }
}

function poly(c: Ctx, pts: readonly (readonly [number, number])[]): void {
  c.beginPath();
  for (const [i, [x, y]] of pts.entries()) {
    if (i === 0) c.moveTo(x, y);
    else c.lineTo(x, y);
  }
  c.closePath();
}

/** Four feet that step as the creature moves. */
function feet(c: Ctx, t: number, mv: number, x: number, y: number, rx: number, ry: number, fill: string, stroke: string, rate = 9): void {
  for (const [i, sx, sy] of [[0, 1, 1], [1, 1, -1], [1, -1, 1], [0, -1, -1]] as const) {
    const step = Math.sin(t * rate + i * Math.PI) * 0.14 * mv;
    ell(c, sx * x + step, sy * y, rx, ry);
    paint(c, fill, stroke);
  }
}

/** Two big hind feet, for the creatures that walk upright. */
function stride(c: Ctx, t: number, mv: number, x: number, y: number, rx: number, ry: number, fill: string, stroke: string): void {
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

function eyes(c: Ctx, x: number, y: number, r: number, fill = '#24170e'): void {
  for (const s of [-1, 1]) {
    ell(c, x, s * y, r, r);
    paint(c, fill);
    ell(c, x + r * 0.35, s * y - r * 0.35, r * 0.35, r * 0.35);
    paint(c, 'rgba(255,255,255,0.8)');
  }
}

/** Eyes that shine, for the mythical ones. */
function glowEyes(c: Ctx, x: number, y: number, r: number, color: string): void {
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
function shag(c: Ctx, x: number, y: number, rx: number, ry: number, bumps: number, depth: number, from = 0, to = TAU): void {
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
function tail(c: Ctx, t: number, mv: number, x0: number, len: number, w: number, fill: string, stroke: string, sway = 0.3): { x: number; y: number; a: number } {
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
function serpent(c: Ctx, t: number, mv: number, from: number, to: number, w: number, fill: string, stroke: string, amp = 0.32): { x: number; y: number; a: number } {
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
  return { x: hx, y: hy, a: Math.atan2(hy - py, hx - px) };
}

/** Wings spread to both sides, flapping: feathered, or membranes with bones. */
function wings(c: Ctx, t: number, x: number, span: number, fill: string, stroke: string, feathered: boolean): void {
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
function flippers(c: Ctx, t: number, mv: number, x: number, y: number, len: number, fill: string, stroke: string): void {
  for (const s of [-1, 1]) {
    const beat = Math.sin(t * 6 + x) * 0.25 * (0.3 + mv);
    ell(c, x - len * 0.4, s * (y + len * 0.35), len * 0.55, len * 0.2, s * (0.6 + beat));
    paint(c, fill, stroke);
  }
}

/** A crescent tail fin at x. */
function tailFin(c: Ctx, x: number, h: number, fill: string, stroke: string): void {
  c.beginPath();
  c.moveTo(x + 0.1, 0);
  c.quadraticCurveTo(x - 0.1, -h * 0.4, x - 0.35, -h);
  c.quadraticCurveTo(x - 0.15, 0, x - 0.35, h);
  c.quadraticCurveTo(x - 0.1, h * 0.4, x + 0.1, 0);
  paint(c, fill, stroke);
}

// ---- tier 0 to 2

const millipede: Draw = (c, t, mv) => {
  const n = 7;
  const wave = (i: number): number => Math.sin(t * 6 - i * 0.8) * 0.12 * (0.3 + mv);
  c.lineCap = 'round';
  c.strokeStyle = '#4a2a1c';
  c.lineWidth = 0.06;
  for (let i = 0; i < n; i++) {
    const x = 0.85 - i * 0.3;
    for (const s of [-1, 1]) {
      const w = Math.sin(t * 18 + i * 1.3 + (s > 0 ? Math.PI : 0)) * 0.1 * mv;
      c.beginPath();
      c.moveTo(x, wave(i) + s * 0.25);
      c.lineTo(x + w - 0.05, wave(i) + s * 0.62);
      c.stroke();
    }
  }
  c.lineWidth = 0.06;
  for (let i = n - 1; i >= 0; i--) {
    const x = 0.85 - i * 0.3;
    ell(c, x, wave(i), 0.25, 0.38);
    paint(c, i % 2 ? '#8b4a2f' : '#9c5636', '#5a2e1c');
    ell(c, x + 0.02, wave(i), 0.07, 0.3);
    paint(c, '#b97a52');
  }
  const hy = wave(-1);
  c.strokeStyle = '#3a1e12';
  c.beginPath();
  c.moveTo(1.15, hy - 0.1);
  c.quadraticCurveTo(1.45, hy - 0.2, 1.55, hy - 0.45);
  c.moveTo(1.15, hy + 0.1);
  c.quadraticCurveTo(1.45, hy + 0.2, 1.55, hy + 0.45);
  c.stroke();
  ell(c, 1.12, hy, 0.2, 0.26);
  paint(c, '#5a2e1c');
};

const devilFrog: Draw = (c, t, mv) => {
  c.lineWidth = 0.07;
  const kick = Math.sin(t * 8) * 0.12 * mv;
  for (const s of [-1, 1]) {
    ell(c, -0.5 - kick, s * 0.7, 0.45, 0.2, s * 0.5);
    paint(c, '#b7733a', '#7a4a22');
    ell(c, -0.92 - kick, s * 0.95, 0.18, 0.12, s * 0.2);
    paint(c, '#b7733a', '#7a4a22');
    ell(c, 0.55 + kick, s * 0.8, 0.15, 0.12);
    paint(c, '#b7733a', '#7a4a22');
  }
  ell(c, 0, 0, 1, 0.9);
  paint(c, '#c9853f', '#7a4a22');
  for (const [x, y, r] of [[-0.4, -0.3, 0.15], [-0.15, 0.4, 0.12], [-0.62, 0.2, 0.1], [0.05, -0.05, 0.09]] as const) {
    ell(c, x, y, r, r);
    paint(c, '#8e5426');
  }
  for (const s of [-1, 1]) {
    poly(c, [[0.32, s * 0.62], [0.2, s * 0.95], [0.5, s * 0.72]]);
    paint(c, '#9a5a2a', '#7a4a22');
    ell(c, 0.5, s * 0.48, 0.27, 0.27);
    paint(c, '#f2d24a', '#7a4a22');
    ell(c, 0.58, s * 0.48, 0.07, 0.17);
    paint(c, '#1d1209');
  }
};

const compy: Draw = (c, t, mv) => {
  c.lineWidth = 0.07;
  tail(c, t, mv, -0.35, 1.2, 0.36, '#7fa650', '#4e6e2c');
  stride(c, t, mv, -0.05, 0.36, 0.2, 0.11, '#5f8a3a', '#4e6e2c');
  ell(c, 0, 0, 0.55, 0.42);
  paint(c, '#7fa650', '#4e6e2c');
  c.strokeStyle = '#5a7f36';
  for (const x of [-0.3, -0.1, 0.1]) {
    c.beginPath();
    c.moveTo(x, -0.38);
    c.quadraticCurveTo(x - 0.06, 0, x, 0.38);
    c.stroke();
  }
  for (const s of [-1, 1]) {
    ell(c, 0.38, s * 0.33, 0.12, 0.06, s * 0.6);
    paint(c, '#6a9442', '#4e6e2c');
  }
  ell(c, 0.6, 0, 0.26, 0.16);
  paint(c, '#7fa650', '#4e6e2c');
  ell(c, 0.93, 0, 0.26, 0.19);
  paint(c, '#8db35c', '#4e6e2c');
  eyes(c, 0.98, 0.11, 0.05);
};

const ammonite: Draw = (c, t, mv) => {
  c.lineCap = 'round';
  c.lineWidth = 0.08;
  c.strokeStyle = '#c97556';
  for (let i = 0; i < 6; i++) {
    const y0 = -0.25 + i * 0.1;
    const w = Math.sin(t * 6 + i) * 0.08 * (0.4 + mv);
    c.beginPath();
    c.moveTo(0.6, y0);
    c.quadraticCurveTo(0.9, y0 * 1.4 + w, 1.2, y0 * 1.8 - w);
    c.stroke();
  }
  ell(c, 0.6, 0, 0.28, 0.32);
  paint(c, '#d98a6a', '#a35a3e');
  ell(c, -0.15, 0, 0.82, 0.82);
  paint(c, '#ead6a8', '#a8875a');
  c.strokeStyle = '#b8955f';
  c.lineWidth = 0.05;
  c.beginPath();
  for (let a = 0; a < TAU * 2.6; a += 0.15) {
    const r = 0.78 * Math.exp(-0.16 * a);
    c.lineTo(-0.15 + Math.cos(a) * r, Math.sin(a) * r);
  }
  c.stroke();
  for (let a = 0; a < TAU; a += 0.42) {
    c.beginPath();
    c.moveTo(-0.15 + Math.cos(a) * 0.5, Math.sin(a) * 0.5);
    c.lineTo(-0.15 + Math.cos(a) * 0.8, Math.sin(a) * 0.8);
    c.stroke();
  }
  eyes(c, 0.72, 0.17, 0.06);
};

const raptor: Draw = (c, t, mv) => {
  c.lineWidth = 0.07;
  const tip = tail(c, t, mv, -0.35, 1.3, 0.4, '#c48a4a', '#6b4423');
  ell(c, tip.x, tip.y, 0.14, 0.08, tip.a);
  paint(c, '#8a5a2c');
  stride(c, t, mv, -0.05, 0.4, 0.24, 0.12, '#a8743c', '#6b4423');
  ell(c, 0, 0, 0.6, 0.45);
  paint(c, '#c48a4a', '#6b4423');
  c.strokeStyle = '#7a4c24';
  c.lineWidth = 0.08;
  for (const x of [-0.35, -0.12, 0.1]) {
    c.beginPath();
    c.moveTo(x, -0.42);
    c.lineTo(x - 0.05, 0.42);
    c.stroke();
  }
  c.lineWidth = 0.07;
  for (const s of [-1, 1]) {
    shag(c, 0.32, s * 0.42, 0.22, 0.1, 4, 0.4);
    paint(c, '#d9a464', '#6b4423');
  }
  ell(c, 0.62, 0, 0.27, 0.18);
  paint(c, '#c48a4a', '#6b4423');
  ell(c, 1, 0, 0.32, 0.2);
  paint(c, '#d09a58', '#6b4423');
  shag(c, 0.82, 0, 0.12, 0.16, 4, 0.4);
  paint(c, '#a33b2a');
  eyes(c, 1.02, 0.12, 0.055, '#2a1a08');
};

const glyptodon: Draw = (c, t, mv) => {
  c.lineWidth = 0.06;
  for (let i = 0; i < 4; i++) {
    ell(c, -1 - i * 0.16, Math.sin(t * 3 - i) * 0.04, 0.12 - i * 0.02, 0.12 - i * 0.02);
    paint(c, '#7a6a50', '#4f4330');
  }
  feet(c, t, mv, 0.55, 0.72, 0.16, 0.12, '#7a6a50', '#4f4330', 7);
  ell(c, 1, 0, 0.26, 0.22);
  paint(c, '#8a7552', '#4f4330');
  ell(c, 0.95, 0, 0.16, 0.16);
  paint(c, '#6b5a3c');
  eyes(c, 1.12, 0.12, 0.045);
  ell(c, -0.05, 0, 1, 0.88);
  paint(c, '#a08a62', '#5f5034');
  c.save();
  ell(c, -0.05, 0, 0.95, 0.83);
  c.clip();
  c.strokeStyle = '#7d6a48';
  for (let x = -1.1; x < 1; x += 0.22) {
    for (let y = -1; y < 1; y += 0.2) {
      const ox = Math.round((y + 1) / 0.2) % 2 ? 0.11 : 0;
      c.beginPath();
      c.arc(x + ox, y, 0.085, 0, TAU);
      c.stroke();
    }
  }
  c.restore();
  ell(c, -0.2, -0.3, 0.4, 0.18, -0.2);
  paint(c, 'rgba(255,255,255,0.15)');
};

// ---- tier 3

const dunkleosteus: Draw = (c, t, mv) => {
  c.lineWidth = 0.06;
  const sway = Math.sin(t * 6) * 0.15 * (0.4 + mv);
  c.save();
  c.translate(-0.95, 0);
  c.rotate(sway);
  tailFin(c, 0, 0.55, '#4e5f6b', '#2f3b44');
  c.restore();
  flippers(c, t, mv, 0.2, 0.42, 0.55, '#56697a', '#2f3b44');
  ell(c, -0.1, 0, 1, 0.48);
  paint(c, '#6a7f8c', '#2f3b44');
  ell(c, -0.3, 0, 0.6, 0.12);
  paint(c, '#57697a');
  ell(c, 0.55, 0, 0.52, 0.47);
  paint(c, '#3e4a52', '#232c32');
  c.strokeStyle = '#59666e';
  c.beginPath();
  c.moveTo(0.35, -0.42);
  c.quadraticCurveTo(0.55, 0, 0.35, 0.42);
  c.moveTo(0.7, -0.3);
  c.lineTo(0.85, 0);
  c.lineTo(0.7, 0.3);
  c.stroke();
  for (const s of [-1, 1]) {
    poly(c, [[0.95, s * 0.08], [1.1, s * 0.02], [1.02, s * 0.2]]);
    paint(c, '#d9d4c4');
  }
  eyes(c, 0.68, 0.28, 0.07, '#e6dba8');
};

const terrorBird: Draw = (c, t, mv) => {
  c.lineWidth = 0.06;
  c.lineCap = 'round';
  for (const s of [-1, 1]) {
    const step = Math.sin(t * 10 + (s > 0 ? Math.PI : 0)) * 0.25 * mv;
    c.strokeStyle = '#c98f2c';
    c.lineWidth = 0.08;
    c.beginPath();
    for (const k of [-0.6, 0, 0.6]) {
      c.moveTo(-0.15 + step, s * 0.35);
      c.lineTo(-0.15 + step + Math.cos(k) * 0.28, s * 0.35 + Math.sin(k) * 0.2);
    }
    c.stroke();
  }
  c.lineWidth = 0.06;
  shag(c, -0.95, 0, 0.35, 0.3, 5, 0.3, Math.PI * 0.55, Math.PI * 1.45);
  paint(c, '#2b364a', '#1c2433');
  ell(c, -0.15, 0, 0.78, 0.62);
  paint(c, '#3f4f68', '#1c2433');
  for (const s of [-1, 1]) {
    ell(c, -0.2, s * 0.5, 0.42, 0.16, s * 0.15);
    paint(c, '#2e3b50', '#1c2433');
  }
  c.strokeStyle = '#536583';
  for (let i = 0; i < 5; i++) {
    c.beginPath();
    c.arc(-0.5 + i * 0.18, 0, 0.18, -1, 1);
    c.stroke();
  }
  ell(c, 0.5, 0, 0.32, 0.2);
  paint(c, '#3f4f68', '#1c2433');
  ell(c, 0.85, 0, 0.28, 0.25);
  paint(c, '#4c5e7a', '#1c2433');
  c.beginPath();
  c.moveTo(0.95, -0.18);
  c.quadraticCurveTo(1.4, -0.2, 1.55, 0.02);
  c.quadraticCurveTo(1.5, 0.12, 1.42, 0.06);
  c.quadraticCurveTo(1.3, 0.18, 0.95, 0.18);
  paint(c, '#e8b23c', '#a8761c');
  eyes(c, 0.88, 0.15, 0.055, '#f2e08a');
};

const ankylosaurus: Draw = (c, t, mv) => {
  c.lineWidth = 0.06;
  const tip = tail(c, t, mv, -0.75, 0.85, 0.32, '#8a7a4a', '#5f5330', 0.4);
  shag(c, tip.x - 0.05, tip.y, 0.28, 0.24, 6, 0.2);
  paint(c, '#6b5f38', '#45391f');
  feet(c, t, mv, 0.55, 0.78, 0.17, 0.13, '#7a6c40', '#5f5330', 7);
  for (let a = 0.6; a < TAU - 0.5; a += 0.32) {
    const cx = -0.05 + Math.cos(a) * 0.98;
    const cy = Math.sin(a) * 0.8;
    poly(c, [[cx - Math.sin(a) * 0.08, cy + Math.cos(a) * 0.08], [cx + Math.cos(a) * 0.22, cy + Math.sin(a) * 0.22], [cx + Math.sin(a) * 0.08, cy - Math.cos(a) * 0.08]]);
    paint(c, '#e2d4a8', '#8a7a4a');
  }
  ell(c, -0.05, 0, 0.98, 0.8);
  paint(c, '#9b8a55', '#5f5330');
  for (const [y, n] of [[-0.45, 5], [0, 6], [0.45, 5]] as const) {
    for (let i = 0; i < n; i++) {
      ell(c, -0.7 + i * 0.28 + (n === 5 ? 0.14 : 0), y, 0.09, 0.09);
      paint(c, '#7d6e40', '#5f5330');
    }
  }
  ell(c, 0.98, 0, 0.3, 0.33);
  paint(c, '#8a7a4a', '#5f5330');
  for (const s of [-1, 1]) {
    poly(c, [[0.85, s * 0.25], [0.78, s * 0.5], [0.98, s * 0.3]]);
    paint(c, '#e2d4a8', '#8a7a4a');
  }
  eyes(c, 1.08, 0.18, 0.05);
};

// ---- tier 4

const plesiosaur: Draw = (c, t, mv) => {
  c.lineWidth = 0.06;
  tail(c, t, mv, -0.75, 0.55, 0.32, '#4f8a8f', '#2c5559');
  flippers(c, t, mv, 0.3, 0.45, 0.6, '#3f7378', '#2c5559');
  flippers(c, t + 1.5, mv, -0.45, 0.4, 0.5, '#3f7378', '#2c5559');
  ell(c, -0.1, 0, 0.85, 0.62);
  paint(c, '#4f8a8f', '#2c5559');
  ell(c, -0.2, 0, 0.5, 0.3);
  paint(c, '#5f9ea3');
  const sway = Math.sin(t * 2.5) * 0.25;
  c.lineCap = 'round';
  for (const [color, w] of [['#2c5559', 0.32], ['#4f8a8f', 0.24]] as const) {
    c.strokeStyle = color;
    c.lineWidth = w;
    c.beginPath();
    c.moveTo(0.6, 0);
    c.quadraticCurveTo(1.15, -sway, 1.55, sway * 0.6);
    c.stroke();
  }
  c.lineWidth = 0.06;
  ell(c, 1.68, sway * 0.6, 0.2, 0.15, sway * 0.4);
  paint(c, '#5f9ea3', '#2c5559');
  eyes(c, 1.72, 0.08, 0.035);
};

const sabertooth: Draw = (c, t, mv) => {
  c.lineWidth = 0.07;
  feet(c, t, mv, 0.48, 0.62, 0.18, 0.13, '#b08a58', '#7a5a32', 10);
  ell(c, -1, 0, 0.18, 0.12);
  paint(c, '#c9a26b', '#7a5a32');
  ell(c, -0.1, 0, 0.98, 0.72);
  paint(c, '#c9a26b', '#7a5a32');
  c.strokeStyle = '#9c7a48';
  c.lineWidth = 0.06;
  for (const x of [-0.6, -0.35, -0.1, 0.15]) {
    c.beginPath();
    c.moveTo(x, -0.6);
    c.quadraticCurveTo(x + 0.08, -0.3, x, -0.05);
    c.moveTo(x, 0.6);
    c.quadraticCurveTo(x + 0.08, 0.3, x, 0.05);
    c.stroke();
  }
  c.lineWidth = 0.07;
  for (const s of [-1, 1]) {
    ell(c, 0.55, s * 0.36, 0.13, 0.12);
    paint(c, '#b08a58', '#7a5a32');
  }
  ell(c, 0.72, 0, 0.48, 0.46);
  paint(c, '#d4b07a', '#7a5a32');
  ell(c, 1.05, 0, 0.18, 0.2);
  paint(c, '#ecd8b4');
  for (const s of [-1, 1]) {
    c.beginPath();
    c.moveTo(1.05, s * 0.06);
    c.quadraticCurveTo(1.32, s * 0.08, 1.42, s * 0.18);
    c.quadraticCurveTo(1.25, s * 0.18, 1.08, s * 0.16);
    paint(c, '#fbf6e8', '#b8ab90');
  }
  eyes(c, 0.92, 0.22, 0.07, '#6a5a1a');
  ell(c, 1.2, 0, 0.06, 0.05);
  paint(c, '#3a2a1a');
};

const triceratops: Draw = (c, t, mv) => {
  c.lineWidth = 0.06;
  tail(c, t, mv, -0.85, 0.7, 0.4, '#7f8a5a', '#4f5634');
  feet(c, t, mv, 0.5, 0.72, 0.2, 0.15, '#6f7a4c', '#4f5634', 7);
  ell(c, -0.15, 0, 0.9, 0.76);
  paint(c, '#8d9a62', '#4f5634');
  c.beginPath();
  c.arc(0.55, 0, 0.68, Math.PI / 2, Math.PI * 1.5);
  c.closePath();
  paint(c, '#c9773f', '#7a4220');
  for (let a = Math.PI / 2 + 0.2; a < Math.PI * 1.5; a += 0.35) {
    ell(c, 0.55 + Math.cos(a) * 0.62, Math.sin(a) * 0.62, 0.07, 0.07);
    paint(c, '#f0d9a0');
    ell(c, 0.55 + Math.cos(a) * 0.38, Math.sin(a) * 0.38, 0.06, 0.06);
    paint(c, '#e09a5a');
  }
  ell(c, 0.82, 0, 0.36, 0.3);
  paint(c, '#8d9a62', '#4f5634');
  for (const s of [-1, 1]) {
    poly(c, [[0.8, s * 0.12], [1.42, s * 0.3], [0.86, s * 0.24]]);
    paint(c, '#f1e6c8', '#a89a78');
  }
  poly(c, [[1.08, -0.06], [1.32, 0], [1.08, 0.06]]);
  paint(c, '#f1e6c8', '#a89a78');
  ell(c, 1.16, 0, 0.08, 0.1);
  paint(c, '#4a4a3a');
  eyes(c, 0.9, 0.2, 0.05);
};

// ---- tier 5

const megalodon: Draw = (c, t, mv) => {
  c.lineWidth = 0.06;
  const sway = Math.sin(t * 5) * 0.18 * (0.4 + mv);
  c.save();
  c.translate(-0.95, 0);
  c.rotate(sway);
  tailFin(c, 0, 0.65, '#5c7383', '#33434f');
  c.restore();
  for (const s of [-1, 1]) {
    poly(c, [[0.25, s * 0.3], [-0.3, s * 1], [-0.15, s * 0.35]]);
    paint(c, '#5c7383', '#33434f');
  }
  c.beginPath();
  c.moveTo(1.2, 0);
  c.quadraticCurveTo(1, -0.5, 0, -0.46);
  c.quadraticCurveTo(-0.8, -0.36, -1.05, 0);
  c.quadraticCurveTo(-0.8, 0.36, 0, 0.46);
  c.quadraticCurveTo(1, 0.5, 1.2, 0);
  paint(c, '#6d8596', '#33434f');
  poly(c, [[0.15, 0], [-0.5, -0.08], [-0.5, 0.08]]);
  paint(c, '#4f6575', '#33434f');
  c.strokeStyle = '#3f5260';
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.arc(0.48 - i * 0.09, s * 0.3, 0.12, s > 0 ? -0.6 : 0.6 + Math.PI - 1.2, s > 0 ? 0.6 : Math.PI + 0.6);
      c.stroke();
    }
  }
  eyes(c, 0.85, 0.24, 0.05, '#0d1418');
};

const spinosaurus: Draw = (c, t, mv) => {
  c.lineWidth = 0.06;
  tail(c, t, mv, -0.6, 1.3, 0.45, '#6e7d58', '#3f4a30', 0.35);
  stride(c, t, mv, 0, 0.42, 0.26, 0.14, '#5d6b48', '#3f4a30');
  ell(c, -0.05, 0, 0.85, 0.55);
  paint(c, '#6e7d58', '#3f4a30');
  c.beginPath();
  c.moveTo(0.6, 0);
  c.bezierCurveTo(0.3, -0.24, -0.6, -0.22, -0.95, 0);
  c.bezierCurveTo(-0.6, 0.22, 0.3, 0.24, 0.6, 0);
  paint(c, '#c4553d', '#7a2e1e');
  c.strokeStyle = '#8a3a28';
  for (let x = -0.8; x < 0.55; x += 0.12) {
    c.beginPath();
    c.moveTo(x, -0.14);
    c.lineTo(x, 0.14);
    c.stroke();
  }
  for (const s of [-1, 1]) {
    ell(c, 0.45, s * 0.42, 0.14, 0.07, s * 0.5);
    paint(c, '#5d6b48', '#3f4a30');
  }
  ell(c, 0.72, 0, 0.26, 0.22);
  paint(c, '#7d8c66', '#3f4a30');
  c.beginPath();
  c.moveTo(0.82, -0.16);
  c.lineTo(1.5, -0.07);
  c.quadraticCurveTo(1.6, 0, 1.5, 0.07);
  c.lineTo(0.82, 0.16);
  paint(c, '#7d8c66', '#3f4a30');
  eyes(c, 0.8, 0.14, 0.05, '#d9a62a');
};

const mammoth: Draw = (c, t, mv) => {
  c.lineWidth = 0.06;
  feet(c, t, mv, 0.48, 0.72, 0.21, 0.16, '#6e3c24', '#4a2716', 6);
  shag(c, -0.1, 0, 1.02, 0.92, 20, 0.08);
  paint(c, '#9a5a38', '#5e3520');
  c.strokeStyle = '#b5744c';
  c.lineWidth = 0.05;
  for (let i = 0; i < 9; i++) {
    const y = -0.6 + i * 0.15;
    c.beginPath();
    c.moveTo(-0.8 + Math.abs(y) * 0.4, y);
    c.quadraticCurveTo(-0.3, y + 0.06, 0.1, y);
    c.stroke();
  }
  c.lineWidth = 0.06;
  for (const s of [-1, 1]) {
    ell(c, 0.55, s * 0.48, 0.22, 0.3, s * 0.3);
    paint(c, '#7a4329', '#4a2716');
  }
  ell(c, 0.78, 0, 0.5, 0.48);
  paint(c, '#8a4f32', '#5e3520');
  c.lineCap = 'round';
  const curl = Math.sin(t * 3) * 0.12;
  c.lineWidth = 0.22;
  c.strokeStyle = '#5e3520';
  c.beginPath();
  c.moveTo(1.1, 0);
  c.quadraticCurveTo(1.45, curl, 1.55, 0.15 + curl);
  c.stroke();
  c.lineWidth = 0.15;
  c.strokeStyle = '#8a4f32';
  c.stroke();
  for (const s of [-1, 1]) {
    c.beginPath();
    c.moveTo(1.0, s * 0.24);
    c.bezierCurveTo(1.45, s * 0.2, 1.6, s * 0.45, 1.5, s * 0.7);
    c.lineWidth = 0.17;
    c.strokeStyle = '#b8a888';
    c.stroke();
    c.lineWidth = 0.11;
    c.strokeStyle = '#f3ead6';
    c.stroke();
  }
  c.lineWidth = 0.06;
  eyes(c, 0.98, 0.25, 0.06);
};

// ---- tier 6

const mosasaur: Draw = (c, t, mv) => {
  c.lineWidth = 0.06;
  const tip = tail(c, t, mv, -0.65, 1.2, 0.45, '#3d6f8a', '#22445a', 0.4);
  c.save();
  c.translate(tip.x + 0.1, tip.y);
  c.rotate(tip.a + Math.PI);
  tailFin(c, 0, 0.35, '#2f5a72', '#22445a');
  c.restore();
  flippers(c, t, mv, 0.3, 0.38, 0.5, '#2f5a72', '#22445a');
  flippers(c, t + 1.2, mv, -0.4, 0.34, 0.42, '#2f5a72', '#22445a');
  ell(c, 0, 0, 0.85, 0.5);
  paint(c, '#3d6f8a', '#22445a');
  ell(c, -0.1, 0, 0.6, 0.18);
  paint(c, '#5b8ea8');
  c.beginPath();
  c.moveTo(0.7, -0.28);
  c.lineTo(1.5, -0.09);
  c.quadraticCurveTo(1.62, 0, 1.5, 0.09);
  c.lineTo(0.7, 0.28);
  paint(c, '#3d6f8a', '#22445a');
  eyes(c, 0.95, 0.17, 0.055, '#e8d86a');
};

const tRex: Draw = (c, t, mv) => {
  c.lineWidth = 0.06;
  tail(c, t, mv, -0.5, 1.3, 0.62, '#6b7a43', '#3f4a24', 0.3);
  stride(c, t, mv, -0.05, 0.5, 0.32, 0.17, '#5c6a38', '#3f4a24');
  ell(c, -0.05, 0, 0.75, 0.62);
  paint(c, '#6b7a43', '#3f4a24');
  c.strokeStyle = '#56633a';
  c.lineWidth = 0.08;
  for (const x of [-0.5, -0.25, 0]) {
    c.beginPath();
    c.moveTo(x, -0.5);
    c.quadraticCurveTo(x - 0.08, 0, x, 0.5);
    c.stroke();
  }
  c.lineWidth = 0.05;
  for (const s of [-1, 1]) {
    ell(c, 0.5, s * 0.45, 0.12, 0.05, s * 0.7);
    paint(c, '#5c6a38', '#3f4a24');
  }
  ell(c, 0.95, 0, 0.52, 0.42);
  paint(c, '#77874c', '#3f4a24');
  for (const s of [-1, 1]) {
    for (let x = 0.75; x < 1.38; x += 0.1) {
      poly(c, [[x, s * 0.37], [x + 0.05, s * 0.29], [x + 0.1, s * 0.37]]);
      paint(c, '#f4efdf');
    }
  }
  ell(c, 0.85, -0.26, 0.12, 0.06);
  paint(c, '#56633a');
  ell(c, 0.85, 0.26, 0.12, 0.06);
  paint(c, '#56633a');
  eyes(c, 0.85, 0.24, 0.055, '#e0a020');
  ell(c, 1.38, -0.1, 0.03, 0.03);
  paint(c, '#2a3016');
  ell(c, 1.38, 0.1, 0.03, 0.03);
  paint(c, '#2a3016');
};

const titanoboa: Draw = (c, t, mv) => {
  const head = serpent(c, t, mv, -1.7, 0.85, 0.6, '#5a6b30', '#33401a');
  c.save();
  c.lineWidth = 0.2;
  c.setLineDash([0.18, 0.22]);
  c.strokeStyle = '#7d8f45';
  c.beginPath();
  for (let x = -1.5; x <= 0.8; x += 0.1) c.lineTo(x, Math.sin(t * 5 - x * 2.2) * 0.32 * (0.45 + mv * 0.55) * (0.3 + 0.7 * ((x + 1.7) / 2.55)));
  c.stroke();
  c.restore();
  c.save();
  c.translate(head.x, head.y);
  c.rotate(head.a);
  c.lineWidth = 0.06;
  if (Math.sin(t * 3) > 0.3) {
    c.strokeStyle = '#d9394a';
    c.lineWidth = 0.04;
    c.beginPath();
    c.moveTo(0.3, 0);
    c.lineTo(0.55, 0);
    c.lineTo(0.65, -0.06);
    c.moveTo(0.55, 0);
    c.lineTo(0.65, 0.06);
    c.stroke();
    c.lineWidth = 0.06;
  }
  ell(c, 0.12, 0, 0.34, 0.27);
  paint(c, '#5a6b30', '#33401a');
  eyes(c, 0.22, 0.17, 0.05, '#e8c43a');
  c.restore();
};

// ---- tier 7: the mythical ones begin

const seaSerpent: Draw = (c, t, mv) => {
  const head = serpent(c, t, mv, -1.9, 0.9, 0.62, '#2f7f86', '#1a4d52', 0.38);
  c.save();
  c.setLineDash([0.12, 0.12]);
  c.lineWidth = 0.14;
  c.strokeStyle = '#e0a94a';
  c.beginPath();
  for (let x = -1.7; x <= 0.7; x += 0.1) c.lineTo(x, Math.sin(t * 5 - x * 2.2) * 0.38 * (0.45 + mv * 0.55) * (0.3 + 0.7 * ((x + 1.9) / 2.8)));
  c.stroke();
  c.restore();
  c.save();
  c.translate(head.x, head.y);
  c.rotate(head.a);
  c.lineWidth = 0.06;
  shag(c, 0, 0, 0.3, 0.42, 6, 0.35, Math.PI * 0.55, Math.PI * 1.45);
  paint(c, '#e0a94a', '#a87420');
  ell(c, 0.15, 0, 0.38, 0.28);
  paint(c, '#3a959c', '#1a4d52');
  glowEyes(c, 0.25, 0.16, 0.055, '#c8ff6a');
  c.restore();
};

const griffin: Draw = (c, t, mv) => {
  c.lineWidth = 0.05;
  wings(c, t, 0, 1.75, '#b9863f', '#6e4b1f', true);
  c.lineWidth = 0.06;
  c.strokeStyle = '#a77a3e';
  c.lineWidth = 0.06;
  c.beginPath();
  c.moveTo(-0.9, 0);
  c.quadraticCurveTo(-1.25, Math.sin(t * 4) * 0.2, -1.45, Math.sin(t * 4 + 1) * 0.25);
  c.stroke();
  ell(c, -1.48, Math.sin(t * 4 + 1) * 0.25, 0.1, 0.08);
  paint(c, '#6e4b1f');
  feet(c, t, mv, 0.45, 0.42, 0.13, 0.1, '#d4a85e', '#8a6a34', 9);
  ell(c, -0.45, 0, 0.55, 0.43);
  paint(c, '#d4a85e', '#8a6a34');
  ell(c, 0.2, 0, 0.5, 0.44);
  paint(c, '#f3efe4', '#a89f8a');
  ell(c, 0.68, 0, 0.3, 0.27);
  paint(c, '#faf7ee', '#a89f8a');
  c.beginPath();
  c.moveTo(0.88, -0.12);
  c.quadraticCurveTo(1.2, -0.1, 1.22, 0.06);
  c.quadraticCurveTo(1.1, 0.04, 0.88, 0.12);
  paint(c, '#f0b832', '#a87a18');
  eyes(c, 0.78, 0.13, 0.05, '#c86a10');
};

const basilisk: Draw = (c, t, mv) => {
  c.lineWidth = 0.06;
  tail(c, t, mv, -0.55, 1.5, 0.5, '#2f5a3a', '#173322', 0.45);
  feet(c, t, mv, 0.45, 0.52, 0.15, 0.1, '#264b30', '#173322', 11);
  ell(c, 0, 0, 0.8, 0.48);
  paint(c, '#2f5a3a', '#173322');
  for (let i = 0; i < 8; i++) {
    const x = -0.65 + i * 0.18;
    poly(c, [[x - 0.07, 0], [x + 0.03, -0.12], [x + 0.08, 0], [x + 0.03, 0.12]]);
    paint(c, '#1d3a26');
  }
  for (const [x, y] of [[-0.3, -0.25], [0.1, 0.28], [-0.45, 0.22], [0.25, -0.2]] as const) {
    ell(c, x, y, 0.08, 0.06);
    paint(c, '#4f8a5a');
  }
  ell(c, 0.85, 0, 0.38, 0.32);
  paint(c, '#2f5a3a', '#173322');
  for (let a = Math.PI * 0.6; a <= Math.PI * 1.4; a += Math.PI * 0.2) {
    const x = 0.75 + Math.cos(a) * 0.3;
    const y = Math.sin(a) * 0.3;
    poly(c, [[x - Math.sin(a) * 0.07, y + Math.cos(a) * 0.07], [x + Math.cos(a) * 0.25, y + Math.sin(a) * 0.25], [x + Math.sin(a) * 0.07, y - Math.cos(a) * 0.07]]);
    paint(c, '#e0c048', '#8a7218');
  }
  glowEyes(c, 1, 0.16, 0.07, '#ffe45a');
};

// ---- tier 8

const kraken: Draw = (c, t, mv) => {
  c.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const y0 = (i - 3.5) * 0.13;
    const spread = (i - 3.5) * 0.28;
    c.beginPath();
    let px = -0.3;
    let py = y0;
    c.moveTo(px, py);
    for (let k = 1; k <= 8; k++) {
      const s = k / 8;
      px = -0.3 - s * 1.5;
      py = y0 + spread * s + Math.sin(t * 4 + i * 0.9 - s * 4) * 0.18 * s * (0.5 + mv);
      c.lineTo(px, py);
    }
    c.lineWidth = 0.2;
    c.strokeStyle = '#6e2838';
    c.stroke();
    c.lineWidth = 0.13;
    c.strokeStyle = '#9c3d54';
    c.stroke();
    ell(c, px, py, 0.05, 0.05);
    paint(c, '#d97a8e');
  }
  c.lineWidth = 0.06;
  ell(c, 0.2, 0, 0.88, 0.72);
  paint(c, '#b04a62', '#6e2838');
  for (const [x, y, r] of [[0.5, -0.3, 0.09], [0.3, 0.35, 0.07], [-0.1, -0.15, 0.1], [-0.3, 0.3, 0.08], [0.7, 0.1, 0.06]] as const) {
    ell(c, x, y, r, r);
    paint(c, '#d97a8e');
  }
  for (const s of [-1, 1]) {
    ell(c, 0.45, s * 0.42, 0.16, 0.14);
    paint(c, '#f4d24a', '#6e2838');
    ell(c, 0.47, s * 0.42, 0.04, 0.11);
    paint(c, '#1a0a10');
  }
};

const hydra: Draw = (c, t, mv) => {
  c.lineWidth = 0.06;
  tail(c, t, mv, -0.65, 1, 0.5, '#3f6b4a', '#22402a');
  feet(c, t, mv, 0.45, 0.62, 0.17, 0.13, '#33583d', '#22402a', 8);
  ell(c, -0.1, 0, 0.82, 0.68);
  paint(c, '#3f6b4a', '#22402a');
  for (let i = 0; i < 6; i++) {
    ell(c, -0.6 + i * 0.2, 0, 0.07, 0.07);
    paint(c, '#2b4d34');
  }
  c.lineCap = 'round';
  for (const [k, ang] of [[0, -0.6], [1, 0], [2, 0.6]] as const) {
    const sway = Math.sin(t * 3 + k * 2) * 0.15;
    const hx = 0.35 + Math.cos(ang + sway) * 1.05;
    const hy = Math.sin(ang + sway) * 1.05;
    for (const [color, w] of [['#22402a', 0.26], ['#3f6b4a', 0.18]] as const) {
      c.strokeStyle = color;
      c.lineWidth = w;
      c.beginPath();
      c.moveTo(0.35, 0);
      c.quadraticCurveTo(0.35 + Math.cos(ang) * 0.6, Math.sin(ang) * 0.3, hx, hy);
      c.stroke();
    }
    c.save();
    c.translate(hx, hy);
    c.rotate(ang + sway);
    c.lineWidth = 0.05;
    ell(c, 0.08, 0, 0.24, 0.17);
    paint(c, '#4d8259', '#22402a');
    poly(c, [[-0.1, -0.1], [-0.22, -0.22], [-0.04, -0.14]]);
    paint(c, '#c8b060');
    poly(c, [[-0.1, 0.1], [-0.22, 0.22], [-0.04, 0.14]]);
    paint(c, '#c8b060');
    glowEyes(c, 0.12, 0.09, 0.035, '#ff9a3a');
    c.restore();
  }
};

const behemoth: Draw = (c, t, mv) => {
  c.lineWidth = 0.06;
  ell(c, -1.02, 0, 0.14, 0.1);
  paint(c, '#4c3e5a', '#2a2134');
  feet(c, t, mv, 0.52, 0.78, 0.24, 0.18, '#3e3249', '#2a2134', 5);
  ell(c, -0.05, 0, 1, 0.88);
  paint(c, '#5a4a6a', '#2a2134');
  for (const [y, n] of [[-0.5, 4], [0.5, 4], [-0.25, 5], [0.25, 5]] as const) {
    for (let i = 0; i < n; i++) {
      ell(c, -0.7 + i * 0.3 + (n === 4 ? 0.15 : 0), y, 0.12, 0.09);
      paint(c, '#6e5c80', '#3e3249');
    }
  }
  for (let i = 0; i < 6; i++) {
    const x = -0.8 + i * 0.27;
    poly(c, [[x - 0.09, 0], [x + 0.05, -0.08], [x + 0.14, 0], [x + 0.05, 0.08]]);
    paint(c, '#c9b8d8', '#3e3249');
  }
  ell(c, 0.85, 0, 0.42, 0.4);
  paint(c, '#4c3e5a', '#2a2134');
  for (const s of [-1, 1]) {
    c.beginPath();
    c.moveTo(0.85, s * 0.28);
    c.quadraticCurveTo(1.1, s * 0.62, 1.42, s * 0.5);
    c.lineWidth = 0.16;
    c.strokeStyle = '#a89a80';
    c.stroke();
    c.lineWidth = 0.1;
    c.strokeStyle = '#ece0c4';
    c.stroke();
  }
  c.lineWidth = 0.06;
  poly(c, [[1.12, -0.07], [1.4, 0], [1.12, 0.07]]);
  paint(c, '#ece0c4', '#a89a80');
  glowEyes(c, 1, 0.2, 0.06, '#ff6b4a');
};

// ---- tier 9

const leviathan: Draw = (c, t, mv) => {
  const head = serpent(c, t, mv, -2, 0.85, 0.78, '#1f3f73', '#0f2142', 0.34);
  for (let x = -1.7; x <= 0.6; x += 0.22) {
    const y = Math.sin(t * 5 - x * 2.2) * 0.34 * (0.45 + mv * 0.55) * (0.3 + 0.7 * ((x + 2) / 2.85));
    poly(c, [[x - 0.08, y], [x + 0.02, y - 0.13], [x + 0.1, y], [x + 0.02, y + 0.13]]);
    paint(c, '#7fb4e0');
  }
  c.save();
  c.shadowColor = '#9fe8ff';
  c.shadowBlur = 6;
  for (let x = -1.5; x <= 0.5; x += 0.35) {
    const y = Math.sin(t * 5 - x * 2.2) * 0.34 * (0.45 + mv * 0.55) * (0.3 + 0.7 * ((x + 2) / 2.85));
    for (const s of [-1, 1]) {
      ell(c, x, y + s * 0.22, 0.035, 0.035);
      paint(c, '#9fe8ff');
    }
  }
  c.restore();
  c.save();
  c.translate(head.x, head.y);
  c.rotate(head.a);
  c.lineWidth = 0.06;
  flippers(c, t, mv, -0.25, 0.3, 0.6, '#2c5490', '#0f2142');
  ell(c, 0.2, 0, 0.45, 0.36);
  paint(c, '#264a85', '#0f2142');
  for (const s of [-1, 1]) {
    for (let x = 0.15; x < 0.6; x += 0.1) {
      poly(c, [[x, s * 0.3], [x + 0.05, s * 0.21], [x + 0.1, s * 0.3]]);
      paint(c, '#e8f4ff');
    }
  }
  glowEyes(c, 0.3, 0.18, 0.06, '#7ff0ff');
  c.restore();
};

const dragon: Draw = (c, t, mv) => {
  c.lineWidth = 0.05;
  wings(c, t, 0.05, 1.95, 'rgba(170,48,36,0.92)', '#5e1a12', false);
  c.lineWidth = 0.06;
  const tip = tail(c, t, mv, -0.55, 1.5, 0.45, '#c8442f', '#6e1d16', 0.45);
  c.save();
  c.translate(tip.x, tip.y);
  c.rotate(tip.a);
  poly(c, [[-0.05, 0], [0.18, -0.16], [0.32, 0], [0.18, 0.16]]);
  paint(c, '#f0c050', '#6e1d16');
  c.restore();
  feet(c, t, mv, 0.35, 0.45, 0.13, 0.1, '#a8382a', '#6e1d16', 9);
  ell(c, -0.05, 0, 0.7, 0.5);
  paint(c, '#c8442f', '#6e1d16');
  for (let i = 0; i < 6; i++) {
    const x = -0.6 + i * 0.22;
    poly(c, [[x - 0.06, 0], [x + 0.04, -0.07], [x + 0.1, 0], [x + 0.04, 0.07]]);
    paint(c, '#f0c050');
  }
  ell(c, 0.55, 0, 0.28, 0.2);
  paint(c, '#c8442f', '#6e1d16');
  for (const s of [-1, 1]) {
    poly(c, [[0.78, s * 0.14], [0.42, s * 0.42], [0.7, s * 0.2]]);
    paint(c, '#f0d9a0', '#8a6a3a');
  }
  ell(c, 0.9, 0, 0.34, 0.26);
  paint(c, '#d4503a', '#6e1d16');
  ell(c, 1.2, -0.08, 0.03, 0.03);
  paint(c, '#3a0e08');
  ell(c, 1.2, 0.08, 0.03, 0.03);
  paint(c, '#3a0e08');
  glowEyes(c, 0.95, 0.15, 0.055, '#ffd23a');
};

const draws: Record<string, Draw> = {
  Millipede: millipede,
  'Devil Frog': devilFrog,
  Compy: compy,
  Ammonite: ammonite,
  Raptor: raptor,
  Glyptodon: glyptodon,
  Dunkleosteus: dunkleosteus,
  'Terror Bird': terrorBird,
  Ankylosaurus: ankylosaurus,
  Plesiosaur: plesiosaur,
  Sabertooth: sabertooth,
  Triceratops: triceratops,
  Megalodon: megalodon,
  Spinosaurus: spinosaurus,
  Mammoth: mammoth,
  Mosasaur: mosasaur,
  'T-Rex': tRex,
  Titanoboa: titanoboa,
  'Sea Serpent': seaSerpent,
  Griffin: griffin,
  Basilisk: basilisk,
  Kraken: kraken,
  Hydra: hydra,
  Behemoth: behemoth,
  Leviathan: leviathan,
  Dragon: dragon,
};

/** The main colour of each species, for its sparks when it is eaten. */
export const BODY_COLOR: Record<string, string> = {
  Millipede: '#9c5636', 'Devil Frog': '#c9853f', Compy: '#7fa650', Ammonite: '#ead6a8', Raptor: '#c48a4a',
  Glyptodon: '#a08a62', Dunkleosteus: '#6a7f8c', 'Terror Bird': '#3f4f68', Ankylosaurus: '#9b8a55', Plesiosaur: '#4f8a8f',
  Sabertooth: '#c9a26b', Triceratops: '#c9773f', Megalodon: '#6d8596', Spinosaurus: '#c4553d', Mammoth: '#9a5a38',
  Mosasaur: '#3d6f8a', 'T-Rex': '#6b7a43', Titanoboa: '#5a6b30', 'Sea Serpent': '#2f7f86', Griffin: '#d4a85e',
  Basilisk: '#2f5a3a', Kraken: '#b04a62', Hydra: '#3f6b4a', Behemoth: '#5a4a6a', Leviathan: '#1f3f73', Dragon: '#c8442f',
};

/** Draws the species named `name` at x, y with radius r, facing angle a. */
export function drawAnimal(c: Ctx, name: string, x: number, y: number, r: number, a: number, t: number, mv: number, stretch = 1): void {
  c.save();
  c.translate(x, y);
  c.rotate(a);
  c.scale(r * stretch, r / Math.sqrt(stretch));
  c.lineJoin = 'round';
  c.lineCap = 'butt';
  (draws[name] ?? millipede)(c, t, mv);
  c.restore();
}

/** The soft shadow under a creature, drawn before it. */
export function drawShadow(c: Ctx, x: number, y: number, r: number): void {
  ell(c, x + r * 0.12, y + r * 0.2, r * 1.08, r * 0.96);
  c.fillStyle = 'rgba(20,50,20,0.18)';
  c.fill();
}
