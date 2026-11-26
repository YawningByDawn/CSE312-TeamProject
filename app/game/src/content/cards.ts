/**
 * The cards (DECISIONS §15.4, §43): miracles cost crystal worth, burnt (affinity match half again); acts of evil
 * sate Malice and raise heat. Three dealt at dusk from pools that widen with Divinity.
 * Words: `card.<id>.name`, `.line`, `.details`, filled with `cardSlots(id)`.
 */
import { BALANCE } from './balance';
import type { Affinity, CardId, CardKind, FactionId, TraitId } from '../types';

/** What a card is aimed at: `follower` one of yours, `unit` someone not yours in reach, `area` an area of the kind. */
export type CardTarget = 'none' | 'unit' | 'follower' | 'area';
/** Which areas an area card accepts. */
export type CardArea = 'face' | 'seen' | 'followers' | 'people' | 'shrine' | 'home' | 'groups';

export interface CardDef {
  kind: CardKind;
  target: CardTarget;
  area?: CardArea;
  /** Elites only. */
  elite?: true;
  minLevel: number;
  shadeOnly?: true;
  weight: number;
  /** Miracle: cost in crystal worth. */
  cost?: number;
  /** Miracle: stones of this affinity pay half again. */
  nature?: Affinity;
  /** Miracle: the traits it bites hardest on. */
  traits?: readonly TraitId[];
  /** Evil: Malice sated (followers' own acts sate half), Hunger fed, heat raised. */
  malice?: number;
  hunger?: number;
  heat?: readonly { faction: FactionId; amount: number }[];
  /** Evil: followers may commit it on their own. */
  followerAct?: true;
  /** Evil: its reward grows with Malice (BALANCE.evilBonusSteps). */
  bonus?: true;
  /** Evil: dealt only while this power has a move announced; it makes every one of them fail. */
  answers?: FactionId;
}

/** Card numbers the rules use. */
export const CARD = {
  dreamDevotion: 12,
  blessDevotion: 15,
  blessDays: 2,
  blessStrike: 0.5,
  veinSightLuck: 40,
  bloomRolls: 2,
  soothe: 6,
  terrorResistance: -25,
  tongueOdds: 0.15,
  dewDays: 3,
  dewHold: 10,
  marrowHunger: 20,
  creepHold: 25,
  quickenAp: 2,
  mendIchor: 2,
  callingOddsMult: 0.5,
  sermonResistance: -20,
  gildedOdds: 0.25,
  devourFollowerHunger: 50,
  devourSoulLuck: 30,
  devourFollowerSoulLuck: 60,
  terrorizeResistance: -12,
  sacrificeNetherPerV: 15,
  frameCouncil: -10,
  caveInKills: [1, 2] as readonly number[],
  robShare: 0.5,
  bloodRiteDevotion: 4,
  riotThin: 0.25,
  assassinateLuck: 200,
} as const;

const C = CARD;
type M = Omit<CardDef, 'kind' | 'cost' | 'minLevel' | 'weight' | 'target'>;
const miracle = (cost: number, target: CardTarget, minLevel: number, weight: number, nature: Affinity, traits: TraitId[], o: M = {}): CardDef => ({
  kind: 'miracle', cost, target, minLevel, weight, nature, traits, ...o,
});
const heat = (faction: FactionId, amount: number) => ({ faction, amount });
const evil = (malice: number, hunger: number, h: CardDef['heat'], target: CardTarget, minLevel: number, weight: number, o: M = {}): CardDef => ({
  kind: 'evil', malice, hunger, heat: h, target, minLevel, weight, ...o,
});

