/**
 * The town's tithe (Shade; inventory #26; DECISIONS §113): at shift end your townsfolk skim it, crew by crew (those of
 * yours who live and work in the town and are not lying low, by their work place): ceil(n × `titheTown`) rolls, at most
 * `titheMaxPerGroup`, the first crew one more for each link of the crystals' road of yours. Each roll brings a stone
 * with `titheChance` (× 1 + strike rate) into the pocket of the crew's first, its carrier. The tally house counts the
 * shortfall (the tithe's worth); on a search day one of the watch searches one row or one cart line where carriers
 * are; what is not found reaches the grave.
 */
import { BALANCE } from '../content/balance';
import { GIFTS } from '../content/gifts';
import { boonYours, buildingYours } from './buildings';
import { area, cash, ev, everyone, followers, here, inMine, type Ctx } from './core';
import { bonus } from './bonus';
import { newCrystal, worth } from './crystals';
import { round1 } from './formulas';
import { worn } from './items';
import { councilEye, reckon, searchDayChance, searchEachChance, searchOne, tolerance } from './mining';
import { chance, pick } from './rng';
import type { CrystalId, GameState, Person, PlaceId } from '../types';

export function townShiftEnd(c: Ctx): void {
  if (c.s.stage !== 'shade') return;
  const carried = tithe(c);
  let short = 0;
  for (const ids of carried.values()) for (const id of ids) short += worth(c.s.crystals[id]!);
  reckon(c, 'tallyhouse', round1(short), tolerance(c.s, 0, buildingYours(c.s, 'tallyhouse'), 'tallyhouse'));
  townSearches(c);
  if (c.s.phase !== 'live') return;
  for (const [p, ids] of carried) if (here(p) && p.follower) for (const id of ids) if (p.pocket.includes(id)) cash(c, p, id, 'tithe');
}

/** Each crew of yours in the town by its work place: its carrier and its rolls (the first crew's with the road's). */
export function titheCrews(s: Readonly<GameState>): { work: PlaceId; carrier: Person; rolls: number }[] {
  const crews = new Map<PlaceId, Person[]>();
  followers(s, (p) => {
    if (p.routine === 'lieLow' || inMine(p.home) || inMine(p.work)) return;
    const crew = crews.get(p.work);
    if (crew) crew.push(p);
    else crews.set(p.work, [p]);
  });
  const road = boonYours(s, 'road').length * GIFTS.road.tithe;
  return [...crews.keys()].sort().map((work, i) => {
    const crew = crews.get(work)!;
    const rolls = Math.min(BALANCE.titheMaxPerGroup, Math.ceil(crew.length * BALANCE.titheTown)) + (i === 0 ? road : 0);
    return { work, carrier: crew[0]!, rolls };
  });
}

/** Each crew's rolls, its stones in its carrier's pocket: carrier to the stones they carry. */
function tithe(c: Ctx): Map<Person, CrystalId[]> {
  const s = c.s;
  const carried = new Map<Person, CrystalId[]>();
  for (const { carrier: u, rolls } of titheCrews(s)) {
    const odds = Math.min(0.95, BALANCE.titheChance * (1 + bonus(s, 'strikeRate') + worn(s, u, 'strikeRate') / 100));
    const luck = bonus(s, 'strikeLuck') + worn(s, u, 'strikeLuck');
    for (let i = 0; i < rolls; i++) {
      if (!chance(s.rng, odds)) continue;
      const x = newCrystal(s, { pocket: u.id }, { luck });
      u.pocket.push(x.id);
      (carried.get(u) ?? carried.set(u, []).get(u)!).push(x.id);
      ev(c, { kind: 'pocket', unit: u.id, place: u.work, crystal: x.id });
    }
  }
  return carried;
}

/**
 * On a search day one soldier of the watch (not yours) searches one row (where carriers live) or one cart line (where
 * they work): each of yours there carrying stones or worn things is searched as at the lift.
 */
function townSearches(c: Ctx): void {
  const s = c.s;
  const watch = everyone(s).some((p) => here(p) && !p.follower && councilEye(p) && !inMine(p.work));
  const carriers: Person[] = [];
  followers(s, (p) => { if (!inMine(p.home) && p.routine !== 'lieLow' && (p.pocket.length > 0 || p.worn.length > 0)) carriers.push(p); });
  if (!watch || carriers.length === 0 || !chance(s.rng, searchDayChance(s))) return;
  const rows = chance(s.rng, 0.5);
  const at = (p: Person): PlaceId => area(rows ? p.home : p.work);
  const where = pick(s.rng, [...new Set(carriers.map(at))].sort())!;
  let guard = false;
  followers(s, (g) => { if (councilEye(g) && (area(g.work) === where || area(g.home) === where)) guard = true; });
  for (const p of carriers) {
    if (at(p) !== where || !here(p) || !chance(s.rng, searchEachChance(s, p, guard, where))) continue;
    searchOne(c, p);
    if (s.phase !== 'live') return;
  }
}
