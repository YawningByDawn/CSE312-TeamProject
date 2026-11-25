import { Container, type Renderer, type Sprite } from 'pixi.js';
import { layerRoot, quad, uniforms, type Uniforms } from './quad';
import type { AtlasManifest, Layer, Query, ViewModel } from '../types';
import { below, scale } from './camera';
import { dataTexture, decode, upload } from './pictures';
import { bilinear, clamp01, differs, hash, hex, smooth } from './tables';
import { pool, type Atlas } from './atlas';
import type { Fog } from './fog';

// The land round the town (#66): assets/valley's far picture of the whole land and its four near tiles in one mesh whose
// shader lights them by the hour (day even, copper dusk, night drained to a dim teal-gray), grays what is only Sensed and
// cuts them by the known-ground mask (fog.worker.ts, eased in on the GPU). Over it the live lights (the war past the
// mountains, the city, waystation lamps, hearths, the tarn's glints, glow-moss, the carts on the road) are life-atlas
// glows weighted by the same mask. The land lies over the town's grade: it carries its own light of the hour.

type Manifest = AtlasManifest & { rect: [number, number, number, number] };
type MaskManifest = AtlasManifest & {
  gw: number; gh: number; road: { x: number; y: number }[];
  live: { fires: { x: number; y: number; ph: number; r: number }[]; lamps: { x: number; y: number; ph: number; col: string; r: number }[]; moss: { x: number; y: number; ph: number }[] };
};
const MANIFESTS = import.meta.glob('../../assets/valley/*/manifest.json', { eager: true, import: 'default' }) as Record<string, Manifest>;
const URLS = import.meta.glob('../../assets/valley/*/valley.{webp,png}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const at = (dir: string): { m: Manifest; url: string } => {
  const m = MANIFESTS[`../../assets/valley/${dir}/manifest.json`]!;
  return { m, url: URLS[`../../assets/valley/${dir}/${m.file}`]! };
};
const NEAR = ['n00', 'n10', 'n01', 'n11'] as const, MASK = at('mask').m as unknown as MaskManifest, RECT = at('far').m.rect;

/** CSS px per world unit at which the land is fully shown / starts to show; past the town's reach it shows from closer in. */
const S_FULL = 0.2, S_NONE = 0.42, S_FAR_NONE = 0.62, S_FAR_FULL = 0.46;
/** The near tiles show once a world unit is more than NEAR_PX device px; they end NEAR_INSET units inside their outer
 * edges, so no filtered sample reads past a tile's last texels. */
const NEAR_PX = 0.11, NEAR_INSET = 32;
/** The mask eases toward a change at this rate (1/s), settling within EASE_EPS. */
const EASE = 5, EASE_EPS = 0.004;
/** The city and the tarn (world units): the dome's lamps, the still water's glints. */
const CITY = { x: 10100, y: -2500 }, TARN = { x: -3500, y: 4300, rx: 700, ry: 420 };
const STEP_HZ = 10;

const FRAG = /* glsl */ `
uniform sampler2D uFar; uniform sampler2D uN0; uniform sampler2D uN1; uniform sampler2D uN2; uniform sampler2D uN3;
uniform sampler2D uMask; uniform sampler2D uMaskTo; uniform float uEase;
uniform vec4 uMapF; uniform vec4 uMap0; uniform vec4 uMap1; uniform vec4 uMap2; uniform vec4 uMap3;
uniform vec4 uNear; uniform vec4 uValley;
uniform float uNearOn; uniform vec3 uLight; uniform float uDesat; uniform float uK; uniform float uFarK;
const vec3 LUM = vec3(0.3, 0.59, 0.11);
vec4 land(sampler2D t, vec4 m, vec2 dx, vec2 dy) { return textureGrad(t, m.xy + vW * m.zw, dx * m.zw, dy * m.zw); }
void main() {
  vec2 dx = dFdx(vW), dy = dFdy(vW);
  // R known x the town cut, G how gray (Sensed), B the far weight: eased from the mask shown to the last
  vec2 p = (vW - uValley.xy) / uValley.zw;
  vec4 m = mix(texture(uMask, p), texture(uMaskTo, p), uEase);
  vec2 n = (vW - uNear.xy) / uNear.zw;
  vec4 c;
  if (uNearOn > 0.5 && n.x >= 0.0 && n.y >= 0.0 && n.x < 1.0 && n.y < 1.0) {
    if (n.y < 0.5) c = n.x < 0.5 ? land(uN0, uMap0, dx, dy) : land(uN1, uMap1, dx, dy);
    else c = n.x < 0.5 ? land(uN2, uMap2, dx, dy) : land(uN3, uMap3, dx, dy);
  } else c = land(uFar, uMapF, dx, dy);
  vec3 col = mix(c.rgb, vec3(dot(c.rgb, LUM)), uDesat) * uLight;
  col = mix(col, vec3(dot(col, LUM)), m.g) * mix(1.0, 178.0 / 255.0, m.g);
  o = vec4(col, c.a) * (m.r * (uK + (uFarK - uK) * m.b));
}`;

