/**
 * The mine on foot (OVERHAUL, ov-mine): how the host walks, which ground and dressing stop them, the ores they work, the
 * grades an ore gives, the drop they deliver to and the pocket's limit. Rules: src/sim/dig.ts and src/sim/walk.ts.
 * Lengths are mine units (map.ts); the day's real seconds pass as `DAY_SECONDS` over the day's ticks (clock.ts).
 */
import rawWalk from './walk.json';
import { DRESS, digSpots } from './map';
import { AREAS, PLACES } from './world';
import type { PlaceId } from '../types';

export const MINING = {
  /** Seconds an ore of tier 1, 2, 3 takes at Strength 10 and Dexterity 10: divided by the speed term, the mean of Strength and Dexterity over `norm`. */
  seconds: [10, 18, 30] as readonly number[],
  norm: 10,
  /** Mining rarity = 1 + this × Devotion / 100: it multiplies a grade's non-dull odds (x1.5 at Devotion 100). */
  rarityPerDevotion: 0.5,
  /** Percent chance of each grade above dull (clear, bright, blazing) by ore tier at rarity 1; dull is what is left. Royal and impossible never come from this mine. */
  odds: [[8.5, 1.5, 0], [12.5, 2.4, 0.1], [15, 4.5, 0.5]] as readonly (readonly number[])[],
  /** Ore sites sit in the face of the wall nearest each digger's standing spot, at least this far apart. */
  spacing: 70,
  /** How far from a digger's spot a face is looked for; the rock (ground cells) a face rises straight up from its foot, the north walls the view shows standing; how far a seam keeps from each light the lit picture paints (a crystal cluster, a torch, a lamp). */
  face: { search: 120, rise: 6, clear: 28 },
  /** How near the host must stand to an ore to work it. */
  reach: 36,
} as const;

export const WALK = {
  /** Units a second at Dexterity 10, and the share of it each point of Dexterity adds or takes. */
  speed: 60,
  perDexterity: 0.05,
  /** The feet's radius, and the farthest a step goes before the ground is looked at again. */
  bodyR: 5,
  step: 3,
  /** A lamp, brazier or tally lamp stops a circle of this radius × its size. */
  flameR: 16,
  /** The crystal heart's footprint below its light: down, half-width, half-depth. */
  heart: { dy: 55, rx: 105, ry: 14 },
  /** The grave's pit and the lift's shaft: the rim added to the hole. */
  rim: 6,
  /** The lift's shaft (the drop's mouth): its centre and half-axes in the lit picture. */
  shaft: { x: 1997, y: 250, rx: 34, ry: 22 },
} as const;

/** The pit's drop: where a miner delivers a stone, the lift's shaft, from this near. */
export const DROP = { x: WALK.shaft.x, y: WALK.shaft.y, reach: 80 } as const;

/** What a stone's keeping costs: the day's most a miner may pocket unseen, and the Town's heat (Public) for each stone over it and for each ore of the quota unmet. */
export const POCKET = { free: 3, heatEach: 3, shortEach: 1.5 } as const;

/**
 * The colour threshold: an area is gray once the host has stood in it and takes colour once enough acts there (a stone
 * struck or delivered, a mark made, a skeleton slain) on enough different days cross a number the player never sees. Each
 * area's own number is drawn from `acts` by the seed, and each coloured neighbour multiplies it by `ease`. Rules: src/sim/colour.ts.
 */
export const COLOUR = { acts: [4, 7], days: 2, ease: 0.7 } as const;

/** An ellipse that stops the feet: a prop or a set piece from the dress data. */
export interface Block { x: number; y: number; rx: number; ry: number }

/** The ground: `zone[row * gw + col]` is the index in `areas` of the area whose ground a cell of `cell` units is, `ROCK` where it is rock (baked from the fog table's walkable ground, assets/fog/mine). */
export const ROCK = 255;
export const GROUND = ((): { cell: number; gw: number; gh: number; areas: readonly PlaceId[]; zone: Uint8Array } => {
  const zone = new Uint8Array(rawWalk.gw * rawWalk.gh);
  let at = 0;
  for (let i = 0; i < rawWalk.runs.length; i += 2) {
    zone.fill(rawWalk.runs[i]!, at, at + rawWalk.runs[i + 1]!);
    at += rawWalk.runs[i + 1]!;
  }
  return { cell: rawWalk.cell, gw: rawWalk.gw, gh: rawWalk.gh, areas: rawWalk.zones, zone };
})();

