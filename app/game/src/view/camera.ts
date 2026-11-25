import type { Camera } from '../types';
import { MINE_FRAME } from '../content/map';

// The one camera over the one world. World units are town units; the world's origin is the mine's heart (the pit's
// centre in the town frame), so the camera's rest pose { x: 0, y: 0, zoom: 1 } is the whole mine. The mine lies in the
// pit at 1/MINE_FRAME.per; the valley spreads around the town.

/** The town-frame point at the world's origin: the mine's centre. */
export const ORIGIN = {
  x: MINE_FRAME.x + MINE_FRAME.w / MINE_FRAME.per / 2,
  y: MINE_FRAME.y + MINE_FRAME.h / MINE_FRAME.per / 2,
} as const;

/** Screen px per town unit at zoom 0: a face close up, 2.5 px per mine unit. */
const CLOSE = 15;
/** Octaves of zoom per zoom step: 0 a face, 1 the mine, 2 the town, 3 the valley, one even curve. */
const OCTAVES = 2.41;

/** Screen (CSS) px per world unit at `zoom`. */
export const scale = (zoom: number): number => CLOSE * 2 ** (-OCTAVES * zoom);

/** The town frame's matrix for a camera on a w x h screen: town (x, y) lands at (a x + e, a y + f). */
export function frameOf(cam: Readonly<Camera>, w: number, h: number, out: { a: number; e: number; f: number }): void {
  const a = scale(cam.zoom);
  out.a = a;
  out.e = w / 2 - (cam.x + ORIGIN.x) * a;
  out.f = h / 2 - (cam.y + ORIGIN.y) * a;
}

/**
 * How far below ground the camera is, 0..1, from the zoom alone: 1 inside the mine (the surface black around it), 0
 * on the surface (the mine shut under the pit head). The one cross-fade of the one zoom.
 */
export function below(zoom: number): number {
  const t = Math.min(1, Math.max(0, (DESCENT[1] - zoom) / (DESCENT[1] - DESCENT[0])));
  return t * t * (3 - 2 * t);
}
/** The zooms the descent spans: below the first the mine alone, above the second the surface alone. */
export const DESCENT = [1.15, 1.6] as const;
