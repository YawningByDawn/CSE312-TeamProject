import type { FactionId, ViewModel } from '../../types';
import { uiText } from '../../content/text';
import { PALE, Pic, Words, attr, div, surface } from '../kit';
import { GOD_H, GOD_Y } from './god';

// The powers' suspicion, a thin box under the god's corner: the Temple, the Council and the crews each a name over a groove
// that fills as their suspicion does and turns to blood from the second level; hover says what each is doing. It writes
// only when a power moves.

export const SUSP_W = 372;
export const SUSP_H = 66;
export const SUSP_Y = GOD_Y + GOD_H + 8;
const ORDER: readonly FactionId[] = ['temple', 'council', 'public'];
const PITCH = 116, X0 = 13, NAME_Y = 8, BAR_Y = 44, BAR_W = 110;

export class Suspicion {
  private readonly cols: { empty: Pic; full: Pic; hover: HTMLElement }[] = [];
  private readonly heat: number[] = [-1, -1, -1];
  private readonly level: number[] = [-1, -1, -1];

  constructor(anchor: HTMLElement) {
    const b = surface(anchor, 'slab', -SUSP_W, SUSP_Y, SUSP_W, SUSP_H);
    ORDER.forEach((f, i) => {
      const x = X0 + i * PITCH;
      new Words(b, x, NAME_Y, 17, PALE).set(uiText(`power.${f}`));
      const hover = div(b, 'hg-b hg-hit', x, 0, PITCH, SUSP_H);
      hover.style.cursor = 'default';
      this.cols.push({ empty: new Pic(b, x, BAR_Y, 'groove.malice.violet.empty'), full: new Pic(b, x, BAR_Y, 'groove.malice.violet.full'), hover });
    });
  }

  frame(vm: ViewModel): void {
    ORDER.forEach((f, i) => {
      const fa = vm.state.factions[f];
      if (fa.suspicion === this.heat[i] && fa.level === this.level[i]) return;
      this.heat[i] = fa.suspicion;
      this.level[i] = fa.level;
      const c = this.cols[i]!, tone = fa.level >= 2 ? 'blood' : 'violet';
      c.empty.show(`groove.malice.${tone}.empty`);
      c.full.show(`groove.malice.${tone}.full`);
      c.full.fill(Math.min(100, Math.max(0, fa.suspicion)) / 100, BAR_W);
      attr(c.hover, 'title', `${uiText(`power.${f}`)} ${Math.round(fa.suspicion)}\n${uiText(`power.${f}.${fa.level}`)}`);
    });
  }
}
