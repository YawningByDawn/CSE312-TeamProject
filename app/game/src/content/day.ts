/**
 * The people's days (#48, #49): where everyone lives and what their hours hold. Hours are counted from dawn:
 * 0 is dawn (5:00), 1 the shift (6:00), 12 the count (17:00), 13 dusk, 16 night, 19 midnight, 24 the next dawn.
 */
import type { Activity, PlaceId, RoleId, Weather, Weekday } from '../types';
import { AT } from './map';
import type { Regime } from './weather';

export const DAY = {
  /** Each person's day moves by up to this many hours either way, rolled each day. */
  jitter: 0.5,
  /** Day hands: eat at home, leave for work, a meal, off at the count, an evening out, home, asleep. */
  day: { leave: 0.4, meal: 6, mealFor: 0.75, off: 12, outFor: 2, sleep: 17 },
  /** Night hands: work until dawn, home to eat and sleep, up in the afternoon, down again before dusk. */
  night: { eat: 0.6, sleep: 1.5, rise: 9.5, outFor: 1.5, leave: 12.3 },
  /** Trades of the evening (tavern, inn): up late, open from noon into the night. */
  late: { wake: 4, open: 6, close: 19.5 },
  child: { wake: 1, out: 2, eat: 7, back: 7.75, home: 13, sleep: 15 },
  elder: { wake: 1.5, well: 3, home: 6, out: 8, back: 12, sleep: 15 },
  /** A rest day out of work: wash, chapel, market, family, the well, home. */
  rest: { wake: 2, wash: 3, chapel: 4, market: 5, home: 6, well: 10, back: 12, sleep: 17 },
  /** The Flame's day service before work: at the temple in town, the shrine in the mine. */
  service: { from: 1.5, to: 3.5 },
  /** On a rest day a mine hand off the faces (the faces' crews are `CALENDAR_EFFECTS`) works with this chance. */
  restCrew: 0.5,
  /** Payday: the pit's hands draw their chits at the pit head after the count. */
  pay: 0.5,
  /** A miner eats at the pit kitchen with this chance, else on the spot. */
  pitKitchen: 0.55,
  /** Share of people with each habit (a pious one always keeps the chapel). */
  habit: { tavern: 0.35, chapel: 0.25, market: 0.4, wash: 0.2 },
  /** Chance a habit takes the evening, by weekday. */
  evening: {
    tavern: { work: 0.5, payday: 0.9, market: 0.4, flame: 0.3, rest: 0.6 },
    chapel: { work: 0.4, payday: 0.2, market: 0.3, flame: 0.9, rest: 0.5 },
    market: { work: 0.1, payday: 0.3, market: 0.8, flame: 0.1, rest: 0.4 },
    wash: { work: 0.3, payday: 0.1, market: 0.2, flame: 0.2, rest: 0.6 },
  } as Readonly<Record<'tavern' | 'chapel' | 'market' | 'wash', Readonly<Record<Weekday, number>>>>,
  /** Who goes to the Flame's service: the pious always, a chapel habit often, the rest sometimes. */
  serviceGoes: { habit: 0.7, other: 0.35 },
  /** Share of a mixed-shift town trade on nights (the mine's is `BALANCE.nightShiftShare`). */
  nightShare: { smelter: 0.3, soldier: 0.25, watchman: 0.4 } as Readonly<Partial<Record<RoleId, number>>>,
  /**
   * Trades with hours of their own on a work day: the first stretch that covers the hour (and the weekday, if it
   * names some) holds, else the common day. `at`: `work` (their place or round), `rounds` (the first `stops` of
   * their round, an hour a stop), `home`, `evening` (their evening out) or a place.
   */
  hours: {
    // the lamplighter snuffs the lamps at dawn, sleeps, mends wicks, and lights every street at dusk
    lamplighter: [
      { from: -1, to: 1.7, at: 'rounds', stops: 5 }, { from: 1.7, to: 7, at: 'home', doing: 'sleep' },
      { from: 7, to: 8, at: 'home', doing: 'eat' }, { from: 8, to: 13.7, at: 'lamphouse', doing: 'work' },
      { from: 13.7, to: 17.7, at: 'rounds' }, { from: 17.7, to: 19, at: 'evening' },
    ],
    // the baker bakes through the night so every house has bread at dawn, sells on market day, sleeps by day
    baker: [
      { from: 21, to: 25, at: 'work' }, { from: -1, to: 5, at: 'work' }, { from: 5, to: 7, at: 'market', doing: 'trade', days: ['market'] },
      { from: 5, to: 11.5, at: 'home', doing: 'sleep' }, { from: 11.5, to: 12.2, at: 'home', doing: 'eat' },
      { from: 12.2, to: 14.5, at: 'evening' }, { from: 14.5, to: 21, at: 'home', doing: 'sleep' },
    ],
    // the overseer stands at the lift for the count as the shift comes up
    overseer: [{ from: 12, to: 13.3, at: 'lift', doing: 'guard' }],
  } as Readonly<Partial<Record<RoleId, readonly Stretch[]>>>,
} as const;

/** A stretch of a trade's own hours (`DAY.hours`). */
export interface Stretch { from: number; to: number; at: PlaceId; doing?: Activity; days?: readonly Weekday[]; stops?: number }

/** Homes in each area of the town: map.json's home lots (`home:<area>:<slot>`); a household is one home. */
export const HOME_SLOTS: Readonly<Record<PlaceId, number>> = (() => {
  const n: Record<PlaceId, number> = {};
  for (const id in AT) {
    const a = /^home:([^:]+):\d+$/.exec(id)?.[1];
    if (a) n[a] = (n[a] ?? 0) + 1;
  }
  return n;
})();
/** A household holds about this many grown people (an area deals its people into this many homes, at most its slots). */
export const HEARTH_GROWN = 6;
/** The pit's hands live in the rows and by the pit head, by these weights. */
export const MINER_HOMES: readonly (readonly [PlaceId, number])[] = [['slagrows', 7], ['minehead', 3]];
/** Trades who live where they serve, in one shared house. */
export const SHARED_HOME: Readonly<Partial<Record<RoleId, PlaceId>>> = { soldier: 'barracks', priest: 'temple', acolyte: 'temple' };
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
