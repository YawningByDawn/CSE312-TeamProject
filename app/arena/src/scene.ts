import { biomeAt } from './geo';
import type { Biome, Circle, Source, World } from './types';

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

const tiles = new Map<string, CanvasPattern>();

/** A repeating tile for a biome's ground, drawn once. */
function tile(c: Ctx, key: string, base: string, paint: (g: CanvasRenderingContext2D, rnd: () => number) => void): CanvasPattern {
  const kept = tiles.get(key);
  if (kept) return kept;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 384;
  const g = cv.getContext('2d')!;
  g.fillStyle = base;
  g.fillRect(0, 0, 384, 384);
  paint(g, seeded(key.length * 97 + 13));
  const p = c.createPattern(cv, 'repeat')!;
  tiles.set(key, p);
  return p;
}

function blotches(g: CanvasRenderingContext2D, rnd: () => number, colors: string[], n: number, size: number): void {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[i % colors.length]!;
    g.beginPath();
    g.ellipse(rnd() * 384, rnd() * 384, size * (0.5 + rnd()), size * (0.35 + rnd() * 0.6), rnd() * TAU, 0, TAU);
    g.fill();
  }
}

const swampTile = (c: Ctx): CanvasPattern =>
  tile(c, 'swamp', '#6b8550', (g, rnd) => {
    blotches(g, rnd, ['rgba(80,108,62,0.6)', 'rgba(124,150,88,0.5)', 'rgba(70,96,72,0.55)'], 30, 40);
    g.strokeStyle = '#4e6a3a';
    g.lineWidth = 2;
    g.lineCap = 'round';
    for (let i = 0; i < 70; i++) { // reeds
      const x = rnd() * 384;
      const y = rnd() * 384;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + rnd() * 3 - 1.5, y - 9 - rnd() * 6);
      g.stroke();
    }
    for (let i = 0; i < 10; i++) {
      g.fillStyle = 'rgba(160,190,90,0.7)';
      g.beginPath();
      g.arc(rnd() * 384, rnd() * 384, 2, 0, TAU);
      g.fill();
    }
  });

const ashTile = (c: Ctx): CanvasPattern =>
  tile(c, 'ash', '#5c524a', (g, rnd) => {
    blotches(g, rnd, ['rgba(70,62,56,0.6)', 'rgba(110,98,88,0.45)', 'rgba(60,52,48,0.5)'], 28, 42);
    g.lineCap = 'round';
    for (let i = 0; i < 9; i++) { // cracks, some glowing
      let x = rnd() * 384;
      let y = rnd() * 384;
      const hot = rnd() < 0.45;
      g.strokeStyle = hot ? 'rgba(230,100,40,0.75)' : '#3a322c';
      g.lineWidth = hot ? 2.5 : 2;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        x += rnd() * 40 - 20;
        y += rnd() * 40 - 20;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    for (let i = 0; i < 16; i++) {
      g.fillStyle = rnd() < 0.5 ? '#e0602a' : '#3a322c';
      g.beginPath();
      g.arc(rnd() * 384, rnd() * 384, 1.5 + rnd() * 1.5, 0, TAU);
      g.fill();
    }
  });

const snowTile = (c: Ctx): CanvasPattern =>
  tile(c, 'snow', '#e9f0f4', (g, rnd) => {
    blotches(g, rnd, ['rgba(208,222,232,0.6)', 'rgba(250,252,255,0.8)', 'rgba(196,212,226,0.45)'], 32, 40);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = rnd() < 0.5 ? '#ffffff' : 'rgba(170,196,214,0.8)';
      g.beginPath();
      g.arc(rnd() * 384, rnd() * 384, 1 + rnd() * 1.5, 0, TAU);
      g.fill();
    }
  });

const biomeTile: Record<string, (c: Ctx) => CanvasPattern> = { swamp: swampTile, volcano: ashTile, tundra: snowTile };

const biomes = new WeakMap<Circle, Biome>();
/** The biome a feature of the map is in, worked out once. */
function biomeOf(w: World, k: Circle): Biome {
  let b = biomes.get(k);
  if (!b) {
    b = biomeAt(w, k.x, k.y);
    biomes.set(k, b);
  }
  return b;
}