/** The area whose ground lies at (x, y), or null on rock. */
export function areaAt(x: number, y: number): PlaceId | null {
  const c = Math.floor(x / GROUND.cell), r = Math.floor(y / GROUND.cell);
  const z = c < 0 || r < 0 || c >= GROUND.gw || r >= GROUND.gh ? ROCK : GROUND.zone[r * GROUND.gw + c]!;
  return z === ROCK ? null : GROUND.areas[z]!;
}

/** The dressing that stops a walker, all from `DRESS`: the crystal heart, the grave's pit, the lift's shaft, the shrine's fire, and each lamp and brazier. */
export const BLOCKS: readonly Block[] = [
  { x: DRESS.points.crystalHeart.x, y: DRESS.points.crystalHeart.y + WALK.heart.dy, rx: WALK.heart.rx, ry: WALK.heart.ry },
  { x: DRESS.points.graveEye.x, y: DRESS.points.graveEye.y, rx: DRESS.points.graveEye.rx + WALK.rim, ry: DRESS.points.graveEye.ry + WALK.rim },
  { x: WALK.shaft.x, y: WALK.shaft.y, rx: WALK.shaft.rx + WALK.rim, ry: WALK.shaft.ry + WALK.rim },
  { x: DRESS.points.shrineFire.x, y: DRESS.points.shrineFire.y, rx: WALK.flameR, ry: WALK.flameR },
  ...DRESS.flames.filter((f) => f.kind !== 'candle').map((f) => ({ x: f.x, y: f.y, rx: WALK.flameR * f.size, ry: WALK.flameR * f.size })),
];

/** An ore in the wall: the foot of its seam, where the wall's face meets the ground, and its tier (1..3, the depth of its area). */
export interface OreSite { x: number; y: number; tier: number; place: PlaceId }

/**
 * The foot of the shown wall face nearest (x, y) within `face.search`, or null: the top edge of a ground cell, on a run of
 * `area`'s ground three cells wide and two deep, under rock that rises `face.rise` cells straight up over it and its neighbours,
 * `face.clear` from every painted light. Such a wall is one the 3/4 view shows standing, its face up the screen from the foot.
 */
function faceFoot(x: number, y: number, area: PlaceId): [number, number] | null {
  const { search, rise, clear } = MINING.face, c = GROUND.cell;
  const rock = (col: number, row: number): boolean => areaAt((col + 0.5) * c, (row + 0.5) * c) === null;
  const own = (col: number, row: number): boolean => areaAt((col + 0.5) * c, (row + 0.5) * c) === area;
  const ground = (col: number, row: number): boolean => [-1, 0, 1].every((k) => own(col + k, row) && own(col + k, row + 1));
  const wall = (col: number, row: number): boolean => rock(col, row - 1) && [-1, 0, 1].every((k) => Array.from({ length: rise - 1 }, (_, i) => rock(col + k, row - 2 - i)).every(Boolean));
  let best: number = search, at: [number, number] | null = null;
  for (let row = Math.floor((y - search) / c); row * c <= y + search; row++) for (let col = Math.floor((x - search) / c); col * c <= x + search; col++) {
    const fx = (col + 0.5) * c, fy = row * c, d = Math.hypot(fx - x, fy - y);
    if (d < best && ground(col, row) && wall(col, row) && DRESS.lights.every((l) => Math.hypot(l.x - fx, l.y - fy) >= clear)) [best, at] = [d, [fx, fy]];
  }
  return at;
}

/** Ores in the shown wall faces by the diggers' spots: the face's foot nearest each dig spot of the map, kept `spacing` from the ores before it; tier by the face's depth. */
export const ORE_SITES: readonly OreSite[] = ((): OreSite[] => {
  const out: OreSite[] = [];
  for (const [place, spots] of digSpots()) {
    const area = PLACES[place]?.area ?? place, tier = Math.min(MINING.seconds.length, AREAS[area]!.depth);
    for (let i = 0; i < spots.length; i += 3) {
      const foot = faceFoot(spots[i]!, spots[i + 1]!, area);
      if (foot && out.every((o) => Math.hypot(o.x - foot[0], o.y - foot[1]) >= MINING.spacing)) out.push({ x: foot[0], y: foot[1], tier, place });
    }
  }
  return out;
})();