/** The light of the hour on the land: a multiply colour and how far colour is drained, from the daylight and the sun. */
function landLight(day: number, sun: number): { rgb: [number, number, number]; desat: number } {
  const dusk = Math.exp(-(((sun - 0.08) / 0.2) ** 2)) * smooth(-0.3, -0.05, sun);
  const n = [0.5, 0.62, 0.66], d = [1.0, 0.96, 0.9], k = [0.98, 0.58, 0.34];
  const rgb = [0, 1, 2].map((i) => (n[i]! + (d[i]! - n[i]!) * day) * (1 - dusk * 0.7) + k[i]! * dusk * 0.7) as [number, number, number];
  return { rgb, desat: 0.62 * (1 - day) * (1 - dusk) };
}

/** The known-ground mask on the GPU, as fog.ts hands it in: each new one eases in from the one shown (the first at once). */
export class Land {
  readonly from: ReturnType<typeof dataTexture>;
  readonly to: ReturnType<typeof dataTexture>;
  private any = false;
  private t = 0;
  /** the ease's weight toward the last mask, 0..1; a mask arrived since the last frame */
  ease = 1;
  fresh = false;

  constructor(renderer: Renderer) {
    [this.from, this.to] = [dataTexture(renderer, MASK.gw, MASK.gh), dataTexture(renderer, MASK.gw, MASK.gh)];
  }

  take(m: Uint8Array): void {
    const e = this.any ? this.ease : 1, fb = this.from.bytes, tb = this.any ? this.to.bytes : m;
    for (let j = 0; j < fb.length; j++) fb[j] = Math.round(fb[j]! + (tb[j]! - fb[j]!) * e);
    this.to.bytes.set(m);
    [this.ease, this.any, this.t, this.fresh] = [this.any ? 0 : 1, true, 0, true];
    this.from.send();
    this.to.send();
  }

  /** The ease on by `dt` s; true when it moved. */
  step(dt: number): boolean {
    if (this.ease >= 1) return false;
    this.t += dt;
    this.ease = 1 - Math.exp(-this.t * EASE);
    if (this.ease > 1 - EASE_EPS) this.ease = 1;
    return true;
  }

  /** At a world point, bilinear as eased: seen and coloured (each x the town cut), and the far weight. */
  weigh(x: number, y: number, out: { c: number; s: number; far: number }): void {
    const [rx, ry, rw, rh] = RECT, W = MASK.gw, H = MASK.gh, e = this.ease, fx = ((x - rx) / rw) * W - 0.5, fy = ((y - ry) / rh) * H - 0.5;
    const v = (f: (B: Uint8Array, j: number) => number) => {
      const one = (B: Uint8Array) => bilinear((xx, yy) => (xx < 0 || yy < 0 || xx >= W || yy >= H ? 0 : f(B, (yy * W + xx) * 4)), fx, fy);
      return (one(this.from.bytes) * (1 - e) + one(this.to.bytes) * e) / 255;
    };
    out.s = v((B, j) => B[j]!);
    out.c = v((B, j) => (B[j]! * (255 - B[j + 1]!)) / 255);
    out.far = v((B, j) => B[j + 2]!);
  }
}

/** One live light: where, how big (world units, and at least `minPx` device px), its colours lit and Sensed. */
interface Lamp { x: number; y: number; r: number; minPx: number; lit: Sprite; dim: Sprite; v: (t: number, night: number) => number }

export class Valley implements Layer {
  /** over the town's grade: the land has its own light of the hour */
  readonly name = 'land';
  readonly root = layerRoot(new Container());
  private readonly uni: Uniforms;
  private readonly lights = new Container();
  private readonly lamps: Lamp[] = [];
  private readonly carts: { lit: Lamp; core: Lamp; c: number; fade: number }[] = [];
  private readonly roadLen = [0];
  private last = { time: NaN, step: -1 };
  private readonly shown: number[] = [];
  private readonly w = { c: 0, s: 0, far: 0 };

