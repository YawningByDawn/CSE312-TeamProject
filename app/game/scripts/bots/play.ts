/**
 * The bot players on the rebuilt sim (`src`): decent, cautious and random, each a pure function of the state and its
 * own memory, acting through `Sim.act` in the night's turn. `playRun(seed, bot)` plays one run to its end (or `maxDays`)
 * and returns what the balance table reads. Every action a bot sends is one `Query.check` allowed, so a refusal is a
 * sim defect (`refused`), never the policy's.
 *
 *   decent   — whispers at fair odds, eats when hungry, answers the powers' moves, works the council hall in the town.
 *   cautious — whispers only at good odds, lies low early, keeps stones at the grave, plays only quiet cards.
 *   random   — about four uniformly random legal actions a day; pending choices at random.
 */
import { BALANCE } from '../../src/content/balance';
import { CARDS } from '../../src/content/cards';
import { DAY_TICKS, dayOf } from '../../src/content/clock';
import { THREATS, ANSWER_EVIL } from '../../src/content/threats';
import { PLACES } from '../../src/content/world';
import { makeSim } from '../../src/sim';
import { handsOf } from '../../src/sim/buildings';
import { cardFee, cardTargets, payment } from '../../src/sim/cards';
import { area, digs, everyone, flockOf, handMax, pouchIds, standingOf, type Flock } from '../../src/sim/core';
import { burnWorth } from '../../src/sim/crystals';
import { STAGE_DRAW } from '../../src/sim/formulas';
import { inReach, whisperCost, whisperOdds } from '../../src/sim/influence';
import { pick, seedRng } from '../../src/sim/rng';
import type { Action, BlessingId, CardId, GameEvent, GameState, Grade, Query, Sim } from '../../src/types';

export type BotId = 'decent' | 'cautious' | 'random';
export const BOT_IDS: readonly BotId[] = ['decent', 'cautious', 'random'];

interface Style {
  minOdds: number;
  minOddsShade: number;
  eatAt: number;
  evilAt: number;
  /** Heat at which followers carrying stones lie low (null: never). */
  lieLowAt: number;
  /** Stones in a pocket at which a praying follower offers them. */
  offerAt: number;
  /** Stone worth left in the pouch after a miracle. */
  keep: number;
  evilHeatMax: number;
  /** Days before a move lands that it is answered. */
  answerDays: number;
  preachers: number;
  delve: boolean;
  blessings: readonly BlessingId[];
}

const STYLES: Record<Exclude<BotId, 'random'>, Style> = {
  decent: {
    minOdds: 0.35, minOddsShade: 0.12, eatAt: 52, evilAt: 55, lieLowAt: 45, offerAt: 2, keep: 2, evilHeatMax: 10, answerDays: 0.5, preachers: 2, delve: true,
    blessings: ['sweetVoice', 'luckyVein', 'restless', 'pickpocket', 'quietRot', 'deepPockets', 'patientHunger'],
  },
  cautious: {
    minOdds: 0.5, minOddsShade: 0.2, eatAt: 45, evilAt: 75, lieLowAt: 30, offerAt: 4, keep: 4, evilHeatMax: 6, answerDays: 1.5, preachers: 1, delve: false,
    blessings: ['quietRot', 'pickpocket', 'stoneSkin', 'oldScars', 'patientHunger'],
  },
};

/** Miracles in the order the bots value them. */
const MIRACLE_PREF: readonly CardId[] = [
  'dreamDirective', 'blessTheirBodies', 'crystalBloom', 'veinSight', 'gildedTongue', 'sermonOfAsh', 'borrowedTongue', 'quickening',
  'creepingDark', 'blindEye', 'nightTerror', 'divertedCart', 'soothingMurmur', 'marrowFeast', 'theCalling', 'mend', 'blackDew',
];
/** A scripted bot decides at every standstill of the night's clock; the random one acts this many times a night. */
const RANDOM_ACTS = 4;
/** Actions a bot may take without the clock moving on (free ones: a stone set, a card played) before it sleeps. */
const STAND_MAX = 24;
/** The pit head's places: the watershed needs it rooted, so followers are posted there to colour it. */
const PITHEAD_POSTS = Object.keys(PLACES).filter((p) => PLACES[p]!.area === 'minehead');
const HALL = 'councilhall';
const GRADES: readonly Grade[] = ['dull', 'clear', 'bright', 'blazing', 'royal', 'impossible'];

