import type { Action, Pending, Settings, ViewModel } from '../../types';
import { uiText } from '../../content/text';
import { PICKS, bound, keyName, pickOf } from '../../content/keys';
import { CARD_H, CARD_W, DIM, PALE, Words, card, div, line, slab, verb } from './art';
import type { Ctx, Panel } from './index';

// What the clock waits on (inventory #5, 29, 120, 121): the opening's first deal (the starting gift: take one of the
// cards on the opening's last frame), a blessing at a new rank, a story's choice. The pick keys pick.

const GAP = 34;

/** A row of picks centred under a title: cards, or cuts. Each is clickable; the n-th answers the n-th pick key. */
function picks(root: HTMLElement, title: string, foot: string, n: number, w: number, h: number, draw: (box: HTMLElement, i: number) => void, take: (i: number) => void): void {
  const dim = div(root, 'hg-b hgp-slab', -1200, -700, 2400, 1400);
  dim.style.background = 'rgba(0,0,0,0.42)';
  const total = n * w + (n - 1) * GAP;
  new Words(root, -800, -h / 2 - 90, 32, PALE, 'center', 1600).set(title);
  for (let i = 0; i < n; i++) {
    const box = div(root, 'hg-b hg-hit hgp-hov', -total / 2 + i * (w + GAP), -h / 2 - 20, w, h);
    draw(box, i);
    box.addEventListener('click', () => take(i));
  }
  new Words(root, -800, h / 2 + 10, 17, DIM, 'center', 1600).set(foot);
}

/** The first key of the i-th pick (none past the last pick bind). */
const pickKey = (set: Readonly<Settings>, i: number): string => keyName(set.keys[PICKS[i]!]?.[0] ?? '');
const footOf = (set: Readonly<Settings>, n: number): string =>
  n > 1 ? uiText('pick.keys', { a: pickKey(set, 0), b: pickKey(set, Math.min(n, PICKS.length) - 1) }) : uiText('pick.click');

/** The starting gift: the first deal on the opening's last frame; taking one starts the clock. */
export class Bonus implements Panel {
  constructor(private readonly c: Ctx) {}

  key(vm: ViewModel): string | null {
    const s = vm.state;
    return !vm.title && !vm.film && s.phase === 'bonus' && s.god.deal ? `bonus|${s.god.deal.join()}` : null;
  }

  build(root: HTMLElement, vm: ViewModel): void {
    const deal = vm.state.god.deal!;
    picks(root, uiText('bonus.pickHead'), footOf(vm.settings, deal.length), deal.length, CARD_W, CARD_H, (box, i) => card(box, vm.state, deal[i]!, 0, 0), (i) => this.take(deal[i]!));
  }

  private take(card: string): void {
    this.c.act({ type: 'take', card });
  }

  press(e: KeyboardEvent, vm: ViewModel): boolean {
    const deal = vm.state.god.deal!;
    const i = pickOf(vm.settings, e, deal.length);
    if (i < 0) return false;
    this.take(deal[i]!);
    return true;
  }
}

export class Choice implements Panel {
  constructor(private readonly c: Ctx) {}

  key(vm: ViewModel): string | null {
    const p = vm.state.pending;
    return !vm.title && !vm.film && vm.state.phase === 'live' && p ? `${p.kind}|${this.c.rev}|${JSON.stringify(p)}` : null;
  }

  private actions(p: Pending): Action[] {
    if (p.kind === 'blessing') return p.offers.map((blessing) => ({ type: 'pickBlessing', blessing }));
    return Array.from({ length: p.options }, (_, i) => ({ type: 'story', option: i + 1 }));
  }

  build(root: HTMLElement, vm: ViewModel): void {
    const s = vm.state, p = s.pending!;
    const acts = this.actions(p);
    if (p.kind === 'blessing') {
      picks(root, uiText('blessing.choose'), footOf(vm.settings, acts.length), acts.length, CARD_W, CARD_H, (box, i) => card(box, s, p.offers[i]!, 0, 0, true), (i) => this.c.act(acts[i]!));
      return;
    }
    const slots = this.c.q.storySlots(s)!;
    const words = `story.${p.story}`;
    const body = uiText(`${words}.body`, slots);
    const bodyH = Math.ceil(body.length / 62) * 24;
    const h = 96 + bodyH + 18 + acts.length * 74 + 30;
    const { el, say } = slab(root, -320, -h / 2 - 40, 640, h, uiText(`${words}.title`, slots));
    line(el, 36, 86, 568, 19, PALE, body);
    acts.forEach((a, i) => {
      const check = this.c.q.check(s, a);
      const why = check.ok ? '' : uiText(check.why[0]!.key, check.why[0]!.slots);
      const label = `${pickKey(vm.settings, i)}  ${uiText(`${words}.opt${i + 1}.label`, slots)}`;
      verb(el, 36, 96 + bodyH + 18 + i * 74, 568, 64, label, why, () => this.c.act(a), say, uiText(`${words}.opt${i + 1}.does`, slots));
    });
  }

  press(e: KeyboardEvent, vm: ViewModel): boolean {
    const acts = this.actions(vm.state.pending!);
    const i = bound(vm.settings, 'confirm', e) && acts.length === 1 ? 0 : pickOf(vm.settings, e, acts.length);
    if (i < 0) return false;
    this.c.act(acts[i]!);
    return true;
  }
}
