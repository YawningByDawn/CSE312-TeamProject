import { Container, UniformGroup, type Renderer } from 'pixi.js';
import type { Layer, Query, ViewModel } from '../types';
import { MINE_FRAME } from '../content/map';
import { below } from './camera';
import { decode, decodeData, upload } from './pictures';
import { pit, quad } from './quad';
import { quant } from './tables';
import type { Sky } from './sky';
import M from '../../assets/sheen/manifest.json';
import sheenUrl from '../../assets/sheen/sheen.png?url';
import ownerUrl from '../../assets/sheen/owner.png?url';

// The mine's wet sheen (#73): the streaks of light on wet faces and floor are one baked picture (assets/sheen), added
// over the lit ground as the sky's wet says, a little less where no zone owns the rock (owner.png, a zone a fog cell),
// dimmer by night. Nothing is painted or uploaded when the weather changes: the wet is a uniform.

const FRAG = /* glsl */ `
uniform sampler2D uS; // the sheen (premultiplied)
uniform sampler2D uO; // the owner: zone index + 1 in R, a texel a fog cell
uniform vec2 uWorld; uniform float uCell; uniform float uWet;
void main() {
  vec4 S = texture(uS, vW / uWorld);
  float owned = texelFetch(uO, ivec2(vW / uCell), 0).r > 0.5 / 255.0 ? 1.0 : 0.6;
  o = vec4(S.rgb * (uWet * owned), 0.0);
}`;

export class Sheen implements Layer {
  /** on the ground, under the people and the light */
  readonly name = 'ground';
  readonly root: Container;
  private readonly uni = new UniformGroup({
    uWorld: { value: new Float32Array([M.pw / M.bandLimit, M.ph / M.bandLimit]), type: 'vec2<f32>' },
    uCell: { value: M.cell, type: 'f32' }, uWet: { value: 0, type: 'f32' },
  });
  private shown = -1;

  private constructor(private readonly q: Query, private readonly sky: Sky, sheen: unknown, owner: unknown) {
    this.root = pit(quad('hg-sheen', FRAG, [0, 0, MINE_FRAME.w, MINE_FRAME.h], { uS: sheen, uO: owner, sheenUniforms: this.uni }));
  }

  static async load(renderer: Renderer, q: Query, sky: Sky): Promise<Sheen> {
    const [s, o] = await Promise.all([decode(sheenUrl), decodeData(ownerUrl)]);
    return new Sheen(q, sky, upload(renderer, s).source, upload(renderer, o, true).source);
  }

  frame(vm: ViewModel): boolean {
    const sky = this.sky, night = 1 - this.q.daylight(this.q.hour(vm.state.tick));
    // wet amounts this close count as one: the sky moves the sheen in steps no eye tells apart
    const wet = quant(Math.min(1, Math.max(sky.wetness * 0.8, sky.flood)) * 0.55 * (1 - 0.45 * night) * below(vm.camera.zoom), 32);
    if (wet === this.shown) return false;
    this.shown = wet;
    this.root.visible = wet > 0;
    (this.uni.uniforms as { uWet: number }).uWet = wet;
    return true;
  }
}
