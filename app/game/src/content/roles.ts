/**
 * Every person's trade (#48): one table for the rules and the days. ~60 mine hands in 23 trades. `count` is the
 * trade's headcount in the society, the named people included.
 * Words: `role.<id>.name`, `.plural`, `.line`.
 */
import type { FactionId, PlaceId, RoleId, Standing } from '../types';

export interface RoleDef {
  standing: Standing;
  /** Contribution to base Resistance. */
  resistance: number;
  /** Bias added to the body stats' roll (content's STATS): [strength, dexterity, intelligence, endurance]. */
  bias: readonly [number, number, number, number];
  /** The power they serve: a watcher's eyes, an Elite's faction (turning them cools it by `BALANCE.eliteTurnCool`). */
  serves: FactionId | null;
  /** Watches for the power they serve: pushes colour back, notices, searches. */
  watches: boolean;
  /** What the rules count of their work: a digger strikes, a hauler pushes the carts, a sorter weighs the count. */
  labour: 'dig' | 'haul' | 'sort' | null;
  /** Candidate work places. */
  work: readonly PlaceId[];
  /** Walks these places in order during work. */
  rounds: readonly PlaceId[] | null;
  count: number;
  /** Extra areas of whisper reach a follower of this trade brings. */
  reach: number;
  /** What the trade owes a day when the host is one of them (OVERHAUL): a miner's ores delivered to the drop. 0: no quota. */
  quota: number;
}

type Opt = Partial<Pick<RoleDef, 'standing' | 'serves' | 'watches' | 'labour' | 'rounds' | 'reach' | 'quota'>>;
const r = (resistance: number, bias: RoleDef['bias'], work: readonly PlaceId[], count: number, o: Opt = {}): RoleDef => ({
  standing: 'mortal', resistance, bias, serves: null, watches: false, labour: null, work, rounds: null, count, reach: 0, quota: 0, ...o,
});

const FACES: PlaceId[] = ['heartvein', 'eastworks', 'westdrift', 'lowgallery', 'sump', 'grave'];
const MINE_ROUND: PlaceId[] = ['westdrift', 'cartway', 'heartvein', 'eastworks', 'sorting', 'lowgallery'];

export const ROLES: Readonly<Record<RoleId, RoleDef>> = {
  digger: r(0, [0, 0, 0, 0], FACES, 4, { labour: 'dig', quota: 3 }),
  hauler: r(5, [2, 2, 0, 2], ['cartway', 'lowgallery', 'eastworks'], 9, { labour: 'haul', reach: 1 }),
  sorter: r(5, [-3, 3, 3, -2], ['sorting'], 4, { labour: 'sort' }),
  timberman: r(0, [0, 0, 0, 0], ['westdrift'], 4, { rounds: ['westdrift', 'heartvein', 'eastworks', 'lowgallery', 'sump'], reach: 1 }),
  lampman: r(0, [0, 0, 0, 0], ['cartway'], 3, { rounds: MINE_ROUND, reach: 1 }),
  pumpman: r(0, [0, 0, 0, 0], ['pumphouse'], 3),
  powderman: r(0, [0, 0, 0, 0], ['powderstore'], 1),
  cartboy: r(5, [2, 2, 0, 2], ['cartway', 'sorting'], 4, { labour: 'haul', reach: 1 }),
  farrier: r(0, [0, 0, 0, 0], ['beaststalls'], 1),
  watercarrier: r(0, [0, 0, 0, 0], ['bunks'], 2, { rounds: ['heartvein', 'eastworks', 'westdrift', 'lowgallery', 'sorting'], reach: 2 }),
  pitcook: r(0, [0, 0, 0, 0], ['pitkitchen'], 2, { reach: 1 }),
  surveyor: r(0, [0, 0, 0, 0], ['overseer'], 1, { rounds: ['heartvein', 'eastworks', 'lowgallery', 'sump', 'westdrift'], reach: 1 }),
  pitclerk: r(0, [0, 0, 0, 0], ['overseer'], 1),
  chaplain: r(20, [-3, 0, 4, -2], ['kilnshrine'], 4, { serves: 'temple', watches: true, reach: 1 }),
  overseer: r(40, [-1, 0, 5, -2], ['overseer'], 2, { standing: 'elite', serves: 'council', watches: true }),
  pitguard: r(15, [3, 1, 0, 3], ['lift', 'overseer', 'cartway'], 5, { serves: 'council', watches: true }),
  winder: r(0, [0, 0, 0, 0], ['lift'], 2),
  trackman: r(0, [0, 0, 0, 0], ['cartway'], 2, { rounds: ['cartway', 'lowgallery', 'sorting', 'westdrift'], reach: 1 }),
  picksmith: r(0, [0, 0, 0, 0], ['cartway'], 1),
  bonesetter: r(0, [0, 0, 0, 0], ['bunks'], 1, { reach: 1 }),
  ashboy: r(0, [0, 0, 0, 0], ['kilnshrine'], 2, { rounds: ['kilnshrine', 'westdrift', 'bunks', 'cartway'], reach: 1 }),
  ventman: r(0, [0, 0, 0, 0], ['westdrift'], 1),
  ratcatcher: r(0, [0, 0, 0, 0], ['sump'], 1, { rounds: ['sump', 'lowgallery', 'pitkitchen', 'bunks'], reach: 1 }),
};
