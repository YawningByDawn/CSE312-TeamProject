import type { Circle, World } from './types';

// The meadow: grass, the ponds and bushes of the map, and food. All in world units, on a context the view has moved.

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

export function drawGround(c: Ctx, w: World | null, v: Rect): void {
  c.fillStyle = '#4f7d45';
  c.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
  const W = w?.w ?? 1e6;
  const H = w?.h ?? 1e6;
  const x0 = Math.max(0, v.x0);
  const y0 = Math.max(0, v.y0);
  c.fillStyle = grassPattern(c);
  c.fillRect(x0, y0, Math.min(W, v.x1) - x0, Math.min(H, v.y1) - y0);
  if (w) {
    c.strokeStyle = '#3f6b37';
    c.lineWidth = 18;
    c.setLineDash([26, 18]);
    c.strokeRect(-9, -9, W + 18, H + 18);
    c.setLineDash([]);
  }
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

/** Bushes go over the creatures, so whatever hides in one is out of sight. */
export function drawBushes(c: Ctx, bushes: Circle[], v: Rect): void {
  for (const [i, b] of bushes.entries()) {
    if (!touches(b, v, 20)) continue;
    const rnd = seeded(50 + i);
    c.beginPath();
    c.ellipse(b.x + 8, b.y + 12, b.r * 1.02, b.r * 0.95, 0, 0, TAU);
    c.fillStyle = 'rgba(20,50,20,0.22)';
    c.fill();
    const lobes = 7;
    const base = rnd() * TAU;
    for (const [shade, k, off] of [['#3c8238', 1, 0.42], ['#4f9b44', 0.82, 0.36], ['#64b153', 0.55, 0.3]] as const) {
      c.fillStyle = shade;
      c.beginPath();
      c.arc(b.x, b.y, b.r * 0.62 * k, 0, TAU);
      c.fill();
      for (let l = 0; l < lobes; l++) {
        const a = base + (l * TAU) / lobes + (rnd() - 0.5) * 0.4;
        const d = b.r * off * k + b.r * 0.08;
        c.beginPath();
        c.arc(b.x + Math.cos(a) * d - (1 - k) * b.r * 0.1, b.y + Math.sin(a) * d - (1 - k) * b.r * 0.12, b.r * (0.42 + rnd() * 0.08) * k, 0, TAU);
        c.fill();
      }
    }
    if (i % 3 === 0) {
      for (let k = 0; k < 6; k++) {
        const a = rnd() * TAU;
        const d = rnd() * b.r * 0.7;
        c.beginPath();
        c.arc(b.x + Math.cos(a) * d, b.y + Math.sin(a) * d, 4, 0, TAU);
        c.fillStyle = '#d6465a';
        c.fill();
      }
    }
  }
}

export function drawFood(c: Ctx, kind: number, x: number, y: number, r: number, t: number, id: number): void {
  const pulse = 1 + Math.sin(t * 3 + id) * 0.06;
  c.save();
  c.translate(x, y);
  c.scale(r * pulse, r * pulse);
  c.rotate((id % 12) * 0.5);
  c.lineWidth = 0.12;
  switch (kind) {
    case 0: // berries
      for (const [bx, by] of [[-0.35, 0.25], [0.4, 0.2], [0, -0.4]] as const) {
        c.beginPath();
        c.arc(bx, by, 0.58, 0, TAU);
        c.fillStyle = '#6f4bc4';
        c.fill();
        c.strokeStyle = '#4a2f8a';
        c.stroke();
        c.beginPath();
        c.arc(bx - 0.2, by - 0.2, 0.16, 0, TAU);
        c.fillStyle = 'rgba(255,255,255,0.7)';
        c.fill();
      }
      break;
    case 1: // mushroom cap
      c.beginPath();
      c.arc(0, 0, 1, 0, TAU);
      c.fillStyle = '#df5a40';
      c.fill();
      c.strokeStyle = '#9c3423';
      c.stroke();
      for (const [mx, my, mr] of [[-0.35, -0.3, 0.2], [0.35, -0.1, 0.16], [0, 0.4, 0.18], [-0.45, 0.3, 0.12], [0.3, 0.5, 0.1]] as const) {
        c.beginPath();
        c.arc(mx, my, mr, 0, TAU);
        c.fillStyle = '#fff6e8';
        c.fill();
      }
      break;
    case 2: // apple
      c.beginPath();
      c.arc(0, 0, 1, 0, TAU);
      c.fillStyle = '#e4483a';
      c.fill();
      c.strokeStyle = '#992a20';
      c.stroke();
      c.beginPath();
      c.arc(-0.35, -0.35, 0.25, 0, TAU);
      c.fillStyle = 'rgba(255,255,255,0.45)';
      c.fill();
      c.beginPath();
      c.ellipse(0.25, -0.75, 0.32, 0.15, -0.6, 0, TAU);
      c.fillStyle = '#4f9b44';
      c.fill();
      break;
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
