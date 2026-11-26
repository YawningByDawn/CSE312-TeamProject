import { Container, Sprite, type Renderer } from 'pixi.js';
import type { Layer, Query, ViewModel } from '../types';
import { tiles, upload, decode } from './pictures';
import { layerRoot, pit, show } from './quad';
import { differs, quant } from './tables';
import litUrl from '../../assets/mine/lit-1.webp?url';
import nightUrl from '../../assets/mine/night-1.png?url';

// The ground layer (#57, #58): the mine's rock, walls, floors, props and crystals as the one pre-lit picture (lit-1,
// LIT_PX px a mine unit), its night (night-1: night light over day light, NIGHT_UNITS mine units a px) multiplied over it
// by the hour, in the pit.

const LIT_PX = 2, NIGHT_UNITS = 2;

export class Ground implements Layer {
  readonly name = 'ground';
  readonly root = layerRoot(new Container());
  private readonly mine = pit();
  private night: Sprite | null = null;
  private readonly shown: number[] = [];

  constructor(private readonly q: Query) {
    this.root.addChild(this.mine);
  }

  async load(renderer: Renderer): Promise<void> {
    const [lit, night] = await Promise.all([tiles(renderer, litUrl), decode(nightUrl)]);
    for (const t of lit) {
      const s = this.mine.addChild(new Sprite(t.tex));
      s.position.set(t.x / LIT_PX, t.y / LIT_PX);
      s.scale.set(1 / LIT_PX);
    }
    const n = (this.night = this.mine.addChild(new Sprite(upload(renderer, night))));
    n.scale.set(NIGHT_UNITS);
    n.blendMode = 'multiply';
  }

  frame(vm: ViewModel): boolean {
    const night = quant(1 - this.q.daylight(this.q.hour(vm.state.tick)), 64);
    if (!differs(this.shown, night)) return false;
    if (this.night) show(this.night, night);
    return true;
  }
}
