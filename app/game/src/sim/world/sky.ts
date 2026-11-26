/** The calendar and the weather (#51, #52): which day of the week it is, and the weather at any tick. */
import { WEEK, type DayDef } from '../../content/calendar';
import { dayOf, sinceDawn } from '../../content/clock';
import { COLD_FOR, WEATHER_DAY } from '../../content/day';
import { COLD_DAWN_CHANCE, MARKOV, REGIMES, WIND, type Regime } from '../../content/weather';
import type { Tick, Weather } from '../../types';
import { K, keyed } from './draw';

/** The day of the week: the opening night and the first day are the week's first work day. */
export const calendarOf = (day: number): DayDef => WEEK[(Math.max(1, day) - 1) % WEEK.length]!;

/** Day `d`'s regime after the day before's `r`. */
export function nextRegime(seed: number, d: number, r: Regime): Regime {
  const row = MARKOV[r];
  let u = keyed(seed, K.regime, d);
  let i = 0;
  while (i < row.length - 1 && u >= row[i]!) u -= row[i++]!;
  return REGIMES[i]!;
}

/** The walk so far for one seed: `walk[d]` is day d's regime. */
const walked = { seed: NaN, walk: [] as Regime[] };
/** The day's regime: a Markov walk from a fair first day. */
export function regimeOf(seed: number, day: number): Regime {
  if (walked.seed !== seed) { walked.seed = seed; walked.walk = ['fair', 'fair']; }
  const w = walked.walk;
  while (w.length <= day) w.push(nextRegime(seed, w.length, w[w.length - 1]!));
  return w[day]!;
}

/** Every weather the day holds at some hour. */
export function dayWeathers(seed: number, day: number, r: Regime = regimeOf(seed, day)): Weather[] {
  const spells = WEATHER_DAY[r];
  const out: Weather[] = [spells[0]!.kind];
  if (day > 0 && keyed(seed, K.sky, day, 0) < COLD_DAWN_CHANCE[r]) out.push('cold');
  for (let i = 1; i < spells.length; i++) if (keyed(seed, K.sky, day, 2 * i) < spells[i]!.p) out.push(spells[i]!.kind);
  return out;
}

/** The spell of the day's regime at a tick: a cold dawn first (-1), then the regime's spells as their hours come. */
export function spellAt(seed: number, t: Tick): number {
  const day = dayOf(t);
  const x = sinceDawn(t);
  const r = regimeOf(seed, day);
  if (day > 0 && keyed(seed, K.sky, day, 0) < COLD_DAWN_CHANCE[r] && x < COLD_FOR[0] + (COLD_FOR[1] - COLD_FOR[0]) * keyed(seed, K.sky, day, 1)) return -1;
  const spells = WEATHER_DAY[r];
  let at = 0;
  for (let i = 1; i < spells.length; i++) {
    const sp = spells[i]!;
    if (keyed(seed, K.sky, day, 2 * i) >= sp.p) continue;
    if (x >= sp.from + (sp.to - sp.from) * keyed(seed, K.sky, day, 2 * i + 1)) at = i;
  }
  return at;
}

export function weatherAt(seed: number, t: Tick): Weather {
  const i = spellAt(seed, t);
  return i < 0 ? 'cold' : WEATHER_DAY[regimeOf(seed, dayOf(t))][i]!.kind;
}

/**
 * The way the wind blows at a tick, in radians (town frame: 0 east, a quarter turn south): the prevailing heading's
 * wander, turned by the spell's veer and its own jitter.
 */
export function windAt(seed: number, t: Tick): number {
  const day = dayOf(t), x = (day + sinceDawn(t) / 24) / WIND.days, i = Math.floor(x);
  const a = keyed(seed, K.wind, i), u = a + (keyed(seed, K.wind, i + 1) - a) * (x - i);
  const sp = spellAt(seed, t);
  const turn = (sp < 0 ? 0 : WEATHER_DAY[regimeOf(seed, day)][sp]!.veer ?? 0) + (keyed(seed, K.veer, day, sp + 1) - 0.5) * WIND.jitter;
  // from the west (compass 270) is blowing east (0)
  return ((WIND.from - 270 + (u - 0.5) * WIND.wander + turn) * Math.PI) / 180;
}
