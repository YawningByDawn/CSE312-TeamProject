import type { Circle, Source, World } from './types';

// The world: grass, the beach, the sea and its islands, ponds and tar pits, rocks and reefs, ferns and kelp, the
// places food grows, and food. All in world units, on a context the view has moved.

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

/** A small seeded random, so each bush and pond looks the same every frame and for everyone. */
function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

let grass: CanvasPattern | null = null;

function grassPattern(c: Ctx): CanvasPattern {
  if (grass) return grass;
  const tile = document.createElement('canvas');
  tile.width = tile.height = 384;
  const g = tile.getContext('2d')!;
  g.fillStyle = '#a5d17f';
  g.fillRect(0, 0, 384, 384);
  const rnd = seeded(7);
  for (let i = 0; i < 26; i++) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(140,196,104,0.5)' : 'rgba(185,224,146,0.5)';
    g.beginPath();
    g.ellipse(rnd() * 384, rnd() * 384, 20 + rnd() * 40, 14 + rnd() * 26, rnd() * TAU, 0, TAU);
    g.fill();
  }
  g.lineCap = 'round';
  g.lineWidth = 2;
  for (let i = 0; i < 140; i++) {
    const x = rnd() * 384;
    const y = rnd() * 384;
    g.strokeStyle = rnd() < 0.6 ? '#8cbf68' : '#bfe39b';
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x - 3 + rnd() * 2, y - 7 - rnd() * 4);
    g.moveTo(x + 2, y);
    g.lineTo(x + 4 + rnd() * 2, y - 6 - rnd() * 4);
    g.stroke();
  }
  for (let i = 0; i < 18; i++) {
    const x = rnd() * 384;
    const y = rnd() * 384;
    const col = ['#fff8e6', '#ffe27a', '#f7b6d2', '#c9b8ff'][Math.floor(rnd() * 4)]!;
    for (let p = 0; p < 5; p++) {
      g.fillStyle = col;
      g.beginPath();
      g.arc(x + Math.cos((p * TAU) / 5) * 2.6, y + Math.sin((p * TAU) / 5) * 2.6, 2, 0, TAU);
      g.fill();
    }
    g.fillStyle = '#f2a93b';
    g.beginPath();
    g.arc(x, y, 1.6, 0, TAU);
    g.fill();
  }
  return (grass = c.createPattern(tile, 'repeat')!);
}

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const touches = (o: Circle, v: Rect, pad = 0): boolean => o.x + o.r + pad > v.x0 && o.x - o.r - pad < v.x1 && o.y + o.r + pad > v.y0 && o.y - o.r - pad < v.y1;

/** The coastline's points, x east at y, from the top of the world to the bottom. */
function coastPoints(w: World): [number, number][] {
  return w.coast.map((x, i) => [x, i * w.coastStep]);
}

