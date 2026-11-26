/**
 * Telling the stories (DECISIONS §11, §105; content's STORIES): at most one a roll (each dawn, each hour of the night), drawn by
 * weight among those whose cast can be found and that are not resting (`used` on `story:<id>`). A choice
 * waits as the pending story until the player answers; the rest happen at once. Each says its body, then its outcome.
 * What each story does is `storyRules.ts`.
 */
import { DAY_TICKS } from '../content/clock';
import { STAGE } from '../content/stages';
import { STORIES } from '../content/stories';
import { uiText } from '../content/text';
import { addEffect, area, ev, has, type Ctx } from './core';
import { chance, weightedPick } from './rng';
import { RULES, type Cast } from './storyRules';
import type { GameState, Pending, PlaceId, Reason, StoryId } from '../types';

type Story = Extract<Pending, { kind: 'story' }>;
const restKey = (id: StoryId): string => `story:${id}`;

function slotsOf(s: Readonly<GameState>, id: StoryId, k: Cast): Record<string, string | number> {
  const boss = s.people[STAGE.crackdownLeader];
  return {
    ...STORIES[id]!.n,
    ...(k.unit ? { name: k.unit.name } : {}),
    ...(k.unit2 ? { name2: k.unit2.name } : {}),
    ...(k.place ? { place: uiText(`area.${area(k.place)}.name`) } : {}),
    ...(boss ? { boss: boss.name } : {}),
    ...(k.count !== undefined ? { count: k.count } : {}),
  };
}

function castOf(s: Readonly<GameState>, p: { unit?: string; unit2?: string; place?: PlaceId; count?: number }): Cast {
  return {
    ...(p.unit ? { unit: s.people[p.unit]! } : {}),
    ...(p.unit2 ? { unit2: s.people[p.unit2]! } : {}),
    ...(p.place ? { place: p.place } : {}),
    ...(p.count !== undefined ? { count: p.count } : {}),
  };
}

/** Who and where a story falls, as ids. */
const at = (k: Cast): { unit?: string; place?: PlaceId } => ({ ...(k.unit ? { unit: k.unit.id } : {}), ...(k.place ? { place: k.place } : {}) });
function told(c: Ctx, id: StoryId, k: Cast, key: string): void {
  ev(c, { kind: 'story', story: id, ...at(k), note: { key: `story.${id}.${key}`, slots: slotsOf(c.s, id, k) } });
}

/** The stories the rules tell. */
export const TOLD: readonly StoryId[] = Object.keys(RULES);

/** With chance `p`, one story whose cast is found (each dawn and each hour of the night); a choice waits as the pending story. */
export function storyRoll(c: Ctx, p: number): void {
  const s = c.s;
  if (s.pending || s.phase !== 'live' || !chance(s.rng, p)) return;
  const weight = (id: StoryId): number => RULES[id]!.weight?.(s) ?? STORIES[id]!.weight;
  const pool = TOLD.filter((id) => !has(s, 'used', restKey(id)) && weight(id) > 0);
  for (let tries = 0; tries < 3 && pool.length > 0; tries++) {
    const id = weightedPick(s.rng, pool, weight)!;
    pool.splice(pool.indexOf(id), 1);
    if (tell(c, id)) return;
  }
}

/** Story `id` happens now if its cast is found: it rests its cooldown, says its body, and waits or happens. */
export function tell(c: Ctx, id: StoryId): boolean {
  const s = c.s;
  const k = RULES[id]!.cast(s);
  if (!k) return false;
  const cd = STORIES[id]!.cooldown;
  addEffect(s, 'used', restKey(id), cd === null ? Number.MAX_SAFE_INTEGER : s.tick + cd * DAY_TICKS);
  told(c, id, k, 'body');
  if (STORIES[id]!.choice) {
    s.pending = { kind: 'story', story: id, options: 2, ...(k.unit2 ? { unit2: k.unit2.id } : {}), ...(k.count !== undefined ? { count: k.count } : {}), ...at(k) };
    return true;
  }
  const what = RULES[id]!.now!(c, k);
  told(c, id, k, what ? `outcome.${what}` : 'outcome');
  return true;
}

/** The slots the pending story's words fill (its numbers, who and where), or null with no story pending. */
export function pendingSlots(s: Readonly<GameState>): Record<string, string | number> | null {
  const p = s.pending;
  return p && p.kind === 'story' ? slotsOf(s, p.story, castOf(s, p)) : null;
}

/** Why the pending story's option (1 or 2) cannot be chosen. */
export function storyWhy(s: Readonly<GameState>, option: number): Reason[] {
  if (option !== 1 && option !== 2) return [{ key: 'why.pickOne' }];
  const r = RULES[(s.pending as Story).story]!.refuse?.[option - 1]?.(s);
  return r ? [r] : [];
}

/** Answer the pending story (its why is empty): its option happens, then its outcome is told. */
export function chooseStory(c: Ctx, option: number): void {
  const p = c.s.pending as Story;
  c.s.pending = null;
  const k = castOf(c.s, p);
  const what = RULES[p.story]!.options![option - 1]!(c, k);
  told(c, p.story, k, what ? `opt${option}.outcome.${what}` : `opt${option}.outcome`);
}
