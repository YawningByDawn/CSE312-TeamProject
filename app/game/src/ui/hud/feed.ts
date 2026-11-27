import type { Focus, Intent, ViewModel } from '../../types';
import { TPH } from '../../content/clock';
import { THREAT_SLOTS } from '../../content/threats';
import { uiText } from '../../content/text';
import { cell } from '../panels/art';
import { BLOOD, DIM, PALE, Words, attr, div, surface } from '../kit';
import { HOST_H, HOST_W } from './hostplate';

// The feed (inventory #92, 103), the left column's events: a small dim box under the host's plate holding the latest note,
// never over the world; the tab hanging from its bottom edge opens it to the last few and shrinks it again (the settings
// keep which, across runs). A click on a note looks at where it happened. Under the box, a strip for each move a power has
// announced and the hours until it lands, nearest first; a click looks at its target. Each writes only when what it
// shows changes.

/** Under the host's plate. */
const FEED_Y = HOST_H + 12;
const FEED_W = HOST_W, PAD = 7, ROW = 25, KEPT = 5, TAB_W = 56, TAB_H = 24;
const WARN_W = 336, WARNINGS = 4;

interface Note { text: string; at: Focus }

export class Feed {
  private readonly box: HTMLDivElement;
  private readonly warns: HTMLDivElement;
  private log: Note[] = [];
  private seed = -1;
  private open: boolean | null = null;
  private dirty = false;
  private warnKey = '';
  private hour = -1;

  constructor(anchor: HTMLElement, private readonly send: (i: Intent) => void) {
    this.box = div(anchor, 'hg-b', 0, FEED_Y);
    this.warns = div(anchor, 'hg-b', 0, 0);
  }

  frame(vm: ViewModel): void {
    if (vm.state.seed !== this.seed) [this.seed, this.log, this.dirty] = [vm.state.seed, [], true];
    for (const e of vm.fresh) {
      if (!e.note) continue;
      this.log.unshift({ text: uiText(e.note.key, e.note.slots), at: e.unit ? { unit: e.unit } : e.place ? { place: e.place } : null });
      this.log.length = Math.min(this.log.length, KEPT);
      this.dirty = true;
    }
    const open = vm.settings.feedOpen;
    if (this.dirty || open !== this.open) this.draw((this.open = open));
    this.warnings(vm);
  }

  /** The box at its size: the latest note, or the last few when open, and the tab under it. */
  private draw(open: boolean): void {
    this.dirty = false;
    const rows = open ? Math.max(1, this.log.length) : 1, h = PAD * 2 + rows * ROW;
    this.box.replaceChildren();
    const b = surface(this.box, 'slab', 0, 0, FEED_W, h);
    b.style.opacity = '0.82';
    for (let i = 0; i < rows; i++) {
      const n = this.log[i];
      const w = new Words(b, 18, PAD + i * ROW + 3, 18, i === 0 ? PALE : DIM);
      w.el.classList.add('hg-cut');
      w.el.style.width = `${FEED_W - 36}px`;
      w.set(n ? n.text : uiText('feed.quiet'));
      if (n) {
        w.el.classList.add('hg-hit');
        w.el.addEventListener('click', () => { if (n.at) this.send({ kind: 'focus', focus: n.at }); });
      }
    }
    const tab = cell(this.box, 'feedtab', open ? 'tab.up' : 'tab.down', (FEED_W - TAB_W) / 2, h - 3, 0.5);
    tab.classList.add('hg-hit');
    attr(tab, 'title', uiText(open ? 'feed.shrink' : 'feed.expand'));
    tab.addEventListener('click', () => this.send({ kind: 'settings', patch: { feedOpen: !open } }));
    this.warns.style.top = `${FEED_Y + h + TAB_H + 5}px`;
  }

  /** The announced moves, nearest first; rewritten on the hour or when the list changes. */
  private warnings(vm: ViewModel): void {
    const s = vm.state, hour = Math.floor(s.tick / TPH);
    if (vm.fresh.length === 0 && hour === this.hour) return;
    this.hour = hour;
    const ts = s.threats.slice().sort((a, b) => a.lands - b.lands).slice(0, WARNINGS);
    const hours = ts.map((t) => Math.max(1, Math.ceil((t.lands - s.tick) / TPH)));
    const key = ts.map((t, i) => `${t.id}:${hours[i]}`).join();
    if (key === this.warnKey) return;
    this.warnKey = key;
    this.warns.replaceChildren();
    ts.forEach((t, i) => {
      const strip = surface(this.warns, 'slab', 0, i * 46, WARN_W, 40, 'hg-hit');
      new Words(strip, 0, 10, 18, hours[i]! <= 3 ? BLOOD : PALE, 'center', WARN_W).set(uiText('warn.lands', { name: uiText(`threat.${t.kind}.name`), h: hours[i]! }));
      attr(strip, 'title', uiText(`threat.${t.kind}.lands`, THREAT_SLOTS[`threat.${t.kind}.lands`]));
      const at: Focus = s.people[t.target] ? { unit: t.target } : { place: t.target };
      strip.addEventListener('click', () => this.send({ kind: 'focus', focus: at }));
    });
  }
}
