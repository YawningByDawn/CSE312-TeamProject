import { Container, Filter, GlProgram, Sprite, Texture, defaultFilterVert, type Renderer } from 'pixi.js';
import type { AtlasManifest, Camera, Film, GameEvent, Layer, PlaceId, ViewModel } from '../../types';
import { AT, MINE_FRAME, SHAFT, TOWN } from '../../content/map';
import { AREAS } from '../../content/world';
import { GRADES } from '../../content/crystals';
import { ORIGIN, scale } from '../camera';
import { Atlas } from '../atlas';
import type { People } from '../life/people';
import { anchor, GRAVE_AT, type Anchor } from '../life/fx';
import defeatManifest from '../../../assets/defeat/manifest.json';
import defeatUrl from '../../../assets/defeat/defeat.png?url';

// The camera's films and its feel (#7, #90, #91, #93, #94). App owns the one camera: during a film it asks `pose` for
// the film's keyed camera (monotone between keys) and the camera ends on the film's last pose. The view draws that
// camera shaken, punched and leant by what just happened, its clock held still through a hit-stop. Over the world: the
// watershed's glowing point of the mine, the pit head's glow and the lift's load rising; the ending's procession, the far city's gold and the
// war's red, the closing dark; the defeat's drain to gray then black, closing on the grave's eye (assets/defeat's
// ramps). The words over them are the panels'.

/** Seconds each film runs. The opening waits on its pictures (INTRO). */
const LENGTH: Record<Film['kind'], number> = { opening: 0, watershed: 22, ending: 33.5, take: 3.2 };
export const filmLength = (kind: Film['kind']): number => LENGTH[kind];

/** The zoom showing `px` screen px per town unit on the 1600-wide canvas the old films were keyed on. */
const zoomAt = (px: number): number => Math.log2(15 / (px * 0.8)) / 2.41;
const mine = (x: number, y: number): [number, number] => [MINE_FRAME.x + x / MINE_FRAME.per, MINE_FRAME.y + y / MINE_FRAME.per];
const CAGE = mine(SHAFT.mine[0], SHAFT.mine[1]);
const MOUTH = SHAFT.town;
/** the town at rest, the far city (town units) and its reach */
const HOME: [number, number, number] = [TOWN.w / 2, TOWN.h / 2, zoomAt(0.55)];
const CITY = [10100, -2500] as const, CITY_R = 1500;
const GATE = AT.citygate!, MARKET = AT.market!;
const road = (u: number, dy = 0): [number, number] => [GATE[0] + (CITY[0] - GATE[0]) * u, GATE[1] + (CITY[1] - GATE[1]) * u + dy];
const lerp2 = (a: readonly number[], b: readonly number[], k: number): [number, number] => [a[0]! + (b[0]! - a[0]!) * k, a[1]! + (b[1]! - a[1]!) * k];
const G = [GRAVE_AT.x, GRAVE_AT.y - 6] as const;

/** A film's keys after its first (the camera it starts from): seconds, town x, y, zoom. */
const KEYS: Record<'watershed' | 'ending', readonly (readonly number[])[]> = {
  watershed: [
    [1.6, ...G, zoomAt(6.2)], [3, ...G, zoomAt(6.324)], [5.6, G[0] + (CAGE[0] - G[0]) * 0.5, G[1] + (CAGE[1] - G[1]) * 0.6, zoomAt(4.5)],
    [8, MOUTH[0], MOUTH[1] - 4, zoomAt(3.1)], [10.2, MOUTH[0], MOUTH[1], zoomAt(1.55)], [12.3, MOUTH[0], MOUTH[1] + 4, zoomAt(0.86)],
    [14.5, MOUTH[0], MOUTH[1] + 8, zoomAt(0.56)], [17.2, ...lerp2(MOUTH, HOME, 0.7), HOME[2]], [18.8, ...lerp2(MOUTH, HOME, 0.95), HOME[2]],
    [20.4, ...HOME], [22, ...HOME],
  ],
  ending: [
    [1.4, MARKET[0] + 60, MARKET[1] - 10, zoomAt(1.05)], [5.5, ...lerp2([MARKET[0] + 60, MARKET[1] - 10], GATE, 0.3), zoomAt(0.8)],
    [8.5, ...lerp2([MARKET[0] + 60, MARKET[1] - 10], GATE, 0.45), HOME[2] + 0.03], [12, ...lerp2(GATE, road(0.3), 0.7), zoomAt(0.15)],
    [16, ...road(0.7, 300), zoomAt(0.115)], [20.5, CITY[0] - 0.32 * CITY_R, CITY[1] + 0.3 * CITY_R, zoomAt(0.21)],
    [29, CITY[0] - 0.1 * CITY_R, CITY[1] + 0.12 * CITY_R, zoomAt(0.2436)], [33.5, CITY[0] - 0.1 * CITY_R, CITY[1] + 0.12 * CITY_R, zoomAt(0.2436)],
  ],
};