const heatOf = (s: GameState): number => Math.max(s.factions.temple.suspicion, s.factions.council.suspicion, s.factions.public.suspicion);
const heatSum = (card: CardId): number => (CARDS[card]!.heat ?? []).reduce((n, h) => n + h.amount, 0);
const isEvil = (card: CardId): boolean => CARDS[card]!.kind === 'evil';
const worthOf = (s: GameState, id: string): number => burnWorth(s.crystals[id]!, null);
const pouchWorth = (s: GameState): number => pouchIds(s).reduce((n, id) => n + worthOf(s, id), 0);

/** The cheapest stones that pay a miracle (fewest by worth first), or null. */
function payFor(s: GameState, card: CardId): string[] | null {
  const pay: string[] = [];
  for (const id of pouchIds(s).sort((a, b) => worthOf(s, a) - worthOf(s, b) || (a < b ? -1 : 1))) {
    if (payment(s, card, pay).ichor !== null) break;
    pay.push(id);
  }
  return payment(s, card, pay).ichor !== null ? pay : null;
}

function miracleWanted(s: GameState, fl: Flock, card: CardId, target?: string): boolean {
  const g = s.god;
  switch (card) {
    case 'soothingMurmur': return heatOf(s) >= 30;
    case 'marrowFeast': return g.hunger >= 45;
    case 'mend': return g.ichor <= 6;
    case 'blindEye': return s.mine.shortDays > 0 || s.factions.council.suspicion >= 25;
    case 'divertedCart': return s.factions.council.suspicion < 30;
    case 'blessTheirBodies': case 'crystalBloom': case 'veinSight': return target !== undefined && (fl.at.get(area(target)) ?? 0) >= 2;
    default: return true;
  }
}

function cardWant(s: GameState, fl: Flock, st: Style, card: CardId): number {
  const d = CARDS[card]!;
  if (d.kind === 'evil') {
    const heat = heatSum(card);
    if (card === 'sacrifice' || heat > st.evilHeatMax) return 0.5;
    const answers = d.answers ? 20 : 0;
    const hungry = card === 'devour' && s.god.hunger >= st.eatAt ? 8 : 0;
    return answers + hungry + Math.max(1, ((d.malice ?? 0) - heat * 0.8) * (0.4 + s.god.malice / 80));
  }
  const i = MIRACLE_PREF.indexOf(card);
  const afford = pouchWorth(s) - (d.cost ?? 0) >= st.keep ? 1 : 0.5;
  return (i < 0 ? 2 : 18 - i) * afford * (miracleWanted(s, fl, card) || d.target === 'area' ? 1 : 0.4);
}

/** Bot memory: the day each follower last went to ground (one who lies low stays down two days). */
interface Mem { lowSince: Map<string, number> }

