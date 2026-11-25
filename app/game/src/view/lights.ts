import { Container, type Sprite, type Texture } from 'pixi.js';
import type { Layer, PlaceId, Query, ViewModel } from '../types';
import { DRESS, type MineFlame, type MineLight } from '../content/map';
import { layerRoot, pit } from './quad';
import { AREAS } from '../content/world';
import { below } from './camera';
import { pool, type Atlas } from './atlas';
import { StateSeen } from './moved';
import { hash, hex } from './tables';

// The mine's moving light (#58, #60, #61): over the lit picture, each light's flicker above its baked level, the
// flames' tongues and halos, the lamps' cores, the crystals' glints and the god's eye, all life-atlas cells placed
// once from content's dress list, tinted and added. A step of the clock (STEP_HZ) picks each flame's frame and each
// light's strength; an area's visibility says what shows: colour where active, gray where sensed, nothing in the void.
// The hour puts torches out at night (NIGHT_BURN).

const STEP_HZ = 10;
/** The share of a kind still burning at full night. */
const NIGHT_BURN: Record<string, number> = { torch: 0.1, ember: 0.3, lamp: 0.7, tally: 0.85 };
/** The flicker level the lit picture is baked at: the sprite adds only what rises above it. */
const BASE_FLICKER: Record<string, number> = { torch: 0.86, candle: 0.86, ember: 0.86, crystal: 0.85, fungus: 0.8, water: 0.9, god: 0.75 };
const AREA_GAIN: Record<PlaceId, number> = { sump: 1.45, lowgallery: 1.35, eastworks: 1.2, lift: 1.1 };
const DYN_K = 0.42, GOD_BASE = 0.45, WARM = new Set(['torch', 'candle', 'ember']);
/** A flame's tongue: TONGUE_FRAMES frames a TONGUE_LOOP s loop; the cell holds a third of its light (three stacked). */
const TONGUE_FRAMES = 12, TONGUE_LOOP = 1.2, TONGUE_STACK = 3;
const GRAY = 0xb8bec2, GLINT = 0xeadfff, GLINT_GRAY = 0xc9c4d6;
const MINE_AREAS = Object.keys(AREAS).filter((a) => AREAS[a]!.region === 'mine');

const noise = (t: number, seed: number): number => {
  const i = Math.floor(t), f = t - i, a = hash(i, 7, seed);
  return a + (hash(i + 1, 7, seed) - a) * f * f * (3 - 2 * f);
};
function flicker(kind: string, t: number, s: number): number {
  if (WARM.has(kind)) return 0.82 + 0.13 * noise(t * 7 + s, s) + 0.07 * noise(t * 19 + s * 3, s + 1);
  if (kind === 'crystal') return 0.8 + 0.2 * (0.5 + 0.5 * Math.sin(t * 0.9 + s * 0.37));
  if (kind === 'fungus') return 0.75 + 0.25 * (0.5 + 0.5 * Math.sin(t * 0.6 + s));
  return 0.94 + 0.06 * noise(t * 3 + s, s);
}
/** A warm light's colour pulled toward fire. */
function warm(c: number): number {
  const mix = (sh: number, to: number) => Math.round(((c >> sh) & 255) * 0.68 + to * 0.32) << sh;
  return mix(16, 0xff) | mix(8, 0x5a) | mix(0, 0x1e);
}

type Light = { s: Sprite; l: MineLight; seed: number; rgb: number };
type Flame = { halo: Sprite; core: Sprite[]; f: MineFlame; seed: number; lamp: boolean };
type Glint = { s: Sprite; halo: Sprite; area: PlaceId; x: number; y: number; size: number; seed: number; i: number };

export class Lights implements Layer {
  readonly name = 'above';
  readonly root = layerRoot(new Container());
  private readonly lights: Light[] = [];
  private readonly flames: Flame[] = [];
  private readonly glints: Glint[] = [];
  private readonly eye: [Sprite, Sprite];
  /** each mine area's visibility as 2 active, 1 sensed, 0 void, as last placed */
  private readonly vis = new Map<PlaceId, number>();
  private shown = { step: -1, below: -1, night: -1, lit: 0 };
  private readonly mine = pit();
  /** the tongue's frames by tone (0 the Flame's, 1 a fouled shrine's violet) */
  private readonly tongue: Texture[][];
  /** the areas a Crystal Bloom lights this step */
  private readonly bloom = new Set<PlaceId>();
  private readonly seen = new StateSeen();

