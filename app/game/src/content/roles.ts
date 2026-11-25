/**
 * Every person's trade (#48): one table for the rules and the days. ~80 mine hands in 24 trades, ~410 townsfolk
 * in 51, and the town's Elites. `count` is the trade's headcount in the society, the named people included.
 * Words: `role.<id>.name`, `.plural`, `.line`.
 */
import type { FactionId, PlaceId, Region, RoleId, Standing } from '../types';

export interface RoleDef {
  side: Region;
  standing: Standing;
  /** Contribution to base Resistance. */
  resistance: number;
  /** Stat bias added to the 25–70 roll: [strength, intelligence, cunning]. */
  bias: readonly [number, number, number];
  /** The power they serve: a watcher's eyes, an Elite's faction (turning them cools it by `BALANCE.eliteTurnCool`). */
  serves: FactionId | null;
  /** Watches for the power they serve: pushes colour back, notices, searches. */
  watches: boolean;
  /** What the rules count of their work: a digger strikes, a hauler pushes the carts, a sorter weighs the count. */
  labour: 'dig' | 'haul' | 'sort' | null;
  /** Candidate work places. */
  work: readonly PlaceId[];
  shift: 'day' | 'night' | 'mixed';
  /** Walks these places in order during work. */
  rounds: readonly PlaceId[] | null;
  count: number;
  /** Works outdoors: weather sends them to shelter. */
  outdoor: boolean;
  /** Extra areas of whisper reach a follower of this trade brings. */
  reach: number;
}

type Opt = Partial<Pick<RoleDef, 'standing' | 'serves' | 'watches' | 'labour' | 'rounds' | 'outdoor' | 'reach'>>;
const r = (side: Region, resistance: number, bias: RoleDef['bias'], work: readonly PlaceId[], shift: RoleDef['shift'], count: number, o: Opt = {}): RoleDef => ({
  side, standing: 'mortal', resistance, bias, serves: null, watches: false, labour: null, work, shift, rounds: null, count, outdoor: false, reach: 0, ...o,
});

const FACES: PlaceId[] = ['heartvein', 'eastworks', 'westdrift', 'lowgallery', 'sump', 'grave'];
const MINE_ROUND: PlaceId[] = ['westdrift', 'cartway', 'heartvein', 'eastworks', 'sorting', 'lowgallery'];
const STREET_ROUND: PlaceId[] = ['pithead', 'rows', 'haulyard', 'market', 'well', 'highhouses', 'templesteps', 'councilhall', 'gate'];
const LAMP_ROUND: PlaceId[] = ['pithead', 'rows', 'graveyard', 'well', 'gardens', 'templesteps', 'highhouses', 'councilhall', 'market', 'haulyard'];
const KEEP_ROUND: PlaceId[] = ['councilhall', 'market', 'gate', 'drillyard', 'councilhall'];