  private constructor(private readonly q: Query, private readonly land: Land, private readonly dpr: number, tex: Record<string, unknown>, maps: Record<string, number[]>, life: Atlas) {
    const near = at('n00').m.rect, far = at('n11').m.rect;
    this.uni = uniforms({
      uMapF: maps.far!, uMap0: maps.n00!, uMap1: maps.n10!, uMap2: maps.n01!, uMap3: maps.n11!, uValley: RECT,
      uNear: [near[0] + NEAR_INSET, near[1] + NEAR_INSET, far[0] + far[2] - near[0] - 2 * NEAR_INSET, far[1] + far[3] - near[1] - 2 * NEAR_INSET],
      uNearOn: 0, uLight: [1, 1, 1], uDesat: 0, uK: 0, uFarK: 0, uEase: 1,
    });
    const mesh = quad('hg-valley', FRAG, RECT, { uFar: tex.far, uN0: tex.n00, uN1: tex.n10, uN2: tex.n01, uN3: tex.n11, uMask: land.from.tex.source, uMaskTo: land.to.tex.source, valleyUniforms: this.uni });
    this.lights.blendMode = 'add';
    this.root.addChild(mesh, this.lights);
    const p = MASK.road;
    for (let i = 1; i < p.length; i++) this.roadLen.push(this.roadLen[i - 1]! + Math.hypot(p[i]!.x - p[i - 1]!.x, p[i]!.y - p[i - 1]!.y));
    this.light(life);
  }

  /** The land's pictures, and its mask from the field worker (asked for from now on). */
  static async load(renderer: Renderer, q: Query, dpr: number, life: Atlas, fog: Fog): Promise<Valley> {
    const dirs = ['far', ...NEAR] as const, pics = await Promise.all(dirs.map((d) => decode(at(d).url)));
    const tex: Record<string, unknown> = {}, maps: Record<string, number[]> = {};
    dirs.forEach((d, i) => {
      const { m } = at(d), [cx, cy, , , k, ax, ay] = m.cells.land!, [rx, ry] = m.rect;
      tex[d] = upload(renderer, pics[i]!).source;
      maps[d] = [(cx + ax - rx * k) / m.w, (cy + ay - ry * k) / m.h, k / m.w, k / m.h];
    });
    const land = (fog.land = new Land(renderer));
    return new Valley(q, land, dpr, tex, maps, life);
  }

  /** The live lights, placed once; their strength by the clock and the night. */
  private light(life: Atlas): void {
    const lamp = (x: number, y: number, r: number, minPx: number, col: string, gray: string, v: Lamp['v']): Lamp => {
      const mk = (c: string) => this.lights.addChild(life.glow('glow-0', x, y, r, hex(c)));
      const l: Lamp = { x, y, r, minPx, lit: mk(col), dim: mk(gray), v };
      this.lamps.push(l);
      return l;
    };
    const nk = (night: number) => 0.25 + 0.75 * night, late = (n: number) => Math.max(0, (n - 0.3) / 0.7), { fires, lamps, moss } = MASK.live;
    // the war past the mountains: always there, brightest at night
    for (let i = 0; i < 7; i++) {
      const x = 1500 + i * 1800 + Math.sin(i * 2.3) * 500, y = -5300 + Math.cos(i * 1.7) * 250;
      const br = (t: number) => 0.8 + 0.2 * Math.sin(t * 0.17) + 0.08 * Math.sin(t * 1.3);
      lamp(x, y, 2600 + 500 * Math.sin(i), 0, '#a82c20', '#5a5a5a', (t, n) => 0.55 * br(t) * (0.5 + 0.5 * nk(n)));
      lamp(x + 300, y + 300, 900, 0, '#e2563f', '#8a8a8a', (t, n) => 0.45 * br(t) * nk(n) * (0.6 + 0.4 * Math.sin(t * 0.7 + i * 2)));
    }
    // the city: the dome's gold, the towers' cold lamps
    lamp(CITY.x, CITY.y, 2400, 0, '#d39a52', '#808080', (_, n) => 0.35 + 0.45 * nk(n));
    lamp(CITY.x, CITY.y, 700, 0, '#ffd479', '#bdbdbd', (_, n) => 0.3 + 0.5 * nk(n));
    for (const p of lamps) lamp(p.x, p.y, p.r, 1.6, p.col, '#9a9a9a', (t, n) => (0.2 + 0.8 * nk(n)) * (0.85 + 0.15 * Math.sin(t * 2.1 + p.ph * 9)));
    // broad warm pools round the hearths: by night they carry the picture
    for (const f of fires) lamp(f.x, f.y, 520, 8, '#a8743e', '#6a6a6a', (_, n) => 0.32 * nk(n) * nk(n));
    for (const f of fires) {
      const fl = (t: number) => 0.75 + 0.25 * Math.sin(t * 5.3 + f.ph * 7) * Math.sin(t * 3.1 + f.ph * 3);
      lamp(f.x, f.y, f.r * 5, 2.4, '#d39a52', '#7a7a7a', (t, n) => (0.18 + 0.6 * nk(n)) * fl(t));
      lamp(f.x, f.y, f.r * 1.4, 1.2, '#ffd479', '#c0c0c0', (t, n) => (0.4 + 0.6 * nk(n)) * fl(t));
    }
    // by night the tarn catches the sky, and the glow-moss pulses
    for (let i = 0; i < 6; i++) {
      lamp(TARN.x + Math.cos(i * 2.4) * TARN.rx * 0.55, TARN.y + Math.sin(i * 1.7) * TARN.ry * 0.5, 90, 1.6, '#8fd0c8', '#9a9a9a', (t, n) => 0.5 * Math.max(0, Math.sin(t * 0.45 + i * 1.9)) * late(n));
    }
    for (const m of moss) lamp(m.x, m.y, 160, 2, '#5f857d', '#6a6a6a', (t, n) => 0.35 * (0.5 + 0.5 * Math.sin(t * 0.6 + m.ph * 6.28)) * late(n));
    // the Council's crystal carts, shard-lamps cold: four going up to the city, one coming back
    for (let c = 0; c < 5; c++) {
      const cart = { c, fade: 0 } as (typeof this.carts)[number], v = (k: number) => (_: number, n: number) => k * cart.fade * (0.3 + 0.7 * nk(n));
      cart.lit = lamp(0, 0, 90, 4.2, '#c3c9d8', '#9a9a9a', v(0.3));
      cart.core = lamp(0, 0, 30, 1.4, '#eef3ff', '#d0d0d0', v(0.85));
      this.carts.push(cart);
    }
  }