/** One scripted decision, or null when nothing is worth doing now. Every action it names passes `check`. */
function decide(s: GameState, q: Query, st: Style, bot: BotId, mem: Mem): Action | null {
  const ok = (a: Action): Action | null => (q.check(s, a).ok ? a : null);
  const g = s.god;
  const day = dayOf(s.tick);
  const pend = s.pending;
  if (pend?.kind === 'blessing') return { type: 'pickBlessing', blessing: pend.offers.find((b) => st.blessings.includes(b)) ?? pend.offers[0]! };
  if (pend?.kind === 'facet') return { type: 'chooseCut', index: 0 };
  if (pend?.kind === 'story') {
    const opts = Array.from({ length: pend.options }, (_, i) => i + 1).filter((o) => ok({ type: 'story', option: o }));
    return { type: 'story', option: (bot === 'cautious' ? opts[opts.length - 1] : opts[0]) ?? 1 };
  }
  const vault = ok({ type: 'openVault' });
  if (vault) return vault;
  const fl = flockOf(s);
  const mine = everyone(s).filter((p) => p.follower);
  // the deal: the card most wanted, a reroll of a poor deal, room made in a full hand
  if (g.deal) {
    const want = (c: CardId): number => cardWant(s, fl, st, c);
    const best = g.deal.slice().sort((a, b) => want(b) - want(a))[0] ?? null;
    if (best && want(best) < 4 && g.rerolls > 0) return { type: 'reroll' };
    if (g.hand.length >= handMax(s)) {
      const keep = bot === 'cautious' ? g.hand.filter(isEvil).sort((a, b) => heatSum(a) - heatSum(b))[0] : undefined;
      const worst = g.hand.filter((c) => c !== keep).sort((a, b) => want(a) - want(b))[0];
      return worst && want(worst) < 3 ? { type: 'discard', card: worst } : { type: 'take', card: null };
    }
    if (bot === 'cautious' && g.malice >= 50 && !g.hand.some(isEvil)) {
      const vent = g.deal.filter(isEvil).sort((a, b) => heatSum(a) - heatSum(b))[0];
      if (vent) return { type: 'take', card: vent };
    }
    return { type: 'take', card: best && want(best) >= 1 ? best : null };
  }
  // hunger: the cheapest stone
  const pouch = pouchIds(s).sort((a, b) => worthOf(s, a) - worthOf(s, b) || (a < b ? -1 : 1));
  if ((g.hunger >= st.eatAt || (pouch.length > 13 && g.hunger >= 20)) && pouch.length > 0) {
    const a = ok({ type: 'eat', crystal: pouch[0]! });
    if (a) return a;
  }
  // the powers' moves, the writ first: an item, a favour, the answering act of evil, hiding the named
  for (const t of s.threats.slice().sort((a, b) => a.lands - b.lands || (a.kind === 'writ' ? -1 : 1))) {
    if (t.lands - s.tick > st.answerDays * DAY_TICKS) continue;
    const answers = THREATS[t.kind].answers;
    if (answers.includes('cool') && s.factions[t.faction].suspicion < (THREATS[t.kind].floor ?? 0) - 3) continue;
    for (const id in s.items) {
      const a = ok({ type: 'answer', threat: t.id, with: id });
      if (a) return a;
    }
    const fav = ok({ type: 'answer', threat: t.id, with: 'favour' });
    if (fav) return fav;
    if (answers.includes('evil')) {
      const card = ANSWER_EVIL[t.faction];
      if (g.hand.includes(card) && cardFee(s) <= g.nether * 0.5) {
        const a = ok({ type: 'play', card, pay: [] });
        if (a) return a;
      }
    }
    if (answers.includes('agent')) {
      const agent = t.walkers.map((id) => s.people[id]!).find((p) => p.whispered !== day && inReach(s, fl, p) && whisperOdds(s, fl, p) >= 0.35);
      const a = agent && ok({ type: 'whisper', target: agent.id });
      if (a) return a;
    }
    const hide = ok({ type: 'answer', threat: t.id, with: 'hide' });
    if (hide && q.check(s, hide).nether <= g.nether * 0.6) return hide;
  }
  // Malice presses: the act of evil with the most Malice for its heat (never on one of yours)
  if (g.malice >= st.evilAt && (cardFee(s) === 0 || g.malice >= (bot === 'cautious' ? 92 : 80))) {
    const evils = g.hand.filter((c) => isEvil(c) && c !== 'sacrifice' && heatSum(c) <= st.evilHeatMax)
      .sort((a, b) => (CARDS[b]!.malice ?? 0) - heatSum(b) * 0.8 - ((CARDS[a]!.malice ?? 0) - heatSum(a) * 0.8));
    for (const card of evils) {
      const targets = CARDS[card]!.target === 'none' ? [undefined] : cardTargets(s, fl, card).filter((t) => !s.people[t]?.follower);
      const a = targets.length ? ok({ type: 'play', card, pay: [], ...(targets[0] ? { target: targets[0] } : {}) }) : null;
      if (a) return a;
    }
  }
  if (g.ap < 1 && g.free === 0) return null;
  const council = s.factions.council.suspicion;
  const heat = s.stage === 'shade' ? heatOf(s) : council;
  const routine = (unit: string, r: NonNullable<GameState['people'][string]['routine']>): Action | null => {
    const a = ok({ type: 'setRoutine', unit, routine: r });
    if (a && r === 'lieLow') mem.lowSince.set(unit, day);
    return a;
  };
  // the count: a short day sends one pocketing digger down; a forgiving one brings a rested one back
  if (s.stage === 'whisper') {
    const diggers = mine.filter((p) => digs(p));
    if (s.mine.shortDays > 0) {
      const f = diggers.filter((p) => p.routine !== 'lieLow' && p.pocket.length > 0).sort((a, b) => b.pocket.length - a.pocket.length)[0];
      const a = f && routine(f.id, 'lieLow');
      if (a) return a;
    } else if (council < st.lieLowAt - 10) {
      const f = diggers.find((p) => p.routine === 'lieLow' && day - (mem.lowSince.get(p.id) ?? -99) >= 2);
      const a = f && routine(f.id, 'pray');
      if (a) return a;
    }
  }
  // the way up, before whispers: from Divinity III, up to three followers work at the pit head until it takes root
  // (non-diggers first, never one delving or skimming); the AP a post wants is saved for it
  if (s.stage === 'whisper' && g.level >= 3 && !s.flags.surfaceRooted && mine.filter((p) => area(p.work) === 'minehead').length < 3) {
    const free = mine.filter((x) => area(x.work) !== 'minehead' && x.routine !== 'delve' && x.routine !== 'skim');
    for (const p of [...free.filter((x) => !digs(x)), ...free.filter(digs)]) {
      for (const to of PITHEAD_POSTS) {
        const a: Action = { type: 'move', unit: p.id, to };
        const c = q.check(s, a);
        if (c.ok) return a;
        if (c.why.every((w) => w.key === 'why.ap')) return null;
      }
    }
  }
  // whispers, best weighted odds first: in the town the council hall's people (the vault's lock) and the great
  const floor = s.stage === 'shade' ? st.minOddsShade + Math.max(0, s.factions.public.suspicion - 35) / 150 : st.minOdds;
  let best: { a: Action; w: number } | null = null;
  const groups = new Set<string>();
  for (const p of everyone(s)) {
    if (p.follower || p.gone || p.whispered === day || !inReach(s, fl, p)) continue;
    if (s.stage === 'shade') for (const gr of q.groups(s, p.id)) groups.add(gr);
    const odds = whisperOdds(s, fl, p);
    if (odds < floor || whisperCost(s, fl, p) > g.nether) continue;
    const hall = s.stage === 'shade' && (p.work === HALL || p.masterOf.includes(HALL)) ? 2 : 1;
    const w = odds * hall * (standingOf(p) === 'elite' ? 1.6 : 1);
    if (!best || w > best.w) best = { a: { type: 'whisper', target: p.id }, w };
  }
  for (const group of groups) {
    const c = q.check(s, { type: 'whisperGroup', group });
    if (!c.ok || c.nether > g.nether * 0.6 || (c.odds ?? 0) < floor) continue;
    const w = (c.odds ?? 0) * (group.includes(HALL) ? 2 : 1) * 1.5;
    if (!best || w > best.w) best = { a: { type: 'whisperGroup', group }, w };
  }
  if (best && q.check(s, best.a).ok) return best.a;
  // the town: preachers while the Temple is not hostile
  if (s.stage === 'shade' && s.factions.temple.suspicion < (bot === 'decent' ? 75 : 50) && mine.filter((p) => p.routine === 'preach').length < st.preachers) {
    const f = mine.find((p) => p.routine === 'pray' && p.pocket.length === 0 && standingOf(p) === 'mortal');
    const a = f && routine(f.id, 'preach');
    if (a) return a;
  }
  // delve toward the Deep, skim the sorting (not the cautious bot)
  if (st.delve && s.stage === 'whisper') {
    if (!s.flags.deepOpen && !mine.some((p) => p.routine === 'delve')) {
      const f = mine.find((p) => digs(p) && p.routine === 'pray');
      const a = f && routine(f.id, 'delve');
      if (a) return a;
    }
    const sk = mine.find((p) => p.routine === 'pray' && ok({ type: 'setRoutine', unit: p.id, routine: 'skim' }));
    if (sk && !mine.some((p) => p.routine === 'skim')) return routine(sk.id, 'skim');
  }
  // routines: offer a filling pocket; lie low when the heat is up; back to prayer when it cools
  for (const f of mine) {
    if (f.routine === 'delve' || f.routine === 'skim' || f.routine === 'preach' || f.routine === 'standWatch') continue;
    const n = f.pocket.length;
    const want = heat >= st.lieLowAt && n > 0 ? 'lieLow'
      : n >= st.offerAt && (f.routine !== 'lieLow' || heat < st.lieLowAt - 15) ? 'offer'
        : f.routine === 'offer' && n === 0 ? 'pray'
          : f.routine === 'lieLow' && heat < st.lieLowAt - 15 ? 'pray' : null;
    if (!want || want === f.routine) continue;
    if (f.routine === 'lieLow' && day - (mem.lowSince.get(f.id) ?? -99) < 2) continue;
    if (f.routine === 'lieLow' && s.threats.some((t) => t.target === f.id)) continue;
    const a = routine(f.id, want);
    if (a) return a;
  }
  return null;
}

