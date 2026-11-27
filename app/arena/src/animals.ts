// The creatures, drawn from shapes: each at a radius of 1, facing +x, onto a context already moved, turned and scaled
// to the creature. `t` is seconds, for the legs; `mv` is how fast it moves, 0 to 1.

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

/** Four feet that step as the creature moves. */
function feet(c: Ctx, t: number, mv: number, x: number, y: number, rx: number, ry: number, fill: string, stroke: string, rate = 9): void {
  for (const [i, sx, sy] of [[0, 1, 1], [1, 1, -1], [1, -1, 1], [0, -1, -1]] as const) {
    const step = Math.sin(t * rate + i * Math.PI) * 0.14 * mv;
    ell(c, sx * x + step, sy * y, rx, ry);
    paint(c, fill, stroke);
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

const beetle: Draw = (c, t, mv) => {
  c.lineCap = 'round';
  c.strokeStyle = '#1d3b37';
  c.lineWidth = 0.1;
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const x = -0.45 + i * 0.42;
      const w = Math.sin(t * 16 + i * 2 + (s > 0 ? Math.PI : 0)) * 0.16 * mv;
      c.beginPath();
      c.moveTo(x, s * 0.5);
      c.lineTo(x + 0.18 + w, s * 1.1);
      c.stroke();
    }
  }
  c.lineWidth = 0.07;
  c.beginPath();
  c.moveTo(0.95, -0.12);
  c.quadraticCurveTo(1.35, -0.2, 1.45, -0.55);
  c.moveTo(0.95, 0.12);
  c.quadraticCurveTo(1.35, 0.2, 1.45, 0.55);
  c.stroke();
  c.lineWidth = 0.07;
  ell(c, 0.8, 0, 0.3, 0.32);
  paint(c, '#1d3b37');
  ell(c, -0.08, 0, 0.92, 0.8);
  paint(c, '#2a9d8f', '#165e56');
  c.beginPath();
  c.moveTo(0.5, -0.66);
  c.quadraticCurveTo(0.66, 0, 0.5, 0.66);
  c.moveTo(0.58, 0);
  c.lineTo(-0.98, 0);
  c.strokeStyle = '#165e56';
  c.stroke();
  for (const [x, y] of [[-0.35, -0.38], [-0.35, 0.38], [0.1, -0.42], [0.1, 0.42], [-0.7, -0.22], [-0.7, 0.22]] as const) {
    ell(c, x, y, 0.09, 0.09);
    paint(c, '#1f7a6f');
  }
  ell(c, -0.2, -0.3, 0.32, 0.12, -0.15);
  paint(c, 'rgba(255,255,255,0.25)');
};

const frog: Draw = (c, t, mv) => {
  c.lineWidth = 0.07;
  const kick = Math.sin(t * 8) * 0.12 * mv;
  for (const s of [-1, 1]) {
    ell(c, -0.5 - kick, s * 0.7, 0.45, 0.2, s * 0.5);
    paint(c, '#6aaf45', '#4c8a2f');
    ell(c, -0.9 - kick, s * 0.95, 0.18, 0.12, s * 0.2);
    paint(c, '#6aaf45', '#4c8a2f');
    ell(c, 0.55 + kick, s * 0.78, 0.15, 0.12);
    paint(c, '#6aaf45', '#4c8a2f');
  }
  ell(c, 0, 0, 0.95, 0.85);
  paint(c, '#7cc554', '#4c8a2f');
  for (const [x, y, r] of [[-0.38, -0.25, 0.14], [-0.1, 0.38, 0.11], [-0.58, 0.18, 0.1], [0.1, -0.1, 0.08]] as const) {
    ell(c, x, y, r, r);
    paint(c, '#5ea53c');
  }
  for (const s of [-1, 1]) {
    ell(c, 0.5, s * 0.46, 0.27, 0.27);
    paint(c, '#f4f1c9', '#4c8a2f');
    ell(c, 0.6, s * 0.46, 0.13, 0.13);
    paint(c, '#1d2a17');
  }
};

