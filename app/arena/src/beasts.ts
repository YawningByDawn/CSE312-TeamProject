import { across, bodyLine, type Draw, ell, eyes, feet, flippers, glowEyes, paint, poly, serpent, shag, spine, stride, TAU, tail, tailFin, wings, type Ctx } from './shapes';

// The creatures that came with the biomes and the top tiers: the air line from the Meganeura to Quetzalcoatl, the
// fire-walkers of the Ashen Peaks, the beasts of Frostmarch and Mirewood, more of the sea, and the last myths. Each
// at a radius of 1, facing +x.

/** A giant on two legs, seen from above: a broad back, a head in front, and arms in three parts, shoulder to fist,
 * swinging as it walks. */
function giant(c: Ctx, t: number, mv: number, skin: string, dark: string, fur: string | null): void {
  const swing = Math.sin(t * 5) * 0.2 * (0.3 + mv);
  for (const s of [-1, 1]) {
    const step = Math.sin(t * 5 + (s > 0 ? Math.PI : 0)) * 0.22 * mv;
    ell(c, -0.45 + step, s * 0.3, 0.26, 0.15);
    paint(c, dark, dark);
  }
  for (const s of [-1, 1]) {
    const reach = s > 0 ? swing : -swing;
    ell(c, -0.05 + reach * 0.4, s * 0.86, 0.3, 0.17, s * -0.35);
    paint(c, fur ?? skin, dark);
    ell(c, 0.32 + reach, s * 0.92, 0.28, 0.15, s * 0.15);
    paint(c, fur ?? skin, dark);
    ell(c, 0.62 + reach, s * 0.86, 0.17, 0.16);
    paint(c, skin, dark);
    c.strokeStyle = dark; // knuckles
    c.lineWidth = 0.035;
    c.beginPath();
    for (const k of [-1, 0, 1]) {
      c.moveTo(0.7 + reach, s * 0.86 + k * 0.06);
      c.lineTo(0.78 + reach, s * 0.86 + k * 0.06);
    }
    c.stroke();
  }
  c.lineWidth = 0.05;
  if (fur) {
    shag(c, -0.15, 0, 0.55, 0.88, 18, 0.12);
    paint(c, fur, dark);
  } else {
    ell(c, -0.15, 0, 0.55, 0.88);
    paint(c, skin, dark);
  }
  c.strokeStyle = dark; // the spine down its back
  c.globalAlpha = 0.35;
  c.beginPath();
  c.moveTo(-0.6, 0);
  c.lineTo(0.15, 0);
  c.stroke();
  c.globalAlpha = 1;
  ell(c, 0.25, 0, 0.34, 0.32);
  paint(c, skin, dark);
}

/** Flames: tongues of fire round a body, flickering. */
function flames(c: Ctx, t: number, x: number, rx: number, ry: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const len = 0.25 + (Math.sin(t * 9 + i * 1.7) + 1) * 0.12;
    const bx = x + Math.cos(a) * rx;
    const by = Math.sin(a) * ry;
    c.beginPath();
    c.moveTo(bx + Math.sin(a) * 0.08, by - Math.cos(a) * 0.08);
    c.quadraticCurveTo(bx + Math.cos(a) * len * 0.6 + 0.06, by + Math.sin(a) * len * 0.6, bx + Math.cos(a) * len - 0.2, by + Math.sin(a) * len);
    c.lineTo(bx - Math.sin(a) * 0.08, by + Math.cos(a) * 0.08);
    c.closePath();
    c.fillStyle = i % 2 ? '#ffb02a' : '#ff6a1a';
    c.fill();
  }
}

// ---- the air line

const meganeura: Draw = (c, t) => {
  c.lineWidth = 0.04;
  for (const [x, len, k] of [[0.35, 1.55, 0], [-0.05, 1.45, 1]] as const) {
    for (const s of [-1, 1]) {
      const buzz = Math.sin(t * 40 + k * 2 + (s > 0 ? 0 : 1)) * 0.12;
      ell(c, x - 0.15, s * len * 0.52, 0.2, len * 0.5, s * (0.15 + buzz));
      paint(c, 'rgba(210,235,255,0.55)', 'rgba(120,150,180,0.8)');
      c.beginPath();
      c.moveTo(x - 0.15, s * 0.1);
      c.lineTo(x - 0.15 + s * buzz * 0.5, s * len * 0.98);
      c.strokeStyle = 'rgba(90,120,150,0.6)';
      c.stroke();
    }
  }
  c.lineWidth = 0.06;
  for (let i = 0; i < 8; i++) { // the long abdomen trails along its flight
    const p = spine(0.3 + i * 0.16);
    ell(c, p.x, p.y, 0.1, 0.08 - i * 0.004, p.a);
    paint(c, i % 2 ? '#2f6f7a' : '#3a8a94', '#1d4048');
  }
  ell(c, 0.3, 0, 0.3, 0.22);
  paint(c, '#3a8a94', '#1d4048');
  for (const s of [-1, 1]) {
    ell(c, 0.68, s * 0.15, 0.16, 0.16);
    paint(c, '#5fd0b8', '#1d4048');
  }
};