export const ROLES: Readonly<Record<RoleId, RoleDef>> = {
  // the mine
  digger: r('mine', 0, [15, -5, 0], FACES, 'mixed', 24, { labour: 'dig' }),
  hauler: r('mine', 5, [10, 0, 5], ['cartway', 'lowgallery', 'eastworks'], 'mixed', 9, { labour: 'haul', reach: 1 }),
  sorter: r('mine', 5, [-5, 5, 15], ['sorting'], 'mixed', 4, { labour: 'sort' }),
  timberman: r('mine', 0, [15, -5, 0], ['westdrift'], 'mixed', 4, { rounds: ['westdrift', 'heartvein', 'eastworks', 'lowgallery', 'sump'], reach: 1 }),
  lampman: r('mine', 0, [15, -5, 0], ['cartway'], 'mixed', 3, { rounds: MINE_ROUND, reach: 1 }),
  pumpman: r('mine', 0, [15, -5, 0], ['pumphouse'], 'mixed', 3),
  powderman: r('mine', 0, [15, -5, 0], ['powderstore'], 'day', 1),
  cartboy: r('mine', 5, [10, 0, 5], ['cartway', 'sorting'], 'mixed', 4, { labour: 'haul', reach: 1 }),
  farrier: r('mine', 0, [15, -5, 0], ['beaststalls'], 'day', 1),
  watercarrier: r('mine', 0, [15, -5, 0], ['bunks'], 'mixed', 2, { rounds: ['heartvein', 'eastworks', 'westdrift', 'lowgallery', 'sorting'], reach: 2 }),
  pitcook: r('mine', 0, [15, -5, 0], ['pitkitchen'], 'mixed', 2, { reach: 1 }),
  surveyor: r('mine', 0, [15, -5, 0], ['overseer'], 'day', 1, { rounds: ['heartvein', 'eastworks', 'lowgallery', 'sump', 'westdrift'], reach: 1 }),
  pitclerk: r('mine', 0, [15, -5, 0], ['overseer'], 'day', 1),
  chaplain: r('mine', 20, [-5, 15, 0], ['kilnshrine'], 'mixed', 4, { serves: 'temple', watches: true, reach: 1 }),
  overseer: r('mine', 40, [0, 15, 15], ['overseer'], 'mixed', 2, { standing: 'elite', serves: 'council', watches: true }),
  pitguard: r('mine', 15, [15, -5, 5], ['lift', 'overseer', 'cartway'], 'mixed', 5, { serves: 'council', watches: true }),
  peddler: r('mine', 0, [15, -5, 0], ['pithead'], 'day', 1, { outdoor: true, reach: 2 }),
  winder: r('mine', 0, [15, -5, 0], ['lift'], 'mixed', 2),
  trackman: r('mine', 0, [15, -5, 0], ['cartway'], 'mixed', 2, { rounds: ['cartway', 'lowgallery', 'sorting', 'westdrift'], reach: 1 }),
  picksmith: r('mine', 0, [15, -5, 0], ['cartway'], 'day', 1),
  bonesetter: r('mine', 0, [15, -5, 0], ['bunks'], 'day', 1, { reach: 1 }),
  ashboy: r('mine', 0, [15, -5, 0], ['kilnshrine'], 'mixed', 2, { rounds: ['kilnshrine', 'westdrift', 'bunks', 'cartway'], reach: 1 }),
  ventman: r('mine', 0, [15, -5, 0], ['westdrift'], 'night', 1),
  ratcatcher: r('mine', 0, [15, -5, 0], ['sump'], 'night', 1, { rounds: ['sump', 'lowgallery', 'pitkitchen', 'bunks'], reach: 1 }),
  // the town
  cutter: r('town', 5, [15, 0, 0], ['gemworks'], 'day', 8),
  smelter: r('town', 5, [15, 0, 0], ['smelter'], 'mixed', 30),
  smith: r('town', 5, [15, 0, 0], ['forge'], 'day', 8),
  carter: r('town', 5, [10, 0, 5], ['haulyard'], 'day', 14, { labour: 'haul', rounds: ['pithead', 'smelter', 'market', 'gate'], outdoor: true, reach: 1 }),
  porter: r('town', 5, [-5, 5, 15], ['market'], 'day', 16, { rounds: ['market', 'haulyard', 'gate', 'well'], outdoor: true, reach: 1 }),
  tallyclerk: r('town', 10, [-10, 20, 5], ['tallyhouse'], 'day', 6),
  baker: r('town', 5, [-5, 5, 15], ['bakery'], 'day', 6),
  brewer: r('town', 5, [15, 0, 0], ['brewhouse'], 'day', 5),
  tavernkeeper: r('town', 5, [-5, 5, 15], ['tavern', 'alehouse'], 'day', 3, { reach: 2 }),
  washer: r('town', 0, [0, 0, 5], ['washplace'], 'day', 16, { outdoor: true, reach: 1 }),
  weaver: r('town', 5, [15, 0, 0], ['loomhouse'], 'day', 10),
  cobbler: r('town', 5, [-5, 5, 15], ['market'], 'day', 4),
  apothecary: r('town', 10, [-10, 20, 5], ['apothecary'], 'day', 2, { reach: 1 }),
  midwife: r('town', 10, [-10, 20, 5], ['well'], 'day', 2, { rounds: ['rows', 'well', 'highhouses', 'market', 'haulyard'], reach: 2 }),
  gravedigger: r('town', 0, [10, 0, 0], ['graveyard'], 'day', 4, { outdoor: true }),
  lamplighter: r('town', 5, [0, 5, 5], ['lamphouse'], 'day', 4, { rounds: LAMP_ROUND, outdoor: true, reach: 2 }),
  priest: r('town', 20, [-5, 15, 0], ['temple'], 'day', 6, { serves: 'temple', watches: true, reach: 1 }),
  acolyte: r('town', 20, [-5, 15, 0], ['temple', 'chapel'], 'day', 8, { serves: 'temple', watches: true, reach: 1 }),
  magistrate: r('town', 40, [-5, 20, 15], ['councilhall'], 'day', 1, { standing: 'elite', serves: 'council' }),
  scribe: r('town', 10, [-10, 20, 5], ['scriptorium', 'councilhall'], 'day', 5),
  watchman: r('town', 15, [20, -5, 0], ['councilhall'], 'mixed', 12, { serves: 'council', watches: true, rounds: STREET_ROUND, outdoor: true, reach: 1 }),
  sergeant: r('town', 15, [20, -5, 0], ['barracks'], 'day', 3, { serves: 'council', watches: true, rounds: KEEP_ROUND, outdoor: true }),
  smuggler: r('town', 5, [-5, 5, 15], ['rows'], 'night', 6, { rounds: ['rows', 'gate', 'road', 'pawnshop'], outdoor: true, reach: 1 }),
  beggar: r('town', -5, [-10, 0, 10], ['templesteps', 'market', 'pithead'], 'day', 10, { outdoor: true, reach: 1 }),
  child: r('town', -5, [-10, 0, 10], ['rows', 'well', 'school'], 'day', 90, { outdoor: true, reach: 1 }),
  elder: r('town', -5, [-10, 0, 10], ['well', 'templesteps', 'rows'], 'day', 24, { outdoor: true, reach: 1 }),
  gardener: r('town', 0, [10, -5, 0], ['gardens'], 'day', 30, { outdoor: true }),
  butcher: r('town', 5, [-5, 5, 15], ['market'], 'day', 3),
  potter: r('town', 5, [15, 0, 0], ['pottery'], 'day', 4),
  tanner: r('town', 5, [15, 0, 0], ['tannery'], 'day', 5),
  dyer: r('town', 5, [15, 0, 0], ['loomhouse'], 'day', 4),
  ropemaker: r('town', 5, [15, 0, 0], ['ropewalk'], 'day', 4, { outdoor: true }),
  chandler: r('town', 5, [-5, 5, 15], ['chandlery'], 'day', 3),
  waterseller: r('town', 5, [-5, 5, 15], ['well'], 'day', 4, { rounds: ['well', 'rows', 'market', 'haulyard'], outdoor: true, reach: 1 }),
  ragpicker: r('town', -5, [-10, 0, 10], ['rows'], 'day', 5, { rounds: ['rows', 'market', 'graveyard', 'haulyard'], outdoor: true, reach: 1 }),
  stablehand: r('town', 5, [10, 0, 5], ['stables'], 'day', 5),
  soldier: r('town', 15, [20, -5, 0], ['drillyard', 'gate', 'barracks'], 'mixed', 24, { serves: 'council', watches: true, outdoor: true }),
  captain: r('town', 40, [20, 0, 5], ['barracks'], 'day', 1, { standing: 'elite', serves: 'council' }),
  cook: r('town', 5, [-5, 5, 15], ['inn', 'barracks', 'highhouses'], 'day', 5, { reach: 1 }),
  healer: r('town', 10, [-10, 20, 5], ['apothecary'], 'day', 2, { rounds: ['rows', 'well', 'haulyard'], reach: 1 }),
  teacher: r('town', 10, [-10, 20, 5], ['school'], 'day', 1, { reach: 1 }),
  bellringer: r('town', 20, [-5, 15, 0], ['temple'], 'day', 1, { serves: 'temple', watches: true, reach: 1 }),
  crier: r('town', 5, [-5, 5, 15], ['market'], 'day', 1, { rounds: ['market', 'well', 'pithead', 'rows', 'templesteps'], outdoor: true, reach: 2 }),
  fence: r('town', 5, [-5, 5, 15], ['pawnshop'], 'day', 2, { reach: 1 }),
  moneylender: r('town', 5, [-5, 5, 15], ['pawnshop'], 'day', 2, { reach: 1 }),
  courier: r('town', 10, [-10, 20, 5], ['councilhall'], 'day', 4, { rounds: ['councilhall', 'tallyhouse', 'gate', 'barracks', 'temple'], outdoor: true, reach: 1 }),
  innkeeper: r('town', 5, [-5, 5, 15], ['inn'], 'day', 2, { reach: 1 }),
  mason: r('town', 5, [15, 0, 0], ['templesteps', 'highhouses'], 'day', 6, { outdoor: true }),
  carpenter: r('town', 5, [15, 0, 0], ['cartshed'], 'day', 6),
  tinker: r('town', 5, [-5, 5, 15], ['market'], 'day', 3, { rounds: ['market', 'rows', 'haulyard'], outdoor: true, reach: 1 }),
  trader: r('town', 5, [-5, 5, 15], ['market'], 'day', 14, { outdoor: true, reach: 1 }),
  // the town's Elites who hold no common trade
  highpriest: r('town', 45, [-5, 20, 5], ['temple'], 'day', 1, { standing: 'elite', serves: 'temple', reach: 1 }),
  guildmaster: r('town', 35, [-5, 10, 20], ['market'], 'day', 1, { standing: 'elite', serves: 'public', reach: 1 }),
  smugglerboss: r('town', 30, [10, 5, 20], ['rows'], 'day', 1, { standing: 'elite', serves: 'council', reach: 1 }),
};
