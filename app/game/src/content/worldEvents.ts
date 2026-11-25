/**
 * The world's events (#53) and the day's feed (#56), data only. Each day at dawn the world rolls the day's events
 * from these: a weekday, the day's weather, a chance and a cooldown in days; some follow another as a chain's step;
 * some echo what the rules just did. An event casts its people, happens at a place within its window of hours since
 * dawn, and opens or closes a door with its effects. Words: `event.<id>.<n>` (words/events.ts).
 */
import type { Activity, Effect, GoneReason, PlaceId, RoleId, StoryId, Weather, Weekday } from '../types';

/**
 * Who an event casts, in order ({name} {name2} {name3}): someone of these trades; anyone grown, an elder, a child;
 * one of the first's household (`kin`) or ties (`lover` `rival` `owes`); another of the first's trade (`mate`); a
 * follower of yours; the one the echoed rule names (`them`); or, in a chain's step, the opener's cast member `n`.
 */
export type CastSlot = readonly RoleId[] | 'grown' | 'old' | 'child' | 'kin' | 'lover' | 'rival' | 'owes' | 'mate' | 'follower' | 'them' | number;
/**
 * [kind, target, value, days]: on a place, an area, a faction or a person for today and `days` more. Targets: an id,
 * `*`, `@0`..`@2` a cast member, `@all` the cast, `@kin0` the first's household and ties, `@place` the event's place,
 * `@area` its area, `@home0`/`@work0` the area of the first's home or work, `@faces` every face. `suspicion` is
 * heat on a faction at once.
 */
export type EventEffect = readonly [kind: Effect['kind'] | 'suspicion', target: string, value: number, days: number];
/** A variant of the words (`event.<id>.<key>.<n>`) and its effects, when today holds it. */
export type Variant = 'mine' | 'fog' | 'rain' | 'bad' | 'unpaid' | 'follower';

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
  /** A place, one drawn from a list, or the home or work of cast member n (`@home`, `@work1`), or the echo's place. */
  place: PlaceId | readonly PlaceId[] | '@home' | '@work' | '@work1' | '@home1' | '@them';
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
  /** Fresh names its words need ({new1} {new2}): a birth, a stranger. */
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
 * cast members `cast` names (all of them if it is unset), the grown of the households of those `house` names, and
 * the households and ties of those `kin` names (at most `GATHER_KIN` of them: guests, mourners). Nobody gone comes.
 */
export interface Gather { doing: Activity; at: readonly [before: number, after: number]; cast?: readonly number[]; house?: readonly number[]; kin?: readonly number[] }
export const GATHER_KIN = 10;

const STRONG: readonly RoleId[] = ['digger', 'hauler', 'porter', 'carter', 'smith', 'tanner', 'butcher', 'mason', 'carpenter', 'ropemaker', 'stablehand', 'soldier', 'ragpicker', 'trackman'];
const HEALER: readonly RoleId[] = ['healer', 'apothecary'];
const FACES5: readonly PlaceId[] = ['heartvein', 'eastworks', 'westdrift', 'lowgallery', 'sump'];
const WMP: readonly Weekday[] = ['work', 'market', 'payday'];

