import type { AtlasManifest, CardId, Crystal, GameState, Person } from '../../types';
import { blessingSlots } from '../../content/blessings';
import { CARDS, cardSlots } from '../../content/cards';
import { uiText } from '../../content/text';
import { cardCost } from '../../sim/cards';
import { BLOOD, DIM, INK, PALE, VIOLET, Words, attr, div, surface } from '../kit';

// The panels' parts over the kit: baked cells of any atlas at any scale (a stone, a portrait, a card, a room), wrapped
// lines, and verb plates. Each atlas picture is one CSS class; a cell is a box showing its rect, a tinted cell is that
// rect as a mask over a flat colour, an additive one blends plus-lighter. Nothing is painted.

type Cells = AtlasManifest['cells'];
interface Sheet { cells: Cells; w: number; h: number; cls: string; url: string }

const manifests = import.meta.glob<AtlasManifest & Record<string, unknown>>('../../../assets/{ui,cardart,cardback,crystals,crystalmarks/*,portraits/*,front,title,defeat}/manifest.json', { eager: true, import: 'default' });
// the defeat's atlas is the view's mipmapped png: the panels take its level 0
const pictures = import.meta.glob<string>(['../../../assets/{ui,cardart,cardback,crystals,crystalmarks/*,portraits/*,front,title}/*.webp', '../../../assets/defeat/defeat.png'], { eager: true, query: '?url', import: 'default' });

const SHEETS = new Map<string, Sheet & { m: AtlasManifest & Record<string, unknown> }>();
for (const [path, m] of Object.entries(manifests)) {
  const dir = path.slice('../../../assets/'.length, -'/manifest.json'.length);
  const cls = `hgp-${dir.replace(/\W/g, '-')}`;
  SHEETS.set(dir, { m, cells: m.cells, w: m.w, h: m.h, cls, url: pictures[`../../../assets/${dir}/${m.file}`]! });
}
const sheet = (dir: string): Sheet & { m: AtlasManifest & Record<string, unknown> } => {
  const s = SHEETS.get(dir);
  if (!s) throw new Error(`no atlas ${dir}`);
  return s;
};

/** The panels' style: each atlas picture's class, the slab that takes the pointer, wrapped lines, the parts' motion. */
export function panelCss(): string {
  return [
    ...[...SHEETS.values()].map((s) => `.${s.cls} { background-image: url(${s.url}); }`),
    '.hgp-m { position: absolute; pointer-events: none; mask-repeat: no-repeat; -webkit-mask-repeat: no-repeat; }',
    '.hgp-add { mix-blend-mode: plus-lighter; }',
    '.hgp-slab { pointer-events: auto; }',
    `.hgp-l { position: absolute; white-space: normal; line-height: 1.22; text-shadow: 0 1px 0 ${INK}; }`,
    '.hgp-off { cursor: default; filter: saturate(0.4); }',
    '.hgp-hov { transition: transform 0.12s; } .hgp-hov:hover { transform: translateY(-10px) scale(1.03); }',
    '.hgp-in { animation: hgp-in 0.9s both; } @keyframes hgp-in { from { opacity: 0; transform: translateY(6px); } }',
    '@keyframes hgp-fade { from { opacity: 0; } }',
    '@keyframes hgp-still { from { opacity: 0; } }',
    '@keyframes hgp-breath { from { transform: scale(0.993) translateY(-1.5px); } to { transform: scale(1.007) translateY(1.5px); } }',
    // the title's ink bleeding in: its mask window slides right while the ink in it holds still
    '@keyframes hgp-wipe { from { transform: translateX(var(--w)); } to { transform: none; } }',
    // a breathing light between two strengths; a mote rising from the eye and going out; its sway
    '.hgp-glow { animation: hgp-glow 4.75s ease-in-out infinite alternate; } @keyframes hgp-glow { from { opacity: var(--a0); } to { opacity: var(--a1); } }',
    '@keyframes hgp-ember { from { transform: none; opacity: 0; } 10% { opacity: var(--a); } to { transform: translate(var(--dx), var(--dy)); opacity: 0; } }',
    '.hgp-sway { animation: hgp-sway 2.4s ease-in-out infinite alternate; } @keyframes hgp-sway { from { translate: -4px 0; } to { translate: 4px 0; } }',
    // the last spark: lit by 3.4 s, held, then guttering smaller and out by 8.6 s; the title's alone in the black
    '@keyframes hgp-spark { from, 14% { opacity: 0; } 40%, 74% { opacity: 1; transform: none; } to { opacity: 0; transform: scale(0.55); } }',
    '.hgp-gutter { animation: hgp-gutter 0.45s steps(3) infinite alternate; } @keyframes hgp-gutter { from { opacity: 1; } to { opacity: 0.62; } }',
    '@keyframes hgp-tspark { from, 4% { opacity: 0; } 40% { opacity: 0.8; } to { opacity: 0; } }',
    '@keyframes hgp-pulse { from { opacity: 0.25; } to { opacity: 0.65; } }',
    '.hgp-seed { position: absolute; pointer-events: auto; background: rgba(10,8,14,0.6); color: inherit; font: inherit; border: 1px solid #5a4f66; padding: 2px 6px; }',
  ].join('\n');
}