const archaeopteryx: Draw = (c, t, mv) => {
  c.lineWidth = 0.05;
  wings(c, t, 0.05, 1.45, '#2c4a6a', '#14263a', true);
  for (let k = -3; k <= 3; k++) {
    ell(c, -1, k * 0.1, 0.42, 0.08, k * 0.1);
    paint(c, k % 2 ? '#3a6a9a' : '#2c4a6a', '#14263a');
  }
  stride(c, t, mv, -0.05, 0.25, 0.14, 0.07, '#2a2a2a', '#111');
  ell(c, -0.05, 0, 0.55, 0.38);
  paint(c, '#3a6a9a', '#14263a');
  ell(c, 0.5, 0, 0.22, 0.17);
  paint(c, '#2c4a6a', '#14263a');
  poly(c, [[0.68, -0.08], [1.05, 0], [0.68, 0.08]]);
  paint(c, '#2a2a2a');
  eyes(c, 0.58, 0.1, 0.05, '#e8b030');
};

const pteranodon: Draw = (c, t) => {
  c.lineWidth = 0.05;
  wings(c, t, 0.1, 1.9, '#c8b49a', '#6e5a44', false);
  c.lineWidth = 0.06;
  ell(c, -0.05, 0, 0.45, 0.28);
  paint(c, '#d8c6a8', '#6e5a44');
  ell(c, 0.45, 0, 0.22, 0.17);
  paint(c, '#d8c6a8', '#6e5a44');
  poly(c, [[0.45, -0.07], [-0.35, -0.02], [-0.35, 0.02], [0.45, 0.07]]);
  paint(c, '#c8402e', '#7a2218');
  poly(c, [[0.6, -0.07], [1.45, 0], [0.6, 0.07]]);
  paint(c, '#e8c880', '#8a6a30');
  eyes(c, 0.52, 0.09, 0.04);
};

const pelagornis: Draw = (c, t) => {
  c.lineWidth = 0.05;
  wings(c, t * 0.6, 0.05, 2.2, '#8a96a6', '#3e4856', true);
  c.lineWidth = 0.06;
  ell(c, -0.5, 0, 0.35, 0.2);
  paint(c, '#d8dee6', '#3e4856');
  ell(c, -0.05, 0, 0.5, 0.32);
  paint(c, '#f4f6f8', '#3e4856');
  ell(c, 0.45, 0, 0.2, 0.16);
  paint(c, '#f4f6f8', '#3e4856');
  poly(c, [[0.6, -0.06], [1.3, -0.02], [1.35, 0.03], [0.6, 0.06]]);
  paint(c, '#e8b860', '#8a6a30');
  c.strokeStyle = '#fff';
  c.lineWidth = 0.03;
  c.beginPath();
  for (let x = 0.7; x < 1.25; x += 0.08) {
    c.moveTo(x, 0.04);
    c.lineTo(x + 0.02, 0.09);
  }
  c.stroke();
  eyes(c, 0.5, 0.09, 0.04);
};

const quetzalcoatlus: Draw = (c, t) => {
  c.lineWidth = 0.05;
  wings(c, t * 0.5, 0, 2, '#e8e2d6', '#5a4e44', false);
  c.lineWidth = 0.06;
  ell(c, -0.1, 0, 0.4, 0.26);
  paint(c, '#f0ece4', '#5a4e44');
  c.lineCap = 'round';
  c.strokeStyle = '#5a4e44';
  c.lineWidth = 0.18;
  c.beginPath();
  c.moveTo(0.2, 0);
  c.lineTo(0.85, Math.sin(t * 2) * 0.06);
  c.stroke();
  c.strokeStyle = '#f0ece4';
  c.lineWidth = 0.12;
  c.stroke();
  c.lineWidth = 0.05;
  ell(c, 0.9, 0, 0.18, 0.13);
  paint(c, '#c8402e', '#5a1a10');
  poly(c, [[0.98, -0.08], [1.75, 0], [0.98, 0.08]]);
  paint(c, '#2a2a2a', '#111');
  poly(c, [[0.85, -0.05], [0.55, 0], [0.85, 0.05]]);
  paint(c, '#c8402e');
  eyes(c, 0.94, 0.08, 0.035);
};

const argentavis: Draw = (c, t) => {
  c.lineWidth = 0.05;
  wings(c, t * 0.5, 0.05, 2.1, '#3a2e26', '#150f0a', true);
  c.lineWidth = 0.06;
  for (let k = -2; k <= 2; k++) {
    ell(c, -0.85, k * 0.12, 0.32, 0.1, k * 0.15);
    paint(c, '#2a2018', '#150f0a');
  }
  ell(c, -0.1, 0, 0.55, 0.4);
  paint(c, '#3a2e26', '#150f0a');
  shag(c, 0.35, 0, 0.24, 0.3, 8, 0.25);
  paint(c, '#f4f0e8', '#a8a090');
  ell(c, 0.6, 0, 0.2, 0.17);
  paint(c, '#d89a90', '#8a5a50');
  c.beginPath();
  c.moveTo(0.72, -0.08);
  c.quadraticCurveTo(1, -0.06, 1, 0.06);
  c.quadraticCurveTo(0.9, 0.04, 0.72, 0.08);
  paint(c, '#e8d8a0', '#8a7a40');
  eyes(c, 0.66, 0.1, 0.04);
};

