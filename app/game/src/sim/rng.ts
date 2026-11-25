/**
 * Seeded PRNG (mulberry32). The state is a single uint32 stored inside
 * `GameState.rng`, so a saved game resumes the exact same random stream.
 *
 * All helpers advance `r.s` in place; callers only ever pass the rng of a
 * draft state that `applyAction` / `endTurn` has already cloned.
 */
import type { RngState } from '../types';

/** Mix an arbitrary integer seed into a non-zero uint32 starting state. */
export function seedRng(seed: number): RngState {
  let h = (Math.floor(seed) ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return { s: h === 0 ? 0x6d2b79f5 : h };
}

/** Next uint32. */
export function nextU32(r: RngState): number {
  r.s = (r.s + 0x6d2b79f5) >>> 0;
  let t = r.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}

/** Uniform float in [0, 1). */
export function rand(r: RngState): number {
  return nextU32(r) / 4294967296;
}

/** Uniform integer in [lo, hi] inclusive. */
export function randInt(r: RngState, lo: number, hi: number): number {
  return lo + Math.floor(rand(r) * (hi - lo + 1));
}

/** True with probability p. */
export function chance(r: RngState, p: number): boolean {
  return rand(r) < p;
}

/** Uniform pick; undefined for an empty list. */
export function pick<T>(r: RngState, items: readonly T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(rand(r) * items.length)];
}

/** Weighted pick; items with weight ≤ 0 are never chosen. */
export function weightedPick<T>(r: RngState, items: readonly T[], weight: (t: T) => number): T | undefined {
  let total = 0;
  for (const it of items) total += Math.max(0, weight(it));
  if (total <= 0) return undefined;
  let roll = rand(r) * total;
  for (const it of items) {
    const w = Math.max(0, weight(it));
    if (w <= 0) continue;
    if (roll < w) return it;
    roll -= w;
  }
  // Floating-point fallthrough: return the last positive-weight item.
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i] as T;
    if (weight(it) > 0) return it;
  }
  return undefined;
}

/** Fisher–Yates shuffle into a new array. */
export function shuffled<T>(r: RngState, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand(r) * (i + 1));
    const a = out[i] as T;
    out[i] = out[j] as T;
    out[j] = a;
  }
  return out;
}
