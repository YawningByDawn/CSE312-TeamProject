import { Container, type Renderer } from 'pixi.js';
import { layerRoot, pit, quad, uniforms } from './quad';
import type { Layer, Query, ViewModel, Visibility } from '../types';
import { dataTexture } from './pictures';
import { StateSeen } from './moved';
import { bilinear } from './tables';
import type { FieldAnswer, FieldAsk, FogManifest } from './fog.worker';
import FieldWorker from './fog.worker.ts?worker';
import mineM from '../../assets/fog/mine/manifest.json';

// The fog of war (#68): each zone of the mine is Active (colour), Sensed (gray) or Void (black), by `Query.visibility`.
// The fields (fog.worker.ts) are worked out off the main thread while a zone changes: each frame of a fade asks for the
// time gone, and the rows sent back go to the GPU. One mesh covers the Void in black (1 - s). The gray (gray.ts) reads
// the same field.

const FRAG = /* glsl */ `
uniform sampler2D uA; // the fog: unused, seen, active
uniform vec2 uSize;
void main() {
  o = vec4(0.0, 0.0, 0.0, 1.0 - texture(uA, vW / uSize).y);
}`;

/** The mine's fog: its manifest, data texture and mesh. */
interface Place { m: FogManifest; tex: ReturnType<typeof dataTexture>; mesh: ReturnType<typeof quad> }

export class Fog implements Layer {
  readonly name = 'fog';
  readonly root = layerRoot(new Container());
  private readonly seen = new StateSeen();
  private last = NaN;
  /** an ask is out; the seconds gone since the last ask while a fade runs; the zones still to ask for and their key; a
   * fade runs on; an answer came since the last frame; the next ask is the first */
  private asked = false;
  private dt = 0;
  private zones: Visibility[] | null = null;
  private sent = '';
  private moving = false;
  private fresh = false;
  private first = true;

  private constructor(private readonly q: Query, private readonly worker: Worker, readonly place: Place) {
    this.root.addChild(pit(place.mesh));
    worker.onmessage = ({ data }: MessageEvent<FieldAnswer>) => {
      [this.asked, this.moving, this.fresh] = [false, data.moving, true];
      const r = data.rows;
      if (r.bytes) place.tex.bytes.set(r.bytes, r.y0 * place.m.gw * 4), place.tex.send();
    };
  }

  static async load(renderer: Renderer, q: Query): Promise<Fog> {
    const worker = new FieldWorker();
    worker.onerror = (e) => {
      throw new Error(`field worker: ${e.message}`);
    };
    await new Promise<void>((ok) => (worker.onmessage = () => ok()));
    const m = mineM as unknown as FogManifest, tex = dataTexture(renderer, m.gw, m.gh), W = m.gw * m.cell, H = m.gh * m.cell;
    const mesh = quad('hg-fog', FRAG, [0, 0, W, H], { uA: tex.tex.source, fogUniforms: uniforms({ uSize: [W, H] }) });
    return new Fog(q, worker, { m, tex, mesh });
  }

  frame(vm: ViewModel): boolean {
    const dt = Number.isNaN(this.last) ? 0 : Math.max(0, vm.time - this.last);
    this.last = vm.time;
    // the time gone counts only toward a fade under way
    this.dt = this.asked || this.moving ? this.dt + dt : 0;
    if (this.seen.moved(vm)) {
      const zs = this.place.m.zones.map((z) => this.q.visibility(vm.state, z)), key = zs.join();
      if (key !== this.sent) this.sent = key, this.zones = zs;
    }
    if (!this.asked && (this.moving || this.zones)) {
      this.worker.postMessage({ zones: this.zones, dt: this.dt, now: this.first } satisfies FieldAsk);
      [this.asked, this.first, this.dt, this.zones] = [true, false, 0, null];
    }
    const changed = this.fresh;
    this.fresh = false;
    return changed;
  }

  /** Active and seen at point (x, y) of the mine, bilinear over its fog cells as last sent. */
  sample(x: number, y: number, out: { a: number; s: number }): void {
    const { m, tex } = this.place, b = tex.bytes;
    const fx = Math.min(m.gw - 1, Math.max(0, x / m.cell - 0.5)), fy = Math.min(m.gh - 1, Math.max(0, y / m.cell - 0.5));
    const at = (c: number) => bilinear((xx, yy) => b[(Math.min(m.gh - 1, yy) * m.gw + Math.min(m.gw - 1, xx)) * 4 + c]!, fx, fy) / 255;
    out.a = at(2);
    out.s = at(1);
  }
}