/** The free decisions of the grave: set the best stone, a miracle worth its price. */
function grave(s: GameState, q: Query, st: Style): Action | null {
  const g = s.god;
  const fl = flockOf(s);
  const empty = g.sockets.indexOf(null);
  const pouch = pouchIds(s).sort((a, b) => worthOf(s, b) - worthOf(s, a) || (a < b ? -1 : 1));
  if (empty >= 0 && pouch.length > 0) {
    const a: Action = { type: 'set', crystal: pouch[0]!, socket: empty };
    if (q.check(s, a).ok) return a;
  }
  if (cardFee(s) > 0) return null;
  const value = pouchWorth(s);
  for (const card of MIRACLE_PREF) {
    if (!g.hand.includes(card) || value - (CARDS[card]!.cost ?? 0) < st.keep) continue;
    const pay = payFor(s, card);
    if (!pay) continue;
    const targets = CARDS[card]!.target === 'none' ? [undefined] : cardTargets(s, fl, card);
    for (const target of targets) {
      if (!miracleWanted(s, fl, card, target)) continue;
      const a: Action = { type: 'play', card, pay, ...(target ? { target } : {}) };
      if (q.check(s, a).ok) return a;
    }
  }
  return null;
}

/** A scripted bot's next action now, the opening's take included, or null; it keeps its own memory across calls. */
export function scripted(bot: Exclude<BotId, 'random'>): (s: GameState, q: Query) => Action | null {
  const st = STYLES[bot];
  const mem: Mem = { lowSince: new Map() };
  return (s, q) => decide(s, q, st, bot, mem) ?? grave(s, q, st);
}

