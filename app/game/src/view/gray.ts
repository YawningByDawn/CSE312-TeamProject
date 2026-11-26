import { Container, type Renderer, type Texture } from 'pixi.js';
import type { Layer } from '../types';
import { tiles } from './pictures';
import { layerRoot, pit, quad, uniforms } from './quad';
import type { Fog } from './fog';
import mineUrl from '../../assets/gray/mine/gray.webp?url';
import mineM from '../../assets/gray/mine/manifest.json';

// The Sensed gray (#68): where a place is seen but not Active, the mine's gray picture (assets/gray) lies over the
// colour as far as colour is not (1 - active, the fog's field), under the props and the people; the fog's black then
// covers the Void. One mesh samples the picture's tiles, picking each point's tile.

type Tile = { tex: Texture; rect: readonly [number, number, number, number] };

export class Gray implements Layer {
  /** over the ground, under the props and the people */
  readonly name = 'stain';
  readonly root = layerRoot(new Container());

  private constructor(private readonly fog: Fog) {}

  /** The mine's gray: its picture (k = 1 px a mine unit, its cell inset by its margin), placed in the pit. */
  static async load(renderer: Renderer, fog: Fog): Promise<Gray> {
    const g = new Gray(fog), [ox, oy] = mineM.cells.gray as [number, number];
    g.add(g.root.addChild(pit()), (await tiles(renderer, mineUrl)).map(({ tex, x, y }) => ({ tex, rect: [x - ox, y - oy, tex.width, tex.height] as const })));
    return g;
  }

  /** A mesh over tiles `ts` (mine units) laying each one's gray where the mine's fog shows no colour. */
  private add(into: Container, ts: readonly Tile[]): void {
    const p = this.fog.place, R = (i: number) => `uR${i}`, u: Record<string, number[]> = { uSize: [p.m.gw * p.m.cell, p.m.gh * p.m.cell] };
    const res: Record<string, unknown> = { uA: p.tex.tex.source };
    let pick = '', x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    ts.forEach(({ tex, rect: r }, i) => {
      pick += `${i ? 'else ' : ''}if (all(greaterThanEqual(vW, ${R(i)}.xy)) && all(lessThan(vW, ${R(i)}.xy + ${R(i)}.zw))) g = textureGrad(uT${i}, (vW - ${R(i)}.xy) / ${R(i)}.zw, dx / ${R(i)}.zw, dy / ${R(i)}.zw);\n`;
      u[R(i)] = [...r];
      res[`uT${i}`] = tex.source;
      x0 = Math.min(x0, r[0]), y0 = Math.min(y0, r[1]), x1 = Math.max(x1, r[0] + r[2]), y1 = Math.max(y1, r[1] + r[3]);
    });
    const frag = `uniform sampler2D uA; uniform vec2 uSize;
${ts.map((_, i) => `uniform sampler2D uT${i}; uniform vec4 uR${i};`).join('\n')}
void main() {
  vec2 dx = dFdx(vW), dy = dFdy(vW);
  vec4 g = vec4(0.0);
  ${pick}  // as much gray as colour is not (the fog's B: active)
  o = g * (1.0 - texture(uA, vW / uSize).z);
}`;
    into.addChild(quad(`hg-gray${ts.length}`, frag, [x0, y0, x1 - x0, y1 - y0], { ...res, grayUniforms: uniforms(u) }));
  }

  frame(): boolean {
    return false;
  }
}
