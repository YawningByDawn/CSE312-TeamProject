import type { FactionId, Intent, Query, ViewModel } from '../../types';
import { DAY_PART_HOUR } from '../../content/clock';
import { WEEK } from '../../content/calendar';
import { uiText } from '../../content/text';
import { DIM, PALE, Pic, Words, surface } from '../kit';

// The clock, top left (inventory #98, LIVE): one plate. The sun's dial through the day and the moon by night with the day
// and its weekday under it and the weather beside it; to the right the three powers (inventory #96), a wick each whose
// flame stands as tall as its suspicion, its name under it, and under all one line for the hottest of them in plain
// words, and under that the night's actions left as lit shards. Held down for HOLD_S it skips the rest of the night to
// dawn (a lit fill sweeps across it while held). It changes on the hour, on a new day, on an action spent and when a
// power moves: never per frame, but for the fill while held.

// The plate's layout, design px, from its content; the margins clear the plate's cut edge.
const PAD = 26, PAD_BOTTOM = 30;
/** The dial column: the dial, then the day and its weekday centred under it. */
const DIAL_CX = 84, DIAL_CY = PAD + 36, DAY_W = 130;
/** The weather glyph, in the gap between the dial column and the powers. */
const WEATHER_X = 154, WEATHER_Y = PAD + 18;
/** The powers, a column each: a wick whose tallest flame (about 78 px) rises to the top margin, its name under it. */
const POWER_X = 221, POWER_PITCH = 74, WICK_Y = PAD + 82;
const NAME_Y = WICK_Y + 22;
const LINE_Y = NAME_Y + 36;
/** The night's actions, a row of shards (a lit one for each left) and their count in words, under the powers' line. */
const AP_Y = LINE_Y + 28, AP_TABS = 8;
export const CLOCK_W = POWER_X + 2.5 * POWER_PITCH + PAD;
export const CLOCK_H = AP_Y + 40 + PAD_BOTTOM - 8;
const DIAL_STEPS = 24;
/** The sun is up from dawn to night: the dial fills over those hours. */
const SUN_HOURS = DAY_PART_HOUR.night - DAY_PART_HOUR.dawn;
/** Seconds the clock is held to skip the night. */
const HOLD_S = 1;
const FLAME_STEPS = 10;
const ORDER: readonly FactionId[] = ['temple', 'council', 'public'];
/** The ui atlas names the powers by their old tracks. */
const TRACK: Record<FactionId, string> = { temple: 'cult', council: 'gov', public: 'public' };

export class Clock {
  private readonly box: HTMLDivElement;
  private readonly fill: HTMLDivElement;
  private readonly dial: Pic;
  private readonly weather: Pic;
  private readonly dayLine: Words;
  private readonly weekday: Words;
  private readonly flames: Pic[] = [];
  private readonly powerLine: Words;
  private readonly apMax: Pic;
  private readonly apLit: Pic;
  private readonly apWords: Words;
  private ap = -1;
  private top = -1;
  private readonly heat: number[] = [-1, -1, -1];
  private readonly level: number[] = [-1, -1, -1];
  private hour = -1;
  private day = -1;
  /** Seconds the clock has been held, or -1 when it is not. */
  private held = -1;

  constructor(anchor: HTMLElement, private readonly send: (i: Intent) => void, private readonly q: Query) {
    this.box = surface(anchor, 'violet', 0, 0, CLOCK_W, CLOCK_H, 'hg-hit');
    const b = this.box;
    this.fill = surface(b, 'violet', 0, 0, CLOCK_W, CLOCK_H);
    this.fill.style.filter = 'brightness(1.8)';
    this.release();
    b.addEventListener('pointerdown', () => { this.held = 0; });
    for (const k of ['pointerup', 'pointerleave', 'pointercancel'] as const) b.addEventListener(k, () => this.release());
    this.dial = new Pic(b, DIAL_CX, DIAL_CY, 'moon');
    this.dayLine = new Words(b, DIAL_CX - DAY_W / 2, WICK_Y, 24, PALE, 'center', DAY_W);
    this.weekday = new Words(b, DIAL_CX - DAY_W / 2, WICK_Y + 30, 17, DIM, 'center', DAY_W);
    this.weather = new Pic(b, WEATHER_X, WEATHER_Y, 'weather.clear');
    ORDER.forEach((f, i) => {
      const x = POWER_X + i * POWER_PITCH;
      new Pic(b, x, WICK_Y, `wick.${TRACK[f]}.cup`);
      this.flames.push(new Pic(b, x, WICK_Y, `wick.${TRACK[f]}.0`));
      new Words(b, x - POWER_PITCH / 2, NAME_Y, 19, PALE, 'center', POWER_PITCH).set(uiText(`power.${f}`));
    });
    this.powerLine = new Words(b, 0, LINE_Y, 18, PALE, 'center', CLOCK_W);
    this.apMax = new Pic(b, PAD, AP_Y, 'card.cost.1');
    this.apMax.el.style.filter = 'grayscale(1) brightness(0.45)';
    this.apLit = new Pic(b, PAD, AP_Y, 'card.cost.1');
    this.apWords = new Words(b, PAD + 150, AP_Y + 8, 17, DIM);
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
        this.send({ kind: 'act', action: { type: 'sleep' } });
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
    const g = s.god, ap = g.ap, top = Math.min(AP_TABS, g.apMax);
    if (ap !== this.ap || top !== this.top) {
      this.ap = ap;
      this.top = top;
      this.apMax.on(top > 0);
      if (top > 0) this.apMax.show(`card.cost.${top}`);
      this.apLit.on(ap > 0);
      if (ap > 0) this.apLit.show(`card.cost.${Math.min(top, ap)}`);
      this.apWords.set(uiText('hud.ap', { n: ap }));
    }
    this.powers(vm);
  }

  /** Each power's flame by its suspicion; the line speaks for the power at the highest level, the hotter of two at the same. */
  private powers(vm: ViewModel): void {
    const fs = vm.state.factions;
    let moved = false;
    for (let i = 0; i < ORDER.length; i++) {
      const fa = fs[ORDER[i]!];
      if (fa.suspicion === this.heat[i] && fa.level === this.level[i]) continue;
      moved = true;
      this.heat[i] = fa.suspicion;
      this.level[i] = fa.level;
      this.flames[i]!.show(`wick.${TRACK[ORDER[i]!]}.${Math.round((Math.min(100, Math.max(0, fa.suspicion)) / 100) * FLAME_STEPS)}`);
    }
    if (!moved) return;
    let top = 0;
    for (let i = 1; i < ORDER.length; i++) {
      if (this.level[i]! > this.level[top]! || (this.level[i] === this.level[top] && this.heat[i]! > this.heat[top]!)) top = i;
    }
    this.powerLine.set(uiText(`power.${ORDER[top]}.${this.level[top]}`));
  }
}
