import type { GameState, Grade, Intent, ViewModel } from '../../types';
import { uiText } from '../../content/text';
import { DIM, PALE, Pic, Words, surface } from '../kit';

// The crystal pouch, bottom right (inventory #97): the pouch and up to three columns of shards by grade with their counts,
// the lowest grades folded into the first column so the three brightest keep their own. A click opens the grave.

export const POUCH_W = 336;
export const POUCH_H = 118;
const COLS = 3;
const GRADES: readonly Grade[] = ['dull', 'clear', 'bright', 'blazing', 'royal', 'impossible'];

export class Pouch {
  private readonly shards: Pic[] = [];
  private readonly nums: Words[] = [];
  private readonly words: Words[] = [];
  private readonly none: Words;
  private readonly count = new Array<number>(GRADES.length).fill(0);
  /** The counts shown, as one key: the columns are rewritten only when it changes. */
  private key = -1;
  private state: Readonly<GameState> | null = null;

  constructor(anchor: HTMLElement, send: (i: Intent) => void) {
    const b = surface(anchor, 'slab', -POUCH_W, -POUCH_H, POUCH_W, POUCH_H, 'hg-hit');
    b.addEventListener('click', () => send({ kind: 'focus', focus: { place: 'grave' } }));
    new Pic(b, 56, 58, 'pouch');
    for (let i = 0; i < COLS; i++) {
      const x = 108 + i * 74;
      this.shards.push(new Pic(b, x, 0, 'pouch.dull'));
      this.nums.push(new Words(b, x + 28, 24, 34, PALE).num());
      this.words.push(new Words(b, x + 26, 72, 17, DIM));
    }
    this.none = new Words(b, 120, 46, 22, DIM);
    this.none.set(uiText('hud.noCrystals'));
  }

  frame(vm: ViewModel): void {
    if (vm.fresh.length === 0 && vm.state === this.state) return;
    this.state = vm.state;
    const count = this.count.fill(0), cs = vm.state.crystals;
    for (const id in cs) {
      const c = cs[id]!;
      if ('pouch' in c.at) count[GRADES.indexOf(c.grade)]!++;
    }
    let key = 0;
    for (const n of count) key = key * 1000 + n;
    if (key === this.key) return;
    this.key = key;
    // the brightest grades held, brightest last; anything below the third folds into the first column
    const held: number[] = [];
    for (let g = 0; g < GRADES.length; g++) if (count[g]! > 0) held.push(g);
    const first = Math.max(0, held.length - COLS);
    let folded = 0;
    for (let j = 0; j <= first && j < held.length; j++) folded += count[held[j]!]!;
    const cols = held.slice(first);
    for (let i = 0; i < COLS; i++) {
      const g = cols[i];
      this.shards[i]!.on(g !== undefined);
      if (g === undefined) {
        this.nums[i]!.set('');
        this.words[i]!.set('');
        continue;
      }
      this.shards[i]!.show(`pouch.${GRADES[g]}`);
      this.nums[i]!.set(String(i === 0 ? folded : count[g]!));
      this.words[i]!.set(uiText(`grade.${GRADES[g]}`));
    }
    this.none.el.hidden = cols.length > 0;
  }
}