const hare: Draw = (c, t, mv) => {
  c.lineWidth = 0.07;
  const hop = Math.sin(t * 10) * 0.16 * mv;
  for (const s of [-1, 1]) {
    ell(c, -0.5 + hop, s * 0.62, 0.38, 0.15);
    paint(c, '#b89068', '#8f6b47');
    ell(c, 0.4 - hop, s * 0.5, 0.14, 0.1);
    paint(c, '#b89068', '#8f6b47');
  }
  ell(c, -1, 0, 0.28, 0.28);
  paint(c, '#fbf6ee', '#d8cfc2');
  ell(c, -0.1, 0, 0.95, 0.72);
  paint(c, '#cfa77c', '#8f6b47');
  ell(c, 0.72, 0, 0.45, 0.42);
  paint(c, '#cfa77c', '#8f6b47');
  for (const s of [-1, 1]) {
    ell(c, 0.12, s * 0.3, 0.58, 0.16, s * -0.25);
    paint(c, '#cfa77c', '#8f6b47');
    ell(c, 0.12, s * 0.3, 0.42, 0.07, s * -0.25);
    paint(c, '#f2b7b0');
  }
  eyes(c, 0.9, 0.27, 0.075);
  ell(c, 1.15, 0, 0.08, 0.07);
  paint(c, '#e48b8b');
};

const hedgehog: Draw = (c, t, mv) => {
  c.lineWidth = 0.07;
  feet(c, t, mv, 0.45, 0.72, 0.14, 0.11, '#d9bd92', '#a3825b', 12);
  shag(c, -0.1, 0, 1.08, 0.98, 18, 0.2);
  paint(c, '#6e5440', '#4a3727');
  shag(c, -0.15, 0, 0.78, 0.7, 14, 0.25);
  paint(c, '#86684f');
  c.strokeStyle = '#b39779';
  c.lineWidth = 0.05;
  for (let i = 0; i < 10; i++) {
    const a = 1.2 + i * 0.4;
    c.beginPath();
    c.moveTo(-0.15 + Math.cos(a) * 0.25, Math.sin(a) * 0.25);
    c.lineTo(-0.15 + Math.cos(a) * 0.65, Math.sin(a) * 0.6);
    c.stroke();
  }
  c.lineWidth = 0.07;
  c.beginPath();
  c.moveTo(0.3, -0.55);
  c.quadraticCurveTo(1.25, -0.32, 1.28, 0);
  c.quadraticCurveTo(1.25, 0.32, 0.3, 0.55);
  c.closePath();
  paint(c, '#ecd5ae', '#a3825b');
  for (const s of [-1, 1]) {
    ell(c, 0.45, s * 0.45, 0.11, 0.1);
    paint(c, '#d9bd92', '#a3825b');
  }
  eyes(c, 0.82, 0.2, 0.065);
  ell(c, 1.26, 0, 0.1, 0.09);
  paint(c, '#2a1d14');
};

const boar: Draw = (c, t, mv) => {
  c.lineWidth = 0.07;
  feet(c, t, mv, 0.5, 0.7, 0.17, 0.12, '#4d321f', '#33200f');
  c.strokeStyle = '#4d321f';
  c.beginPath();
  c.moveTo(-1.02, 0);
  c.quadraticCurveTo(-1.25, -0.15, -1.15, 0.12);
  c.stroke();
  ell(c, -0.05, 0, 1, 0.78);
  paint(c, '#7a5236', '#4d321f');
  c.beginPath();
  for (let i = 0; i <= 12; i++) {
    const x = -0.85 + i * 0.12;
    c.lineTo(x, i % 2 ? -0.09 : 0.09);
  }
  c.strokeStyle = '#4a2f1c';
  c.lineWidth = 0.08;
  c.stroke();
  c.lineWidth = 0.07;
  ell(c, 0.72, 0, 0.42, 0.5);
  paint(c, '#7a5236', '#4d321f');
  for (const s of [-1, 1]) {
    c.beginPath();
    c.moveTo(0.6, s * 0.28);
    c.lineTo(0.28, s * 0.62);
    c.lineTo(0.48, s * 0.18);
    c.closePath();
    paint(c, '#5e3d27', '#4d321f');
  }
  ell(c, 1.1, 0, 0.2, 0.28);
  paint(c, '#c58f72', '#8a5a40');
  for (const s of [-1, 1]) {
    ell(c, 1.2, s * 0.1, 0.045, 0.045);
    paint(c, '#4d321f');
    c.beginPath();
    c.moveTo(1.0, s * 0.24);
    c.quadraticCurveTo(1.12, s * 0.42, 1.24, s * 0.44);
    c.quadraticCurveTo(1.14, s * 0.3, 1.06, s * 0.2);
    c.closePath();
    paint(c, '#f5efe0', '#b3a891');
  }
  eyes(c, 0.85, 0.28, 0.06);
};

