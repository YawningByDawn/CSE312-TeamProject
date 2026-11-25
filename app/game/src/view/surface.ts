import { Sprite, type Container, type Renderer, type Texture } from 'pixi.js';
import type { AtlasManifest } from '../types';
import { DESCENT, scale } from './camera';
import { compressed } from './pictures';

// The surface's ground (#63): assets/townground's tiles, baked lit by the town's day light, and the town's tiled pictures
// like it (assets/gray's), each tile exactly its rect in BC1 (gen/bake/dds.cjs: an eighth of RGBA on the GPU). Every tile
// is loaded once from the baked level nearest the screen's density where the surface first shows whole, with its baked
// mips down; nothing is fetched or uploaded after load, so no pan or zoom uploads a texture.

type Cell = AtlasManifest['cells'][string];
export interface TileManifest { rect: [number, number, number, number]; levels: number; cells: Record<string, Cell> }
const MANIFESTS = import.meta.glob('../../assets/townground/*/manifest.json', { eager: true, import: 'default' }) as Record<string, TileManifest>;
const URLS = import.meta.glob('../../assets/townground/*/ground*.bc1', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

/**
 * Each tile of a tiled town picture (manifests and pictures by path, `name` its cell and file) from the level nearest
 * `dpr` device px per CSS px where the surface first shows whole: that level's file and those after it, one mip chain.
 */
export async function townTiles(
  renderer: Renderer, dpr: number, manifests: Record<string, TileManifest>, urls: Record<string, string>, name: string,
): Promise<{ tex: Texture; rect: TileManifest['rect'] }[]> {
  const dirs = Object.keys(manifests).map((p) => p.slice(0, p.lastIndexOf('/'))).sort();
  return Promise.all(dirs.map(async (d) => {
    const m = manifests[`${d}/manifest.json`]!, k = m.cells[name]![4];
    const level = Math.min(m.levels - 1, Math.max(0, Math.round(Math.log2(k / (dpr * scale(DESCENT[1]))))));
    const files = Array.from({ length: m.levels - level }, (_, i) => urls[`${d}/${name}${level + i ? `@${level + i}` : ''}.bc1`]);
    if (!files.every(Boolean)) throw new Error(`${d} lacks a ${name} level from ${level}`);
    return { tex: await compressed(renderer, files as string[]), rect: m.rect };
  }));
}

/** Every ground tile into `root`. */
export async function loadSurface(root: Container, renderer: Renderer, dpr: number): Promise<void> {
  for (const { tex, rect } of await townTiles(renderer, dpr, MANIFESTS, URLS, 'ground')) {
    const s = new Sprite(tex);
    s.position.set(rect[0], rect[1]);
    s.scale.set(rect[2] / tex.width);
    root.addChild(s);
  }
}
