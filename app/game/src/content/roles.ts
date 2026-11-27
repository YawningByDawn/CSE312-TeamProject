/**
 * Every person's trade (#48): one table for the rules and the days. Nine mine hands in six trades, every one a
 * named person.
 * Words: `role.<id>.name`, `.plural`, `.line`.
 */
import type { FactionId, RoleId, Standing } from '../types';

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
  /** Extra areas of whisper reach a follower of this trade brings. */
  reach: number;
  /** What the trade owes a day when the host is one of them (OVERHAUL): a miner's ores delivered to the drop. 0: no quota. */
  quota: number;
}

type Opt = Partial<Pick<RoleDef, 'standing' | 'serves' | 'watches' | 'labour' | 'reach' | 'quota'>>;
const r = (resistance: number, bias: RoleDef['bias'], o: Opt = {}): RoleDef => ({
  standing: 'mortal', resistance, bias, serves: null, watches: false, labour: null, reach: 0, quota: 0, ...o,
});

export const ROLES: Readonly<Record<RoleId, RoleDef>> = {
  digger: r(0, [0, 0, 0, 0], { labour: 'dig', quota: 3 }),
  hauler: r(5, [2, 2, 0, 2], { labour: 'haul', reach: 1 }),
  sorter: r(5, [-3, 3, 3, -2], { labour: 'sort' }),
  chaplain: r(20, [-3, 0, 4, -2], { serves: 'temple', watches: true, reach: 1 }),
  overseer: r(40, [-1, 0, 5, -2], { standing: 'elite', serves: 'council', watches: true }),
  pitguard: r(15, [3, 1, 0, 3], { serves: 'council', watches: true }),
};
