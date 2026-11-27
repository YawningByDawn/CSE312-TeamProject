import type { UnitId, View, ViewModel } from '../../types';
import { uiText } from '../../content/text';
import { VIOLET, Words, div } from '../kit';

// The Nether a slain skeleton leaves, said over the place it fell: "+x Nether" rises and fades in `hg-note`'s 1.1 s
// (kit.ts), following the body while the view still shows it. The sim's `slain` event names the unit and the amount;
// no Nether dropped, no text.

const SIZE = 22;

export class Drops {
  /** The notes still rising, each over the unit it came from. */
  private readonly notes = new Map<HTMLElement, UnitId>();
  private readonly at = { x: 0, y: 0 };

  /** `where`: the view's screen point of a thing, in design px of `anchor`'s frame. */
  constructor(private readonly anchor: HTMLElement, private readonly where: View['where']) {}

  frame(vm: ViewModel): void {
    for (const e of vm.fresh) {
      if (e.kind !== 'slain' || e.nether <= 0 || !e.unit) continue;
      const box = div(this.anchor, 'hg-b');
      const words = new Words(box, -100, 0, SIZE, VIOLET, 'center', 200);
      words.el.classList.add('hg-note');
      words.el.addEventListener('animationend', () => { box.remove(); this.notes.delete(box); });
      words.set(uiText('hud.drop', { n: Math.round(e.nether) }));
      this.notes.set(box, e.unit);
    }
    for (const [box, unit] of this.notes) {
      const on = this.where({ unit }, this.at);
      box.hidden = !on;
      if (on) box.style.translate = `${this.at.x}px ${this.at.y}px`;
    }
  }
}