export function drawGround(c: Ctx, w: World | null, v: Rect, t: number): void {
  c.fillStyle = '#4f7d45';
  c.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
  const W = w?.w ?? 1e6;
  const H = w?.h ?? 1e6;
  const x0 = Math.max(0, v.x0);
  const y0 = Math.max(0, v.y0);
  c.fillStyle = grassPattern(c);
  c.fillRect(x0, y0, Math.min(W, v.x1) - x0, Math.min(H, v.y1) - y0);
  if (!w) return;
  const pts = coastPoints(w);
  if (Math.max(...w.coast) - 160 < v.x1) {
    // the beach, a band of sand west of the waterline, then the sea
    const band = (shift: number, fill: string | CanvasGradient): void => {
      c.beginPath();
      for (const [x, y] of pts) c.lineTo(x - shift, y);
      c.lineTo(W, H + w.coastStep);
      c.lineTo(W, 0);
      c.closePath();
      c.fillStyle = fill;
      c.fill();
    };
    band(130, '#e8d6a2');
    band(40, '#d8c287');
    const deep = c.createLinearGradient(Math.min(...w.coast), 0, W, 0);
    deep.addColorStop(0, '#6cc2dc');
    deep.addColorStop(0.25, '#3c93c0');
    deep.addColorStop(1, '#1d5f8f');
    band(0, deep);
    for (const isl of w.islands) {
      if (!touches(isl, v, 160)) continue;
      for (const [grow, fill] of [[110, 'rgba(255,255,255,0.35)'], [70, '#e8d6a2'], [40, '#d8c287'], [0, '']] as const) {
        c.beginPath();
        c.arc(isl.x, isl.y, isl.r + grow, 0, TAU);
        if (fill) {
          c.fillStyle = fill;
          c.fill();
        } else {
          c.save();
          c.clip();
          c.fillStyle = grassPattern(c);
          c.fillRect(isl.x - isl.r, isl.y - isl.r, isl.r * 2, isl.r * 2);
          c.restore();
        }
      }
    }
    // surf: lines that roll in to the shore
    c.lineWidth = 5;
    c.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      const phase = (t * 0.22 + k / 3) % 1;
      c.strokeStyle = `rgba(255,255,255,${0.55 * (1 - phase)})`;
      c.beginPath();
      for (const [x, y] of pts) c.lineTo(x + 18 + (1 - phase) * 70 + Math.sin(y / 80 + t) * 6, y);
      c.stroke();
    }
    c.strokeStyle = 'rgba(255,255,255,0.75)';
    c.lineWidth = 4;
    c.beginPath();
    for (const [x, y] of pts) c.lineTo(x + 2, y);
    c.stroke();
  }
  c.strokeStyle = '#3f6b37';
  c.lineWidth = 18;
  c.setLineDash([26, 18]);
  c.strokeRect(-9, -9, W + 18, H + 18);
  c.setLineDash([]);
}

export function drawPonds(c: Ctx, ponds: Circle[], v: Rect, t: number): void {
  for (const [i, p] of ponds.entries()) {
    if (!touches(p, v, 30)) continue;
    c.beginPath();
    c.arc(p.x, p.y, p.r + 12, 0, TAU);
    c.fillStyle = '#d8c891';
    c.fill();
    const g = c.createRadialGradient(p.x - p.r * 0.2, p.y - p.r * 0.2, p.r * 0.1, p.x, p.y, p.r);
    g.addColorStop(0, '#79c3e0');
    g.addColorStop(1, '#3f90bd');
    c.beginPath();
    c.arc(p.x, p.y, p.r, 0, TAU);
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.35)';
    c.lineWidth = 3;
    for (let k = 0; k < 2; k++) {
      const phase = (t * 0.25 + k * 0.5 + i * 0.13) % 1;
      c.globalAlpha = 1 - phase;
      c.beginPath();
      c.arc(p.x + p.r * 0.2, p.y - p.r * 0.15, p.r * (0.15 + phase * 0.4), 0, TAU);
      c.stroke();
    }
    c.globalAlpha = 1;
    const rnd = seeded(1000 + i);
    for (let k = 0; k < 4; k++) {
      const a = rnd() * TAU;
      const d = p.r * (0.45 + rnd() * 0.4);
      const x = p.x + Math.cos(a) * d;
      const y = p.y + Math.sin(a) * d;
      const r = 12 + rnd() * 10;
      const notch = rnd() * TAU;
      c.beginPath();
      c.moveTo(x, y);
      c.arc(x, y, r, notch + 0.5, notch + TAU - 0.1);
      c.closePath();
      c.fillStyle = '#5aa04a';
      c.fill();
      if (rnd() < 0.5) {
        c.beginPath();
        c.arc(x + 3, y - 3, 4, 0, TAU);
        c.fillStyle = '#f6c5dc';
        c.fill();
      }
    }
  }
}

