/**
 * What an area hides (spec §14.5, DECISIONS §106; content's DISCOVERIES) is found once, for good (`found`): at dawn
 * where a follower works, or where the area has taken root. A cache's crystals reach the pouch, a seam adds to the area's
 * vein, a danger raises its power's heat, a relic's miracle comes into a free hand (with the hand full it waits).
 * A loner is made by the world where they hide; a shortcut's edge joins the world's graph.
 */
import { DISCOVERIES, DISCOVERY_NUMBERS } from '../content/discoveries';
import { addHeat, area, ev, followers, handMax, mint, type Ctx } from './core';
import { spawn } from './world';
import type { Person, PlaceId } from '../types';

/** Find what area `a` hides, if it is not found yet and can be now. */
export function discover(c: Ctx, a: PlaceId, by?: Person): void {
  const s = c.s;
  const ps = s.places[a]!;
  const d = DISCOVERIES[a]!;
  if (ps.found) return;
  if (d.kind === 'relic' && s.god.hand.length >= handMax(s)) return;
  ps.found = true;
  ps.explored = true;
  switch (d.kind) {
    case 'cache':
      for (let i = 0; i < d.crystals!; i++) mint(c, { luck: DISCOVERY_NUMBERS.cacheLuck });
      break;
    case 'seam': ps.seam = (ps.seam ?? 0) + 1; break;
    case 'danger': addHeat(c, d.heat!.track, d.heat!.amount, 'found'); break;
    case 'relic': s.god.hand.push(d.miracle!); break;
    case 'loner': spawn(s, 'loner', a); break;
    // its edge is in the world's graph once the area is found
    case 'shortcut': break;
  }
  ev(c, { kind: 'found', discovery: d.kind, place: a, ...(by ? { unit: by.id } : {}), note: { key: `discovery.${a}.text` } });
}

/** Dawn: each follower finds what the area they work in hides, and every rooted area gives up its own. */
export function discoverDawn(c: Ctx): void {
  followers(c.s, (p) => discover(c, area(p.work), p));
  for (const a in c.s.places) if (c.s.places[a]!.rooted) discover(c, a);
}