  constructor(private readonly q: Query, atlas: Atlas) {
    this.tongue = [0, 1].map((tone) => Array.from({ length: TONGUE_FRAMES }, (_, i) => atlas.texture(`tongue-${tone}-${i}`)));
    this.root.addChild(this.mine);
    const add = (s: Sprite): Sprite => {
      s.blendMode = 'add';
      return this.mine.addChild(s);
    };
    const glow = (cell: string, x: number, y: number, r: number, sy = 1, tint = 0xffffff) => add(atlas.glow(cell, x, y, r, tint, sy));
    DRESS.lights.forEach((l, i) => {
      if (l.kind === 'lamp' || l.kind === 'tally') return;
      const s = glow('glow-0.1', l.x, l.y, l.r * (l.kind === 'god' ? 0.8 : 0.45), l.sy ?? 0.8);
      this.lights.push({ s, l, seed: i * 7 + 1, rgb: WARM.has(l.kind) ? warm(hex(l.color)) : hex(l.color) });
    });
    DRESS.flames.forEach((f, i) => {
      const lamp = f.kind === 'lamp' || f.kind === 'tally', k = atlas.cell('tongue-0-0')[4];
      const halo = lamp ? glow('glow-0.3', f.x, f.y, 22 * Math.max(0.6, f.size)) : glow('glow-0.1', f.x, f.y - 3 * f.size, 24 * f.size);
      const core = lamp
        ? [glow('glow-0.3', f.x, f.y, 7 * Math.max(0.6, f.size), 1, f.kind === 'tally' ? 0xe4f0ff : 0xf4f9ff)]
        : Array.from({ length: TONGUE_STACK }, () => {
          const c = add(atlas.sprite('tongue-0-0'));
          c.position.set(f.x, f.y);
          c.scale.set(f.size / k);
          return c;
        });
      this.flames.push({ halo, core, f, seed: i * 13 + 5, lamp });
    });
    for (const g of DRESS.glints) {
      for (let i = 0, n = g.size > 60 ? 4 : g.size > 25 ? 2 : 1; i < n; i++) {
        this.glints.push({ s: add(atlas.sprite('star4')), halo: add(atlas.sprite('glow-0.2')), area: g.area, x: g.x, y: g.y, size: g.size, seed: Math.round(g.x * 7 + g.y), i });
      }
    }
    const e = DRESS.points.graveEye;
    this.eye = [glow('glow-0.2', e.x, e.y + 2, 1, 1, 0x8f4dff), glow('glow-0.3', e.x, e.y + 1, 1, 1, 0xe6d0ff)];
  }

  frame(vm: ViewModel): boolean {
    const b = below(vm.camera.zoom), sh = this.shown;
    // on the surface the mine's light is shut: nothing to read
    if (b === 0) {
      if (sh.below === 0) return false;
      sh.below = 0;
      this.root.visible = false;
      return true;
    }
    const step = Math.floor(vm.time * STEP_HZ), night = 1 - this.q.daylight(this.q.hour(vm.state.tick));
    let visMoved = false;
    if (this.seen.moved(vm)) {
      for (const area of MINE_AREAS) {
        const v = this.q.visibility(vm.state, area), n = v === 'active' ? 2 : v === 'sensed' ? 1 : 0;
        if (this.vis.get(area) !== n) this.vis.set(area, n), (visMoved = true);
      }
    }
    if (b === sh.below && step === sh.step && !visMoved && Math.abs(night - sh.night) < 1 / 64) return false;
    const was = sh.below, lit = sh.lit;
    Object.assign(sh, { below: b, step, night });
    this.root.visible = true;
    this.root.alpha = b;
    // a step where nothing shows, after one where nothing showed, changes nothing on screen
    sh.lit = this.place(step / STEP_HZ, night, vm);
    return b !== was || sh.lit > 0 || lit > 0;
  }

