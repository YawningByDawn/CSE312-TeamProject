import type { CardId, GameState, Intent, ViewModel } from '../../types';
import { CARDS, cardSlots } from '../../content/cards';
import { uiText } from '../../content/text';
import { cardFee, evilBonus } from '../../sim/cards';
import { handMax } from '../../sim/core';
import { CARD_H, CARD_W, card, cell, verb } from '../panels/art';
import { DIM, INK, PALE, Pic, Words, attr, div, surface } from '../kit';
import { CLOCK_H, CLOCK_W } from './clock';
import { POUCH_H, POUCH_W } from './pouch';

// The cards (inventory #113, DECISIONS §43). The hand, bottom centre: up to five plates resting small, a card rising on
// hover; after the first card of a night each carries the Nether fee, and a card you cannot pay for rests dim. A card
// dragged follows the pointer and the discard zone shows on the right: dropped on the field it plays through the pay
// slab (rb-panels), as 1..9 does; dropped back on the hand it returns; dropped on the zone it is discarded. The deal,
// dealt at dusk once the panels close: its cards large over the dimmed world; take one (1..3) into the hand, or none
// (Esc, 0), or redraw them.
// Each rebuilds only when its key changes; at rest neither writes.

const REST = 0.92;
const BIG = 1.5;
const GAP = 10;
/** The band the hand may use is the screen's width between the pouch and the clock, each kept this far from it. */
const CLEAR = 12;
/** A press that moves less than this (screen px) is no drag. */
const CLICK_PX = 5;
/** The discard zone at the screen's right edge, its foot clear of the bottom-right panel. */
const TRASH_W = 190, TRASH_H = 340, TRASH_Y = -Math.max(CLOCK_H, POUCH_H) - 3 * CLEAR - TRASH_H;
/** The ui atlas names the powers by their old tracks. */
const TRACK = { temple: 'cult', council: 'gov', public: 'public' } as const;

/** A card's plate, with the flame of the power an act of evil alarms and Malice's multiplier on it. */
function plate(parent: HTMLElement, s: Readonly<GameState>, id: CardId, x: number, y: number): HTMLDivElement {
  const box = card(parent, s, id, x, y);
  const d = CARDS[id]!;
  if (d.kind === 'evil' && d.heat?.length) cell(box, 'ui', `card.alarm.${TRACK[d.heat[0]!.faction]}`, 0, 0, 0.5);
  const m = d.bonus ? evilBonus(s.god.malice) : 1;
  if (m > 1) {
    const tag = surface(box, 'inktab', CARD_W - 62, 104, 54, 30, 'hg-hit');
    new Words(tag, 0, 6, 18, PALE, 'center', 54).num().set(uiText('hand.bonus', { n: m }));
    attr(tag, 'title', uiText('hand.bonusTip', { n: m }));
  }
  return box;
}

/** A card's tip: its name and line, then its details. */
const tipOf = (id: CardId): string => ['name', 'line', 'details'].map((k) => uiText(`card.${id}.${k}`, cardSlots(id))).join('\n');

const inside = (r: DOMRect, e: PointerEvent): boolean => e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;

/** A refused click shakes the thing clicked. */
function deny(el: HTMLElement): void {
  el.classList.remove('hg-deny');
  void el.offsetWidth;
  el.classList.add('hg-deny');
}

export class Hand {
  readonly el: HTMLDivElement;
  private key = '';
  private ids: CardId[] = [];
  private live = false;
  private nether = -1;
  private malice = -1;
  private phase = '';

  private band = 0;
  /** The card pressed: where the press began and, once it has moved into a drag, the hand's place on screen. */
  private drag: { id: CardId; slot: HTMLElement; x: number; y: number; home: DOMRect | null } | null = null;
  private readonly trash: HTMLDivElement;

  /** `half`: design px from the screen's centre to the margin at its side; `k`: screen px per design px. */
  constructor(anchor: HTMLElement, private readonly send: (i: Intent) => void, private readonly pay: (card: CardId) => void, private readonly half: () => number, private readonly k: () => number) {
    this.el = div(anchor, 'hg-b');
    this.trash = surface(anchor, 'violet', 0, TRASH_Y, TRASH_W, TRASH_H);
    new Words(this.trash, 0, 30, 28, PALE, 'center', TRASH_W).set(uiText('hand.trash'));
    this.trash.hidden = true;
    window.addEventListener('keydown', (e) => {
      const i = Number(e.key);
      if (!this.live || e.repeat || !Number.isInteger(i) || i < 1 || i > this.ids.length) return;
      this.play(this.ids[i - 1]!);
    });
    window.addEventListener('pointermove', (e) => this.move(e));
    window.addEventListener('pointerup', (e) => this.drop(e));
    window.addEventListener('pointercancel', () => this.drop(null));
  }