/** Tar pits, rocks and reefs, and the places food grows: all under the creatures, which walk on them. */
export function drawTerrain(c: Ctx, w: World, v: Rect, t: number): void {
  for (const [i, p] of w.tar.entries()) {
    if (!touches(p, v, 20)) continue;
    const rnd = seeded(300 + i);
    c.beginPath();
    for (let k = 0; k <= 24; k++) {
      const a = (k / 24) * TAU;
      const r = p.r * (0.92 + Math.sin(a * 3 + i) * 0.05 + rnd() * 0.04);
      c.lineTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
    }
    c.closePath();
    c.fillStyle = '#2a2018';
    c.fill();
    c.strokeStyle = '#6b5a3a';
    c.lineWidth = 8;
    c.stroke();
    c.beginPath();
    c.ellipse(p.x - p.r * 0.25, p.y - p.r * 0.3, p.r * 0.35, p.r * 0.12, -0.4, 0, TAU);
    c.fillStyle = 'rgba(255,255,255,0.08)';
    c.fill();
    for (let b = 0; b < 4; b++) {
      const phase = (t * 0.5 + b * 0.27 + i * 0.1) % 1;
      const a = rnd() * TAU;
      const d = rnd() * p.r * 0.7;
      c.beginPath();
      c.arc(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 4 + phase * 9, 0, TAU);
      c.strokeStyle = `rgba(120,100,70,${0.6 * (1 - phase)})`;
      c.lineWidth = 2;
      c.stroke();
    }
  }
  for (const [set, sea] of [[w.rocks, false], [w.reefs, true]] as const) {
    for (const [i, k] of set.entries()) {
      if (!touches(k, v, 20)) continue;
      const rnd = seeded((sea ? 700 : 500) + i);
      c.beginPath();
      c.ellipse(k.x + 10, k.y + 14, k.r * 1.02, k.r * 0.95, 0, 0, TAU);
      c.fillStyle = sea ? 'rgba(10,40,70,0.25)' : 'rgba(20,40,20,0.25)';
      c.fill();
      // a lumpy outline, a flat top, and cracks
      c.beginPath();
      for (let n = 0; n <= 16; n++) {
        const a = (n / 16) * TAU;
        const r = k.r * (0.9 + rnd() * 0.12);
        c.lineTo(k.x + Math.cos(a) * r, k.y + Math.sin(a) * r);
      }
      c.closePath();
      c.fillStyle = sea ? '#e07a6a' : '#9a958a';
      c.fill();
      c.strokeStyle = sea ? '#9a4038' : '#5e5a52';
      c.lineWidth = 4;
      c.stroke();
      c.beginPath();
      c.arc(k.x - k.r * 0.12, k.y - k.r * 0.12, k.r * 0.68, 0, TAU);
      c.fillStyle = sea ? '#f0a08a' : '#b5b0a4';
      c.fill();
      if (sea) {
        for (let n = 0; n < 9; n++) {
          const a = rnd() * TAU;
          const d = rnd() * k.r * 0.7;
          c.beginPath();
          c.arc(k.x + Math.cos(a) * d, k.y + Math.sin(a) * d, 5 + rnd() * 6, 0, TAU);
          c.fillStyle = ['#f6c26a', '#c86ad0', '#fff0e0'][n % 3]!;
          c.fill();
        }
      } else {
        c.strokeStyle = '#7d786e';
        c.lineWidth = 2.5;
        for (let n = 0; n < 3; n++) {
          const a = rnd() * TAU;
          c.beginPath();
          c.moveTo(k.x + Math.cos(a) * k.r * 0.15, k.y + Math.sin(a) * k.r * 0.15);
          c.lineTo(k.x + Math.cos(a + 0.3) * k.r * 0.5, k.y + Math.sin(a + 0.3) * k.r * 0.5);
          c.lineTo(k.x + Math.cos(a) * k.r * 0.75, k.y + Math.sin(a) * k.r * 0.75);
          c.stroke();
        }
      }
    }
  }
  for (const s of w.sources) {
    if (s.kind !== 'lilies' && touches(s, v, s.r)) drawSource(c, s, t);
  }
}

