/** The live clock (LIVE row): the sim steps TICK_HZ times a second; one day is DAY_TICKS ticks (120 s). */
import type { DayPart, Tick } from '../types';

export const TICK_HZ = 10;
export const DAY_TICKS = 1200;

/**
 * The hour (0..24) each part of the day begins. Dawn brings the creep, Hunger and Malice; the shift its strikes;
 * shift end the count; dusk the tribute, offering, deal and ledger; night the sleepers. Tick 0 of a run is `night`.
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
export const tod = (t: Tick): number => (t + AT.night) % DAY_TICKS;
export const hourOf = (t: Tick): number => tod(t) / TPH;
/** Days begun: 0 for the opening night, 1 from the first dawn. A day runs dawn to dawn. */
export const dayOf = (t: Tick): number => Math.floor((t + AT.night - AT.dawn) / DAY_TICKS);
/** Hours since this day's dawn, 0..24. */
export const sinceDawn = (t: Tick): number => ((t + AT.night - AT.dawn) % DAY_TICKS) / TPH;
export function partOf(t: Tick): DayPart {
  const x = tod(t);
  return x < AT.dawn || x >= AT.night ? 'night' : x < AT.shift ? 'dawn' : x < AT.dusk ? 'shift' : 'dusk';
}
/** The first tick after `t` at the hour `at` (a tick of the day). */
export function nextAt(t: Tick, at: number): Tick {
  const d = (at - tod(t) + DAY_TICKS) % DAY_TICKS;
  return t + (d === 0 ? DAY_TICKS : d);
}
