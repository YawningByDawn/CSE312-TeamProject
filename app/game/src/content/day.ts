/**
 * The people's days (#48, #49): where everyone lives and what their hours hold. Hours are counted from dawn:
 * 0 is dawn (5:00), 1 the shift (6:00), 12 the count (17:00), 13 dusk, 16 night, 19 midnight, 24 the next dawn.
 */
import type { Activity, PlaceId, RoleId, Weather, Weekday } from '../types';
import type { Regime } from './weather';

export const DAY = {
  /** Each person's day moves by up to this many hours either way, rolled each day. */
  jitter: 0.5,
  /**
   * Everyone works the day: eat in the bunks, leave for work, a meal, off at the count, an evening out, home, asleep
   * from `sleep` until the next dawn (nobody lies down by day).
   */
  day: { leave: 0.4, meal: 6, mealFor: 0.75, off: 12, outFor: 2, sleep: 17 },
  /** A rest day out of work: the bunks, the shrine, the bunks, the evening. */
  rest: { chapel: 3, home: 6, back: 12, sleep: 17 },
  /** The Flame's day service before work, at the shrine. */
  service: { from: 1.5, to: 3.5 },
  /** On a rest day a mine hand off the faces (the faces' crews are `CALENDAR_EFFECTS`) works with this chance. */
  restCrew: 0.5,
  /** Payday: the pit's hands draw their chits at the overseer's post after the count. */
  pay: 0.5,
  /** A miner eats at the pit kitchen with this chance, else on the spot. */
  pitKitchen: 0.55,
  /** Share of people who keep the shrine (a pious one always does). */
  habit: 0.25,
  /** Chance the shrine habit takes the evening, by weekday. */
  evening: { work: 0.4, payday: 0.2, cart: 0.3, flame: 0.9, rest: 0.5 },
  /** Who goes to the Flame's service: the pious always, a shrine habit often, the rest sometimes. */
  serviceGoes: { habit: 0.7, other: 0.35 },
  /**
   * Trades with hours of their own on a work day: the first stretch that covers the hour (and the weekday, if it
   * names some) holds, else the common day. `at`: `work` (their place or round), `rounds` (the first `stops` of
   * their round, an hour a stop), `home`, `evening` (their evening out) or a place.
   */
  hours: {
    // the overseer stands at the lift for the count as the shift comes up
    overseer: [{ from: 12, to: 13.3, at: 'lift', doing: 'guard' }],
  } as Readonly<Partial<Record<RoleId, readonly Stretch[]>>>,
} as const;

/** A stretch of a trade's own hours (`DAY.hours`). */
export interface Stretch { from: number; to: number; at: PlaceId; doing?: Activity; days?: readonly Weekday[]; stops?: number }

/** Diggers are dealt onto the faces by these weights. */
export const DIGGER_FACES: readonly (readonly [PlaceId, number])[] = [
  ['heartvein', 3], ['eastworks', 3], ['westdrift', 2], ['lowgallery', 2], ['sump', 1], ['grave', 1],
];

/**
 * A regime's day (`MARKOV` picks the regime): spells in order, the first from dawn, each later one from an hour
 * rolled in [from, to] if its chance `p` comes up. A cold dawn (`COLD_DAWN_CHANCE`) holds for `COLD_FOR` hours first.
 * `veer`: degrees the spell turns the prevailing wind (a windy day's gusts veer it, a storm backs it).
 */
export const WEATHER_DAY: Readonly<Record<Regime, readonly { kind: Weather; from: number; to: number; p: number; veer?: number }[]>> = {
  fair: [{ kind: 'clear', from: 0, to: 0, p: 1 }, { kind: 'overcast', from: 8, to: 14, p: 0.3 }],
  grey: [{ kind: 'overcast', from: 0, to: 0, p: 1 }, { kind: 'drizzle', from: 5, to: 10, p: 0.5 }, { kind: 'overcast', from: 11, to: 15, p: 0.6 }],
  wet: [{ kind: 'overcast', from: 0, to: 0, p: 1 }, { kind: 'rain', from: 1, to: 6, p: 1 }, { kind: 'drizzle', from: 9, to: 15, p: 0.6 }],
  foggy: [{ kind: 'fog', from: 0, to: 0, p: 1 }, { kind: 'overcast', from: 4, to: 8, p: 1 }],
  windy: [{ kind: 'clear', from: 0, to: 0, p: 1 }, { kind: 'wind', from: 2, to: 8, p: 1, veer: 10 }, { kind: 'overcast', from: 12, to: 16, p: 0.4, veer: 20 }],
  stormy: [{ kind: 'overcast', from: 0, to: 0, p: 1, veer: -30 }, { kind: 'storm', from: 5, to: 10, p: 1, veer: -45 }, { kind: 'rain', from: 11, to: 15, p: 1, veer: -30 }],
};
export const COLD_FOR: readonly [number, number] = [1, 3];

