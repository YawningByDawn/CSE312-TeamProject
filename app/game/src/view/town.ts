import { Container, Rectangle, Sprite, Texture, type Renderer } from 'pixi.js';
import type { AtlasManifest, GameState, Layer, PlaceId, Query, ViewModel } from '../types';
import { PLACES } from '../content/world';
import { StateSeen } from './moved';
import raw from '../../assets/town/manifest.json';
import lightM from '../../assets/townlight/manifest.json';
import grayM from '../../assets/gray/things/manifest.json';
import grayUrl from '../../assets/gray/things/gray.webp?url';
import { below, DESCENT, scale } from './camera';
import { decode, upload } from './pictures';
import { Atlas, pool } from './atlas';
import { TREES } from '../content/map';
import { differs, hex, quant, smooth } from './tables';
import { layerRoot, show } from './quad';
import type { Sky } from './sky';
import type { Fog } from './fog';

// The town's buildings, places, props and cap-trees (#63): assets/town's baked sprites, each placed once where the plan
// stood it (an item's point rides in its sig), in depth (y) order with the trees' stalks among them, from the one baked
// level nearest the screen's density where the surface first shows whole (GPU mipmaps take it farther out); the surface
// fades in over the mine as the camera rises. The caps stand over the people ('above') and fade as the camera comes
// close, where a soft shade on the ground takes their place; the wind sways them. The fog's field, sampled at each thing,
// says how much shows in colour: over each its gray twin (assets/gray/things) as far as colour is not, a cap its Sensed
// tone. By night a building's lit openings glow while someone is in it, and every street lamp and torch shows its hot
// core (assets/townlight `lamps`) at any zoom, never under CORE_PX device px, where the town is Active.

