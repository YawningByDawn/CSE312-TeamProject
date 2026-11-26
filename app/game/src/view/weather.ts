import { Container, Sprite, Texture, type Renderer } from 'pixi.js';
import type { AtlasManifest, Layer, Query, ViewModel } from '../types';
import { MINE_FRAME } from '../content/map';
import { below, frameOf, scale } from './camera';
import { Atlas } from './atlas';
import { layerRoot, pit } from './quad';
import { clamp01, differs, hash, mod, quant, smooth } from './tables';
import { TOWN_C, TOWN_HALF, WIND, type Sky } from './sky';
import type { Fog } from './fog';
import raw from '../../assets/weather/manifest.json';

// The weather over the world (#74), as the old game showed it (the weather renderer at its 'medium' quality over the
// surface, the mine renderer's own weather below): assets/weather's cells placed afresh each step of the clock (STEP_HZ)
// by the sky (sky.ts). On the surface, in screen px riding the pans: the rain's streaks in three depths up close, its
// slanted curtain and the front's leading edge far out, splashes, the wind's gusts and grit, the lightning's bolt and
// flash; in the town: puddles growing with the wet and the lamps in them, the lamps' smears, the runoff into the pit,
// fog banks in the hollows and the lamps' halos in fog, the eaves dripping, rain falling into the shaft. In the mine:
// water rising in the low workings' pools, drips from the wet faces' feet (faster as the wet seeps down), rain and mist
// down the shaft. The atlas (BC3) is fetched once the surface's weather or the mine first asks for it.

