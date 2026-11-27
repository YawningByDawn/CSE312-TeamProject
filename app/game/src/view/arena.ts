import { Container, Sprite, type Renderer } from 'pixi.js';
import type { Layer, LayerName, MatchSetup, PlaceId, Query, ViewModel } from '../types';
import { ARENA, GOD_COLOURS } from '../content/arena';
import { GROUND, ROCK } from '../content/mine';
import { PLACES } from '../content/world';
import type { Atlas } from './atlas';
import { dataTexture } from './pictures';
import { pit } from './quad';

// The shared mine's own marks (multiplayer, DECISIONS §133), in the pit (mine units), shown only while a match plays.
// Under the people: each god's domain, its floor washed faintly in the god's colour (one data texture of the walk
// grid's cells); each shrine an altar of three tall gems in that colour in a pool and pillar of its light, a ring where
// crystals are given, and the crystals given heaped round it (one gem a point, up to HEAP); and the crystals on the
// ground, the life atlas's gray gem tinted violet in its own glow and a pulsing ring, bobbing. Over the people: the crystals each
// player carries as small gems over their head, the blow that struck one (the baked `hit` frames at the chest) and the
// motes circling a stunned head. The players' figures are the people layer's.

/**
 * The rules as the layers read them: while a match plays (the frame's view model, `now`), the shared mine's open zones
 * are lit and the rest is void, it is broad day and no ore stands; else the run's own.
 */
export function matchRules(q: Query, now: () => ViewModel | null): Query {
  const area = (p: PlaceId): PlaceId => PLACES[p]?.area ?? p;
  return {
    ...q,
    visibility: (s, p) => {
      const m = now()?.match;
      return m ? (m.open.has(area(p)) ? 'active' : 'void') : q.visibility(s, p);
    },
    daylight: (h) => (now()?.match ? 1 : q.daylight(h)),
    oreStands: (s, i) => !now()?.match && q.oreStands(s, i),
    workAt: (s) => (now()?.match ? null : q.workAt(s)),
  };
}

const VIOLET = 0xc4a0ff;
/** a crystal's bob (mine units, a second) and size; a carried gem's size and step over the head */
const BOB = 2, BOB_HZ = 0.6, GEM_H = 15, CARRIED_H = 8, CARRIED_STEP = 7, HEAD = 42;
/** the altar's gems (x, height), BACK behind the shrine's point (its player spawns in front of it), and the heap of given
 * crystals round it: at most HEAP shown, on a ring of HEAP_R */
const ALTAR: readonly [number, number][] = [[-9, 22], [0, 34], [9, 26]], BACK = 22, HEAP = 20, HEAP_R = 30;
/** the domains' wash */
const WASH = 0.2;
/** the hit's frames, seconds; the stunned motes */
const HIT_S = 0.35, HIT_FRAMES = 6, MOTES = 3;

export class Arena {
  readonly under: Layer;
  readonly over: Layer;
  private readonly lower = pit();
  private readonly upper = pit();
  private readonly domains: Sprite;
  private readonly tint: ReturnType<typeof dataTexture>;
  private shrines: Sprite[][] = [];
  private heaps: Sprite[][] = [];
  private shrineRoot = new Container();
  private readonly crystals: [Sprite, Sprite, Sprite][] = [];
  private readonly carried: Sprite[] = [];
  private readonly flashes = new Map<string, { at: number; sprite: Sprite; motes: Sprite[]; stunned: boolean }>();
  private setup: MatchSetup | null = null;
  private on = false;

  constructor(renderer: Renderer, private readonly life: Atlas) {
    this.tint = dataTexture(renderer, GROUND.gw, GROUND.gh);
    this.domains = this.lower.addChild(new Sprite(this.tint.tex));
    this.domains.scale.set(GROUND.cell);
    this.domains.alpha = WASH;
    this.lower.addChild(this.shrineRoot);
    const layer = (name: LayerName, root: Container, frame: (vm: ViewModel) => boolean): Layer => ({ name, root, frame });
    // under the people (the ores' place, which a match hides); over them with the effects
    this.under = layer('props', this.lower, (vm) => this.frame(vm));
    this.over = layer('fx', this.upper, () => this.on);
    this.lower.visible = this.upper.visible = false;
  }