const roc: Draw = (c, t) => {
  c.lineWidth = 0.05;
  wings(c, t * 0.45, 0.05, 2.2, '#c8902e', '#6a4410', true);
  c.lineWidth = 0.06;
  for (let k = -3; k <= 3; k++) {
    ell(c, -0.9, k * 0.1, 0.38, 0.09, k * 0.12);
    paint(c, k % 2 ? '#a87420' : '#c8902e', '#6a4410');
  }
  ell(c, -0.1, 0, 0.58, 0.42);
  paint(c, '#a87420', '#6a4410');
  ell(c, 0.55, 0, 0.26, 0.23);
  paint(c, '#fbf6ea', '#a89f8a');
  c.beginPath();
  c.moveTo(0.72, -0.1);
  c.quadraticCurveTo(1.08, -0.08, 1.1, 0.08);
  c.quadraticCurveTo(0.98, 0.05, 0.72, 0.1);
  paint(c, '#f0b832', '#a87a18');
  glowEyes(c, 0.64, 0.11, 0.045, '#ffcf4a');
};

const thunderbird: Draw = (c, t) => {
  c.lineWidth = 0.05;
  wings(c, t * 0.7, 0.05, 2.25, '#223a6a', '#0a1430', true);
  c.lineWidth = 0.05;
  for (const s of [-1, 1]) { // lightning along the wings
    c.beginPath();
    c.moveTo(0.1, s * 0.4);
    for (let k = 1; k <= 5; k++) c.lineTo(0.1 - k * 0.06 + (k % 2 ? 0.08 : -0.04), s * (0.4 + k * 0.3));
    c.strokeStyle = (Math.sin(t * 12) > 0.2 ? '#fff6a0' : '#ffd23a');
    c.lineWidth = 0.06;
    c.stroke();
  }
  c.lineWidth = 0.06;
  for (let k = -2; k <= 2; k++) {
    ell(c, -0.85, k * 0.12, 0.36, 0.1, k * 0.15);
    paint(c, '#2a4a80', '#0a1430');
  }
  ell(c, -0.1, 0, 0.55, 0.42);
  paint(c, '#2a4a80', '#0a1430');
  ell(c, 0.55, 0, 0.26, 0.23);
  paint(c, '#3a5a90', '#0a1430');
  for (const s of [-1, 1]) {
    poly(c, [[0.45, s * 0.12], [0.2, s * 0.35], [0.4, s * 0.18]]);
    paint(c, '#ffd23a');
  }
  poly(c, [[0.75, -0.08], [1.1, 0], [0.75, 0.08]]);
  paint(c, '#ffd23a', '#a87a18');
  glowEyes(c, 0.62, 0.11, 0.05, '#9fe8ff');
};

const phoenix: Draw = (c, t) => {
  c.lineWidth = 0.05;
  for (let k = -2; k <= 2; k++) { // tail plumes, each ending in an eyespot
    const sway = Math.sin(t * 3 + k) * 0.12;
    const ang = Math.PI + k * 0.22 + sway;
    const len = 1.35 - Math.abs(k) * 0.12;
    const ex = -0.45 + Math.cos(ang) * len;
    const ey = Math.sin(ang) * len;
    c.beginPath();
    c.moveTo(-0.45, 0);
    c.quadraticCurveTo(-0.45 + Math.cos(ang) * len * 0.5, Math.sin(ang) * len * 0.5 + sway * 0.3, ex, ey);
    c.strokeStyle = k % 2 ? '#ff9a2a' : '#ff6a1a';
    c.lineWidth = 0.09;
    c.stroke();
    c.lineWidth = 0.04;
    ell(c, ex, ey, 0.13, 0.09, ang);
    paint(c, '#ffd23a', '#c83a10');
    ell(c, ex, ey, 0.05, 0.05);
    paint(c, '#7a2a8a');
  }
  wings(c, t * 0.8, 0.05, 1.85, '#ff8a2a', '#b8340e', true);
  for (const s of [-1, 1]) { // flame tips along each wing
    for (let k = 0; k < 5; k++) {
      const f = Math.sin(t * 9 + k * 1.7 + s) * 0.06;
      const x = -0.05 - k * 0.14;
      const y = s * (1.6 - k * 0.22) * (0.88 + Math.sin(t * 5.6) * 0.12);
      c.beginPath();
      c.moveTo(x + 0.06, y - s * 0.02);
      c.quadraticCurveTo(x - 0.05, y + s * (0.18 + f), x - 0.12, y + s * (0.26 + f));
      c.quadraticCurveTo(x - 0.02, y + s * 0.08, x - 0.07, y - s * 0.02);
      c.closePath();
      c.fillStyle = k % 2 ? '#ffe27a' : '#ffb02a';
      c.fill();
    }
  }
  c.save();
  c.shadowColor = '#ff9a2a';
  c.shadowBlur = 6;
  ell(c, -0.1, 0, 0.5, 0.38);
  paint(c, '#ff8a2a', '#b8340e');
  c.restore();
  ell(c, -0.1, 0, 0.28, 0.2);
  paint(c, '#ffe27a');
  ell(c, 0.5, 0, 0.23, 0.19);
  paint(c, '#ffa02a', '#b8340e');
  for (let k = -2; k <= 2; k++) { // a crest of flames
    const f = Math.sin(t * 10 + k) * 0.05;
    poly(c, [[0.42, k * 0.05], [0.12 + f, k * 0.12], [0.36, k * 0.05 + 0.04]]);
    paint(c, k % 2 ? '#ffe27a' : '#ff6a1a');
  }
  poly(c, [[0.68, -0.07], [0.95, 0], [0.68, 0.07]]);
  paint(c, '#ffe27a', '#c87a10');
  glowEyes(c, 0.56, 0.09, 0.04, '#fff6c0');
};

