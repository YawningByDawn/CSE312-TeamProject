import type { Query, ViewModel } from '../../types';
import { uiText } from '../../content/text';
import { POCKET } from '../../content/mine';
import { ROLES } from '../../content/roles';
import { HOST } from '../../content/stats';
import { hostOf } from '../../sim/host';
import { PALE, VIOLET, Words, div } from '../kit';
import { SUSP_H, SUSP_Y } from './suspicion';

// The quests, right side under the suspicion box: a few lines of words with no slab behind them. By day, what the sim holds the host
// to: the trade's quota of ore delivered, the stones pocketed against the free few, and the marks made of the day's
// allowance. A line whose number is met turns violet. Nothing at night. The lines take no pointer.

export const QUESTS_W = 260;
export const QUESTS_Y = SUSP_Y + SUSP_H + 14;
const ROW = 28;

/** One line of the list: its name and its figure. */
class Line {
  private readonly name: Words;
  private readonly fig: Words;
  private done = false;

  constructor(parent: HTMLElement, y: number) {
    this.name = new Words(parent, 0, y + 2, 19, PALE);
    this.fig = new Words(parent, 0, y, 21, PALE, 'right', QUESTS_W).num();
  }

  set(name: string, fig: string, done: boolean): void {
    this.name.set(name);
    this.fig.set(fig);
    if (done !== this.done) this.name.el.style.color = this.fig.el.style.color = (this.done = done) ? VIOLET : PALE;
  }

  at(y: number): void {
    this.name.el.style.top = `${y + 2}px`;
    this.fig.el.style.top = `${y}px`;
  }

  hide(h: boolean): void {
    this.name.el.hidden = this.fig.el.hidden = h;
  }
}

export class Quests {
  private readonly list: HTMLDivElement;
  private readonly owed: Line;
  private readonly pocket: Line;
  private readonly marks: Line;

  constructor(anchor: HTMLElement, private readonly q: Query) {
    this.list = div(anchor, 'hg-b', -QUESTS_W - 14, QUESTS_Y, QUESTS_W);
    [this.owed, this.pocket, this.marks] = [0, 1, 2].map((i) => new Line(this.list, i * ROW)) as [Line, Line, Line];
  }

  frame(vm: ViewModel): void {
    const s = vm.state, host = hostOf(s), on = host !== null && s.body !== null;
    this.list.hidden = !on;
    if (!on) return;
    const quota = ROLES[host.role]!.quota, digs = quota > 0, b = s.body!;
    this.owed.set(uiText(digs ? 'quest.quota' : 'quest.noQuota'), digs ? `${b.delivered} / ${quota}` : '', digs && b.delivered >= quota);
    this.pocket.hide(!digs);
    if (digs) this.pocket.set(uiText('quest.pocket'), uiText('quest.free', { n: host.pocket.length, free: POCKET.free }), host.pocket.length <= POCKET.free);
    this.marks.at(digs ? 2 * ROW : ROW);
    const made = this.q.marksToday(s);
    this.marks.set(uiText('quest.marks'), `${made} / ${HOST.marksPerDay}`, made >= HOST.marksPerDay);
  }
}