function drawSource(c: Ctx, s: Source, t: number): void {
  const TAU2 = TAU;
  switch (s.kind) {
    case 'tree': // a ginkgo: a fan of fan-shaped leaves round a trunk
      c.beginPath();
      c.arc(s.x + 8, s.y + 10, s.r * 1.1, 0, TAU2);
      c.fillStyle = 'rgba(20,50,20,0.2)';
      c.fill();
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * TAU2 + Math.sin(t * 0.8 + k) * 0.03;
        c.beginPath();
        c.moveTo(s.x, s.y);
        c.arc(s.x, s.y, s.r * 1.05, a - 0.3, a + 0.3);
        c.closePath();
        c.fillStyle = k % 2 ? '#d8c03a' : '#c4b030';
        c.fill();
      }
      c.beginPath();
      c.arc(s.x, s.y, s.r * 0.6, 0, TAU2);
      c.fillStyle = '#b09a28';
      c.fill();
      c.beginPath();
      c.arc(s.x, s.y, s.r * 0.22, 0, TAU2);
      c.fillStyle = '#6b4a2a';
      c.fill();
      break;
    case 'mound': // a termite mound: a lumpy cone of earth
      for (const [k, fill] of [[1, '#a8743c'], [0.7, '#bf8a4a'], [0.4, '#d4a060']] as const) {
        c.beginPath();
        for (let n = 0; n <= 12; n++) {
          const a = (n / 12) * TAU2;
          const r = s.r * k * (0.9 + Math.sin(a * 4 + s.x) * 0.1);
          c.lineTo(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r);
        }
        c.closePath();
        c.fillStyle = fill;
        c.fill();
      }
      for (let n = 0; n < 5; n++) {
        const a = n * 1.3;
        c.beginPath();
        c.arc(s.x + Math.cos(a) * s.r * 0.55, s.y + Math.sin(a) * s.r * 0.55, 2.5, 0, TAU2);
        c.fillStyle = '#4a2e14';
        c.fill();
      }
      break;
    case 'nest': // a ring of twigs
      c.lineWidth = 6;
      c.lineCap = 'round';
      for (let n = 0; n < 14; n++) {
        const a = (n / 14) * TAU2;
        c.beginPath();
        c.moveTo(s.x + Math.cos(a) * s.r * 0.65, s.y + Math.sin(a) * s.r * 0.65);
        c.lineTo(s.x + Math.cos(a + 0.6) * s.r * 1.05, s.y + Math.sin(a + 0.6) * s.r * 1.05);
        c.strokeStyle = n % 2 ? '#8a6438' : '#a87c48';
        c.stroke();
      }
      c.beginPath();
      c.arc(s.x, s.y, s.r * 0.6, 0, TAU2);
      c.fillStyle = '#6b4a28';
      c.fill();
      break;
    case 'bones': // the ribs and skull of a fallen giant
      c.strokeStyle = '#efe6d2';
      c.lineCap = 'round';
      c.lineWidth = s.r * 0.12;
      c.beginPath();
      c.moveTo(s.x - s.r, s.y);
      c.lineTo(s.x + s.r * 0.7, s.y);
      c.stroke();
      c.lineWidth = s.r * 0.08;
      for (let n = 0; n < 6; n++) {
        const x = s.x - s.r * 0.75 + n * s.r * 0.26;
        for (const side of [-1, 1]) {
          c.beginPath();
          c.moveTo(x, s.y);
          c.quadraticCurveTo(x + s.r * 0.15, s.y + side * s.r * 0.55, x - s.r * 0.05, s.y + side * s.r * 0.8);
          c.stroke();
        }
      }
      c.beginPath();
      c.ellipse(s.x + s.r * 0.95, s.y, s.r * 0.32, s.r * 0.24, 0, 0, TAU2);
      c.fillStyle = '#efe6d2';
      c.fill();
      for (const side of [-1, 1]) {
        c.beginPath();
        c.arc(s.x + s.r * 1.02, s.y + side * s.r * 0.1, s.r * 0.07, 0, TAU2);
        c.fillStyle = '#5a4a3a';
        c.fill();
      }
      break;
    case 'vent': { // a smoking vent on the sea floor
      c.beginPath();
      c.arc(s.x, s.y, s.r, 0, TAU2);
      c.fillStyle = '#3a3a44';
      c.fill();
      c.beginPath();
      c.arc(s.x, s.y, s.r * 0.45, 0, TAU2);
      c.fillStyle = '#ff8a3a';
      c.fill();
      for (let b = 0; b < 3; b++) {
        const phase = (t * 0.6 + b / 3) % 1;
        c.beginPath();
        c.arc(s.x + Math.sin(t + b) * 6, s.y - phase * s.r * 2.2, s.r * (0.25 + phase * 0.5), 0, TAU2);
        c.fillStyle = `rgba(230,240,255,${0.35 * (1 - phase)})`;
        c.fill();
      }
      break;
    }
  }
}

