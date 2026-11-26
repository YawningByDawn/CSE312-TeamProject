import type { Account, Action, CardId, Focus, Intent, Query, ViewModel } from '../../types';
import type { Anchors, MountPanels, Part, Where } from '../index';
import { div } from '../kit';
import { panelCss } from './art';
import { Building } from './building';
import { Choice, Bonus } from './choice';
import { Dusk } from './dusk';
import { Defeat, Ending, Title } from './front';
import { Grave, Pay } from './grave';
import { Person } from './person';

// The panels (src/ui/panels; inventory #1, 5, 7, 47, 94, 115-123): what opens over the rest layout. Each panel says what it
// shows now as one key, and is built again only when that key changes; its key carries `ctx.rev`, which moves when the
// state can have moved (fresh events, a whole action point, the hour) or a panel's own choice moved. The first open panel
// in the list below owns the keys it answers to; the rest fall through to app's input.

export interface Ctx {
  send(i: Intent): void;
  /** Send an action, and move the focus: the two intents the panels send most. */
  act(a: Action): void;
  focus(f: Focus): void;
  q: Query;
  at: Anchors;
  /** Where a thing stands on screen, in design px from the centre. */
  where: Where;
  /** Moves when what a panel shows may have changed. */
  rev: number;
  /** A panel's own choice moved (a stone picked, a mode): build again. */
  redraw(): void;
  /** The framework's login, in a build that has one. */
  account: Account | null;
}

export interface Panel {
  /** What it shows now as one key, or null when closed. */
  key(vm: ViewModel): string | null;
  build(root: HTMLElement, vm: ViewModel): void;
  /** Every frame it is open (timed reveals). */
  tick?(vm: ViewModel): void;
  /** A key while it is the first open panel: true when it answered. */
  press?(e: KeyboardEvent, vm: ViewModel): boolean;
}

/** The panels' frame, and the miracle a card plate asks to pay for (rb-hud's hand calls it). */
export interface Panels extends Part { pay(card: CardId): void }

export const mountPanels = (account: Account | null): MountPanels => (at, send, q, where) => {
  document.head.appendChild(document.createElement('style')).textContent = panelCss();
  let hour = -1, ap = -1;
  const ctx: Ctx = {
    send, q, at, where, rev: 0, account,
    act: (action) => send({ kind: 'act', action }),
    focus: (focus) => send({ kind: 'focus', focus }),
    redraw: () => { ctx.rev += 1; },
  };
  const pay = new Pay(ctx);
  // modal first: the first open one owns the keys
  const list: Panel[] = [
    new Title(ctx), new Defeat(ctx), new Ending(ctx), new Bonus(ctx), new Choice(ctx), pay, new Dusk(ctx),
    // the person slab before the building: a Move picks a place and the slab takes the pick back before a building opens
    new Person(ctx), new Grave(ctx), new Building(ctx),
  ];
  // the first in the list stands over the rest, as it owns the keys
  const roots = list.map((_, i) => {
    const r = div(at.c, 'hg-b');
    r.style.zIndex = String(list.length - i);
    return r;
  });
  const keys: (string | null)[] = list.map(() => null);
  let vmNow: ViewModel | null = null;

  /** Each panel's key against `vm` now, built again where it moved; the first open one's index. A sent intent changes
   * the state at once, so a key syncs before it picks the panel that answers, as a frame does before it ticks. */
  const sync = (vm: ViewModel): number => {
    list.forEach((p, i) => {
      const k = p.key(vm);
      if (k === keys[i]) return;
      keys[i] = k;
      const r = roots[i]!;
      r.replaceChildren();
      if (k !== null) p.build(r, vm);
    });
    return keys.findIndex((k) => k !== null);
  };

  window.addEventListener('keydown', (e) => {
    if (!vmNow) return;
    const i = sync(vmNow);
    if (i >= 0 && list[i]!.press?.(e, vmNow)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, { capture: true });

  return {
    pay: (card) => pay.open(card),
    frame(vm) {
      vmNow = vm;
      const h = Math.floor(q.hour(vm.state.tick)), a = Math.floor(vm.state.god.ap);
      if (vm.fresh.length > 0 || h !== hour || a !== ap) {
        hour = h;
        ap = a;
        ctx.rev += 1;
      }
      sync(vm);
      list.forEach((p, i) => { if (keys[i] !== null) p.tick?.(vm); });
    },
  };
};
