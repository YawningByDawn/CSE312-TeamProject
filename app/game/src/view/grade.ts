import { Container, Sprite, Texture } from 'pixi.js';
import type { Layer, Query, ViewModel } from '../types';
import { TOWN } from '../content/map';
import { below, ORIGIN } from './camera';
import type { Atlas } from './atlas';
import type { Sky } from './sky';
import { layerRoot, show } from './quad';
import { differs, quant, smooth } from './tables';

// The light by the hour on the surface (#70), over everything on it: the town's night picture (assets/townlight `night`,
// its lamps' pools kept) multiplied in as the daylight goes, and one flat multiply: white at noon, blue-black at night,
// a warm turn as the sun stands low, grayed under the weather's dark and the rain over the view, blued by a cold one
// (faded in over cold 0.3 to 0.5), lit to day by a lightning flash. It fades with the surface; exact black stays black.

const NIGHT = [0xcb, 0xd3, 0xe2], LOW_SUN = [0xd4, 0x9a, 0x72], CLOUD = [0x8a, 0x8e, 0x94], COLD = [0xa6, 0xbb, 0xd6];
/** the daylight the low sun's warmth peaks at, how far either side it reaches, its strength; a full cover's and the cold's */
const LOW_AT = 0.35, LOW_SPAN = 0.25, LOW_K = 0.5, CLOUD_K = 0.36, COLD_K = 0.38;

/** The grade's colour as 0xRRGGBB for a daylight, the sky and the rain over the view. */
function gradeOf(day: number, sky: Sky, rain: number): number {
  const night = smooth(0, 1, 1 - day), L = sky.look, low = Math.max(0, 1 - Math.abs(day - LOW_AT) / LOW_SPAN) * LOW_K;
  const cover = quant(Math.min(1, L.dark * 1.25 + rain * 0.12), 32), cold = L.cold * COLD_K * smooth(0.3, 0.5, L.cold);
  let rgb = 0;
  for (let i = 0; i < 3; i++) {
    let c = 255 + (NIGHT[i]! - 255) * night;
    c += (LOW_SUN[i]! - c) * low;
    c += (CLOUD[i]! - c) * cover * CLOUD_K;
    c *= 1 + (COLD[i]! / 255 - 1) * cold;
    rgb = (rgb << 8) | Math.round(c + (255 - c) * Math.min(1, sky.flash * 1.1));
  }
  return rgb;
}

export class Grade implements Layer {
  readonly name = 'grade';
  readonly root = layerRoot(new Container());
  private readonly sheet = new Sprite(Texture.WHITE);
  private readonly night: Sprite;
  private readonly shown: number[] = [];

  constructor(private readonly q: Query, light: Atlas, private readonly sky: Sky) {
    this.night = light.sprite('night');
    this.night.scale.set(1 / light.cell('night')[4]);
    // the surface and the valley around it
    this.sheet.position.set(-TOWN.w, -TOWN.h);
    this.sheet.setSize(TOWN.w * 3, TOWN.h * 3);
    this.night.blendMode = this.sheet.blendMode = 'multiply';
    this.root.addChild(this.night, this.sheet);
  }

  frame(vm: ViewModel): boolean {
    const alpha = quant(1 - below(vm.camera.zoom), 64), day = this.q.daylight(this.q.hour(vm.state.tick)), c = vm.camera;
    const rgb = gradeOf(day, this.sky, this.sky.rainAt(c.x + ORIGIN.x, c.y + ORIGIN.y)), night = quant((1 - day) * (1 - Math.min(1, this.sky.flash * 1.1)), 64);
    if (!differs(this.shown, rgb, alpha, night)) return false;
    show(this.root, rgb !== 0xffffff || night > 0 ? alpha : 0);
    this.sheet.tint = rgb;
    show(this.night, night);
    return true;
  }
}
