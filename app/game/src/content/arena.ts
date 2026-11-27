/**
 * The shared mine (multiplayer, DECISIONS §133): arena.json, which the hub (app/websocket/arena.go) reads too. The mine for
 * n players opens three zones a player (`ARENA.layouts[n - 1]`): each seat is a god's shrine, where its player spawns
 * and gives the crystals they carry, and the three zones of its domain; every other zone is rock. The hub runs the match
 * on these numbers; the game only shows it.
 */
import raw from './arena.json';

export interface ArenaSeat { shrine: readonly [number, number]; zones: readonly string[] }
export interface ArenaRules {
  /** walk speed, mine units a second */ speed: number;
  /** the feet's radius against the walls */ feet: number;
  /** a crystal is picked up within this */ pick: number;
  /** the most crystals one player carries */ carry: number;
  /** crystals are given within this of the own shrine, and no blow lands inside it */ shrine: number;
  /** the first god given this many wins */ goal: number;
  /** crystals on the ground at most: `crystals` + `crystalsEach` a seat */ crystals: number; crystalsEach: number;
  /** seconds between new crystals while under the cap; a new one lies this far from every shrine */ spawnEvery: number; spawnClear: number;
  /** the swing's seconds and its blow's (the host's baked swing clip) */ swing: number; blow: number;
  /** a blow lands within `reach` of the feet and `arc` degrees of the aim */ reach: number; arc: number;
  /** a struck player stands stunned this long, knocked back this far, their crystals scattered within `scatter` */ stun: number; knock: number; scatter: number;
  /** seconds the winner shows before the match ends */ over: number;
}

export const ARENA = raw as unknown as { rules: ArenaRules; layouts: readonly (readonly ArenaSeat[])[] };

/** Each seat's god by its colour (0 is the Hungry One's own violet): its light and its interface's tint. */
export const GOD_COLOURS: readonly number[] = [0xa060ff, 0xff4a5a, 0x3fe0a0, 0xffb030];

/** A colour as CSS. */
export const css = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;
