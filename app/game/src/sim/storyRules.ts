/**
 * What each story does (DECISIONS §11, §105; content's STORIES): whom it casts and where, the weight the state gives
 * it, what happens at once or by each option of a choice, and what refuses an option. `stories.ts` draws and tells them.
 */
import { BALANCE } from '../content/balance';
import { DAY_TICKS, dayOf } from '../content/clock';
import { STAGE } from '../content/stages';
import { STORIES } from '../content/stories';
import {
  addEffect, addHeat, addHunger, addMalice, addNether, area, convert, everyone, gainDevotion, gainXp, here,
  heatAll, loseDevotion, mint, nbrs, pouchIds, remove, spend, standingOf, type Ctx,
} from './core';
import { hurt } from './host';
import { active, visibility } from './influence';
import { chance, pick } from './rng';
import { spawn } from './world';
import type { GameState, Person, PlaceId, Reason, StoryId } from '../types';

export interface Cast { unit?: Person; unit2?: Person; place?: PlaceId; count?: number }
/** An outcome's words: `outcome`, or `outcome.<what>`. */
type Did = string | void;
export interface StoryRule {
  /** Who and where, or null when it cannot happen now (a newcomer the world makes as it is cast). */
  cast(s: GameState): Cast | null;
  /** A weight that depends on the state (else content's). */
  weight?(s: Readonly<GameState>): number;
  /** What happens at once (a story with no choice). */
  now?(c: Ctx, k: Cast): Did;
  /** The two options of a choice, and what refuses each. */
  options?: readonly [(c: Ctx, k: Cast) => Did, (c: Ctx, k: Cast) => Did];
  refuse?: readonly [((s: Readonly<GameState>) => Reason | null)?, ((s: Readonly<GameState>) => Reason | null)?];
}

const n = (id: StoryId): Readonly<Record<string, number>> => STORIES[id]!.n;
const day = (s: Readonly<GameState>): number => dayOf(s.tick);
const people = (s: Readonly<GameState>, f: (p: Person) => boolean): Person[] => everyone(s).filter((p) => here(p) && f(p));
/** The people not yours: never the god's own host, whom the day's rules fell, not a story. */
const strangers = (s: Readonly<GameState>, f: (p: Person) => boolean = () => true): Person[] => people(s, (p) => !p.follower && p.id !== s.host && f(p));
const flock = (s: Readonly<GameState>, f: (p: Person) => boolean = () => true): Person[] => people(s, (p) => p.follower && f(p));
const strongest = (ps: readonly Person[]): Person | undefined => ps.reduce<Person | undefined>((b, p) => (!b || p.stats.strength > b.stats.strength ? p : b), undefined);
const one = <T>(s: GameState, xs: readonly T[]): T | undefined => pick(s.rng, xs);
const resist = (ps: readonly Person[], by: number): void => { for (const p of ps) p.resistance = Math.max(0, p.resistance - by); };
/** Vent Malice as an act of evil does. */
const vent = (c: Ctx, m: number): void => addMalice(c, -m);
const grieve = (p: Person, by: number): void => { p.trait = 'grieving'; p.resistance = Math.max(0, p.resistance - by); };

const costs = (count: number) => (s: Readonly<GameState>): Reason | null => (pouchIds(s).length < count ? { key: 'why.cost', slots: { n: count } } : null);
const found = (c: Ctx, count: number): void => { for (let i = 0; i < count; i++) mint(c); };