  frame(vm: ViewModel): void {
    const s = vm.state, g = s.god;
    this.live = s.phase === 'live' && !g.deal && !vm.menu && !vm.title && !vm.film;
    // the hand, the fee, Malice's multiplier and the band move with events, Nether and the screen; the key is read only then
    const band = Math.floor(2 * (this.half() - Math.max(POUCH_W, CLOCK_W) - CLEAR));
    if (vm.fresh.length === 0 && g.nether === this.nether && g.malice === this.malice && s.phase === this.phase && band === this.band) return;
    this.nether = g.nether;
    this.malice = g.malice;
    this.phase = s.phase;
    this.band = band;
    const fee = cardFee(s);
    const key = `${g.hand.join()}|${fee}|${fee > g.nether}|${evilBonus(g.malice)}|${s.phase}|${band}`;
    if (key === this.key) return;
    this.key = key;
    this.ids = g.hand.slice();
    this.el.replaceChildren();
    if (s.phase !== 'live') return;
    const n = g.hand.length, w = CARD_W * REST;
    const need = n * w + Math.max(0, n - 1) * GAP;
    const k = Math.min(1, band / need), x0 = (-need * k) / 2;
    g.hand.forEach((id, i) => {
      const x = x0 + (i * (w + GAP) + w / 2) * k;
      const slot = div(this.el, 'hg-b hg-hit hg-card', x - CARD_W / 2, -CARD_H, CARD_W, CARD_H);
      slot.style.setProperty('--k', String(REST * k));
      plate(slot, s, id, 0, 0);
      attr(slot, 'title', tipOf(id));
      if (fee > 0) {
        const tag = surface(slot, 'inktab', CARD_W - 70, -16, 82, 46, 'hg-hit');
        new Pic(tag, 22, 23, 'nether');
        new Words(tag, 40, 8, 30, PALE).num().set(String(fee));
        attr(tag, 'title', uiText('hand.extraCardTip'));
      }
      if (fee > g.nether) {
        slot.classList.add('hg-rest');
        cell(slot, 'ui', 'card.dim', 0, 0, 0.5);
        new Words(surface(slot, 'inktab', 12, 88, CARD_W - 24, 30), 0, 6, 17, PALE, 'center', CARD_W - 24).set(uiText('why.nether', { n: fee }));
        attr(slot, 'title', `${uiText(`card.${id}.name`)}\n${uiText('hand.extraCardCost', { n: fee })}`);
      }
      slot.addEventListener('pointerdown', (e) => {
        if (e.isPrimary && e.button === 0) this.drag = { id, slot, x: e.clientX, y: e.clientY, home: null };
      });
    });
  }

  /** A press moved past a few px becomes a drag: the card follows the pointer and the discard zone shows, lit under it. */
  private move(e: PointerEvent): void {
    const d = this.drag;
    if (!d || !e.isPrimary) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.home) {
      if (Math.hypot(dx, dy) < CLICK_PX) return;
      const rs = [...this.el.children].map((c) => c.getBoundingClientRect());
      const l = Math.min(...rs.map((r) => r.left)), t = Math.min(...rs.map((r) => r.top));
      d.home = new DOMRect(l, t, Math.max(...rs.map((r) => r.right)) - l, Math.max(...rs.map((r) => r.bottom)) - t);
      this.trash.style.left = `${this.half() - TRASH_W}px`;
      this.trash.hidden = false;
    }
    d.slot.style.translate = `${dx / this.k()}px ${dy / this.k()}px`;
    this.trash.classList.toggle('hg-lit', inside(this.trash.getBoundingClientRect(), e));
  }

  /** The press ends: a drag dropped on the discard zone discards its card, on the field plays it, on the hand returns it. */
  private drop(e: PointerEvent | null): void {
    const d = this.drag;
    if (!d || (e && !e.isPrimary)) return;
    this.drag = null;
    if (!d.home) return;
    const binned = !!e && inside(this.trash.getBoundingClientRect(), e);
    d.slot.style.translate = '';
    this.trash.hidden = true;
    this.trash.classList.remove('hg-lit');
    if (!e || inside(d.home, e)) return;
    if (binned) this.send({ kind: 'act', action: { type: 'discard', card: d.id } });
    else this.play(d.id);
  }

  private play(id: CardId): void {
    const slot = this.el.children[this.ids.indexOf(id)] as HTMLElement;
    if (!this.live || slot.classList.contains('hg-rest')) deny(slot);
    else this.pay(id);
  }
}

