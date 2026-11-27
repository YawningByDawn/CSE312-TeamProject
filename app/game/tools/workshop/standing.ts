// What is pending in the workshop's approvals, one definition for the page (dev/src/approvals.ts) and the back end (approvals.ts).
// Pure: no node imports, so the page bundles it.

export interface Ruling { at: string; status: string; note: string }
export interface Card { id: string; title?: string; created: string; closed?: boolean; session?: string }
export interface Checked { id: string; title: string; status: string; note: string }

/** The standing ruling (the newest, unless it is a clear or older than the card: a reposted card is pending again), or undefined while the card is pending. Both times are UTC. */
export function standing(rulings: Ruling[] | undefined, created: string): Ruling | undefined {
  const last = rulings?.at(-1);
  return last && last.status !== 'cleared' && last.at.slice(0, 19) >= created.slice(0, 19) ? last : undefined;
}

/** Cards not closed and with no standing ruling. */
export const pendingCount = (cards: Card[], decisions: Record<string, Ruling[]>): number =>
  cards.filter((c) => !c.closed && !standing(decisions[c.id], c.created)).length;

/** The unchecked set: cards ruled and not closed (the main session closes a card once it acts on it), grouped by session; cards with no session are `orphans`. */
export function unchecked(cards: Card[], decisions: Record<string, Ruling[]>): { sessions: Map<string, Checked[]>; orphans: Checked[] } {
  const sessions = new Map<string, Checked[]>();
  const orphans: Checked[] = [];
  for (const c of cards) {
    const r = c.closed ? undefined : standing(decisions[c.id], c.created);
    if (!r) continue;
    const line = { id: c.id, title: c.title ?? c.id, status: r.status, note: r.note };
    if (c.session) sessions.set(c.session, [...(sessions.get(c.session) ?? []), line]);
    else orphans.push(line);
  }
  return { sessions, orphans };
}

/** A message to a session: why it is sent, then a line per card, the note verbatim. */
export const message = (why: string, lines: Checked[]): string =>
  `Workshop approvals: ${why}. Your cards the owner ruled on:\n` + lines.map((r) => `- ${r.id} "${r.title}": ${r.status}` + (r.note ? `. Note: ${r.note}` : '')).join('\n');
