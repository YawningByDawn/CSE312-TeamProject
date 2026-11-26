/** Where a place lies on content's world graph (#50): its area. A leaf, importing content only, that the rules and the world both read. */
import { AREAS, PLACES } from '../../content/world';
import type { PlaceId } from '../../types';

/** The area a place is in. */
export const area = (p: PlaceId): PlaceId => PLACES[p]?.area ?? p;
export const areaDef = (p: PlaceId) => AREAS[area(p)]!;
