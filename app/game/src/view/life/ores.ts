import { Container, Sprite, Texture } from 'pixi.js';
import type { Layer, Query, ViewModel } from '../../types';
import { ORE_SITES } from '../../content/mine';
import { PLACES } from '../../content/world';
import type { Atlas } from '../atlas';
import { StateSeen } from '../moved';
import { pit } from '../quad';
import { BONE } from './looks';

// The mine's ores (OVERHAUL, ov-mine; MINE, ore-marks): each site of content's ORE_SITES the foot of a wall face the host
// can work, the ore atlas's baked seam (a vein of violet crystal in the face, rising from the foot) in a soft glow of the
// life atlas's on the rock round it, bigger with the tier; hidden once mined for the day and in the dark. The ore the work
// key would mine (the sim's `workAt`) wears the seam's baked rim, pulsing; the ore being worked shows its seconds as a bar
// above it, filling to the mining time. Mine units, in the pit.

const GLOW = [14, 17, 20] as const;
const BAR = { w: 24, h: 3, gap: 4 } as const;
const BAR_BACK = 0x0a0612, BAR_FILL = 0xcfaef0;

interface Ore { root: Container; rim: Sprite; bar: Sprite; fill: Sprite; area: string }

export class Ores implements Layer {
  readonly name = 'props';
  readonly root = pit();
  private readonly ores: Ore[];
  /** each ore's seam's height over its foot, mine units */
  readonly tops: number[] = [];
  private readonly seen = new StateSeen();
  /** what each ore showed last frame: 0 hidden, 1 standing, 2 in reach, 3 + the share worked (a bar) */
  private readonly shown: number[] = [];
  private lit: Sprite | null = null;

  constructor(private readonly q: Query, life: Atlas, ore: Atlas) {
    this.ores = ORE_SITES.map((o, i) => {
      const root = new Container();
      root.position.set(o.x, o.y);
      const name = `${o.tier - 1}-${i % 2}`, c = ore.cell(`seam-${name}`);
      this.tops.push(c[6] / c[4]);
      // the glow at the seam's middle: its cell's centre
      const glow = life.glow('glow-0.2', (c[2] / 2 - c[5]) / c[4], (c[3] / 2 - c[6]) / c[4], GLOW[o.tier - 1]!, 0x9a6bff);
      glow.blendMode = 'add';
      glow.alpha = 0.45;
      const seam = ore.sprite(`seam-${name}`), rim = ore.sprite(`rim-${name}`);
      seam.scale.set(1 / c[4]);
      rim.scale.set(1 / c[4]);
      rim.tint = BONE;
      rim.blendMode = 'add';
      const back = new Sprite(Texture.WHITE), fill = new Sprite(Texture.WHITE);
      back.tint = BAR_BACK;
      fill.tint = BAR_FILL;
      back.width = BAR.w;
      back.height = fill.height = BAR.h;
      back.position.set(-BAR.w / 2, -this.tops[i]! - BAR.gap);
      fill.position.copyFrom(back.position);
      root.addChild(glow, seam, rim, back, fill);
      this.root.addChild(root);
      this.shown.push(-1);
      return { root, rim, bar: back, fill, area: PLACES[o.place]?.area ?? o.place };
    });
  }

  frame(vm: ViewModel): boolean {
    let changed = false;
    if (this.seen.moved(vm)) {
      const s = vm.state, w = this.q.workAt(s);
      const reach = w !== null && w !== 'drop' && s.body?.ore !== w.mine ? w.mine : -1;
      this.lit = null;
      this.ores.forEach((o, i) => {
        const stands = this.q.oreStands(s, i) && this.q.visibility(s, o.area) !== 'void';
        const share = stands && s.body?.ore === i ? Math.min(1, s.body.work / this.q.oreSeconds(s, i)) : -1;
        const key = !stands ? 0 : share >= 0 ? 3 + share : i === reach ? 2 : 1;
        if (key === 2) this.lit = o.rim;
        if (key === this.shown[i]) return;
        this.shown[i] = key;
        changed = true;
        o.root.visible = stands;
        o.rim.visible = key === 2;
        o.bar.visible = o.fill.visible = share >= 0;
        o.fill.width = Math.max(0.01, BAR.w * share);
      });
    }
    if (!this.lit) return changed;
    this.lit.alpha = 0.6 + 0.4 * Math.sin(vm.time * 3.2);
    return true;
  }
}