export const RULES: Readonly<Record<StoryId, StoryRule>> = {
  dreamTalker: {
    cast: (s) => {
      const fl = flock(s);
      const u = fl.length >= n('dreamTalker').minFollowers! ? one(s, fl) : undefined;
      return u ? { unit: u, place: area(u.home) } : null;
    },
    options: [
      (c, k) => {
        const near = new Set([k.place!, ...nbrs(c.s, k.place!)]);
        for (const f of flock(c.s, (p) => near.has(area(p.home)) || near.has(area(p.work)))) gainDevotion(c, f, n('dreamTalker').faith!);
        addHeat(c, 'public', n('dreamTalker').heat!, 'story');
      },
      (c, k) => {
        loseDevotion(c, k.unit!, n('dreamTalker').hush!);
        addHeat(c, 'public', -n('dreamTalker').cool!, 'story');
      },
    ],
  },
  caveIn: {
    cast: (s) => {
      const a = one(s, STAGE.caveInAreas.filter((x) => people(s, (p) => area(p.work) === x && p.id !== s.host).length > 0));
      if (!a) return null;
      const there = people(s, (p) => area(p.work) === a && p.id !== s.host);
      const pool = there.filter((p) => !p.follower);
      const u = (chance(s.rng, n('caveIn').stranger!) && pool.length > 0 ? one(s, pool) : one(s, there))!;
      return { unit: u, place: a };
    },
    now: (c, k) => {
      remove(c, k.unit!, 'dead', 0);
      addEffect(c.s, 'crew', k.place!, c.s.tick + n('caveIn').days! * DAY_TICKS, undefined, 0);
    },
  },
  tallyInspection: {
    cast: (s) => {
      if (s.factions.council.suspicion < n('tallyInspection').minHeat!) return null;
      const fl = flock(s);
      const u = one(s, fl.filter((p) => p.pocket.length > 0)) ?? one(s, fl);
      return u ? { unit: u, place: area(u.work) } : null;
    },
    options: [
      (c) => { spend(c, n('tallyInspection').cost!); addHeat(c, 'council', -n('tallyInspection').cool!, 'story'); },
      (c, k) => {
        const u = k.unit!;
        if (!here(u) || u.pocket.length === 0) return 'nobody';
        addHeat(c, 'council', n('tallyInspection').heat!, 'story');
        hurt(c, u, n('tallyInspection').harm!);
        u.caught += 1;
        if (u.stats.hp <= 0) return 'died';
        if (u.caught < BALANCE.caughtTaken) return;
        remove(c, u, 'taken');
        return 'taken';
      },
    ],
    refuse: [costs(STORIES.tallyInspection!.n.cost!)],
  },
  conscription: {
    cast: (s) => {
      const fl = flock(s);
      if (day(s) < n('conscription').minDay! || fl.length < n('conscription').minFollowers!) return null;
      const u = strongest(fl)!;
      return { unit: u, place: area(u.work) };
    },
    options: [
      (c, k) => {
        remove(c, k.unit!, 'conscripted');
        addHeat(c, 'council', -n('conscription').cool!, 'story');
        addHeat(c, 'public', -n('conscription').publicCool!, 'story');
      },
      (c) => { addHeat(c, 'council', n('conscription').heat!, 'story'); },
    ],
  },
  deathInTunnels: {
    cast: (s) => {
      const below = strangers(s);
      if (below.length <= n('deathInTunnels').minPeople!) return null;
      const u = one(s, [...below].sort((a, b) => a.stats.hp - b.stats.hp || (a.id < b.id ? -1 : 1)).slice(0, n('deathInTunnels').weakest!))!;
      const mourner = one(s, below.filter((p) => p !== u && u.ties.includes(p.id)));
      return { unit: u, ...(mourner ? { unit2: mourner } : {}), place: area(u.work) };
    },
    now: (c, k) => {
      remove(c, k.unit!, 'dead', 0);
      if (!k.unit2) return 'alone';
      grieve(k.unit2, n('deathInTunnels').resist!);
    },
  },
  kilnFeast: {
    cast: (s) => (day(s) >= n('kilnFeast').minDay! && !s.places.kilnshrine!.desecrated ? { place: 'kilnshrine' } : null),
    options: [
      (c) => {
        addHeat(c, 'temple', -n('kilnFeast').cool!, 'story');
        for (const f of flock(c.s)) loseDevotion(c, f, n('kilnFeast').faith!);
      },
      (c) => {
        addHeat(c, 'temple', n('kilnFeast').cool!, 'story');
        for (const f of flock(c.s)) gainDevotion(c, f, n('kilnFeast').faith!);
      },
    ],
  },
  smugglerOffer: {
    cast: (s) => (day(s) >= n('smugglerOffer').minDay! ? { place: 'bunks' } : null),
    options: [
      (c) => { found(c, n('smugglerOffer').crystals!); addHeat(c, 'council', n('smugglerOffer').heat!, 'story'); },
      (c) => { spend(c, n('smugglerOffer').cost!); addNether(c, n('smugglerOffer').nether!); },
    ],
    refuse: [undefined, costs(STORIES.smugglerOffer!.n.cost!)],
  },
  informer: {
    cast: (s) => {
      const fl = flock(s);
      if (fl.length < n('informer').minFollowers!) return null;
      const at = new Set(fl.map((f) => area(f.work)));
      const u = one(s, strangers(s, (p) => at.has(area(p.work)) && standingOf(p) !== 'elite'));
      return u ? { unit: u, place: area(u.work) } : null;
    },
    options: [
      (c, k) => { remove(c, k.unit!, 'dead', 0); vent(c, n('informer').malice!); addHeat(c, 'public', n('informer').heat!, 'story'); },
      (c) => {
        addHeat(c, 'council', n('informer').council!, 'story');
        addHeat(c, 'public', n('informer').public!, 'story');
      },
    ],
  },
  omen: {
    cast: (s) => (day(s) >= n('omen').minDay! ? {} : null),
    now: (c) => { gainXp(c, n('omen').xp!); addHunger(c, n('omen').hunger!); addHeat(c, 'public', n('omen').heat!, 'story'); },
  },
  railAccident: {
    cast: (s) => {
      for (const f of flock(s)) {
        const pinned = one(s, strangers(s, (p) => area(p.work) === area(f.work)));
        if (pinned) return { unit: pinned, unit2: f, place: area(f.work) };
      }
      return null;
    },
    options: [
      (c, k) => {
        hurt(c, k.unit2!, n('railAccident').harm!, 1);
        resist([k.unit!], n('railAccident').resist!);
      },
      (c, k) => { remove(c, k.unit!, 'dead', 0); vent(c, n('railAccident').malice!); },
    ],
  },
  doubleShift: {
    cast: (s) => (day(s) >= n('doubleShift').minDay! ? {} : null),
    now: (c) => {
      found(c, n('doubleShift').crystals!);
      addHeat(c, 'council', -n('doubleShift').cool!, 'story');
      for (const f of flock(c.s)) loseDevotion(c, f, n('doubleShift').faith!);
    },
  },
  sumpCache: {
    cast: (s) => {
      const u = s.places.sump!.explored ? strongest(flock(s)) : undefined;
      return u ? { unit: u, place: 'sump' } : null;
    },
    options: [
      (c, k) => {
        found(c, n('sumpCache').crystals!);
        if (!chance(c.s.rng, n('sumpCache').drownPct! / 100)) return;
        remove(c, k.unit!, 'dead');
        return 'drowned';
      },
      (c) => { found(c, n('sumpCache').safe!); },
    ],
  },
  lettersFromFront: {
    cast: (s) => {
      const u = day(s) >= n('lettersFromFront').minDay! ? one(s, strangers(s, (p) => p.trait !== 'grieving')) : undefined;
      return u ? { unit: u, place: area(u.home) } : null;
    },
    now: (c, k) => { grieve(k.unit!, n('lettersFromFront').resist!); addHeat(c, 'public', -n('lettersFromFront').cool!, 'story'); },
  },
  hollowHymn: {
    cast: (s) => (flock(s).length >= n('hollowHymn').minFollowers! ? {} : null),
    now: (c, k) => {
      const lit = flock(c.s, (p) => active(c.s, p.work));
      k.count = lit.length;
      for (const f of lit) gainDevotion(c, f, n('hollowHymn').faith!);
      addHeat(c, 'public', n('hollowHymn').heat!, 'story');
      if (lit.length === 0) return 'none';
    },
  },
  overseerLedger: {
    cast: (s) => {
      if (s.factions.council.suspicion < n('overseerLedger').minHeat!) return null;
      const near = new Set(['overseer', ...nbrs(s, 'overseer')]);
      const u = one(s, flock(s, (p) => near.has(area(p.work)) || p.stats.intelligence >= n('overseerLedger').minIntelligence!));
      return u ? { unit: u, place: 'overseer' } : null;
    },
    options: [
      (c) => { addHeat(c, 'council', -n('overseerLedger').cool!, 'story'); addHeat(c, 'public', n('overseerLedger').heat!, 'story'); },
      (c) => {
        for (const a of ['overseer', 'lift', 'sorting', 'bunks']) c.s.places[a]!.explored = true;
        gainXp(c, n('overseerLedger').xp!);
      },
    ],
  },
  theShaking: {
    cast: () => ({}),
    weight: (s) => (s.god.malice >= n('theShaking').minMalice! || s.god.hunger >= n('theShaking').minHunger! ? STORIES.theShaking!.weight : STORIES.theShaking!.weightElse!),
    options: [
      (c) => {
        vent(c, n('theShaking').malice!);
        addHunger(c, n('theShaking').hunger!);
        resist(strangers(c.s), n('theShaking').resist!);
        heatAll(c, n('theShaking').heat!, 'story');
      },
      (c) => { addHunger(c, -n('theShaking').calm!); addMalice(c, n('theShaking').malice2!); },
    ],
  },
  crystalFever: {
    cast: (s) => (pouchIds(s).length >=n('crystalFever').minCrystals! ? {} : null),
    now: (c) => {
      const greedy = strangers(c.s, (p) => p.trait === 'greedy');
      resist(greedy, n('crystalFever').resist!);
      addHeat(c, 'council', n('crystalFever').heat!, 'story');
      if (greedy.length === 0) return 'none';
    },
  },
  beggedBlessing: {
    cast: (s) => {
      const u = one(s, strangers(s, (p) => p.trait !== 'pious' && standingOf(p) !== 'elite' && visibility(s, area(p.work)) !== 'void'));
      return u ? { unit: u, place: area(u.work) } : null;
    },
    options: [
      (c, k) => { spend(c, n('beggedBlessing').cost!); convert(c, k.unit!, n('beggedBlessing').faith!); },
      (c, k) => {
        resist([k.unit!], n('beggedBlessing').resist!);
        vent(c, n('beggedBlessing').malice!);
        addHeat(c, 'public', n('beggedBlessing').heat!, 'story');
      },
    ],
    refuse: [costs(STORIES.beggedBlessing!.n.cost!)],
  },
  warBells: {
    cast: () => ({}),
    weight: (s) => (s.factions.council.suspicion >= n('warBells').minHeat! ? STORIES.warBells!.weight : STORIES.warBells!.weightElse!),
    now: (c) => { addHeat(c, 'council', -n('warBells').cool!, 'story'); addHeat(c, 'public', -n('warBells').publicCool!, 'story'); },
  },
  freshHands: {
    // the mine runs short of free hands: fewer than maxShare of everyone who ever worked it are here and not yours
    weight: (s) => {
      if (day(s) < n('freshHands').minDay!) return 0;
      return strangers(s).length < n('freshHands').maxShare! * everyone(s).length ? STORIES.freshHands!.weight : 0;
    },
    // the newcomer comes off the lift as the story is told: the world makes them
    cast: (s) => ({ unit: spawn(s, 'fresh', 'bunks'), place: 'bunks' }),
    now: () => {},
  },
};
