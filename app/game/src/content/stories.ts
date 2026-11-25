/**
 * Story events (DECISIONS §11): at most one fires each dawn, drawn by weight among those whose condition holds;
 * a choice waits as `Pending` story with two options. The cast (who and where) and the condition are rules; every
 * number they read is here in `n`, and the words show the same slots.
 * Words (words/stories.ts): `story.<id>.title`, `.body`; a choice's `.opt1|opt2.label`, `.does`, `.outcome`;
 * no choice: `.effect`, `.outcome`; another ending: `.outcome.<what>` or `.opt<k>.outcome.<what>`.
 */
import type { StageId, StoryId } from '../types';

export interface StoryDef {
  stages: readonly StageId[];
  /** Days before it may fire again; null: once a run. */
  cooldown: number | null;
  /** Draw weight while its condition holds (`weightElse` when it fails, else it cannot fire). */
  weight: number;
  weightElse?: number;
  choice: boolean;
  n: Readonly<Record<string, number>>;
}

const MINE: readonly StageId[] = ['whisper', 'shade'];
const W: readonly StageId[] = ['whisper'];
const S: readonly StageId[] = ['shade'];

export const STORIES: Readonly<Record<StoryId, StoryDef>> = {
  /** Followers ≥ minFollowers. Let them talk: followers here and next door +faith, public +heat. Hush: the one −hush faith, public −cool. */
  dreamTalker: { stages: W, cooldown: 7, weight: 8, choice: true, n: { minFollowers: 2, faith: 7, heat: 5, hush: 4, cool: 3 } },
  /** A cave-in area with people (STAGES caveInAreas); the victim is a non-follower with odds `stranger`. Closed `days`. */
  caveIn: { stages: MINE, cooldown: 6, weight: 6, choice: false, n: { stranger: 0.75, days: 2 } },
  /** Council ≥ minHeat and a follower. Bribe: −cost crystals, Council −cool. Look: Council +heat, health −harm, one more catch. */
  tallyInspection: { stages: W, cooldown: 5, weight: 9, choice: true, n: { minHeat: 15, cost: 3, cool: 6, heat: 4, harm: 20 } },
  /** Followers ≥ minFollowers from day minDay; the strongest. March: Council −cool, public −publicCool. Hide: Council +heat. */
  conscription: { stages: W, cooldown: 8, weight: 7, choice: true, n: { minFollowers: 2, minDay: 4, cool: 10, publicCool: 3, heat: 10 } },
  /** More than minPeople not yours; a weak one dies, a mourner there grieves and resists −resist. */
  deathInTunnels: { stages: MINE, cooldown: 6, weight: 7, choice: false, n: { minPeople: 6, weakest: 4, resist: 10 } },
  /** The shrine stands, from day minDay. Go: Temple −cool, every follower −faith. Stay away: Temple +cool, every follower +faith. */
  kilnFeast: { stages: W, cooldown: 9, weight: 6, choice: true, n: { minDay: 3, cool: 8, faith: 4 } },
  /** From day minDay. Take: +crystals, Council +heat. Sell a dream: −cost crystals, +nether. */
  smugglerOffer: { stages: W, cooldown: 8, weight: 6, choice: true, n: { minDay: 2, crystals: 4, heat: 7, cost: 2, nether: 10 } },
  /** Followers ≥ minFollowers. Silence (evil): they die, vent malice, public +heat. Let them talk: Council +council, public +public; wearers there may be noticed. */
  informer: { stages: MINE, cooldown: 7, weight: 8, choice: true, n: { minFollowers: 3, malice: 20, heat: 8, council: 12, public: 2 } },
  /** From day minDay: +xp, Hunger +hunger, public +heat. */
  omen: { stages: MINE, cooldown: 9, weight: 4, choice: false, n: { minDay: 3, xp: 8, hunger: 6, heat: 2 } },
  /** A follower beside one not yours. Lift: the helper's health −harm (never below 1), the pinned one resists −resist. Let fall (evil): vent malice. */
  railAccident: { stages: W, cooldown: 7, weight: 6, choice: true, n: { harm: 10, resist: 20, malice: 10 } },
  /** From day minDay: +crystals, Council −cool, every follower −faith. */
  doubleShift: { stages: W, cooldown: 8, weight: 5, choice: false, n: { minDay: 3, crystals: 2, cool: 3, faith: 2 } },
  /** The pools explored and a follower; the strongest. Dive: +crystals, `drownPct` % odds they die. Take what floats: +safe crystals. */
  sumpCache: { stages: W, cooldown: null, weight: 6, choice: true, n: { crystals: 5, drownPct: 30, safe: 2 } },
  /** From day minDay, one not grieving: they grieve, resist −resist; public −cool. */
  lettersFromFront: { stages: MINE, cooldown: 6, weight: 6, choice: false, n: { minDay: 2, resist: 8, cool: 3 } },
  /** Followers ≥ minFollowers: followers on your colour +faith, public +heat. */
  hollowHymn: { stages: W, cooldown: 6, weight: 6, choice: false, n: { minFollowers: 2, faith: 6, heat: 3 } },
  /** Council ≥ minHeat and a follower at or beside the post, or cunning ≥ minCunning. Burn: Council −cool, public +heat. Read: four areas seen, +xp. */
  overseerLedger: { stages: W, cooldown: null, weight: 7, choice: true, n: { minHeat: 20, minCunning: 55, cool: 15, heat: 4, xp: 10 } },
  /** Weight up while Malice ≥ minMalice or Hunger ≥ minHunger. Stir (evil): vent malice, Hunger +hunger, all resist −resist, each power +heat. Lie still: Hunger −calm, Malice +malice2. */
  theShaking: { stages: W, cooldown: 8, weight: 6, weightElse: 2, choice: true, n: { minMalice: 35, minHunger: 50, malice: 15, hunger: 10, resist: 4, heat: 3, calm: 6, malice2: 8 } },
  /** Crystals ≥ minCrystals: Council +heat, the Greedy resist −resist. */
  crystalFever: { stages: W, cooldown: 8, weight: 7, choice: false, n: { minCrystals: 10, heat: 5, resist: 10 } },
  /** From day minDay while fewer than maxShare of all who ever worked the mine are here and not yours: a new hand at STAGES arrivals. */
  freshHands: { stages: W, cooldown: 7, weight: 6, choice: false, n: { minDay: 5, maxShare: 0.5 } },
  /** One not yours, not pious, in sight. Answer: −cost crystals, theirs at faith `faith`. Nightmare (evil): resist −resist, vent malice, public +heat. */
  beggedBlessing: { stages: W, cooldown: 8, weight: 5, choice: true, n: { cost: 2, faith: 25, resist: 12, malice: 10, heat: 3 } },
  /** Weight up while Council ≥ minHeat: Council −cool, public −publicCool. */
  warBells: { stages: MINE, cooldown: 10, weight: 4, weightElse: 1, choice: false, n: { minHeat: 10, cool: 6, publicCool: 2 } },
  /** At least minWorkers in the market. Feed: market workers resist −resist, public +heat. Let die: public −cool. */
  marketRumour: { stages: S, cooldown: 8, weight: 7, choice: true, n: { minWorkers: 3, resist: 6, heat: 6, cool: 2 } },
  /** At least minResidents in the rows. Heal: −cost crystals, residents resist −resist, Temple +heat. Let run (evil): `dead` more die, vent malice. */
  feverRows: { stages: S, cooldown: 10, weight: 6, choice: true, n: { minResidents: 4, cost: 6, resist: 12, heat: 5, dead: 2, malice: 10 } },
  /** The magistrate not yours and a follower in town. Serve: the host's quarter resists −resist, the host −hostResist, Council +heat. */
  magistrateDinner: { stages: S, cooldown: 12, weight: 5, choice: true, n: { resist: 8, hostResist: 10, heat: 4 } },
  /** At least count + 3 soldiers. Take in: `count` soldiers turn at faith `faith`, Council +heat. Turn in: they die, Council −cool. */
  deserters: { stages: S, cooldown: null, weight: 4, choice: true, n: { count: 3, faith: 25, heat: 10, cool: 8 } },
  /** A bitter or greedy resident of the rows. Shield: +crystals, they resist −resist, Temple +heat. Give up: taken, Temple −cool. */
  graveRobbers: { stages: S, cooldown: 10, weight: 5, choice: true, n: { crystals: 3, resist: 10, heat: 6, cool: 5 } },
  /** From minDays after the watershed: Council +heat. */
  cityRider: { stages: S, cooldown: 9, weight: 4, choice: false, n: { minDays: 5, heat: 5 } },
};