/** The random bot's pending choice: any answer the rules allow. */
function randomPending(s: GameState, q: Query, rng: ReturnType<typeof seedRng>): Action | null {
  const p = s.pending;
  if (!p) return null;
  const all: Action[] = p.kind === 'blessing' ? p.offers.map((blessing) => ({ type: 'pickBlessing', blessing }))
    : p.kind === 'facet' ? p.cuts.map((_, index) => ({ type: 'chooseCut', index }))
      : Array.from({ length: p.options }, (_, i) => ({ type: 'story', option: i + 1 }) as Action);
  return pick(rng, all.filter((a) => q.check(s, a).ok)) ?? null;
}

export interface RunResult {
  seed: number;
  bot: BotId;
  outcome: 'won' | 'lost' | 'stalled';
  why: string;
  days: number;
  shadeDay: number | null;
  endDay: number | null;
  gift: string;
  whispers: number;
  peakFollowers: number;
  maxHeat: number;
  /** Stones struck for the player by grade (dull..impossible). */
  mined: number[];
  /** Days without a crystal decision / without a card decision. */
  noCrystalDays: number;
  noCardDays: number;
  threats: { announced: number; landed: number; answered: number };
  seals: number;
  /** Actions `check` allowed that `act` refused: each a sim defect. */
  refused: string[];
}