/** The watershed's point (s): the mine is one point and the town the god knows opens outward from the pit. */
const POINT = 14.5;
const TOWN_AREAS = (Object.keys(AREAS) as PlaceId[]).filter((a) => AREAS[a]!.region === 'town' && a !== 'minehead' && AT[a]);
const reach = (a: PlaceId): number => Math.hypot(AT[a]![0] - MOUTH[0], (AT[a]![1] - MOUTH[1]) * 1.3);
const FAR = Math.max(1, ...TOWN_AREAS.map(reach));
/** When (film seconds) a town area opens in the watershed, nearest the pit first; until then it is Void. */
export const watershedOpens = (area: PlaceId): number => POINT + 0.2 + 2.2 * ((AT[area] ? reach(area) : FAR) / FAR);

/**
 * The camera's feel by event: lean (zoom in by this factor, back at `back` s), dim (s), then beats: at s, hit-stop
 * ms, punch (a zoom kick), shake px and its ms. A strike by its grade; lost, devour and the rest as the old recipes.
 */
type Feel = { lean?: number; back?: number; dim?: number; beats: readonly (readonly [number, number, number, number, number])[] };
const STRIKE: readonly Feel[] = [
  { beats: [] }, { beats: [[0, 0, 0.003, 0, 0]] }, { beats: [[0, 0, 0.006, 0, 0]] },
  { lean: 1.12, back: 1.0, beats: [[0, 0, 0, 0.3, 120], [0.52, 80, 0.01, 0.6, 220]] },
  { lean: 1.22, back: 1.3, dim: 1.1, beats: [[0, 0, 0, 0.48, 140], [0.69, 110, 0.014, 1.2, 320]] },
  { lean: 1.35, back: 1.6, dim: 2.1, beats: [[0, 0, 0, 0.72, 160], [1.125, 150, 0.02, 1.92, 440]] },
];
const FEEL: Partial<Record<string, Feel>> = {
  heard: { beats: [[0, 0, 0.004, 0, 0]] },
  turned: { lean: 1.14, back: 2, beats: [[0, 50, 0.006, 0, 0], [1.55, 80, 0.01, 0.6, 200]] },
  exposed: { lean: 1.2, back: 1.9, dim: 1.8, beats: [[0.7, 140, 0, 1.08, 320]] },
  seized: { beats: [[0.7, 90, 0, 0.9, 260]] },
  devour: { lean: 1.25, back: 1.3, dim: 1.8, beats: [[0.42, 120, -0.012, 2.1, 450], [1.05, 60, 0, 1.2, 260]] },
  evil: { dim: 1.2, beats: [[0.4, 90, -0.012, 2.4, 420]] },
  miracle: { beats: [[0.4, 60, 0.01, 0.6, 200]] },
  rank: { beats: [[0.4, 80, 0.015, 1.32, 360]] },
  lost: { beats: [[0, 90, 0, 0, 0], [0.4, 0, 0, 1.08, 300]] },
  temple: { beats: [[0, 60, 0, 2.7, 500]] },
  council: { beats: [[0, 0, 0, 1.2, 400]] },
};
/** the films' own beats: the watershed's lift going and its bloom */
const FILM_FEEL: Partial<Record<Film['kind'], Feel>> = { watershed: { beats: [[1.8, 0, 0, 3, 600], [14.5, 0, 0, 2.5, 800]] } };
const feelOf = (e: GameEvent): Feel | undefined => {
  switch (e.kind) {
    case 'strike': return STRIKE[GRADES.indexOf(e.grade)];
    case 'whisper': return e.ok ? FEEL.heard : undefined;
    case 'search': return e.found.length || e.item ? FEEL.seized : undefined;
    case 'play': return FEEL[e.cardKind];
    case 'threat': return e.how === 'landed' ? FEEL.council : undefined;
    default: return FEEL[e.kind];
  }
};
/** most shake, in px, and most punch */
const SHAKE_MAX = 6, PUNCH_MAX = 0.02;
/**
 * The defeat (the old front/defeat.ts, on the 1600-wide frame): the colour drains to gray from the edges toward the
 * grave's eye over DRAIN s (the ramp's radius from DRAIN_R px to nothing, its gray at least 0.35 of the way, a 0.38
 * dark over it), then the dark closes the same way over CLOSE s.
 */
