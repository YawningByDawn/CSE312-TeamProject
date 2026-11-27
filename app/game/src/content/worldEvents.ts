/**
 * The world's events (#53) and the day's feed (#56), data only. Each day at dawn the world rolls the day's events
 * from these: a weekday, the day's weather, a chance and a cooldown in days; some follow another as a chain's step;
 * some echo what the rules just did. An event casts its people, happens at a place within its window of hours since
 * dawn, and opens or closes a door with its effects. Words: `event.<id>.<n>` (words/events.ts).
 */
import type { Activity, Effect, GoneReason, PlaceId, RoleId, StoryId, Weather, Weekday } from '../types';

/**
 * Who an event casts, in order ({name} {name2} {name3}): someone of these trades; anyone; one of the first's ties
 * (`kin` `lover` `rival` `owes`); another of the first's trade (`mate`); a follower of yours; the one the echoed rule
 * names (`them`); or, in a chain's step, the opener's cast member `n`.
 */
export type CastSlot = readonly RoleId[] | 'grown' | 'kin' | 'lover' | 'rival' | 'owes' | 'mate' | 'follower' | 'them' | number;
/**
 * [kind, target, value, days]: on a place, an area, a faction or a person for today and `days` more. Targets: an id,
 * `*`, `@0`..`@2` a cast member, `@all` the cast, `@place` the event's place, `@area` its area, `@work0` the area of
 * the first's work, `@faces` every face. `suspicion` is heat on a faction at once.
 */
export type EventEffect = readonly [kind: Effect['kind'] | 'suspicion', target: string, value: number, days: number];
/** A variant of the words (`event.<id>.<key>.<n>`) and its effects, when today holds it. */
export type Variant = 'fog' | 'rain' | 'bad' | 'unpaid' | 'follower';

export interface WorldEventDef {
  id: StoryId;
  days?: readonly Weekday[];
  /** Weather the day must hold at some hour; weather that keeps it off. */
  weather?: readonly Weather[];
  not?: readonly Weather[];
  /** Per eligible day; 0: only as a chain's step or an echo. */
  chance: number;
  /** Days before it may roll again. */
  cooldown: number;
  /** Every `[n]` weeks, in week `w` of them, on day `d` of the week (0-based). */
  weeks?: readonly [n: number, w: number, d: number];
  cast: readonly CastSlot[];
  /** A place, one drawn from a list, or the work of cast member n (`@work`, `@work1`), or the echo's place. */
  place: PlaceId | readonly PlaceId[] | '@work' | '@work1' | '@them';
  /** Hours since dawn it happens within. */
  at: readonly [number, number];
  effects?: readonly EventEffect[];
  /** [next, days later (min, max), chance]. */
  chain?: readonly [next: StoryId, days: readonly [number, number], p: number];
  /** Rule events it answers: a `GameEvent` kind, or `kind:detail` (lost:<reason>, threat:<kind>, play:<card or kind>, count:short). */
  echo?: readonly string[];
  /** The cast from member `from` on are gone this way (never a follower of yours by chance). */
  gone?: readonly [reason: GoneReason, from: number];
  /** Follows a going: `days` (min, max) after someone went one of these ways, with chance `p`, they are its `them`. */
  follows?: readonly [reasons: readonly GoneReason[], days: readonly [number, number], p: number];
  variant?: readonly [key: Variant, effects?: readonly EventEffect[]];
  gather?: Gather;
}

/**
 * Who comes to an event's place and what they do there, from `at[0]` hours before it happens to `at[1]` after: the
 * cast members `cast` names (all of them if it is unset). Nobody gone comes.
 */
export interface Gather { doing: Activity; at: readonly [before: number, after: number]; cast?: readonly number[] }

const WMP: readonly Weekday[] = ['work', 'cart', 'payday'];

