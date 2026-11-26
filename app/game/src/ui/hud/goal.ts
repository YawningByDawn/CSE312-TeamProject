import type { GameState, Intent, Query, ViewModel } from '../../types';
import { uiText } from '../../content/text';
import { INK, Words, surface } from '../kit';
import { SUSP_H, SUSP_Y } from './suspicion';

// The goal in plain words, a parchment strip in the right column under the suspicion box; a click goes there.

export const GOAL_W = 372;
export const GOAL_H = 42;
export const GOAL_Y = SUSP_Y + SUSP_H + 8;

/** Where a goal's click goes: a place to look at, or the stats menu (a rank is grown, not visited). */
const GOAL_AT: Record<string, Intent> = {
  'goal.rootLift': { kind: 'focus', focus: { place: 'lift' } },
  'goal.rank': { kind: 'menu', menu: 'stats' },
};

export class Goal {
  private readonly goal: Words;
  private key = '';
  private state: Readonly<GameState> | null = null;

  constructor(anchor: HTMLElement, send: (i: Intent) => void, private readonly q: Query) {
    const b = surface(anchor, 'parch', -GOAL_W, GOAL_Y, GOAL_W, GOAL_H, 'hg-hit');
    this.goal = new Words(b, 0, 11, 20, INK, 'center', GOAL_W);
    b.addEventListener('click', () => {
      const to = GOAL_AT[this.key];
      if (to) send(to);
    });
  }

  frame(vm: ViewModel): void {
    if (vm.fresh.length === 0 && vm.state === this.state) return;
    this.state = vm.state;
    const r = this.q.goal(vm.state);
    this.key = r.key;
    this.goal.set(uiText(r.key, r.slots));
  }
}
