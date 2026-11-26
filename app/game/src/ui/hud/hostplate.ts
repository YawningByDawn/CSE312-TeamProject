import type { Focus, GameState, Intent, Person, Query, ViewModel } from '../../types';
import { uiText } from '../../content/text';
import { portrait } from '../panels/art';
import { DIM, INK, PALE, VIOLET, Pic, Words, attr, div, surface } from '../kit';

// The possessed host, top left: their face, name and trade, their HP as a groove, and the body stats and Devotion and
// Resistance as six numbers. A click opens them (their panel, where the player may swap to another on the day's list) and a
// click while it is open closes it. Always shown once the run is on: by night, the last host. Each number is written only when it moves.

export const HOST_W = 372;
export const HOST_H = 184;
const HP_X = 132, HP_Y = 102, HP_W = 228;
const STATS = ['strength', 'dexterity', 'intelligence', 'endurance', 'devotion', 'resistance'] as const;
const COL = 116;

export class HostPlate {
  private readonly box: HTMLDivElement;
  private readonly face: HTMLDivElement;
  private readonly name: Words;
  private readonly role: Words;
  private readonly hp: Words;
  private readonly full: Pic;
  private readonly nums: Words[] = [];
  private id = '';
  private focus: Focus = null;

  constructor(anchor: HTMLElement, send: (i: Intent) => void, private readonly q: Query) {
    this.box = surface(anchor, 'slab', 0, 0, HOST_W, HOST_H, 'hg-hit');
    this.box.hidden = true;
    const b = this.box;
    attr(b, 'title', uiText('hud.hostTip'));
    b.addEventListener('click', () => send({ kind: 'focus', focus: this.focus && 'unit' in this.focus && this.focus.unit === this.id ? null : { unit: this.id } }));
    this.face = div(b, 'hg-b');
    surface(b, 'parch', 128, 14, 228, 42);
    this.name = new Words(b, 128, 22, 26, INK, 'center', 228);
    this.role = new Words(b, HP_X, 66, 17, DIM);
    new Pic(b, HP_X, HP_Y, 'groove.hunger.violet.empty');
    this.full = new Pic(b, HP_X, HP_Y, 'groove.hunger.violet.full');
    this.hp = new Words(b, HP_X, 116, 17, PALE).num();
    STATS.forEach((k, i) => {
      const x = 20 + (i % 3) * COL, y = 138 + Math.floor(i / 3) * 26;
      new Words(b, x, y + 3, 15, DIM).set(uiText(`stat.short.${k}`));
      this.nums.push(new Words(b, x + 50, y, 20, VIOLET).num());
    });
  }

  frame(vm: ViewModel): void {
    this.focus = vm.focus;
    const s = vm.state, p = s.host === null ? null : s.people[s.host]!;
    this.box.hidden = !p;
    if (!p) return;
    if (p.id !== this.id) this.who(s, p);
    const top = Math.round(this.q.maxHp(p));
    this.hp.set(uiText('host.hp', { hp: Math.round(p.stats.hp), max: top }));
    this.full.fill(Math.min(1, p.stats.hp / top), HP_W);
    STATS.forEach((k, i) => this.nums[i]!.set(String(Math.round(k === 'resistance' ? p.resistance : p.stats[k]))));
  }

  private who(s: Readonly<GameState>, p: Readonly<Person>): void {
    this.id = p.id;
    this.face.replaceChildren();
    portrait(this.face, s, p, 64, 74, 96);
    this.name.set(p.name);
    this.role.set(uiText(`role.${p.role}.name`));
  }
}