export const WORLD_EVENTS: readonly WorldEventDef[] = [
  // households and the life of the rows
  { id: 'courtship', chance: 0.22, cooldown: 4, cast: ['grown', 'lover'], place: 'well', at: [14.3, 15.8], chain: ['betrothal', [2, 4], 0.7], gather: { doing: 'talk', at: [1, 1] } },
  { id: 'betrothal', chance: 0, cooldown: 0, cast: [0, 1], place: 'tavern', at: [15, 16.2], effects: [['whisper', '@all', -0.04, 3]], chain: ['wedding', [2, 4], 1], gather: { doing: 'drink', at: [1, 1.5] } },
  { id: 'wedding', not: ['storm'], chance: 0, cooldown: 0, cast: [0, 1], place: 'chapel', at: [10, 11], effects: [['crowd', 'highwarrens', 1.4, 0], ['crowd', 'slagrows', 0.8, 0]], gather: { doing: 'pray', at: [1.5, 1.5], kin: [0, 1] } },
  { id: 'labour', chance: 0.16, cooldown: 3, cast: ['grown', ['midwife']], place: '@home', at: [4.2, 7.5], chain: ['birth', [0, 0], 1], gather: { doing: 'talk', at: [0, 3] } },
  { id: 'birth', chance: 0, cooldown: 0, cast: [0, 1], place: '@home', at: [11.7, 13.3], names: 1, effects: [['whisper', '@0', 0.06, 4]], chain: ['wickBlessing', [2, 4], 1] },
  { id: 'wickBlessing', not: ['storm'], chance: 0, cooldown: 0, cast: [0, ['priest', 'acolyte']], place: 'chapel', at: [7.5, 9.2], names: 1, effects: [['whisper', '@0', -0.05, 5], ['notice', 'temple', 1.05, 0]], gather: { doing: 'pray', at: [1.5, 1], kin: [0] } },
  { id: 'oldDeath', chance: 0.07, cooldown: 4, cast: ['old'], place: '@home', at: [0.7, 2], gone: ['dead', 0], chain: ['burning', [1, 2], 1] },
  { id: 'burning', not: ['storm'], chance: 0, cooldown: 0, cast: [0, ['gravedigger']], place: 'graveyard', at: [9.2, 10.3], effects: [['whisper', '@kin0', 0.15, 7]], gather: { doing: 'mourn', at: [1.5, 1], kin: [0] } },
  { id: 'quarrel', chance: 0.3, cooldown: 2, cast: ['grown', 'rival'], place: '@work', at: [5, 11.7], effects: [['whisper', '@0', 0.04, 2]] },
  { id: 'brawl', days: ['payday', 'rest', 'market'], chance: 0.55, cooldown: 2, cast: ['grown', 'rival'], place: 'tavern', at: [15.5, 16.5], effects: [['guards', 'lift', -2, 0], ['guards', 'slagrows', 2, 0], ['search', 'lift', 0.6, 0]], gather: { doing: 'drink', at: [1, 1] } },
  { id: 'debtCalled', days: ['payday'], chance: 0.8, cooldown: 1, cast: ['grown', 'owes'], place: 'pithead', at: [13.7, 14.7], effects: [['whisper', '@0', 0.12, 4]], chain: ['debtThreat', [2, 3], 0.55] },
  { id: 'debtThreat', chance: 0, cooldown: 0, cast: [0, 1], place: '@home', at: [15, 16.2], effects: [['whisper', '@0', 0.1, 3], ['notice', 'public', 1.05, 1]], chain: ['debtPaid', [2, 3], 1] },
  { id: 'debtPaid', chance: 0, cooldown: 0, cast: [0, 1], place: 'pawnshop', at: [6.7, 10] },
  { id: 'lostChild', chance: 0.1, cooldown: 6, cast: ['child', 'kin'], place: 'rows', at: [10, 12], effects: [['guards', 'slagrows', 1, 0], ['whisper', '@1', 0.1, 1]], chain: ['childFound', [1, 1], 1], gather: { doing: 'search', at: [0, 3], cast: [1], house: [0] } },
  { id: 'childFound', chance: 0, cooldown: 0, cast: [0, 1], place: ['lift', 'graveyard', 'haulyard'], at: [0.8, 2.5], variant: ['mine', [['notice', 'public', 1.1, 2], ['whisper', '@0', 0.1, 5]]] },
  { id: 'loversCaught', chance: 0.08, cooldown: 7, cast: ['grown', 'kin', 'lover'], place: '@home', at: [14.7, 16], effects: [['whisper', '@1', 0.14, 6], ['whisper', '@0', 0.06, 3]] },
  { id: 'newArrival', days: ['market', 'work'], chance: 0.07, cooldown: 8, cast: [], place: 'gate', at: [1.7, 3.7], names: 1 },
  { id: 'fever', not: ['clear'], chance: 0.05, cooldown: 12, cast: ['grown', HEALER], place: '@home', at: [3.3, 6.7], effects: [['crew', '@work0', 0.9, 2], ['whisper', '@0', 0.08, 3]], chain: ['feverSpreads', [1, 2], 0.6] },
  { id: 'feverSpreads', chance: 0, cooldown: 0, cast: [0], place: 'rows', at: [5, 8.3], n: [3, 8], effects: [['crew', '@faces', 0.85, 2], ['whisperZone', 'slagrows', 0.05, 3], ['crowd', 'slagrows', 0.7, 2]], chain: ['feverToll', [1, 2], 0.5] },
  { id: 'feverToll', chance: 0, cooldown: 0, cast: ['old'], place: '@home', at: [0.8, 2], gone: ['dead', 0], chain: ['burning', [1, 1], 1] },
  { id: 'apprentice', chance: 0.06, cooldown: 12, cast: ['child', ['smith', 'weaver', 'potter', 'tanner', 'carpenter', 'chandler', 'cutter']], place: '@work1', at: [3.3, 5] },
  // the mine
  { id: 'propCollapse', days: WMP, chance: 0.14, cooldown: 5, cast: [['timberman'], ['digger']], place: FACES5, at: [5, 7.5], effects: [['strike', '@place', 0.6, 0], ['crew', '@place', 0.7, 1]], chain: ['propInquiry', [1, 1], 0.6] },
  { id: 'propInquiry', days: ['work', 'market', 'payday', 'flame'], chance: 0, cooldown: 0, cast: [['overseer'], 0], place: 'overseer', at: [2.5, 4.2], effects: [['whisper', '@1', 0.1, 4]] },
  { id: 'sickBeast', chance: 0.1, cooldown: 7, cast: [['farrier']], place: 'beaststalls', at: [2.5, 5], effects: [['crew', 'cartway', 0.85, 1]], chain: ['beastDies', [1, 2], 0.5] },
  { id: 'beastDies', chance: 0, cooldown: 0, cast: [0], place: 'beaststalls', at: [1.7, 3.3], effects: [['crew', 'cartway', 0.75, 2]] },
  { id: 'skitters', chance: 0.14, cooldown: 6, cast: [['ratcatcher'], ['pitcook']], place: 'pitkitchen', at: [6.7, 8.3], effects: [['whisperZone', 'bunks', 0.03, 2]] },
  { id: 'newSeam', chance: 0.08, cooldown: 8, cast: [['surveyor']], place: ['heartvein', 'eastworks', 'lowgallery'], at: [5.8, 8.3], effects: [['strike', '@place', 1.25, 3], ['guards', '@place', 1, 3]] },
  { id: 'injury', days: WMP, chance: 0.16, cooldown: 3, cast: [['digger'], ['bonesetter']], place: '@work', at: [5.3, 8], effects: [['whisper', '@0', 0.1, 5]] },
  { id: 'doubleQuota', days: ['work'], chance: 0.12, cooldown: 7, cast: [['overseer']], place: 'overseer', at: [2, 3], effects: [['strike', '@faces', 1.1, 1], ['whisperZone', '@faces', 0.03, 2], ['countTolerance', '*', 0.85, 1]] },
  { id: 'badAir', days: ['work', 'market', 'payday', 'flame'], chance: 0.08, cooldown: 6, cast: [['ventman']], place: 'westdrift', at: [3.3, 6.7], effects: [['crew', 'westdrift', 0.5, 0], ['strike', 'westdrift', 0.7, 0]] },
  { id: 'cartDerail', days: WMP, chance: 0.1, cooldown: 5, cast: [['hauler'], ['trackman']], place: 'cartway', at: [6.7, 9.2], effects: [['countTolerance', '*', 1.2, 0]] },
  { id: 'liftJam', days: WMP, chance: 0.06, cooldown: 8, cast: [['winder']], place: 'lift', at: [1.3, 2], effects: [['strike', '@faces', 0.9, 0], ['search', 'lift', 0.8, 0]] },
  { id: 'powderMisfire', days: WMP, chance: 0.05, cooldown: 10, cast: [['powderman']], place: 'lowgallery', at: [5.8, 8.3], effects: [['strike', 'lowgallery', 1.2, 1], ['whisper', '@0', 0.06, 3]] },
  { id: 'goodShift', days: ['work', 'market'], chance: 0.14, cooldown: 4, cast: [['digger']], place: '@work', at: [9.2, 11.7], effects: [['strike', '@place', 1.15, 0]] },
  { id: 'runawayTrain', days: WMP, chance: 0.06, cooldown: 9, cast: [['hauler', 'cartboy'], ['farrier']], place: 'cartway', at: [5, 11.7], effects: [['crew', 'cartway', 0.6, 0], ['crew', 'sorting', 0.8, 0], ['guards', 'lift', -1, 0], ['whisperZone', 'cartway', 0.03, 2]] },
  { id: 'lampMoths', not: ['wind'], chance: 0.12, cooldown: 4, cast: [['lampman', 'lamplighter']], place: ['cartway', 'westdrift', 'rows', 'market'], at: [6.7, 15.8], effects: [['search', '@area', 0.85, 0]] },
  // pay, trade and the roads
  { id: 'peddlerDown', days: ['payday'], chance: 1, cooldown: 1, cast: [['peddler']], place: 'bunks', at: [5, 5.8], effects: [['whisperZone', 'bunks', 0.03, 0]] },
  { id: 'paymaster', days: ['payday'], chance: 1, cooldown: 1, cast: [['overseer'], ['pitclerk']], place: 'pithead', at: [13.3, 13.8], effects: [['crowd', 'minehead', 1.6, 0]] },
  { id: 'caravan', days: ['market'], chance: 0.55, cooldown: 6, cast: [['innkeeper']], place: 'gate', at: [1, 2.3], n: [4, 9], effects: [['crowd', 'market', 1.4, 0], ['whisperZone', 'market', 0.04, 0], ['guards', 'citygate', 1, 0]], chain: ['caravanLeaves', [1, 1], 1] },
  { id: 'caravanLeaves', chance: 0, cooldown: 0, cast: [], place: 'gate', at: [0.8, 1.7], effects: [['countTolerance', '*', 0.9, 0]] },
  { id: 'cartsLeave', days: ['market', 'payday'], chance: 1, cooldown: 1, cast: [['carter']], place: 'gate', at: [1, 1.7], effects: [['guards', 'citygate', 1, 0]] },
  { id: 'thiefMarket', days: ['market', 'rest'], chance: 0.35, cooldown: 3, cast: [['trader', 'baker', 'butcher']], place: 'market', at: [5.8, 9.2], effects: [['guards', 'market', 1, 1]] },
  { id: 'smugglersCaught', chance: 0.06, cooldown: 9, cast: [['smuggler']], place: 'gate', at: [0.8, 2], gone: ['taken', 0], effects: [['notice', 'council', 1.2, 3], ['guards', 'citygate', 2, 3]] },
  { id: 'smuggleRun', weather: ['fog', 'rain', 'storm', 'drizzle'], chance: 0.3, cooldown: 4, cast: [['smuggler']], place: 'road', at: [0.5, 1.3], effects: [['countTolerance', '*', 1.1, 0]], variant: ['fog'] },
  { id: 'breadPrice', days: ['market', 'work'], chance: 0.08, cooldown: 10, cast: [['baker']], place: 'bakery', at: [0.8, 2.5], effects: [['whisperZone', 'slagrows', 0.03, 3], ['notice', 'public', 1.05, 2]] },
  { id: 'stallFeud', days: ['market'], chance: 0.25, cooldown: 4, cast: [['trader'], 'mate'], place: 'market', at: [5, 8.3], effects: [['whisper', '@0', 0.04, 2]] },
  { id: 'payShort', days: ['payday'], chance: 0.18, cooldown: 14, cast: [['overseer']], place: 'pithead', at: [13.8, 14.3], effects: [['whisperZone', 'slagrows', 0.05, 3], ['whisperZone', '@faces', 0.03, 3]], chain: ['payMeeting', [1, 1], 0.7] },
  { id: 'payMeeting', chance: 0, cooldown: 0, cast: [['digger', 'hauler', 'sorter']], place: 'tavern', at: [15.3, 16.2], chain: ['payStrike', [1, 1], 0.65], gather: { doing: 'drink', at: [1, 1.5] } },
  { id: 'payStrike', days: WMP, chance: 0, cooldown: 0, cast: [0], place: 'pithead', at: [1.3, 2], effects: [['crew', '@faces', 0.45, 0], ['guards', 'minehead', 3, 0], ['guards', 'lift', -1, 0], ['notice', 'council', 1.2, 1]], chain: ['paySettled', [1, 1], 1] },
  { id: 'paySettled', chance: 0, cooldown: 0, cast: [0], place: 'pithead', at: [1, 1.7], variant: ['unpaid', [['whisper', '@0', 0.08, 6]]] },
  { id: 'forgeAccident', days: WMP, chance: 0.06, cooldown: 8, cast: [['smith', 'smelter']], place: '@work', at: [6.7, 10], effects: [['whisper', '@0', 0.08, 4]] },
  // the Council
  { id: 'taxCrier', days: ['work', 'market'], chance: 0.1, cooldown: 10, cast: [['crier']], place: 'market', at: [4.2, 5.8], effects: [['whisperZone', 'slagrows', 0.04, 4], ['whisperZone', 'market', 0.03, 4]] },
  { id: 'guardRotation', days: ['work', 'rest'], chance: 0.12, cooldown: 7, cast: [['pitguard'], ['sergeant']], place: 'lift', at: [0.8, 1.7], effects: [['search', 'lift', 0.8, 3]] },
  { id: 'inspectorNews', days: ['work', 'payday'], chance: 0.06, cooldown: 14, cast: [['crier', 'courier']], place: 'councilhall', at: [3.3, 5], effects: [['notice', 'council', 1.1, 2]], chain: ['inspectorArrives', [2, 2], 1] },
  { id: 'inspectorArrives', chance: 0, cooldown: 0, cast: [['magistrate']], place: 'gate', at: [1.7, 2.5], effects: [['guards', 'citygate', 1, 0]], chain: ['inspectorAtPit', [1, 1], 1] },
  { id: 'inspectorAtPit', chance: 0, cooldown: 0, cast: [['overseer']], place: 'lift', at: [11.7, 12.5], effects: [['countTolerance', '*', 0.6, 0], ['search', 'lift', 1.5, 0], ['guards', 'lift', 2, 0]], chain: ['inspectorLeaves', [1, 1], 1] },
  { id: 'inspectorLeaves', chance: 0, cooldown: 0, cast: [], place: 'gate', at: [1.7, 3.3], effects: [['notice', 'council', 0.85, 2]], variant: ['bad', [['suspicion', 'council', 3, 0]]] },
  { id: 'countAudit', days: ['work', 'payday'], chance: 0.06, cooldown: 10, cast: [['tallyclerk', 'pitclerk'], ['sorter']], place: 'tallyhouse', at: [3.3, 8.3], effects: [['countTolerance', '*', 0.75, 1], ['search', 'sorting', 1.3, 1], ['notice', 'council', 1.15, 2]] },
  { id: 'lampsIssued', chance: 0.07, cooldown: 10, cast: [['lampman', 'pitclerk']], place: 'lamphouse', at: [0.5, 1.7], effects: [['search', '*', 1.1, 3]] },
  // the town
  { id: 'washGossip', not: ['rain', 'storm'], chance: 0.3, cooldown: 2, cast: [['washer'], 'grown'], place: 'washplace', at: [3.3, 7.5], effects: [['whisper', '@1', 0.04, 2]], variant: ['follower', [['suspicion', 'public', 1, 0]]] },
  { id: 'elderStory', chance: 0.18, cooldown: 5, cast: ['old'], place: 'well', at: [5, 7.5], effects: [['whisperZone', 'wellsquare', 0.03, 2]] },
  { id: 'childrenDare', chance: 0.14, cooldown: 6, cast: ['child'], place: 'pithead', at: [10, 12.5] },
  { id: 'beastMoult', chance: 0.08, cooldown: 7, cast: ['grown', ['stablehand', 'farrier']], place: 'stables', at: [5, 10], effects: [['whisper', '@0', -0.03, 4], ['crew', 'cartway', 0.92, 0]] },
  // the Temple
  { id: 'sermonGreed', days: ['flame'], chance: 0.6, cooldown: 6, cast: [['highpriest', 'priest']], place: 'temple', at: [2, 3.3], effects: [['whisperZone', 'kilntemple', -0.04, 2], ['notice', 'temple', 1.1, 2]] },
  { id: 'procession', days: ['flame'], chance: 1, cooldown: 1, cast: [['priest']], place: 'templesteps', at: [8, 8.7], effects: [['crowd', 'kilntemple', 1.4, 0], ['crowd', 'slagrows', 0.6, 0], ['search', 'lift', 0.85, 0]], variant: ['rain', [['notice', 'temple', 0.85, 0]]] },
  { id: 'wanderingPreacher', days: ['market', 'work', 'rest'], chance: 0.06, cooldown: 12, cast: [], place: 'templesteps', at: [5, 8.3], effects: [['notice', 'temple', 1.2, 3], ['whisperZone', 'kilntemple', 0.03, 3]], chain: ['preacherDriven', [2, 3], 1] },
  { id: 'preacherDriven', chance: 0, cooldown: 0, cast: [['sergeant']], place: 'gate', at: [1.7, 3.3] },
  { id: 'alms', days: ['rest', 'flame'], chance: 0.35, cooldown: 4, cast: [['acolyte']], place: 'rows', at: [9.2, 10.8], effects: [['whisperZone', 'slagrows', -0.03, 1]] },
  { id: 'confession', chance: 0.12, cooldown: 4, cast: ['follower', ['priest']], place: 'chapel', at: [14.3, 15.5], effects: [['suspicion', 'temple', 2, 0], ['notice', 'temple', 1.1, 2]] },
  { id: 'beggarProphecy', chance: 0.07, cooldown: 8, cast: [['beggar']], place: 'templesteps', at: [4.2, 7.5], effects: [['whisper', '@0', 0.15, 5], ['notice', 'temple', 1.1, 1]] },
  { id: 'festivalPrep', chance: 1, cooldown: 20, weeks: [3, 2, 3], cast: [['weaver']], place: 'templesteps', at: [5, 6.7], chain: ['festival', [2, 2], 1] },
  { id: 'festival', chance: 0, cooldown: 0, cast: [], place: 'temple', at: [9.2, 10], effects: [['crowd', 'kilntemple', 3, 0], ['crowd', 'slagrows', 0.3, 0], ['notice', 'temple', 1.3, 0], ['notice', 'council', 0.8, 0], ['whisperZone', 'slagrows', 0.06, 1]], chain: ['feastMorning', [1, 1], 1] },
  { id: 'feastMorning', chance: 0, cooldown: 0, cast: [], place: 'pithead', at: [1, 1.7], effects: [['crew', '@faces', 0.8, 0]] },
  { id: 'titheBurned', days: ['flame'], chance: 0.7, cooldown: 5, cast: [['priest']], place: 'temple', at: [2.5, 5], effects: [['notice', 'temple', 1.1, 0], ['whisperZone', 'kilntemple', -0.04, 0]] },
  // the war
  { id: 'warNews', days: ['market'], chance: 0.75, cooldown: 5, cast: [['crier', 'courier']], place: 'market', at: [4.2, 6.7], effects: [['notice', 'public', 0.9, 2]] },
  { id: 'quotaRaised', days: ['work', 'payday'], chance: 0.05, cooldown: 16, cast: [['overseer', 'pitclerk']], place: 'pithead', at: [0.7, 2], effects: [['countTolerance', '*', 0.85, 6], ['whisperZone', '@faces', 0.03, 6]] },
  { id: 'levyCalled', chance: 1, cooldown: 6, weeks: [2, 0, 0], cast: [['captain', 'sergeant']], place: 'market', at: [3.3, 5], effects: [['whisperZone', 'slagrows', 0.04, 3], ['whisperZone', 'minehead', 0.03, 3]], chain: ['levyDay', [3, 3], 1] },
  {
    id: 'levyDay', chance: 0, cooldown: 0, cast: [0, STRONG, STRONG, STRONG], place: 'gate', at: [1.3, 2.3], gone: ['conscripted', 1], list: 1,
    effects: [['guards', 'lift', -1, 6], ['guards', 'minehead', -1, 6], ['guards', 'market', -1, 6], ['guards', 'garrison', -2, 6], ['search', '*', 0.85, 6], ['crew', '@faces', 0.9, 6], ['whisperZone', 'slagrows', 0.05, 4], ['whisper', '@kin1', 0.15, 7]],
    gather: { doing: 'mourn', at: [1.5, 0.5], kin: [1, 2, 3] },
  },
  { id: 'woundedHome', not: ['storm'], chance: 0.05, cooldown: 12, cast: [HEALER], place: 'inn', at: [10, 12.5], names: 1, effects: [['notice', 'public', 0.9, 1], ['crowd', 'citygate', 1.8, 0]] },
  { id: 'refugees', not: ['storm'], chance: 0.06, cooldown: 9, cast: [['innkeeper', 'watchman']], place: 'road', at: [5, 9.2], names: 2, effects: [['crowd', 'citygate', 1.3, 0]] },
  // the weather
  { id: 'floodSouthLoop', weather: ['rain', 'storm'], chance: 0.45, cooldown: 3, cast: [['pumpman']], place: 'lowgallery', at: [6.7, 12.5], effects: [['crew', 'lowgallery', 0.6, 0], ['crew', 'sump', 0.7, 0], ['search', 'lowgallery', 0.7, 0]] },
  { id: 'lightning', weather: ['storm'], chance: 0.35, cooldown: 10, cast: [['winder']], place: 'pithead', at: [8.3, 15.8], effects: [['liftStop', 'lift', 1, 0], ['whisperZone', 'minehead', 0.04, 1]] },
  { id: 'roofTorn', weather: ['wind', 'storm'], chance: 0.3, cooldown: 4, cast: ['grown'], place: '@home', at: [5, 15], effects: [['whisper', '@0', 0.06, 3]], gather: { doing: 'work', at: [0, 2], house: [0] } },
  { id: 'fogCarter', weather: ['fog'], chance: 0.45, cooldown: 3, cast: [['carter']], place: 'road', at: [0.8, 5.8], effects: [['search', 'citygate', 0.7, 0], ['search', '*', 0.9, 0]] },
  { id: 'frost', weather: ['cold'], chance: 0.25, cooldown: 6, cast: ['old', HEALER], place: '@home', at: [0.3, 1.7], effects: [['crew', 'lift', 0.9, 0]] },
  { id: 'windBells', weather: ['wind'], chance: 0.4, cooldown: 3, cast: [], place: 'pithead', at: [3.3, 10], effects: [['reach', '*', 1, 0]] },
  { id: 'rainTavern', weather: ['rain'], chance: 0.4, cooldown: 2, cast: [['tavernkeeper']], place: 'tavern', at: [9.2, 15], effects: [['whisperZone', 'slagrows', 0.03, 0], ['crowd', 'slagrows', 1.15, 0]] },
  // your people
  { id: 'sleepTalker', chance: 0.12, cooldown: 4, cast: ['follower', 'kin'], place: '@home', at: [0.3, 1.3], effects: [['suspicion', 'public', 0.5, 0], ['whisper', '@1', 0.05, 3]] },
  { id: 'followerKindness', chance: 0.15, cooldown: 3, cast: ['follower', 'grown'], place: '@home1', at: [14.2, 16.2], effects: [['whisper', '@1', 0.1, 5]], gather: { doing: 'talk', at: [1, 1.5] } },
  { id: 'strangeDreams', chance: 0.3, cooldown: 3, cast: [['digger', 'hauler', 'sorter', 'timberman', 'lampman']], place: '@work', at: [1.7, 5], effects: [['whisper', '@0', 0.06, 3], ['whisperZone', '@work0', 0.02, 1]] },
  // echoes of what you did
  { id: 'missing', echo: ['devour'], chance: 0, cooldown: 0, cast: ['them'], place: '@home', at: [1, 2.3], effects: [['notice', 'public', 1.1, 3], ['guards', 'slagrows', 1, 2], ['suspicion', 'public', 1, 0]] },
  { id: 'takenTalk', echo: ['lost:taken', 'exposed'], chance: 0, cooldown: 0, cast: ['them'], place: '@home', at: [1.7, 3], effects: [['whisperZone', '@home0', 0.03, 3], ['whisper', '@kin0', 0.12, 5]] },
  { id: 'emptyBurning', not: ['storm'], follows: [['devoured'], [2, 3], 1], chance: 0, cooldown: 0, cast: ['them'], place: 'graveyard', at: [9.2, 10.3], effects: [['whisper', '@kin0', 0.15, 7], ['suspicion', 'public', 1, 0], ['notice', 'public', 1.15, 3], ['notice', 'temple', 1.1, 3]], gather: { doing: 'mourn', at: [0.3, 0.3], kin: [0] } },
  { id: 'trial', follows: [['taken'], [2, 2], 0.7], chance: 0, cooldown: 0, cast: ['them', ['magistrate']], place: 'councilhall', at: [5, 6.7], effects: [['crowd', 'tallyhall', 2, 0], ['notice', 'council', 1.15, 2]] },
  { id: 'searchGrumble', echo: ['search', 'threat:lockdown'], chance: 0, cooldown: 0, cast: [['digger']], place: 'tavern', at: [15, 16], effects: [['whisperZone', 'slagrows', 0.04, 2]] },
  { id: 'sermonAfterPurge', echo: ['threat:purge', 'threat:ward', 'threat:inquisitor'], chance: 0, cooldown: 0, cast: [['highpriest', 'priest']], place: 'temple', at: [2.3, 3.7], effects: [['notice', 'temple', 1.2, 2], ['whisperZone', 'kilntemple', -0.05, 3], ['crowd', 'kilntemple', 1.6, 0]] },
  { id: 'rescueDig', echo: ['play:caveIn'], chance: 0, cooldown: 0, cast: [['timberman']], place: '@them', at: [1.3, 2.3], effects: [['strike', '@area', 0.5, 1], ['notice', 'public', 1.15, 2]] },
  { id: 'sickWater', echo: ['play:badWater'], chance: 0, cooldown: 0, cast: [HEALER], place: 'well', at: [3.3, 5.8], effects: [['crew', '@faces', 0.8, 2], ['whisperZone', 'slagrows', 0.04, 3], ['notice', 'public', 1.1, 2]] },
  { id: 'sabotageInquiry', echo: ['play:sabotage', 'play:robTheCart', 'play:divertedCart'], chance: 0, cooldown: 0, cast: [['overseer'], ['hauler']], place: 'overseer', at: [2.5, 4.2], effects: [['search', 'cartway', 1.3, 2], ['whisper', '@1', 0.08, 3]] },
  { id: 'curfew', echo: ['play:riot'], chance: 0, cooldown: 0, cast: [['captain']], place: 'rows', at: [1.7, 3.3], effects: [['guards', 'slagrows', 2, 3], ['crowd', 'slagrows', 0.6, 3], ['whisperZone', 'slagrows', 0.03, 3]] },
  { id: 'boltedDoors', echo: ['play:terrorize', 'play:madness', 'play:bloodRite'], chance: 0, cooldown: 0, cast: [], place: '@them', at: [14.2, 15.5], effects: [['whisperZone', '@area', -0.04, 3], ['notice', 'public', 1.1, 3]] },
  { id: 'reconsecration', echo: ['play:desecrate'], chance: 0, cooldown: 0, cast: [['priest']], place: 'kilnshrine', at: [3.3, 5], effects: [['notice', 'temple', 1.3, 2], ['whisperZone', 'kilnshrine', -0.05, 3]] },
  { id: 'stateBurning', echo: ['play:assassinate'], chance: 0, cooldown: 0, cast: ['them'], place: 'temple', at: [8.3, 9.7], effects: [['guards', 'tallyhall', 2, 4], ['guards', 'lift', 1, 4], ['notice', 'council', 1.25, 4]] },
  { id: 'miracleTalk', echo: ['play:miracle'], chance: 0, cooldown: 0, cast: ['grown'], place: 'tavern', at: [15, 16], effects: [['whisperZone', 'slagrows', 0.03, 2], ['notice', 'temple', 1.1, 2]] },
  { id: 'shortCount', echo: ['count:short'], chance: 0, cooldown: 0, cast: [['overseer']], place: 'overseer', at: [2, 3], effects: [['search', 'lift', 1.2, 2], ['whisperZone', '@faces', 0.02, 2]] },
];

