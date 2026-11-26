import { Container, Sprite, Texture } from 'pixi.js';
import type { Layer, Query, ViewModel } from '../../types';
import { ORE_SITES } from '../../content/mine';
import { PLACES } from '../../content/world';
import type { Atlas } from '../atlas';
import { StateSeen } from '../moved';
import { pit } from '../quad';

// The mine's ores (OVERHAUL, ov-mine): each site of content's ORE_SITES a baked gem of the life atlas standing in its pool
// of light, bigger with the tier (the shape of a dull, a clear, a bright stone), hidden once mined for the day and in the
// dark; the ore being worked shows its seconds as a bar above it, filling to the mining time. Mine units, in the pit.

/** An ore's height by tier, in mine units (a person is about 36 tall). */
const HEIGHT = [14, 20, 28] as const;
const POOL = [11, 16, 22] as const;
const BAR = { w: 24, h: 3, gap: 6 } as const;
const BAR_BACK = 0x0a0612, BAR_FILL = 0xcfaef0;

interface Ore { root: Container; bar: Sprite; fill: Sprite; area: string }

export class Ores implements Layer {
  readonly name = 'props';
  readonly root = pit();
  private readonly ores: Ore[];
  private readonly seen = new StateSeen();
  /** what each ore showed last frame: 0 hidden, 1 standing, 1 + the share worked (a bar) */
  private readonly shown: number[] = [];

  constructor(private readonly q: Query, life: Atlas) {
    this.ores = ORE_SITES.map((o, i) => {
      const root = new Container();
      root.position.set(o.x, o.y);
      const pool = life.glow('glow-0.2', 0, 0, POOL[o.tier - 1]!, 0x9a6bff, 0.5);
      pool.blendMode = 'add';
      pool.alpha = 0.55;
      const gem = life.sprite(`gem-c${o.tier - 1}-${i % 3}-0`);
      gem.scale.set(HEIGHT[o.tier - 1]! / gem.texture.frame.height);
      const back = new Sprite(Texture.WHITE), fill = new Sprite(Texture.WHITE);
      back.tint = BAR_BACK;
      fill.tint = BAR_FILL;
      back.width = BAR.w;
      back.height = fill.height = BAR.h;
      back.position.set(-BAR.w / 2, -HEIGHT[o.tier - 1]! - BAR.gap);
      fill.position.copyFrom(back.position);
      root.addChild(pool, gem, back, fill);
      this.root.addChild(root);
      this.shown.push(-1);
      return { root, bar: back, fill, area: PLACES[o.place]?.area ?? o.place };
    });
  }

  frame(vm: ViewModel): boolean {
    if (!this.seen.moved(vm)) return false;
    const s = vm.state;
    let changed = false;
    this.ores.forEach((o, i) => {
      const stands = this.q.oreStands(s, i) && this.q.visibility(s, o.area) !== 'void';
      const share = stands && s.body?.ore === i ? Math.min(1, s.body.work / this.q.oreSeconds(s, i)) : -1;
      const key = stands ? 1 + Math.max(0, share) + (share >= 0 ? 1 : 0) : 0;
      if (key === this.shown[i]) return;
      this.shown[i] = key;
      changed = true;
      o.root.visible = stands;
      o.bar.visible = o.fill.visible = share >= 0;
      o.fill.width = Math.max(0.01, BAR.w * share);
    });
    return changed;
  }
}
