/**
 * What every area hides until it is found (DECISIONS §14.5, §106). Words: `discovery.<area>.hint` while the area is
 * seen, `.text` when it is found; a loner's `.loner` (name) and `.bio`.
 */
import type { CardId, DiscoveryKind, FactionId, PlaceId } from '../types';

export interface DiscoveryDef {
  kind: DiscoveryKind;
  /** cache: crystals found, each rolled with `cacheLuck`. A seam adds one seam to the area's vein. */
  crystals?: number;
  /** shortcut: the new edge it opens. */
  link?: [PlaceId, PlaceId];
  /** relic: the miracle it puts in a free hand. */
  miracle?: CardId;
  /** danger: the heat its finding raises. */
  heat?: { track: FactionId; amount: number };
}

export const DISCOVERY_NUMBERS = {
  /** Luck of a cache's rolls. */
  cacheLuck: 25,
  /** Resistance of a found loner (they want to be found). */
  lonerResistance: 5,
} as const;

export const DISCOVERIES: Readonly<Record<PlaceId, DiscoveryDef>> = {
  grave: { kind: 'none' },
  heartvein: { kind: 'seam' },
  cartway: { kind: 'cache', crystals: 2 },
  westdrift: { kind: 'loner' },
  kilnshrine: { kind: 'danger', heat: { track: 'temple', amount: 5 } },
  bunks: { kind: 'cache', crystals: 1 },
  overseer: { kind: 'danger', heat: { track: 'council', amount: 5 } },
  lift: { kind: 'none' },
  sorting: { kind: 'cache', crystals: 2 },
  eastworks: { kind: 'shortcut', link: ['eastworks', 'lift'] },
  lowgallery: { kind: 'relic', miracle: 'dreamDirective' },
  sump: { kind: 'seam' },
};