/** The outline of a biome region, from its border: swamp (west), volcano (north) or tundra (south). */
function region(c: Ctx, w: World, which: 'swamp' | 'volcano' | 'tundra'): void {
  const e = w.edges;
  c.beginPath();
  if (which === 'swamp') {
    c.moveTo(-50, -50);
    e.swamp.forEach((x, i) => c.lineTo(x, i * e.step));
    c.lineTo(-50, w.h + 50);
  } else {
    const line = which === 'volcano' ? e.volcano : e.tundra;
    const far = which === 'volcano' ? -50 : w.h + 50;
    c.moveTo(-50, far);
    line.forEach((y, i) => c.lineTo(i * e.step, y));
    c.lineTo(w.w + 50, far);
  }
  c.closePath();
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
  const e = w.edges;
  for (const which of ['swamp', 'volcano', 'tundra'] as const) {
    const near =
      which === 'swamp' ? v.x0 < Math.max(...e.swamp) : which === 'volcano' ? v.y0 < Math.max(...e.volcano) : v.y1 > Math.min(...e.tundra);
    if (!near) continue;
    c.save();
    region(c, w, which);
    c.clip();
    c.fillStyle = biomeTile[which]!(c);
    c.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    c.restore();
    region(c, w, which); // a soft border
    c.strokeStyle = which === 'tundra' ? 'rgba(255,255,255,0.55)' : which === 'volcano' ? 'rgba(40,30,25,0.35)' : 'rgba(50,70,40,0.35)';
    c.lineWidth = 16;
    c.stroke();
  }
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

export function drawPonds(c: Ctx, w: World, v: Rect, t: number): void {
  for (const [i, p] of w.ponds.entries()) {
    if (!touches(p, v, 30)) continue;
    const murky = biomeOf(w, p) === 'swamp';
    c.beginPath();
    c.arc(p.x, p.y, p.r + 12, 0, TAU);
    c.fillStyle = murky ? '#7a6e48' : '#d8c891';
    c.fill();
    const g = c.createRadialGradient(p.x - p.r * 0.2, p.y - p.r * 0.2, p.r * 0.1, p.x, p.y, p.r);
    g.addColorStop(0, murky ? '#7a9a6a' : '#79c3e0');
    g.addColorStop(1, murky ? '#3e5a40' : '#3f90bd');
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

/** Lava pools: a crust round a glowing, bubbling middle. */
function drawLava(c: Ctx, w: World, v: Rect, t: number): void {
  for (const [i, p] of w.lava.entries()) {
    if (!touches(p, v, 40)) continue;
    const rnd = seeded(1500 + i);
    c.save();
    c.shadowColor = 'rgba(255,110,30,0.8)';
    c.shadowBlur = 30;
    c.beginPath();
    for (let k = 0; k <= 22; k++) {
      const a = (k / 22) * TAU;
      const r = p.r * (0.95 + Math.sin(a * 3 + i) * 0.04 + rnd() * 0.04);
      c.lineTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
    }
    c.closePath();
    c.fillStyle = '#2a1a14';
    c.fill();
    c.restore();
    const g = c.createRadialGradient(p.x, p.y, p.r * 0.1, p.x, p.y, p.r * 0.85);
    const pulse = (Math.sin(t * 1.5 + i) + 1) / 2;
    g.addColorStop(0, `rgb(255,${210 + pulse * 30},${80 + pulse * 40})`);
    g.addColorStop(0.55, '#ff7a1a');
    g.addColorStop(1, '#b8340e');
    c.beginPath();
    c.arc(p.x, p.y, p.r * 0.84, 0, TAU);
    c.fillStyle = g;
    c.fill();
    for (let k = 0; k < 5; k++) { // drifting crust
      const a = rnd() * TAU + t * 0.05 * (k % 2 ? 1 : -1);
      const d = p.r * (0.25 + rnd() * 0.45);
      c.beginPath();
      c.ellipse(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, p.r * 0.12, p.r * 0.07, a, 0, TAU);
      c.fillStyle = 'rgba(60,30,20,0.7)';
      c.fill();
    }
    for (let b = 0; b < 4; b++) { // bubbles that swell and pop
      const phase = (t * 0.7 + b * 0.25 + i * 0.13) % 1;
      const a = rnd() * TAU;
      const d = rnd() * p.r * 0.6;
      c.beginPath();
      c.arc(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 3 + phase * 12, 0, TAU);
      c.strokeStyle = `rgba(255,240,170,${0.8 * (1 - phase)})`;
      c.lineWidth = 2.5;
      c.stroke();
    }
  }
}

/** Ice sheets: pale and glassy, with cracks. */
function drawIce(c: Ctx, w: World, v: Rect): void {
  for (const [i, p] of w.ice.entries()) {
    if (!touches(p, v, 20)) continue;
    const rnd = seeded(1700 + i);
    c.beginPath();
    for (let k = 0; k <= 18; k++) {
      const a = (k / 18) * TAU;
      const r = p.r * (0.92 + rnd() * 0.1);
      c.lineTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
    }
    c.closePath();
    c.fillStyle = 'rgba(196,232,250,0.9)';
    c.fill();
    c.strokeStyle = '#9ccae4';
    c.lineWidth = 5;
    c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.8)';
    c.lineWidth = 6;
    c.lineCap = 'round';
    for (let k = 0; k < 3; k++) { // shine
      const x = p.x - p.r * 0.4 + rnd() * p.r * 0.5;
      const y = p.y - p.r * 0.4 + rnd() * p.r * 0.5;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + p.r * 0.25, y - p.r * 0.12);
      c.stroke();
    }
    c.strokeStyle = '#a8d0e8';
    c.lineWidth = 2;
    for (let k = 0; k < 4; k++) { // cracks
      let x = p.x + (rnd() - 0.5) * p.r;
      let y = p.y + (rnd() - 0.5) * p.r;
      c.beginPath();
      c.moveTo(x, y);
      for (let n = 0; n < 3; n++) {
        x += (rnd() - 0.5) * p.r * 0.4;
        y += (rnd() - 0.5) * p.r * 0.4;
        c.lineTo(x, y);
      }
      c.stroke();
    }
  }
}

const ROCK_LOOK: Record<string, [string, string, string, string]> = {
  // fill, edge, top, cracks
  meadow: ['#9a958a', '#5e5a52', '#b5b0a4', '#7d786e'],
  swamp: ['#7a8a6a', '#4a5a3e', '#8e9e7c', '#5a7a3a'],
  volcano: ['#2e2834', '#15121a', '#463e50', '#8a7aa0'],
  tundra: ['#9aa4ac', '#5a646c', '#c8d0d6', '#7a848c'],
  ocean: ['#9a958a', '#5e5a52', '#b5b0a4', '#7d786e'],
};

/** Tar pits, lava and ice, rocks and reefs, and the places food grows: all under the creatures, which walk on them. */
export function drawTerrain(c: Ctx, w: World, v: Rect, t: number): void {
  drawLava(c, w, v, t);
  drawIce(c, w, v);
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
      const look = ROCK_LOOK[biomeOf(w, k)] ?? ROCK_LOOK.meadow!;
      c.fillStyle = sea ? '#e07a6a' : look[0];
      c.fill();
      c.strokeStyle = sea ? '#9a4038' : look[1];
      c.lineWidth = 4;
      c.stroke();
      c.beginPath();
      c.arc(k.x - k.r * 0.12, k.y - k.r * 0.12, k.r * 0.68, 0, TAU);
      c.fillStyle = sea ? '#f0a08a' : look[2];
      c.fill();
      if (!sea && biomeOf(w, k) === 'tundra') { // a cap of snow
        c.beginPath();
        c.ellipse(k.x - k.r * 0.2, k.y - k.r * 0.25, k.r * 0.5, k.r * 0.32, -0.3, 0, TAU);
        c.fillStyle = '#f6fafc';
        c.fill();
      }
      if (!sea && biomeOf(w, k) === 'volcano') { // a glassy gleam
        c.beginPath();
        c.ellipse(k.x - k.r * 0.25, k.y - k.r * 0.3, k.r * 0.28, k.r * 0.08, -0.5, 0, TAU);
        c.fillStyle = 'rgba(200,180,255,0.45)';
        c.fill();
      }
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
        c.strokeStyle = (ROCK_LOOK[biomeOf(w, k)] ?? ROCK_LOOK.meadow!)[3];
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
    case 'bones': { // a fallen giant, still meaty: red flesh on the spine and between the ribs, bones over it
      const meat = (x: number, y: number, rx: number, ry: number, rot: number): void => {
        c.beginPath();
        c.ellipse(x, y, rx, ry, rot, 0, TAU2);
        c.fillStyle = '#b5413a';
        c.fill();
        c.strokeStyle = '#7e2a24';
        c.lineWidth = s.r * 0.03;
        c.stroke();
        c.beginPath();
        c.ellipse(x - rx * 0.2, y - ry * 0.25, rx * 0.55, ry * 0.45, rot, 0, TAU2);
        c.fillStyle = '#d9685c';
        c.fill();
        c.beginPath(); // a streak of fat
        c.ellipse(x + rx * 0.15, y + ry * 0.1, rx * 0.35, ry * 0.12, rot + 0.4, 0, TAU2);
        c.fillStyle = 'rgba(255,235,220,0.75)';
        c.fill();
      };
      c.beginPath();
      c.ellipse(s.x + 6, s.y + 8, s.r * 1.2, s.r * 0.85, 0, 0, TAU2);
      c.fillStyle = 'rgba(60,20,15,0.18)';
      c.fill();
      meat(s.x - s.r * 0.1, s.y, s.r * 0.85, s.r * 0.26, 0);
      for (let n = 0; n < 6; n++) {
        if (n % 2 === 0) meat(s.x - s.r * 0.65 + n * s.r * 0.26, s.y - s.r * 0.42, s.r * 0.16, s.r * 0.24, 0.2);
        if (n % 2 === 1) meat(s.x - s.r * 0.65 + n * s.r * 0.26, s.y + s.r * 0.42, s.r * 0.16, s.r * 0.24, -0.2);
      }
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
      for (let n = 0; n < 4; n++) meat(s.x - s.r * 0.55 + n * s.r * 0.36, s.y + (n % 2 ? 1 : -1) * s.r * 0.18, s.r * 0.1, s.r * 0.08, n); // bits on the bone
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
      // a slow shine, so it catches the eye as food does
      const glint = (Math.sin(t * 2 + s.x) + 1) / 2;
      c.beginPath();
      c.ellipse(s.x - s.r * 0.3, s.y - s.r * 0.06, s.r * 0.25, s.r * 0.05, 0, 0, TAU2);
      c.fillStyle = `rgba(255,255,255,${0.15 + glint * 0.35})`;
      c.fill();
      break;
    }
    case 'hole': { // a fishing hole cut in the ice
      c.beginPath();
      c.arc(s.x, s.y, s.r * 1.25, 0, TAU2);
      c.fillStyle = '#e8f6ff';
      c.fill();
      c.beginPath();
      c.arc(s.x, s.y, s.r, 0, TAU2);
      c.fillStyle = '#1f4a6a';
      c.fill();
      const phase = (t * 0.5 + s.x) % 1;
      c.beginPath();
      c.arc(s.x, s.y, s.r * (0.2 + phase * 0.7), 0, TAU2);
      c.strokeStyle = `rgba(200,235,255,${0.6 * (1 - phase)})`;
      c.lineWidth = 2;
      c.stroke();
      break;
    }
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
/** A tundra bush is a snowdrift: a white mound, shaded blue. */
function snowdrift(c: Ctx, b: Circle, rnd: () => number): void {
  c.beginPath();
  c.ellipse(b.x + 8, b.y + 12, b.r * 1.02, b.r * 0.95, 0, 0, TAU);
  c.fillStyle = 'rgba(80,110,140,0.22)';
  c.fill();
  for (const [k, fill] of [[1, '#c8d8e6'], [0.8, '#e4eef6'], [0.5, '#fbfdff']] as const) {
    c.beginPath();
    for (let n = 0; n <= 14; n++) {
      const a = (n / 14) * TAU;
      const r = b.r * k * (0.85 + rnd() * 0.2);
      c.lineTo(b.x - (1 - k) * b.r * 0.2 + Math.cos(a) * r, b.y - (1 - k) * b.r * 0.25 + Math.sin(a) * r);
    }
    c.closePath();
    c.fillStyle = fill;
    c.fill();
  }
}

/** A volcano bush is a charred shrub: black twigs, a few embers still glowing. */
function ashShrub(c: Ctx, b: Circle, rnd: () => number, t: number): void {
  c.beginPath();
  c.ellipse(b.x + 8, b.y + 12, b.r, b.r * 0.92, 0, 0, TAU);
  c.fillStyle = 'rgba(20,10,5,0.3)';
  c.fill();
  c.beginPath();
  c.arc(b.x, b.y, b.r * 0.85, 0, TAU);
  c.fillStyle = '#2e2622';
  c.fill();
  c.lineCap = 'round';
  for (let n = 0; n < 14; n++) {
    const a = rnd() * TAU;
    const L = b.r * (0.6 + rnd() * 0.45);
    c.beginPath();
    c.moveTo(b.x, b.y);
    c.quadraticCurveTo(b.x + Math.cos(a + 0.3) * L * 0.5, b.y + Math.sin(a + 0.3) * L * 0.5, b.x + Math.cos(a) * L, b.y + Math.sin(a) * L);
    c.strokeStyle = n % 2 ? '#4a3e36' : '#3a302a';
    c.lineWidth = 5;
    c.stroke();
  }
  for (let n = 0; n < 6; n++) {
    const a = rnd() * TAU;
    const d = rnd() * b.r * 0.7;
    c.beginPath();
    c.arc(b.x + Math.cos(a) * d, b.y + Math.sin(a) * d, 3.5, 0, TAU);
    c.fillStyle = Math.sin(t * 3 + n + b.x) > 0 ? '#ff8a2a' : '#c84a1a';
    c.fill();
  }
}

export function drawCover(c: Ctx, w: World, v: Rect, t: number): void {
  const bushes = w.bushes;
  const kelp = w.kelp;
  for (const [i, b] of bushes.entries()) {
    if (!touches(b, v, 20)) continue;
    const rnd = seeded(50 + i);
    const biome = biomeOf(w, b);
    if (biome === 'tundra') {
      snowdrift(c, b, rnd);
      continue;
    }
    if (biome === 'volcano') {
      ashShrub(c, b, rnd, t);
      continue;
    }
    const dark = biome === 'swamp';
    c.beginPath();
    c.ellipse(b.x + 8, b.y + 12, b.r * 1.02, b.r * 0.95, 0, 0, TAU);
    c.fillStyle = 'rgba(20,50,20,0.22)';
    c.fill();
    c.beginPath();
    c.arc(b.x, b.y, b.r * 0.82, 0, TAU);
    c.fillStyle = dark ? '#2a4a26' : '#356f31';
    c.fill();
    // fronds: long leaves from the middle, each with its leaflets
    const n = 9;
    const base = rnd() * TAU;
    const shades = dark ? [['#365a2c', 1.02, 0], ['#4a7238', 0.85, 0.5]] as const : [['#3f8a3a', 1.02, 0], ['#5aa74b', 0.85, 0.5]] as const;
    for (const [shade, len, off] of shades) {
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
    case 'fernhead': // a curled young fern
      c.beginPath();
      for (let a = 0; a < TAU * 1.6; a += 0.2) {
        const r = 0.95 * Math.exp(-0.28 * a);
        c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      c.lineWidth = 0.32;
      c.lineCap = 'round';
      c.strokeStyle = '#6aa83a';
      c.stroke();
      c.lineWidth = 0.12;
      c.strokeStyle = '#a8d870';
      c.stroke();
      break;
    case 'emberberry': // warm, and faintly glowing
      c.save();
      c.shadowColor = '#ff6a1a';
      c.shadowBlur = 8;
      for (const [bx, by] of [[-0.3, 0.25], [0.35, 0.2], [0, -0.35]] as const) blob(bx, by, 0.55, '#e8501e', '#8a2410');
      c.restore();
      for (const [bx, by] of [[-0.3, 0.25], [0.35, 0.2], [0, -0.35]] as const) {
        c.beginPath();
        c.arc(bx - 0.15, by - 0.15, 0.15, 0, TAU);
        c.fillStyle = '#ffd08a';
        c.fill();
      }
      break;
    case 'frostberry': // pale blue, frosted
      for (const [bx, by] of [[-0.32, 0.22], [0.35, 0.22], [0, -0.38]] as const) {
        blob(bx, by, 0.55, '#8ac8f0', '#3a7aa8');
        c.beginPath();
        c.arc(bx - 0.18, by - 0.18, 0.18, 0, TAU);
        c.fillStyle = 'rgba(255,255,255,0.9)';
        c.fill();
      }
      break;
    case 'pinecone':
      c.beginPath();
      c.ellipse(0, 0, 0.7, 1, 0, 0, TAU);
      c.fillStyle = '#8a5a30';
      c.fill();
      c.strokeStyle = '#4a2e14';
      c.stroke();
      c.strokeStyle = '#b8844a';
      c.lineWidth = 0.1;
      for (let k = -2; k <= 2; k++) {
        c.beginPath();
        c.moveTo(-0.6, k * 0.32);
        c.lineTo(0, k * 0.32 + 0.2);
        c.lineTo(0.6, k * 0.32);
        c.stroke();
      }
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