export class Deal {
  private readonly el: HTMLDivElement;
  private key = '';
  private deal: CardId[] = [];
  private full = false;
  private leaving = false;
  private up = false;

  /** `busy`: a panel is open over the rest layout; the deal waits for it, and for a menu. */
  constructor(anchor: HTMLElement, private readonly send: (i: Intent) => void, private readonly busy: () => boolean, private readonly hand: () => HTMLElement) {
    this.el = div(anchor, 'hg-b');
    window.addEventListener('keydown', (e) => {
      if (!this.el.firstChild || this.leaving) return;
      const i = Number(e.key);
      if (e.key === 'Escape' || e.key === '0') this.take(null);
      else if (Number.isInteger(i) && i >= 1 && i <= this.deal.length) this.take(this.deal[i - 1]!);
      else return;
      e.preventDefault();
      e.stopImmediatePropagation();
    }, { capture: true });
  }

  frame(vm: ViewModel): void {
    const s = vm.state, g = s.god;
    const up = s.phase === 'live' && !!g.deal && !vm.title && !vm.menu && !this.busy();
    if (up === this.up && vm.fresh.length === 0) return;
    this.up = up;
    this.full = g.hand.length >= handMax(s);
    const key = up ? `${g.deal!.join()}|${g.rerolls}|${this.full}` : '';
    if (key === this.key) return;
    this.key = key;
    this.leaving = false;
    this.el.replaceChildren();
    if (!up) return;
    this.deal = g.deal!.slice();
    const veil = div(this.el, 'hg-b hgp-slab', -1200, -700, 2400, 1400);
    veil.style.background = 'rgba(4, 3, 6, 0.62)';
    const w = CARD_W * BIG, h = CARD_H * BIG, gap = 44, n = this.deal.length;
    const total = n * w + (n - 1) * gap, top = -h / 2 - 140;
    const title = uiText(this.full ? 'hand.full' : 'hand.takeOneIntoHand');
    const tw = 60 + title.length * 14;
    const tab = surface(this.el, 'parch', -tw / 2, top, tw, 52);
    new Words(tab, 0, 12, 28, INK, 'center', tw).set(title);
    if (this.full) new Words(this.el, -400, top + 60, 18, DIM, 'center', 800).set(uiText('hand.discardFirst'));
    this.deal.forEach((id, i) => {
      const box = div(this.el, 'hg-b hg-hit hg-big hg-dealt', -total / 2 + i * (w + gap), top + 86, w, h);
      box.style.animationDelay = `${i * 110}ms`;
      attr(box, 'title', tipOf(id));
      const p = plate(box, s, id, 0, 0).style;
      p.transformOrigin = '0 0';
      p.transform = `scale(${BIG})`;
      box.addEventListener('click', () => this.take(id));
    });
    const by = top + 86 + h + 26;
    const none = verb(this.el, g.rerolls > 0 ? -170 : -80, by, 160, 46, uiText('btn.takeNone'), '', () => this.take(null), () => {});
    none.classList.add('hg-fade');
    if (g.rerolls > 0) {
      verb(this.el, 10, by, 160, 46, uiText('btn.redraw', { n: g.rerolls }), '', () => this.send({ kind: 'act', action: { type: 'reroll' } }), () => {}).classList.add('hg-fade');
    }
  }

  /** The kept card flies to the hand and the rest fall away; then the take is sent. */
  private take(id: CardId | null): void {
    if (this.leaving) return;
    const boxes = [...this.el.querySelectorAll<HTMLElement>('.hg-big')];
    if (id && this.full) {
      deny(boxes[this.deal.indexOf(id)]!);
      return;
    }
    this.leaving = true;
    const to = this.hand().getBoundingClientRect();
    boxes.forEach((b, i) => {
      b.classList.remove('hg-dealt');
      if (this.deal[i] !== id) b.classList.add('hg-drop');
      else {
        const r = b.getBoundingClientRect(), k = r.width / (CARD_W * BIG);
        b.style.setProperty('--tx', `${(to.left - (r.left + r.width / 2)) / k}px`);
        b.style.setProperty('--ty', `${(to.top - 120 - (r.top + r.height / 2)) / k}px`);
        b.classList.add('hg-kept');
      }
    });
    this.el.classList.add('hg-leaving');
    window.setTimeout(() => {
      this.el.classList.remove('hg-leaving');
      this.send({ kind: 'act', action: { type: 'take', card: id } });
    }, 380);
  }
}
