/**
 * Where a place lies on content's world graph (#50): its area (a home lot `home:<area>:<slot>` stands in its area)
 * and its region. A leaf, importing content only, that the rules and the world both read.
 */
import { HOME_SLOTS } from '../../content/day';
import { AREAS, PLACES } from '../../content/world';
import type { PlaceId } from '../../types';

/** Every home lot's area, resolved once. */
const HOME_AREA = new Map<PlaceId, PlaceId>();
for (const a in HOME_SLOTS) for (let i = 0; i < HOME_SLOTS[a]!; i++) HOME_AREA.set(`home:${a}:${i}`, a);
/** The area a place is in. */
export const area = (p: PlaceId): PlaceId => PLACES[p]?.area ?? HOME_AREA.get(p) ?? p;
export const areaDef = (p: PlaceId) => AREAS[area(p)]!;
export const inMine = (p: PlaceId): boolean => areaDef(p).region === 'mine';
