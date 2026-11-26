/**
 * The opposition's moves (DECISIONS §15.14; inventory #35-40). Each power answers its heat: crossing into a level
 * calls one move at once; once heat is past a move's floor, moves are drawn by weight and announced days ahead.
 * Either way the move walks the world (`Threat.walkers`) and lands unless answered.
 * Words: `threat.<kind>.name`, `.lands`; `answer.<id>.name`; `rule.<id>`; slots in `THREAT_SLOTS`.
 */
import type { Answer, CardId, FactionId, ItemKind, StageId, ThreatKind } from '../types';

export interface ThreatDef {
  faction: FactionId;
  /** Called at once when the power's heat crosses into this level. */
  level?: 1 | 2 | 3 | 4;
  /** Announced: drawn by `weight` among the power's moves once heat is at least `floor` (still so when it lands). */
  floor?: number;
  weight?: number;
  /** Made only in this stage. */
  stage?: StageId;
  /** What blunts it, in the order the HUD lists them. */
  answers: readonly Answer[];
}

export const THREATS: Readonly<Record<ThreatKind, ThreatDef>> = {
  inspection: { faction: 'council', stage: 'whisper', floor: 25, weight: 0, answers: ['agent', 'hide', 'cool'] },
  crackdown: { faction: 'council', stage: 'whisper', floor: 75, weight: 0, answers: ['agent', 'hide', 'cool'] },
  lockdown: { faction: 'council', level: 4, answers: ['favour', 'evil'] },
  writ: { faction: 'council', stage: 'shade', floor: 35, weight: 3, answers: ['weights', 'favour', 'evil', 'cool'] },
  levy: { faction: 'council', stage: 'shade', floor: 30, weight: 2, answers: ['hide', 'watch', 'draught', 'favour', 'evil', 'cool'] },
  vigil: { faction: 'temple', level: 1, answers: [] },
  inquisitor: { faction: 'temple', level: 2, answers: ['agent', 'hide'] },
  purge: { faction: 'temple', level: 3, floor: 40, weight: 3, answers: ['relic', 'favour', 'evil', 'cool'] },
  ward: { faction: 'temple', stage: 'shade', floor: 25, weight: 2, answers: ['watch', 'relic', 'favour', 'evil', 'cool'] },
  crusade: { faction: 'temple', level: 4, answers: ['relic', 'favour', 'evil'] },
  bolted: { faction: 'public', level: 2, answers: [] },
  mob: { faction: 'public', level: 3, answers: ['hide', 'evil'] },
  riot: { faction: 'public', level: 4, answers: ['hide', 'evil'] },
  burning: { faction: 'public', stage: 'shade', floor: 50, weight: 1, answers: ['watch', 'draught', 'favour', 'evil', 'cool'] },
};
export const THREAT_KINDS = Object.keys(THREATS) as ThreatKind[];

/** The item kind each item answer spends. */
export const ANSWER_ITEM: Readonly<Partial<Record<Answer, ItemKind>>> = { weights: 'weights', relic: 'relic', draught: 'draught' };

/** The act of evil that answers each power's moves. */
export const ANSWER_EVIL: Readonly<Record<FactionId, CardId>> = {
  council: 'burnTheLedgers',
  temple: 'silenceThePreacher',
  public: 'turnTheMob',
};

export const THREAT = {
  /** Days of warning (announced on day T, lands at dusk of T + warn); while the power is Hostile (75+), `warnHostile`. */
  warn: 2,
  warnHostile: 1,
  /** Days a power rests after a move lands or is blunted before announcing the next. */
  rest: 2,
  /** The town loses patience: after this many days in Shade the powers rest `restLate` days, every floor drops by `lateFloor`, and cooling no longer stops the writ. */
  lateDays: 12,
  restLate: 1,
  lateFloor: 15,
  /** Lockdown: days the lift gate stays shut (one stronghold raided each dawn), in the mine and in the town; in the town it also sets a seal. */
  lockdownDays: { whisper: 4, shade: 5 } as Readonly<Record<StageId, number>>,
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
  /** Levy: chance each person is taken; at most this many people. */
  levyPersonChance: 0.6,
  levyMax: 2,
  /** Ward: days it lasts and the colour pushed back when it falls. */
  wardDays: 5,
  wardHold: 15,
  /** Burning: colour lost, public heat spent. */
  burnHold: 40,
  burnCool: 10,
  /** The Council's heat spent when a seal is set. */
  writCool: 8,
  /** Seals on the writ that close the pit head: the town's second way to lose. */
  writMax: 4,
  /** The crusade: called at Shade III (Divinity level), days on the road before it reaches the town, days its fires burn where your faithful gather (mine: 3 dawns; town: 3 days). */
  crusadeLevel: 6,
  crusadeWarn: 3,
  crusadeDays: 3,
} as const;

/** A turned Elite's favour. */
export const FAVOUR = {
  /** Nights the Elite's power gains no heat. */
  nights: 3,
  /** Devotion the Elite risks. */
  devotion: 15,
  /** Nights before the favour can be called again. */
  cooldown: 9,
} as const;

/** The slots of every threat word that has any, by word key. */
export const THREAT_SLOTS: Readonly<Record<string, Record<string, number>>> = {
  'threat.crusade.lands': { days: THREAT.crusadeDays },
  'rule.writ': { max: THREAT.writMax },
  'rule.ward': { days: THREAT.wardDays },
  'rule.favour': { nights: FAVOUR.nights, dev: FAVOUR.devotion, cooldown: FAVOUR.cooldown },
  'rule.crusade': { days: THREAT.crusadeWarn },
  'rule.late': { days: THREAT.lateDays, floor: THREAT.lateFloor },
};
