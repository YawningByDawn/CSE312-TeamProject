import type { Focus, GameEvent, Intent, ViewModel } from '../../types';
import { TPH } from '../../content/clock';
import { THREAT_SLOTS } from '../../content/threats';
import { uiText } from '../../content/text';
import { line } from '../panels/art';
import { BLOOD, INK, PALE, Words, attr, div, surface } from '../kit';
import { GOD_H } from './god';
import { POWERS_H, POWERS_W } from './powers';

// The feed (inventory #92, 103). The day's notes one at a time, each over where it happened (the view's point of the
// person or place, followed as it moves), or on a line under the goal when that is not on screen; replaced by the next,
// never a list: a heavier note stands longer and waits its turn (at most three wait), a light one is dropped while
// others wait; a click looks at where it happened. Under the powers, a strip for each move a power has announced and the hours
// until it lands, nearest first; a click looks at its target. Each writes only when what it shows changes.

/** Under the god's corner and the goal. */
const FEED_Y = GOD_H + 12 + 42 + 12;
const FEED_W = 560;
/** A note standing over a thing clears its head by this much. */
const LIFT = 6;
/** Seconds a note stands by its weight. */
const STAND = [3.2, 4.6, 6.5];
const WAITING = 3;
const WARNINGS = 4;

interface Note { text: string; weight: number; at: Focus }

/** How much a note matters: a life line or the day's weather 0, a gain or loss of a thing 1, a person, a power, a find 2. */
function weight(e: GameEvent): number {
  if (e.kind === 'story') return e.story === 'life' || e.story === 'day' ? 0 : 2;
  if (e.kind === 'weather') return 0;
  return e.kind === 'lost' || e.kind === 'turned' || e.kind === 'suspicion' || e.kind === 'threat' || e.kind === 'found' ? 2 : 1;
}

export class Feed {
  private readonly box: HTMLDivElement;
  private readonly warns: HTMLDivElement;
  private wait: Note[] = [];
  private cur: (Note & { until: number }) | null = null;
  private warnKey = '';
  private hour = -1;
  /** the note's size, where it stands, and the view's point */
  private readonly size = { w: 0, h: 0 };
  private readonly stands = { x: 0, y: FEED_Y };
  private readonly pt = { x: 0, y: 0 };

  /** `where`: the view's screen point of a thing, in this anchor's frame (false when it is not on screen). */
  constructor(anchor: HTMLElement, right: HTMLElement, private readonly send: (i: Intent) => void, private readonly where: (at: Focus, out: { x: number; y: number }) => boolean) {
    this.box = div(anchor, 'hg-b hg-hit', 0, FEED_Y);
    this.box.addEventListener('click', () => { if (this.cur?.at) this.send({ kind: 'focus', focus: this.cur.at }); });
    this.warns = div(right, 'hg-b', -POWERS_W, POWERS_H + 12);
  }

  frame(vm: ViewModel): void {
    for (const e of vm.fresh) {
      if (!e.note) continue;
      const n: Note = { text: uiText(e.note.key, e.note.slots), weight: weight(e), at: e.unit ? { unit: e.unit } : e.place ? { place: e.place } : null };
      if (n.weight === 0 && (this.wait.length > 0 || (this.cur && this.cur.weight > 0 && vm.time < this.cur.until))) continue;
      this.wait.push(n);
      if (this.wait.length > WAITING) {
        const light = this.wait.findIndex((w) => w.weight < 2);
        this.wait.splice(light < 0 ? 0 : light, 1);
      }
    }
    if (this.cur && vm.time >= this.cur.until) this.show(null);
    if (!this.cur && this.wait.length > 0) {
      const n = this.wait.shift()!;
      this.show({ ...n, until: vm.time + STAND[n.weight]! });
    }
    if (this.cur) this.place(this.cur.at);
    this.warnings(vm);
  }

  /** The note stands over where it happened while that is on screen, else on its line under the goal. */
  private place(at: Focus): void {
    const on = at !== null && this.where(at, this.pt);
    const x = on ? Math.round(this.pt.x - this.size.w / 2) : 0, y = on ? Math.round(this.pt.y - this.size.h - LIFT) : FEED_Y;
    if (x === this.stands.x && y === this.stands.y) return;
    this.stands.x = x;
    this.stands.y = y;
    this.box.style.left = `${x}px`;
    this.box.style.top = `${y}px`;
  }

  private show(n: (Note & { until: number }) | null): void {
    this.cur = n;
    this.box.replaceChildren();
    if (!n) return;
    const w = Math.min(FEED_W, 40 + n.text.length * 8.4), rows = n.text.length * 8.4 > FEED_W - 40 ? 2 : 1;
    this.size.w = w;
    this.size.h = 16 + rows * 22;
    const b = div(this.box, 'hg-b hgp-in');
    surface(b, 'parch', 0, 0, w, this.size.h);
    line(b, 20, 8, w - 40, 18, INK, n.text);
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
      const strip = surface(this.warns, 'slab', 0, i * 46, POWERS_W, 40, 'hg-hit');
      new Words(strip, 0, 10, 18, hours[i]! <= 3 ? BLOOD : PALE, 'center', POWERS_W).set(uiText('warn.lands', { name: uiText(`threat.${t.kind}.name`), h: hours[i]! }));
      attr(strip, 'title', uiText(`threat.${t.kind}.lands`, THREAT_SLOTS[`threat.${t.kind}.lands`]));
      const at: Focus = s.people[t.target] ? { unit: t.target } : { place: t.target };
      strip.addEventListener('click', () => this.send({ kind: 'focus', focus: at }));
    });
  }
}