const quetzalcoatl: Draw = (c, t, mv) => {
  for (const [span, fill, stroke] of [[1.55, '#2ab88a', '#0e6a4e'], [1.15, '#ffd23a', '#a87a18'], [0.8, '#e84a6a', '#8a1a34']] as const) {
    wings(c, t * 0.6, 0.35, span, fill, stroke, true); // rainbow layers: green, gold, red
  }
  const head = serpent(c, t, mv, -2, 0.95, 0.5, '#3cc890', '#106a50', 0.38);
  const line = bodyLine(head.pts);
  for (const p of line.slice(1, -2)) { // scales: a gold chevron on each segment
    c.beginPath();
    c.moveTo(...across(p, -0.12, -0.05));
    c.lineTo(...across(p, 0, 0.05));
    c.lineTo(...across(p, 0.12, -0.05));
    c.strokeStyle = '#ffd23a';
    c.lineWidth = 0.04;
    c.stroke();
  }
  c.save();
  c.translate(head.x, head.y);
  c.rotate(head.a);
  c.lineWidth = 0.05;
  for (const [k, color] of ['#e84a6a', '#ffd23a', '#2ab88a', '#5ab8ff', '#ffd23a', '#e84a6a'].entries()) { // a feathered ruff
    const a = Math.PI * 0.6 + (k / 5) * Math.PI * 0.8;
    ell(c, Math.cos(a) * 0.32, Math.sin(a) * 0.36, 0.16, 0.07, a);
    paint(c, color, '#0e6a4e');
  }
  ell(c, 0.15, 0, 0.32, 0.24);
  paint(c, '#3cc890', '#106a50');
  poly(c, [[0.4, -0.06], [0.62, 0], [0.4, 0.06]]);
  paint(c, '#ffd23a');
  glowEyes(c, 0.22, 0.13, 0.05, '#fff6a0');
  c.restore();
};

// ---- fire-walkers of the Ashen Peaks

const salamander: Draw = (c, t, mv) => {
  c.lineWidth = 0.06;
  tail(c, t, mv, -0.55, 1.1, 0.4, '#2a2420', '#0f0c0a', 0.4);
  feet(c, t, mv, 0.42, 0.5, 0.13, 0.09, '#2a2420', '#0f0c0a', 12);
  ell(c, 0, 0, 0.7, 0.42);
  paint(c, '#2a2420', '#0f0c0a');
  c.save();
  c.shadowColor = '#ff8a2a';
  c.shadowBlur = 6;
  for (const [x, y, r] of [[-0.35, -0.2, 0.1], [-0.1, 0.22, 0.09], [0.2, -0.15, 0.08], [-0.55, 0.12, 0.07], [0.35, 0.18, 0.06]] as const) {
    ell(c, x, y, r, r * 0.8);
    paint(c, (Math.sin(t * 4 + x * 9) > 0 ? '#ffb02a' : '#ff7a1a'));
  }
  c.restore();
  ell(c, 0.72, 0, 0.3, 0.26);
  paint(c, '#2a2420', '#0f0c0a');
  eyes(c, 0.82, 0.16, 0.06, '#ffd23a');
};

const dimetrodon: Draw = (c, t, mv) => {
  c.lineWidth = 0.06;
  tail(c, t, mv, -0.6, 1, 0.38, '#6a7a5a', '#3a4430', 0.35);
  feet(c, t, mv, 0.45, 0.55, 0.15, 0.1, '#5a6a4a', '#3a4430', 9);
  ell(c, 0, 0, 0.78, 0.48);
  paint(c, '#6a7a5a', '#3a4430');
  // the sail, seen from above: a striped fan along the spine
  c.beginPath();
  c.moveTo(0.55, 0);
  c.bezierCurveTo(0.2, -0.3, -0.5, -0.28, -0.75, 0);
  c.bezierCurveTo(-0.5, 0.28, 0.2, 0.3, 0.55, 0);
  paint(c, '#d8602e', '#7a2e12');
  c.strokeStyle = '#ffd08a';
  c.lineWidth = 0.035;
  for (let x = -0.65; x < 0.5; x += 0.1) {
    c.beginPath();
    c.moveTo(x, -0.2 * Math.sin(((x + 0.75) / 1.3) * Math.PI));
    c.lineTo(x, 0.2 * Math.sin(((x + 0.75) / 1.3) * Math.PI));
    c.stroke();
  }
  c.lineWidth = 0.06;
  ell(c, 0.78, 0, 0.32, 0.26);
  paint(c, '#7a8a6a', '#3a4430');
  for (const s of [-1, 1]) {
    poly(c, [[1.02, s * 0.1], [1.12, s * 0.04], [1.06, s * 0.18]]);
    paint(c, '#f4efdf');
  }
  eyes(c, 0.85, 0.16, 0.055, '#e0a020');
};

// ---- Mirewood

