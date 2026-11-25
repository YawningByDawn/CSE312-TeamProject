import type { GameState, ViewModel } from '../types';

// What the sim says moves only with the state: another run, a tick, or an action's events this frame. A layer that
// reads the rules (visibility, hold) reads them again only then, so a still world asks the rules nothing.

export class StateSeen {
  private state: Readonly<GameState> | null = null;
  private tick = -1;

  /** Whether the state may have moved since the last call. */
  moved(vm: ViewModel): boolean {
    if (vm.state === this.state && vm.state.tick === this.tick && vm.fresh.length === 0) return false;
    this.state = vm.state;
    this.tick = vm.state.tick;
    return true;
  }
}
