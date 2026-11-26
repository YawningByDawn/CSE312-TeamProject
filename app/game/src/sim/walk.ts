/**
 * The host's feet (OVERHAUL, ov-mine): a body walks its heading at its speed over the mine's ground, stopped by rock
 * (`GROUND`) and by the dressing's blocks (`BLOCKS`), sliding along what it meets. Positions are mine units; time is the
 * real seconds of the played day, so a tick is `DAY_TICK_S`.
 */
import { BLOCKS, WALK, areaAt } from '../content/mine';
import type { Body } from '../types';

const rocky = (x: number, y: number): boolean => areaAt(x, y) === null;

const blocked = (x: number, y: number): boolean => {
  for (const b of BLOCKS) if (((x - b.x) / (b.rx + WALK.bodyR)) ** 2 + ((y - b.y) / (b.ry + WALK.bodyR)) ** 2 < 1) return true;
  return false;
};

/** Feet at (x, y) stand free: their circle's centre and eight points on clear ground, outside every block. */
export function clear(x: number, y: number): boolean {
  if (rocky(x, y) || blocked(x, y)) return false;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    if (rocky(x + Math.cos(a) * WALK.bodyR, y + Math.sin(a) * WALK.bodyR)) return false;
  }
  return true;
}

/** `body` (the host's, or a skeleton's) walks its heading `seconds` at `speed` units a second, in steps of at most `WALK.step`; what blocks it, it slides along. */
export function walk(body: Pick<Body, 'x' | 'y' | 'face' | 'dx' | 'dy' | 'walked'>, speed: number, seconds: number): void {
  const len = Math.hypot(body.dx, body.dy);
  if (len === 0) return;
  const ux = body.dx / len, uy = body.dy / len;
  const n = Math.max(1, Math.ceil((speed * seconds) / WALK.step)), k = (speed * seconds) / n;
  const [x0, y0] = [body.x, body.y];
  // the heading, then each axis of it, then the heading turned an eighth either way: the first that stands free
  const c = Math.SQRT1_2;
  const tries = [[ux, uy], [ux, 0], [0, uy], [(ux - uy) * c, (uy + ux) * c], [(ux + uy) * c, (uy - ux) * c]] as const;
  for (let i = 0; i < n; i++) {
    const t = tries.find(([tx, ty]) => (tx !== 0 || ty !== 0) && clear(body.x + tx * k, body.y + ty * k));
    if (!t) break;
    body.x += t[0] * k;
    body.y += t[1] * k;
  }
  body.walked += Math.hypot(body.x - x0, body.y - y0);
  if (ux !== 0) body.face = ux > 0 ? 1 : -1;
}