const diplocaulus: Draw = (c, t, mv) => {
  c.lineWidth = 0.06;
  const tip = tail(c, t, mv, -0.45, 1, 0.32, '#6f8044', '#4a5428', 0.45);
  ell(c, tip.x, tip.y, 0.2, 0.08, tip.a);
  paint(c, '#7a8a4a', '#4a5428');
  feet(c, t, mv, 0.2, 0.36, 0.11, 0.08, '#6a7a3a', '#4a5428', 10);
  ell(c, -0.1, 0, 0.55, 0.32);
  paint(c, '#7a8a4a', '#4a5428');
  for (const [x, y] of [[-0.35, -0.12], [-0.1, 0.14], [-0.45, 0.1], [0.05, -0.1]] as const) {
    ell(c, x, y, 0.05, 0.04);
    paint(c, '#5a6a30');
  }
  // the boomerang head: wide and flat, its horns sweeping back past its shoulders
  c.beginPath();
  c.moveTo(0.95, 0);
  c.bezierCurveTo(0.92, -0.35, 0.55, -0.7, -0.05, -1.05);
  c.bezierCurveTo(0.2, -0.75, 0.35, -0.45, 0.3, -0.2);
  c.quadraticCurveTo(0.35, 0, 0.3, 0.2);
  c.bezierCurveTo(0.35, 0.45, 0.2, 0.75, -0.05, 1.05);
  c.bezierCurveTo(0.55, 0.7, 0.92, 0.35, 0.95, 0);
  paint(c, '#8a9a58', '#4a5428');
  c.strokeStyle = 'rgba(74,84,40,0.5)';
  c.lineWidth = 0.035;
  for (const s of [-1, 1]) { // ridges along each horn
    c.beginPath();
    c.moveTo(0.7, s * 0.15);
    c.quadraticCurveTo(0.45, s * 0.55, 0.05, s * 0.95);
    c.stroke();
  }
  c.lineWidth = 0.06;
  eyes(c, 0.72, 0.12, 0.05, '#e8d040');
};

const sarcosuchus: Draw = (c, t, mv) => {
  c.lineWidth = 0.06;
  tail(c, t, mv, -0.55, 1.2, 0.5, '#5a6a3a', '#2f3a1c', 0.3);
  feet(c, t, mv, 0.4, 0.55, 0.16, 0.1, '#4a5a2c', '#2f3a1c', 8);
  ell(c, -0.05, 0, 0.75, 0.48);
  paint(c, '#5a6a3a', '#2f3a1c');
  for (const y of [-0.18, 0.18]) {
    for (let x = -0.6; x < 0.55; x += 0.16) {
      ell(c, x, y, 0.06, 0.06);
      paint(c, '#3f4a28');
    }
  }
  c.beginPath();
  c.moveTo(0.6, -0.26);
  c.lineTo(1.5, -0.14);
  c.quadraticCurveTo(1.72, 0, 1.5, 0.14);
  c.lineTo(0.6, 0.26);
  paint(c, '#6a7a44', '#2f3a1c');
  ell(c, 1.62, 0, 0.12, 0.14);
  paint(c, '#7a8a50', '#2f3a1c');
  for (const s of [-1, 1]) {
    for (let x = 0.75; x < 1.5; x += 0.12) {
      poly(c, [[x, s * 0.19], [x + 0.04, s * 0.12], [x + 0.08, s * 0.19]]);
      paint(c, '#f4efdf');
    }
  }
  eyes(c, 0.72, 0.17, 0.055, '#e0c040');
};

// ---- Frostmarch

const woollyRhino: Draw = (c, t, mv) => {
  c.lineWidth = 0.06;
  feet(c, t, mv, 0.48, 0.66, 0.18, 0.13, '#5a3e2a', '#3a2618', 7);
  shag(c, -0.1, 0, 0.98, 0.78, 18, 0.1);
  paint(c, '#8a6a4a', '#4a3220');
  c.strokeStyle = 'rgba(240,248,255,0.55)';
  c.lineWidth = 0.05;
  for (let i = 0; i < 7; i++) {
    const y = -0.5 + i * 0.16;
    c.beginPath();
    c.moveTo(-0.7, y);
    c.quadraticCurveTo(-0.2, y + 0.05, 0.25, y);
    c.stroke();
  }
  c.lineWidth = 0.06;
  ell(c, 0.72, 0, 0.36, 0.32);
  paint(c, '#7a5a3a', '#4a3220');
  for (const s of [-1, 1]) {
    ell(c, 0.55, s * 0.3, 0.08, 0.06);
    paint(c, '#5a3e2a');
  }
  c.beginPath();
  c.moveTo(0.95, -0.12);
  c.quadraticCurveTo(1.55, -0.05, 1.5, 0);
  c.quadraticCurveTo(1.55, 0.05, 0.95, 0.12);
  paint(c, '#e8dcc0', '#a89a78');
  poly(c, [[0.88, -0.07], [1.08, 0], [0.88, 0.07]]);
  paint(c, '#d8ccb0', '#a89a78');
  eyes(c, 0.78, 0.2, 0.045);
};

const caveBear: Draw = (c, t, mv) => {
  c.lineWidth = 0.06;
  feet(c, t, mv, 0.5, 0.72, 0.2, 0.15, '#4a4038', '#2a241e', 7);
  shag(c, -0.05, 0, 1.02, 0.9, 20, 0.07);
  paint(c, '#6a5e52', '#2a241e');
  c.strokeStyle = 'rgba(235,245,255,0.5)';
  c.lineWidth = 0.05;
  for (const [x, y] of [[-0.5, -0.4], [-0.2, 0.45], [-0.6, 0.2], [0, -0.2], [-0.3, -0.05]] as const) {
    c.beginPath();
    c.arc(x, y, 0.14, 0.4, 2.6);
    c.stroke();
  }
  c.lineWidth = 0.06;
  for (const s of [-1, 1]) {
    ell(c, 0.56, s * 0.46, 0.16, 0.16);
    paint(c, '#7a6e62', '#2a241e');
  }
  ell(c, 0.74, 0, 0.54, 0.5);
  paint(c, '#7a6e62', '#2a241e');
  ell(c, 1.12, 0, 0.26, 0.23);
  paint(c, '#a89a8a', '#5a4e42');
  ell(c, 1.3, 0, 0.09, 0.08);
  paint(c, '#1e1812');
  eyes(c, 0.92, 0.23, 0.06);
};