const lynx: Draw = (c, t, mv) => {
  c.lineWidth = 0.07;
  feet(c, t, mv, 0.48, 0.62, 0.16, 0.12, '#c9a26b', '#9a7444', 10);
  ell(c, -1.02, 0, 0.24, 0.13);
  paint(c, '#dcb57e', '#9a7444');
  ell(c, -1.18, 0, 0.1, 0.1);
  paint(c, '#2b2118');
  ell(c, -0.1, 0, 0.98, 0.7);
  paint(c, '#dcb57e', '#9a7444');
  for (const [x, y, r] of [[-0.5, -0.3, 0.08], [-0.2, 0.35, 0.07], [0.1, -0.25, 0.06], [-0.7, 0.15, 0.07], [-0.3, 0, 0.06], [0.2, 0.25, 0.06], [-0.55, 0.45, 0.05], [-0.05, -0.5, 0.05]] as const) {
    ell(c, x, y, r, r);
    paint(c, '#a27a49');
  }
  for (const s of [-1, 1]) {
    shag(c, 0.7, s * 0.4, 0.14, 0.12, 4, 0.4);
    paint(c, '#efd9b4');
  }
  for (const s of [-1, 1]) {
    c.beginPath();
    c.moveTo(0.55, s * 0.2);
    c.lineTo(0.5, s * 0.72);
    c.lineTo(0.82, s * 0.32);
    c.closePath();
    paint(c, '#c99e63', '#9a7444');
    c.beginPath();
    c.moveTo(0.5, s * 0.72);
    c.lineTo(0.47, s * 0.9);
    c.lineWidth = 0.09;
    c.lineCap = 'round';
    c.strokeStyle = '#2b2118';
    c.stroke();
    c.lineWidth = 0.07;
  }
  ell(c, 0.72, 0, 0.47, 0.45);
  paint(c, '#dcb57e', '#9a7444');
  eyes(c, 0.95, 0.2, 0.08, '#4c6a1f');
  c.beginPath();
  c.moveTo(1.2, 0);
  c.lineTo(1.1, -0.07);
  c.lineTo(1.1, 0.07);
  c.closePath();
  paint(c, '#d98b80');
};

const wolf: Draw = (c, t, mv) => {
  c.lineWidth = 0.07;
  feet(c, t, mv, 0.5, 0.6, 0.16, 0.11, '#7a7f88', '#5a5e66', 10);
  const sway = Math.sin(t * 5) * 0.12 * (0.3 + mv);
  ell(c, -1.25, sway, 0.5, 0.22, sway * 0.5);
  paint(c, '#8e939c', '#5a5e66');
  ell(c, -1.6, sway * 1.6, 0.14, 0.12);
  paint(c, '#e3e5e9');
  ell(c, -0.1, 0, 1.02, 0.68);
  paint(c, '#8e939c', '#5a5e66');
  ell(c, -0.25, 0, 0.62, 0.36);
  paint(c, '#6f747d');
  ell(c, 0.68, 0, 0.44, 0.42);
  paint(c, '#8e939c', '#5a5e66');
  c.beginPath();
  c.moveTo(0.88, -0.24);
  c.quadraticCurveTo(1.3, -0.14, 1.4, 0);
  c.quadraticCurveTo(1.3, 0.14, 0.88, 0.24);
  c.closePath();
  paint(c, '#c3c7ce', '#5a5e66');
  ell(c, 1.4, 0, 0.075, 0.075);
  paint(c, '#26282c');
  for (const s of [-1, 1]) {
    c.beginPath();
    c.moveTo(0.62, s * 0.12);
    c.lineTo(0.3, s * 0.42);
    c.lineTo(0.6, s * 0.4);
    c.closePath();
    paint(c, '#6f747d', '#4a4d54');
  }
  eyes(c, 0.88, 0.2, 0.07, '#d39a2a');
};

