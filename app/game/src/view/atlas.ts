import { Rectangle, Sprite, Texture, type Renderer } from 'pixi.js';
import type { AtlasManifest } from '../types';
import { compressed, decode, upload } from './pictures';

// A baked atlas (AtlasManifest): one uploaded picture, a texture per cell sharing it. Its level 0 is loaded with GPU
// mipmaps, which halve it as the manifest's levels do; the zoom picks the mip, so one scheme covers every distance. A
// compressed atlas (its level files, .bc3) brings its own mips.

export class Atlas {
  private readonly tex = new Map<string, Texture>();

  private constructor(readonly m: AtlasManifest, private readonly whole: Texture) {}

  static async load(renderer: Renderer, m: AtlasManifest, url: string | readonly string[]): Promise<Atlas> {
    return new Atlas(m, typeof url === 'string' ? upload(renderer, await decode(url)) : await compressed(renderer, url));
  }

  /** A sprite showing `name`, its origin on the cell's own. */
  sprite(name: string): Sprite {
    const s = new Sprite(this.texture(name)), c = this.cell(name);
    s.anchor.set(c[5] / c[2], c[6] / c[3]);
    return s;
  }

  /** A glow cell as a pool of radius `r` at (x, y), tinted, squashed to `sy`. */
  glow(name: string, x: number, y: number, r: number, tint: number, sy = 1): Sprite {
    const s = this.sprite(name);
    s.tint = tint;
    return pool(s, x, y, r, sy);
  }

  texture(name: string): Texture {
    let t = this.tex.get(name);
    if (!t) {
      const c = this.cell(name);
      this.tex.set(name, (t = new Texture({ source: this.whole.source, frame: new Rectangle(c[0], c[1], c[2], c[3]) })));
    }
    return t;
  }

  /** [x, y, w, h, k px per world unit, ax, ay] */
  cell(name: string): AtlasManifest['cells'][string] {
    const c = this.m.cells[name];
    if (!c) throw new Error(`no cell ${name} in ${this.m.file}`);
    return c;
  }
}

/** A glow sprite as a pool of radius `r` at (x, y), squashed to `sy`. */
export function pool(s: Sprite, x: number, y: number, r: number, sy = 1): Sprite {
  const k = (2 * r) / s.texture.frame.width;
  s.position.set(x, y);
  s.scale.set(k, k * sy);
  return s;
}
