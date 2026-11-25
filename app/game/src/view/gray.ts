import { Container, type Renderer, type Texture } from 'pixi.js';
import type { Layer, ViewModel } from '../types';
import { below } from './camera';
import { tiles } from './pictures';
import { layerRoot, pit, quad, uniforms, type Uniforms } from './quad';
import { differs, quant } from './tables';
import { townTiles, type TileManifest } from './surface';
import type { Fog } from './fog';
import mineUrl from '../../assets/gray/mine/gray.webp?url';
import mineM from '../../assets/gray/mine/manifest.json';

// The Sensed gray (#68): where a place is seen but not Active, its gray picture (assets/gray: the mine whole, the town's
// ground tiles) lies over the colour as far as colour is not (1 - active, the fog's field), under the props and the
// people; the fog's black then covers the Void. One mesh samples up to MAX tiles, picking each point's tile: the mine's
// picture is one mesh, the town's 24 tiles two. The town's things carry their own gray twins (town.ts).

const MANIFESTS = import.meta.glob('../../assets/gray/x*y*/manifest.json', { eager: true, import: 'default' }) as Record<string, TileManifest>;
const URLS = import.meta.glob('../../assets/gray/x*y*/gray*.bc1', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
/** Tiles a mesh samples: with the fog's field, within the 16 samplers every WebGL2 GPU has. */
const MAX = 12;
type Tile = { tex: Texture; rect: readonly [number, number, number, number] };

export class Gray implements Layer {
  /** over the ground, under the props and the people */
  readonly name = 'stain';
  readonly root = layerRoot(new Container());
  private readonly meshes: { uni: Uniforms; k: number; m: ReturnType<typeof quad> }[] = [];
  private readonly shown: number[] = [];

  private constructor(private readonly fog: Fog) {}

  /** The mine's gray: its picture (k = 1 px a mine unit, its cell inset by its margin), placed in the pit. */
  static async load(renderer: Renderer, fog: Fog): Promise<Gray> {
    const g = new Gray(fog), [ox, oy] = mineM.cells.gray as [number, number];
    g.add(g.root.addChild(pit()), 0, (await tiles(renderer, mineUrl)).map(({ tex, x, y }) => ({ tex, rect: [x - ox, y - oy, tex.width, tex.height] as const })));
    return g;
  }

  /** The town's gray ground, when the town loads. */
  async loadTown(renderer: Renderer, dpr: number): Promise<void> {
    const ts = await townTiles(renderer, dpr, MANIFESTS, URLS, 'gray');
    for (let i = 0; i < ts.length; i += MAX) this.add(this.root, 1, ts.slice(i, i + MAX));
    this.shown.length = 0;
  }

  /** A mesh over tiles `ts` (place units) laying each one's gray where the fog of place k (0 mine, 1 town) shows no colour. */
  private add(into: Container, k: number, ts: readonly Tile[]): void {
    const p = this.fog.places[k]!, R = (i: number) => `uR${i}`, u: Record<string, number[]> = { uSize: [p.m.gw * p.m.cell, p.m.gh * p.m.cell] };
    const res: Record<string, unknown> = { uA: p.tex.tex.source };
    let pick = '', x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    ts.forEach(({ tex, rect: r }, i) => {
      pick += `${i ? 'else ' : ''}if (all(greaterThanEqual(vW, ${R(i)}.xy)) && all(lessThan(vW, ${R(i)}.xy + ${R(i)}.zw))) g = textureGrad(uT${i}, (vW - ${R(i)}.xy) / ${R(i)}.zw, dx / ${R(i)}.zw, dy / ${R(i)}.zw);\n`;
      u[R(i)] = [...r];
      res[`uT${i}`] = tex.source;
      x0 = Math.min(x0, r[0]), y0 = Math.min(y0, r[1]), x1 = Math.max(x1, r[0] + r[2]), y1 = Math.max(y1, r[1] + r[3]);
    });
    const frag = `uniform sampler2D uA; uniform vec2 uSize; uniform float uAlpha;
${ts.map((_, i) => `uniform sampler2D uT${i}; uniform vec4 uR${i};`).join('\n')}
void main() {
  vec2 dx = dFdx(vW), dy = dFdy(vW);
  vec4 g = vec4(0.0);
  ${pick}  // as much gray as colour is not (the fog's B: active)
  o = g * (1.0 - texture(uA, vW / uSize).z) * uAlpha;
}`;
    const uni = uniforms({ ...u, uAlpha: 1 }), m = into.addChild(quad(`hg-gray${ts.length}`, frag, [x0, y0, x1 - x0, y1 - y0], { ...res, grayUniforms: uni }));
    this.meshes.push({ uni, k, m });
  }

  frame(vm: ViewModel): boolean {
    const b = quant(below(vm.camera.zoom), 64);
    if (!differs(this.shown, b)) return false;
    for (const { uni, k, m } of this.meshes) {
      m.visible = (k ? 1 - b : b) > 0;
      uni.uniforms.uAlpha = k ? 1 - b : b;
    }
    return true;
  }
}
