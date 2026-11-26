/**
 * Tunable numbers: each a design choice recorded in DECISIONS.md; the spec formulas are the sim's (`src/sim/formulas.ts`).
 * Words fill their numbers from here as slots, never a second copy.
 */
export const BALANCE = {
  // --- economy ---
  /** Flat Nether floor added to income (not part of Faith). */
  ember: 8,
  /**
   * The Ember starts brighter: the last warmth of the fall, burning down by
   * `emberFade` a night until it settles at `ember`. Night 1 always affords a
   * whisper or two; the flock takes over the income as it fades.
   */
  emberStart: 24,
  emberFade: 1,
  /** Unspent Nether carried into the next turn. */
  carryRate: 0.5,
  /** Carry-over is capped at this many turns of income. */
  carryCapTurns: 1,

  // --- god ---
  /** Ichor the fallen god wakes with (max is 10 + 2(L−1); it starts wounded). */
  startIchor: 8,
  /** Ichor regained on each level-up (growing stronger closes old wounds). */
  levelUpHeal: 2,
  startHunger: 30,
  hungerRiseBase: 4,
  /** Hunger rises by one more per this many follower heads (a bigger flock, a bigger appetite). */
  hungerPerFollowers: 4,
  starvingAt: 70,
  satedBelow: 30,
  starvingNetherMult: 0.6,
  /** Starving: every follower loses this much Devotion each Dawn (you feed on them). */
  starvingDrain: 1,
  satedPowerMult: 1.1,
  ravenousResetTo: 70,
  /** Public Suspicion when the god eats one of its own (a body with no soul in it). */
  ravenousPublic: 10,
  /** Ichor lost each night the god starves with no follower left to eat. */
  starveIchor: 1,

  startMalice: 10,
  maliceRiseBase: 4,
  /** Malice when one of your followers is taken, burned or killed by your enemies. */
  maliceOnLoss: 3,
  /** Malice from this is Restless, from `seethingAt` Seething (the urge's state word). */
  maliceRestlessAt: 40,
  seethingAt: 70,
  seethingPublicPerTurn: 3,

  // --- people ---
  /** Personal Resistance roll added to trait + role. */
  personalResist: [10, 26] as const,
  /** Effective Resistance is clamped to 0..this. */
  resistanceCap: 100,
  /** The mine grows wary: +this Resistance for everyone unconverted, per follower head beyond `warinessFree`. */
  warinessPerFollower: 3.5,
  warinessFree: 2,
  /** Conversion odds lose Resistance / this. */
  oddsResistDivisor: 200,
  convertDevotion: 12,
  /** Grieving converts start this much higher. */
  grievingConvertBonus: 5,
  failedWhisperResistance: -8,
  failedWhisperPublic: 2,
  /** Cult Suspicion when a Pious / shrine-keeper / Flame-lit target converts or reports a failed whisper. */
  kilnConvertCult: 6,
  kilnFailCult: 3,
  /** Flat Devotion loss per Dawn in a strongly / weakly Flame-lit zone. */
  kilnDrainStrong: 3,
  kilnDrainWeak: 1,
  /** Temple vigils: Resistance per cult level (Wary 1×, Alarmed 2×, Hostile+ 3×). */
  cultWaryResist: 5,

  // --- the stain (DECISIONS §14.2) ---
  /** Hold at which an area counts as coloured (visible colour, reach, Seen around it). */
  colouredAt: 5,
  /** Hold an area starts with next to the grave. */
  graveRingStart: 12,
  /** A rooted area loses its root when Hold falls below this. */
  rootLostBelow: 85,
  /** Seepage: an area gains this share of (neighbour − itself − seepGap) from every more-soaked neighbour (at least seepFrom), at most seepCap a Day. */
  seepRate: 0.06,
  seepGap: 10,
  seepFrom: 40,
  seepCap: 12,
  /** The grave's own seepage rate into the areas around it (it is always 100). */
  graveSeepRate: 0.04,
  /** Unattended areas (no follower spent time there, not rooted) fade by this a Day. */
  holdFade: 3,
  /** A follower's stain per half-day spent in an area: base + perV × V(D), × heads^0.85, × task, × asleep, × the area's size. */
  holdBase: 2.5,
  holdPerV: 1,
  holdAsleep: 0.6,
  /** Pushback per Day: the Flame's ward in its area / next to it; each non-follower guard, overseer or priest per half-day present; a hunter; a raid. */
  wardPush: 6,
  wardPushNear: 2,
  watcherPush: 1,
  raidPush: 25,
  /** A guard or overseer who stands on ground at least this soaked notices (Council heat +stainNoticeGov). */
  stainNoticeAt: 50,
  stainNoticeGov: 0.5,
  /** Devotion base per Day: living their life and praying / sent away. */
  prayDevotion: 5,
  /** Odds bonus for whispering to a sleeper. */
  sleeperBonus: 0.12,
  /** A whisper that turns someone stains their area at once by this much (the ripple). */
  convertHold: 6,

  // --- territory ---
  /** Rooted out: no followers, no area not anchored with Hold at least this, and nobody in reach. */
  rootedOutHold: 10,
  /** Lit areas counted in the odds term (0.04 × min(lit areas, cap)). */
  presenceOddsCap: 6,
  /** Ichor torn away when territory is lost. */
  zoneLostIchor: 1,

  // --- suspicion ---
  /** Suspicion cools by this each Dawn at Divinity 1 ... */
  suspicionDecay: 2,
  /** ... and this much less per level above 1 (the mine stops forgetting as you grow), never below `suspicionDecayMin`. */
  suspicionDecayPerLevel: 0.15,
  suspicionDecayMin: 1,
  /** The mob (public Hostile) beats this many followers (the riot one more); each loses this much HP. */
  mobVictims: 2,
  /** The Inquisitor's song: Devotion lost by each exposed follower in its zone (pious: more). */
  cantorSong: 10,
  cantorSongPious: 15,
  mobHarm: 60,
  /** Violet crests are seen: public Suspicion per follower head per Dawn. */
  crestPublicPerFollower: 0.25,
  /** Violet crests seen in the Flame's light: cult Suspicion per follower head standing there per Dawn. */
  kilnCrestCult: 1,
  /** Each Dawn, cult and government gain public × this (public talk). */
  publicFeed: 0.03,
  /** A crossed Suspicion threshold re-arms only once the track falls this far below it. */
  rearmGap: 10,
  /** The inspection (inspector.ts): announced each Day with chance inspectChance + Council × inspectChancePer while the Council is Wary. */
  inspectChance: 0.25,
  inspectChancePer: 0.004,
  /** The gallery an inspection walks to, picked by 1 + inspectFlockWeight × your followers there; the grave too once the Council is at inspectGraveAt. */
  inspectFlockWeight: 3,
  inspectGraveAt: 50,
  /** Chance he catches a follower in the open at his stop: carrying stones, a made thing, skimming or delving / only seen at prayer; the crackdown looks harder. */
  inspectCatch: 0.5,
  inspectSeen: 0.25,
  inspectCrackdownMult: 1.5,
  /** Council heat: a follower seen at prayer, caught at it, per stone set in the grave (capped). Devotion lost to the questioning. */
  inspectSeenHeat: 2,
  inspectCaughtHeat: 3,
  inspectSetHeat: 2,
  inspectSetCap: 8,
  inspectDevotion: 5,
  /** Days the Council rests after a walk; the crackdown spends this much of the Council's heat. */
  inspectRest: 1,
  crackdownCool: 20,
  /** Reaching the stage gate is seen: government / cult Suspicion added once (StageDef.gateAlarm narrates it). */
  gateAlarmGov: 15,
  gateAlarmCult: 10,
  /** Ichor lost when a hunter (the inspector, the Inquisitor) stands in your grave at Dawn. */
  hunterIchor: 1,
  /** Chance each Dawn that a follower lying low is actually hidden (from hunters, inspections and purges). */
  lieLowCover: 0.7,

  // --- XP (DECISIONS §4; evil = Malice vented / xpEvilDivisor) ---
  xpFollower: 5,
  xpDevotionMarks: [
    [25, 3],
    [50, 6],
    [75, 10],
    [100, 16],
  ] as const,
  xpZone: 12,
  xpEat: 1,
  /** XP per point of crystal value eaten or burnt (spec §4: XP comes first from the soul value you consume). */
  xpPerSoul: 1,
  xpEvilDivisor: 2,

  // --- events ---
  /** A story's chance at each dawn, and at each hour of the night the clock runs through. */
  eventChance: 0.6,
  nightEventChance: 0.05,

  // --- the run's end ---
  /** Highest level reachable before the lift has taken root (L4 needs it; XP keeps banking). */
  whisperLevelCap: 3,
  /** The rank that ends the run with the lift rooted: the mine is taken. */
  takenLevel: 4,
  /** A turned Elite cools its faction's track once by this much. */
  eliteTurnCool: 15,
  // --- cards (DECISIONS §43; the cards a draw deals per stage: `STAGE_DRAW`) ---
  /** The hand holds at most this many cards (blessings add more). */
  handMax: 5,
  /** Nether fee of each card after the first in a night: the n-th card costs (n − 1) × this (about a base whisper, 6 × (1 + resistance/50)). */
  cardExtraFee: 8,
  /** Share of a draw's cards that are acts of evil: this at Malice 0, rising by `offerEvilPerMalice` per point. */
  offerEvilBase: 0.3,
  offerEvilPerMalice: 0.004,
  /**
   * Malice is an urge, never spent (DECISIONS §43, third amendment): an act of evil you play while it runs high
   * gives more — its own reward (food, stones, fear, Nether, the cart's share) × the multiplier of the highest
   * step reached; never more Malice vented, never less noticed. Followers' own acts are unchanged.
   */
  evilBonusSteps: [
    { at: 40, mult: 1.15 },
    { at: 60, mult: 1.3 },
    { at: 80, mult: 1.5 },
  ],
  // --- the mining loop (DECISIONS `### SIM-v3 — The mining loop`) ---

  apBase: 3,
  socketsBase: 3,
  strikeRolls: 2,
  /** Two rolls × 0.2: an ordinary miner strikes about once every 2.5 days (spec §6). */
  strikeChance: 0.2,
  /** Followers dig harder for their god: strike chance × this. */
  followerStrike: 1.25,
  /** Evening tribute (spec §6): each praying follower holding finds brings one, chance base + Devotion / per (max). */
  tributeBase: 0.25,
  tributePerDevotion: 150,
  tributeMax: 0.85,
  /** Delve (Whisper II): follower-days of digging toward the Deep that open it. */
  delveDays: 6,
  /** Each Delve day: this chance the delver is hurt (sick 2 days). */
  delveHurt: 0.06,
  /** The Deep's depth until it is opened (its pools are worked thinly above the sealed seam). */
  sealedDepth: 2,
  /** Strike chance × (1 + (Strength − 10) / strengthSpan). */
  strengthSpan: 50,
  /** A found seam adds this to the face's multiplier (the Council does not know). */
  seamBonus: 0.4,
  /** Mean value of one strike on the base table (52/27/13/5.5/2/0.5 % × 1/2/4/8/16/32). */
  rarityMean: 2.5,
  /** The Council expects this share of the true mean (it plans for an ordinary day). */
  councilExpect: 0.75,
  tallyTolerance: 0.3,
  tallyFloor: 3,
  tallyHeatPerValue: 0.8,
  tallyHeatCap: 12,
  /** A turned overseer forgives this many times the tolerance. */
  overseerTolerance: 2,
  searchPerShortDay: 0.15,
  searchPerCouncil: 0.005,
  searchMax: 0.9,
  /** On a search day, each follower carrying crystals is searched with this chance. */
  searchEach: 0.5,
  /** A carrier's search chance × (1 − Intelligence / searchWit); an offering's spotting × (1 − Intelligence / offerWit). */
  searchWit: 60,
  offerWit: 40,
  searchHeatPerValue: 0.5,
  caughtTaken: 2,
  offerSpot: 0.12,
  offerSpotHeat: 4,
  skimChance: 0.3,
  hungerPerValue: 6,
  /** Dull crystals your grave seeps each dusk (no dead night: always a crystal to decide on). */
  graveSeep: 1,
  /** Rough crystals at the grave on night 1, by tier. */
  startTiers: [0, 0, 1] as readonly number[],
  followerEvilPerMalice: 1 / 200,
  followerEvilMax: 0.4,
  moveBase: 0.85,
  movePerStep: 0.2,
  moveDevotionSpan: 250,
  moveMin: 0.1,
  moveMax: 0.95,
  /** Steps off the usual path at which a Move counts as far (2 AP). */
  moveFarAt: 2,
  moveFailCouncil: 1,
  moveFailDevotion: 2,
  /** The hoard: loose stones above this many draw the Temple (1 per `hoardPer`, at most `hoardCap` a day). */
  hoardFree: 12,
  hoardPer: 4,
  hoardCap: 3,
} as const;

/** Flame stones profaned by an act of evil done where they lie (`profane.ts`): the Temple's heat per stone, at most heatCap. */
export const PROFANE = {
  heat: 4,
  heatCap: 10,
} as const;

/** Ties between people (`ties.ts`). */
export const TIES = {
  /** Whisper odds on someone tied to a follower of yours (kin, a friend, a lover, a workmate). */
  odds: 0.08,
  /** One of theirs devoured by you: each tie who is not yours hardens by this Resistance; each who is yours loses this Devotion. */
  devouredResist: 8,
  devouredDevotion: 8,
  /** … they talk: the town's heat per tie, at most noticeCap; and the colour of the eaten one's home recedes by this Hold. */
  noticeHeat: 1,
  noticeCap: 4,
  devouredHold: 3,
  /** One of theirs taken or burned by the powers: each tie who is not yours softens toward you by this Resistance; */
  takenSoften: 5,
  /** your own followers among them feed your Malice by this each, at most maliceCap. */
  malice: 1,
  maliceCap: 3,
  /** Workmates are tied only in a place of at most this many hands (a gallery's diggers, a stall), never a whole trade. */
  workmatesMax: 12,
} as const;
