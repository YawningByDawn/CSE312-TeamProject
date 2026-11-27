/**
 * What a person is made of (OVERHAUL): the four body stats (Dexterity, Intelligence, Strength, Endurance, 1..20, 10 on
 * average), how Strength and Endurance make Hit Points, how Endurance heals them, and the host's marks and revival.
 * Devotion and Resistance are 0..100 and live with the whisper's numbers (balance). Rules: src/sim/host.ts.
 */
import type { UnitId } from '../types';

export interface BodyStats { dexterity: number; intelligence: number; strength: number; endurance: number }

export const STATS = {
  /** The roll of each body stat before its trade's bias (average 10); the result is held to `min`..`max`. */
  roll: [5, 15] as const,
  min: 1,
  max: 20,
  /** Max HP = hpBase + hpPerStrength × Strength + hpPerEndurance × Endurance (85 at 10 and 10). */
  hpBase: 25,
  hpPerStrength: 2,
  hpPerEndurance: 4,
  /** HP regained an hour (a day has 24) per point of Endurance, whoever is hurt. */
  regenPerEndurance: 0.2,
} as const;

/**
 * The miner who digs the god out: the one the run opens on. He is always on the dawn's list; when he falls he is back
 * at the next dawn at full HP, free, and his stats are these for good. His body always wakes at `wakes`: the south rim of
 * the grave's pit, clear ground in the grave's area.
 */
export const FIRST_MINER: { id: UnitId; stats: BodyStats; wakes: { x: number; y: number } } = {
  id: 'g01',
  wakes: { x: 1190, y: 895 },
  stats: { dexterity: 6, intelligence: 8, strength: 6, endurance: 6 },
};

export const HOST = {
  /** People the host may mark a day. */
  marksPerDay: 3,
  /** The farthest (mine units, about two heights of a person) from the host's body a person may be marked. */
  markReach: 80,
  /** A mark holds this many days, the day it is made included: a whisper in the nights of those days. */
  markDays: 3,
  /** The stones a dead follower's revival burns (the cheapest in the pouch). */
  reviveStones: 3,
} as const;
