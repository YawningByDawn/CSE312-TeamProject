import type { Action, CardId, Check, Crystal, CrystalId, GameState, Mod, ViewModel } from '../../types';
import { CARDS } from '../../content/cards';
import { MODS } from '../../content/gems';
import { uiText } from '../../content/text';
import { bound } from '../../content/keys';
import { BLOOD, DIM, PALE, TILE_H, TILE_W, VIOLET, Words, itemText, line, slab, stone, stoneTile, surface, verb } from './art';
import type { Ctx, Panel } from './index';

// The grave (inventory #116, 118): its sockets, the stones carried, the things made; the picked stone's card with what it
// is and what can be done with it (take out, set, eat, enchant, recombine with a second); a thing's card and taking it
// back. Paying a miracle (#117): where it falls when it is aimed, then the stones to burn.

/** A modifier as one plain line: its name and what it adds, or a curse's price. */
export function modLine(m: Mod): string {
  const d = MODS[m.id]!;
  const what = d.family ? uiText(`line.${d.family}`, { n: m.value }) : '';
  const price = m.curse ? uiText(`mod.${m.id}.price`) : '';
  return [uiText(`mod.${m.id}.name`), what, price].filter(Boolean).join(' · ');
}

/** The first reason a check refuses, in words ('' when it is allowed). */
export const why1 = (c: Check): string => (c.why[0] ? uiText(c.why[0].key, c.why[0].slots) : '');
const pouchOf = (s: Readonly<GameState>): Crystal[] => Object.values(s.crystals).filter((c) => 'pouch' in c.at);

/** A stone's card at (x, y), `w` wide: its shape, name, kind, odds, base, lines and odd effect. Returns its height. */
export function crystalCard(parent: HTMLElement, c: Readonly<Crystal>, x: number, y: number, w: number): number {
  const art = surface(parent, 'parchDark', x, y, w, 200);
  stone(art, c, w / 2, 186, 150);
  new Words(parent, x, y + 212, 28, PALE).set(c.name);
  const kind = uiText('grave.stoneOf', { grade: uiText(`grade.${c.grade}`), affinity: uiText(`affinity.${c.affinity}.name`) });
  new Words(parent, x, y + 248, 18, VIOLET).set('socket' in c.at ? uiText('grave.setIn', { kind }) : kind);
  new Words(parent, x, y + 272, 16, DIM).set(uiText('grave.oneIn', { n: c.oneIn }));
  let ly = y + 298;
  const add = (t: string, color: string): void => {
    line(parent, x, ly, w, 17, color, t);
    ly += Math.ceil(t.length / 44) * 21;
  };
  add(uiText(`base.${c.base}.line`), PALE);
  for (const m of c.mods) add(modLine(m), m.curse ? BLOOD : PALE);
  if (c.odd) add(`${uiText(`odd.${c.odd}.name`)}: ${uiText(`odd.${c.odd}.line`)}`, VIOLET);
  return ly - y;
}

const STEP = TILE_W + 10, COLS = 5;

export class Grave implements Panel {
  private sel: string | null = null;
  /** Recombining: the first stone, waiting for its second. */
  private first: CrystalId | null = null;
  constructor(private readonly c: Ctx) {}

  key(vm: ViewModel): string | null {
    const f = vm.focus;
    const on = !vm.title && !vm.film && vm.state.phase === 'live' && f !== null && (('place' in f && f.place === 'grave') || 'crystal' in f);
    if (!on) this.first = null;
    else if ('crystal' in f! && this.sel !== f.crystal && !this.first) this.sel = f.crystal;
    return on ? `grave|${this.c.rev}|${this.sel}|${this.first}` : null;
  }

  private pick(id: string): void {
    this.sel = id;
    this.c.redraw();
  }

  build(root: HTMLElement, vm: ViewModel): void {
    const s = vm.state, g = s.god;
    const pouch = pouchOf(s);
    const items = Object.values(s.items);
    if (this.sel && !s.crystals[this.sel] && !s.items[this.sel]) this.sel = null;
    this.sel ??= g.sockets.find((x) => x !== null) ?? pouch[0]?.id ?? items[0]?.id ?? null;
    const hx = 24 + COLS * STEP - 10 + 40, hw = 384;
    const { el, say, fit } = slab(root, -776, -330, hx + hw + 24, 640, uiText('grave.title'));
    verb(el, hx + hw - 106, 16, 106, 44, uiText('btn.close'), '', () => this.c.focus(null), say);

    let y = 74;
    const row = (label: string, n: number, each: (i: number, x: number, y: number) => void): void => {
      new Words(el, 24, y, 20, DIM).set(label);
      y += 30;
      for (let i = 0; i < n; i++) each(i, 24 + (i % COLS) * STEP, y + Math.floor(i / COLS) * (TILE_H + 8));
      y += Math.ceil(Math.max(1, n) / COLS) * (TILE_H + 8) + 6;
    };
    row(uiText('grave.sockets'), g.sockets.length, (i, x, ty) => {
      const id = g.sockets[i];
      const c = id ? s.crystals[id] : undefined;
      stoneTile(el, x, ty, c, c ? uiText(`grade.${c.grade}`) : uiText('grave.empty'), !!id && id === this.sel, () => id && this.pick(id));
    });
    row(uiText(this.first ? 'grave.pickSecond' : 'grave.carried'), pouch.length, (i, x, ty) => {
      const c = pouch[i]!;
      stoneTile(el, x, ty, c, uiText(`grade.${c.grade}`), c.id === this.sel, () => this.pick(c.id));
    });
    if (pouch.length === 0) new Words(el, 24, y - TILE_H - 8, 17, DIM).set(uiText('grave.nothingCarried'));
    if (items.length > 0) {
      row(uiText('grave.things'), items.length, (i, x, ty) => {
        const it = items[i]!;
        stoneTile(el, x, ty, s.crystals[it.crystal], uiText(it.wearer ? 'grave.worn' : 'grave.kept'), it.id === this.sel, () => this.pick(it.id));
      });
    }
    fit(Math.max(y, this.side(el, s, hx, hw, pouch, say)) + 18);
  }