/**
 * A day's events: at most `base`, one more on payday, market and the Flame's day, one more by a coin; at least one.
 * Ones that always come on their day roll first.
 */
export const EVENT_DAY = { base: 3, busy: 1, coin: 1 } as const;
/** A chain's step a day's weather or weekday keeps off waits a day, for at most this many days from the opener. */
export const CHAIN_WAIT = 10;
/** The day's feed: at least `min` notes a day, at most `max`; life notes fill the rest from where people are. */
export const FEED = { min: 8, max: 16, extra: 2, from: 1, to: 15 } as const;
/**
 * A life note's words (`life.<pool>.<n>`): by the trade, else by the place, else by what they are doing; a ride
 * is `liftDown` or `liftUp`, someone idle while the weather keeps people in is `shelter`.
 */
export const LIFE_NOTES: {
  role: Readonly<Record<RoleId, string>>; at: Readonly<Record<PlaceId, string>>; doing: Readonly<Partial<Record<Activity, string>>>;
} = {
  role: { beggar: 'beg', trader: 'sell', midwife: 'tend', healer: 'tend' },
  at: { well: 'well', temple: 'service', school: 'school', drillyard: 'drill', lift: 'queue', pithead: 'pay' },
  doing: {
    dig: 'work', haul: 'work', sort: 'work', work: 'work', eat: 'eat', drink: 'tavern', talk: 'family', pray: 'chapel', preach: 'preach',
    guard: 'rounds', search: 'rounds', trade: 'market', wash: 'wash', play: 'play', idle: 'break', mourn: 'mourn',
  },
};
