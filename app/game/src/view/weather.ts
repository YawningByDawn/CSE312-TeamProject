import { Container, Sprite, Texture, type Renderer } from 'pixi.js';
import type { AtlasManifest, Layer, Query, ViewModel } from '../types';
import { MINE_FRAME } from '../content/map';
import { scale } from './camera';
import { Atlas } from './atlas';
import { layerRoot, pit } from './quad';
import { clamp01, differs, hash, mod, quant, smooth } from './tables';
import type { Sky } from './sky';
import type { Fog } from './fog';
import raw from '../../assets/weather/manifest.json';

// The mine's weather (#74) as the old game showed it (the mine renderer's own): assets/weather's cells placed afresh
// each step of the clock (STEP_HZ) by the sky (sky.ts). Water rising in the low workings' pools, drips from the wet
// faces' feet (faster as the wet seeps down), rain and mist down the shaft. The atlas (BC3) is fetched on the first frame.

interface Manifest extends AtlasManifest {
  mine: {
    drips: [x: number, y0: number, y1: number, period: number, ph: number, keep: number][]; shaft: [x: number, y: number, keep: number];
    pools: [x: number, y: number, rx: number, ry: number, chamber: number, levels: number[], ax: number, ay: number][];
  };
}
const M = raw as unknown as Manifest;
const FILES = import.meta.glob('../../assets/weather/weather*.bc3', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const URLS = Array.from({ length: M.levels }, (_, i) => FILES[`../../assets/weather/weather${i ? `@${i}` : ''}.bc3`]!);

const STEP_HZ = 30;

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
  private readonly mine = pit();
  private readonly p = { mineNorm: new Pool('normal'), mine: new Pool('add') };
  private readonly shown: number[] = [];

  constructor(private readonly q: Query, private readonly sky: Sky, private readonly fog: Fog, private readonly life: Atlas,
    private readonly renderer: Renderer) {
    this.mine.addChild(this.p.mineNorm.c, this.p.mine.c);
    this.root.addChild(this.mine);
  }

  frame(vm: ViewModel): boolean {
    const cam = vm.camera;
    if (!this.atlas) {
      if (!this.loading) {
        this.loading = true;
        void Atlas.load(this.renderer, M, URLS).then((a) => (this.atlas = a));
      }
      return false;
    }
    const step = Math.floor(vm.time * STEP_HZ);
    if (!differs(this.shown, step, cam.x, cam.y, cam.zoom)) return false;
    this.underground(this.atlas, step / STEP_HZ, lightOf(this.q, this.q.hour(vm.state.tick)), cam.zoom);
    let any = false;
    for (const p of Object.values(this.p)) if (p.end()) any = true;
    return any;
  }

  /**
   * The mine's wet (mine units), as the mine renderer drew it where the zone is Active: water rising in the low workings'
   * pools (assets/weather `pool.<i>.<level>`, clipped to the floor) with slow ripples, drips from the wet faces' feet and
   * their rings (faster as the wet seeps down), rain and mist down the shaft; each by the baked light reach (`keep`).
   */
  private underground(a: Atlas, t: number, light: ReturnType<typeof lightOf>, zoom: number): void {
    const S = this.sky, P = this.p, px = scale(zoom) * MINE_FRAME.per, seen = { a: 0, s: 0 }, { pools, drips, shaft } = M.mine;
    const col = (x: number, y: number) => (this.fog.sample(x, y, seen), seen.a);
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