/** Ferns and kelp go over the creatures, so whatever hides in them is out of sight. */
export function drawCover(c: Ctx, bushes: Circle[], kelp: Circle[], v: Rect, t: number): void {
  for (const [i, b] of bushes.entries()) {
    if (!touches(b, v, 20)) continue;
    const rnd = seeded(50 + i);
    c.beginPath();
    c.ellipse(b.x + 8, b.y + 12, b.r * 1.02, b.r * 0.95, 0, 0, TAU);
    c.fillStyle = 'rgba(20,50,20,0.22)';
    c.fill();
    c.beginPath();
    c.arc(b.x, b.y, b.r * 0.82, 0, TAU);
    c.fillStyle = '#356f31';
    c.fill();
    // fronds: long leaves from the middle, each with its leaflets
    const n = 9;
    const base = rnd() * TAU;
    for (const [shade, len, off] of [['#3f8a3a', 1.02, 0], ['#5aa74b', 0.85, 0.5]] as const) {
      for (let f = 0; f < n; f++) {
        const a = base + ((f + off) * TAU) / n + (rnd() - 0.5) * 0.2;
        const L = b.r * len;
        const cx = b.x + Math.cos(a) * L * 0.5;
        const cy = b.y + Math.sin(a) * L * 0.5;
        c.beginPath();
        c.ellipse(cx, cy, L * 0.52, b.r * 0.17, a, 0, TAU);
        c.fillStyle = shade;
        c.fill();
        c.strokeStyle = 'rgba(30,70,30,0.55)';
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(b.x, b.y);
        c.lineTo(b.x + Math.cos(a) * L, b.y + Math.sin(a) * L);
        for (let k = 1; k < 5; k++) {
          const px = b.x + Math.cos(a) * L * (k / 5);
          const py = b.y + Math.sin(a) * L * (k / 5);
          for (const s of [-1, 1]) {
            c.moveTo(px, py);
            c.lineTo(px + Math.cos(a + s * 1.1) * b.r * 0.13, py + Math.sin(a + s * 1.1) * b.r * 0.13);
          }
        }
        c.stroke();
      }
    }
    c.beginPath();
    c.arc(b.x, b.y, b.r * 0.16, 0, TAU);
    c.fillStyle = '#6fbf5a';
    c.fill();
  }
  for (const [i, k] of kelp.entries()) {
    if (!touches(k, v, 30)) continue;
    const rnd = seeded(900 + i);
    c.beginPath();
    c.arc(k.x, k.y, k.r * 0.85, 0, TAU);
    c.fillStyle = 'rgba(28,78,58,0.96)';
    c.fill();
    for (let f = 0; f < 18; f++) {
      const a = (f / 18) * TAU + rnd() * 0.5;
      const L = k.r * (0.8 + rnd() * 0.35);
      const sway = Math.sin(t * 1.6 + f + i) * 0.25;
      c.beginPath();
      c.moveTo(k.x, k.y);
      c.quadraticCurveTo(k.x + Math.cos(a + sway) * L * 0.6, k.y + Math.sin(a + sway) * L * 0.6, k.x + Math.cos(a - sway) * L, k.y + Math.sin(a - sway) * L);
      c.strokeStyle = f % 2 ? '#5f8f34' : '#7f8f2e';
      c.lineWidth = k.r * 0.18;
      c.lineCap = 'round';
      c.stroke();
    }
    for (let b = 0; b < 6; b++) {
      const a = rnd() * TAU;
      const d = rnd() * k.r * 0.7;
      c.beginPath();
      c.arc(k.x + Math.cos(a) * d, k.y + Math.sin(a) * d, 4, 0, TAU);
      c.fillStyle = '#c9b84a';
      c.fill();
    }
  }
}

