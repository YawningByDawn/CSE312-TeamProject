/**
 * The fight (OVERHAUL, ov-combat): the host's pick swing on a click, and the skeletons that come out of the mine's dark
 * to hunt the host. A skeleton has only Hit Points and a blow, both rising by the day. Times are real seconds of the
 * played day (a tick of it is `DAY_TICK_S`); lengths are mine units (map.ts); the swings are the baked clips' own
 * (assets/poses `swing:*`: the host's 0.62 s with its blow at 0.26, the skeleton's 0.95 s at 0.399). Rules: src/sim/fight.ts.
 */
export const COMBAT = {
  host: {
    /** The swing's length and the second of it the blow lands; Dexterity changes neither. */
    swing: 0.62,
    blow: 0.26,
    /** What the blow reaches: from the feet this far (a skeleton's body counts `radius` more) and within this half-angle of the aim. */
    reach: 34,
    halfArc: Math.PI / 3,
    /** Damage = this × Strength (20 at 10). */
    perStrength: 2,
  },
  skeleton: {
    /** Hit Points and the blow's damage on the first day, and what each later day adds. */
    hp: 30,
    hpPerDay: 5,
    damage: 6,
    damagePerDay: 1.5,
    /** Units a second; the swing's length and its blow's second; the reach of the blow from the feet; the body's radius. */
    speed: 40,
    swing: 0.95,
    blow: 0.399,
    reach: 26,
    radius: 6,
    /** The chance a slain one drops Nether, and how much. */
    dropChance: 0.5,
    drop: 2,
  },
  spawn: {
    /** The chance each tick of the played day that one comes, while fewer than `max` stand. */
    chance: 0.012,
    max: 3,
    /** Where it appears: this far from the host, out past the lit ground (the tries to find clear ground). */
    near: 240,
    far: 400,
    tries: 8,
    /** One left this far behind, or walking this many seconds without getting on (rock between), is lost in the dark. */
    leash: 700,
    lost: 4,
  },
  /** Seconds a slain one lies falling apart (the baked `collapse`, 1.6 s) before it is gone. */
  corpse: 1.8,
} as const;