export const WORLD_EVENTS: readonly WorldEventDef[] = [
  // the bunks and the life of the pit
  { id: 'quarrel', chance: 0.3, cooldown: 2, cast: ['grown', 'rival'], place: '@work', at: [5, 11.7], effects: [['whisper', '@0', 0.04, 2]] },
  { id: 'brawl', days: ['payday', 'rest', 'cart'], chance: 0.55, cooldown: 2, cast: ['grown', 'rival'], place: 'pitkitchen', at: [15.5, 16.5], effects: [['guards', 'lift', -2, 0], ['guards', 'bunks', 2, 0], ['search', 'lift', 0.6, 0]], gather: { doing: 'drink', at: [1, 1] } },
  { id: 'debtCalled', days: ['payday'], chance: 0.8, cooldown: 1, cast: ['grown', 'owes'], place: 'overseer', at: [13.7, 14.7], effects: [['whisper', '@0', 0.12, 4]], chain: ['debtThreat', [2, 3], 0.55] },
  { id: 'debtThreat', chance: 0, cooldown: 0, cast: [0, 1], place: 'bunks', at: [15, 16.2], effects: [['whisper', '@0', 0.1, 3], ['notice', 'public', 1.05, 1]] },
  { id: 'loversCaught', chance: 0.08, cooldown: 7, cast: ['grown', 'kin', 'lover'], place: 'bunks', at: [14.7, 16], effects: [['whisper', '@1', 0.14, 6], ['whisper', '@0', 0.06, 3]] },
  // the mine
  { id: 'doubleQuota', days: ['work'], chance: 0.12, cooldown: 7, cast: [['overseer']], place: 'overseer', at: [2, 3], effects: [['strike', '@faces', 1.1, 1], ['whisperZone', '@faces', 0.03, 2], ['countTolerance', '*', 0.85, 1]] },
  { id: 'goodShift', days: ['work', 'cart'], chance: 0.14, cooldown: 4, cast: [['digger']], place: '@work', at: [9.2, 11.7], effects: [['strike', '@place', 1.15, 0]] },
  { id: 'strangeDreams', chance: 0.3, cooldown: 3, cast: [['digger', 'hauler', 'sorter']], place: '@work', at: [1.7, 5], effects: [['whisper', '@0', 0.06, 3], ['whisperZone', '@work0', 0.02, 1]] },
  // pay and the count
  { id: 'payShort', days: ['payday'], chance: 0.18, cooldown: 14, cast: [['overseer']], place: 'overseer', at: [13.8, 14.3], effects: [['whisperZone', 'bunks', 0.05, 3], ['whisperZone', '@faces', 0.03, 3]], chain: ['payMeeting', [1, 1], 0.7] },
  { id: 'payMeeting', chance: 0, cooldown: 0, cast: [['digger', 'hauler', 'sorter']], place: 'pitkitchen', at: [15.3, 16.2], chain: ['payStrike', [1, 1], 0.65], gather: { doing: 'drink', at: [1, 1.5] } },
  { id: 'payStrike', days: WMP, chance: 0, cooldown: 0, cast: [0], place: 'overseer', at: [1.3, 2], effects: [['crew', '@faces', 0.45, 0], ['guards', 'overseer', 3, 0], ['guards', 'lift', -1, 0], ['notice', 'council', 1.2, 1]], chain: ['paySettled', [1, 1], 1] },
  { id: 'paySettled', chance: 0, cooldown: 0, cast: [0], place: 'overseer', at: [1, 1.7], variant: ['unpaid', [['whisper', '@0', 0.08, 6]]] },
  { id: 'quotaRaised', days: ['work', 'payday'], chance: 0.05, cooldown: 16, cast: [['overseer']], place: 'overseer', at: [0.7, 2], effects: [['countTolerance', '*', 0.85, 6], ['whisperZone', '@faces', 0.03, 6]] },
  // the Council
  { id: 'guardRotation', days: ['work', 'rest'], chance: 0.12, cooldown: 7, cast: [['pitguard'], ['overseer']], place: 'lift', at: [0.8, 1.7], effects: [['search', 'lift', 0.8, 3]] },
  { id: 'inspectorNews', days: ['work', 'payday'], chance: 0.06, cooldown: 14, cast: [['overseer']], place: 'overseer', at: [3.3, 5], effects: [['notice', 'council', 1.1, 2]], chain: ['inspectorArrives', [2, 2], 1] },
  { id: 'inspectorArrives', chance: 0, cooldown: 0, cast: [['pitguard']], place: 'lift', at: [1.7, 2.5], effects: [['guards', 'lift', 1, 0]], chain: ['inspectorAtPit', [1, 1], 1] },
  { id: 'inspectorAtPit', chance: 0, cooldown: 0, cast: [['overseer']], place: 'lift', at: [11.7, 12.5], effects: [['countTolerance', '*', 0.6, 0], ['search', 'lift', 1.5, 0], ['guards', 'lift', 2, 0]], chain: ['inspectorLeaves', [1, 1], 1] },
  { id: 'inspectorLeaves', chance: 0, cooldown: 0, cast: [], place: 'lift', at: [1.7, 3.3], effects: [['notice', 'council', 0.85, 2]], variant: ['bad', [['suspicion', 'council', 3, 0]]] },
  // the Temple
  { id: 'sermonGreed', days: ['flame'], chance: 0.6, cooldown: 6, cast: [['chaplain']], place: 'kilnshrine', at: [2, 3.3], effects: [['whisperZone', 'kilnshrine', -0.04, 2], ['notice', 'temple', 1.1, 2]] },
  { id: 'procession', days: ['flame'], chance: 1, cooldown: 1, cast: [['chaplain']], place: 'kilnshrine', at: [8, 8.7], effects: [['crowd', 'kilnshrine', 1.4, 0], ['crowd', 'bunks', 0.6, 0], ['search', 'lift', 0.85, 0]], variant: ['rain', [['notice', 'temple', 0.85, 0]]] },
  { id: 'confession', chance: 0.12, cooldown: 4, cast: ['follower', ['chaplain']], place: 'kilnshrine', at: [14.3, 15.5], effects: [['suspicion', 'temple', 2, 0], ['notice', 'temple', 1.1, 2]] },
  { id: 'titheBurned', days: ['flame'], chance: 0.7, cooldown: 5, cast: [['chaplain']], place: 'kilnshrine', at: [2.5, 5], effects: [['notice', 'temple', 1.1, 0], ['whisperZone', 'kilnshrine', -0.04, 0]] },
  // your people
  { id: 'sleepTalker', chance: 0.12, cooldown: 4, cast: ['follower', 'kin'], place: 'bunks', at: [0.3, 1.3], effects: [['suspicion', 'public', 0.5, 0], ['whisper', '@1', 0.05, 3]] },
  { id: 'followerKindness', chance: 0.15, cooldown: 3, cast: ['follower', 'grown'], place: 'bunks', at: [14.2, 16.2], effects: [['whisper', '@1', 0.1, 5]], gather: { doing: 'talk', at: [1, 1.5] } },
  // echoes of what you did
  { id: 'missing', echo: ['devour'], chance: 0, cooldown: 0, cast: ['them'], place: 'bunks', at: [1, 2.3], effects: [['notice', 'public', 1.1, 3], ['guards', 'bunks', 1, 2], ['suspicion', 'public', 1, 0]] },
  { id: 'takenTalk', echo: ['lost:taken'], chance: 0, cooldown: 0, cast: ['them'], place: 'bunks', at: [1.7, 3], effects: [['whisperZone', 'bunks', 0.03, 3]] },
  { id: 'emptyBurning', not: ['storm'], follows: [['devoured'], [2, 3], 1], chance: 0, cooldown: 0, cast: ['them'], place: 'kilnshrine', at: [9.2, 10.3], effects: [['suspicion', 'public', 1, 0], ['notice', 'public', 1.15, 3], ['notice', 'temple', 1.1, 3]], gather: { doing: 'mourn', at: [0.3, 0.3] } },
  { id: 'searchGrumble', echo: ['search', 'threat:lockdown'], chance: 0, cooldown: 0, cast: [['digger']], place: 'pitkitchen', at: [15, 16], effects: [['whisperZone', 'bunks', 0.04, 2]] },
  { id: 'sermonAfterPurge', echo: ['threat:purge', 'threat:inquisitor'], chance: 0, cooldown: 0, cast: [['chaplain']], place: 'kilnshrine', at: [2.3, 3.7], effects: [['notice', 'temple', 1.2, 2], ['whisperZone', 'kilnshrine', -0.05, 3], ['crowd', 'kilnshrine', 1.6, 0]] },
  { id: 'sabotageInquiry', echo: ['play:sabotage', 'play:robTheCart', 'play:divertedCart'], chance: 0, cooldown: 0, cast: [['overseer'], ['hauler']], place: 'overseer', at: [2.5, 4.2], effects: [['search', 'cartway', 1.3, 2], ['whisper', '@1', 0.08, 3]] },
  { id: 'boltedDoors', echo: ['play:terrorize', 'play:madness', 'play:bloodRite'], chance: 0, cooldown: 0, cast: [], place: '@them', at: [14.2, 15.5], effects: [['whisperZone', '@area', -0.04, 3], ['notice', 'public', 1.1, 3]] },
  { id: 'reconsecration', echo: ['play:desecrate'], chance: 0, cooldown: 0, cast: [['chaplain']], place: 'kilnshrine', at: [3.3, 5], effects: [['notice', 'temple', 1.3, 2], ['whisperZone', 'kilnshrine', -0.05, 3]] },
  { id: 'miracleTalk', echo: ['play:miracle'], chance: 0, cooldown: 0, cast: ['grown'], place: 'pitkitchen', at: [15, 16], effects: [['whisperZone', 'bunks', 0.03, 2], ['notice', 'temple', 1.1, 2]] },
  { id: 'shortCount', echo: ['count:short'], chance: 0, cooldown: 0, cast: [['overseer']], place: 'overseer', at: [2, 3], effects: [['search', 'lift', 1.2, 2], ['whisperZone', '@faces', 0.02, 2]] },
];

/**
 * A day's events: at most `base`, one more on payday, market and the Flame's day, one more by a coin; at least one.
 * Ones that always come on their day roll first.
 */
export const EVENT_DAY = { base: 3, busy: 1, coin: 1 } as const;
/** A chain's step a day's weather or weekday keeps off waits a day, for at most this many days from the opener. */
export const CHAIN_WAIT = 10;
/**
 * The day's feed: at least `min` notes a day, at most `max`; life notes fill the rest from where people are, in the
 * hours (since dawn) of the shift, when someone is at work to be noted (the evening is the bunks' talk).
 */
export const FEED = { min: 8, max: 16, extra: 2, from: 1, to: 12 } as const;
/** A life note's words (`life.<pool>.<n>`): by the place, else by what they are doing. */
export const LIFE_NOTES: {
  at: Readonly<Record<PlaceId, string>>; doing: Readonly<Partial<Record<Activity, string>>>;
} = {
  at: { kilnshrine: 'service', lift: 'queue', overseer: 'pay' },
  doing: { dig: 'work', haul: 'work', sort: 'work', work: 'work', eat: 'eat', pray: 'chapel', guard: 'rounds', search: 'rounds', idle: 'break', mourn: 'mourn' },
};
