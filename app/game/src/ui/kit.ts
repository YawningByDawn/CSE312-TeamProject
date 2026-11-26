import type { AtlasManifest } from '../types';
import uiManifest from '../../assets/ui/manifest.json';
import uiUrl from '../../assets/ui/ui.webp?url';
import romanUrl from '../../assets/fonts/im-fell-english-latin-400-normal.woff2?url';
import italicUrl from '../../assets/fonts/im-fell-english-latin-400-italic.woff2?url';

// The HUD's parts: baked atlas cells as DOM boxes (a background picture at the cell's rect, nothing painted), nine-slice
// surfaces, and text. Everything is laid out in design px (a 1600x900 screen); the ui scales its corner anchors as one.
// Every setter writes the DOM only when its value changes: at rest the HUD writes nothing.

type Cell = AtlasManifest['cells'][string];
type Slices = [top: number, right: number, bottom: number, left: number];

/** A baked atlas as CSS: its cells, its picture, and the class that carries the picture. */
export interface Sheet { m: AtlasManifest; url: string; cls: string }

const UI: Sheet & { slices: Record<string, Slices> } = {
  m: uiManifest as unknown as AtlasManifest, url: uiUrl, cls: 'hg-ui-atlas', slices: uiManifest.slices as unknown as Record<string, Slices>,
};

/** Ink, pale on slab, the player's violet, a dim note, harm. docs/style.md §7: colour means what it means in the world. */
export const INK = '#1b1712';
export const PALE = '#e9dcc3';
export const VIOLET = '#c9a8ff';
export const DIM = '#a89c86';
export const BLOOD = '#e0574a';

const FONT = '"HG Fell", "Bitstream Charter", Georgia, serif';

/** The one style sheet: the font faces, the atlas classes, the parts. Added once, at mount. */
export function installCss(sheets: readonly Sheet[]): void {
  const css = [
    `@font-face { font-family: "HG Fell"; src: url(${romanUrl}) format("woff2"); font-display: block; }`,
    `@font-face { font-family: "HG Fell"; font-style: italic; src: url(${italicUrl}) format("woff2"); font-display: block; }`,
    `.hg { position: absolute; inset: 0; font-family: ${FONT}; color: ${PALE}; user-select: none; font-variant-numeric: lining-nums; isolation: isolate; }`,
    '.hg-a { position: absolute; width: 0; height: 0; transform-origin: 0 0; }',
    '.hg-p { position: absolute; background-repeat: no-repeat; pointer-events: none; }',
    '.hg-b { position: absolute; }',
    '.hg-hit { pointer-events: auto; cursor: pointer; }',
    `.hg-t { position: absolute; white-space: nowrap; line-height: 1; text-shadow: 0 1px 0 ${INK}; }`,
    '.hg-row { position: absolute; display: flex; align-items: baseline; gap: 6px; white-space: nowrap; }',
    '.hg-row > .hg-t { position: static; }',
    '.hg-n { font-family: "Bitstream Charter", Georgia, serif; font-weight: 600; }',
    `.hg-ink { color: ${INK}; text-shadow: none; }`,
    // the cards: a hand card rests small and rises from its foot on hover, and a touch drags it rather than pans; the
    // deal's cards come in, the kept one flies to the hand and the rest fall away
    '.hg-card { transform: scale(var(--k)); transform-origin: 50% 100%; transition: transform 0.16s ease-out; touch-action: none; }',
    '.hg-card:hover { transform: translateY(-34px) scale(calc(var(--k) * 1.2)); z-index: 2; filter: drop-shadow(0 0 16px rgba(201, 168, 255, 0.5)); }',
    // the discard zone lit under a dragged card
    '.hg-lit { filter: brightness(1.5) drop-shadow(0 0 18px rgba(201, 168, 255, 0.7)); }',
    '.hg-card.hg-rest, .hg-card.hg-rest:hover { filter: brightness(0.7) saturate(0.45); }',
    '.hg-deny { animation: hg-deny 0.3s ease-out; } @keyframes hg-deny { 25% { translate: -5px 0; } 50% { translate: 5px 0; } 75% { translate: -3px 0; } }',
    '.hg-big { transition: transform 0.36s ease-in, opacity 0.3s ease-in; } .hg-big:hover { transform: translateY(-16px) scale(1.04); }',
    '.hg-dealt { animation: hg-dealt 0.56s cubic-bezier(0.2, 0.8, 0.25, 1) both; } @keyframes hg-dealt { from { opacity: 0; transform: translateY(420px) scale(0.4); } }',
    '.hg-big.hg-kept { transform: translate(var(--tx), var(--ty)) scale(0.6); opacity: 0.3; }',
    '.hg-big.hg-drop { transform: translateY(110px); opacity: 0; }',
    '.hg-leaving .hg-fade, .hg-leaving > .hgp-slab { opacity: 0; transition: opacity 0.26s; }',
    `.hg-range { position: absolute; width: 260px; margin: 0; accent-color: ${VIOLET}; pointer-events: auto; }`,
    '.hg-scroll { overflow-y: auto; pointer-events: auto; scrollbar-color: #5a4f66 transparent; }',
    '.hg-tip { pointer-events: none; transform-origin: 0 0; z-index: 10; }',
    `.hg-tipbox { width: max-content; max-width: 380px; font-size: 17px; line-height: 1.25; white-space: normal; text-shadow: 0 1px 0 ${INK}; }`,
    `.hg-tdim { color: ${DIM}; font-size: 15px; margin-top: 4px; }`,
    ...[UI, ...sheets].map((s) => `.${s.cls} { background-image: url(${s.url}); background-size: ${s.m.w / k(s)}px ${s.m.h / k(s)}px; }`),
  ];
  document.head.appendChild(document.createElement('style')).textContent = css.join('\n');
}

