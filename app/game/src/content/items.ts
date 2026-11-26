/**
 * Made things (spec §7.4-7.5, vision §4). A bench of a building that is yours folds a loose crystal into an item.
 * Worn by one of yours it lends powers; given to one not yours it is a curse, used up. A caught wearer's items are
 * evidence. Words: `facility.<id>.name`, `.makes`; `item.<kind>.name`, `.gift`.
 */
import type { Affinity, Facility, FactionId, Grade, ItemKind, JewelForm } from '../types';

/** What the craft action's bench makes (faceting re-cuts and jewelry forges a form instead). */
export const FACILITY_ITEM: Readonly<Record<Exclude<Facility, 'faceting' | 'jewelry'>, Exclude<ItemKind, 'jewel'>>> = {
  falseWeights: 'weights',
  profaning: 'relic',
  draughts: 'draught',
  lamps: 'lamp',
  clothing: 'clothing',
  brew: 'brew',
};

/** A power a worn item lends its wearer, summed over everything they wear. */
export type WornPower =
  | 'strikeLuck' | 'strikeRate' | 'whisperHelp' | 'devotion' | 'guardBlind' | 'secondPocket' | 'falseWeights' | 'draught';

/** One power: `value + perGrade × g`, g the folded crystal's grade step (dull 0 ... impossible 5). */
export interface Power { power: WornPower; value: number; perGrade?: number }

/** Given to one not yours: whom it reaches and what it does to each. */
export interface Gift {
  /** the one; everyone not yours where they work; their household; the sleepers of their home tonight. */
  reach: 'one' | 'work' | 'household' | 'home';
  /** Resistance change for each one reached. */
  resist?: number;
  /** Days the one given it is sick. */
  sick?: number;
  /** Suspicion raised in a power that notices. */
  heat?: { faction: FactionId; amount: number };
  /** An Elite's own power cools by this (their word goes bad). */
  cool?: number;
  /** Whisper odds tonight for the ones reached. */
  odds?: number;
}

export interface ItemDef { worn: readonly Power[]; gift: Gift }

/** Keyed by the jewel's form or the item's kind. A jewel also lends its crystal's person powers (`MOD_POWER`). */
export const ITEMS: Readonly<Record<JewelForm | Exclude<ItemKind, 'jewel'>, ItemDef>> = {
  ring: { worn: [{ power: 'strikeLuck', value: 10 }], gift: { reach: 'one', resist: -25 } },
  amulet: { worn: [{ power: 'secondPocket', value: 1 }], gift: { reach: 'one', cool: 8, sick: 1 } },
  circlet: { worn: [{ power: 'whisperHelp', value: 10 }], gift: { reach: 'one', resist: -25 } },
  weights: { worn: [{ power: 'falseWeights', value: 6, perGrade: 2 }], gift: { reach: 'one', resist: -25 } },
  relic: {
    worn: [{ power: 'guardBlind', value: 50 }, { power: 'devotion', value: 2, perGrade: 1 }],
    gift: { reach: 'one', cool: 8, sick: 1 },
  },
  draught: {
    worn: [{ power: 'strikeRate', value: 30, perGrade: 5 }, { power: 'draught', value: 3 }],
    gift: { reach: 'one', sick: 3, resist: -12.5 },
  },
  lamp: {
    worn: [{ power: 'whisperHelp', value: 8, perGrade: 2 }],
    gift: { reach: 'work', resist: -8, heat: { faction: 'temple', amount: 2 } },
  },
  clothing: {
    worn: [{ power: 'secondPocket', value: 1 }, { power: 'guardBlind', value: 15 }],
    gift: { reach: 'household', resist: -10, heat: { faction: 'public', amount: 2 } },
  },
  brew: {
    worn: [{ power: 'devotion', value: 2, perGrade: 1 }, { power: 'draught', value: 3 }],
    gift: { reach: 'home', odds: 0.1, sick: 1 },
  },
};

/** The person powers a jewel takes from its crystal's modifier families. */
export const MOD_POWER: Readonly<Record<string, WornPower>> = {
  strikeLuck: 'strikeLuck',
  strikeRate: 'strikeRate',
  whisperOdds: 'whisperHelp',
  devotion: 'devotion',
  calm: 'guardBlind',
};

export const ITEM = {
  /** Nether to make an item, by the crystal's grade. */
  makeCost: { dull: 3, clear: 4, bright: 6, blazing: 9, royal: 13, impossible: 18 } as Readonly<Record<Grade, number>>,
  /** Metal from a smelter of yours: jewelry costs this share of its Nether. */
  metalForgeCost: 0.5,
  /** Exposure of an item: 1 + grade step, + this when it is cursed. A caught wearer raises exposure × heat. */
  curseExposure: 2,
  exposureHeat: 3,
  /** Worn guard blindness hides a wearer from a search at most this much. */
  blindMax: 0.9,
  /** Chance an informer's report catches a wearer in that area (× (1 − Cunning/200)). */
  informerNotice: 0.5,
  /** Chance a hunter (inspector, inquisitor) notices a wearer it has found. */
  hunterNotice: 0.35,
} as const;

/** What a set power adds to the god's sums. */
export type SetEffect =
  | 'hungerSlow' | 'maliceSlow' | 'devotion' | 'whisperOdds' | 'calm' | 'ichorMax'
  | 'searchCut' | 'strikeLuck' | 'freeWhispers' | 'miraclePower';

/** Set powers (DECISIONS §15.12): `SET_SIZE` set stones of one affinity wake its power. */
export const SET_SIZE = 3;
export const SET_POWER: Readonly<Record<Affinity, Readonly<Partial<Record<SetEffect, number>>>>> = {
  hunger: { hungerSlow: 2 },
  malice: { maliceSlow: 2 },
  faith: { devotion: 1, whisperOdds: 0.05 },
  fear: { calm: 0.1 },
  blood: { ichorMax: 2 },
  shadow: { searchCut: 0.25 },
  stone: { strikeLuck: 10 },
  echo: { freeWhispers: 1 },
  flame: { miraclePower: 0.2 },
};