  /** Place every sprite for clock `t`; how many show. */
  private place(t: number, night: number, { state: s }: ViewModel): number {
    const burn = (kind: string) => 1 - night * (1 - (NIGHT_BURN[kind] ?? 1)), pulse = 0.55 + 0.25 * Math.sin(t * 0.8);
    this.bloom.clear();
    for (const e of s.effects) if (e.kind === 'bloom' && e.on) this.bloom.add(e.on);
    for (const it of this.lights) {
      const l = it.l, god = l.kind === 'god', base = BASE_FLICKER[l.kind] ?? 1;
      const extra = god ? (0.35 + 0.9 * pulse) * flicker(l.kind, t, it.seed) - GOD_BASE * base : flicker(l.kind, t, it.seed) - base;
      const bloom = l.kind === 'crystal' && this.bloom.has(l.area) ? 2.2 : 1;
      const a = this.vis.get(l.area) === 2 ? l.k * (AREA_GAIN[l.area] ?? 1) * extra * DYN_K * (god ? 1.3 : 1.6) * burn(l.kind) * bloom : 0;
      it.s.visible = a > 0.012 || (god && a > 0.004);
      it.s.alpha = Math.min(1, a);
      it.s.tint = it.rgb;
    }
    const fouled = !!s.places.kilnshrine?.desecrated;
    for (const it of this.flames) {
      const f = it.f, v = this.vis.get(f.area) ?? 0, a = burn(f.kind), tone = fouled && f.area === 'kilnshrine' ? 1 : 0;
      if (v === 2) {
        it.halo.visible = true;
        it.halo.tint = it.lamp ? (f.kind === 'tally' ? 0x6c9ee0 : 0xbcd8f2) : tone ? 0x8a4dff : 0xff8a2a;
        it.halo.alpha = a * (it.lamp ? 0.8 : 0.55);
        const frame = Math.floor(((((t + it.seed * 0.37) / TONGUE_LOOP) % 1) + 1) % 1 * TONGUE_FRAMES);
        for (const c of it.core) {
          c.visible = true;
          c.alpha = a;
          if (!it.lamp) c.texture = this.tongue[tone]![frame]!;
        }
      } else {
        it.halo.visible = v === 1 && f.kind !== 'candle';
        it.halo.tint = GRAY;
        it.halo.alpha = 0.45;
        for (const c of it.core) c.visible = false;
      }
    }
    for (const g of this.glints) this.sparkle(g, t, this.vis.get(g.area) ?? 0);
    const p = 0.5 + 0.5 * Math.sin(t * 1.25), [halo, core] = this.eye;
    halo.visible = core.visible = this.vis.get('grave') === 2;
    pool(halo, halo.x, halo.y, 70 + 30 * p, 0.45).alpha = (0.35 + 0.5 * pulse) * (0.6 + 0.4 * p);
    pool(core, core.x, core.y, 22, 0.6).alpha = (0.4 + 0.5 * pulse) * (0.5 + 0.5 * p);
    return this.mine.children.reduce((n, c) => n + (c.visible ? 1 : 0), 0);
  }

  /** Up to four sparkles to a cluster, each on its own period, flashing at a new spot each time round. */
  private sparkle(g: Glint, t: number, v: number): void {
    const show = (on: boolean) => { g.s.visible = g.halo.visible = on; };
    if (v === 0) return show(false);
    const boost = v === 2 && this.bloom.has(g.area) ? 2.2 : 1;
    const tt = t * (v === 2 ? 1 : 0.7), period = 2.2 + hash(g.i, g.seed, 2) * 3.5, ph = hash(g.i, g.seed, 3) * period;
    const cc = ((tt + ph) % period) / period, span = 0.22 * boost;
    if (cc > span) return show(false);
    const k = Math.sin((cc / span) * Math.PI), cycle = Math.floor((tt + ph) / period);
    const x = g.x + (hash(cycle, g.seed + g.i, 4) - 0.5) * g.size * 0.7, y = g.y + (hash(cycle, g.seed + g.i, 5) - 0.3) * g.size * 0.6;
    const r = 3 + g.size * 0.07, a = k * (v === 2 ? 1 : 0.4);
    show(true);
    g.s.tint = g.halo.tint = v === 2 ? GLINT : GLINT_GRAY;
    pool(g.halo, x, y, r * 1.2).alpha = a;
    g.s.position.set(x, y);
    g.s.scale.set((r / g.s.texture.frame.width) * 2);
    g.s.alpha = a;
  }
}