const DRAIN = [0.25, 3.6] as const, DRAIN_R = 2000, CLOSE = [2.8, 7.2] as const, CLOSE_R = 1700, FRAME_W = 1600;

const smooth = (a: number, b: number, t: number): number => {
  const u = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return u * u * (3 - 2 * u);
};
const easeOut = (u: number): number => 1 - (1 - u) ** 3;
const noise = (t: number, s: number): number => {
  const i = Math.floor(t), f = t - i, h = (k: number) => Math.sin(k * 127.1 + s * 311.7) * 43758.5453 % 1;
  return h(i) + (h(i + 1) - h(i)) * f * f * (3 - 2 * f);
};

/** Monotone cubic through keys [t, x, y, z] on channel `ch` (Fritsch-Butland tangents), at `t`. */
function track(K: readonly (readonly number[])[], ch: number, t: number): number {
  const n = K.length;
  if (t <= K[0]![0]!) return K[0]![ch]!;
  if (t >= K[n - 1]![0]!) return K[n - 1]![ch]!;
  let i = 0;
  while (K[i + 1]![0]! <= t) i++;
  const d = (j: number): number => (K[j + 1]![ch]! - K[j]![ch]!) / (K[j + 1]![0]! - K[j]![0]!);
  const tan = (j: number): number => {
    if (j === 0) return d(0);
    if (j === n - 1) return d(n - 2);
    const a = d(j - 1), b = d(j);
    return a * b <= 0 ? 0 : 2 / (1 / a + 1 / b);
  };
  const h = K[i + 1]![0]! - K[i]![0]!, u = (t - K[i]![0]!) / h, u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * K[i]![ch]! + (u3 - 2 * u2 + u) * tan(i) * h + (-2 * u3 + 3 * u2) * K[i + 1]![ch]! + (u3 - u2) * tan(i + 1) * h;
}

/**
 * The drain's gray: the world's colour mixed to its luminance by the ramp's alpha round the eye (a saturation blend).
 * The uniforms it shares with the filter's vertex stage are high precision, as they are there.
 */
const DRAIN_FRAG = `in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform sampler2D uRamp;
uniform highp vec4 uInputSize;
uniform highp vec4 uOutputFrame;
uniform vec4 uCell;
uniform vec3 uEye;
uniform float uBase;
void main(void) {
  vec4 c = texture(uTexture, vTextureCoord);
  vec2 q = clamp((vTextureCoord * uInputSize.xy + uOutputFrame.xy - uEye.xy) / (2.0 * uEye.z) + 0.5, vec2(-1.0), vec2(2.0));
  float r = (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0) ? 1.0 : texture(uRamp, uCell.xy + clamp(q, 0.004, 0.996) * uCell.zw).a;
  float a = uBase + (1.0 - uBase) * r;
  finalColor = vec4(mix(c.rgb, vec3(dot(c.rgb, vec3(0.3, 0.59, 0.11))), a), c.a);
}`;

interface Kick { at: number; f: Feel }

export class Films implements Layer {
  readonly name = 'notes';
  readonly root = new Container();
  /** the frame's model as the view draws it: the camera felt, on the held clock */
  private readonly vm: { -readonly [K in keyof ViewModel]: ViewModel[K] };
  private readonly cam: Camera = { x: 0, y: 0, zoom: 1 };
  private film: Film | null = null;
  private keyed: Film | null = null;
  private keys: (readonly number[])[] = [];
  private readonly kicks: Kick[] = [];
  private held = 0;
  private last = 0;
  private stopUntil = -1;
  private lostAt = -1;
  private readonly at: Anchor = { x: 0, y: 0, u: 0, crown: 0, mine: true };
  // what it lays over the world
  private readonly veil = new Sprite(Texture.WHITE);
  private readonly point: Sprite;
  private readonly pit: Sprite;
  private readonly load: Sprite;
  private readonly gold: Sprite;
  private readonly war: Sprite;
  private readonly wicks: Sprite[] = [];
  /** the defeat: its atlas (fetched when the run is lost), the drain's filter, the dark's ramp and the black round it */
  private defeat: Atlas | null | undefined;
  private drain: Filter | null = null;
  private drainList: Filter[] | null = null;
  private readonly ramp = new Sprite();
  private readonly edges = [0, 1, 2, 3].map(() => new Sprite(Texture.WHITE));
  private busy = false;