const yeti: Draw = (c, t, mv) => {
  c.lineWidth = 0.06;
  giant(c, t, mv, '#9ab4c8', '#4a6478', '#f4f8fc');
  for (const s of [-1, 1]) {
    poly(c, [[0.18, s * 0.22], [-0.05, s * 0.48], [0.1, s * 0.16]]);
    paint(c, '#c8d8e4', '#4a6478');
  }
  glowEyes(c, 0.42, 0.13, 0.05, '#7ff0ff');
};

const fenrir: Draw = (c, t, mv) => {
  c.lineWidth = 0.06;
  feet(c, t, mv, 0.52, 0.62, 0.18, 0.12, '#2a2e36', '#14161a', 10);
  const sway = Math.sin(t * 5) * 0.12 * (0.3 + mv);
  ell(c, -1.3, sway, 0.55, 0.24, sway * 0.5);
  paint(c, '#3a3e48', '#14161a');
  shag(c, -0.1, 0, 1.05, 0.72, 16, 0.12);
  paint(c, '#3a3e48', '#14161a');
  shag(c, 0.45, 0, 0.45, 0.62, 10, 0.2);
  paint(c, '#c8d4e4', '#5a6478');
  c.save();
  c.shadowColor = '#7fd0ff';
  c.shadowBlur = 6;
  c.strokeStyle = '#9fe0ff';
  c.lineWidth = 0.04;
  for (const x of [-0.6, -0.3, 0]) {
    c.beginPath();
    c.moveTo(x, -0.25);
    c.lineTo(x + 0.08, -0.05);
    c.lineTo(x - 0.04, 0.05);
    c.lineTo(x + 0.06, 0.25);
    c.stroke();
  }
  c.restore();
  c.lineWidth = 0.06;
  ell(c, 0.75, 0, 0.45, 0.42);
  paint(c, '#3a3e48', '#14161a');
  c.beginPath();
  c.moveTo(0.95, -0.24);
  c.quadraticCurveTo(1.4, -0.14, 1.5, 0);
  c.quadraticCurveTo(1.4, 0.14, 0.95, 0.24);
  paint(c, '#4a4e58', '#14161a');
  for (const s of [-1, 1]) {
    poly(c, [[0.65, s * 0.14], [0.32, s * 0.46], [0.65, s * 0.42]]);
    paint(c, '#2a2e36', '#14161a');
  }
  glowEyes(c, 0.95, 0.2, 0.065, '#7ff0ff');
};

const jotunn: Draw = (c, t, mv) => {
  c.lineWidth = 0.06;
  giant(c, t, mv, '#7aa4c8', '#2e4a64', null);
  for (const s of [-1, 1]) { // ice on the shoulders
    for (let k = 0; k < 3; k++) {
      const x = -0.15 + k * 0.18;
      poly(c, [[x - 0.08, s * 0.55], [x, s * (0.85 + k * 0.05)], [x + 0.08, s * 0.55]]);
      paint(c, '#e8f6ff', '#7aa4c8');
    }
  }
  ell(c, 0.25, 0, 0.36, 0.34);
  paint(c, '#8ab4d8', '#2e4a64');
  for (const s of [-1, 1]) {
    c.beginPath();
    c.moveTo(0.2, s * 0.28);
    c.quadraticCurveTo(0.1, s * 0.6, -0.2, s * 0.58);
    c.lineWidth = 0.09;
    c.strokeStyle = '#e8dcc0';
    c.stroke();
  }
  c.lineWidth = 0.06;
  glowEyes(c, 0.42, 0.13, 0.05, '#bff8ff');
};

const ymir: Draw = (c, t, mv) => {
  c.lineWidth = 0.06;
  giant(c, t, mv, '#8a8478', '#3a362e', null);
  // craggy stone and ice
  for (const [x, y, r, ice] of [[-0.3, -0.4, 0.18, false], [0.05, 0.45, 0.16, true], [-0.45, 0.25, 0.15, false], [0.1, -0.2, 0.14, true], [-0.15, 0.05, 0.16, false]] as const) {
    poly(c, [[x - r, y], [x - r * 0.3, y - r], [x + r, y - r * 0.4], [x + r * 0.6, y + r], [x - r * 0.5, y + r * 0.8]]);
    paint(c, ice ? '#d8f0ff' : '#6a645a', '#3a362e');
  }
  ell(c, 0.25, 0, 0.38, 0.36);
  paint(c, '#9a9488', '#3a362e');
  for (let k = 0; k < 5; k++) { // an ice crown
    const a = Math.PI * 0.6 + k * Math.PI * 0.2;
    const x = 0.2 + Math.cos(a) * 0.32;
    const y = Math.sin(a) * 0.3;
    poly(c, [[x - Math.sin(a) * 0.06, y + Math.cos(a) * 0.06], [x + Math.cos(a) * 0.22, y + Math.sin(a) * 0.22], [x + Math.sin(a) * 0.06, y - Math.cos(a) * 0.06]]);
    paint(c, '#bff0ff', '#5a9ab8');
  }
  glowEyes(c, 0.45, 0.14, 0.055, '#9ff4ff');
};

