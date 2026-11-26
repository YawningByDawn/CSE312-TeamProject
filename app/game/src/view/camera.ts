import type { Camera } from '../types';
import { MINE_FRAME } from '../content/map';

// The one camera over the one world. The world's origin is the mine's heart (its centre in the world frame), so the
// camera's rest pose { x: 0, y: 0, zoom: 1 } is the whole mine. The mine lies in the world frame at 1/MINE_FRAME.per.

/** The world-frame point at the camera's origin: the mine's centre. */
export const ORIGIN = {
  x: MINE_FRAME.x + MINE_FRAME.w / MINE_FRAME.per / 2,
  y: MINE_FRAME.y + MINE_FRAME.h / MINE_FRAME.per / 2,
} as const;

/** The camera that centres on the mine point (x, y) (mine units). */
export function centreOn(x: number, y: number, out: { x: number; y: number }): void {
  out.x = MINE_FRAME.x + x / MINE_FRAME.per - ORIGIN.x;
  out.y = MINE_FRAME.y + y / MINE_FRAME.per - ORIGIN.y;
}

/** Screen px per world unit at zoom 0: a face close up, 2.5 px per mine unit. */
const CLOSE = 15;
/** Octaves of zoom per zoom step: 0 a face, 1 the whole mine, one even curve. */
const OCTAVES = 2.41;

/** Screen (CSS) px per world unit at `zoom`. */
export const scale = (zoom: number): number => CLOSE * 2 ** (-OCTAVES * zoom);

/** The world frame's matrix for a camera on a w x h screen: world (x, y) lands at (a x + e, a y + f). */
export function frameOf(cam: Readonly<Camera>, w: number, h: number, out: { a: number; e: number; f: number }): void {
  const a = scale(cam.zoom);
  out.a = a;
  out.e = w / 2 - (cam.x + ORIGIN.x) * a;
  out.f = h / 2 - (cam.y + ORIGIN.y) * a;
}
