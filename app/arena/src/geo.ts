import type { Biome, Circle, World } from './types';

// Where things are, from the map the hub sends: the coast, the biome borders, and which biome a point lies in. The
// same lines as the server's (app/websocket/biome.go), so both agree.

export const BIOME_NAME: Record<Biome, string> = {
  meadow: 'The Fernlands',
  swamp: 'Mirewood',
  volcano: 'Ashen Peaks',
  tundra: 'Frostmarch',
  ocean: 'The Deep Blue',
};

export const BIOME_HINT: Record<Biome, string> = {
  meadow: 'Ferns, ginkgo trees and nests: a gentle place to grow',
  swamp: 'Tar pits and murky ponds: big creatures bog down here',
  volcano: 'Lava burns all but the fireproof and the fliers',
  tundra: 'Ice sends all but its own creatures sliding',
  ocean: 'Kelp hides the small; islands strand the sea-born',
};

export const within = (set: Circle[], x: number, y: number): boolean => set.some((k) => Math.abs(x - k.x) < k.r && Math.hypot(x - k.x, y - k.y) < k.r);

export function coastX(w: World, y: number): number {
  const f = Math.max(0, Math.min(w.h, y)) / w.coastStep;
  const i = Math.min(Math.floor(f), w.coast.length - 2);
  return w.coast[i]! + (w.coast[i + 1]! - w.coast[i]!) * (f - i);
}

export function along(line: number[], step: number, v: number): number {
  const f = Math.max(0, v) / step;
  const i = Math.min(Math.floor(f), line.length - 2);
  return line[i]! + (line[i + 1]! - line[i]!) * (f - i);
}

export function biomeAt(w: World, x: number, y: number): Biome {
  if (x > coastX(w, y) && !within(w.islands, x, y)) return 'ocean';
  if (y < along(w.edges.volcano, w.edges.step, x)) return 'volcano';
  if (y > along(w.edges.tundra, w.edges.step, x)) return 'tundra';
  if (x < along(w.edges.swamp, w.edges.step, y)) return 'swamp';
  return 'meadow';
}
