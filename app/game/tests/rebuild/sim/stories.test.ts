// Story events (DECISIONS §105): a told story rests its cooldown, says its body and its outcome in words that fill;
// a choice waits as the pending story.
import { describe, expect, it } from 'vitest';
import { DAY_TICKS } from '../../../src/content/clock';
import { STORIES } from '../../../src/content/stories';
import { uiText } from '../../../src/content/text';
import { makeSim } from '../../../src/sim';
import { has, type Ctx } from '../../../src/sim/core';
import { newCrystal } from '../../../src/sim/crystals';
import { TOLD, chooseStory, storyWhy, tell } from '../../../src/sim/stories';
import { RULES } from '../../../src/sim/storyRules';
import type { GameEvent, GameState } from '../../../src/types';

function begin(): Ctx {
  const { sim } = makeSim();
  const s = sim.create(6);
  sim.act(s, { type: 'take', card: s.god.deal![0]! });
  s.tick += 7 * DAY_TICKS;
  return { s, out: [] };
}
/** A run where every story can find its cast: followers, heat, crystals, Malice. */
function rich(): Ctx {
  const c = begin();
  const s = c.s;
  const all = Object.values(s.people);
  for (const p of all.filter((x) => x.role === 'digger').slice(0, 9)) {
    Object.assign(p, { follower: true, routine: 'pray' });
    p.stats.devotion = 40;
    p.stats.intelligence = 20;
  }
  for (const f of ['council', 'temple', 'public'] as const) s.factions[f].suspicion = 30;
  for (let i = 0; i < 12; i++) newCrystal(s, { pouch: true });
  s.places.sump!.explored = true;
  return c;
}
const notes = (out: GameEvent[]): string[] => out.filter((e) => e.kind === 'story').map((e) => uiText(e.note!.key, e.note!.slots));

describe('story events', () => {
  it('every story fills its words, and each option of a choice does', () => {
    const told = new Set<string>();
    for (const id of TOLD) {
      for (const option of STORIES[id]!.choice ? [1, 2] : [0]) {
        const c = rich();
        if (!tell(c, id)) continue;
        told.add(id);
        if (option) {
          expect(c.s.pending?.kind, id).toBe('story');
          expect(storyWhy(c.s, option), `${id} ${option}`).toEqual([]);
          chooseStory(c, option);
          expect(c.s.pending).toBe(null);
        }
        // its body and its outcome (a going it causes is noticed by the gone one's ties in a note of its own)
        expect(notes(c.out.filter((e) => e.kind === 'story' && e.story === id)).length, id).toBe(2);
      }
    }
    expect(TOLD.filter((id) => !told.has(id))).toEqual([]);
  });

  it('a told story rests its cooldown; a once-a-run story never comes back', () => {
    const c = rich();
    expect(tell(c, 'omen')).toBe(true);
    expect(has(c.s, 'used', 'story:omen')!.until).toBe(c.s.tick + STORIES.omen!.cooldown! * DAY_TICKS);
    c.s.pending = null;
    expect(tell(c, 'sumpCache')).toBe(true);
    expect(has(c.s, 'used', 'story:sumpCache')!.until).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('fresh hands come once fewer than maxShare of the mine’s hands are here and not yours', () => {
    const c = begin();
    const hands = Object.values(c.s.people);
    const weight = (): number => RULES.freshHands!.weight!(c.s);
    expect(weight()).toBe(0);
    const keep = Math.ceil(STORIES.freshHands!.n.maxShare! * hands.length);
    for (const p of hands.slice(0, hands.length - keep)) p.follower = true;
    expect(weight()).toBe(0);
    hands[hands.length - keep]!.follower = true;
    expect(weight()).toBe(STORIES.freshHands!.weight);
  });
});
