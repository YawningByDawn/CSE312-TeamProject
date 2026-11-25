import type { FactionId, ViewModel } from '../../types';
import { uiText } from '../../content/text';
import { INK, PALE, Pic, Words, surface } from '../kit';

// The three powers, top right (inventory #96): a wick each whose flame stands as tall as its heat, its name on a hide tab,
// and one line for the hottest of them in plain words.

export const POWERS_W = 336;
export const POWERS_H = 178;
const FLAME_STEPS = 10;
const ORDER: readonly FactionId[] = ['temple', 'council', 'public'];
/** The ui atlas names the powers by their old tracks. */
const TRACK: Record<FactionId, string> = { temple: 'cult', council: 'gov', public: 'public' };

export class Powers {
  private readonly flames: Pic[] = [];
  private readonly line: Words;
  private readonly heat: number[] = [-1, -1, -1];
  private readonly level: number[] = [-1, -1, -1];

  constructor(anchor: HTMLElement) {
    const b = surface(anchor, 'slab', -POWERS_W, 0, POWERS_W, POWERS_H);
    ORDER.forEach((f, i) => {
      const x = 58 + i * 110;
      new Pic(b, x, 94, `wick.${TRACK[f]}.cup`);
      this.flames.push(new Pic(b, x, 94, `wick.${TRACK[f]}.0`));
      const tab = surface(b, 'parch', x - 50, 112, 100, 34);
      new Words(tab, 0, 8, 20, INK, 'center', 100).set(uiText(`power.${f}`));
    });
    this.line = new Words(b, 0, 154, 18, PALE, 'center', POWERS_W);
  }

  frame(vm: ViewModel): void {
    const fs = vm.state.factions;
    let moved = false;
    for (let i = 0; i < ORDER.length; i++) {
      const fa = fs[ORDER[i]!];
      if (fa.suspicion === this.heat[i] && fa.level === this.level[i]) continue;
      moved = true;
      this.heat[i] = fa.suspicion;
      this.level[i] = fa.level;
      this.flames[i]!.show(`wick.${TRACK[ORDER[i]!]}.${Math.round((Math.min(100, Math.max(0, fa.suspicion)) / 100) * FLAME_STEPS)}`);
    }
    if (!moved) return;
    // the line speaks for the power at the highest level, the hotter of two at the same
    let top = 0;
    for (let i = 1; i < ORDER.length; i++) {
      if (this.level[i]! > this.level[top]! || (this.level[i] === this.level[top] && this.heat[i]! > this.heat[top]!)) top = i;
    }
    this.line.set(uiText(`power.${ORDER[top]}.${this.level[top]}`));
  }
}
