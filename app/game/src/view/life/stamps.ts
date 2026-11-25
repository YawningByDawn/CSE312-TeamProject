import { Container, Geometry, Mesh, RenderTexture, Rectangle, Shader, Texture, type Renderer, type Sprite } from 'pixi.js';
import { BOX, R_MAX } from './rig';

// Small figures as one sprite each: a figure under the small size is composited from its baked parts (cells of the
// looks' low-detail pictures, a few pages of them) into its slot of one shared page, once per baked step it shows, and
// placed as a single sprite of that slot. The page is a render texture; every slot a frame asked for is wiped and its
// parts drawn in one render pass of quad lists (the wipes, then one list per picture page with parts in it), written
// straight into their vertex buffers. A slot is a figure's while it is shown small.

/** A slot in page px (the box at the finest stamp px, a px of clear border round it). */
const W = Math.ceil((BOX.x1 - BOX.x0) * R_MAX) + 2, H = Math.ceil((BOX.y1 - BOX.y0) * R_MAX) + 2;
/** Slots across and down: more than everyone the mine and the town hold, all on screen and small at once. */
const ACROSS = 38, DOWN = 21;
const FEET_X = 1 - BOX.x0 * R_MAX, FEET_Y = 1 - BOX.y0 * R_MAX;
/** Parts a page's list holds at first (it grows: a frame's figures are always one pass). */
const PARTS = 4096;

const VERT = /* glsl */ `#version 300 es
in vec2 aPosition;
in vec2 aUV;
in float aAlpha;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
out vec2 vUV;
out float vAlpha;
void main() {
  vUV = aUV;
  vAlpha = aAlpha;
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
}`;
const INK = /* glsl */ `#version 300 es
precision mediump float;
uniform sampler2D uCells;
in vec2 vUV;
in float vAlpha;
out vec4 finalColor;
void main() { finalColor = texture(uCells, vUV) * vAlpha; }`;
const WIPE = /* glsl */ `#version 300 es
precision mediump float;
in vec2 vUV;
in float vAlpha;
out vec4 finalColor;
void main() { finalColor = vec4(1.0); }`;

/** Two triangles a quad over its four corners, for `n` quads. */
function corners(n: number): Uint32Array {
  const index = new Uint32Array(n * 6);
  for (let q = 0; q < n; q++) index.set([q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3], q * 6);
  return index;
}

/** A list of textured quads with an alpha each, drawn as one mesh; it grows to hold all a pass asks of it. */
class Quads {
  private pos: Float32Array;
  private uv: Float32Array;
  private alpha: Float32Array;
  n = 0;
  readonly geometry: Geometry;
  readonly mesh: Mesh<Geometry, Shader>;

  constructor(name: string, frag: string, resources: Record<string, unknown>, private cap: number) {
    this.pos = new Float32Array(cap * 8);
    this.uv = new Float32Array(cap * 8);
    this.alpha = new Float32Array(cap * 4);
    this.geometry = new Geometry({ attributes: { aPosition: this.pos, aUV: this.uv, aAlpha: { buffer: this.alpha, format: 'float32' } }, indexBuffer: corners(cap) });
    this.mesh = new Mesh({ geometry: this.geometry, shader: Shader.from({ gl: { vertex: VERT, fragment: frag, name }, resources: resources as never }) });
  }

  /** Room for twice as many quads, the ones added kept. */
  private grow(): void {
    const cap = (this.cap *= 2), g = this.geometry;
    const more = (a: Float32Array, k: number): Float32Array => { const b = new Float32Array(cap * k); b.set(a); return b; };
    g.getBuffer('aPosition').data = this.pos = more(this.pos, 8);
    g.getBuffer('aUV').data = this.uv = more(this.uv, 8);
    g.getBuffer('aAlpha').data = this.alpha = more(this.alpha, 4);
    g.indexBuffer.data = corners(cap);
  }

  /** The next quad: corners (x0,y0) (x1,y1) (x2,y2) (x3,y3), its picture's rect in uv, its alpha. */
  add(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, u0: number, v0: number, u1: number, v1: number, a: number): void {
    if (this.n === this.cap) this.grow();
    const q = this.n++, p = this.pos, t = this.uv, o = q * 8;
    p[o] = x0; p[o + 1] = y0; p[o + 2] = x1; p[o + 3] = y1; p[o + 4] = x2; p[o + 5] = y2; p[o + 6] = x3; p[o + 7] = y3;
    t[o] = u0; t[o + 1] = v0; t[o + 2] = u1; t[o + 3] = v0; t[o + 4] = u1; t[o + 5] = v1; t[o + 6] = u0; t[o + 7] = v1;
    this.alpha.fill(a, q * 4, q * 4 + 4);
  }

