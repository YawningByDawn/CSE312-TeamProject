import type { GameState, Intent, Query, Reason, ViewModel } from '../../types';
import { BALANCE } from '../../content/balance';
import { uiText } from '../../content/text';
import { maxIchor } from '../../sim/core';
import { DIM, INK, PALE, Pic, VIOLET, Words, row, surface } from '../kit';

// The god's corner, top left (inventory #95, docs/style.md §7): the grave crystal filling as Hunger falls, rank as its
// lit facets; Hunger's word on a hide tab with its value and groove; Malice's word, value and groove; Ichor and Nether
// with what comes in a night. A click opens the stats menu. Under it the goal in plain words; a click goes there.

export const GOD_W = 372;
export const GOD_H = 164;
const GOAL_H = 42;
const FILL_STEPS = 20;
const FACETS = 5;
const HUNGER_X = 128, HUNGER_Y = 66, HUNGER_W = 228;
const MALICE_X = 246, MALICE_Y = 98, MALICE_W = 110;

/** Where a goal's click goes: a place to look at, or the stats menu (a rank is grown, not visited). */
const GOAL_AT: Record<string, Intent> = {
  'goal.rootPithead': { kind: 'focus', focus: { place: 'pithead' } },
  'goal.vault': { kind: 'focus', focus: { place: 'vault' } },
  'goal.rank': { kind: 'menu', menu: 'stats' },
};

export class God {
  private readonly box: HTMLDivElement;
  private readonly grave: Pic;
  private readonly facets: Pic[] = [];
  private readonly hungerWord: Words;
  private readonly hungerNum: Words;
  private readonly hungerTop: Words;
  private readonly hungerEmpty: Pic;
  private readonly hungerFull: Pic;
  private readonly maliceWord: Words;
  private readonly maliceNum: Words;
  private readonly maliceFull: Pic;
  private readonly ichor: Words;
  private readonly ichorTop: Words;
  private readonly nether: Words;
  private readonly perNight: Words;
  private readonly goalBox: HTMLDivElement;
  private readonly goal: Words;
  private goalKey = '';
  /** The last scalars shown: the frame compares these and touches nothing when none moved. */
  private hunger = -1;
  private malice = -1;
  private level = -1;
  private nethers = -1;
  private state: Readonly<GameState> | null = null;

  constructor(anchor: HTMLElement, send: (i: Intent) => void, private readonly q: Query) {
    this.box = surface(anchor, 'slab', 0, 0, GOD_W, GOD_H, 'hg-hit');
    this.box.addEventListener('click', () => send({ kind: 'menu', menu: 'stats' }));
    const b = this.box;
    this.grave = new Pic(b, 62, 66, 'grave.0');
    for (let i = 0; i < FACETS; i++) this.facets.push(new Pic(b, 62, 66, `grave.facet.${i}`));
    surface(b, 'parch', 124, 12, 150, 44);
    this.hungerWord = new Words(b, 124, 22, 28, INK, 'center', 150);
    const hr = row(b, 284, 16);
    this.hungerNum = new Words(hr, 0, 0, 28, PALE).num();
    this.hungerTop = new Words(hr, 0, 0, 17, DIM);
    this.hungerTop.set(uiText('hud.outOf', { n: 100 }));
    this.hungerEmpty = new Pic(b, HUNGER_X, HUNGER_Y, 'groove.hunger.violet.empty');
    this.hungerFull = new Pic(b, HUNGER_X, HUNGER_Y, 'groove.hunger.violet.full');
    for (const m of [BALANCE.satedBelow, BALANCE.starvingAt]) new Pic(b, HUNGER_X + (m / 100) * HUNGER_W, HUNGER_Y, 'groove.notch');
    const mr = row(b, 128, 86);
    this.maliceWord = new Words(mr, 0, 0, 19, PALE);
    this.maliceNum = new Words(mr, 0, 0, 24, PALE).num();
    new Pic(b, MALICE_X, MALICE_Y, 'groove.malice.blood.empty');
    this.maliceFull = new Pic(b, MALICE_X, MALICE_Y, 'groove.malice.blood.full');
    for (const m of [BALANCE.maliceRestlessAt, BALANCE.seethingAt]) new Pic(b, MALICE_X + (m / 100) * MALICE_W, MALICE_Y, 'groove.notch');
    new Pic(b, 26, 140, 'ichor');
    const ir = row(b, 40, 128);
    new Words(ir, 0, 0, 17, DIM).set(uiText('hud.ichor'));
    this.ichor = new Words(ir, 0, 0, 22, PALE).num();
    this.ichorTop = new Words(ir, 0, 0, 17, DIM);
    new Pic(b, 160, 140, 'nether');
    const nr = row(b, 178, 122);
    this.nether = new Words(nr, 0, 0, 28, VIOLET).num();
    this.perNight = new Words(nr, 0, 0, 17, DIM);
    this.goalBox = surface(anchor, 'parch', 0, GOD_H + 12, GOD_W, GOAL_H, 'hg-hit');
    this.goal = new Words(this.goalBox, 0, 11, 20, INK, 'center', GOD_W);
    this.goalBox.addEventListener('click', () => {
      const to = GOAL_AT[this.goalKey];
      if (to) send(to);
    });
  }

  /** Each frame: scalars compared; the derived numbers (Nether a night, Ichor's top, the goal) only when the rules moved. */
  frame(vm: ViewModel): void {
    const s = vm.state, g = s.god;
    if (g.hunger !== this.hunger) {
      this.hunger = g.hunger;
      const word = this.q.urge(s, 'hunger');
      this.hungerWord.set(uiText(`urge.hunger.${word}`));
      this.hungerNum.set(String(Math.round(g.hunger)));
      this.grave.show(`grave.${Math.round((1 - Math.min(100, g.hunger) / 100) * FILL_STEPS)}`);
      const tone = word === 'starving' || word === 'ravenous' ? 'blood' : 'violet';
      this.hungerEmpty.show(`groove.hunger.${tone}.empty`);
      this.hungerFull.show(`groove.hunger.${tone}.full`);
      this.hungerFull.fill(Math.min(100, g.hunger) / 100, HUNGER_W);
    }
    if (g.malice !== this.malice) {
      this.malice = g.malice;
      this.maliceWord.set(uiText(`urge.malice.${this.q.urge(s, 'malice')}`));
      this.maliceNum.set(String(Math.round(g.malice)));
      this.maliceFull.fill(Math.min(100, g.malice) / 100, MALICE_W);
    }
    if (g.level !== this.level) {
      this.level = g.level;
      for (let i = 0; i < FACETS; i++) this.facets[i]!.on(i < g.level);
    }
    if (g.nether !== this.nethers) {
      this.nethers = g.nether;
      this.nether.set(String(Math.floor(g.nether)));
    }
    if (vm.fresh.length > 0 || s !== this.state) {
      this.state = s;
      this.ichor.set(String(Math.round(g.ichor)));
      this.ichorTop.set(uiText('hud.outOf', { n: maxIchor(s) }));
      this.perNight.set(uiText('hud.netherNight', { n: Math.round(this.q.stats(s).nether) }));
      this.showGoal(this.q.goal(s));
    }
  }

  private showGoal(r: Reason): void {
    this.goalKey = r.key;
    this.goal.set(uiText(r.key, r.slots));
  }
}