  frame(vm: ViewModel): boolean {
    const zoom = vm.camera.zoom, a = scale(zoom), surface = 1 - below(zoom), L = this.last, K = this.land;
    const k = smooth(S_NONE, S_FULL, a) * surface, far = Math.max(k, smooth(S_FAR_NONE, S_FAR_FULL, a) * surface);
    const dt = Number.isNaN(L.time) ? 0 : Math.max(0, vm.time - L.time);
    L.time = vm.time;
    let changed = false;
    if (K.step(dt) || K.fresh) K.fresh = false, (this.uni.uniforms.uEase = K.ease), (changed = true);
    if (far <= 0.003) {
      const was = this.root.visible;
      this.root.visible = false;
      this.shown.length = 0;
      return was;
    }
    const hour = this.q.hour(vm.state.tick);
    if (differs(this.shown, zoom, hour)) {
      this.root.visible = true;
      const day = this.q.daylight(hour), lit = landLight(day, Math.sin(((hour - 6) / 12) * Math.PI)), u = this.uni.uniforms;
      (u.uLight as Float32Array).set(lit.rgb);
      Object.assign(u, { uDesat: lit.desat, uK: k, uFarK: far, uNearOn: this.dpr * a > NEAR_PX ? 1 : 0 });
      changed = true;
    }
    const step = Math.floor(vm.time * STEP_HZ);
    if (changed || step !== L.step) {
      L.step = step;
      this.place(step / STEP_HZ, 1 - this.q.daylight(hour), a * this.dpr, k, far);
      changed = true;
    }
    return changed;
  }

  /** Every live light for clock `t`: strength by the night, weight by the mask and the zoom, size at least its px. */
  private place(t: number, night: number, px: number, k: number, far: number): void {
    const total = this.roadLen[this.roadLen.length - 1]!, w = this.w;
    for (const cart of this.carts) {
      const c = cart.c, u = ((t / 160 + c * 0.21 + hash(c, 3, 9) * 0.08) % 1 + 1) % 1, p = this.along((c === 4 ? 1 - u : u) * total);
      cart.fade = smooth(0, 0.04, u) * smooth(1, 0.94, u);
      cart.lit.x = cart.core.x = p.x;
      cart.lit.y = cart.core.y = p.y;
    }
    for (const l of this.lamps) {
      this.land.weigh(l.x, l.y, w);
      const z = k + (far - k) * w.far, c = w.c * z, g = Math.max(0, w.s - w.c) * z, v = l.v(t, night), r = Math.max(l.r, l.minPx / px);
      pool(l.lit, l.x, l.y, r).visible = c * v > 0.01;
      pool(l.dim, l.x, l.y, r).visible = g * v > 0.01;
      l.lit.alpha = Math.min(1, v * c);
      l.dim.alpha = Math.min(1, v * g * 0.6);
    }
  }

  /** The point `d` units along the cart road. */
  private along(d: number): { x: number; y: number } {
    const p = MASK.road, L = this.roadLen;
    let i = 1;
    while (i < p.length - 1 && L[i]! < d) i++;
    const a = p[i - 1]!, b = p[i]!, t = clamp01((d - L[i - 1]!) / (L[i]! - L[i - 1]! || 1));
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }
}
