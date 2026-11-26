// src/ui, the DOM interface over the canvas (implements `Ui`; docs/style.md §7). Owns the interface's layers, their
// corner anchors and scale; kit.ts its DOM helpers, the ui atlas's cells and the fonts.
// src/ui/hud holds the rest layout's parts, one a file: the hand and the deal (cards), the clock, the host's plate, the
// feed, the god's corner (god) with the powers' suspicion, the goal and the quests under it, the hints, the menus, the
// pouch with the people plate and the hover tip; src/ui/panels what opens over them.
// Reads the view model each frame, the sim's Query and its pure helpers (sim/core, sim/cards), content's tables and
// its words (`uiText`), and where the view stands a thing on screen; it changes nothing itself: every choice is an
// `Intent` sent to app.
import type { Bind, Intent, Query, Settings, Ui, View, ViewModel } from '../types';
import type { Panels } from './panels';
import { keyName } from '../content/keys';
import { uiText } from '../content/text';
import { DIM, Words, div, installCss } from './kit';
import { Deal, Hand } from './hud/cards';
import { Clock } from './hud/clock';
import { Feed } from './hud/feed';
import { Hints } from './hud/hints';
import { Menus } from './hud/menus';
import { Tip } from './hud/tip';
import { God } from './hud/god';
import { Goal } from './hud/goal';
import { HostPlate } from './hud/hostplate';
import { Quests } from './hud/quests';
import { Suspicion } from './hud/suspicion';
import { Pouch, POUCH_H } from './hud/pouch';
import { People } from './hud/people';

// The rest layout frames the world from its corners: each corner is an anchor 24 px in from the screen's edge, all
// scaled by one factor from the window and the Interface size setting, their parts laid out in design px of a
// 1600x900 screen. A frame hands the view model to each part; a part writes only what changed. The panels mount in
// their own layer over the rest layout, and are framed after it.

/** The design screen the parts are laid out on. */
const DESIGN_W = 1600, DESIGN_H = 900;
const MARGIN = 24;
const SIZE: Record<Settings['uiSize'], number> = { small: 0.85, medium: 1, large: 1.15 };

export type Corner = 'tl' | 'tr' | 'bl' | 'bc' | 'br' | 'c';
const CORNERS: readonly Corner[] = ['tl', 'tr', 'bl', 'bc', 'br', 'c'];

/** What a mounted part does each frame. */
export interface Part { frame(vm: ViewModel): void }
/** A layer's anchors: a point per corner its parts are laid out from (right and bottom parts at negative x, y). */
export type Anchors = Readonly<Record<Corner, HTMLElement>>;
/** The view's screen point of a thing, in design px of one corner's frame. */
export type Where = View['where'];
/** rb-panels' entry: given its layer's anchors, the intents, the rules and where things stand in the centre's frame, it
 * returns its frame and the pay slab. */
export type MountPanels = (at: Anchors, send: (i: Intent) => void, q: Query, where: Where) => Panels;

/** A panel is open: one of the panels' roots holds something. */
function open(roots: HTMLElement): boolean {
  for (let r = roots.firstElementChild; r; r = r.nextElementSibling) if (r.firstChild) return true;
  return false;
}

