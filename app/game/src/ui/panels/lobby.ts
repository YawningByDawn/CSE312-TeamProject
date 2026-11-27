import type { Net } from '../../types';
import { uiText } from '../../content/text';
import { BLOOD, DIM, PALE, VIOLET, Words, attr, div, slab, surface } from './art';
import { Menu, item } from './menu';

/** Where a screen puts its parts. */
export interface Slots { nav: HTMLElement; stage: HTMLElement; base: HTMLElement }

// The multiplayer screens, in the title in place of its entries (no popup): Host, Search and Back in the title's menu;
// Search's scrollable list of the hub's open lobbies, and the lobby the player is in with its members, each a solid slab (the
// game's own panel: slab, parchment name tab, dark parchment rows, violet for the lit one) centred on the screen, with their
// buttons as violet plates in one row at the window's bottom (Search: Back, Refresh, Join, dim until one is picked; the lobby:
// Back and Start, dim for all but the host). The hub says which lobby this player is in (`net.lobby`), so that screen shows
// whenever there is one. Coordinates are design px: from the title's menu (`nav`), or from the screen's centre (`stage`) and
// from the bottom row's own centre (`base`, which the title keeps at the window's bottom).

const LIST = { w: 520, h: 340 };
const ROOM = { w: 440, h: 310 };
const ROW = 46;
const PLATE = { w: 140, h: 44 };

type View = 'main' | 'menu' | 'search' | 'room';

export class Multi {
  private screen: 'menu' | 'search' | null = null;
  private picked = '';
  constructor(private readonly net: Net) {}

  get view(): View {
    return this.net.lobby ? 'room' : this.screen ?? 'main';
  }

  /** What the screen shows now as one key: it is built again when this moves. */
  key(): string {
    const v = this.view;
    return v === 'search' || v === 'room' ? `${v}|${this.net.rev}` : v;
  }

  open(): void {
    this.screen = 'menu';
  }

  close(): void {
    this.screen = null;
  }

  /** Leave the lobby, or go back a screen. */
  back(): void {
    if (this.net.lobby) this.net.leave();
    else this.screen = this.screen === 'search' ? 'menu' : null;
  }

  /** The current screen's entries in `at`; `me` is the logged-in player. */
  build(at: Slots, me: string | null): Menu {
    const v = this.view;
    return v === 'room' ? this.room(at, me) : v === 'search' ? this.search(at) : this.menu(at.nav);
  }

  private menu(nav: HTMLElement): Menu {
    const acts = [() => this.net.host(), () => { this.screen = 'search'; this.net.search(); }, () => this.back()];
    const items = [item(nav, 0, 0, 34, uiText('lobby.host'), '', acts[0]!), item(nav, 0, 56, 24, uiText('lobby.search'), '', acts[1]!), item(nav, 0, 96, 24, uiText('btn.back'), '', acts[2]!)];
    return new Menu(items, acts);
  }

  /** A violet plate button in the bottom row, centred at `cx`: dim (and inert in look) until `live(true)`. */
  private button(base: HTMLElement, cx: number, text: string, act: () => void): { el: HTMLDivElement; live: (on: boolean) => void } {
    const el = item(base, cx - PLATE.w / 2, 0, 24, text, '', act);
    el.style.zIndex = '0';
    // the plates sit behind the label, before the lit mark (Menu reads its first and last child); the label fills the plate
    // (the click lands on it) and sits centred, the mark inside the plate's left
    const [label, mark] = [el.firstChild, el.lastChild] as HTMLElement[];
    const back = div(el, 'hg-b');
    back.style.zIndex = '-1';
    el.insertBefore(back, mark!);
    const on = surface(back, 'violet', 0, -10, PLATE.w, PLATE.h), off = surface(back, 'violetDim', 0, -10, PLATE.w, PLATE.h);
    Object.assign(label!.style, { top: '-10px', width: `${PLATE.w}px`, height: `${PLATE.h}px`, lineHeight: `${PLATE.h}px`, textAlign: 'center' });
    mark!.style.left = '12px';
    mark!.style.top = '9px';
    const live = (v: boolean): void => {
      on.hidden = !v;
      off.hidden = v;
      el.classList.toggle('hgp-off', !v);
    };
    live(true);
    return { el, live };
  }