export interface PlayOptions {
  maxDays?: number;
  /** Called at each dawn with the state (the whole-run checks). */
  onDawn?: (s: GameState, sim: Sim, q: Query) => void;
  /** Called with every action applied (the action log). */
  onAct?: (a: Action) => void;
}

export function playRun(seed: number, bot: BotId, opts: PlayOptions = {}): RunResult {
  const { sim, query: q } = makeSim();
  const maxDays = opts.maxDays ?? 100;
  const s = sim.create(seed);
  const rng = seedRng((seed * 0x9e3779b1) ^ bot.length);
  const next = bot === 'random' ? null : scripted(bot);
  const res: RunResult = {
    seed, bot, outcome: 'stalled', why: '', days: 0, shadeDay: null, endDay: null, gift: '', whispers: 0, peakFollowers: 0, maxHeat: 0,
    mined: [0, 0, 0, 0, 0, 0], noCrystalDays: 0, noCardDays: 0, threats: { announced: 0, landed: 0, answered: 0 }, seals: 0, refused: [],
  };
  const scan = (evs: readonly GameEvent[]): void => {
    for (const e of evs) {
      if (e.kind === 'stage' && res.shadeDay === null) res.shadeDay = dayOf(e.tick ?? s.tick);
      else if (e.kind === 'end') res.why = e.why.key;
      else if (e.kind === 'strike' && e.crystal) res.mined[GRADES.indexOf(e.grade)]! += 1;
      else if (e.kind === 'threat') res.threats[e.how] += 1;
    }
  };
  const act = (a: Action): boolean => {
    const r = sim.act(s, a);
    if (!r.ok) {
      res.refused.push(`day ${dayOf(s.tick)} ${JSON.stringify(a)}: ${r.why.map((w) => w.key).join(',')}`);
      return false;
    }
    opts.onAct?.(a);
    scan(r.events);
    return true;
  };
  // the opening's deal: the bot takes the card it wants (random: any)
  const deal = s.god.deal!;
  const want = (c: CardId): number => (bot === 'random' ? 0 : cardWant(s, flockOf(s), STYLES[bot], c));
  act({ type: 'take', card: bot === 'random' ? pick(rng, deal)! : deal.slice().sort((a, b) => want(b) - want(a))[0]! });
  res.gift = s.tally.gift ?? '';
  let lastDay = -1, acted = -1, acts = 0, standAt = -1, stood = 0;
  while (s.phase === 'live' && dayOf(s.tick) <= maxDays) {
    const d = dayOf(s.tick);
    if (d !== lastDay) {
      lastDay = d;
      opts.onDawn?.(s, sim, q);
    }
    if (d !== acted) {
      acted = d;
      acts = 0;
    }
    if (s.pending) {
      const a = bot === 'random' ? randomPending(s, q, rng) : next!(s, q);
      if (!a || !act(a)) break; // a choice the bot could not make: stuck
      continue;
    }
    if (s.tick >= s.until) {
      // the clock stands: the night's turn. Each action that spends a point runs it on; no more to do, the bot sleeps to dawn
      if (s.tick !== standAt) {
        standAt = s.tick;
        stood = 0;
      }
      const a = bot === 'random' ? (acts++ < RANDOM_ACTS ? pick(rng, sim.legal(s).filter((x) => x.type !== 'sleep')) : null)
        : stood++ < STAND_MAX ? next!(s, q) : null;
      if (!act(a ?? { type: 'sleep' })) break;
      continue;
    }
    const evs = sim.step(s);
    scan(evs);
    if (s.phase === 'live' && evs.some((e) => e.kind === 'dusk')) {
      // the day's decisions on offer at its dusk (a run that ends there has no next day to decide): a stone to eat or
      // set, and the stage's deal of cards
      const pouch = pouchIds(s);
      if (!pouch.some((id) => q.check(s, { type: 'eat', crystal: id }).ok)) res.noCrystalDays += 1;
      const dealt = evs.find((e): e is Extract<GameEvent, { kind: 'deal' }> => e.kind === 'deal');
      if (!dealt || dealt.cards.length < STAGE_DRAW[s.stage]) res.noCardDays += 1;
      res.peakFollowers = Math.max(res.peakFollowers, everyone(s).filter((p) => p.follower).length);
      res.maxHeat = Math.max(res.maxHeat, heatOf(s));
    }
  }
  res.days = dayOf(s.tick);
  res.whispers = s.tally.whispers;
  res.seals = s.flags.seals;
  if (s.phase === 'won' || s.phase === 'lost') {
    res.outcome = s.phase;
    res.endDay = res.days;
  } else if (s.pending && res.days <= maxDays) res.why = `stuck on ${s.pending.kind}`;
  return res;
}