/** A cell of `dir`'s atlas with its origin at (x, y), `s` design px per atlas px. */
export function cell(parent: HTMLElement, dir: string, name: string, x: number, y: number, s: number): HTMLDivElement {
  const a = sheet(dir), c = a.cells[name];
  if (!c) throw new Error(`no cell ${name} in ${dir}`);
  const d = div(parent, `hg-p ${a.cls}`, x - c[5] * s, y - c[6] * s, c[2] * s, c[3] * s);
  d.style.backgroundSize = `${a.w * s}px ${a.h * s}px`;
  d.style.backgroundPosition = `${-c[0] * s}px ${-c[1] * s}px`;
  return d;
}

/** A cell's alpha as `el`'s mask, the cell's top left at the box's, `sx` and `sy` design px per atlas px. */
export function mask(el: HTMLElement, dir: string, name: string, sx: number, sy = sx): void {
  const a = sheet(dir), c = a.cells[name]!, st = el.style;
  st.maskImage = st.webkitMaskImage = `url(${a.url})`;
  st.maskSize = st.webkitMaskSize = `${a.w * sx}px ${a.h * sy}px`;
  st.maskPosition = st.webkitMaskPosition = `${-c[0] * sx}px ${-c[1] * sy}px`;
}

/** A white cell as a mask over `rgb`, drawn plainly or added. */
export function tinted(parent: HTMLElement, dir: string, name: string, x: number, y: number, s: number, rgb: readonly number[], add: boolean): void {
  const c = sheet(dir).cells[name]!;
  const d = div(parent, `hgp-m${add ? ' hgp-add' : ''}`, x - c[5] * s, y - c[6] * s, c[2] * s, c[3] * s);
  d.style.backgroundColor = `rgb(${rgb.join(',')})`;
  mask(d, dir, name, s);
}

/** A cell's own scale, design px per atlas px (1 / its k), and its size in design px at that scale. */
export function natural(dir: string, name: string): { s: number; w: number; h: number } {
  const c = sheet(dir).cells[name]!;
  return { s: 1 / c[4], w: c[2] / c[4], h: c[3] / c[4] };
}

/** An atlas's manifest fields beyond its cells (the title's `nameBox`). */
export const atlasMeta = (dir: string): Readonly<Record<string, unknown>> => sheet(dir).m;

const TINTS = sheet('crystals').m.tints as Record<string, number[]>;

/** A stone as the world shows it, its base centred at (x, y), `size` design px a unit of stone: its grade's signs behind
 * and before it, its body, its affinity's light on it, its own inner light. */
