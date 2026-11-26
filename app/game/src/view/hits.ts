import { Circle, Container, type Renderer } from 'pixi.js';
import type { Focus, PlaceId } from '../types';
import { AT } from '../content/map';
import { pit } from './quad';
import { AREAS } from '../content/world';

// The one hit rule (#129): the scene graph's own hit areas. Anything clickable is a container made pickable here with
// the focus it stands for; View.pick asks Pixi for the frontmost one under the point. The places are disks under
// everything (a person in front of a place is hit first): an area's disk reaches halfway to its nearest neighbour
// area, a place's halfway to its nearest neighbour point, so no two of a kind overlap and a place wins over its area.

const FOCUS = new WeakMap<Container, Focus>();

export function pickable<C extends Container>(c: C, f: Focus): C {
  c.eventMode = 'static';
  FOCUS.set(c, f);
  return c;
}

/** The focus of the frontmost pickable thing at a screen point, or null. */
export function hit(renderer: Renderer, x: number, y: number): Focus {
  let o: Container | null = renderer.events.rootBoundary.hitTest(x, y);
  while (o && !FOCUS.has(o)) o = o.parent;
  return o ? FOCUS.get(o)! : null;
}

/** Most of a place's disk, in mine units: a lone place does not swallow the screen. */
const PLACE_R = 70;

/** Every place's disk, in the pit's frame. */
export function placeHits(): Container {
  const mine = pit();
  const ids = Object.keys(AT);
  const near = (p: PlaceId, among: PlaceId[]) => {
    const [x, y] = AT[p]!;
    let d = Infinity;
    for (const o of among) if (o !== p) d = Math.min(d, Math.hypot(AT[o]![0] - x, AT[o]![1] - y));
    return d / 2;
  };
  const areas = ids.filter((p) => AREAS[p]), places = ids.filter((p) => !AREAS[p]);
  // areas first, then places over them
  for (const p of [...areas, ...places]) {
    const r = AREAS[p] ? near(p, areas) : Math.min(PLACE_R, near(p, ids));
    const c = pickable(new Container(), { place: p });
    c.hitArea = new Circle(AT[p]![0], AT[p]![1], r);
    mine.addChild(c);
  }
  return mine;
}