  constructor(life: Atlas, private readonly people: People, private readonly world: Container, private readonly screen: { w: number; h: number }, private readonly renderer: Renderer) {
    this.vm = {} as ViewModel;
    this.root.eventMode = 'none';
    const glow = (name: string, tint: number): Sprite => {
      const s = this.root.addChild(life.sprite(name));
      s.blendMode = 'add';
      s.tint = tint;
      s.visible = false;
      return s;
    };
    for (const s of [this.veil, this.ramp, ...this.edges]) {
      s.tint = 0x060508;
      s.visible = false;
      this.root.addChild(s);
    }
    this.ramp.anchor.set(0.5);
    this.point = glow('glow-0.3', 0xa274e0);
    this.pit = glow('glow-0.1', 0xa274e0);
    this.load = glow('glow-0.3', 0xcfaef0);
    this.gold = glow('glow-0.1', 0xffd479);
    this.war = glow('glow-0.1', 0xa82c20);
    for (let i = 0; i < 46; i++) this.wicks.push(glow('glow-0.3', 0xa274e0));
  }

  /** The film's camera at its `t` from `from`, the camera it began on (app's one camera takes it each frame). */
  pose(film: Film, from: Readonly<Camera>, out: Camera): void {
    if (film.kind === 'opening') return;
    if (film !== this.keyed) {
      this.keyed = film;
      const start = [0, from.x + ORIGIN.x, from.y + ORIGIN.y, from.zoom];
      if (film.kind === 'take') {
        const e = film.event, a = this.at;
        const to = anchor(e.unit, e.place, this.people, a) ? [a.x, a.y - a.u * 0.5, Math.min(from.zoom, (a.mine ? 1 : HOME[2]) - Math.log2(1.35) / 2.41)] : start.slice(1);
        this.keys = [start, [0.8, ...to], [2.4, ...to], [3.2, ...start.slice(1)]];
      } else this.keys = [start, ...KEYS[film.kind]];
    }
    out.x = track(this.keys, 1, film.t) - ORIGIN.x;
    out.y = track(this.keys, 2, film.t) - ORIGIN.y;
    out.zoom = track(this.keys, 3, film.t);
  }

  /** The model the view draws this frame: app's camera, felt. */
  view(live: ViewModel): ViewModel {
    const v = Object.assign(this.vm, live);
    const film = live.film;
    if (film !== this.film) {
      this.film = film;
      const f = film && FILM_FEEL[film.kind];
      if (f) this.kicks.push({ at: live.time, f });
    }
    // the held clock: a hit-stop freezes what animates
    const dt = live.time - this.last;
    this.last = live.time;
    if (live.time < this.stopUntil) this.held += dt;
    v.time = live.time - this.held;
    for (const e of live.fresh) {
      const f = feelOf(e);
      if (f && (!e.unit || anchor(e.unit, undefined, this.people, this.at))) this.kicks.push({ at: live.time, f });
    }
    const cam = Object.assign(this.cam, live.camera);
    // shake, punch and lean from the kicks still sounding
    let sx = 0, sy = 0, punch = 0, lean = 1;
    for (let i = this.kicks.length - 1; i >= 0; i--) {
      const k = this.kicks[i]!, age = live.time - k.at;
      let alive = false;
      for (const [at, stop, p, px, ms] of k.f.beats) {
        const a = age - at;
        if (a < 0) { alive = true; continue; }
        if (stop && a < stop / 1000 && this.stopUntil < k.at + at + stop / 1000) this.stopUntil = k.at + at + stop / 1000;
        const tau = ms / 3000;
        if (px && a < tau * 4) { const amp = px * Math.exp(-a / tau); sx += amp * (noise(a * 28, 1) * 2 - 1); sy += amp * (noise(a * 28, 2) * 2 - 1); alive = true; }
        if (p && a < 0.6) { punch += 1.1 * p * Math.exp(-7.35 * a) * Math.sin(14.6 * a); alive = true; }
      }
      if (k.f.lean && !film && age < k.f.back! + 0.4) { lean *= 1 + (k.f.lean - 1) * smooth(0, 0.3, age) * (1 - smooth(k.f.back!, k.f.back! + 0.4, age)); alive = true; }
      if (!alive) this.kicks.splice(i, 1);
    }
    const s = scale(cam.zoom), shake = Math.min(SHAKE_MAX, Math.hypot(sx, sy)) / (Math.hypot(sx, sy) || 1);
    cam.x += (sx * shake) / s;
    cam.y += (sy * shake) / s;
    cam.zoom -= Math.log2(lean * (1 + Math.max(-PUNCH_MAX, Math.min(PUNCH_MAX, punch)))) / 2.41;
    v.camera = cam;
    return v;
  }

