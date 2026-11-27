import type { Weather } from '../../types';

// What the weather does to a body (rig.ts): its wet, wind, cold and fog, and the easings the rig blends with.

/** The weather on the body, 0..1 each. */
export const WEATHER: Record<Weather, readonly [wet: number, wind: number, cold: number, fog: number]> = {
  clear: [0, 0, 0, 0], overcast: [0, 0.2, 0, 0], drizzle: [0.35, 0, 0, 0], rain: [0.75, 0.2, 0, 0], storm: [1, 0.9, 0, 0],
  fog: [0, 0, 0.2, 0.9], wind: [0, 0.9, 0, 0], cold: [0, 0.2, 0.9, 0],
};
export const smooth = (a: number, b: number, v: number): number => { const u = Math.min(1, Math.max(0, (v - a) / (b - a))); return u * u * (3 - 2 * u); };
export const io = (u: number): number => 0.5 - 0.5 * Math.cos(Math.PI * u);