  /** The picked stone's or thing's side: its card and its verbs. Returns its bottom. */
  private side(el: HTMLElement, s: Readonly<GameState>, hx: number, hw: number, pouch: Crystal[], say: (why: string) => void): number {
    const g = s.god, q = this.c.q, sel = this.sel;
    if (!sel) {
      line(el, hx, 80, hw, 19, DIM, uiText('grave.bare'));
      return 120;
    }
    const it = s.items[sel];
    if (it) {
      new Words(el, hx, 80, 28, PALE).set(itemText(s, it, 'name'));
      line(el, hx, 120, hw, 17, PALE, itemText(s, it, 'line'));
      line(el, hx, 170, hw, 17, it.wearer ? VIOLET : DIM, it.wearer ? uiText('grave.wornBy', { name: s.people[it.wearer]!.name }) : uiText('grave.openPerson'));
      if (!it.wearer) return 210;
      const a: Action = { type: 'takeBack', item: it.id };
      verb(el, hx, 230, 220, 60, uiText('btn.takeItBack'), why1(q.check(s, a)), () => this.c.act(a), say);
      return 290;
    }
    const c = s.crystals[sel]!;
    if (this.first && sel !== this.first) {
      const a: Action = { type: 'recombine', a: this.first, b: sel };
      const ch = q.check(s, a);
      new Words(el, hx, 80, 26, PALE).set(uiText('btn.recombine'));
      line(el, hx, 118, hw, 19, PALE, uiText('grave.becomeOne', { a: s.crystals[this.first]!.name, b: c.name }));
      line(el, hx, 176, hw, 17, DIM, uiText('grave.bothGone'));
      verb(el, hx, 230, 240, 64, uiText('btn.recombine'), why1(ch), () => { this.first = null; this.c.act(a); }, say, uiText('grave.nether', { n: ch.nether }));
      verb(el, hx + 254, 230, 120, 64, uiText('btn.back'), '', () => { this.first = null; this.c.redraw(); }, say);
      return 294;
    }
    const vy = 74 + crystalCard(el, c, hx, 74, hw) + 10;
    const set = 'socket' in c.at;
    const empty = g.sockets.indexOf(null);
    const enchant: Action = { type: 'enchant', crystal: c.id };
    const verbs: [string, Action | null, string, string][] = [
      set
        ? [uiText('btn.takeOut'), { type: 'unset', crystal: c.id }, '', '']
        : [uiText('btn.setInGrave'), { type: 'set', crystal: c.id, socket: empty }, empty < 0 ? uiText('grave.full') : '', ''],
      [uiText('btn.eatIt'), { type: 'eat', crystal: c.id }, '', uiText('grave.verbHunger', { n: q.worth(s, c.id).hunger })],
      [uiText('btn.enchant'), enchant, '', uiText('grave.nether', { n: q.check(s, enchant).nether })],
      [uiText('btn.recombine'), null, set ? uiText('grave.takeOutFirst') : pouch.length < 2 ? uiText('grave.needsTwo') : '', ''],
    ];
    verbs.forEach(([label, a, refuse, sub], i) => {
      const why = refuse || (a ? why1(q.check(s, a)) : '');
      verb(el, hx + (i % 2) * 196, vy + Math.floor(i / 2) * 70, 188, 62, label, why, () => {
        if (a) this.c.act(a);
        else {
          this.first = c.id;
          this.c.redraw();
        }
      }, say, sub);
    });
    return vy + 132;
  }

  press(e: KeyboardEvent, vm: ViewModel): boolean {
    if (!bound(vm.settings, 'back', e)) return false;
    if (this.first) {
      this.first = null;
      this.c.redraw();
    } else this.c.focus(null);
    return true;
  }
}

const GRADE_STEP: Record<Crystal['grade'], number> = { dull: 0, clear: 1, bright: 2, blazing: 3, royal: 4, impossible: 5 };

/**
 * Playing a card from the hand: an aimed card first takes the next person or place picked in the world that it may fall
 * on; a miracle with a crystal cost then takes the stones to burn (the lowest grades that pay, picked to start with).
 */