export function createUi(mountPanels?: MountPanels): Ui {
  const parts: Part[] = [];
  let panels: Panels | null = null;
  const points: [HTMLElement, Corner][] = [];
  let rest: HTMLDivElement;
  let hidden = false;
  let size: Settings['uiSize'] | null = null;
  let w = DESIGN_W, h = DESIGN_H, k = 1;
  /** Each corner's anchor in screen px. */
  let ax = {} as Record<Corner, number>, ay = {} as Record<Corner, number>;
  let tip: Tip;
  let live: ViewModel;
  let skip: Words;
  let menus: Menus;

  function layer(parent: HTMLElement): [HTMLDivElement, Anchors] {
    const el = div(parent, 'hg');
    const at = {} as Record<Corner, HTMLElement>;
    for (const c of CORNERS) points.push([(at[c] = div(el, 'hg-a')), c]);
    return [el, at];
  }

  function scale(): void {
    k = Math.min(w / DESIGN_W, h / DESIGN_H) * SIZE[size ?? 'medium'];
    ax = { tl: MARGIN, bl: MARGIN, tr: w - MARGIN, br: w - MARGIN, bc: w / 2, c: w / 2 };
    ay = { tl: MARGIN, tr: MARGIN, bl: h - MARGIN, bc: h - MARGIN, br: h - MARGIN, c: h / 2 };
    for (const [el, c] of points) el.style.transform = `translate(${ax[c]}px, ${ay[c]}px) scale(${k})`;
  }

  return {
    mount(root, send, q, where) {
      // a button that opens a panel closes it when what it opens is already open (the grave stands open on a stone too)
      const toggle = (i: Intent): void => {
        if (i.kind === 'menu') return send(live.menu === i.menu ? { kind: 'menu', menu: null } : i);
        if (i.kind !== 'focus') return send(i);
        const on = live.focus as Record<string, unknown> | null, to = i.focus as Record<string, unknown> | null;
        const same = on !== null && to !== null && (Object.entries(to).every(([k, v]) => on[k] === v) || (to.place === 'grave' && 'crystal' in on));
        send(same ? { kind: 'focus', focus: null } : i);
      };
      const from = (c: Corner): Where => (t, out) => where(t, out) && ((out.x = (out.x - ax[c]) / k), (out.y = (out.y - ay[c]) / k), true);
      installCss([]);
      const hud = div(root, 'hg');
      const [restEl, at] = layer(hud);
      rest = restEl;
      const [, panelAt] = layer(hud);
      // the hand stays over the deal's veil: a full hand discards before it takes
      at.bc.style.zIndex = '1';
      // the hand's half of the screen, in design px from its centre to the margin
      const hand = new Hand(at.bc, send, (card) => panels?.pay(card), () => (w / 2 - MARGIN) / k, () => k);
      const deal = new Deal(at.c, send, () => open(panelAt.c), () => hand.el);
      if (mountPanels) panels = mountPanels(panelAt, send, q, from('c'));
      const [, menuAt] = layer(hud);
      // a film may be skipped: the prompt bottom right while one plays (inventory #3)
      skip = new Words(menuAt.br, -400, -24, 18, DIM, 'right', 400);
      skip.el.hidden = true;
      // top left the host and under it the feed's events; top right the god, the powers' suspicion, the goal and the quests;
      // bottom left the pouch and the people; bottom right the clock
      parts.push(
        new HostPlate(at.tl, send, q), new Feed(at.tl, toggle),
        new God(at.tr, toggle, q), new Suspicion(at.tr), new Goal(at.tr, toggle, q),
        new Pouch(at.bl, toggle), new People(at.bl, send, POUCH_H), new Clock(at.br, send, q),
        new Quests(at.tr, q), new Hints(at, (t) => q.day(t), send), hand, deal,
      );
      menus = new Menus(menuAt, at.tr, send, q);
      tip = new Tip(hud, () => k);
      new ResizeObserver(([e]) => {
        w = e!.contentRect.width;
        h = e!.contentRect.height;
        scale();
      }).observe(root);
    },
    frame(vm) {
      live = vm;
      if (vm.settings.uiSize !== size) {
        size = vm.settings.uiSize;
        scale();
      }
      const keys = vm.settings.keys, name = (b: Bind): string => keyName(keys[b][0] ?? '');
      // the title, the films and the defeat's drained world play over an empty screen
      const off = vm.title || vm.film !== null || vm.state.phase === 'lost';
      if (off !== hidden) rest.hidden = hidden = off;
      const film = vm.film !== null && vm.film.kind !== 'take';
      if (film === skip.el.hidden) skip.el.hidden = !film;
      if (film) skip.set(uiText('hud.skip', { back: name('back'), skip: name('skip') }));
      if (!off) for (const p of parts) p.frame(vm);
      // the settings open over the title and the defeat too
      menus.frame(vm);
      panels?.frame(vm);
      tip.frame(vm);
    },
  };
}