  /** The overlays: the films' lights, the dim, the defeat's drain. */
  frame(vm: ViewModel): boolean {
    const film = vm.film, t = film?.t ?? 0, cam = vm.camera, s = scale(cam.zoom);
    const busy = !!film || this.kicks.some((k) => k.f.dim) || vm.state.phase === 'lost';
    if (!busy && !this.busy) return false;
    this.busy = busy;
    const glow = (sp: Sprite, x: number, y: number, r: number, a: number): void => {
      sp.visible = a > 0.004;
      if (!sp.visible) return;
      sp.position.set(x, y);
      sp.scale.set((2 * r) / sp.texture.frame.width);
      sp.alpha = Math.min(1, a);
    };
    const ws = film?.kind === 'watershed', end = film?.kind === 'ending';
    // the watershed: the mine a glowing point as the camera leaves it, the pit head's glow, the lift's load rising
    const out = smooth(1, HOME[2], cam.zoom);
    glow(this.point, ORIGIN.x, ORIGIN.y, 57.6 / s, ws ? out * (1 - smooth(19.9, 21.7, t)) * (0.85 + 0.15 * Math.sin(2.3 * t)) : 0);
    glow(this.pit, MOUTH[0], MOUTH[1], 30, ws ? (0.6 + 0.4 * smooth(1.8, 4, t) + 0.3 * smooth(11.5, 14.5, t)) * (1 - smooth(20.4, 22, t)) * 0.5 : 0);
    const rise = 1 - (1 - smooth(5, 11, t)) ** 1.4;
    glow(this.load, CAGE[0] + (MOUTH[0] - CAGE[0]) * rise, CAGE[1] + (MOUTH[1] - CAGE[1]) * rise, 26 / s, ws ? smooth(4.4, 5.6, t) * (1 - smooth(6.6, 8, t)) : 0);
    // the ending: the procession up the road, the city's gold turning, the war's red, the close
    const way = road(0.24);
    this.wicks.forEach((w, i) => {
      const go = Math.max(0, t - 9 - (i / 46) * 5.5) * 520, len = Math.hypot(way[0] - GATE[0], way[1] - GATE[1]) - 40 - ((i * 37) % 260);
      const k = Math.min(go, len) / Math.hypot(way[0] - GATE[0], way[1] - GATE[1]);
      glow(w, GATE[0] + (way[0] - GATE[0]) * k + (((i * 53) % 21) - 10) * 4, GATE[1] + (way[1] - GATE[1]) * k, 5 / s, end ? smooth(9, 10.5, t) * (1 - smooth(27.8, 29, t)) : 0);
    });
    glow(this.gold, CITY[0], CITY[1], CITY_R * 0.6, end ? smooth(22.1, 24.1, t) * (1 - smooth(28.6, 29.6, t)) : 0);
    glow(this.war, CITY[0] + 0.35 * CITY_R, CITY[1] + 0.1 * CITY_R, CITY_R * 0.5, end ? 0.6 * smooth(18, 21, t) * (1 - smooth(28.4, 29.6, t)) : 0);
    // the dark: a dim, the ending's close (the watershed's town opens block by block in the fog)
    let dark = end ? smooth(28.4, 29.6, t) : 0;
    for (const k of this.kicks) if (k.f.dim) dark = Math.max(dark, 0.3 * smooth(0, 0.25, vm.time - k.at) * (1 - smooth(k.f.dim * 0.6, k.f.dim, vm.time - k.at)));
    const close = this.lose(vm, s);
    // the uniform dark under the close's ramp (source over: each layer over the last)
    dark = 1 - (1 - dark) * (1 - close);
    this.veil.visible = dark > 0.004;
    this.veil.alpha = dark;
    const w = this.screen.w / s, h = this.screen.h / s;
    this.veil.position.set(cam.x + ORIGIN.x - w, cam.y + ORIGIN.y - h);
    this.veil.setSize(w * 2, h * 2);
    return true;
  }

