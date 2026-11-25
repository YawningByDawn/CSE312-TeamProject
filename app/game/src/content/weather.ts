/**
 * The weather's tables (spec §5b): the daily regimes' Markov chain and each weather's rule effects at full strength.
 * The world rolls a day's slices from these; effects scale by how much of the day a weather holds.
 * Words: `weather.<id>.line`, and why for each effect, `weather.<id>.<kind>.<target>`.
 */
import type { PlaceId, Weather } from '../types';

export type WeatherEffectKind = 'strike' | 'crew' | 'notice' | 'crowd' | 'search' | 'reach' | 'whisperZone';
export interface WeatherRule {
  /** Share of outdoor people sheltering at full strength. */
  indoors: number;
  effects: readonly { kind: WeatherEffectKind; target: PlaceId | '*'; full: number }[];
}

export type Regime = 'fair' | 'grey' | 'wet' | 'foggy' | 'windy' | 'stormy';
export const REGIMES: readonly Regime[] = ['fair', 'grey', 'wet', 'foggy', 'windy', 'stormy'];

/** Rows: from; columns: to (fair, grey, wet, foggy, windy, stormy). A storm never follows a storm. */
export const MARKOV: Readonly<Record<Regime, readonly number[]>> = {
  fair: [0.46, 0.22, 0.14, 0.09, 0.07, 0.02],
  grey: [0.22, 0.27, 0.31, 0.08, 0.08, 0.04],
  wet: [0.2, 0.28, 0.34, 0.04, 0.07, 0.07],
  foggy: [0.34, 0.3, 0.12, 0.2, 0.04, 0],
  windy: [0.34, 0.24, 0.16, 0, 0.16, 0.1],
  stormy: [0.12, 0.36, 0.34, 0, 0.18, 0],
};

/**
 * The prevailing wind in compass degrees it comes from: from the west, wandering `wander` degrees across, a new heading
 * each `days` days eased toward the next; each spell of the day turns it by its `veer` (`WEATHER_DAY`) and a draw
 * `jitter` degrees across.
 */
export const WIND = { from: 270, wander: 120, days: 3, jitter: 30 } as const;

/** Chance a day opens on a cold, still dawn, by regime. */
export const COLD_DAWN_CHANCE: Readonly<Record<Regime, number>> = { fair: 0.5, grey: 0.15, wet: 0.08, foggy: 0.35, windy: 0.2, stormy: 0.05 };

/** Per kind, at full strength over a long enough spell. Values are scaled by how much of the day it holds. */
export const WEATHER_RULES: Readonly<Record<Weather, WeatherRule>> = {
  clear: { indoors: 0, effects: [] },
  overcast: { indoors: 0, effects: [] },
  drizzle: { indoors: 0.25, effects: [{ kind: 'strike', target: 'sump', full: 0.9 }] },
  rain: {
    indoors: 0.7,
    effects: [
      { kind: 'strike', target: 'lowgallery', full: 0.7 },
      { kind: 'strike', target: 'sump', full: 0.6 },
      { kind: 'crew', target: 'sump', full: 0.75 },
      { kind: 'notice', target: 'public', full: 0.85 },
      { kind: 'crowd', target: 'market', full: 0.45 },
      { kind: 'crowd', target: 'slagrows', full: 1.3 },
    ],
  },
  storm: {
    indoors: 0.95,
    effects: [
      { kind: 'strike', target: 'lowgallery', full: 0.55 },
      { kind: 'strike', target: 'sump', full: 0.45 },
      { kind: 'crew', target: 'sump', full: 0.6 },
      { kind: 'notice', target: 'public', full: 0.7 },
      { kind: 'notice', target: 'temple', full: 0.85 },
      { kind: 'crowd', target: 'market', full: 0.2 },
    ],
  },
  fog: {
    indoors: 0.1,
    effects: [
      { kind: 'search', target: '*', full: 0.6 },
      { kind: 'notice', target: 'council', full: 0.8 },
      { kind: 'notice', target: 'public', full: 0.85 },
    ],
  },
  wind: {
    indoors: 0.15,
    effects: [
      { kind: 'reach', target: '*', full: 1 },
      { kind: 'notice', target: 'public', full: 1.15 },
    ],
  },
  cold: { indoors: 0.2, effects: [{ kind: 'whisperZone', target: 'slagrows', full: 0.03 }] },
};
