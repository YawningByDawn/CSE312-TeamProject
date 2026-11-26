/** The keys the game reads (Settings, Keys): each `Bind`'s keys out of the box, in the order the Keys tab lists them. */
import type { Bind, Settings } from '../types';
import { hasText, uiText } from './text';

export const KEYS: Readonly<Record<Bind, readonly string[]>> = {
  up: ['w', 'arrowup'], down: ['s', 'arrowdown'], left: ['a', 'arrowleft'], right: ['d', 'arrowright'],
  zoomIn: ['=', '+'], zoomOut: ['-', '_'], skip: [' '], confirm: ['enter', ' '], back: ['escape'], stats: ['i'], people: ['p'],
  again: ['r'], details: ['shift'], pick1: ['1'], pick2: ['2'], pick3: ['3'], pick4: ['4'], pick5: ['5'], profiler: ['f3'],
};

export const BINDS = Object.keys(KEYS) as Bind[];
export const PICKS: readonly Bind[] = ['pick1', 'pick2', 'pick3', 'pick4', 'pick5'];

/** `e`'s key is one of `b`'s. */
export const bound = (set: Readonly<Settings>, b: Bind, e: { key: string }): boolean => set.keys[b].includes(e.key.toLowerCase());

/** The pick `e`'s key makes among `n`, or -1. */
export function pickOf(set: Readonly<Settings>, e: { key: string }, n: number): number {
  const i = PICKS.findIndex((b) => bound(set, b, e));
  return i < n ? i : -1;
}

/** A key as the player reads it: its word (`key.<key>`), or the key itself in capitals. */
export const keyName = (k: string): string => {
  const id = `key.${k === ' ' ? 'space' : k}`;
  return hasText(id) ? uiText(id) : k.toUpperCase();
};
