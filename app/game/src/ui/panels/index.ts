// src/ui/panels, what opens over the rest layout (inventory #1, 5, 7, 47, 94, 115-123): the title, the defeat and the
// ending (front), what the clock waits on: the starting gift, a blessing, a story's choice, (choice), a person, the grave and the pay slab
// (grave), the dusk's ledger; art.ts the baked sheets they show (assets/ui, cardart, crystals, crystalmarks, portraits,
// front, title, defeat). Reads the view model, the sim's Query and card helpers, content's tables
// and words, the framework's login; sends intents.
import type { Account, Action, CardId, Focus, Intent, Query, ViewModel } from '../../types';
import type { Anchors, MountPanels, Part, Where } from '../index';
import { div } from '../kit';
import { panelCss } from './art';
import { Choice, Bonus } from './choice';
import { Dusk } from './dusk';
import { Defeat, Ending, Title } from './front';
import { Grave, Pay } from './grave';
import { Host } from './host';
import { Person } from './person';
import { SignIn } from './sign';

// Each panel says what it shows now as one key, and is built again only when that key changes; its key carries `ctx.rev`, which moves when the
// state can have moved (fresh events, a whole action point, the hour) or a panel's own choice moved. The first open panel
// in the list below is the only one shown and owns the keys it answers to; the rest wait beneath it and fall through to
// app's input. A menu and a focus close each other (app's pump), and the dusk card yields to either (dusk.ts).

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
  /** The login popup over whatever stands (a lobby's way in for a player not logged in). */
  signIn(): void;
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
  const sign = account && new SignIn(account, div(at.c, 'hg-b'));
  const ctx: Ctx = {
    send, q, at, where, rev: 0, account,
    signIn: () => sign?.show(),
    act: (action) => send({ kind: 'act', action }),
    focus: (focus) => send({ kind: 'focus', focus }),
    redraw: () => { ctx.rev += 1; },
  };
  const pay = new Pay(ctx);
  // modal first: the first open one owns the keys
  const list: Panel[] = [
    new Title(ctx), new Defeat(ctx), new Ending(ctx), new Bonus(ctx), new Choice(ctx), new Host(ctx), pay, new Dusk(ctx),
    new Person(ctx), new Grave(ctx),
  ];
  // the first in the list stands over the rest, as it owns the keys
  const roots = list.map((_, i) => {
    const r = div(at.c, 'hg-b');
    r.style.zIndex = String(list.length - i);
    return r;
  });
  const keys: (string | null)[] = list.map(() => null);
  let vmNow: ViewModel | null = null;

  /** Each panel's key against `vm` now; only the first open one is built, the rest wait (their key is null) until it
   * closes, so two never overlap. Built again where it moved; the first open one's index. A sent intent changes the state
   * at once, so a key syncs before it picks the panel that answers, as a frame does before it ticks. */
  const sync = (vm: ViewModel): number => {
    const now = list.map((p) => p.key(vm));
    const first = now.findIndex((k) => k !== null);
    list.forEach((p, i) => {
      const k = i === first ? now[i]! : null;
      if (k === keys[i]) return;
      keys[i] = k;
      const r = roots[i]!;
      if (k === null) return r.replaceChildren();
      // built aside: a panel that came out as it stands is left alone (no new nodes to lose the hover, a press or an
      // animation); one with a tick holds on to the nodes it built, so it is always put in
      const next = document.createElement('div');
      p.build(next, vm);
      if (p.tick || next.innerHTML !== r.innerHTML) r.replaceChildren(...next.childNodes);
    });
    return first;
  };

  window.addEventListener('keydown', (e) => {
    // a menu stands over the panels: its keys are the menu's
    if (!vmNow || vmNow.menu || sign?.shown) return;
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
