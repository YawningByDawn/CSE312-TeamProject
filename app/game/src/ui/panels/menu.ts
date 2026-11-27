import type { Bind, Settings } from '../../types';
import { bound } from '../../content/keys';
import { DIM, VIOLET, Words, div } from './art';

/** A word of a menu: lit on hover or keys, a sub line under it. */
export function item(parent: HTMLElement, x: number, y: number, size: number, text: string, sub: string, act: () => void): HTMLDivElement {
  const el = div(parent, 'hg-b hg-hit', x, y);
  el.style.transition = 'transform 0.15s, color 0.15s';
  new Words(el, 0, 0, size, 'rgba(236,226,204,0.72)').set(text);
  if (sub) new Words(el, 2, size + 4, 16, DIM).set(sub);
  // the lit word's mark (Menu shows it on the lit one): always the last child
  const mark = new Words(el, -18, size * 0.28, size * 0.6, VIOLET);
  mark.set('•');
  mark.el.hidden = true;
  el.addEventListener('click', act);
  el.addEventListener('mouseenter', () => el.dispatchEvent(new Event('hgp-focus')));
  return el;
}

/** Its two binds move the lit word; confirm takes it. */
export class Menu {
  private i = 0;
  constructor(private readonly items: HTMLDivElement[], private readonly acts: (() => void)[]) {
    items.forEach((el, k) => el.addEventListener('hgp-focus', () => this.light(k)));
    this.light(0);
  }
  light(k: number): void {
    this.i = (k + this.items.length) % this.items.length;
    this.items.forEach((el, j) => {
      el.style.transform = j === this.i ? 'translateX(3px)' : '';
      (el.firstChild as HTMLElement).style.color = j === this.i ? '#f4ecdb' : 'rgba(236,226,204,0.72)';
      (el.lastChild as HTMLElement).hidden = j !== this.i;
    });
  }
  press(e: KeyboardEvent, set: Readonly<Settings>, back: Bind, next: Bind): boolean {
    if (bound(set, back, e)) this.light(this.i - 1);
    else if (bound(set, next, e)) this.light(this.i + 1);
    else if (bound(set, 'confirm', e)) this.acts[this.i]!();
    else return false;
    return true;
  }
}

