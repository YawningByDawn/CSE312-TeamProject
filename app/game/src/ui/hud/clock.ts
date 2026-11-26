import type { Intent, Query, ViewModel } from '../../types';
import { DAY_PART_HOUR } from '../../content/clock';
import { WEEK } from '../../content/calendar';
import { uiText } from '../../content/text';
import { DIM, PALE, Pic, Words, row, surface } from '../kit';

// The clock, bottom right (inventory #98, LIVE): the sun's dial through the day and the moon by night, the weekday and
// the day, the weather, the action points refilling as lit shards. Held down for HOLD_S it ends the day (a lit fill
// sweeps across it while held). It changes on the hour, on a whole action point and on a new day: never per frame,
// but for the fill while held.

export const CLOCK_W = 340;
export const CLOCK_H = 120;
const DIAL_STEPS = 24;
/** The sun is up from dawn to night: the dial fills over those hours. */
const SUN_HOURS = DAY_PART_HOUR.night - DAY_PART_HOUR.dawn;
/** The most action points a cost tab shows. */
const AP_TABS = 8;
/** Seconds the clock is held to end the day. */
const HOLD_S = 1;

export class Clock {
  private readonly box: HTMLDivElement;
  private readonly fill: HTMLDivElement;
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
  /** Seconds the clock has been held, or -1 when it is not. */
  private held = -1;

  constructor(anchor: HTMLElement, private readonly send: (i: Intent) => void, private readonly q: Query) {
    this.box = surface(anchor, 'violet', -CLOCK_W, -CLOCK_H, CLOCK_W, CLOCK_H, 'hg-hit');
    const b = this.box;
    this.fill = surface(b, 'violet', 0, 0, CLOCK_W, CLOCK_H);
    this.fill.style.filter = 'brightness(1.8)';
    this.release();
    b.addEventListener('pointerdown', () => { this.held = 0; });
    for (const k of ['pointerup', 'pointerleave', 'pointercancel'] as const) b.addEventListener(k, () => this.release());
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

  private release(): void {
    this.held = -1;
    this.fill.style.clipPath = 'inset(0 100% 0 0)';
  }

  frame(vm: ViewModel): void {
    if (this.held >= 0) {
      const k = (this.held += vm.dt) / HOLD_S;
      if (k >= 1) {
        this.release();
        this.send({ kind: 'endDay' });
      } else this.fill.style.clipPath = `inset(0 ${(1 - k) * 100}% 0 0)`;
    }
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
  }
}