const frostWyrm: Draw = (c, t, mv) => {
  c.lineWidth = 0.06;
  feet(c, t, mv, 0.35, 0.42, 0.14, 0.1, '#8ab0cc', '#3a5a74', 8);
  const head = serpent(c, t, mv, -1.9, 0.9, 0.58, '#7aaed0', '#1e4460', 0.3);
  for (const [x, y] of head.pts.slice(2, -2)) { // ice spikes down its back
    poly(c, [[x - 0.08, y], [x + 0.03, y - 0.18], [x + 0.1, y], [x + 0.03, y + 0.18]]);
    paint(c, '#ffffff', '#3a7aa8');
  }
  c.save();
  c.translate(head.x, head.y);
  c.rotate(head.a);
  c.lineWidth = 0.05;
  for (const s of [-1, 1]) {
    poly(c, [[0.05, s * 0.18], [-0.35, s * 0.4], [0, s * 0.25]]);
    paint(c, '#e8f8ff', '#7ab4d8');
  }
  for (const s of [-1, 1]) {
    c.beginPath();
    c.moveTo(0.05, s * 0.15);
    c.quadraticCurveTo(-0.2, s * 0.35, -0.45, s * 0.3);
    c.lineWidth = 0.08;
    c.strokeStyle = '#e8f8ff';
    c.stroke();
  }
  c.lineWidth = 0.05;
  ell(c, 0.18, 0, 0.4, 0.28);
  paint(c, '#9ac8e4', '#1e4460');
  c.save();
  c.globalAlpha = 0.5 + Math.sin(t * 6) * 0.2;
  ell(c, 0.65, 0, 0.18, 0.1);
  paint(c, '#dff8ff');
  c.restore();
  glowEyes(c, 0.28, 0.15, 0.05, '#7ff0ff');
  c.restore();
};

// ---- the sea

const ichthyosaur: Draw = (c, t, mv) => {
  c.lineWidth = 0.06;
  const sway = Math.sin(t * 6) * 0.18 * (0.4 + mv);
  c.save();
  c.translate(-0.9, 0);
  c.rotate(sway);
  tailFin(c, 0, 0.6, '#4a6a8a', '#24384c');
  c.restore();
  flippers(c, t, mv, 0.3, 0.32, 0.45, '#4a6a8a', '#24384c');
  flippers(c, t + 1, mv, -0.35, 0.28, 0.32, '#4a6a8a', '#24384c');
  c.beginPath();
  c.moveTo(0.85, 0);
  c.quadraticCurveTo(0.6, -0.42, -0.1, -0.38);
  c.quadraticCurveTo(-0.75, -0.3, -0.95, 0);
  c.quadraticCurveTo(-0.75, 0.3, -0.1, 0.38);
  c.quadraticCurveTo(0.6, 0.42, 0.85, 0);
  paint(c, '#5a7a9a', '#24384c');
  poly(c, [[0.1, 0], [-0.4, -0.06], [-0.4, 0.06]]);
  paint(c, '#3e5a76');
  poly(c, [[0.8, -0.07], [1.5, -0.02], [1.5, 0.02], [0.8, 0.07]]);
  paint(c, '#6a8aaa', '#24384c');
  eyes(c, 0.62, 0.2, 0.1, '#101820');
};

const livyatan: Draw = (c, t, mv) => {
  c.lineWidth = 0.06;
  const sway = Math.sin(t * 3) * 0.2 * (0.4 + mv);
  c.save();
  c.translate(-1.05, 0);
  c.rotate(sway);
  c.beginPath(); // flukes lie flat: seen from above, a wide fan
  c.moveTo(0.1, 0);
  c.quadraticCurveTo(-0.2, -0.2, -0.35, -0.6);
  c.quadraticCurveTo(-0.15, -0.1, -0.35, 0);
  c.quadraticCurveTo(-0.15, 0.1, -0.35, 0.6);
  c.quadraticCurveTo(-0.2, 0.2, 0.1, 0);
  paint(c, '#3a4048', '#1a1e22');
  c.restore();
  flippers(c, t, mv, 0.15, 0.4, 0.45, '#3a4048', '#1a1e22');
  c.beginPath();
  c.moveTo(1.1, -0.42);
  c.lineTo(1.1, 0.42);
  c.quadraticCurveTo(0.2, 0.62, -1.05, 0.08);
  c.lineTo(-1.05, -0.08);
  c.quadraticCurveTo(0.2, -0.62, 1.1, -0.42);
  paint(c, '#4a5058', '#1a1e22');
  c.strokeStyle = '#3a4048';
  for (let x = -0.6; x < 0.5; x += 0.15) {
    c.beginPath();
    c.moveTo(x, -0.35);
    c.quadraticCurveTo(x + 0.05, 0, x, 0.35);
    c.stroke();
  }
  for (const s of [-1, 1]) {
    for (let x = 0.55; x < 1.08; x += 0.1) {
      poly(c, [[x, s * 0.42], [x + 0.05, s * 0.32], [x + 0.1, s * 0.42]]);
      paint(c, '#f4efdf');
    }
  }
  eyes(c, 0.55, 0.36, 0.05);
};

