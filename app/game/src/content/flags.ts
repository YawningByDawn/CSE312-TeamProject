/**
 * The one place the page's query string is read (#132): `?scene=play&seed=7&mute=1`, `&fast=1`, `&prof=1`. flags.json
 * lists every switch with what it does, the queue row that decides it and the date it goes.
 */
import type TABLE from './flags.json';

export type FlagName = keyof typeof TABLE.flags;

/** The switch's value on this page load, or null when absent. */
export const flag = (name: FlagName): string | null => new URLSearchParams(location.search).get(name);

/** This page's query string, as the profiler's report names the page. */
export const pageQuery = (): string => location.search;

/** Reloads the page with the on/off switch `name` flipped. */
export function reloadFlipped(name: FlagName): void {
  const url = new URL(location.href);
  if (flag(name) === '1') url.searchParams.delete(name);
  else url.searchParams.set(name, '1');
  location.assign(url);
}