export function drawFood(c: Ctx, name: string, x: number, y: number, r: number, t: number, id: number): void {
  const pulse = 1 + Math.sin(t * 3 + id) * 0.06;
  c.save();
  c.translate(x, y);
  c.scale(r * pulse, r * pulse);
  c.rotate((id % 12) * 0.5);
  c.lineWidth = 0.12;
  const blob = (bx: number, by: number, br: number, fill: string, stroke: string): void => {
    c.beginPath();
    c.arc(bx, by, br, 0, TAU);
    c.fillStyle = fill;
    c.fill();
    c.strokeStyle = stroke;
    c.stroke();
  };
  switch (name) {
    case 'berry':
      for (const [bx, by] of [[-0.35, 0.25], [0.4, 0.2], [0, -0.4]] as const) {
        blob(bx, by, 0.58, '#6f4bc4', '#4a2f8a');
        c.beginPath();
        c.arc(bx - 0.2, by - 0.2, 0.16, 0, TAU);
        c.fillStyle = 'rgba(255,255,255,0.7)';
        c.fill();
      }
      break;
    case 'mushroom':
      blob(0, 0, 1, '#df5a40', '#9c3423');
      for (const [mx, my, mr] of [[-0.35, -0.3, 0.2], [0.35, -0.1, 0.16], [0, 0.4, 0.18], [-0.45, 0.3, 0.12], [0.3, 0.5, 0.1]] as const) {
        c.beginPath();
        c.arc(mx, my, mr, 0, TAU);
        c.fillStyle = '#fff6e8';
        c.fill();
      }
      break;
    case 'egg':
      c.beginPath();
      c.ellipse(0, 0, 0.8, 1, 0, 0, TAU);
      c.fillStyle = '#f4ead2';
      c.fill();
      c.strokeStyle = '#b8a67a';
      c.stroke();
      for (const [ex, ey, er] of [[-0.3, -0.3, 0.12], [0.25, 0.1, 0.1], [-0.1, 0.45, 0.13], [0.35, -0.5, 0.08]] as const) {
        c.beginPath();
        c.arc(ex, ey, er, 0, TAU);
        c.fillStyle = '#8fae6a';
        c.fill();
      }
      break;
    case 'krill':
      c.beginPath();
      c.arc(0, 0, 0.8, -2.4, 1.2);
      c.lineWidth = 0.55;
      c.lineCap = 'round';
      c.strokeStyle = '#f08f7a';
      c.stroke();
      c.lineWidth = 0.12;
      c.strokeStyle = '#ffd0c0';
      c.beginPath();
      c.moveTo(0.4, 0.75);
      c.lineTo(0.9, 1.2);
      c.moveTo(0.2, 0.8);
      c.lineTo(0.5, 1.35);
      c.stroke();
      break;
    case 'clam':
      c.beginPath();
      c.moveTo(0, 0.7);
      c.arc(0, 0.3, 1, Math.PI * 1.15, Math.PI * 1.85);
      c.closePath();
      c.fillStyle = '#e8dccb';
      c.fill();
      c.strokeStyle = '#9a8a72';
      c.stroke();
      c.beginPath();
      for (let k = -2; k <= 2; k++) {
        c.moveTo(0, 0.7);
        c.lineTo(Math.cos(Math.PI * 1.5 + k * 0.28) * 0.95, 0.3 + Math.sin(Math.PI * 1.5 + k * 0.28) * 0.95);
      }
      c.stroke();
      break;
    case 'fish':
      c.beginPath();
      c.moveTo(1, 0);
      c.quadraticCurveTo(0.2, -0.65, -0.55, 0);
      c.quadraticCurveTo(0.2, 0.65, 1, 0);
      c.fillStyle = '#f0a83a';
      c.fill();
      c.strokeStyle = '#a8681a';
      c.stroke();
      c.beginPath();
      c.moveTo(-0.45, 0);
      c.lineTo(-1, -0.45);
      c.lineTo(-1, 0.45);
      c.closePath();
      c.fill();
      c.stroke();
      c.beginPath();
      c.arc(0.55, -0.12, 0.1, 0, TAU);
      c.fillStyle = '#1a1208';
      c.fill();
      break;
    case 'ginkgo': // a ginkgo nut, yellow and plump
      blob(0, 0, 0.85, '#e8c84a', '#a8861c');
      c.beginPath();
      c.ellipse(-0.25, -0.25, 0.25, 0.15, -0.6, 0, TAU);
      c.fillStyle = 'rgba(255,255,255,0.5)';
      c.fill();
      c.beginPath();
      c.moveTo(0, -0.8);
      c.lineTo(0.25, -1.25);
      c.strokeStyle = '#7a5a1a';
      c.lineWidth = 0.15;
      c.stroke();
      break;
    case 'termites': // a little swarm
      for (let k = 0; k < 6; k++) {
        const a = t * 3 + k * 1.05;
        const x = Math.cos(a) * 0.6;
        const y = Math.sin(a * 1.3) * 0.6;
        c.beginPath();
        c.ellipse(x, y, 0.22, 0.13, a, 0, TAU);
        c.fillStyle = '#f0e2c4';
        c.fill();
        c.beginPath();
        c.arc(x + Math.cos(a) * 0.2, y + Math.sin(a) * 0.2, 0.11, 0, TAU);
        c.fillStyle = '#a8743c';
        c.fill();
      }
      break;
    case 'lily': // a lily pad with its flower
      c.beginPath();
      c.moveTo(0, 0);
      c.arc(0, 0, 1, 0.4, TAU - 0.1);
      c.closePath();
      c.fillStyle = '#5aa04a';
      c.fill();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU;
        c.beginPath();
        c.ellipse(Math.cos(a) * 0.25, Math.sin(a) * 0.25, 0.32, 0.15, a, 0, TAU);
        c.fillStyle = '#f6b8d8';
        c.fill();
      }
      c.beginPath();
      c.arc(0, 0, 0.15, 0, TAU);
      c.fillStyle = '#ffe27a';
      c.fill();
      break;
    case 'shrimp':
      c.beginPath();
      c.arc(0, 0, 0.75, -2.6, 1.3);
      c.lineWidth = 0.5;
      c.lineCap = 'round';
      c.strokeStyle = '#ff6a5a';
      c.stroke();
      c.lineWidth = 0.1;
      c.strokeStyle = '#ffc0a8';
      c.beginPath();
      c.moveTo(0.5, 0.65);
      c.lineTo(1.1, 1);
      c.moveTo(0.35, 0.75);
      c.lineTo(0.7, 1.3);
      c.stroke();
      break;
    case 'starfruit': { // rare, and it glows
      c.save();
      c.shadowColor = '#ffe45a';
      c.shadowBlur = 18;
      c.rotate(t * 0.8);
      c.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * TAU - Math.PI / 2;
        const r = k % 2 ? 0.45 : 1;
        c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      c.closePath();
      c.fillStyle = '#ffd23a';
      c.fill();
      c.strokeStyle = '#c8901a';
      c.lineWidth = 0.1;
      c.stroke();
      c.restore();
      break;
    }
    default: // meat
      c.beginPath();
      c.ellipse(0, 0, 1, 0.72, 0, 0, TAU);
      c.fillStyle = '#c4544a';
      c.fill();
      c.strokeStyle = '#86302a';
      c.stroke();
      c.beginPath();
      c.ellipse(-0.1, -0.1, 0.5, 0.3, 0, 0, TAU);
      c.fillStyle = '#e07a6c';
      c.fill();
      for (const s of [-1, 1]) {
        c.beginPath();
        c.arc(s * 1.05, 0, 0.26, 0, TAU);
        c.fillStyle = '#f4ecdc';
        c.fill();
      }
  }
  c.restore();
}
