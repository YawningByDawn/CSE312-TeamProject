/**
 * Made things (spec §7.4-7.5, vision §4; content's ITEMS, DECISIONS §111): what a worn item lends its wearer, and what
 * it gives away when a search finds it. The town's benches make them and the god gives them (`town.ts`).
 */
import { MODS } from '../content/gems';
import { ITEM, ITEMS, MOD_POWER, type ItemDef, type WornPower } from '../content/items';
import { tierOf } from './crystals';
import type { GameState, Item, Person } from '../types';

export const itemDef = (it: Readonly<Item>): ItemDef => ITEMS[it.form ?? (it.kind as Exclude<Item['kind'], 'jewel'>)]!;
const step = (s: Readonly<GameState>, it: Readonly<Item>): number => tierOf(s.crystals[it.crystal]!.grade);

/** One power an item lends: content's line (with its grade step), and for a jewel its crystal's person lines. */
export function itemPower(s: Readonly<GameState>, it: Readonly<Item>, power: WornPower): number {
  let n = 0;
  for (const w of itemDef(it).worn) if (w.power === power) n += w.value + (w.perGrade ?? 0) * step(s, it);
  if (it.kind === 'jewel') for (const m of s.crystals[it.crystal]!.mods) if (MOD_POWER[MODS[m.id]!.family ?? ''] === power) n += m.value;
  return n;
}

/** One power summed over everything a person wears. */
export function worn(s: Readonly<GameState>, p: Readonly<Person>, power: WornPower): number {
  let n = 0;
  for (const id of p.worn) n += itemPower(s, s.items[id]!, power);
  return n;
}

/** What a found item gives away: 1 + its grade step, and `curseExposure` more when cursed (all but a clean jewel). */
export function exposure(s: Readonly<GameState>, it: Readonly<Item>): number {
  const cursed = it.kind !== 'jewel' || s.crystals[it.crystal]!.mods.some((m) => m.curse);
  return 1 + step(s, it) + (cursed ? ITEM.curseExposure : 0);
}