export function stone(parent: HTMLElement, c: Readonly<Crystal>, x: number, y: number, size: number): void {
  const s = size / sheet('crystals').cells[`${c.base}.${c.grade}`]![4];
  const tint = TINTS[c.profaned ? 'profaned' : c.affinity]!;
  const body = `${c.base}.${c.grade}`;
  const signs = sheet('crystals').cells;
  if (signs[`sign.${c.grade}.back`]) tinted(parent, 'crystals', `sign.${c.grade}.back`, x, y - size * 0.45, s, tint, true);
  cell(parent, 'crystals', body, x, y, s);
  const marks = `crystalmarks/${c.profaned ? 'profaned' : c.affinity}`;
  if (sheet(marks).cells[`${body}.add`]) cell(parent, marks, `${body}.add`, x, y, s).classList.add('hgp-add');
  if (signs[`${body}.lit`]) tinted(parent, 'crystals', `${body}.lit`, x, y, s, tint, true);
  if (signs[`sign.${c.grade}.front`]) tinted(parent, 'crystals', `sign.${c.grade}.front`, x, y - size * 0.45, s, tint, true);
}

export const TILE_W = 72, TILE_H = 96;

/** A stone's tile at (x, y): the stone standing in it, its word under it; violet when picked, a click picks it. */
export function stoneTile(parent: HTMLElement, x: number, y: number, c: Readonly<Crystal> | undefined, word: string, on: boolean, pick: () => void): HTMLDivElement {
  const t = surface(parent, on ? 'violet' : 'parchDark', x, y, TILE_W, TILE_H, 'hg-hit');
  if (c) {
    stone(t, c, TILE_W / 2, TILE_H - 26, TILE_H - 36);
    attr(t, 'title', c.name);
  }
  const size = Math.min(15, Math.floor((TILE_W - 6) / (LETTER * word.length)));
  new Words(t, 0, TILE_H - 22 + (15 - size) / 2, size, PALE, 'center', TILE_W).set(word);
  t.addEventListener('click', pick);
  return t;
}

const PAGES = [...SHEETS.keys()].filter((d) => d.startsWith('portraits/')).sort();
const PAGE_OF = new Map<string, string>();
const NAMED = new Map<string, string>();
const LOOK = new Map<string, string>();
for (const page of PAGES) {
  const m = sheet(page).m;
  for (const name of Object.keys(m.cells)) PAGE_OF.set(name.split('.')[0]!, page);
  for (const [role, look] of Object.entries((m.trades ?? {}) as Record<string, string>)) LOOK.set(role, look);
  for (const [id, cellName] of Object.entries((m.people ?? {}) as Record<string, string>)) NAMED.set(id, cellName);
}
const variants = (look: string): number => Object.keys(sheet(PAGE_OF.get(look)!).cells).filter((n) => n.startsWith(`${look}.`) && n.split('.').length === 2).length;
const fnv = (str: string): number => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** violet yours, pale one walking against you, gold the Flame's. */
export function wickOf(s: Readonly<GameState>, p: Readonly<Person>): 'violet' | 'pale' | 'gold' {
  if (p.follower) return 'violet';
  return s.threats.some((t) => t.walkers.includes(p.id)) ? 'pale' : 'gold';
}

/** A person's portrait centred at (x, y), its ring `d` design px across: the wick's ground, their face, its light, the ring. */
export function portrait(parent: HTMLElement, s: Readonly<GameState>, p: Readonly<Person>, x: number, y: number, d: number): void {
  const k = d / sheet(PAGES[0]!).cells.ring![2];
  const look = LOOK.get(p.role)!;
  const face = NAMED.get(p.id) ?? `${look}.${fnv(p.id) % variants(look)}`;
  const page = PAGE_OF.get(face.split('.')[0]!)!;
  const wick = wickOf(s, p);
  cell(parent, PAGES[0]!, `back.${wick}`, x, y, k);
  cell(parent, page, face, x, y, k);
  cell(parent, page, `${face}.${wick}`, x, y, k);
  cell(parent, PAGES[0]!, 'ring', x, y, k);
}

export const CARD_W = 165, CARD_H = 246;

/** The name band's width a card's name fits in, and a Fell letter's mean width in em. */
const BAND_W = 132, LETTER = 0.5;

/** A card plate with its top left at (x, y): the plate, its art, its kind's overlay, its crystal cost at this stage (a
 * miracle), its name on the parchment band (a blessing's too) sized to fit it, and its line. */