type Refl = [col: string, k: number, dx: number];
interface Manifest extends AtlasManifest {
  town: {
    puddles: [x: number, y: number, rx: number, ry: number, v: number, grow: number, refl: Refl[]][]; lamps: [x: number, y: number, r: number, col: string, k: number][];
    fog: [x: number, y: number, s: number, seed: number][]; rills: number[][]; casters: [x: number, y: number, rx: number, ry: number, h: number][]; shaft: [x: number, y: number, rx: number, ry: number];
  };
  mine: {
    drips: [x: number, y0: number, y1: number, period: number, ph: number, keep: number][]; shaft: [x: number, y: number, keep: number];
    pools: [x: number, y: number, rx: number, ry: number, chamber: number, levels: number[], ax: number, ay: number][];
  };
}
const M = raw as unknown as Manifest;
const FILES = import.meta.glob('../../assets/weather/weather*.bc3', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const URLS = Array.from({ length: M.levels }, (_, i) => FILES[`../../assets/weather/weather${i ? `@${i}` : ''}.bc3`]!);

const STEP_HZ = 30;
/** the rain's three depths: parallax, strokes a 1600 x 900 screen, speed (px/s), length, width, ink, the tile they wrap on */
const DEPTHS = [
  { par: 0.8, n: 170, speed: 560, len: 14, w: 0.8, a: 0.34, tw: 733, th: 571, seed: 11 },
  { par: 1.0, n: 110, speed: 820, len: 24, w: 1.05, a: 0.5, tw: 811, th: 613, seed: 23 },
  { par: 1.3, n: 40, speed: 1250, len: 40, w: 1.5, a: 0.66, tw: 877, th: 659, seed: 37 },
];
const RAIN = 0x7d8a99, GRIT = 0xe4d3ac, FLASH = 0xe6deff, BOLT_GLOW = 0xd2c0ff, BOLT_CORE = 0xf4efff, WATER = 0xbecdd7;
/** the pit in the town frame: no rain over the mine in the descent */
const PIT = { x: MINE_FRAME.x, y: MINE_FRAME.y, w: MINE_FRAME.w / MINE_FRAME.per, h: MINE_FRAME.h / MINE_FRAME.per };
const rgb = (c: string): number => {
  const [r, g, b] = c.match(/\d+/g)!.map(Number);
  return (r! << 16) | (g! << 8) | b!;
};

/** The light of the hour: day, night, and the dawn and dusk bumps. */
function lightOf(q: Query, hour: number): { day: number; night: number; dawn: number; dusk: number } {
  const c = hour / 24, bump = (c0: number) => smooth(0, 1, 1 - Math.min(Math.abs(c - c0), 1 - Math.abs(c - c0)) / 0.075);
  return { day: q.daylight(hour), night: smooth(0.02, -0.16, q.sun(hour)), dawn: bump(0.262), dusk: bump(0.742) };
}

/** Sprites of one blend placed afresh each step: `put` the next, `end` hides the rest. */
class Pool {
  readonly c = layerRoot(new Container());
  private n = 0;
  constructor(blend: 'add' | 'multiply' | 'normal') {
    this.c.blendMode = blend;
  }
  /** a cell (null: a white square about its middle) at x, y, scaled, turned, tinted */
  put(a: Atlas, cell: string | null, x: number, y: number, sx: number, sy: number, rot: number, tint: number, alpha: number): void {
    const s = (this.c.children[this.n++] as Sprite | undefined) ?? this.c.addChild(new Sprite());
    if (cell) {
      const c = a.cell(cell);
      s.texture = a.texture(cell);
      s.anchor.set(c[5] / c[2], c[6] / c[3]);
    } else s.texture = Texture.WHITE, s.anchor.set(0.5);
    s.position.set(x, y);
    s.scale.set(sx, sy);
    s.rotation = rot;
    s.tint = tint;
    s.alpha = Math.min(1, alpha);
    s.visible = true;
  }
  /** a streak (the bar cell) from (x0, y0) to (x1, y1), w wide */
  line(a: Atlas, x0: number, y0: number, x1: number, y1: number, w: number, tint: number, alpha: number): void {
    this.put(a, 'streak', x1, y1, w / 2, Math.hypot(x1 - x0, y1 - y0) / 64, Math.atan2(x0 - x1, y1 - y0), tint, alpha);
  }
  /** a ring of radius r squashed to sy (the life atlas's lie at 0.45), from the baked size nearest r, its line `w` there */
  ring(a: Atlas, x: number, y: number, r: number, sy: number, tint: number, alpha: number, w = '1.1'): void {
    const b = 2 ** Math.min(5, Math.max(1, Math.round(Math.log2(r)))), name = `ring-${b}-${w}`, k = r / b / a.cell(name)[4];
    this.put(a, name, x, y, k, (k * sy) / 0.45, 0, tint, alpha);
  }
  /** hides what this step did not place; whether anything shows or showed */
  end(): boolean {
    const kids = this.c.children, was = kids.some((k) => k.visible), now = this.n > 0;
    for (let i = this.n; i < kids.length; i++) kids[i]!.visible = false;
    this.n = 0;
    return was || now;
  }
}

export class Weather implements Layer {
  readonly name = 'weather';
  readonly root = layerRoot(new Container());
  private atlas: Atlas | null = null;
  private loading = false;
  private readonly scr = layerRoot(new Container());
  private readonly mine = pit();
  private readonly p = { mineNorm: new Pool('normal'), mine: new Pool('add'), townMul: new Pool('multiply'), townNorm: new Pool('normal'), town: new Pool('add'), sky: new Pool('add') };
  private readonly at = { a: 1, e: 0, f: 0 };
  private readonly off = { x: 0, y: 0, cx: NaN, cy: NaN };
  private readonly shown: number[] = [];
  private readonly fogOrder = [...M.town.fog].sort((a, b) => b[2] * (0.7 + 0.6 * hash(b[0], b[1], 9)) - a[2] * (0.7 + 0.6 * hash(a[0], a[1], 9)));

  constructor(private readonly q: Query, private readonly sky: Sky, private readonly fog: Fog, private readonly life: Atlas,
    private readonly renderer: Renderer, private readonly screen: { w: number; h: number }) {
    const P = this.p;
    this.mine.addChild(P.mineNorm.c, P.mine.c);
    this.scr.addChild(P.sky.c);
    this.root.addChild(this.mine, P.townMul.c, P.townNorm.c, P.town.c, this.scr);
  }

  frame(vm: ViewModel): boolean {
    const cam = vm.camera, S = this.sky, L = S.look, b = below(cam.zoom), surface = 1 - smooth(0.25, 0.85, b);
    if (!this.atlas) {
      if ((b > 0 || (surface > 0.01 && (L.rain > 0.01 || L.wind > 0.4 || L.fog > 0.04 || S.flash > 0.01 || S.wetness > 0.05))) && !this.loading) {
        this.loading = true;
        void Atlas.load(this.renderer, M, URLS).then((a) => (this.atlas = a));
      }
      return false;
    }
    const step = Math.floor(vm.time * STEP_HZ);
    if (!differs(this.shown, step, cam.x, cam.y, cam.zoom)) return false;
    const a = this.atlas, t = step / STEP_HZ, light = lightOf(this.q, this.q.hour(vm.state.tick)), at = this.at, off = this.off;
    frameOf(cam, this.screen.w, this.screen.h, at);
    this.scr.scale.set(1 / at.a);
    this.scr.position.set(-at.e / at.a, -at.f / at.a);
    // the rain rides a pan with the world and stays put on a zoom
    if (!Number.isNaN(off.cx)) off.x -= (cam.x - off.cx) * at.a, off.y -= (cam.y - off.cy) * at.a;
    off.cx = cam.x;
    off.cy = cam.y;
    if (surface > 0.01) this.surface(a, t, surface, b, light);
    if (b > 0) this.underground(a, t, light, cam.zoom);
    this.scr.alpha = this.p.town.c.alpha = this.p.townNorm.c.alpha = this.p.townMul.c.alpha = surface;
    this.mine.alpha = b;
    let any = false;
    for (const p of Object.values(this.p)) if (p.end()) any = true;
    return any;
  }

  /** The surface's weather: the sky's in screen px, the town's in town units. */
  private surface(a: Atlas, t: number, k: number, descent: number, light: ReturnType<typeof lightOf>): void {
    const S = this.sky, L = S.look, A = this.at.a, { w: W, h: H } = this.screen, sk = this.p.sky, off = this.off;
    const world = (x: number, y: number): [number, number] => [(x - this.at.e) / A, (y - this.at.f) / A];
    // the rain's ink: the old additive stroke, and in place of its colour-dodge twin a stronger add (the grade over it
    // keeps it faint on dark ground and bright in the lamps' pools, as the dodge did)
    const ink = (v: number) => v * (0.67 + 0.18 * light.night);
    const inPit = (wx: number, wy: number, pad: number) => descent > 0.02 && wx > PIT.x - pad && wx < PIT.x + PIT.w + pad && wy > PIT.y - pad && wy < PIT.y + PIT.h + pad;
    // the rain: far out the curtain, close in the streaks in their depths and the splashes
    const far = smooth(0.8, 0.38, A), near = 1 - smooth(0.62, 0.34, A);
    if (L.rain > 0.01 && far > 0.01) {
      const slant = 0.22 + WIND.x * L.wind * 0.45, tileH = H + 200, al = [0.3, 0.45, 0.6];
      for (let i = 0; i < 90; i++) {
        const hl = hash(i, 13, 91), len = 60 + 100 * hl, vv = 150 + 90 * hl;
        const y = mod(hash(i, 12, 91) * tileH + vv * t + off.y * 0.9, tileH) - 100, x = mod(hash(i, 11, 91) * (W + 300) + off.x * 0.9 + slant * vv * t, W + 300) - 150;
        const r = S.rainAt(...world(x, y)) * far;
        if (hash(i, 14, 91) <= r * 1.05) sk.line(a, x - slant * len, y - len, x, y, 0.9, RAIN, ink(al[r > 0.7 ? 2 : r > 0.4 ? 1 : 0]! * Math.min(1, far * 1.2)));
      }
      // the front's leading edge, strung across the wind
      for (let i = 0; i < 36 && S.front > -0.3 && S.front < 1.35; i++) {
        const along = (S.front - 0.06 + (hash(i, 21, 91) - 0.5) * 0.07 - 0.5) * 2 * TOWN_HALF, across = (hash(i, 22, 91) - 0.5) * 2.4 * TOWN_HALF;
        const X = (TOWN_C.x + WIND.x * along - WIND.y * across) * A + this.at.e, Y = (TOWN_C.y + WIND.y * along + WIND.x * across) * A + this.at.f;
        if (X < -200 || X > W + 200 || Y < -200 || Y > H + 200) continue;
        const len = 90 + 90 * hash(i, 23, 91), y = Y - len / 2 + mod(t * (0.9 + 0.5 * hash(i, 24, 91)) + hash(i, 25, 91), 1) * len;
        sk.line(a, X - (slant * len) / 2, y - len / 2, X + (slant * len) / 2, y + len / 2, 1.5, RAIN, ink(0.7 * L.rain * Math.min(1, far * 1.2)));
      }
    }
    if (L.rain > 0.01 && near > 0.01) {
      const zf = Math.min(1.9, Math.max(0.6, A ** 0.28)), zc = Math.max(0.75, Math.min(1, 1.2 - 0.25 * zf)), wind = L.wind * (0.75 + 0.5 * S.gust), drop = L.drop;
      const dx0 = Math.sign(WIND.x) * 0.2 + WIND.x * wind * 0.6, dy0 = 1 + WIND.y * wind * 0.25, dl = Math.hypot(dx0, dy0), dx = dx0 / dl, dy = dy0 / dl;
      for (const D of DEPTHS) {
        const len = D.len * zf * (0.35 + 0.65 * drop) * (0.85 + 0.3 * wind), w = Math.max(0.8, D.w * (0.6 + 0.5 * drop) * Math.min(1.5, zf));
        const speed = D.speed * zf * (0.7 + 0.3 * drop), n = Math.round((D.n * zc * D.tw * D.th) / (1600 * 900)), alpha = ink(Math.min(1, D.a * (0.75 + 0.35 * drop) + 0.1));
        for (let i = 0; i < n; i++) {
          const hv = hash(i, 3, D.seed), hr = hash(i, 4, D.seed), vv = speed * (0.85 + 0.3 * hv), l = len * (0.75 + 0.5 * hv);
          const px = mod(hash(i, 1, D.seed) * D.tw + dx * vv * t + off.x * D.par, D.tw), py = mod(hash(i, 2, D.seed) * D.th + dy * vv * t + off.y * D.par, D.th);
          for (let x = px - D.tw; x < W + 40; x += D.tw) for (let y = py - D.th; y < H + 40; y += D.th) {
            if (x < -40 || y < -40) continue;
            const [wx, wy] = world(x, y);
            if (!inPit(wx, wy, 30) && hr <= S.rainAt(wx, wy) ** 0.6 * near * 1.1) sk.line(a, x - dx * l, y - dy * l, x, y, w, RAIN, alpha);
          }
        }
      }
      // splashes: one a world cell (a power of two, so a zoom does not reshuffle them), a ring and a crown
      const sp = near * smooth(0.45, 0.7, A);
      if (A > 0.45 && sp > 0.02) {
        const cell = 2 ** Math.round(Math.log2(40 / A)), [vx, vy] = world(0, 0), [vx1, vy1] = world(W, H);
        const sz = Math.min(9, Math.max(1.6, 3.2 * A ** 0.55)) * (0.7 + 0.4 * drop), crown = sz > 3.2;
        let n = 0;
        for (let i = Math.floor(vx / cell); i < Math.ceil(vx1 / cell) && n < 170; i++) {
          if (inPit(i * cell, PIT.y, cell)) continue;
          for (let j = Math.floor(vy / cell); j < Math.ceil(vy1 / cell) && n < 170; j++) {
            const u = t / 0.62 + hash(i, j, 5), ep = Math.floor(u), age = (u - ep) * 0.62, f = age / 0.3;
            const wx = (i + hash(i + ep * 13, j, 6)) * cell, wy = (j + hash(i, j + ep * 7, 8)) * cell;
            if (age > 0.3 || hash(i, j, ep + 99) > S.rainAt(wx, wy) * sp * 0.9) continue;
            const X = wx * A + this.at.e, Y = wy * A + this.at.f, up = Math.sin((f / 0.5) * Math.PI) * sz * 1.1, s = sz * (0.35 + 0.9 * f);
            if (f < 0.6) sk.ring(this.life, X, Y, sz * (0.3 + f), 0.45, RAIN, ink(0.6));
            if (crown && f < 0.5) for (const q of [-1, 1]) sk.line(a, X + q * s * 0.45, Y - up * 0.35, X + q * s * 0.8, Y - up, 1.1, RAIN, ink(0.75));
            n++;
          }
        }
      }
    }
    // the wind: waving gust lines that end in a curl, and blown grit
    const amt = smooth(0.4, 0.95, L.wind) * k * (1 - 0.6 * clamp01(L.rain * 2));
    if (amt > 0.02) {
      const wl = Math.hypot(WIND.x, WIND.y * 0.6), ux = WIND.x / wl, uy = (WIND.y * 0.6) / wl, sz = Math.min(2.2, Math.max(0.55, A ** 0.3)), ga = Math.min(0.9, 0.65 * amt + 0.15) * 0.5;
      for (let i = 0; i < Math.round(14 * amt); i++) {
        const ph = hash(i, 3, 41), u = t / 2.6 + ph, ep = Math.floor(u), f = u - ep;
        const x = mod((hash(i, ep, 42) * 1.3 - 0.15) * W + off.x, W) + ux * f * 380 * sz, y = mod((hash(i, ep, 43) * 1.1 - 0.05) * H + off.y, H) + uy * f * 380 * sz;
        const len = (90 + 70 * hash(i, ep, 44)) * sz, wave = 10 * sz * (0.6 + 0.6 * hash(i, ep, 45));
        sk.put(a, `gust.${Math.floor(ph * 4)}.${Math.min(11, Math.floor(f * 12))}`, x, y, len / 256, wave / 20, Math.atan2(uy, ux), GRIT, ga);
      }
      for (let i = 0; i < Math.round(60 * amt); i++) {
        const v = 300 + 300 * hash(i, 1, 51), x = mod(hash(i, 2, 51) * W + ux * v * t + off.x, W), y = mod(hash(i, 3, 51) * H + uy * v * t + Math.sin(t * 2 + i) * 6 + off.y, H);
        sk.line(a, x - ux * 5 * sz, y - uy * 5 * sz, x, y, 1.2 * sz, GRIT, ga);
      }
    }
    // lightning: the cold flash over everything (the grade lights it to day), the bolt for its first flickers
    if (S.flash > 0.01) {
      sk.put(a, null, W / 2, H / 2, W, H, 0, FLASH, S.flash * k * 0.25);
      const st = S.strike, X = st.x * A + this.at.e, Y = st.y * A + this.at.f, i = Math.floor(st.x * 7 + st.y * 13) & 3;
      if (t - st.t < 0.26) for (const [part, tint] of [['glow', BOLT_GLOW], ['core', BOLT_CORE]] as const) sk.put(a, `bolt.${i}.${part}`, X, Y, 1, (Y + 20) / 600, 0, tint, k);
    }
    this.town(a, t, light);
  }

  /** The town's wet: puddles and their reflections, the lamps' smears, the runoff, fog banks, halos, eaves, the shaft. */
  private town(a: Atlas, t: number, light: ReturnType<typeof lightOf>): void {
    const S = this.sky, L = S.look, A = this.at.a, T = this.p.town, N = this.p.townNorm, X = this.p.townMul, P = S.puddles;
    const v0 = [-this.at.e / A, -this.at.f / A], v1 = [(this.screen.w - this.at.e) / A, (this.screen.h - this.at.f) / A];
    const out = (x: number, y: number, rx: number, ry: number) => x + rx < v0[0]! || x - rx > v1[0]! || y + ry < v0[1]! || y - ry > v1[1]!;
    if (P > 0.02 && A > 0.3) {
      // close up the puddles in their own colours with the lamps in them; farther out dark water bodies
      const close = smooth(0.75, 0.95, A), dark = light.day > 0.5 ? 0x28343e : 0x0c121a, shimmer = 0.75 + 0.25 * Math.sin(t * 9);
      let refl = 40;
      for (const [x, y, rx, ry, v, g, rs] of M.town.puddles) {
        const grow = clamp01((P - (1 - g) * 0.55) / 0.45), k = Math.sqrt(grow);
        if (grow <= 0.02 || out(x, y, rx * k, ry * k)) continue;
        const al = close * (0.42 + 0.38 * grow) * (0.8 + 0.2 * light.day) + (1 - close) * (0.5 + 0.25 * P);
        N.put(a, `puddle.${v}`, x, y, (rx * k) / 70, (ry * k) / 28, 0, close > 0.5 ? 0xffffff : dark, al);
        if (close <= 0 || grow <= 0.05 || --refl < 0) continue;
        for (const [col, rk, dx] of rs) {
          const ra = close * rk * grow * (0.55 + 0.45 * light.night) * (1 - 0.35 * S.rainAt(x, y) * shimmer);
          if (ra >= 0.03) T.put(a, 'smear', x + dx * rx * k, y - ry * k * 0.9, (rx * k * 0.5) / 24, (ry * k * 1.6) / 96, 0, rgb(col), Math.min(0.9, ra));
        }
      }
    }
    if (S.wetness > 0.05 && A > 0.25) {
      // every lamp smears a broken streak of its light down the wet street
      const k0 = S.wetness * (0.45 + 0.55 * light.night) * 0.55 * smooth(0.25, 0.4, A);
      let n = 60;
      for (const [x, y, r, col, k] of M.town.lamps) if (!out(x, y, r, r) && --n >= 0) T.put(a, 'smear', x, y + r * 0.05, (r * 0.16) / 24, (r * 0.62) / 96, 0, rgb(col), Math.min(0.8, k0 * k));
    }
    const [sx, sy, srx, sry] = M.town.shaft;
    if (S.wetness > 0.2 && A > 0.35 && !out(sx, sy, srx * 4, sry * 4)) {
      // the runoff into the pit: dark wet channels, a pale thread of water, glints running down
      const flow = smooth(0.2, 0.8, S.wetness);
      M.town.rills.forEach((r, ri) => {
        for (let i = 2; i < r.length; i += 2) {
          X.line(a, r[i - 2]!, r[i - 1]!, r[i]!, r[i + 1]!, 5, 0x080c10, 0.35 * flow);
          N.line(a, r[i - 2]!, r[i - 1]!, r[i]!, r[i + 1]!, 0.9, 0x6e808c, 0.35 * flow);
        }
        for (let d = 0; d < 3; d++) {
          const f = mod(t * 0.35 + d / 3 + hash(r.length / 2, d, ri), 1) * (r.length / 2 - 1), i = Math.floor(f), u = f - i;
          const x0 = r[i * 2]!, y0 = r[i * 2 + 1]!, x1 = r[i * 2 + 2] ?? x0, y1 = r[i * 2 + 3] ?? y0;
          const x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u, ex = (x1 - x0) * 0.25, ey = (y1 - y0) * 0.25;
          T.line(a, x - ex, y - ey, x + ex, y + ey, 1.6, WATER, 0.35 + 0.4 * light.day);
        }
      });
    }
    if (L.fog > 0.04) {
      // the milky air over what is seen, and banks pooling in the low streets under a screen-area budget
      const amt = smooth(0.04, 0.85, L.fog), tint = 0.55 + 0.45 * Math.max(light.day, light.dawn), drift = 6 + 22 * L.wind;
      N.put(a, null, (v0[0]! + v1[0]!) / 2, (v0[1]! + v1[1]!) / 2, v1[0]! - v0[0]!, v1[1]! - v0[1]!, 0, light.day > 0.5 ? 0xc9d0d4 : 0x7d8890, Math.min(0.3, amt * 0.2 * (0.6 + 0.4 * tint)));
      let area = 0.3 * this.screen.w * this.screen.h;
      const seen = { a: 0, s: 0 }, at = (x: number, y: number) => (this.fog.sample(1, x, y, seen), seen.s);
      for (const [fx, fy, s, seed] of this.fogOrder) {
        const ph = fx * 0.013 + fy * 0.007, w = s * (1.6 + 0.8 * amt), h = w * 0.26;
        const x = fx + Math.sin(t * 0.05 + ph) * 60 + WIND.x * drift * Math.sin(t * 0.03 + ph) * 8, y = fy + Math.cos(t * 0.04 + ph) * 25;
        if (out(x, y, w / 2, h / 2)) continue;
        const c = Math.min(at(x, y), at(x - w * 0.4, y), at(x + w * 0.4, y));
        if (c < 0.05) continue;
        if (area <= 0) break;
        const fit = Math.min(1, area / (w * h * A * A));
        area -= w * h * A * A;
        N.put(a, `fogbank.${seed}`, x, y, w / 256, h / 64, 0, 0xd6dcde, amt * 0.75 * tint * (0.6 + 0.4 * hash(seed, 3, 0)) * c * fit);
      }
    }
    // the lamps' light caught in fog
    const hk = L.fog * smooth(0.25, 0.45, L.fog) * (0.35 + 0.65 * light.night) * 0.35;
    if (hk > 0.01 && A > 0.45) {
      let n = 30;
      for (const [x, y, r, col, k] of M.town.lamps) if (!out(x, y, r, r) && --n >= 0) T.put(this.life, 'glow-0', x, y - r * 0.05, r / 64, r / 64, 0, rgb(col), Math.min(0.5, hk * k));
    }
    if (S.wetness > 0.12 && A > 1.1) {
      // the eaves: water running off every front edge, the drops and their rings
      const rate = 0.5 + 1.4 * S.rainAt((v0[0]! + v1[0]!) / 2, (v0[1]! + v1[1]!) / 2);
      for (const [x, y, rx, ry, h] of M.town.casters) {
        const front = y + ry, face = Math.min(h * 0.4, 22), n = Math.max(2, Math.round(rx / 9));
        if (out(x, front - h / 2, rx, h)) continue;
        X.line(a, x - rx * 0.85, front + 2, x + rx * 0.85, front + 2, 3, 0x000000, 0.16 * S.wetness);
        for (let k = 0; k < n; k++) {
          const hx = hash(x | 0, k, 61), dx = x + ((k + 0.5) / n - 0.5) * rx * 1.7, u = (t * rate) / (0.9 + 1.2 * hash(y | 0, k, 62)) + hx, f = u - Math.floor(u);
          const y0 = front - face, y1 = front + 3 - Math.abs((k + 0.5) / n - 0.5) * ry * 0.4, yy = y0 + (y1 - y0) * (f / 0.4) ** 2;
          if (hx > 0.35 + 0.65 * S.wetness) continue;
          if (f < 0.4) T.line(a, dx, yy - 2.5, dx, yy, 1.1, WATER, 0.55);
          else if (f < 0.75) T.ring(this.life, dx, y1, 1 + (3 * (f - 0.4)) / 0.35, 0.45, WATER, 0.16);
        }
      }
    }
    const rain = S.rainAt(sx, sy);
    if (rain > 0.02 && A > 0.5 && !out(sx, sy, srx, sry)) {
      // rain falling into the shaft, dimming into the dark
      for (let i = 0; i < Math.round(40 * rain); i++) {
        const x = sx + (hash(i, 2, 9) - 0.5) * srx * 1.8, y = sy - sry + mod(t * 1.3 + hash(i, 1, 9), 1) * sry * 2.2;
        if (((x - sx) / srx) ** 2 + ((y - sy) / sry) ** 2 < 0.9) T.line(a, x, y, x + WIND.x * 2, y + 7, 0.9, WATER, 0.35);
      }
    }
  }

  /**
   * The mine's wet (mine units), as the mine renderer drew it where the zone is Active: water rising in the low workings'
   * pools (assets/weather `pool.<i>.<level>`, clipped to the floor) with slow ripples, drips from the wet faces' feet and
   * their rings (faster as the wet seeps down), rain and mist down the shaft; each by the baked light reach (`keep`).
   */
  private underground(a: Atlas, t: number, light: ReturnType<typeof lightOf>, zoom: number): void {
    const S = this.sky, P = this.p, px = scale(zoom) * MINE_FRAME.per, seen = { a: 0, s: 0 }, { pools, drips, shaft } = M.mine;
    const col = (x: number, y: number) => (this.fog.sample(0, x, y, seen), seen.a);
    // a line under a device px keeps its width there and gives up its ink as a canvas's coverage did
    const thin = (w: number) => Math.max(w, 1 / px), ink = (w: number) => Math.min(1, w * px);
    const w = clamp01(quant(S.flood, 40));
    for (let i = 0; i < pools.length && w > 0.01; i++) {
      const [x, y, rx, ry, chamber, lv, ax, ay] = pools[i]!, m = Math.min(1.6, chamber ? Math.max(0, w - 0.25) * 1.3 : 1 + 0.55 * w), al = m > 0.01 ? col(ax, ay) : 0;
      if (al <= 0.01) continue;
      const j = lv.findIndex((l) => l >= m), k = m / lv[j]! / a.cell(`pool.${i}.${j}`)[4], RX = rx * m, RY = ry * m;
      P.mineNorm.put(a, `pool.${i}.${j}`, x, y, k, k, 0, 0xffffff, al);
      for (let r = 0; r < 4; r++) {
        const u = (t * 0.18 + r * 0.25) % 1, R = RX * (0.2 + 0.6 * u);
        P.mine.ring(this.life, x + RX * 0.15 * Math.sin(r * 2.1), y + RY * 0.1 * Math.cos(r * 1.3), R, (0.7 * RY) / RX, 0x78aaaf, 0.12 * Math.sin(u * Math.PI) * al, '0.7');
      }
    }
    const rate = Math.min(4, Math.max(0.25, quant(S.seep(), 8)));
    for (const [x, y0, y1, period, ph, keep] of drips) {
      const al = keep > 0.02 ? col(x, y1) * keep : 0, per = period / rate, u = mod(t + ph, per) / per;
      if (al <= 0.02) continue;
      if (u < 0.32) P.mine.line(a, x, y0 + (y1 - y0) * (u / 0.32) ** 2 - 3, x, y0 + (y1 - y0) * (u / 0.32) ** 2, thin(0.9), 0xc8e6f0, 0.6 * al * ink(0.9));
      else if (u < 0.72) P.mine.ring(this.life, x, y1, 1 + 6 * ((u - 0.32) / 0.4), 0.45, 0xaad2dc, 0.4 * (1 - (u - 0.32) / 0.4) * al, '0.7');
    }
    const [sx, sy, keep] = shaft, rk = clamp01(quant(S.look.rain * Math.max(0.3, S.cover()), 20)), al = rk > 0.01 ? keep * col(sx, sy + 10) : 0;
    if (al > 0.02) {
      for (let i = 0; i < Math.round(26 * rk); i++) {
        const h = hash(i, 1, 23), u = mod(t * (1.4 + h) + h * 10, 1), x = sx - 26 + hash(i, 2, 23) * 52 + u * 6, y = sy - 190 + u * 200;
        P.mine.line(a, x - 1.5, y - 9, x, y, thin(0.8), 0xcddce6, 0.35 * rk * al * Math.min(1, (1 - u) * 4) * ink(0.8));
      }
      P.mine.put(this.life, 'glow-0', sx, sy + 18, 70 / 32, 35 / 32, 0, 0x9fb0b6, 0.22 * rk * al * (1 - 0.4 * (1 - light.day)));
    }
  }
}