/** px of the picture per design px (every interface atlas is baked at 2). */
const k = (s: Sheet): number => Object.values(s.m.cells)[0]![4];

export function cellOf(s: Sheet, name: string): Cell {
  const c = s.m.cells[name];
  if (!c) throw new Error(`no cell ${name} in ${s.m.file}`);
  return c;
}

export function div(parent: HTMLElement, cls: string, x = 0, y = 0, w?: number, h?: number): HTMLDivElement {
  const d = parent.appendChild(document.createElement('div'));
  d.className = cls;
  d.style.left = `${x}px`;
  d.style.top = `${y}px`;
  if (w !== undefined) d.style.width = `${w}px`;
  if (h !== undefined) d.style.height = `${h}px`;
  return d;
}

/** A baked cell with its origin at (x, y). `show` swaps the cell; `on` hides and shows it; each writes only on change. */
export class Pic {
  readonly el: HTMLDivElement;
  private name = '';
  private shown = true;
  private clip = '';

  constructor(parent: HTMLElement, private readonly x: number, private readonly y: number, name: string, private readonly s: Sheet = UI) {
    this.el = div(parent, `hg-p ${s.cls}`);
    this.show(name);
  }

  show(name: string): void {
    if (name === this.name) return;
    const c = cellOf(this.s, name);
    const was = this.name ? cellOf(this.s, this.name) : null;
    this.name = name;
    const st = this.el.style, kk = c[4];
    st.backgroundPosition = `${-c[0] / kk}px ${-c[1] / kk}px`;
    if (was && was[2] === c[2] && was[3] === c[3] && was[5] === c[5] && was[6] === c[6]) return;
    st.left = `${this.x - c[5] / kk}px`;
    st.top = `${this.y - c[6] / kk}px`;
    st.width = `${c[2] / kk}px`;
    st.height = `${c[3] / kk}px`;
  }

  on(v: boolean): void {
    if (v === this.shown) return;
    this.shown = v;
    this.el.hidden = !v;
  }

  /** Show the cell's left `f` (0..1) of `span` design px from its origin: a meter filling. Paints, never lays out. */
  fill(f: number, span: number): void {
    const c = cellOf(this.s, this.name), kk = c[4];
    const cut = Math.max(0, c[2] / kk - c[5] / kk - f * span);
    const clip = `inset(0 ${cut.toFixed(1)}px 0 0)`;
    if (clip === this.clip) return;
    this.clip = clip;
    this.el.style.clipPath = clip;
  }
}

/**
 * A surface (`surf.<recipe>`) stretched over the box (x, y, w, h) as a nine-slice of the baked picture: its corners keep
 * their size, its edges and middle stretch. Children go in `el` over it.
 */
export function surface(parent: HTMLElement, recipe: string, x: number, y: number, w: number, h: number, cls = ''): HTMLDivElement {
  const box = div(parent, `hg-b ${cls}`, x, y, w, h);
  const name = `surf.${recipe}`;
  const c = cellOf(UI, name), kk = c[4];
  const [t, r, b, l] = UI.slices[name]!;
  // the picture around the 160x96 box it was painted for: the same margins around this box
  const cw = c[2] / kk, ch = c[3] / kk, ox = -c[5] / kk, oy = -c[6] / kk;
  const pw = w + cw - 160, ph = h + ch - 96;
  const xs = [0, l, pw - r, pw], ys = [0, t, ph - b, ph];
  const sx = [0, l, cw - r, cw], sy = [0, t, ch - b, ch];
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
    const dw = xs[i + 1]! - xs[i]!, dh = ys[j + 1]! - ys[j]!;
    const fx = dw / (sx[i + 1]! - sx[i]!), fy = dh / (sy[j + 1]! - sy[j]!);
    const d = div(box, `hg-p ${UI.cls}`, ox + xs[i]!, oy + ys[j]!, dw, dh);
    d.style.backgroundSize = `${(UI.m.w / kk) * fx}px ${(UI.m.h / kk) * fy}px`;
    d.style.backgroundPosition = `${-(c[0] / kk + sx[i]!) * fx}px ${-(c[1] / kk + sy[j]!) * fy}px`;
  }
  return box;
}

/** A line of text at (x, y): `align` center or right measures from x across `w`. `set` writes only on change. */
export class Words {
  readonly el: HTMLDivElement;
  private v = '';

  constructor(parent: HTMLElement, x: number, y: number, size: number, color: string, align: 'left' | 'center' | 'right' = 'left', w = 0) {
    this.el = div(parent, 'hg-t', x, y, align === 'left' ? undefined : w);
    const st = this.el.style;
    st.fontSize = `${size}px`;
    st.textAlign = align;
    if (color === INK) this.el.classList.add('hg-ink');
    else st.color = color;
  }

  /** Numbers set in the plain strong serif (docs/style.md §7): Fell's figures read as letters. */
  num(): this {
    this.el.classList.add('hg-n');
    return this;
  }

  set(s: string): void {
    if (s === this.v) return;
    this.v = s;
    this.el.textContent = s;
  }
}

/** A row at (x, y) its words sit in side by side on one baseline (a number and its unit). */
export function row(parent: HTMLElement, x: number, y: number): HTMLDivElement {
  return div(parent, 'hg-row', x, y);
}

/** An attribute written only on change (a title, an aria-label). */
export function attr(el: HTMLElement, name: string, v: string): void {
  if (el.getAttribute(name) !== v) el.setAttribute(name, v);
}
