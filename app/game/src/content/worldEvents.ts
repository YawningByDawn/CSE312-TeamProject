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
  /** Fresh names its words need ({new1} {new2}): a stranger. */
  names?: number;
  /** {n} rolled in this range. */
  n?: readonly [number, number];
  /** {list}: the names of the cast from member `list` on, and {n} how many. */
  list?: number;
  variant?: readonly [key: Variant, effects?: readonly EventEffect[]];
  gather?: Gather;
}

/**
 * Who comes to an event's place and what they do there, from `at[0]` hours before it happens to `at[1]` after: the
 * cast members `cast` names (all of them if it is unset). Nobody gone comes.
 */
export interface Gather { doing: Activity; at: readonly [before: number, after: number]; cast?: readonly number[] }

const HEALER: readonly RoleId[] = ['bonesetter'];
const FACES5: readonly PlaceId[] = ['heartvein', 'eastworks', 'westdrift', 'lowgallery', 'sump'];
const WMP: readonly Weekday[] = ['work', 'cart', 'payday'];

export const WORLD_EVENTS: readonly WorldEventDef[] = [
  // the bunks and the life of the pit
  { id: 'quarrel', chance: 0.3, cooldown: 2, cast: ['grown', 'rival'], place: '@work', at: [5, 11.7], effects: [['whisper', '@0', 0.04, 2]] },
  { id: 'brawl', days: ['payday', 'rest', 'cart'], chance: 0.55, cooldown: 2, cast: ['grown', 'rival'], place: 'pitkitchen', at: [15.5, 16.5], effects: [['guards', 'lift', -2, 0], ['guards', 'bunks', 2, 0], ['search', 'lift', 0.6, 0]], gather: { doing: 'drink', at: [1, 1] } },
  { id: 'debtCalled', days: ['payday'], chance: 0.8, cooldown: 1, cast: ['grown', 'owes'], place: 'overseer', at: [13.7, 14.7], effects: [['whisper', '@0', 0.12, 4]], chain: ['debtThreat', [2, 3], 0.55] },
  { id: 'debtThreat', chance: 0, cooldown: 0, cast: [0, 1], place: 'bunks', at: [15, 16.2], effects: [['whisper', '@0', 0.1, 3], ['notice', 'public', 1.05, 1]] },
  { id: 'loversCaught', chance: 0.08, cooldown: 7, cast: ['grown', 'kin', 'lover'], place: 'bunks', at: [14.7, 16], effects: [['whisper', '@1', 0.14, 6], ['whisper', '@0', 0.06, 3]] },
  { id: 'newArrival', days: ['cart', 'work'], chance: 0.07, cooldown: 8, cast: [], place: 'lift', at: [1.7, 3.7], names: 1 },
  { id: 'fever', not: ['clear'], chance: 0.05, cooldown: 12, cast: ['grown', HEALER], place: 'bunks', at: [3.3, 6.7], effects: [['crew', '@work0', 0.9, 2], ['whisper', '@0', 0.08, 3]], chain: ['feverSpreads', [1, 2], 0.6] },
  { id: 'feverSpreads', chance: 0, cooldown: 0, cast: [0], place: 'bunks', at: [5, 8.3], n: [3, 8], effects: [['crew', '@faces', 0.85, 2], ['whisperZone', 'bunks', 0.05, 3], ['crowd', 'bunks', 0.7, 2]] },
  // the mine
  { id: 'propCollapse', days: WMP, chance: 0.14, cooldown: 5, cast: [['timberman'], ['digger']], place: FACES5, at: [5, 7.5], effects: [['strike', '@place', 0.6, 0], ['crew', '@place', 0.7, 1]], chain: ['propInquiry', [1, 1], 0.6] },
  { id: 'propInquiry', days: ['work', 'cart', 'payday', 'flame'], chance: 0, cooldown: 0, cast: [['overseer'], 0], place: 'overseer', at: [2.5, 4.2], effects: [['whisper', '@1', 0.1, 4]] },
  { id: 'sickBeast', chance: 0.1, cooldown: 7, cast: [['farrier']], place: 'beaststalls', at: [2.5, 5], effects: [['crew', 'cartway', 0.85, 1]], chain: ['beastDies', [1, 2], 0.5] },
  { id: 'beastDies', chance: 0, cooldown: 0, cast: [0], place: 'beaststalls', at: [1.7, 3.3], effects: [['crew', 'cartway', 0.75, 2]] },
  { id: 'beastMoult', chance: 0.08, cooldown: 7, cast: ['grown', ['farrier']], place: 'beaststalls', at: [5, 10], effects: [['whisper', '@0', -0.03, 4], ['crew', 'cartway', 0.92, 0]] },
  { id: 'skitters', chance: 0.14, cooldown: 6, cast: [['ratcatcher'], ['pitcook']], place: 'pitkitchen', at: [6.7, 8.3], effects: [['whisperZone', 'bunks', 0.03, 2]] },
  { id: 'newSeam', chance: 0.08, cooldown: 8, cast: [['surveyor']], place: ['heartvein', 'eastworks', 'lowgallery'], at: [5.8, 8.3], effects: [['strike', '@place', 1.25, 3], ['guards', '@place', 1, 3]] },
  { id: 'injury', days: WMP, chance: 0.16, cooldown: 3, cast: [['digger'], ['bonesetter']], place: '@work', at: [5.3, 8], effects: [['whisper', '@0', 0.1, 5]] },
  { id: 'doubleQuota', days: ['work'], chance: 0.12, cooldown: 7, cast: [['overseer']], place: 'overseer', at: [2, 3], effects: [['strike', '@faces', 1.1, 1], ['whisperZone', '@faces', 0.03, 2], ['countTolerance', '*', 0.85, 1]] },
  { id: 'badAir', days: ['work', 'cart', 'payday', 'flame'], chance: 0.08, cooldown: 6, cast: [['ventman']], place: 'westdrift', at: [3.3, 6.7], effects: [['crew', 'westdrift', 0.5, 0], ['strike', 'westdrift', 0.7, 0]] },
  { id: 'cartDerail', days: WMP, chance: 0.1, cooldown: 5, cast: [['hauler'], ['trackman']], place: 'cartway', at: [6.7, 9.2], effects: [['countTolerance', '*', 1.2, 0]] },
  { id: 'liftJam', days: WMP, chance: 0.06, cooldown: 8, cast: [['winder']], place: 'lift', at: [1.3, 2], effects: [['strike', '@faces', 0.9, 0], ['search', 'lift', 0.8, 0]] },
  { id: 'powderMisfire', days: WMP, chance: 0.05, cooldown: 10, cast: [['powderman']], place: 'lowgallery', at: [5.8, 8.3], effects: [['strike', 'lowgallery', 1.2, 1], ['whisper', '@0', 0.06, 3]] },
  { id: 'goodShift', days: ['work', 'cart'], chance: 0.14, cooldown: 4, cast: [['digger']], place: '@work', at: [9.2, 11.7], effects: [['strike', '@place', 1.15, 0]] },
  { id: 'runawayTrain', days: WMP, chance: 0.06, cooldown: 9, cast: [['hauler', 'cartboy'], ['farrier']], place: 'cartway', at: [5, 11.7], effects: [['crew', 'cartway', 0.6, 0], ['crew', 'sorting', 0.8, 0], ['guards', 'lift', -1, 0], ['whisperZone', 'cartway', 0.03, 2]] },
  { id: 'lampMoths', not: ['wind'], chance: 0.12, cooldown: 4, cast: [['lampman']], place: ['cartway', 'westdrift', 'bunks'], at: [6.7, 15.8], effects: [['search', '@area', 0.85, 0]] },
  { id: 'floodSouthLoop', weather: ['rain', 'storm'], chance: 0.45, cooldown: 3, cast: [['pumpman']], place: 'lowgallery', at: [6.7, 12.5], effects: [['crew', 'lowgallery', 0.6, 0], ['crew', 'sump', 0.7, 0], ['search', 'lowgallery', 0.7, 0]] },
  { id: 'strangeDreams', chance: 0.3, cooldown: 3, cast: [['digger', 'hauler', 'sorter', 'timberman', 'lampman']], place: '@work', at: [1.7, 5], effects: [['whisper', '@0', 0.06, 3], ['whisperZone', '@work0', 0.02, 1]] },
  // pay and the count
  { id: 'paymaster', days: ['payday'], chance: 1, cooldown: 1, cast: [['overseer'], ['pitclerk']], place: 'overseer', at: [13.3, 13.8], effects: [['crowd', 'overseer', 1.6, 0]] },
  { id: 'cartsLeave', days: ['cart', 'payday'], chance: 1, cooldown: 1, cast: [['cartboy']], place: 'lift', at: [1, 1.7], effects: [['guards', 'lift', 1, 0]] },
  { id: 'payShort', days: ['payday'], chance: 0.18, cooldown: 14, cast: [['overseer']], place: 'overseer', at: [13.8, 14.3], effects: [['whisperZone', 'bunks', 0.05, 3], ['whisperZone', '@faces', 0.03, 3]], chain: ['payMeeting', [1, 1], 0.7] },
  { id: 'payMeeting', chance: 0, cooldown: 0, cast: [['digger', 'hauler', 'sorter']], place: 'pitkitchen', at: [15.3, 16.2], chain: ['payStrike', [1, 1], 0.65], gather: { doing: 'drink', at: [1, 1.5] } },
  { id: 'payStrike', days: WMP, chance: 0, cooldown: 0, cast: [0], place: 'overseer', at: [1.3, 2], effects: [['crew', '@faces', 0.45, 0], ['guards', 'overseer', 3, 0], ['guards', 'lift', -1, 0], ['notice', 'council', 1.2, 1]], chain: ['paySettled', [1, 1], 1] },
  { id: 'paySettled', chance: 0, cooldown: 0, cast: [0], place: 'overseer', at: [1, 1.7], variant: ['unpaid', [['whisper', '@0', 0.08, 6]]] },
  { id: 'quotaRaised', days: ['work', 'payday'], chance: 0.05, cooldown: 16, cast: [['overseer', 'pitclerk']], place: 'overseer', at: [0.7, 2], effects: [['countTolerance', '*', 0.85, 6], ['whisperZone', '@faces', 0.03, 6]] },
  // the Council
  { id: 'guardRotation', days: ['work', 'rest'], chance: 0.12, cooldown: 7, cast: [['pitguard'], ['overseer']], place: 'lift', at: [0.8, 1.7], effects: [['search', 'lift', 0.8, 3]] },
  { id: 'inspectorNews', days: ['work', 'payday'], chance: 0.06, cooldown: 14, cast: [['overseer']], place: 'overseer', at: [3.3, 5], effects: [['notice', 'council', 1.1, 2]], chain: ['inspectorArrives', [2, 2], 1] },
  { id: 'inspectorArrives', chance: 0, cooldown: 0, cast: [['pitguard']], place: 'lift', at: [1.7, 2.5], effects: [['guards', 'lift', 1, 0]], chain: ['inspectorAtPit', [1, 1], 1] },
  { id: 'inspectorAtPit', chance: 0, cooldown: 0, cast: [['overseer']], place: 'lift', at: [11.7, 12.5], effects: [['countTolerance', '*', 0.6, 0], ['search', 'lift', 1.5, 0], ['guards', 'lift', 2, 0]], chain: ['inspectorLeaves', [1, 1], 1] },
  { id: 'inspectorLeaves', chance: 0, cooldown: 0, cast: [], place: 'lift', at: [1.7, 3.3], effects: [['notice', 'council', 0.85, 2]], variant: ['bad', [['suspicion', 'council', 3, 0]]] },
  { id: 'countAudit', days: ['work', 'payday'], chance: 0.06, cooldown: 10, cast: [['pitclerk'], ['sorter']], place: 'overseer', at: [3.3, 8.3], effects: [['countTolerance', '*', 0.75, 1], ['search', 'sorting', 1.3, 1], ['notice', 'council', 1.15, 2]] },
  { id: 'lampsIssued', chance: 0.07, cooldown: 10, cast: [['lampman', 'pitclerk']], place: 'overseer', at: [0.5, 1.7], effects: [['search', '*', 1.1, 3]] },
  // the Temple
  { id: 'sermonGreed', days: ['flame'], chance: 0.6, cooldown: 6, cast: [['chaplain']], place: 'kilnshrine', at: [2, 3.3], effects: [['whisperZone', 'kilnshrine', -0.04, 2], ['notice', 'temple', 1.1, 2]] },
  { id: 'procession', days: ['flame'], chance: 1, cooldown: 1, cast: [['chaplain']], place: 'kilnshrine', at: [8, 8.7], effects: [['crowd', 'kilnshrine', 1.4, 0], ['crowd', 'bunks', 0.6, 0], ['search', 'lift', 0.85, 0]], variant: ['rain', [['notice', 'temple', 0.85, 0]]] },
  { id: 'confession', chance: 0.12, cooldown: 4, cast: ['follower', ['chaplain']], place: 'kilnshrine', at: [14.3, 15.5], effects: [['suspicion', 'temple', 2, 0], ['notice', 'temple', 1.1, 2]] },
  { id: 'festivalPrep', chance: 1, cooldown: 20, weeks: [3, 2, 3], cast: [['ashboy']], place: 'kilnshrine', at: [5, 6.7], chain: ['festival', [2, 2], 1] },
  { id: 'festival', chance: 0, cooldown: 0, cast: [], place: 'kilnshrine', at: [9.2, 10], effects: [['crowd', 'kilnshrine', 3, 0], ['crowd', 'bunks', 0.3, 0], ['notice', 'temple', 1.3, 0], ['notice', 'council', 0.8, 0], ['whisperZone', 'bunks', 0.06, 1]], chain: ['feastMorning', [1, 1], 1] },
  { id: 'feastMorning', chance: 0, cooldown: 0, cast: [], place: 'bunks', at: [1, 1.7], effects: [['crew', '@faces', 0.8, 0]] },
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
  { id: 'rescueDig', echo: ['play:caveIn'], chance: 0, cooldown: 0, cast: [['timberman']], place: '@them', at: [1.3, 2.3], effects: [['strike', '@area', 0.5, 1], ['notice', 'public', 1.15, 2]] },
  { id: 'sickWater', echo: ['play:badWater'], chance: 0, cooldown: 0, cast: [HEALER], place: 'pitkitchen', at: [3.3, 5.8], effects: [['crew', '@faces', 0.8, 2], ['whisperZone', 'bunks', 0.04, 3], ['notice', 'public', 1.1, 2]] },
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
/** A life note's words (`life.<pool>.<n>`): by the trade, else by the place, else by what they are doing. */
export const LIFE_NOTES: {
  role: Readonly<Partial<Record<RoleId, string>>>; at: Readonly<Record<PlaceId, string>>; doing: Readonly<Partial<Record<Activity, string>>>;
} = {
  role: { bonesetter: 'tend' },
  at: { kilnshrine: 'service', lift: 'queue', overseer: 'pay' },
  doing: { dig: 'work', haul: 'work', sort: 'work', work: 'work', eat: 'eat', pray: 'chapel', guard: 'rounds', search: 'rounds', idle: 'break', mourn: 'mourn' },
};