  private search({ stage, base }: Slots): Menu {
    const net = this.net;
    if (!net.lobbies.some((l) => l.host === this.picked)) this.picked = '';
    const { el } = slab(stage, -LIST.w / 2, -LIST.h / 2, LIST.w, LIST.h, uiText('lobby.title'));
    const list = div(el, 'hg-b hg-scroll', 20, 76, LIST.w - 40, LIST.h - 76 - 56);
    if (net.lobbies.length === 0) new Words(list, 0, 80, 20, DIM, 'center', LIST.w - 40).set(uiText('lobby.none'));
    const rows = net.lobbies.map((l, i) => {
      const w = LIST.w - 40 - 18;
      const r = div(list, 'hg-b hg-hit', 0, i * ROW, w, ROW - 6);
      surface(r, 'parchDark', 0, 0, w, ROW - 6);
      const lit = surface(r, 'violet', 0, 0, w, ROW - 6);
      const name = new Words(r, 16, 9, 22, PALE);
      name.set(l.name);
      new Words(r, w - 96, 11, 20, DIM, 'right', 80).set(uiText('lobby.count', { n: l.members.length, max: l.max }));
      r.addEventListener('click', () => { this.picked = l.host; mark(); });
      return { lit, name: name.el, host: l.host };
    });
    new Words(el, 0, LIST.h - 40, 18, BLOOD, 'center', LIST.w).set(net.refused ? uiText(`lobby.refused.${net.refused}`) : '');
    const acts = [() => this.back(), () => net.search(), () => { if (this.picked) net.join(this.picked); }];
    const [back, refresh, join] = [uiText('btn.back'), uiText('lobby.refresh'), uiText('lobby.join')].map((w, i) => this.button(base, (i - 1) * 170, w, acts[i]!));
    const mark = (): void => {
      for (const { lit, name, host } of rows) {
        lit.hidden = host !== this.picked;
        name.style.color = lit.hidden ? PALE : VIOLET;
      }
      join!.live(this.picked !== '');
      attr(join!.el, 'title', this.picked ? '' : uiText('lobby.pick'));
    };
    mark();
    return new Menu([back!.el, refresh!.el, join!.el], acts);
  }

  private room({ stage, base }: Slots, me: string | null): Menu {
    const net = this.net;
    const lobby = net.lobby!;
    const { w, h } = ROOM;
    const { el } = slab(stage, -w / 2, -h / 2, w, h, lobby.name);
    new Words(el, w - 228, 30, 19, DIM, 'right', 200).set(uiText('lobby.players', { n: lobby.members.length, max: lobby.max }));
    lobby.members.forEach((m, i) => {
      const r = surface(el, 'parchDark', 28, 78 + i * ROW, w - 56, ROW - 6);
      new Words(r, 16, 9, 22, PALE).set(m);
      if (m === lobby.host) new Words(r, w - 56 - 136, 12, 18, DIM, 'right', 120).set(uiText('lobby.hostTag'));
    });
    const host = me === lobby.host;
    // what Start starts is a stub until multiplayer play exists: the hub tells every member, and they see it
    new Words(el, 0, h - 40, 18, PALE, 'center', w).set(net.started ? uiText('lobby.started') : host ? '' : uiText('lobby.waiting'));
    const acts = [() => this.back(), () => { if (host && !net.started) net.start(); }];
    const [back, start] = [uiText('btn.back'), uiText('lobby.start')].map((t, i) => this.button(base, (i - 0.5) * 190, t, acts[i]!));
    if (!host || net.started) {
      start!.live(false);
      attr(start!.el, 'title', uiText('lobby.waiting'));
    }
    return new Menu([back!.el, start!.el], acts);
  }
}
