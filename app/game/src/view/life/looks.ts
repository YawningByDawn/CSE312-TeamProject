import { Container, Rectangle, Sprite, Texture, type Renderer } from 'pixi.js';
import type { Activity, PlaceId, RoleId, UnitId } from '../../types';
import { MINE_FRAME } from '../../content/map';
import { PLACES } from '../../content/world';
import { ROLES } from '../../content/roles';
import { decode, upload } from '../pictures';
import { Body, type Kit, type LookBody, type Rest, type Series } from './rig';
import { nameId, unpack } from './ids';

// A person's look (its baked parts and poses), the figure layer's numbers and its place helpers (people.ts draws with them).
const FILES = import.meta.glob('../../../assets/people/*.hi.webp', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
export const PAGES = import.meta.glob('../../../assets/poses/lo*.webp', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
/** a mine person's rig unit in mine units; a townsperson's in town units (24 tall) */
export const MINE_RIG = 0.9;
/** below this many device px per rig unit a figure shows its low-detail atlas */
export const LOW_DETAIL_PX = 1.6;
/** seconds a follower's paint takes to come in; a fall before a body goes */
export const PAINT_FADE = 1.5;
/** a figure's height in rig units; under SMALL_PX device px tall it steps through its loop's baked steps */
export const FIGURE_H = 40;
export const SMALL_PX = 28;
export const FALL = 4;
/** what a look's pose role shows for an Activity (a clip of assets/poses; `work` the role's own) */
export const CLIP: Record<Activity, string> = {
  sleep: 'sleep', walk: 'idle', dig: 'dig', haul: 'fill', sort: 'sort', work: '', eat: 'eat', drink: 'drink', talk: 'talk',
  pray: 'pray', guard: 'watch', search: 'patdown', idle: 'idle', offer: 'offerSet', mourn: 'sit',
};
/** what a person does when an event lands on them: the reaction's clip and whether it takes the whole body */
export const REACT: Partial<Record<string, readonly [string, boolean]>> = {
  whisper: ['lookround', false], refused: ['refused', false], turned: ['turned', true], startle: ['startle', true], fear: ['cower', true],
};
export const VIOLET = 0xa060ff, GOLD = 0xffb83a, PALE = 0xe9e5d4, BONE = 0xfff4d6, HOVER = 0xe8e2f4;
/** the ring cell's squash (src/view/life/cells.ts RING_ASPECT), and the picked ring's ticks' length in screen px */
export const RING_ASPECT = 0.43, PICK_TICK = 5;

export interface LookData { id: string; role: string; hk: number; kit: Kit; rest: Rest; tally: boolean; rainHood: boolean; k: { lo: number; hi: number }; parts: Record<string, number[][]>; cells: { lo: number[]; hi: number[] } }
export interface PoseData {
  holds: (string | number | null)[][]; series: (Omit<Series, 'f'> & { f: number[] })[]; roles: Record<string, Record<string, number>>;
  looks: Record<string, number[]>; lo: { pages: string[]; at: Record<string, [x: number, y: number, page: number]> };
}

/** A look: its body facts, its parts by name id, its two atlases (the low one a place on a page of pictures) and their cells' textures. */
export class Look {
  readonly body: LookBody;
  readonly variants: (number[][] | undefined)[] = [];
  readonly memo: (Map<number, number> | undefined)[] = [];
  readonly tex: { lo: (Texture | undefined)[]; hi: (Texture | undefined)[] } = { lo: [], hi: [] };
  hi: Texture | null = null;
  private asked = false;
  constructor(readonly d: LookData, private readonly pages: readonly (Texture | undefined)[], readonly loAt: readonly [number, number, number], extra: number[]) {
    this.body = { hk: d.hk, hunch: extra[0]!, tilt: extra[1]!, seed: extra[2]!, kit: d.kit, rest: d.rest, rainHood: d.rainHood };
    for (const [name, vs] of Object.entries(d.parts)) this.variants[nameId(name)] = vs;
  }
  /** its page of low-detail pictures, once loaded */
  get lo(): Texture | undefined {
    return this.pages[this.loAt[2]];
  }
  /** the cell (by detail level) of part `id`'s variant nearest `bins` (each bin outweighs every later one), or -1 */
  cell(id: number, bins: number, lod: 0 | 1): number {
    let m = this.memo[id];
    if (!m) m = this.memo[id] = new Map();
    let v = m.get(bins);
    if (v === undefined) {
      const list = this.variants[id];
      let best = -1, bestD = Infinity;
      if (list) {
        const b = unpack(bins, list[0]!.length - 2, []);
        for (let i = 0; i < list.length; i++) {
          const x = list[i]!;
          let dd = 0;
          for (let k = 0; k < b.length; k++) dd = dd * 64 + Math.min(63, Math.abs(x[k]! - b[k]!));
          if (dd < bestD) { bestD = dd; best = i; }
        }
      }
      m.set(bins, (v = best));
    }
    if (v < 0) return -1;
    const x = this.variants[id]![v]!;
    return x[x.length - 2 + lod]!;
  }
  /** the full-detail atlas, asked for the first time it is wanted */
  wantHi(renderer: Renderer): Texture | null {
    if (!this.asked) {
      this.asked = true;
      void decode(FILES[`../../../assets/people/${this.d.id}.hi.webp`]!).then((bm) => { this.hi = upload(renderer, bm); });
    }
    return this.hi;
  }
  texture(lod: 0 | 1, ci: number): Texture {
    const list = lod ? this.tex.hi : this.tex.lo;
    let t = list[ci];
    if (!t) {
      const c = lod ? this.d.cells.hi : this.d.cells.lo, o = ci * 6, dx = lod ? 0 : this.loAt[0], dy = lod ? 0 : this.loAt[1];
      t = list[ci] = new Texture({ source: (lod ? this.hi! : this.lo!).source, frame: new Rectangle(c[o]! + dx, c[o + 1]! + dy, c[o + 2]!, c[o + 3]!) });
    }
    return t;
  }
}

/** One person on screen: their container (feet at its origin), its part sprites, the body and the marks under it. */
export interface Shown {
  id: UnitId;
  look: Look;
  role: string;
  root: Container;
  figure: Container;
  sprites: Sprite[];
  /** a small figure: the one sprite of its stamp, and its slot of the stamps' page (-1: none) */
  whole: Sprite;
  slot: number;
  pool: Sprite;
  ring: Sprite;
  beam: Sprite;
  /** the picked ring's four ticks: east, south, west, north */
  ticks: Sprite[];
  /** the host's mark: a diamond over the head for each day it has left (at most `HOST.markDays`) */
  pips: Sprite[];
  body: Body;
  /** a stable 0..1 of the person: phases and fidgets */
  v: number;
  facing: number;
  turnAt: number;
  follower: boolean;
  paintAt: number;
  fellAt: number;
  /** the route the polyline was built for, and the polyline: x, y (town units), cumulative length, region (1 the mine) */
  route: PlaceId[] | null;
  line: Float64Array;
  lineN: number;
  /** the frame it was last placed in */
  stamp: number;
  /** a small figure's step and paint, its loop and its stamp's px per rig unit, as last stamped (-1: stamped every frame) */
  key: number;
  keyName: string;
  keyPx: number;
}

export const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
};
const AREA_OF = new Map<PlaceId, PlaceId>();
export const areaOf = (p: PlaceId): PlaceId => {
  let a = AREA_OF.get(p);
  if (a === undefined) AREA_OF.set(p, (a = PLACES[p]?.area ?? p));
  return a;
};
/** a mine point (mine units) in world units */
export const mx = (x: number): number => MINE_FRAME.x + x / MINE_FRAME.per;
export const my = (y: number): number => MINE_FRAME.y + y / MINE_FRAME.per;

/** The mine's six look families, and the skeleton's (no trade draws it: a skeleton is shown as it is, `MOB_FAMILY`). */
export const FAMILIES: readonly string[] = ['digger', 'hauler', 'sorter', 'keeper', 'overseer', 'guard', 'skeleton'];
export const MOB_FAMILY = 'skeleton';

/** The look family a trade is drawn from. */
export function familyOf(role: RoleId, id: UnitId): string {
  const r = ROLES[role]!;
  if (r.labour === 'dig') return 'digger';
  if (r.labour === 'haul') return 'hauler';
  if (r.labour === 'sort') return 'sorter';
  if (r.serves === 'temple') return 'keeper';
  if (r.serves === 'council') return r.standing === 'elite' ? 'overseer' : 'guard';
  return (['digger', 'hauler', 'sorter'] as const)[Math.floor(hash(id) * 3)]!;
}
