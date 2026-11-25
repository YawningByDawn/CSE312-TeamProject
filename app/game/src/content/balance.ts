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
  /** A vein holds this many crystals per point of richness before it is worked out. */
  veinReservePerRichness: 6,

  // --- god ---
  /** Ichor the fallen god wakes with (max is 10 + 2(L−1); it starts wounded). */
  startIchor: 8,
  /** Ichor regained on each level-up (growing stronger closes old wounds). */
  levelUpHeal: 2,
  startHunger: 30,
  hungerRiseBase: 4,
  /** Hunger rises by one more per this many follower heads (a bigger flock, a bigger appetite). */
  hungerPerFollowers: 4,
  hungerPerCrystal: 10,
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
  /** Crystals eaten in one go that make a gorge (#16: gorging gains Ichor). */
  gorgeCrystals: 5,

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
  /** Crowds close ranks: a gathered group whispered to as one resists as its mean plus this, at most groupResistCap. */
  groupResist: 5,
  groupResistCap: 60,
  /** Effective Resistance is clamped to 0..this. */
  resistanceCap: 100,
  /** The mine grows wary: +this Resistance for everyone unconverted, per follower head beyond `warinessFree`. */
  warinessPerFollower: 3.5,
  warinessFree: 2,
  /** Conversion odds lose Resistance / this. */
  oddsResistDivisor: 200,
  /** Whispers a night = Presence + this. */
  whispersPerNightBase: 1,
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
  kilnResistStrong: 15,
  kilnResistWeak: 8,
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
  /** Spreading the word (a sent follower) stains half again as much. */
  holdSpread: 1.5,
  /** Town blocks are bigger: a follower's stain counts this much there. */
  holdTown: 0.5,
  /** Pushback per Day: the Flame's ward in its area / next to it; each non-follower guard, overseer or priest per half-day present; a hunter; a raid. */
  wardPush: 6,
  wardPushNear: 2,
  watcherPush: 3,
  hunterPush: 8,
  raidPush: 25,
  /** A guard or overseer who stands on ground at least this soaked notices (Council heat +stainNoticeGov). */
  stainNoticeAt: 50,
  stainNoticeGov: 0.5,
  /** Devotion base per Day: living their life and praying / sent away. */
  prayDevotion: 5,
  /** Odds bonus for whispering to a sleeper. */
  sleeperBonus: 0.12,
  /** Share of mine workers (diggers, haulers, sorters) on the night shift. */
  nightShiftShare: 0.3,
  /** Share of mine workers who sleep up top in Miners' Rows (the rest in the bunks). */
  townHomeShare: 0.4,
  /** Shade: XP each Day per 100 Hold of the town (the town's colour feeds the god). */
  xpTownHoldPerDay: 2.5,
  /** A whisper that turns someone stains their area at once by this much (the ripple). */
  convertHold: 6,

  // --- territory ---
  /** Rooted out: no followers, no area not anchored with Hold at least this, and nobody in reach. */
  rootedOutHold: 10,
  /** Lit areas counted in the odds term (0.04 × min(lit areas, cap)). */
  presenceOddsCap: 6,
  /** Malice at which Malice "matters" (introduced; evil acts can unlock at level III). */
  maliceMattersAt: 40,
  /** Ichor torn away when territory is lost. */
  zoneLostIchor: 1,
  /** At most this much Ichor can be lost in a single Dawn (no one-night wipe-outs). */
  ichorLossCapPerDawn: 3,

  // --- suspicion ---
  /** Suspicion cools by this each Dawn at Divinity 1 ... */
  suspicionDecay: 2,
  /** ... and this much less per level above 1 (the mine stops forgetting as you grow), never below `suspicionDecayMin`. */
  suspicionDecayPerLevel: 0.15,
  suspicionDecayMin: 1,
  /** The mob (public Hostile) beats this many followers (the riot one more); each loses this much health. */
  mobVictims: 2,
  /** The Inquisitor's song: Devotion lost by each exposed follower in its zone (pious: more). */
  cantorSong: 10,
  cantorSongPious: 15,
  /** Whether the song alone can make a follower lapse. */
  cantorCanLapse: 0,
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
  /** Galleries an inspection walks (picked by 1 + inspectFlockWeight × your followers there); the grave once the Council is at inspectGraveAt. */
  inspectStops: 3,
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
  /** Ichor lost when a relic of yours is found and destroyed. */
  relicIchor: 1,
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
  eventChance: 0.6,

  // --- stages (the stage advances in place) ---
  /** Highest level reachable before the pit head has taken root (L4 needs it; XP keeps banking). */
  whisperLevelCap: 3,
  /** Level at which the stage becomes Shade (with the surface reached). */
  shadeLevel: 4,
  /** Level that ends this build (with the town gate Active). */
  winLevel: 7,
  /** Merge rule (§13.2): mine followers at this Devotion or more may stay individual as Apostles. */
  apostleDevotion: 70,
  apostleMax: 4,
  /** At the stage advance every Suspicion track cools to at most this (the deep's hunters lose your new shape). */
  shadeBreather: 40,
  /** At the stage advance the town opens (Sensed) this many steps around the pit head. */
  shadeRevealRadius: 2,

  // --- the open world (DECISIONS ### P4a) ---
  /** Public drift multiplier for a follower standing in a town block (the mine is 1). */
  townExposure: 2,
  /** The market square and the well: everyone comes, everyone talks. */
  marketExposure: 3,
  /** The shanties: nobody counts who sleeps there. */
  shantyExposure: 1.25,
  /** Temple eyes: cult Suspicion per follower head per Dawn in the temple and the high houses. */
  templeCultPerHead: 1.2,
  /** The graveyard is the Temple's ground too. */
  graveyardCultPerHead: 0.5,
  /** Council patrols: government Suspicion per follower head per Dawn in the Keep. */
  keepGovPerHead: 1.2,
  /** A strike on a group takes this share of its heads (at least 1) instead of the whole crowd. */
  groupStrikeShare: 0.25,
  /** XP for a converted group: xpFollower × S^0.85 × this. */
  xpGroupMult: 0.6,
  /** XP for a converted Elite. */
  xpElite: 60,
  /** A turned Elite cools its faction's track once by this much. */
  eliteTurnCool: 15,
  /** Each Elite you hold cools their faction's track by this every Dawn. */
  eliteDecay: 2,
  /** XP for a town block first made Active territory (a mine area pays xpZone). */
  xpTownZone: 30,
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
  /** Strike chance × (1 + (Strength − 50) / strengthSpan). */
  strengthSpan: 250,
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
  lieLowCool: 1.5,
  lieLowCap: 4,
  echoDevotion: 40,
  /** The hoard: loose stones above this many draw the Temple (1 per `hoardPer`, at most `hoardCap` a day). */
  hoardFree: 12,
  hoardPer: 4,
  hoardCap: 3,
  // --- Shade (the town): the tithe and the vault ---
  /** Rolls per head of a turned town crowd (coin, trinkets, stones off the carts). */
  titheTown: 0.08,
  /** Chance each tithe roll brings a crystal. */
  titheChance: 0.5,
  /** At most this many tithe rolls a day from one group. */
  titheMaxPerGroup: 5,
  /** The vault in the tally hall: a guaranteed Impossible crystal, plus this many Royal. */
  vaultRoyal: 1,
  /** The Council's heat when it finds its vault opened (its writ follows). */
  vaultCouncil: 25,
} as const;

