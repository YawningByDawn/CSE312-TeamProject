/**
 * What the rules need to know about each stage beyond the world graph. Words (words/stages.ts): `stage.<id>.title`,
 * `.start`, `.gate`, `.end`, `.defeat`, `.inquisitor.arrive|leave|buried`, `.hint.<faction>.<0..4>`,
 * `.cross.<faction>.<1..4>`; `rank.<level>`; `stage.gateAlarm.*`, `stage.crackdownFallback`.
 */
import type { PlaceId, RoleId, StageId, UnitId } from '../types';

export interface StageDef {
  /** The area a follower must stand in to open the way to the next stage. */
  gate: PlaceId;
  /** Where the Inquisitor enters from. */
  inquisitorHome: PlaceId;
  /** The leader named in the crackdown (`stage.crackdownFallback` when they are gone). */
  crackdownLeader: UnitId;
  /** Areas where Skim can be worked, and skimmers allowed per area per day. */
  skimAreas: readonly PlaceId[];
  skimCap: number;
  /** Roles that stay at their post (Elites at their desks). */
  stationaryRoles: readonly RoleId[];
  /** Areas a cave-in can hit. */
  caveInAreas: readonly PlaceId[];
  /** Where a follower can be hidden from conscription. */
  hideout: PlaceId;
  /** Where new hands arrive. */
  arrivals: PlaceId;
}

const MINE = {
  skimAreas: ['sorting'],
  skimCap: 2,
  stationaryRoles: ['overseer'],
  caveInAreas: ['eastworks', 'westdrift', 'lowgallery', 'heartvein'],
  hideout: 'sump',
  arrivals: 'bunks',
} as const;

export const STAGES: Readonly<Record<StageId, StageDef>> = {
  whisper: { gate: 'minehead', inquisitorHome: 'kilnshrine', crackdownLeader: 'g17', ...MINE },
  shade: { gate: 'citygate', inquisitorHome: 'kilntemple', crackdownLeader: 'e01', ...MINE },
};