  private frame(vm: ViewModel): boolean {
    const m = vm.match, was = this.on;
    this.on = m !== null;
    this.lower.visible = this.upper.visible = this.on;
    if (!m) return was;
    if (m.setup !== this.setup) this.build(m.setup);
    const t = vm.time;
    // the shrines breathe; each heap shows its god's score
    this.shrines.forEach(([pool, ring, beam], i) => {
      const p = 0.85 + 0.15 * Math.sin(t * 1.7 + i * 1.9);
      pool!.alpha = 0.9 * p;
      ring!.alpha = 0.55 + 0.35 * p;
      beam!.alpha = 0.4 * p;
      this.heaps[i]!.forEach((g, k) => (g.visible = k < (m.score[i] ?? 0)));
    });
    // the crystals on the ground
    let n = 0;
    for (const [id, x, y] of m.crystals) {
      const [glow, ring, gem] = this.crystals[n] ?? this.crystal();
      const bob = BOB * Math.sin((t * BOB_HZ + id * 0.37) * Math.PI * 2), pulse = (t * 0.8 + id * 0.21) % 1;
      glow.visible = ring.visible = gem.visible = true;
      glow.position.set(x, y);
      glow.alpha = 0.8 + 0.2 * Math.sin(t * 2.2 + id);
      ring.position.set(x, y);
      ring.scale.set(((8 + 14 * pulse) * 2) / ring.texture.frame.width);
      ring.alpha = 0.7 * (1 - pulse);
      gem.position.set(x, y - 2 + bob);
      n++;
    }
    for (let i = n; i < this.crystals.length; i++) for (const sp of this.crystals[i]!) sp.visible = false;
    // over the heads: what each carries, a blow's flash, a stun's motes
    let c = 0;
    for (const p of m.shown) {
      for (let k = 0; k < p.carry; k++) {
        const g = this.carried[c] ?? this.carriedGem();
        g.visible = true;
        g.position.set(p.x + (k - (p.carry - 1) / 2) * CARRIED_STEP, p.y - HEAD - Math.abs(Math.sin(t * 3 + k)) * 1.5);
        c++;
      }
      const f = this.flashes.get(p.name) ?? this.flash(p.name);
      if (p.stun > 0 && !f.stunned) f.at = t;
      f.stunned = p.stun > 0;
      const u = (t - f.at) / HIT_S;
      f.sprite.visible = u >= 0 && u < 1;
      if (f.sprite.visible) {
        f.sprite.texture = this.life.texture(`hit-${Math.min(HIT_FRAMES - 1, Math.floor(u * HIT_FRAMES))}`);
        f.sprite.position.set(p.x, p.y - HEAD * 0.4);
      }
      f.motes.forEach((mote, i) => {
        mote.visible = f.stunned;
        const a = t * 5 + (i / MOTES) * Math.PI * 2;
        mote.position.set(p.x + Math.cos(a) * 9, p.y - HEAD - 4 + Math.sin(a) * 3);
      });
    }
    for (let i = c; i < this.carried.length; i++) this.carried[i]!.visible = false;
    // one who left shows nothing
    for (const [name, f] of this.flashes) {
      if (m.shown.some((p) => p.name === name)) continue;
      f.sprite.visible = false;
      for (const mote of f.motes) mote.visible = false;
    }
    return true;
  }

