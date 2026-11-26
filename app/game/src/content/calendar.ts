/**
 * The seven-day week (spec §5b). Day 0 of a run is the first work day of week 1.
 * Words: `day.<index>.name`, `.line`; why for each effect, `calendar.<weekday>.<kind>.<target>`; `calendar.cartDay`.
 */
import type { PlaceId, Weekday } from '../types';

/** What a day of the calendar does to the rules, read by the world each day. */
export type CalendarEffectKind = 'countTolerance' | 'guards' | 'crowd' | 'whisperZone' | 'notice' | 'crew' | 'search';
export interface CalendarEffect { kind: CalendarEffectKind; target: PlaceId | '*'; value: number }

export interface DayDef {
  kind: Weekday;
  /** The shift-end count is held. */
  count: boolean;
  /** The crystal carts leave for the city: the load is weighed twice. */
  carts: boolean;
}

export const WEEK: readonly DayDef[] = [
  { kind: 'work', count: true, carts: false },
  { kind: 'work', count: true, carts: false },
  { kind: 'cart', count: true, carts: true },
  { kind: 'work', count: true, carts: false },
  { kind: 'payday', count: true, carts: true },
  { kind: 'flame', count: true, carts: false },
  { kind: 'rest', count: false, carts: false },
];

/** A cart day: the load is weighed twice before it leaves. */
export const CART_DAY: CalendarEffect = { kind: 'countTolerance', target: '*', value: 0.75 };

const FACES: PlaceId[] = ['heartvein', 'eastworks', 'westdrift', 'lowgallery', 'sump', 'grave'];

export const CALENDAR_EFFECTS: Readonly<Record<Weekday, readonly CalendarEffect[]>> = {
  work: [],
  cart: [
    { kind: 'guards', target: 'lift', value: 1 },
    { kind: 'crowd', target: 'lift', value: 1.6 },
  ],
  payday: [
    { kind: 'guards', target: 'overseer', value: 1 },
    { kind: 'crowd', target: 'overseer', value: 1.5 },
    { kind: 'whisperZone', target: 'overseer', value: 0.05 },
    { kind: 'notice', target: 'public', value: 1.1 },
  ],
  flame: [
    ...FACES.map((z): CalendarEffect => ({ kind: 'crew', target: z, value: 0.5 })),
    { kind: 'guards', target: 'kilnshrine', value: 2 },
    { kind: 'guards', target: 'lift', value: -1 },
    { kind: 'crowd', target: 'kilnshrine', value: 2.5 },
    { kind: 'notice', target: 'temple', value: 1.2 },
  ],
  rest: [
    ...FACES.map((z): CalendarEffect => ({ kind: 'crew', target: z, value: 0.25 })),
    { kind: 'guards', target: 'lift', value: -1 },
    { kind: 'guards', target: 'overseer', value: -1 },
    { kind: 'search', target: 'lift', value: 0.6 },
    { kind: 'crowd', target: 'bunks', value: 1.6 },
  ],
};