export function card(parent: HTMLElement, s: Readonly<GameState>, id: CardId, x: number, y: number, blessing = false): HTMLDivElement {
  const box = div(parent, 'hg-b', x, y, CARD_W, CARD_H);
  cell(box, 'ui', 'card.plate', 0, 0, 0.5);
  cell(box, 'cardart', id, 0, 0, 0.5);
  const d = blessing ? null : CARDS[id]!;
  cell(box, 'ui', `card.over.${d?.kind ?? 'miracle'}`, 0, 0, 0.5);
  const cost = d?.kind === 'miracle' ? cardCost(id) : 0;
  if (cost > 0) cell(box, 'ui', `card.cost.${Math.min(8, cost)}`, 0, 0, 0.5);
  const words = blessing ? `blessing.${id}` : `card.${id}`;
  const name = uiText(`${words}.name`);
  const size = Math.min(19, Math.floor(BAND_W / (LETTER * name.length)));
  new Words(box, 0, 152 + (19 - size) / 2, size, INK, 'center', CARD_W).set(name);
  line(box, 14, 180, CARD_W - 28, 15, PALE, uiText(`${words}.line`, blessing ? blessingSlots(id) : cardSlots(id))).style.textAlign = 'center';
  return box;
}

/** Wrapped lines at (x, y), `w` wide. */
export function line(parent: HTMLElement, x: number, y: number, w: number, size: number, color: string, text: string): HTMLDivElement {
  const d = div(parent, 'hgp-l', x, y, w);
  d.style.fontSize = `${size}px`;
  if (color === INK) d.classList.add('hg-ink');
  else d.style.color = color;
  d.textContent = text;
  return d;
}

/** A verb plate: violet and live when `why` is empty, dim with its reason when not (a click on it says the reason). */
export function verb(parent: HTMLElement, x: number, y: number, w: number, h: number, label: string, why: string, act: () => void, say: (why: string) => void, sub = '', tone = VIOLET): HTMLDivElement {
  const b = surface(parent, why ? 'violetDim' : 'violet', x, y, w, h, `hg-hit${why ? ' hgp-off' : ''}`);
  const top = sub ? h / 2 - 20 : h / 2 - 11;
  new Words(b, 0, top, 21, why ? DIM : PALE, 'center', w).set(label);
  if (sub) new Words(b, 0, top + 25, 15, why ? BLOOD : tone, 'center', w).set(why || sub);
  if (why) attr(b, 'title', why);
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    if (why) say(why);
    else act();
  });
  return b;
}

/** A slab panel at (x, y) of the centre anchor: the dark slab, its parchment name tab, and a status line for refusals. */
export function slab(parent: HTMLElement, x: number, y: number, w: number, h: number, title: string): { el: HTMLDivElement; say: (why: string) => void; fit: (h: number) => void } {
  const { el, fit } = backed(parent, x, y, w, h);
  const tw = Math.min(w - 40, 60 + title.length * 14);
  surface(el, 'parch', 20, 14, tw, 46);
  new Words(el, 20, 24, 28, INK, 'center', tw).set(title);
  // a refusal right of the name tab, clear of a Close plate in the top right corner
  const status = new Words(el, tw + 40, 30, 18, BLOOD, 'right', Math.max(0, w - tw - 180));
  return { el, say: (why) => status.set(why), fit };
}

/** A box that takes the pointer over a slab surface; `fit` lays the surface again for a height known once filled. */
export function backed(parent: HTMLElement, x: number, y: number, w: number, h: number): { el: HTMLDivElement; fit: (h: number) => void } {
  const el = div(parent, 'hg-b hgp-slab', x, y, w, h);
  let back = surface(el, 'slab', 0, 0, w, h);
  return {
    el,
    fit(nh) {
      const b = surface(el, 'slab', 0, 0, w, nh);
      el.replaceChild(b, back);
      back = b;
      el.style.height = `${nh}px`;
    },
  };
}

export { BLOOD, DIM, INK, PALE, VIOLET, Words, attr, div, surface };
