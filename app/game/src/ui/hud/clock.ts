import type { Intent, Query, ViewModel } from '../../types';
import { DAY_PART_HOUR } from '../../content/clock';
import { WEEK } from '../../content/calendar';
import { uiText } from '../../content/text';
import { DIM, PALE, Pic, Words, attr, row, surface } from '../kit';

// The clock, bottom right (inventory #98, LIVE): the sun's dial through the day and the moon by night, the weekday and
// the day, the weather, the action points refilling as lit shards, and the pause: a click (or Space) holds the clock.
// It changes on the hour, on a whole action point and on a new day: never per frame.

export const CLOCK_W = 340;
export const CLOCK_H = 120;
const DIAL_STEPS = 24;
/** The sun is up from dawn to night: the dial fills over those hours. */
const SUN_HOURS = DAY_PART_HOUR.night - DAY_PART_HOUR.dawn;
/** The most action points a cost tab shows. */
const AP_TABS = 8;

export class Clock {
  private readonly box: HTMLDivElement;
  private readonly dial: Pic;
  private readonly weather: Pic;
  private readonly apMax: Pic;
  private readonly apLit: Pic;
  private readonly dayLine: Words;
  private readonly weekday: Words;
  private readonly apWords: Words;
  private hour = -1;
  private day = -1;
  private ap = -1;
  private top = -1;
  private paused: boolean | null = null;

  constructor(anchor: HTMLElement, send: (i: Intent) => void, private readonly q: Query, paused: () => boolean) {
    this.box = surface(anchor, 'violet', -CLOCK_W, -CLOCK_H, CLOCK_W, CLOCK_H, 'hg-hit');
    this.box.addEventListener('click', () => send({ kind: 'pause', paused: !paused() }));
    const b = this.box;
    this.dial = new Pic(b, 60, 60, 'moon');
    const dr = row(b, 116, 14);
    this.dayLine = new Words(dr, 0, 0, 24, PALE);
    this.weekday = new Words(dr, 0, 0, 17, DIM);
    this.apMax = new Pic(b, 108, 42, 'card.cost.1');
    this.apMax.el.style.filter = 'grayscale(1) brightness(0.45)';
    this.apLit = new Pic(b, 108, 42, 'card.cost.1');
    this.apWords = new Words(b, 118, 92, 17, DIM);
    this.weather = new Pic(b, CLOCK_W - 40, 74, 'weather.clear');
  }

  frame(vm: ViewModel): void {
    const s = vm.state, q = this.q;
    const hour = Math.floor(q.hour(s.tick));
    if (hour !== this.hour) {
      this.hour = hour;
      const up = hour - DAY_PART_HOUR.dawn;
      this.dial.show(up >= 0 && up < SUN_HOURS ? `sun.${Math.round((up / SUN_HOURS) * DIAL_STEPS)}` : 'moon');
      // clear weather says nothing: no glyph
      this.weather.on(s.weather !== 'clear');
      this.weather.show(`weather.${s.weather === 'cold' ? 'coldDawn' : s.weather}`);
    }
    const day = q.day(s.tick);
    if (day !== this.day) {
      this.day = day;
      this.dayLine.set(uiText('hud.day', { n: Math.max(1, day) }));
      this.weekday.set(uiText(`day.${(Math.max(1, day) - 1) % WEEK.length}.name`));
    }
    const g = s.god, ap = Math.floor(g.ap), top = Math.min(AP_TABS, g.apMax);
    if (ap !== this.ap || top !== this.top) {
      this.ap = ap;
      this.top = top;
      this.apMax.on(top > 0);
      if (top > 0) this.apMax.show(`card.cost.${top}`);
      this.apLit.on(ap > 0);
      if (ap > 0) this.apLit.show(`card.cost.${Math.min(top, ap)}`);
      this.apWords.set(uiText('hud.ap', { n: ap }));
    }
    if (vm.paused !== this.paused) {
      this.paused = vm.paused;
      attr(this.box, 'title', uiText(vm.paused ? 'hud.resume' : 'hud.pause'));
    }
  }
}