const jormungandr: Draw = (c, t, mv) => {
  const head = serpent(c, t, mv, -2.2, 0.9, 0.85, '#2a5a3a', '#0f2a18', 0.36);
  c.save();
  c.shadowColor = '#6aff9a';
  c.shadowBlur = 8;
  for (const p of bodyLine(head.pts).filter((_, i) => i % 2 === 1).slice(0, -1)) {
    c.strokeStyle = '#8affb0';
    c.lineWidth = 0.05;
    c.beginPath(); // runes, pointing the way it goes
    c.moveTo(...across(p, -0.12, -0.06));
    c.lineTo(...across(p, 0, 0.06));
    c.lineTo(...across(p, 0.12, -0.06));
    c.stroke();
  }
  c.restore();
  c.save();
  c.translate(head.x, head.y);
  c.rotate(head.a);
  c.lineWidth = 0.05;
  for (const s of [-1, 1]) {
    c.beginPath();
    c.moveTo(0.05, s * 0.22);
    c.quadraticCurveTo(-0.2, s * 0.5, -0.5, s * 0.45);
    c.lineWidth = 0.1;
    c.strokeStyle = '#d8c898';
    c.stroke();
  }
  ell(c, 0.2, 0, 0.48, 0.36);
  paint(c, '#34704a', '#0f2a18');
  for (const s of [-1, 1]) {
    for (let x = 0.2; x < 0.65; x += 0.1) {
      poly(c, [[x, s * 0.3], [x + 0.05, s * 0.2], [x + 0.1, s * 0.3]]);
      paint(c, '#f4efdf');
    }
  }
  glowEyes(c, 0.32, 0.2, 0.065, '#b0ff6a');
  c.restore();
};

const tiamat: Draw = (c, t, mv) => {
  c.lineWidth = 0.06;
  tail(c, t, mv, -0.6, 1.2, 0.55, '#4a2a6a', '#1e0f30', 0.4);
  flippers(c, t, mv, 0.1, 0.55, 0.6, '#3a6a8a', '#1e0f30');
  ell(c, -0.1, 0, 0.85, 0.7);
  paint(c, '#4a2a6a', '#1e0f30');
  for (let i = 0; i < 7; i++) {
    poly(c, [[-0.7 + i * 0.2, 0], [-0.62 + i * 0.2, -0.1], [-0.55 + i * 0.2, 0], [-0.62 + i * 0.2, 0.1]]);
    paint(c, '#6ad8e8');
  }
  c.lineCap = 'round';
  const heads: [number, string][] = [[-0.9, '#6a3a9a'], [-0.45, '#3a8aa8'], [0, '#8a3aa8'], [0.45, '#3a8aa8'], [0.9, '#6a3a9a']];
  for (const [k, [ang, color]] of heads.entries()) {
    const sway = Math.sin(t * 2.5 + k * 1.3) * 0.15;
    const hx = 0.35 + Math.cos(ang + sway) * 1.05;
    const hy = Math.sin(ang + sway) * 1.05;
    for (const [col, w] of [['#1e0f30', 0.24], [color, 0.16]] as const) {
      c.strokeStyle = col;
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
    ell(c, 0.08, 0, 0.22, 0.15);
    paint(c, color, '#1e0f30');
    glowEyes(c, 0.12, 0.08, 0.035, '#ff6ad8');
    c.restore();
  }
};

export const BEASTS: Record<string, Draw> = {
  Meganeura: meganeura,
  Archaeopteryx: archaeopteryx,
  Salamander: salamander,
  Diplocaulus: diplocaulus,
  Pteranodon: pteranodon,
  Dimetrodon: dimetrodon,
  Pelagornis: pelagornis,
  'Woolly Rhino': woollyRhino,
  Ichthyosaur: ichthyosaur,
  Quetzalcoatlus: quetzalcoatlus,
  Sarcosuchus: sarcosuchus,
  Argentavis: argentavis,
  'Cave Bear': caveBear,
  Livyatan: livyatan,
  Yeti: yeti,
  Roc: roc,
  Fenrir: fenrir,
  Thunderbird: thunderbird,
  Jotunn: jotunn,
  Jormungandr: jormungandr,
  Phoenix: phoenix,
  'Frost Wyrm': frostWyrm,
  Tiamat: tiamat,
  Quetzalcoatl: quetzalcoatl,
  Ymir: ymir,
};

export const BEAST_COLOR: Record<string, string> = {
  Meganeura: '#3a8a94', Archaeopteryx: '#3a6a9a', Salamander: '#ff8a2a', Diplocaulus: '#7a8a4a', Pteranodon: '#c8b49a',
  Dimetrodon: '#d8602e', Pelagornis: '#d8dee6', 'Woolly Rhino': '#8a6a4a', Ichthyosaur: '#5a7a9a', Quetzalcoatlus: '#e8e2d6',
  Sarcosuchus: '#5a6a3a', Argentavis: '#3a2e26', 'Cave Bear': '#6a5e52', Livyatan: '#4a5058', Yeti: '#f4f8fc', Roc: '#c8902e',
  Fenrir: '#3a3e48', Thunderbird: '#2a4a80', Jotunn: '#7aa4c8', Jormungandr: '#2a5a3a', Phoenix: '#ff8a2a',
  'Frost Wyrm': '#a8cce4', Tiamat: '#4a2a6a', Quetzalcoatl: '#3cc890', Ymir: '#8a8478',
};