  /** The quads added since the last pass, sent; the list emptied for the next. */
  send(): void {
    const g = this.geometry, n = this.n;
    g.indexCount = n * 6;
    g.getBuffer('aPosition').update(n * 32);
    g.getBuffer('aUV').update(n * 32);
    g.getBuffer('aAlpha').update(n * 16);
    this.mesh.visible = n > 0;
    this.n = 0;
  }
}

/** The parts cut from one page of the looks' low-detail pictures, and the page's px in uv. */
interface Page { quads: Quads; iw: number; ih: number }

export class Stamps {
  private readonly rt = RenderTexture.create({ width: ACROSS * W, height: DOWN * H, resolution: 1, scaleMode: 'linear' });
  private readonly tex: Texture[] = [];
  private readonly free: number[] = [];
  private used = 0;
  private readonly stage = new Container();
  /** a slot is wiped at most once a pass: room for them all */
  private readonly wipes = new Quads('hg-stamp-wipe', WIPE, {}, ACROSS * DOWN);
  private readonly pages: Page[] = [];

  constructor(private readonly renderer: Renderer) {
    this.wipes.mesh.blendMode = 'erase';
    this.stage.addChild(this.wipes.mesh);
  }

  /** Page `i` of the looks' low-detail pictures, as it arrives: the parts of the looks on it are cut from `cells`. */
  page(i: number, cells: Texture): void {
    const quads = new Quads('hg-stamp-ink', INK, { uCells: cells.source }, PARTS);
    this.pages[i] = { quads, iw: 1 / cells.source.width, ih: 1 / cells.source.height };
    this.stage.addChild(quads.mesh);
  }

  /** A slot of the page. */
  take(): number {
    const i = this.free.pop() ?? this.used++;
    if (i >= ACROSS * DOWN) throw new Error(`stamps: all ${ACROSS * DOWN} slots taken`);
    return i;
  }

  give(i: number): void {
    this.free.push(i);
  }

  /** Slot `i` as sprite `sp`, the feet at its origin, stamped at `px` page px per rig unit, shown at `sx`, `sy` world units per rig unit. */
  place(sp: Sprite, i: number, px: number, sx: number, sy: number): void {
    let t = this.tex[i];
    if (!t) t = this.tex[i] = new Texture({ source: this.rt.source, frame: new Rectangle((i % ACROSS) * W, Math.floor(i / ACROSS) * H, W, H) });
    sp.texture = t;
    sp.anchor.set(FEET_X / W, FEET_Y / H);
    sp.scale.set(sx / px, sy / px);
  }

  /** Slot `i` wiped, to be inked again this frame. */
  wipe(i: number): void {
    const x = (i % ACROSS) * W, y = Math.floor(i / ACROSS) * H;
    this.wipes.add(x, y, x + W, y, x + W, y + H, x, y + H, 0, 0, 1, 1, 1);
  }

  /**
   * One part into slot `i` at `px` slot px per rig unit: its cell, the rect (cx, cy, w, h) of picture page `page`, put
   * by the matrix (a..f) from the cell's px into rig units, at `alpha`.
   */
  ink(i: number, page: number, px: number, cx: number, cy: number, w: number, h: number, a: number, b: number, c: number, d: number, e: number, f: number, alpha: number): void {
    const ox = (i % ACROSS) * W + FEET_X + e * px, oy = Math.floor(i / ACROSS) * H + FEET_Y + f * px;
    const ax = a * px * w, ay = b * px * w, cx2 = c * px * h, cy2 = d * px * h, P = this.pages[page]!;
    P.quads.add(ox, oy, ox + ax, oy + ay, ox + ax + cx2, oy + ay + cy2, ox + cx2, oy + cy2,
      cx * P.iw, cy * P.ih, (cx + w) * P.iw, (cy + h) * P.ih, alpha);
  }

  /** Every slot asked for this frame, drawn in one pass: the wipes, then each page's parts. */
  flush(): void {
    if (this.wipes.n === 0) return;
    this.wipes.send();
    for (const p of this.pages) p?.quads.send();
    this.renderer.render({ container: this.stage, target: this.rt, clear: false });
  }
}
