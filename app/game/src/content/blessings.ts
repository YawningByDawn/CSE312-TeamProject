/**
 * Blessings (DECISIONS §15.5): pick 1 of 3 at the start of a run (the starting bonus) and at every level-up.
 * Words: `blessing.<id>.name`, `.line`, `.details` (words/cards.ts), filled with `blessingSlots(id)`.
 */
import type { BlessingId } from '../types';

/** The numbers the rules read. */
export const BLESSING = {
  /** Deep Roots: the area that starts yours, and it seeps a Dull crystal every this many dawns. */
  rootsArea: 'heartvein',
  deepRootsSeepEvery: 3,
  /** First Dreamer: the person who starts yours, with this faith. */
  dreamerUnit: 'g01',
  dreamerDevotion: 30,
  /** Hoard of the Grave: crystals in the grave by grade step (Dull, Clear, Bright). */
  hoardGrades: [1, 2, 0] as readonly number[],
  sockets: 1,
  hungerSlow: 2,
  conversion: 0.1,
  ichorMax: 3,
  maliceMult: 1.5,
  calm: 0.2,
  strikeLuck: 10,
  cutCostMult: 0.5,
  draws: 1,
  seepExtra: 1,
  ap: 1,
  graftCap: 1,
  /** Stone Wedding: the odds a recombination steps a grade up. */
  graftGradeUp: 0.25,
  rerolls: 1,
  searchMult: 0.5,
  eatNether: 1,
  stoneSkinIchor: 2,
  strikeRate: 0.1,
} as const;

export interface BlessingDef {
  /** Offered only at the start of a run. */
  startOnly?: true;
}

export const BLESSINGS: Readonly<Record<BlessingId, BlessingDef>> = {
  lingeringThrone: {},
  hoardOfTheGrave: {},
  patientHunger: {},
  sweetVoice: {},
  oldScars: {},
  cruelDelight: {},
  deepRoots: { startOnly: true },
  quietRot: {},
  firstDreamer: { startOnly: true },
  luckyVein: {},
  gemcutter: {},
  thirdHand: {},
  graveRobber: {},
  restless: {},
  grafter: {},
  secondChance: {},
  pickpocket: {},
  appetite: {},
  stoneSkin: {},
  deepPockets: {},
};

export const BLESSING_IDS = Object.keys(BLESSINGS) as BlessingId[];

const B = BLESSING;
const pct = (x: number): number => Math.round(x * 100);

/** The slots a blessing's words read. */
export function blessingSlots(id: BlessingId): Record<string, number> {
  switch (id) {
    case 'lingeringThrone': return { n: B.sockets };
    case 'hoardOfTheGrave': return { n: B.hoardGrades.length };
    case 'patientHunger': return { n: B.hungerSlow };
    case 'sweetVoice': return { pct: pct(B.conversion) };
    case 'oldScars': return { n: B.ichorMax };
    case 'cruelDelight': return { pct: pct(B.maliceMult - 1) };
    case 'deepRoots': return { n: B.deepRootsSeepEvery };
    case 'quietRot': return { pct: pct(B.calm) };
    case 'firstDreamer': return { dev: B.dreamerDevotion };
    case 'gemcutter': return { pct: pct(1 - B.cutCostMult) };
    case 'grafter': return { pct: pct(B.graftGradeUp), n: B.graftCap };
    case 'luckyVein': return { n: B.strikeLuck };
    case 'thirdHand': return { n: B.draws };
    case 'graveRobber': return { n: B.seepExtra };
    case 'restless': return { n: B.ap };
    case 'secondChance': return { n: B.rerolls };
    case 'pickpocket': return { pct: pct(1 - B.searchMult) };
    case 'stoneSkin': return { n: B.stoneSkinIchor };
    case 'deepPockets': return { pct: pct(B.strikeRate) };
    default: return {};
  }
}
