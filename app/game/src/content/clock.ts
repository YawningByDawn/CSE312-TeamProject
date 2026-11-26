/** The clock: one day is DAY_TICKS ticks. Time passes only where the turn says (`GameState.until`): the night by the actions taken, the day by itself. */
import type { DayPart, Tick } from '../types';

/** A tick is 1/TICK_HZ of a second of the sim's own time (what the weather's easing counts in), not of the player's. */
export const TICK_HZ = 10;
export const DAY_TICKS = 1200;

/**
 * The hour (0..24) each part of the day begins. Dawn brings the creep, Hunger and Malice; the shift its strikes;
 * shift end the count; dusk the tribute, offering, deal and ledger; night the sleepers. Tick 0 of a run is the dusk.
 */
export const DAY_PART_HOUR = { dawn: 5, shift: 6, shiftEnd: 17, dusk: 18, night: 21 } as const;

/** Ticks an hour. */
export const TPH = DAY_TICKS / 24;
/** The tick of the day (0 at midnight) each rule hour falls on. */
export const AT = {
  dawn: DAY_PART_HOUR.dawn * TPH, shift: DAY_PART_HOUR.shift * TPH, shiftEnd: DAY_PART_HOUR.shiftEnd * TPH,
  dusk: DAY_PART_HOUR.dusk * TPH, night: DAY_PART_HOUR.night * TPH,
} as const;

/** The tick of the day, 0 at midnight. */
export const tod = (t: Tick): number => (t + AT.dusk) % DAY_TICKS;
export const hourOf = (t: Tick): number => tod(t) / TPH;
/** Days begun: 0 for the opening night, 1 from the first dawn. A day runs dawn to dawn. */
export const dayOf = (t: Tick): number => Math.floor((t + AT.dusk - AT.dawn) / DAY_TICKS);
/** Hours since this day's dawn, 0..24. */
export const sinceDawn = (t: Tick): number => ((t + AT.dusk - AT.dawn) % DAY_TICKS) / TPH;
export function partOf(t: Tick): DayPart {
  const x = tod(t);
  return x < AT.dawn || x >= AT.night ? 'night' : x < AT.shift ? 'dawn' : x < AT.dusk ? 'shift' : 'dusk';
}
/** The first tick after `t` at the hour `at` (a tick of the day). */
export function nextAt(t: Tick, at: number): Tick {
  const d = (at - tod(t) + DAY_TICKS) % DAY_TICKS;
  return t + (d === 0 ? DAY_TICKS : d);
}

/** The night is the player's turn, dusk to the next dawn; the day runs dawn to dusk. */
export const NIGHT_TICKS = DAY_TICKS - (AT.dusk - AT.dawn);
export const isDay = (t: Tick): boolean => tod(t) >= AT.dawn && tod(t) < AT.dusk;
/** Real seconds the day takes to pass, dawn to dusk. */
export const DAY_SECONDS = 180;
/** Real seconds a whole night's actions take to play (an action's share of it: a third of the night a third of this). */
export const NIGHT_SECONDS = 5;
/** Ticks played a real second at tick `t`: a day played as its host at its length; a night's actions at the night's pace. */
export const playTps = (t: Tick): number => (isDay(t) ? 1 / DAY_TICK_S : NIGHT_TICKS / NIGHT_SECONDS);
/** Real seconds one tick of a played day takes: a host's work and walking are counted in these. */
export const DAY_TICK_S = DAY_SECONDS / (AT.dusk - AT.dawn);