/** p10 / median / p90 of a list, or a dash. */
function spread(xs: number[]): string {
  if (xs.length === 0) return '—';
  const v = xs.slice().sort((a, b) => a - b);
  const q = (p: number): number => v[Math.min(v.length - 1, Math.floor(p * v.length))]!;
  return `${q(0.1)} / ${q(0.5)} / ${q(0.9)}`;
}

export function table(bots: readonly BotId[], runs: readonly RunResult[], md: boolean): string {
  const head = ['bot', 'runs', 'won', 'lost (mine / town)', 'stalled', 'reached Shade', 'Shade day p10/med/p90', 'won on day p10/med/p90',
    'lost on day p10/med/p90', 'days without a crystal / card decision', 'stones mined per run (Du/Cl/Br/Bl/Ro/Im)', 'peak followers', 'whispers', 'threats announced / landed / answered', 'losses by cause', 'refused'];
  const rows = bots.map((bot) => {
    const rs = runs.filter((r) => r.bot === bot);
    const n = rs.length;
    const pc = (k: number): string => `${Math.round((100 * k) / n)} %`;
    const per = (f: (r: RunResult) => number, d = 1): string => (rs.reduce((t, r) => t + f(r), 0) / n).toFixed(d);
    const lost = rs.filter((r) => r.outcome === 'lost');
    const causes = new Map<string, number>();
    for (const r of lost) causes.set(r.why, (causes.get(r.why) ?? 0) + 1);
    return [
      bot, `${n}`, pc(rs.filter((r) => r.outcome === 'won').length),
      `${pc(lost.length)} (${lost.filter((r) => r.shadeDay === null).length} / ${lost.filter((r) => r.shadeDay !== null).length})`,
      pc(rs.filter((r) => r.outcome === 'stalled').length), pc(rs.filter((r) => r.shadeDay !== null).length),
      spread(rs.flatMap((r) => (r.shadeDay === null ? [] : [r.shadeDay]))),
      spread(rs.flatMap((r) => (r.outcome === 'won' ? [r.endDay!] : []))),
      spread(lost.map((r) => r.endDay!)),
      `${per((r) => r.noCrystalDays)} / ${per((r) => r.noCardDays)}`,
      [0, 1, 2, 3, 4, 5].map((g) => per((r) => r.mined[g]!, 2)).join('/'),
      per((r) => r.peakFollowers, 0), per((r) => r.whispers, 0),
      `${per((r) => r.threats.announced)} / ${per((r) => r.threats.landed)} / ${per((r) => r.threats.answered)}`,
      [...causes].map(([k, v]) => `${k.replace('end.', '')} ${v}`).join(', ') || '—',
      `${rs.reduce((t, r) => t + r.refused.length, 0)}`,
    ];
  });
  if (md) return [head, head.map(() => '---'), ...rows].map((r) => `| ${r.join(' | ')} |`).join('\n');
  return rows.map((r) => r.map((c, i) => `${head[i]}: ${c}`).join('\n  ')).join('\n');
}
