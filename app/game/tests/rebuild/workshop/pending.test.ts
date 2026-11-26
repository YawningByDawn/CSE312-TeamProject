import { describe, expect, it } from 'vitest';
import { pendingCount } from '../../../dev/src/approvals';

// A ruling stands only for the card it ruled on: a card reposted under the same id after a revise is pending again.

const card = (created: string) => ({ id: 'c', category: 'ui', title: '', notes: '', media: [], links: [], created, closed: false });
const revise = { at: '2026-11-26T17:56:25Z', status: 'revise', note: 'x' };

describe('the pending count', () => {
  it('a ruling holds the card it ruled on, and a repost after it is pending again', () => {
    expect(pendingCount({ items: [card('2026-11-26T17:00:00')], decisions: { c: [revise] }, ping: false })).toBe(0);
    expect(pendingCount({ items: [card('2026-11-26T18:40:54')], decisions: { c: [revise] }, ping: false })).toBe(1);
  });
});