  /** A new match's domains and shrines. */
  private build(setup: MatchSetup): void {
    this.setup = setup;
    const b = this.tint.bytes, seatOf = new Map<number, number>();
    setup.seats.forEach((s, i) => s.zones.forEach((z) => seatOf.set(GROUND.areas.indexOf(z), i)));
    for (let c = 0; c < GROUND.zone.length; c++) {
      const z = GROUND.zone[c]!, seat = z === ROCK ? undefined : seatOf.get(z), rgb = seat === undefined ? 0 : GOD_COLOURS[seat]!;
      b[c * 4] = (rgb >> 16) & 255; b[c * 4 + 1] = (rgb >> 8) & 255; b[c * 4 + 2] = rgb & 255; b[c * 4 + 3] = seat === undefined ? 0 : 255;
    }
    this.tint.send();
    for (const c of this.shrineRoot.removeChildren()) c.destroy();
    const R = ARENA.rules;
    const gem = (cell: string, x: number, y: number, h: number, tint: number): Sprite => {
      const g = this.shrineRoot.addChild(this.life.sprite(cell));
      g.tint = tint;
      g.position.set(x, y);
      g.scale.set(h / g.texture.frame.height);
      return g;
    };
    this.heaps = [];
    this.shrines = setup.seats.map((s, i) => {
      const [x, y] = s.shrine, colour = GOD_COLOURS[i]!;
      const pool = this.life.glow('glow-0.2', x, y, R.shrine * 1.5, colour, 0.55);
      const ring = this.life.sprite('ring-32-1.8');
      ring.tint = colour;
      ring.position.set(x, y);
      ring.scale.set((2 * R.shrine) / ring.texture.frame.width);
      const beam = this.life.sprite('beam');
      beam.tint = colour;
      beam.anchor.set(0.5, 1);
      beam.position.set(x, y + 4);
      beam.scale.set((R.shrine * 1.4) / beam.texture.frame.width, 300 / beam.texture.frame.height);
      for (const sp of [pool, ring, beam]) sp.blendMode = 'add';
      this.shrineRoot.addChild(pool, ring, beam);
      // the heap round the altar, drawn far to near; its gems show in their own order as the score climbs
      const heap: Sprite[] = [];
      const spots = Array.from({ length: HEAP }, (_, k) => {
        const a = (k / HEAP) * Math.PI * 2 + i * 0.7, r = HEAP_R * (0.55 + (0.45 * ((k * 7) % 5)) / 4);
        return { k, x: x + Math.cos(a) * r, y: y - BACK + Math.sin(a) * r * 0.45 };
      });
      for (const p of spots.sort((a, b) => a.y - b.y)) heap[p.k] = gem(`gem-g${p.k % 6}-1-0`, p.x, p.y, 9, VIOLET);
      this.heaps.push(heap);
      for (const [dx, h] of ALTAR) gem('gem-g3-2-0', x + dx, y - BACK + 2 - Math.abs(dx) * 0.2, h, colour);
      return [pool, ring, beam];
    });
  }

  private crystal(): [Sprite, Sprite, Sprite] {
    const glow = this.life.glow('glow-0.2', 0, 0, 20, VIOLET, 0.5);
    const ring = this.life.sprite('ring-16-1.1');
    ring.tint = VIOLET;
    for (const sp of [glow, ring]) sp.blendMode = 'add';
    const gem = this.life.sprite('gem-g2-1-0');
    gem.tint = VIOLET;
    gem.scale.set(GEM_H / gem.texture.frame.height);
    this.lower.addChild(glow, ring, gem);
    const set: [Sprite, Sprite, Sprite] = [glow, ring, gem];
    this.crystals.push(set);
    return set;
  }

  private carriedGem(): Sprite {
    const g = this.life.sprite('gem-g2-1-0');
    g.tint = VIOLET;
    g.scale.set(CARRIED_H / g.texture.frame.height);
    this.upper.addChild(g);
    this.carried.push(g);
    return g;
  }

  private flash(name: string): { at: number; sprite: Sprite; motes: Sprite[]; stunned: boolean } {
    const sprite = this.life.sprite('hit-0');
    sprite.scale.set(28 / sprite.texture.frame.width);
    const motes = Array.from({ length: MOTES }, () => {
      const mote = this.life.sprite('glyph-dot-1.7');
      mote.tint = 0xfff4d6;
      mote.scale.set(4 / mote.texture.frame.width);
      mote.visible = false;
      return mote;
    });
    this.upper.addChild(sprite, ...motes);
    const f = { at: -99, sprite, motes, stunned: false };
    sprite.visible = false;
    this.flashes.set(name, f);
    return f;
  }
}
