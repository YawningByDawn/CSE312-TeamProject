/**
 * The world's draws: the one RNG (sim/rng.ts) started from a state mixed out of the seed and a few keys, so the
 * same keys always give the same draw. The world keeps no stream of its own: a person's day is a pure function
 * of the seed, the day and who they are, and a save at dawn continues identically.
 */
import { rand } from '../rng';

const R = { s: 0 };
const mix = (h: number): number => {
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
};

/** Which draw: each use has its own key so no two uses share a number. */
export const K = {
  stat: 1, trait: 2, work: 3, home: 4, hearth: 5, name: 6, tie: 7, shift: 8, habit: 9,
  jitter: 10, crew: 11, evening: 12, shelter: 13, meal: 14, service: 15, regime: 16, sky: 17, event: 18, cast: 19, note: 20, wind: 21, veer: 22,
} as const;

/** A draw in [0, 1) keyed by the seed, a use from `K` and up to two numbers. */
export function keyed(seed: number, use: number, a = 0, b = 0): number {
  R.s = mix(mix(mix(mix(seed ^ 0x9e3779b9) ^ use) ^ a) ^ b);
  return rand(R);
}

/** A whole number in [0, n). */
export const keyedInt = (seed: number, use: number, n: number, a = 0, b = 0): number => Math.floor(keyed(seed, use, a, b) * n);

/** A person's key: their id hashed (FNV-1a). */
export function idKey(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** Pick by weights with a draw in [0, 1). */
export function weighted<T>(items: readonly (readonly [T, number])[], u: number): T {
  let total = 0;
  for (const [, w] of items) total += w;
  let x = u * total;
  for (const [it, w] of items) {
    if (x < w) return it;
    x -= w;
  }
  return items[items.length - 1]![0];
}
