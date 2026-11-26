/** Where a person stands in the mine (mine units) at a tick: their spot at a place, or the point of their route's lines reached by the clock. */
import { AT, spotsOf, way } from '../../content/map';
import type { Person, Tick } from '../../types';

export function xyOf(p: Readonly<Person>, t: Tick): { x: number; y: number } {
  const w = p.at;
  if ('place' in w) {
    const spots = spotsOf(w.place, w.doing);
    if (!spots) return { x: AT[w.place]![0], y: AT[w.place]![1] };
    const i = (w.spot % (spots.length / 3)) * 3;
    return { x: spots[i]!, y: spots[i + 1]! };
  }
  const line: number[] = [];
  for (let i = 0; i < w.route.length - 1; i++) line.push(...way(w.route[i]!, w.route[i + 1]!));
  if (line.length < 4) return { x: line[0] ?? AT[w.route[0]!]![0], y: line[1] ?? AT[w.route[0]!]![1] };
  let total = 0;
  for (let i = 2; i < line.length; i += 2) total += Math.hypot(line[i]! - line[i - 2]!, line[i + 1]! - line[i - 1]!);
  let d = Math.min(1, Math.max(0, (t - w.from) / Math.max(1, w.to - w.from))) * total;
  for (let i = 2; i < line.length; i += 2) {
    const seg = Math.hypot(line[i]! - line[i - 2]!, line[i + 1]! - line[i - 1]!);
    if (d <= seg || i === line.length - 2) {
      const k = seg === 0 ? 1 : Math.min(1, d / seg);
      return { x: line[i - 2]! + (line[i]! - line[i - 2]!) * k, y: line[i - 1]! + (line[i + 1]! - line[i - 1]!) * k };
    }
    d -= seg;
  }
  return { x: line[0]!, y: line[1]! };
}