/** Preach and Stand watch (spec §8; `preach.ts`). */
export const PREACH = {
  /** A preacher's listener comes over by themselves with the whisper odds × this, each Day. */
  turn: 0.25,
  /** Devotion of one who came over to a preacher. */
  devotion: 20,
  /** Resistance a listener loses when they do not come over. */
  soften: 2,
  /** Temple heat per preacher a Day (all preachers together at most heatCap); the town hears this share of it. */
  heat: 1.5,
  heatCap: 6,
  publicShare: 0.5,
  /** Nights a watcher who warned everyone rests before they can watch again. */
  watchRest: 3,
} as const;

/** Flame stones profaned by an act of evil done where they lie (`profane.ts`): the Temple's heat per stone, at most heatCap. */
export const PROFANE = {
  heat: 4,
  heatCap: 10,
} as const;

/** Ties between people (`ties.ts`). */
export const TIES = {
  /** Whisper odds on someone tied to a follower of yours (kin, a friend, a lover, their household, a workmate)… */
  odds: 0.08,
  /** … and more while that follower preaches. */
  preachOdds: 0.12,
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

/** The town's people (docs/town.md §2, §4). A gathered group resists by `BALANCE.groupResist` more. */
export const TOWN = {
  /** A master of a building is an Elite: this much harder to turn than their trade. */
  masterResist: 10,
  /** XP for turning a master who is not an officer of the three powers (officers pay `BALANCE.xpElite`). */
  masterXp: 20,
  /** XP for an ordinary townsperson = `BALANCE.xpFollower` × this. */
  commonerXpMult: 0.6,
  /** An ordinary watcher (a soldier, a priest of the crowd) pushes this share of a named one's colour back. */
  commonerWatch: 0.3,
  /** A group is gathered when at least this share of its living members (and at least gatherMin) are at one place. */
  gatherShare: 0.5,
  gatherMin: 2,
  /** An area with at least this many ordinary people not yours holds a crowd (Sermon of Ash, Riot). */
  crowdAt: 4,
  /** The one sent to carry out a pending move is on their guard: this much harder to turn until it lands. */
  agentGuard: 20,
  /** Trades of a place without working there (a child at school, an elder at the well, a beggar on the steps): never a building's hands. */
  notWorkers: ['child', 'elder', 'beggar'] as readonly string[],
} as const;
