import type { Focus, ViewModel } from '../../types';
import { hasText, uiText } from '../../content/text';
import { area } from '../../sim/core';
import { div, surface } from '../kit';

// Tooltips (inventory #105): one tip for the whole interface. Over any part with a title its first two lines, plainly;
// the rest is its Details, shown while Shift is held or after the pointer rests a while. Over the world, a building or
// a person shows its name only. The tip is built when what it names changes, never per frame.

const DELAY = 0.35;
const DETAILS = 1.6;
const MAX_W = 380;

export class Tip {
  private readonly el: HTMLDivElement;
  private x = 0;
  private y = 0;
  /** What the tip names now: a part of the interface, or the world's hover. */
  private over: HTMLElement | null = null;
  private overText = '';
  private hover = '';
  private hoverAt: Focus = null;
  private since = 0;
  private now = 0;
  private shift = false;
  /** What is shown: its text and stage. */
  private text = '';
  private stage = 0;

  /** `k`: the interface's scale, screen px per design px. */
  constructor(root: HTMLElement, private readonly k: () => number) {
    this.el = div(root, 'hg-b hg-tip');
    this.el.hidden = true;
    window.addEventListener('pointermove', (e) => {
      this.x = e.clientX;
      this.y = e.clientY;
    });
    root.addEventListener('pointerover', (e) => this.at(e.target as HTMLElement));
    root.addEventListener('pointerout', (e) => {
      if (!(e.relatedTarget as HTMLElement | null)?.closest?.('[data-tip]')) this.over = null;
    });
    const key = (e: KeyboardEvent): void => { this.shift = e.shiftKey; };
    window.addEventListener('keydown', key);
    window.addEventListener('keyup', key);
  }

  /** The part with a tip under the pointer at `el`; the same words keep their time shown. */
  private at(el: Element | null): void {
    const t = el?.closest<HTMLElement>('[title], [data-tip]') ?? null;
    if (t?.title) {
      // the interface's own tip stands for the browser's
      t.dataset.tip = t.title;
      t.removeAttribute('title');
    }
    if (t === this.over) return;
    const text = t?.dataset.tip ?? '';
    if (text !== this.overText) this.since = this.now;
    this.over = t;
    this.overText = text;
  }

  frame(vm: ViewModel): void {
    // wall time: a tip shows over a paused game too
    this.now = performance.now() / 1000;
    // a panel built again under a resting pointer: its part there now
    if (this.over && !this.over.isConnected) this.at(document.elementFromPoint(this.x, this.y));
    if (vm.hover !== this.hoverAt) {
      this.hoverAt = vm.hover;
      this.hover = nameOf(vm.hover, vm);
      this.since = this.now;
    }
    const text = (this.over?.isConnected && this.overText) || this.hover;
    const t = this.now - this.since;
    // 0 nothing yet, 1 the two lines, 2 with the details
    const stage = !text || t < DELAY ? 0 : this.shift || t >= DETAILS ? 2 : 1;
    if (text === this.text && stage === this.stage) return;
    this.text = text;
    this.stage = stage;
    this.el.replaceChildren();
    this.el.hidden = stage === 0;
    if (stage === 0) return;
    const lines = text.split('\n'), details = stage === 2;
    const box = div(this.el, 'hg-b hg-tipbox');
    for (const [i, l] of lines.entries()) {
      if (i >= 2 && !details) break;
      div(box, `hg-tl${i >= 2 ? ' hg-tdim' : ''}`).textContent = l;
    }
    if (lines.length > 2 && !details) div(box, 'hg-tl hg-tdim').textContent = uiText('tip.details');
    // the slab under the words at their size; the tip beside the pointer, kept on the screen
    const w = Math.min(MAX_W, box.offsetWidth), hh = box.offsetHeight, k = this.k();
    this.el.insertBefore(surface(this.el, 'slab', -14, -10, w + 28, hh + 20), box);
    const sw = this.el.parentElement!.clientWidth, sh = this.el.parentElement!.clientHeight;
    const st = this.el.style;
    st.left = `${Math.max(14 * k, Math.min(this.x + 18, sw - (w + 16) * k))}px`;
    st.top = `${this.y + (26 + hh + 12) * k > sh ? this.y - (hh + 16) * k : this.y + 26}px`;
    st.transform = `scale(${k})`;
  }
}

/** The world's hover by name only: a person, or the place. */
function nameOf(f: Focus, vm: ViewModel): string {
  if (!f || vm.film || vm.title) return '';
  if ('unit' in f) return vm.state.people[f.unit]?.name ?? '';
  if ('place' in f) return uiText(hasText(`place.${f.place}.name`) ? `place.${f.place}.name` : `area.${area(f.place)}.name`);
  return '';
}

