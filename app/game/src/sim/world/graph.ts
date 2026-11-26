/**
 * Routes on content's one world graph (#50): the mine's tunnels join its areas; a place lies inside one area. A
 * shortcut discovery, once found, adds its edge (content's DISCOVERIES `link`), so the graph a state reads is the base
 * graph plus the shortcuts it has found, each such graph built once.
 * A route runs from a place through the areas between to a place, and takes content's travel ticks: a hop from area
 * to area, and a step between two places of one area.
 */
import { DISCOVERIES } from '../../content/discoveries';
import { AREAS, AREA_EDGES, TRAVEL } from '../../content/world';
import type { GameState, PlaceId } from '../../types';
import { area } from './area';

const IDS = Object.keys(AREAS);
const N = IDS.length;
const INDEX = new Map(IDS.map((id, i) => [id, i]));
/** The shortcuts: the area that hides each, and the edge it opens. */
const SHORTCUTS = Object.entries(DISCOVERIES).filter(([, d]) => d.kind === 'shortcut').map(([a, d]) => [a, d.link!] as const);

/** One graph: each area's neighbours; dist[a * N + b] ticks between areas; next[a * N + b] the first step from a toward b. */
interface Graph { nbrs: Readonly<Record<PlaceId, readonly PlaceId[]>>; dist: Float64Array; next: Int32Array }

function build(mask: number): Graph {
  const edges = [...AREA_EDGES, ...SHORTCUTS.filter((_, i) => mask & (1 << i)).map(([, e]) => e)];
  const nbrs: Record<PlaceId, PlaceId[]> = {};
  for (const id of IDS) nbrs[id] = [];
  const dist = new Float64Array(N * N).fill(Infinity);
  const next = new Int32Array(N * N).fill(-1);
  for (let i = 0; i < N; i++) { dist[i * N + i] = 0; next[i * N + i] = i; }
  for (const [a, b] of edges) {
    nbrs[a]!.push(b);
    nbrs[b]!.push(a);
    const i = INDEX.get(a)!, j = INDEX.get(b)!, w = TRAVEL.hop;
    dist[i * N + j] = dist[j * N + i] = w;
    next[i * N + j] = j;
    next[j * N + i] = i;
  }
  for (let k = 0; k < N; k++)
    for (let i = 0; i < N; i++)
      for (let j = 0; j < N; j++) {
        const d = dist[i * N + k]! + dist[k * N + j]!;
        if (d < dist[i * N + j]!) { dist[i * N + j] = d; next[i * N + j] = next[i * N + k]!; }
      }
  return { nbrs, dist, next };
}

const GRAPHS: Graph[] = [build(0)];
/** The graph of the shortcuts `s` has found. */
function graphOf(s: Readonly<GameState>): Graph {
  let mask = 0;
  for (let i = 0; i < SHORTCUTS.length; i++) if (s.places[SHORTCUTS[i]![0]]?.found) mask |= 1 << i;
  return (GRAPHS[mask] ??= build(mask));
}

/** An area's neighbours, the found shortcuts' among them. */
export const nbrs = (s: Readonly<GameState>, a: PlaceId): readonly PlaceId[] => graphOf(s).nbrs[a] ?? [];

/** The shortest route between two places, by the shortcuts `s` has found, and its length in ticks; an empty path when there is no way. */
export function route(s: Readonly<GameState>, from: PlaceId, to: PlaceId): { path: PlaceId[]; ticks: number } {
  if (from === to) return { path: [from], ticks: 0 };
  const { dist, next } = graphOf(s);
  const A = area(from), B = area(to);
  const i0 = INDEX.get(A), j = INDEX.get(B);
  if (i0 === undefined || j === undefined) return { path: [], ticks: 0 };
  const path = [from];
  for (let i = i0; ; i = next[i * N + j]!) {
    if (path[path.length - 1] !== IDS[i]) path.push(IDS[i]!);
    if (i === j) break;
  }
  if (path[path.length - 1] !== to) path.push(to);
  const ends = (from !== A ? 1 : 0) + (to !== B ? 1 : 0);
  return { path, ticks: dist[i0 * N + j]! + (A === B ? TRAVEL.within : ends * TRAVEL.within) };
}
