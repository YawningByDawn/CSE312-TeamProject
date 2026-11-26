/**
 * The god's day (spec §4, §5; inventory #13-16, 31, 35, 36): Hunger and Malice at dawn with what they do at the top,
 * the Flame's drain, the heat's drift and cooling, rank and its blessing, the mine taken (the run's end); Nether at
 * dusk and the Ember's flare; the loss by being rooted out.
 */
import { BALANCE } from '../content/balance';
import { BLESSING as N, BLESSING_IDS } from '../content/blessings';
import { EFFECT } from '../content/crystals';
import { dayOf } from '../content/clock';
import { AREAS } from '../content/world';
import {
  addHeat, addHunger, addMalice, addNether, area, end, ev, everyone, flameLight, flockCount, flockOf, followers, gainIchor, heads, heatAll, here, mint,
  loseDevotion, loseIchor, pouchIds, rankUp, remove, settleRank, type Ctx,
} from './core';
import { deal, faithOf, followersEvil, lashOut } from './cards';
import { bonus } from './bonus';
import { oddCount } from './crystals';
import { netherMultiplier, round1 } from './formulas';
import { inReach, whisperCost } from './influence';
import { shuffled } from './rng';
import type { BlessingId, GameState, PlaceId } from '../types';


/** Hunger per dawn (spec): 4 + Divinity + one per `hungerPerFollowers` noticed heads, less the Slow lines, Weeping more. */
export function hungerRise(s: Readonly<GameState>): number {
  const raw = BALANCE.hungerRiseBase + s.god.level + Math.floor(heads(s) / BALANCE.hungerPerFollowers) - bonus(s, 'hungerSlow') + oddCount(s, 'weeping') * EFFECT.weepingHunger;
  return Math.max(0, round1(raw));
}
/** Malice per dawn (spec): 4 + Divinity, less the Slow lines, Spite more. */
export function maliceRise(s: Readonly<GameState>): number {
  return Math.max(0, round1(BALANCE.maliceRiseBase + s.god.level - bonus(s, 'maliceSlow') + (oddCount(s, 'spite') > 0 ? EFFECT.spiteMalice : 0)));
}

/** The Ember on a day: `emberStart`, fading `emberFade` a day to the floor `ember`. */
export const emberAt = (day: number): number => Math.max(BALANCE.ember, BALANCE.emberStart - BALANCE.emberFade * (Math.max(1, day) - 1));

/** Nether at dusk (spec): Faith × the rank's multiplier + the Ember + the set lines; starving ×`starvingNetherMult`. */
export function netherIncome(s: Readonly<GameState>): number {
  const raw = faithOf(s) * netherMultiplier(s.god.level) + emberAt(dayOf(s.tick)) + bonus(s, 'nether');
  return round1(s.god.hunger >= BALANCE.starvingAt ? raw * BALANCE.starvingNetherMult : raw);
}


/** The Flame drains the followers who work in its light (the pious twice); a starving god drains them all. */
function drains(c: Ctx): void {
  const s = c.s;
  const starving = s.god.hunger >= BALANCE.starvingAt;
  followers(s, (f) => {
    const light = flameLight(s, area(f.work));
    if (light > 0) loseDevotion(c, f, (light === 2 ? BALANCE.kilnDrainStrong : BALANCE.kilnDrainWeak) * (f.trait === 'pious' ? 2 : 1));
    if (starving && f.follower) loseDevotion(c, f, BALANCE.starvingDrain);
  });
}

/** Hunger at the top: the god eats its most devoted follower (the town notices), or with none left, itself. */
function ravenous(c: Ctx): void {
  const s = c.s;
  let top: string | null = null;
  followers(s, (f) => {
    const t = top ? s.people[top]! : null;
    if (!t || f.stats.devotion > t.stats.devotion || (f.stats.devotion === t.stats.devotion && f.id < t.id)) top = f.id;
  });
  ev(c, { kind: 'starve', ...(top ? { unit: top } : {}) });
  if (!top) return loseIchor(c, BALANCE.starveIchor, 'starving');
  remove(c, s.people[top]!, 'devoured');
  addHeat(c, 'public', BALANCE.ravenousPublic, 'ravenous');
  addHunger(c, BALANCE.ravenousResetTo - s.god.hunger);
}

function urges(c: Ctx): void {
  const s = c.s;
  addHunger(c, hungerRise(s));
  if (s.god.hunger >= 100) ravenous(c);
  if (s.phase !== 'live') return;
  addMalice(c, maliceRise(s));
  if (s.god.malice >= BALANCE.seethingAt && s.god.malice < 100) addHeat(c, 'public', BALANCE.seethingPublicPerTurn, 'seething');
  if (s.god.malice >= 100) lashOut(c);
}

/**
 * The heat that drifts in each dawn from where followers work: strangers seeing violet crests (by the area's
 * exposure), the watched blocks' patrols, the Flame's light, the hoard in the grave, and the town's talk.
 */