export const CARDS: Readonly<Record<CardId, CardDef>> = {
  dreamDirective: miracle(3, 'follower', 1, 3, 'faith', ['ambitious', 'curious']),
  blessTheirBodies: miracle(4, 'area', 1, 3, 'faith', ['pious', 'ambitious', 'loyal'], { area: 'followers' }),
  veinSight: miracle(3, 'area', 1, 3, 'stone', ['curious'], { area: 'face' }),
  crystalBloom: miracle(5, 'area', 2, 2, 'stone', ['greedy'], { area: 'face' }),
  soothingMurmur: miracle(4, 'none', 1, 2, 'fear', ['fearful']),
  nightTerror: miracle(2, 'unit', 1, 3, 'fear', ['fearful', 'grieving']),
  borrowedTongue: miracle(2, 'none', 1, 3, 'echo', ['grieving']),
  blackDew: miracle(4, 'area', 2, 2, 'shadow', ['pious'], { area: 'seen' }),
  marrowFeast: miracle(4, 'none', 1, 2, 'hunger', []),
  creepingDark: miracle(3, 'area', 1, 3, 'shadow', ['bitter'], { area: 'seen' }),
  blindEye: miracle(3, 'none', 1, 3, 'shadow', ['greedy']),
  divertedCart: miracle(5, 'area', 2, 2, 'malice', ['greedy'], { area: 'face' }),
  quickening: miracle(4, 'none', 2, 2, 'blood', []),
  mend: miracle(5, 'none', 3, 1.5, 'blood', []),
  theCalling: miracle(6, 'area', 3, 1.5, 'faith', ['grieving', 'curious'], { area: 'people' }),
  sermonOfAsh: miracle(4, 'area', 4, 2, 'flame', ['bitter'], { area: 'groups', shadeOnly: true }),
  gildedTongue: miracle(5, 'none', 4, 2, 'echo', ['ambitious'], { shadeOnly: true }),

  devour: evil(12, 35, [heat('public', 6), heat('temple', 3)], 'unit', 1, 3, { bonus: true }),
  terrorize: evil(15, 0, [heat('public', 5)], 'area', 1, 3, { area: 'people', followerAct: true, bonus: true }),
  sabotage: evil(14, 0, [heat('council', 6)], 'area', 1, 2, { area: 'face', bonus: true }),
  desecrate: evil(25, 0, [heat('temple', 15)], 'area', 1, 2, { area: 'shrine' }),
  sacrifice: evil(30, 20, [heat('temple', 6)], 'follower', 2, 1.5, { bonus: true }),
  frame: evil(10, 0, [heat('public', 3)], 'unit', 1, 2.5, { followerAct: true }),
  caveIn: evil(30, 0, [heat('council', 8), heat('public', 8)], 'area', 2, 1.5, { area: 'face' }),
  badWater: evil(12, 0, [heat('public', 4)], 'area', 1, 2, { area: 'home', followerAct: true, bonus: true }),
  robTheCart: evil(10, 0, [heat('council', 8)], 'area', 1, 2.5, { area: 'face', followerAct: true, bonus: true }),
  madness: evil(18, 0, [heat('council', 5), heat('public', 4)], 'unit', 2, 1.5),
  bloodRite: evil(12, 15, [heat('temple', 3)], 'none', 1, 2, { followerAct: true, bonus: true }),
  riot: evil(25, 0, [heat('public', 10), heat('council', 4)], 'area', 4, 2, { area: 'groups', shadeOnly: true, bonus: true }),
  assassinate: evil(35, 0, [heat('council', 15), heat('public', 10)], 'unit', 4, 1.5, { elite: true, shadeOnly: true, bonus: true }),
  burnTheLedgers: evil(20, 0, [heat('public', 8), heat('temple', 4)], 'none', 4, 3, { shadeOnly: true, answers: 'council' }),
  silenceThePreacher: evil(22, 0, [heat('public', 8), heat('council', 5)], 'none', 4, 3, { shadeOnly: true, answers: 'temple' }),
  turnTheMob: evil(18, 0, [heat('council', 10)], 'none', 4, 3, { shadeOnly: true, answers: 'public' }),
};

const pct = (x: number): number => Math.round(x * 100);
/** Odds a Resistance change is worth, as a percentage (spec: odds lose Resistance / BALANCE.oddsResistDivisor). */
const resistPct = (r: number): number => Math.round((-r / BALANCE.oddsResistDivisor) * 100);

/** The numbers each card's words name beyond its own cost, Malice, Hunger and heat. */
const SLOTS: Readonly<Record<CardId, Record<string, number>>> = {
  dreamDirective: { dev: C.dreamDevotion },
  blessTheirBodies: { dev: C.blessDevotion, pct: pct(C.blessStrike), days: C.blessDays },
  veinSight: { luck: C.veinSightLuck },
  crystalBloom: { n: C.bloomRolls },
  soothingMurmur: { n: C.soothe },
  nightTerror: { pct: resistPct(C.terrorResistance) },
  borrowedTongue: { pct: pct(C.tongueOdds) },
  blackDew: { days: C.dewDays, pct: C.dewHold },
  marrowFeast: { hunger: C.marrowHunger },
  creepingDark: { pct: C.creepHold },
  quickening: { n: C.quickenAp },
  mend: { n: C.mendIchor },
  theCalling: { pct: pct(C.callingOddsMult) },
  sermonOfAsh: { pct: resistPct(C.sermonResistance) },
  gildedTongue: { pct: pct(C.gildedOdds) },
  devour: { own: C.devourFollowerHunger },
  terrorize: { pct: resistPct(C.terrorizeResistance) },
  frame: { cool: -C.frameCouncil },
  bloodRite: { n: C.bloodRiteDevotion },
};

/** Every slot a card's words use, from the one copy of each number. */
export function cardSlots(id: CardId): Record<string, number> {
  const d = CARDS[id];
  if (!d) throw new Error(`cardSlots: no card ${id}`);
  const out: Record<string, number> = { cost: d.cost ?? 0, malice: d.malice ?? 0, hunger: d.hunger ?? 0, temple: 0, council: 0, public: 0 };
  for (const h of d.heat ?? []) out[h.faction] = h.amount;
  return { ...out, ...SLOTS[id] };
}
