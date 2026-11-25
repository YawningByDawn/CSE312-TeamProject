import { Container, UniformGroup, type Renderer } from 'pixi.js';
import { layerRoot, pit, quad, uniforms } from './quad';
import type { GameState, Film, Layer, PlaceId, Query, ViewModel, Visibility } from '../types';
import { AT } from '../content/map';
import { NEIGHBOURS, PLACES } from '../content/world';
import { below } from './camera';
import { dataTexture, decodeData, upload } from './pictures';
import { StateSeen } from './moved';
import { bilinear, differs, quant, smooth } from './tables';
import { watershedOpens } from './film/films';
import type { FieldAnswer, FieldAsk, FogManifest, LandAsk, ZoneAsk } from './fog.worker';
import FieldWorker from './fog.worker.ts?worker';
import mineM from '../../assets/fog/mine/manifest.json';
import townM from '../../assets/fog/town/manifest.json';
import hazeM from '../../assets/haze/manifest.json';

// The fog of war (#68): each zone of the mine and the town is Active (colour), Sensed (gray) or Void (black), by
// `Query.visibility`. The fields (fog.worker.ts) are worked out off the main thread while a zone changes: each frame of a
// fade asks for the time gone, and the rows sent back go to the GPU. One mesh a place covers the Void in black (1 - s)
// and adds the drifting haze over Sensed ground (assets/haze's two noises crossfaded by the clock) and the stain front's
// shimmer (nine ridge phases). The gray (gray.ts) and the town's things (town.ts) read the same field. In the watershed
// the town opens from the pit outward (film's `watershedOpens`). The land's mask is asked for here too, once it loads.