  /** The defeat's drain and close on the world `age` s after the run is lost; the uniform dark it lays under its ramp. */
  private lose(vm: ViewModel, s: number): number {
    const lost = vm.state.phase === 'lost';
    if (!lost) {
      if (this.lostAt >= 0) this.world.filters = null;
      this.lostAt = -1;
      this.ramp.visible = false;
      for (const e of this.edges) e.visible = false;
      return 0;
    }
    if (this.defeat === undefined) {
      this.defeat = null;
      void Atlas.load(this.renderer, defeatManifest as unknown as AtlasManifest, defeatUrl).then((a) => (this.defeat = a));
    }
    if (this.lostAt < 0) this.lostAt = vm.time;
    const D = this.defeat, age = vm.time - this.lostAt, px = this.screen.w / FRAME_W, wt = this.world.position, ws = this.world.scale.x;
    const dk = smooth(DRAIN[0], DRAIN[1], age), dark = smooth(CLOSE[0], CLOSE[1], age);
    if (!D) return 0.38 * dk;
    const steps = (defeatManifest as unknown as { rampSteps: number }).rampSteps;
    const ramp = (inner: number, outer: number): string => `ramp.${Math.min(31, Math.round((inner / outer) * steps))}`;
    // the gray creeps in from the edges toward the grave's eye
    if (!this.drain) {
      this.drain = new Filter({
        glProgram: GlProgram.from({ vertex: defaultFilterVert, fragment: DRAIN_FRAG, name: 'hg-drain' }),
        resources: { drainUniforms: { uCell: { value: new Float32Array(4), type: 'vec4<f32>' }, uEye: { value: new Float32Array(3), type: 'vec3<f32>' }, uBase: { value: 0, type: 'f32' } }, uRamp: D.texture('ramp.0').source },
      });
    }
    const R = DRAIN_R * (1 - easeOut(dk)), name = ramp(R * 0.55, R + 260), c = D.cell(name), W = D.m.w, H = D.m.h;
    const u = this.drain.resources.drainUniforms.uniforms as { uCell: Float32Array; uEye: Float32Array; uBase: number };
    u.uCell.set([c[0] / W, c[1] / H, c[2] / W, c[3] / H]);
    u.uEye.set([wt.x + GRAVE_AT.x * ws, wt.y + GRAVE_AT.y * ws, Math.max(2, R + 260) * px]);
    u.uBase = 0.35 * dk;
    if (this.world.filters !== this.drainList) this.world.filters = this.drainList = [this.drain];
    // then the dark closes the same way: its ramp round the eye, solid black past its square
    const r1 = (Math.max(2, CLOSE_R * (1 - easeOut(dark)) + 120) * px) / s;
    this.ramp.visible = dark > 0;
    for (const e of this.edges) e.visible = dark > 0;
    if (dark > 0) {
      const RC = CLOSE_R * (1 - easeOut(dark));
      this.ramp.texture = D.texture(ramp(RC * 0.35, RC + 120));
      this.ramp.position.set(GRAVE_AT.x, GRAVE_AT.y);
      this.ramp.setSize(r1 * 2, r1 * 2);
      const big = (this.screen.w + this.screen.h) / s;
      const [a, b, l, r] = this.edges as [Sprite, Sprite, Sprite, Sprite];
      a.position.set(GRAVE_AT.x - big, GRAVE_AT.y - big); a.setSize(big * 2, big - r1);
      b.position.set(GRAVE_AT.x - big, GRAVE_AT.y + r1); b.setSize(big * 2, big - r1);
      l.position.set(GRAVE_AT.x - big, GRAVE_AT.y - r1); l.setSize(big - r1, r1 * 2);
      r.position.set(GRAVE_AT.x + r1, GRAVE_AT.y - r1); r.setSize(big - r1, r1 * 2);
    }
    return 1 - (1 - 0.38 * dk) * (1 - (dark > 0 ? dark * dark : 0));
  }
}
