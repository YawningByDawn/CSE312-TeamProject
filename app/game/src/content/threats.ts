/**
 * The opposition's moves (DECISIONS §15.14; inventory #35-40). Each power answers its heat: crossing into a level
 * calls one move at once; once heat is past a move's floor, moves are drawn by weight and announced days ahead.
 * Either way the move walks the world (`Threat.walkers`) and lands unless answered.
 * Words: `threat.<kind>.name`, `.lands`; `answer.<id>.name`; `rule.<id>`; slots in `THREAT_SLOTS`.
 */
import type { Answer, FactionId, ThreatKind } from '../types';

export interface ThreatDef {
  faction: FactionId;
  /** Called at once when the power's heat crosses into this level. */
  level?: 1 | 2 | 3 | 4;
  /** Announced: drawn by `weight` among the power's moves once heat is at least `floor` (still so when it lands). */
  floor?: number;
  weight?: number;
  /** What blunts it, in the order the HUD lists them. */
  answers: readonly Answer[];
}

export const THREATS: Readonly<Record<ThreatKind, ThreatDef>> = {
  inspection: { faction: 'council', floor: 25, weight: 0, answers: ['agent', 'hide', 'cool'] },
  crackdown: { faction: 'council', floor: 75, weight: 0, answers: ['agent', 'hide', 'cool'] },
  lockdown: { faction: 'council', level: 4, answers: [] },
  vigil: { faction: 'temple', level: 1, answers: [] },
  inquisitor: { faction: 'temple', level: 2, answers: ['agent', 'hide'] },
  purge: { faction: 'temple', level: 3, floor: 40, weight: 3, answers: ['cool'] },
  crusade: { faction: 'temple', level: 4, answers: ['hide'] },
  bolted: { faction: 'public', level: 2, answers: [] },
  mob: { faction: 'public', level: 3, answers: ['hide'] },
  riot: { faction: 'public', level: 4, answers: ['hide'] },
};
export const THREAT_KINDS = Object.keys(THREATS) as ThreatKind[];

export const THREAT = {
  /** Days of warning (announced on day T, lands at dusk of T + warn); while the power is Hostile (75+), `warnHostile`. */
  warn: 2,
  warnHostile: 1,
  /** Days a power rests after a move lands or is blunted before announcing the next. */
  rest: 2,
  /** Lockdown: days the lift gate stays shut (one stronghold raided each dawn). */
  lockdownDays: 4,
  /** A dawn raid (lockdown) or the crusade's torches: the chance each follower working in your stronghold is taken or burned, at most `raidMax` a dawn. */
  raidTaken: 0.35,
  torchBurned: 0.3,
  raidMax: 3,
  /** The Council's heat when its lockdown ends: at most this. */
  lockdownSpent: 60,
  /** The Inquisitor's song: resistance each stranger who hears it gains. The mob: at most `mobMax` strangers where it lands; its beating's victim loses `mobDevotion`. */
  songResist: 3,
  mobMax: 3,
  mobDevotion: 6,
  /** Bolted doors: resistance every soul not yours gains. */
  boltedResist: 6,
  /** Purge: the Temple's heat spent when the fire is fed. */
  purgeCool: 15,
  /** Mob and riot: the public's heat spent; the riot also raises the other two powers' heat. */
  mobCool: 10,
  riotCool: 30,
  riotHeat: 5,
  /** The crusade: days on the road before it reaches the mine, days its fires burn where your faithful gather. */
  crusadeWarn: 3,
  crusadeDays: 3,
} as const;

/** The slots of every threat word that has any, by word key. */
export const THREAT_SLOTS: Readonly<Record<string, Record<string, number>>> = {
  'threat.crusade.lands': { days: THREAT.crusadeDays },
  'rule.crusade': { days: THREAT.crusadeWarn },
};