function drift(c: Ctx): void {
  const s = c.s;
  const all = new Map<PlaceId, number>();
  for (const p of everyone(s)) if (here(p)) all.set(area(p.work), (all.get(area(p.work)) ?? 0) + 1);
  const mine = flockCount(s, (f) => area(f.work));
  let seen = 0;
  let lit = 0;
  followers(s, (f) => {
    if (f.routine === 'lieLow') return;
    const a = area(f.work);
    seen += 1 - (mine.get(a) ?? 0) / (all.get(a) ?? 1);
    if (flameLight(s, a) > 0) lit += 1;
  });
  addHeat(c, 'public', round1(seen * BALANCE.crestPublicPerFollower), 'crests');
  addHeat(c, 'temple', round1(lit * BALANCE.kilnCrestCult), 'crestsInFlame');
  addHeat(c, 'temple', Math.min(BALANCE.hoardCap, Math.floor(Math.max(0, pouchIds(s).length - BALANCE.hoardFree) / BALANCE.hoardPer)), 'hoard');
  const feed = round1(s.factions.public.suspicion * BALANCE.publicFeed);
  addHeat(c, 'temple', feed, 'talk');
  addHeat(c, 'council', feed, 'talk');
}

/** Each dawn heat cools, slower as the god grows. */
export const decayAt = (level: number): number => Math.max(BALANCE.suspicionDecayMin, BALANCE.suspicionDecay - BALANCE.suspicionDecayPerLevel * (level - 1));
function decay(c: Ctx): void {
  heatAll(c, -decayAt(c.s.god.level), 'time');
}

/** Dawn, the god's part: the drains, the followers' own evil, the urges, the heat; then rank, blessing and the mine taken. */
export function godDawn(c: Ctx): void {
  const steps = [drains, followersEvil, urges, drift, decay];
  for (const step of steps) {
    step(c);
    if (c.s.phase !== 'live') return;
  }
  const was = c.s.god.level;
  rankUp(c);
  if (c.s.god.level > was && !c.s.pending) offerBlessings(c);
  if (c.s.god.level >= BALANCE.takenLevel && c.s.flags.liftRooted) end(c, true, 'taken');
}


/** 3 blessings to pick from (Second Sight more), none taken before. */
export function offerBlessings(c: Ctx): void {
  const s = c.s;
  const pool = BLESSING_IDS.filter((id) => !s.god.blessings.includes(id));
  const offers = shuffled(s.rng, pool).slice(0, 3 + bonus(s, 'blessingChoices'));
  if (offers.length > 0) s.pending = { kind: 'blessing', offers };
}

export function pickBlessing(c: Ctx, id: BlessingId): void {
  const s = c.s;
  s.pending = null;
  s.god.blessings.push(id);
  settleRank(s);
  if (id === 'hoardOfTheGrave') for (const t of N.hoardGrades) mint(c, { tier: t });
  if (id === 'oldScars') gainIchor(c, N.ichorMax);
  if (id === 'stoneSkin') gainIchor(c, N.stoneSkinIchor);
}


/** Dusk, the god's part: the action points refill, Nether comes in (half the rest carries, at most a day's income), the deal; the Ember flares. */
export function godDusk(c: Ctx): void {
  const s = c.s;
  const g = s.god;
  const income = netherIncome(s);
  const carried = Math.min(round1(g.nether * BALANCE.carryRate), round1(income * BALANCE.carryCapTurns));
  addNether(c, round1(carried + income - g.nether));
  g.ap = g.apMax;
  g.free = bonus(s, 'freeWhispers');
  g.boost = 0;
  deal(c);
  emberFlare(c);
  if (rootedOut(s)) end(c, false, 'rootedOut');
}

/** No dead day: when no whisper in reach is affordable, the Ember gives just enough for the cheapest. */
function emberFlare(c: Ctx): void {
  const s = c.s;
  const fl = flockOf(s);
  let cheapest = Infinity;
  for (const p of everyone(s)) {
    if (p.follower || !here(p)) continue;
    const cost = whisperCost(s, fl, p);
    if (cost >= cheapest || !inReach(s, fl, p)) continue;
    if (cost <= s.god.nether) return;
    cheapest = cost;
  }
  if (cheapest === Infinity) return;
  addNether(c, round1(cheapest - s.god.nether + 0.1), 'emberFlare');
}

/** Rooted out: no follower, nowhere held, and no one left in reach. */
export function rootedOut(s: Readonly<GameState>): boolean {
  const fl = flockOf(s);
  if (fl.heads > 0) return false;
  for (const a in s.places) if (!AREAS[a]!.anchored && s.places[a]!.hold >= BALANCE.rootedOutHold) return false;
  return !everyone(s).some((p) => inReach(s, fl, p));
}