export class Pay implements Panel {
  private card: CardId | null = null;
  private target: string | undefined;
  private pay: CrystalId[] = [];
  /** The focus when it opened, as a key: a pick is a focus other than it. */
  private from: string | null = null;
  private refused = '';
  /** The starting stones were picked: from here the player's own picks stand. */
  private chosen = false;
  constructor(private readonly c: Ctx) {}

  /** rb-hud's hand plays `card` through here. */
  open(card: CardId): void {
    this.card = card;
    this.chosen = false;
    this.target = undefined;
    this.pay = [];
    this.from = null;
    this.refused = '';
    this.c.redraw();
  }

  private close(): void {
    this.card = null;
    this.c.redraw();
  }

  private play(): void {
    this.c.act({ type: 'play', card: this.card!, pay: this.pay, ...(this.target ? { target: this.target } : {}) });
    this.card = null;
  }

  key(vm: ViewModel): string | null {
    const s = vm.state, card = this.card;
    if (!card || !s.god.hand.includes(card) || vm.title || s.phase !== 'live') return (this.card = null);
    const d = CARDS[card]!;
    if (d.target !== 'none' && this.target === undefined) {
      const f = JSON.stringify(vm.focus);
      this.from ??= f;
      const at = vm.focus;
      if (f !== this.from && at && ('unit' in at || 'place' in at)) {
        this.from = f;
        const target = 'unit' in at ? at.unit : at.place;
        const ch = this.c.q.check(s, { type: 'play', card, pay: [], target });
        if (ch.why[0]?.key === 'why.target') this.refused = why1(ch);
        else this.target = target;
      }
      if (this.target === undefined) return `aim|${card}|${this.refused}`;
    }
    if (d.kind === 'evil' || !d.cost) {
      this.play();
      return null;
    }
    return `pay|${card}|${this.c.rev}|${this.pay.join()}`;
  }

  build(root: HTMLElement, vm: ViewModel): void {
    const s = vm.state, card = this.card!, q = this.c.q;
    const name = uiText(`card.${card}.name`);
    if (this.target === undefined && CARDS[card]!.target !== 'none') {
      const { el } = slab(root, -260, 250, 520, 150, name);
      line(el, 24, 72, 472, 19, VIOLET, uiText(CARDS[card]!.target === 'area' ? 'pay.aimPlace' : 'pay.aimPerson'));
      if (this.refused) new Words(el, 24, 110, 17, BLOOD).set(this.refused);
      return;
    }
    const check = (pay: CrystalId[]): Check => q.check(s, { type: 'play', card, pay, ...(this.target ? { target: this.target } : {}) });
    const pouch = pouchOf(s).sort((a, b) => GRADE_STEP[a.grade] - GRADE_STEP[b.grade]);
    if (!this.chosen) for (const c of pouch) {
      if (check(this.pay).ok) break;
      this.pay.push(c.id);
    }
    this.chosen = true;
    const ch = check(this.pay);
    const n = Math.min(12, pouch.length), cols = Math.min(6, Math.max(3, n)), rows = Math.max(1, Math.ceil(n / cols));
    // wide enough for the sum against the price left of Pay and Back
    const w = Math.max(40 + cols * (TILE_W + 10), 560), h = 150 + rows * (TILE_H + 12);
    const { el, say } = slab(root, -w / 2, 200 - h, w, h, name);
    // each stone's offered worth to this miracle (its own nature counts half again), and the sum picked against the price
    const worth = (id: CrystalId): number => q.worth(s, id, card).burn;
    const have = Math.round(this.pay.reduce((a, id) => a + worth(id), 0) * 10) / 10;
    new Words(el, 20, 76, 24, ch.ok ? VIOLET : PALE).set(uiText('pay.progress', { have, need: ch.crystals }));
    pouch.slice(0, 12).forEach((c, i) => {
      const on = this.pay.includes(c.id);
      stoneTile(el, 20 + (i % cols) * (TILE_W + 10), 124 + Math.floor(i / cols) * (TILE_H + 12), c, uiText('pay.tile', { grade: uiText(`grade.${c.grade}`), n: worth(c.id) }), on, () => {
        this.pay = on ? this.pay.filter((x) => x !== c.id) : [...this.pay, c.id];
        this.c.redraw();
      });
    });
    verb(el, w - 250, 66, 110, 48, uiText('btn.pay'), why1(ch), () => this.play(), say);
    verb(el, w - 130, 66, 110, 48, uiText('btn.back'), '', () => this.close(), say);
  }

  press(e: KeyboardEvent, vm: ViewModel): boolean {
    if (bound(vm.settings, 'back', e)) this.close();
    else if (bound(vm.settings, 'confirm', e) && this.card && (this.target !== undefined || CARDS[this.card]!.target === 'none')) {
      if (this.c.q.check(vm.state, { type: 'play', card: this.card, pay: this.pay, ...(this.target ? { target: this.target } : {}) }).ok) this.play();
    } else return false;
    return true;
  }
}
