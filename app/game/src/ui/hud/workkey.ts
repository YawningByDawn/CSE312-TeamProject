import type { Query, ViewModel } from '../../types';
import { keyName } from '../../content/keys';
import { PALE, Words, div, surface } from '../kit';
import type { Where } from '../index';

// The work key on the ore in reach (MINE, ore-marks): over the seam the work key (`F` out of the box, the Keys tab's)
// stands on a small plate, while the sim's `workAt` names an ore the host is not already
// working. It follows the seam on the screen; it takes no pointer (a click is the swing).

const CAP = 36, GAP = 6;

export class WorkKey {
  private readonly el: HTMLDivElement;
  private readonly cap: Words;
  private readonly at = { x: 0, y: 0 };
  private moved = '';

  constructor(anchor: HTMLElement, private readonly q: Query, private readonly where: Where) {
    this.el = div(anchor, 'hg-b');
    surface(this.el, 'parchDark', -CAP / 2, -CAP, CAP, CAP);
    this.cap = new Words(this.el, -CAP / 2, -CAP + 5, 22, PALE, 'center', CAP);
  }

  frame(vm: ViewModel): void {
    const s = vm.state, w = this.q.workAt(s);
    const ore = w !== null && w !== 'drop' && s.body?.ore !== w.mine ? w.mine : -1;
    const on = ore >= 0 && !vm.menu && this.where({ ore }, this.at);
    if ((this.el.hidden = !on)) return;
    this.cap.set(keyName(vm.settings.keys.work[0] ?? ''));
    const to = `translate(${this.at.x}px, ${this.at.y - GAP}px)`;
    if (to !== this.moved) this.el.style.transform = this.moved = to;
  }
}