type Cell = readonly [page: number, x: number, y: number, w: number, h: number, ax: number, ay: number];
type Light = readonly [dx: number, dy: number, r: number, col: string];
interface Manifest {
  scales: number[];
  pages: { file: string; scale: number }[];
  items: { id: number; sig: string; place?: PlaceId; variants: { cells: Cell[]; lights: Light[] }[] }[];
  trees: { stalk: Cell[]; shade: Cell[]; cap: Record<'day' | 'dark' | 'sensed', Cell[]> }[];
}
const M = raw as unknown as Manifest;
const URLS = import.meta.glob('../../assets/town/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

if (TREES.length !== M.trees.length) throw new Error(`town: ${M.trees.length} baked cap-trees, ${TREES.length} placed`);
/** A townsperson's height in town units: the caps fade out as one grows from CAP_PX[0] to CAP_PX[1] screen px. */
const FIGURE = 24, CAP_PX = [16, 40] as const;
/** Below this daylight a cap shows its dark tone; the caps' sway is placed SWAY_HZ times a second while the wind blows. */
const DARK_BELOW = 0.3, SWAY_HZ = 10;
const q64 = (v: number): number => quant(v, 64);
/** A lit opening's colour at its heart and its strength there. */
const LIGHT: Record<string, [number, number]> = {
  hearth: [0xffc46e, 0.75], shard: [0xebf2ff, 0.8], crystal: [0xc8a0ff, 0.6], flame: [0xffd278, 0.85], forge: [0xff963c, 0.85],
};
/** Far out the openings stay accents: none below LIT_PX device px a town unit. A lamp's core [x, y, radius, colour,
 * strength] is never under CORE_PX device px across its radius, squashed to CORE_SY. */
const LIT_PX = 0.22, CORE_PX = 2.2, CORE_SY = 0.8;
const LAMPS = (lightM as unknown as { lamps: [number, number, number, string, number][] }).lamps;

/** The canopy's share at `zoom`: whole far off, gone once a person stands CAP_PX[1] px tall. */
const canopy = (zoom: number): number => 1 - smooth(CAP_PX[0], CAP_PX[1], FIGURE * scale(zoom));

/** The baked level nearest (on a log scale) the device px per town unit where the surface first shows whole. */
function levelFor(dpr: number): number {
  const a = dpr * scale(DESCENT[1]);
  let l = 0;
  while (l < M.scales.length - 1 && a >= Math.sqrt(M.scales[l]! * M.scales[l + 1]!)) l++;
  return l;
}

/** The town's props, caps and lit openings layers, their pages loaded. */
export async function loadTown(renderer: Renderer, dpr: number, q: Query, sky: Sky, fog: Fog, life: Atlas): Promise<Layer[]> {
  const l = levelFor(dpr), lv = (cells: readonly Cell[]): Cell => cells[Math.min(l, cells.length - 1)]!;
  // stalks first: a stalk at an item's depth stands behind it
  const things = [
    ...M.trees.map((t, i) => ({ cell: lv(t.stalk), x: TREES[i]![0], y: TREES[i]![1], gray: `stalk.${i}`, lights: [] as readonly Light[], place: undefined })),
    ...M.items.map((e) => {
      const [, , x, y] = JSON.parse(e.sig.split('|', 1)[0]!) as [number, string, number, number], v = e.variants[e.id % e.variants.length]!;
      return { cell: lv(v.cells), x, y, gray: `item.${e.id}`, lights: v.lights, place: e.place };
    }),
  ].sort((a, b) => a.y - b.y);
  const caps = M.trees.map((t) => ({ day: lv(t.cap.day), dark: lv(t.cap.dark), sensed: lv(t.cap.sensed) })), shades = M.trees.map((t) => lv(t.shade));
  // each page the cells lie on, decoded off the main thread and uploaded now
  const ids = [...new Set([...things.map((t) => t.cell), ...shades, ...caps.flatMap((c) => [c.day, c.dark, c.sensed])].map((c) => c[0]))];
  const [pics, gray] = await Promise.all([
    Promise.all(ids.map(async (i) => {
      const file = M.pages[i]!.file, url = URLS[`../../assets/town/${file}`];
      if (!url) throw new Error(`town: ${file} is not in assets/town`);
      return upload(renderer, await decode(url));
    })),
    Atlas.load(renderer, grayM as unknown as AtlasManifest, grayUrl),
  ]);
  const tex = (c: Cell) => new Texture({ source: pics[ids.indexOf(c[0])]!.source, frame: new Rectangle(c[1], c[2], c[3], c[4]) });
  const sprite = (c: Cell, x: number, y: number): Sprite => {
    const s = new Sprite(tex(c));
    s.anchor.set(c[5] / c[3], c[6] / c[4]);
    s.scale.set(1 / M.pages[c[0]]!.scale);
    s.position.set(x, y);
    return s;
  };
  /** a thing's gray twin over it, k = 1 px a town unit, sampled where it stands */
  const twins: Sprite[] = [];
  const twin = (name: string, x: number, y: number): Sprite => {
    const s = gray.sprite(name);
    s.position.set(x, y);
    return twins[twins.push(s) - 1]!;
  };
  const shade = new Container(), props = layerRoot(new Container()), capRoot = layerRoot(new Container());
  shades.forEach((c, i) => shade.addChild(sprite(c, TREES[i]![0], TREES[i]![1]), twin(`shade.${i}`, TREES[i]![0], TREES[i]![1])));
  props.addChild(shade, ...things.flatMap((t) => [sprite(t.cell, t.x, t.y), twin(t.gray, t.x, t.y)]));
  const tones = caps.map((c) => ({ day: tex(c.day), dark: tex(c.dark) }));
  const capSprites = caps.map((c, i) => ({ tone: capRoot.addChild(sprite(c.day, TREES[i]![0], TREES[i]![1])), sensed: capRoot.addChild(sprite(c.sensed, TREES[i]![0], TREES[i]![1])), a: 0, s: 0 }));
  const capW = capSprites.map((c) => c.tone.width);
  // a cap's colour is sampled round its middle: its sides, top and bottom
  const capAt = capSprites.map(({ tone: s }) => {
    const cy = s.y + (0.5 - s.anchor.y) * s.height, r = s.width / 2;
    return [[s.x - 0.85 * r, cy], [s.x + 0.85 * r, cy], [s.x, cy - 0.3 * r], [s.x, cy + 0.3 * r]] as const;
  });
  const lit = layerRoot(new Container()), windows = lit.addChild(new Container()), cores = lit.addChild(new Container());
  lit.blendMode = 'add';
  const lamps = LAMPS.map(([x, y, r, col, k]) => ({ s: cores.addChild(life.glow('glow-0.3', x, y, r, hex(col))), r, k }));
  // a building's openings only (a part or prop has no place: its light is the town light's)
  const glows = things.flatMap((t) => (t.place ? t.lights : []).map(([dx, dy, r, col]) => {
    const [rgb, k] = LIGHT[col]!;
    return { s: windows.addChild(life.glow('glow-0', t.x + dx, t.y + dy, r, rgb)), k, place: t.place!, fog: 0 };
  }));
  let occupied = new Set<PlaceId>();
  const seen = new StateSeen();
  /** the buildings someone is in (here, at its place, not passing on a route; the place under a roof): whether they moved */
  const occupy = (s: Readonly<GameState>): boolean => {
    const now = new Set<PlaceId>();
    for (const p of Object.values(s.people)) if (p.gone === null && 'place' in p.at && PLACES[p.at.place]?.indoor !== false) now.add(p.at.place);
    if (now.size === occupied.size && [...now].every((p) => occupied.has(p))) return false;
    occupied = now;
    for (const g of glows) g.s.visible = g.fog > 0.01 && occupied.has(g.place);
    return true;
  };

  // what each layer last showed (props, caps, lit), the fog's field version each saw, and the version sampled
  const shown: number[][] = [[], [], []], saw = [-1, -1, -1], at = { a: 0, s: 0 };
  let sampled = -1;
  /** whether the fog's field moved since layer `i` last saw it (a hidden layer samples nothing): the fog's colour at each
   * thing, cap, opening and core, sampled again when the field moved */
  const fogMoved = (i: number, on: boolean): boolean => {
    if (!on) return false;
    if (fog.version !== sampled) {
      sampled = fog.version;
      for (const t of twins) fog.sample(1, t.x, t.y, at), (t.alpha = 1 - at.a), (t.visible = at.a < 0.998 && at.s > 0.002);
      capSprites.forEach((c, i) => {
        c.a = c.s = 1;
        for (const [x, y] of capAt[i]!) fog.sample(1, x, y, at), (c.a = Math.min(c.a, at.a)), (c.s = Math.min(c.s, at.s));
      });
      for (const g of glows) fog.sample(1, g.s.x, g.s.y, at), (g.fog = at.a), (g.s.alpha = g.k * at.a), (g.s.visible = at.a > 0.01 && occupied.has(g.place));
      for (const l of lamps) fog.sample(1, l.s.x, l.s.y, at), (l.s.alpha = l.k * at.a), (l.s.visible = at.a > 0.01);
    }
    const moved = sampled !== saw[i];
    saw[i] = sampled;
    return moved;
  };
  const layer = (name: Layer['name'], root: Container, frame: (vm: ViewModel) => boolean): Layer => ({ name, root, frame });
  return [
    layer('props', props, (vm) => {
      const s = q64(1 - below(vm.camera.zoom)), c = q64(canopy(vm.camera.zoom)), f = fogMoved(0, s > 0);
      if (!differs(shown[0]!, s, c) && !f) return false;
      show(props, s);
      show(shade, 1 - c);
      return true;
    }),
    layer('above', capRoot, (vm) => {
      const a = q64((1 - below(vm.camera.zoom)) * canopy(vm.camera.zoom)), dark = q.daylight(q.hour(vm.state.tick)) < DARK_BELOW;
      const wind = q64(sky.look.wind), step = a > 0 && wind > 0 ? Math.floor(vm.time * SWAY_HZ) : -1, wasDark = shown[1]![1], wasStep = shown[1]![2], f = fogMoved(1, a > 0);
      if (!differs(shown[1]!, a, +dark, step) && !f) return false;
      if (+dark !== wasDark) capSprites.forEach((c, i) => (c.tone.texture = tones[i]![dark ? 'dark' : 'day']));
      // colour where the town is Active, the Sensed tone where it is only seen
      for (const c of capSprites) show(c.tone, c.a > 0.02 ? c.a : 0), show(c.sensed, c.s - c.a > 0.02 ? (c.s - c.a) * 0.85 : 0);
      // the wind sways the cap, the stalk stands
      if (step !== wasStep) capSprites.forEach((c, i) => (c.tone.x = c.sensed.x = TREES[i]![0] + wind * capW[i]! * (0.025 * Math.sin((step / SWAY_HZ) * 0.9 + i * 1.7) + 0.01 * Math.sin((step / SWAY_HZ) * 2.3 + i))));
      show(capRoot, a);
      return true;
    }),
    layer('lit', lit, (vm) => {
      const px = scale(vm.camera.zoom) * dpr, night = (1 - below(vm.camera.zoom)) * smooth(0.25, 0.85, 1 - q.daylight(q.hour(vm.state.tick)));
      const k = q64(px > LIT_PX ? night * (0.45 + 0.55 * smooth(0.45, 1.1, px)) : 0), c = q64(night), was = shown[2]![2];
      // the cores' least radius (town units), in steps of a sixteenth of an octave
      const r = c > 0 ? 2 ** (Math.round(16 * Math.log2(CORE_PX / px)) / 16) : (was ?? 0);
      const f = fogMoved(2, c > 0), inNow = k > 0 && seen.moved(vm) && occupy(vm.state);
      if (!differs(shown[2]!, k, c, r) && !f && !inNow) return false;
      if (r !== was) for (const l of lamps) pool(l.s, l.s.x, l.s.y, Math.max(l.r, r), CORE_SY);
      lit.visible = c > 0;
      show(windows, k);
      cores.alpha = c;
      return true;
    }),
  ];
}
