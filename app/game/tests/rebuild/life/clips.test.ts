// The effects' recipes (src/view/life/clips.ts): every part names a cell the life atlas bakes, every card has its clip,
// and a strike's light reads by grade as the old ladder did (rays 0 / 2 / 3 / 4 / 6 / 16, ground rings 0 / 1 / 2 / 2 / 3 / 3).
import { describe, expect, it } from 'vitest';
import { BURN, CARD_CLIPS, CLIPS, FOLLOWER_EVIL, STRIKES } from '../../../src/view/life/clips';
import { CARDS } from '../../../src/content/cards';
import life from '../../../assets/life/manifest.json';

const cells = (life as { cells: Record<string, unknown> }).cells;

describe('clips', () => {
  it('names only baked cells', () => {
    const missing = [...Object.values(CLIPS), ...Object.values(CARD_CLIPS), ...STRIKES, BURN, FOLLOWER_EVIL]
      .flat().map((p) => p[0]).filter((c) => c !== '@gem' && !cells[c.endsWith('-') ? `${c}0` : c]);
    expect(missing).toEqual([]);
  });

  it('plays a clip for every card but devour (its own event plays the maw)', () => {
    for (const id of Object.keys(CARDS) as (keyof typeof CARDS)[]) expect(CARD_CLIPS[id]!.length > 0).toBe(id !== 'devour');
  });

  it('grows a strike by grade', () => {
    const rays = STRIKES.map((s) => s.filter((p) => p[0] === 'ray').reduce((n, p) => n + (p[8] ?? 1), 0));
    const rings = STRIKES.map((s) => s.filter((p) => p[0].startsWith('ring-')).length);
    expect(rays).toEqual([0, 2, 3, 4, 6, 16]);
    expect(rings).toEqual([0, 1, 2, 2, 3, 3]);
  });
});