const HAZE = import.meta.glob('../../assets/haze/{haze,ridge0,ridge1,ridge2}.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
/** the haze drifts in steps of HAZE_STEP_S while any cell holds it; the shimmer creeps a full cycle every 1 / SHIMMER_RATE s */
const HAZE_STEP_S = 1 / 15, SHIMMER_RATE = 0.12;
/** each place's haze over Sensed ground: none in the mine (Sensed is told by gray alone), a faint drift in the town */
const GAIN = [0, 0.12];
/** the ending's seconds over which the land opens as the camera goes up the road (seen), and colours at the city */
const REVEAL_SEEN = [10, 19] as const, REVEAL_COLOUR = [18, 24] as const;

const FRAG = /* glsl */ `
uniform sampler2D uA; // the fog: haze weight, seen, active, the stain's front
uniform sampler2D uH; // the haze's two noises (R, G)
uniform sampler2D uR0; uniform sampler2D uR1; uniform sampler2D uR2; // the shimmer's contours, nine phases
uniform vec2 uSize; uniform float uPeriod; uniform float uWob; uniform float uGain; uniform float uPow; uniform float uAlpha;
uniform vec3 uW0; uniform vec3 uW1; uniform vec3 uW2;
void main() {
  vec4 A = texture(uA, vW / uSize);
  float cn = A.x, s = A.y, a = A.z;
  vec2 t = vW / uPeriod;
  vec2 H = texture(uH, t).xy;
  float haze = mix(H.x, H.y, uWob) * 0.14 * pow(s, uPow) * (1.0 - a) * cn * uGain;
  float rg = dot(texture(uR0, t).rgb, uW0) + dot(texture(uR1, t).rgb, uW1) + dot(texture(uR2, t).rgb, uW2);
  float sh = A.w * cn * s * rg * 0.38;
  // black over the Void (1 - seen), the haze (0x8a96a0) and the shimmer (0x9a6bff) added
  o = vec4(vec3(0.541, 0.588, 0.627) * haze + vec3(0.604, 0.420, 1.0) * sh, 1.0 - s) * uAlpha;
}`;

/** One place's fog: its manifest, data texture and mesh; any cell shows haze or the shimmer. */
interface Place { m: FogManifest; tex: ReturnType<typeof dataTexture>; mesh: ReturnType<typeof quad>; uni: UniformGroup; gain: number; live: boolean; shown: number[] }

export class Fog implements Layer {
  readonly name = 'fog';
  readonly root = layerRoot(new Container());
  private readonly seen = new StateSeen();
  private readonly w = new Float32Array(hazeM.phases);
  private last = { time: NaN, step: -1 };
  /** counts the answers that moved a field: what samples it (`sample`) samples again */
  version = 0;
  /** the land's mask on the GPU (valley.ts sets it when the land loads: only then is the mask asked for) */
  land: { take(bytes: Uint8Array): void } | null = null;
  /** an ask is out; the seconds gone since the last ask while a fade runs; the zones and land still to ask for and their
   * keys; a fade runs on; an answer came since the last frame; the next ask is the first */
  private asked = false;
  private dt = 0;
  private zones: (ZoneAsk[] | null)[] = [null, null];
  private landAsk: LandAsk | null = null;
  private blocks: Visibility[] = [];
  private readonly sent = ['', '', ''];
  private readonly reveal: number[] = [];
  private moving = false;
  private fresh = false;
  private first = true;

  private constructor(private readonly q: Query, private readonly worker: Worker, readonly places: readonly Place[]) {
    this.root.addChild(pit(places[0]!.mesh), places[1]!.mesh);
    worker.onmessage = ({ data }: MessageEvent<FieldAnswer>) => {
      [this.asked, this.moving, this.fresh] = [false, data.moving, true];
      places.forEach((p, k) => {
        const r = data.places[k]!;
        p.live = (p.gain > 0 && r.haze > 0) || r.shimmer > 0;
        if (r.bytes) p.tex.bytes.set(r.bytes, r.y0 * p.m.gw * 4), p.tex.send();
      });
      if (data.places.some((r) => r.bytes)) this.version++;
      if (data.land) this.land?.take(data.land);
    };
  }

  static async load(renderer: Renderer, q: Query): Promise<Fog> {
    const worker = new FieldWorker();
    worker.onerror = (e) => {
      throw new Error(`field worker: ${e.message}`);
    };
    const ready = new Promise<void>((ok) => (worker.onmessage = () => ok()));
    const pics = await Promise.all(['haze', 'ridge0', 'ridge1', 'ridge2'].map((n) => decodeData(HAZE[`../../assets/haze/${n}.png`]!)));
    const [h, r0, r1, r2] = pics.map((bm) => upload(renderer, bm, true).source);
    await ready;
    const places = [mineM, townM].map((raw, k): Place => {
      const m = raw as unknown as FogManifest, tex = dataTexture(renderer, m.gw, m.gh), W = m.gw * m.cell, H = m.gh * m.cell;
      const uni = uniforms({ uSize: [W, H], uPeriod: hazeM.tileCells * m.cell, uWob: 0.5, uGain: GAIN[k]!, uPow: m.hazePow, uAlpha: 1, uW0: [0, 0, 0], uW1: [0, 0, 0], uW2: [0, 0, 0] });
      const mesh = quad('hg-fog', FRAG, [0, 0, W, H], { uA: tex.tex.source, uH: h, uR0: r0, uR1: r1, uR2: r2, fogUniforms: uni });
      return { m, tex, mesh, uni, gain: GAIN[k]!, live: false, shown: [] };
    });
    return new Fog(q, worker, places);
  }

  frame(vm: ViewModel): boolean {
    const L = this.last, dt = Number.isNaN(L.time) ? 0 : Math.max(0, vm.time - L.time);
    L.time = vm.time;
    // the time gone counts only toward a fade under way
    this.dt = this.asked || this.moving ? this.dt + dt : 0;
    if (this.seen.moved(vm) || vm.film?.kind === 'watershed') {
      const hearths = this.q.hearths(vm.state);
      this.places.forEach((p, k) => {
        const zs = p.m.zones.map((z) => this.zone(vm.state, vm.film, k, z, hearths));
        const key = zs.map((z) => `${z.vis}${z.hold}|${z.from}|${z.at}`).join(';');
        if (key !== this.sent[k]) this.sent[k] = key, this.zones[k] = zs;
      });
      const blocks = townM.zones.map((z) => this.q.visibility(vm.state, z as PlaceId)), key = blocks.join();
      if (key !== this.sent[2]) this.sent[2] = key, (this.blocks = blocks), (this.reveal.length = 0);
    }
    // the land's inputs: the blocks' visibility and the ending's reveal
    const t = vm.film?.kind === 'ending' ? vm.film.t : -1;
    const seen = quant(smooth(REVEAL_SEEN[0], REVEAL_SEEN[1], t), 32), colour = quant(smooth(REVEAL_COLOUR[0], REVEAL_COLOUR[1], t), 32);
    if (this.land && differs(this.reveal, seen, colour)) this.landAsk = { blocks: this.blocks, seen, colour };
    if (!this.asked && (this.moving || this.zones.some(Boolean) || this.landAsk)) {
      this.worker.postMessage({ zones: this.zones, land: this.landAsk, dt: this.dt, now: this.first } satisfies FieldAsk);
      [this.asked, this.first, this.dt, this.zones, this.landAsk] = [true, false, 0, [null, null], null];
    }
    let changed = this.fresh;
    this.fresh = false;
    const b = below(vm.camera.zoom);
    this.places.forEach((p, k) => {
      const a = quant(k ? 1 - b : b, 64);
      if (!differs(p.shown, a)) return;
      p.mesh.visible = a > 0;
      p.uni.uniforms.uAlpha = a;
      changed = true;
    });
    // the haze drifts in steps while any cell holds it
    const step = Math.floor(vm.time / HAZE_STEP_S);
    if (this.places.some((p) => p.live && p.shown[0]! > 0) && (step !== L.step || changed)) {
      L.step = step;
      this.drift(step * HAZE_STEP_S);
      changed = true;
    }
    return changed;
  }

  /**
   * A zone as the worker takes it: its visibility (Void in the watershed until its block opens), its Hold (at least a
   * share by its hearths), the coloured neighbours its colour comes in from (-1 the other region's, up the pit) and its
   * hearths' points.
   */
  private zone(s: Readonly<GameState>, film: Film | null, k: number, id: PlaceId, hearths: readonly PlaceId[]): ZoneAsk {
    const q = this.q, zones = this.places[k]!.m.zones;
    const vis = k && film?.kind === 'watershed' && film.t < watershedOpens(id) ? 'void' : q.visibility(s, id);
    const homes = hearths.filter((h) => PLACES[h]?.area === id && AT[h]);
    const hold = Math.max((s.places[id]?.hold ?? 0) / 100, Math.min(0.14, 0.05 * homes.length));
    const from = NEIGHBOURS[id]!.filter((n) => q.visibility(s, n) === 'active').map((n) => zones.indexOf(n));
    return { vis, hold, from, at: homes.flatMap((h) => AT[h]!) };
  }

  /** Active and seen at point (x, y) of place k (0 the mine, 1 the town), bilinear over its fog cells as last sent. */
  sample(k: number, x: number, y: number, out: { a: number; s: number }): void {
    const { m, tex } = this.places[k]!, b = tex.bytes;
    const fx = Math.min(m.gw - 1, Math.max(0, x / m.cell - 0.5)), fy = Math.min(m.gh - 1, Math.max(0, y / m.cell - 0.5));
    const at = (c: number) => bilinear((xx, yy) => b[(Math.min(m.gh - 1, yy) * m.gw + Math.min(m.gw - 1, xx)) * 4 + c]!, fx, fy) / 255;
    out.a = at(2);
    out.s = at(1);
  }

  /** The haze's crossfade and the shimmer's phase weights at clock `t`. */
  private drift(t: number): void {
    const P = hazeM.phases, p = ((((t * SHIMMER_RATE) % 1) + 1) % 1) * P, k = Math.floor(p), w = this.w;
    w.fill(0);
    w[k] = 1 - (p - k);
    w[(k + 1) % P] = p - k;
    for (const { uni: { uniforms: u } } of this.places) {
      u.uWob = 0.5 + 0.5 * Math.sin(t * 0.55);
      (u.uW0 as Float32Array).set(w.subarray(0, 3));
      (u.uW1 as Float32Array).set(w.subarray(3, 6));
      (u.uW2 as Float32Array).set(w.subarray(6, 9));
    }
  }
}