const bear: Draw = (c, t, mv) => {
  c.lineWidth = 0.06;
  feet(c, t, mv, 0.5, 0.72, 0.2, 0.15, '#5a3a27', '#3f281a', 7);
  ell(c, -0.05, 0, 1, 0.88);
  paint(c, '#6b4630', '#3f281a');
  c.strokeStyle = '#5a3a26';
  c.lineWidth = 0.05;
  for (const [x, y] of [[-0.5, -0.4], [-0.2, 0.45], [-0.6, 0.2], [0, -0.2], [-0.3, -0.05]] as const) {
    c.beginPath();
    c.arc(x, y, 0.14, 0.4, 2.6);
    c.stroke();
  }
  c.lineWidth = 0.06;
  for (const s of [-1, 1]) {
    ell(c, 0.55, s * 0.44, 0.16, 0.16);
    paint(c, '#7a5038', '#3f281a');
    ell(c, 0.56, s * 0.44, 0.08, 0.08);
    paint(c, '#4a2f1f');
  }
  ell(c, 0.72, 0, 0.5, 0.48);
  paint(c, '#7a5038', '#3f281a');
  ell(c, 1.08, 0, 0.25, 0.22);
  paint(c, '#b8916d', '#7d5d40');
  ell(c, 1.26, 0, 0.09, 0.08);
  paint(c, '#1e140d');
  eyes(c, 0.92, 0.22, 0.06);
};

const bison: Draw = (c, t, mv) => {
  c.lineWidth = 0.06;
  feet(c, t, mv, 0.5, 0.7, 0.19, 0.13, '#2f2219', '#1b130d', 7);
  c.strokeStyle = '#2c1f15';
  c.lineWidth = 0.05;
  c.beginPath();
  c.moveTo(-1.1, 0);
  c.lineTo(-1.35, Math.sin(t * 4) * 0.1);
  c.stroke();
  ell(c, -1.38, Math.sin(t * 4) * 0.1, 0.09, 0.07);
  paint(c, '#2c1f15');
  c.lineWidth = 0.06;
  ell(c, -0.2, 0, 0.95, 0.78);
  paint(c, '#4d3727', '#2c1f15');
  shag(c, 0.3, 0, 0.72, 0.82, 12, 0.14);
  paint(c, '#7d5c3f', '#4d3727');
  shag(c, 0.35, 0, 0.45, 0.55, 9, 0.18);
  paint(c, '#8f6b4a');
  c.lineWidth = 0.06;
  ell(c, 0.98, 0, 0.36, 0.33);
  paint(c, '#3a291d', '#1f150e');
  c.lineWidth = 0.12;
  c.lineCap = 'round';
  for (const s of [-1, 1]) {
    c.beginPath();
    c.moveTo(0.95, s * 0.22);
    c.quadraticCurveTo(0.98, s * 0.6, 1.24, s * 0.56);
    c.strokeStyle = '#e8e1d2';
    c.stroke();
  }
  c.lineWidth = 0.06;
  ell(c, 1.22, 0, 0.13, 0.17);
  paint(c, '#2a1d14');
  eyes(c, 1.08, 0.18, 0.055, '#120c08');
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

const draws: Draw[] = [beetle, frog, hare, hedgehog, boar, lynx, wolf, bear, bison, mammoth];

/** Draws tier `sp` at x, y with radius r, facing angle a. */
export function drawAnimal(c: Ctx, sp: number, x: number, y: number, r: number, a: number, t: number, mv: number, stretch = 1): void {
  c.save();
  c.translate(x, y);
  c.rotate(a);
  c.scale(r * stretch, r / Math.sqrt(stretch));
  c.lineJoin = 'round';
  (draws[sp] ?? beetle)(c, t, mv);
  c.restore();
}

/** The soft shadow under a creature, drawn before it. */
export function drawShadow(c: Ctx, x: number, y: number, r: number): void {
  ell(c, x + r * 0.12, y + r * 0.2, r * 1.08, r * 0.96);
  c.fillStyle = 'rgba(20,50,20,0.18)';
  c.fill();
}
