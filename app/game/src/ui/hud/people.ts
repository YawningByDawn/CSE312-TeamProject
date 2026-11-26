import type { GameState, Intent, Menu, Person, ViewModel } from '../../types';
import { uiText } from '../../content/text';
import { DIM, PALE, VIOLET, Words, surface } from '../kit';
import { cell } from '../panels/art';

// The people plate, bottom left above the pouch (DECISIONS §47.1): how many followers are yours and how many more are
// known. A click opens the characters menu; a click while it is open closes it.

export const PLATE_W = 252;
export const PLATE_H = 66;

/** The characters menu's lists: yours, those walking against you, and the fallen who kept their Devotion (a night's revival brings them back). */
export function roster(s: Readonly<GameState>): { yours: Person[]; against: Person[]; fallen: Person[] } {
  const all = Object.values(s.people), live = all.filter((p) => !p.gone);
  const walkers = new Set(s.threats.flatMap((t) => t.walkers));
  return {
    yours: live.filter((p) => p.follower), against: live.filter((p) => !p.follower && walkers.has(p.id)),
    fallen: all.filter((p) => p.gone === 'dead' && p.stats.devotion > 0),
  };
}

export class People {
  private readonly num: Words;
  private readonly sub: Words;
  private state: Readonly<GameState> | null = null;
  private menu: Menu = null;

  constructor(anchor: HTMLElement, send: (i: Intent) => void, pouchTop: number) {
    const b = surface(anchor, 'slab', 0, -pouchTop - 12 - PLATE_H, PLATE_W, PLATE_H, 'hg-hit');
    b.addEventListener('click', () => send({ kind: 'menu', menu: this.menu === 'people' ? null : 'people' }));
    b.title = uiText('hud.peopleTip');
    cell(b, 'ui', 'icon.pray', 44, 34, 0.5);
    this.num = new Words(b, 84, 8, 32, VIOLET).num();
    new Words(b, 124, 14, 20, PALE).set(uiText('hud.people'));
    this.sub = new Words(b, 84, 40, 17, DIM);
  }

  frame(vm: ViewModel): void {
    this.menu = vm.menu;
    if (vm.fresh.length === 0 && vm.state === this.state) return;
    this.state = vm.state;
    const { yours, against } = roster(vm.state);
    this.num.set(String(yours.length));
    this.sub.set(uiText(against.length ? 'hud.against' : yours.length ? 'hud.allYours' : 'hud.noOneYet', { n: against.length }));
  }
}
