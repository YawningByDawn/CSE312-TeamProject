/**
 * The world's events (#53) and the day's feed (#56). A day's events are a pure function of the seed and the day:
 * the days are rolled forward from the first (weekday, weather, chance, cooldown, the day's limit, the chains'
 * steps), so nothing is stored and a save resumes the same. An event casts its people when it happens, from the
 * seed and the opener's day; one whose people are gone does not happen. Echoes answer the rules' events of the tick.
 * The feed: the dawn's weather and day notes, the events, the weather's turns and life notes from where people are.
 */
import { WEEK } from '../../content/calendar';
import { AT, DAY_TICKS, TPH, dayOf } from '../../content/clock';
import { DIGGER_FACES } from '../../content/day';
import { hasText, uiText } from '../../content/text';
import { CHAIN_WAIT, EVENT_DAY, FEED, GATHER_KIN, LIFE_NOTES, WORLD_EVENTS, type CastSlot, type Gather, type WorldEventDef } from '../../content/worldEvents';
import type { Activity, FactionId, GameEvent, GameState, Person, PlaceId, RoleId, StoryId, Tick, UnitId, Weather, World } from '../../types';
import { addHeat, remove, type Ctx } from '../core';
import { area, inMine } from './area';
import { K, idKey, keyed, keyedInt } from './draw';
import { grown, makeName, roster, tieKind } from './society';
import { dayWeathers, indoorsAt, weatherAt } from './sky';

const N = WORLD_EVENTS.length;
const INDEX = new Map(WORLD_EVENTS.map((e, i) => [e.id, i]));
const FACES = DIGGER_FACES.map(([f]) => f);
const ECHOES = WORLD_EVENTS.flatMap((e, i) => (e.echo ? [i] : []));

/** A happening: the event, its tick, the day and event its chain began with (they key its cast), and whom it follows. */
interface Happening { e: number; tick: Tick; od: number; oe: number; who?: UnitId }
const FOLLOWS = WORLD_EVENTS.flatMap((e, i) => (e.follows ? [i] : []));

/** The tick day `d` dawns on. */
export const dawnOf = (d: number): Tick => d * DAY_TICKS - AT.night + AT.dawn;
const draw = (seed: number, d: number, e: number, use: number): number => keyed(seed, K.event, d, e * 8 + use);

function eligible(def: WorldEventDef, d: number, ws: readonly Weather[]): boolean {
  const day = WEEK[(d - 1) % WEEK.length]!;
  if (def.days && !def.days.includes(day.kind)) return false;
  if (def.weather && !def.weather.some((w) => ws.includes(w))) return false;
  if (def.not?.some((w) => ws.includes(w))) return false;
  if (def.weeks && (Math.floor((d - 1) / WEEK.length) % def.weeks[0] !== def.weeks[1] || (d - 1) % WEEK.length !== def.weeks[2])) return false;
  return true;
}

/** The roll so far for one seed, through day `d`: each event's last day, the chains' steps waiting, the day's events. */
interface Roll { seed: number; d: number; last: number[]; pending: Happening[]; today: Happening[] }
const fresh = (seed: number): Roll => ({ seed, d: 0, last: new Array<number>(N).fill(-Infinity), pending: [], today: [] });
let rolled = fresh(NaN);
const RANK = new Float64Array(N);

/** The events of day `day` (from 1), rolled forward from the first day (from the last roll when it is on the way). */
export function eventsOf(seed: number, day: number): Happening[] {
  if (rolled.seed !== seed || rolled.d > day) rolled = fresh(seed);
  const roll = rolled;
  const last = roll.last;
  let pending = roll.pending;
  let today = roll.today;
  for (let d = roll.d + 1; d <= day; d++) {
    const ws = dayWeathers(seed, d);
    today = [];
    const steps = (): void => {
      const due = pending.filter((h) => h.tick <= d);
      pending = pending.filter((h) => h.tick > d);
      for (const h of due) {
        if (eligible(WORLD_EVENTS[h.e]!, d, ws)) today.push({ ...h, tick: d });
        else if (d + 1 - h.od <= CHAIN_WAIT) pending.push({ ...h, tick: d + 1 });
      }
    };
    steps();
    const kind = WEEK[(d - 1) % WEEK.length]!.kind;
    const limit = EVENT_DAY.base + (kind === 'payday' || kind === 'market' || kind === 'flame' ? EVENT_DAY.busy : 0) + (keyed(seed, K.event, d, -1) < 0.5 ? EVENT_DAY.coin : 0);
    // the open events, the sure first, each by its draw
    const open: number[] = [];
    for (let i = 0; i < N; i++) {
      const def = WORLD_EVENTS[i]!;
      if (def.chance > 0 && !def.echo && d - last[i]! > def.cooldown && eligible(def, d, ws)) {
        open.push(i);
        RANK[i] = draw(seed, d, i, 1) - 2 * Number(def.chance >= 1);
      }
    }
    open.sort((a, b) => RANK[a]! - RANK[b]!);
    const own = (i: number): void => { today.push({ e: i, tick: d, od: d, oe: i }); last[i] = d; };
    for (const i of open) {
      if (today.length >= limit) break;
      if (WORLD_EVENTS[i]!.chance >= 1 || draw(seed, d, i, 0) < WORLD_EVENTS[i]!.chance) own(i);
    }
    if (today.length === 0 && open.length > 0) own(open.reduce((a, b) => (WORLD_EVENTS[b]!.chance > WORLD_EVENTS[a]!.chance ? b : a)));
    for (let j = 0; j < today.length; j++) {
      const h = today[j]!;
      const ch = WORLD_EVENTS[h.e]!.chain;
      if (!ch || draw(seed, d, h.e, 2) >= ch[2]) continue;
      const lag = ch[1][0] + Math.floor(draw(seed, d, h.e, 3) * (ch[1][1] - ch[1][0] + 1));
      pending.push({ e: INDEX.get(ch[0])!, tick: d + lag, od: h.od, oe: h.oe });
      if (lag === 0) steps();
    }
  }
  if (day > roll.d) { roll.d = day; roll.pending = pending; roll.today = today; }
  return today.map((h) => {
    const [a, b] = WORLD_EVENTS[h.e]!.at;
    return { ...h, tick: dawnOf(day) + Math.round((a + (b - a) * draw(seed, day, h.e, 4)) * TPH) };
  });
}

/**
 * The events that follow a going on day `day`: each one gone a `follows` way, with its chance, `days` after they went
 * (or the first day after that it may happen, within `CHAIN_WAIT`), keyed by who went.
 */
function following(seed: number, day: number, all: readonly Person[]): Happening[] {
  const out: Happening[] = [];
  for (const e of FOLLOWS) {
    const def = WORLD_EVENTS[e]!;
    const [ways, [lo, hi], p] = def.follows!;
    for (const q of all) {
      const went = q.goneDay;
      if (!q.gone || went === undefined || day - went < lo || day - went > CHAIN_WAIT || !ways.includes(q.gone)) continue;
      const k = idKey(q.id);
      if (keyed(seed, K.event, k, e * 8) >= p) continue;
      let d = went + lo + Math.floor(keyed(seed, K.event, k, e * 8 + 1) * (hi - lo + 1));
      while (d < day && !eligible(def, d, dayWeathers(seed, d))) d++;
      if (d !== day || !eligible(def, d, dayWeathers(seed, d))) continue;
      const [a, b] = def.at;
      out.push({ e, tick: dawnOf(day) + Math.round((a + (b - a) * keyed(seed, K.event, k, e * 8 + 2)) * TPH), od: went, oe: e, who: q.id });
    }
  }
  return out;
}

// ---------- the cast ----------

/** A gathering for one of the day's events: who comes is `memo.gather`'s key. */
export interface Gathering { story: StoryId; from: Tick; to: Tick; place: PlaceId; doing: Activity }

/** The day's work: the day's events, the gatherings for them by who comes, and the life notes (rebuilt when the day turns). */
const memo = {
  seed: NaN, day: -1, people: null as unknown, list: [] as Happening[], gather: new Map<UnitId, Gathering[]>(), life: [] as Tick[], ws: [] as Weather[],
};
function today(s: Readonly<GameState>): typeof memo {
  const day = dayOf(s.tick);
  if (memo.seed === s.seed && memo.day === day && memo.people === s.people) return memo;
  memo.seed = s.seed; memo.day = day; memo.people = s.people;
  memo.list = day > 0 ? [...eventsOf(s.seed, day), ...following(s.seed, day, roster(s).all)] : [];
  memo.ws = day > 0 ? dayWeathers(s.seed, day) : [];
  // the notes the day has anyway: its own, the weather at dawn and each turn, and the events whose people are here
  let fixed = day > 0 ? 2 + Number(WEEK[(day - 1) % WEEK.length]!.carts) : 0;
  for (let h = 1, w = weatherAt(s.seed, dawnOf(day)); day > 0 && h < 24; h++) {
    const x = weatherAt(s.seed, dawnOf(day) + h * TPH);
    if (x !== w) { fixed++; w = x; }
  }
  memo.gather = new Map();
  for (const h of memo.list) {
    const cast = castOf(s, h, h.who ? s.people[h.who] : undefined);
    if (!cast) continue;
    fixed++;
    const def = WORLD_EVENTS[h.e]!;
    const g = def.gather;
    if (!g || spared(def, cast)) continue;
    const at: Gathering = { story: def.id, from: h.tick - Math.round(g.at[0] * TPH), to: h.tick + Math.round(g.at[1] * TPH), place: placeOf(s, def, h, cast, null), doing: g.doing };
    for (const p of comers(s, g, cast)) (memo.gather.get(p.id) ?? memo.gather.set(p.id, []).get(p.id)!).push(at);
  }
  for (const gs of memo.gather.values()) gs.sort((a, b) => a.from - b.from);
  const n = Math.max(0, Math.min(FEED.max - fixed, Math.max(0, FEED.min - fixed) + keyedInt(s.seed, K.note, FEED.extra + 1, day, -1)));
  memo.life = [];
  for (let i = 0; i < n; i++) memo.life.push(dawnOf(day) + Math.round((FEED.from + (FEED.to - FEED.from) * keyed(s.seed, K.note, day, -2 - i)) * TPH));
  return memo;
}

/** Someone for slot `slot` of the cast so far, keyed by where the chain began. */
function pick(s: Readonly<GameState>, slot: CastSlot, cast: readonly Person[], key: number, j: number, them: Person | undefined): Person | undefined {
  const r = roster(s);
  const at = (xs: readonly Person[], t = 0): Person | undefined => (xs.length ? xs[keyedInt(s.seed, K.cast, xs.length, key, j * 16 + t)] : undefined);
  if (typeof slot === 'number') return undefined;
  if (Array.isArray(slot)) return at((slot as RoleId[]).flatMap((x) => r.role.get(x) ?? []));
  const first = cast[0];
  switch (slot) {
    case 'grown': return at(r.grown);
    case 'old': return at(r.role.get('elder') ?? []);
    case 'child': return at(r.role.get('child') ?? []);
    case 'follower': return at(r.all.filter((p) => p.follower && !p.gone));
    case 'them': return them;
    case 'kin': return first && at(r.house.get(first.household)!.filter((p) => p !== first && grown(p)));
    case 'mate': return first && at(r.role.get(first.role)!.filter((p) => p !== first));
    default: return first && at(first.ties.map((id) => s.people[id]!).filter((p) => tieKind(s, first, p) === slot));
  }
}

/** The event's cast, or null when someone it needs is gone or missing. */
function castOf(s: Readonly<GameState>, h: Happening, them: Person | undefined, past = false): Person[] | null {
  const def = WORLD_EVENTS[h.e]!;
  const opener = h.oe !== h.e ? castOf(s, { e: h.oe, tick: h.tick, od: h.od, oe: h.oe }, them, true) : null;
  // the one a chain's opener took (an old man's death) is still its next step's (his burning)
  const took = (p: Person, i: number): boolean => {
    const g = WORLD_EVENTS[h.oe]!.gone;
    return !!g && i >= g[1] && p.gone === g[0];
  };
  if (h.oe !== h.e && !opener) return null;
  const key = h.od * 1024 + h.oe;
  const out: Person[] = [];
  for (let j = 0; j < def.cast.length; j++) {
    const slot = def.cast[j]!;
    let p: Person | undefined;
    if (typeof slot === 'number') p = opener![slot];
    else for (let t = 0; t < 8 && !p; t++) {
      // a first member must have the tie the second is cast by
      const q = pick(s, slot, out, key, j * 8 + t, them);
      const next = def.cast[j + 1];
      p = j === 0 && typeof next === 'string' && next !== 'grown' && next !== 'old' && next !== 'child' && next !== 'follower' && next !== 'them' && q && !pick(s, next, [q], key, 1, them) ? undefined : q;
    }
    if (!p || (p.gone && slot !== 'them' && !((typeof slot === 'number' || past) && took(p, typeof slot === 'number' ? slot : j)))) return null;
    out.push(p);
  }
  return out;
}

// ---------- happening ----------

const placeWord = (p: PlaceId): string => (hasText(`place.${p}.name`) ? uiText(`place.${p}.name`) : uiText(`area.${area(p)}.name`));
const COUNT = new Map<string, number>();
/** How many variants a note has (`<key>.0` ...). */
export function variants(key: string): number {
  let n = COUNT.get(key);
  if (n === undefined) { for (n = 0; hasText(`${key}.${n}`); n++); COUNT.set(key, n); }
  return n;
}
const noteKey = (s: Readonly<GameState>, key: string, a: number, b: number): string => `${key}.${keyedInt(s.seed, K.note, variants(key), a, b)}`;

function targets(t: string, cast: readonly Person[], place: PlaceId, s: Readonly<GameState>): string[] {
  const m = /^@(kin|home|work)?(\d)$/.exec(t);
  if (m) {
    const p = cast[Number(m[2])];
    if (!p) return [];
    if (m[1] === 'home') return [area(p.home)];
    if (m[1] === 'work') return [area(p.work)];
    if (m[1] === 'kin') return [...new Set([...roster(s).house.get(p.household)!.filter((q) => q !== p).map((q) => q.id), ...p.ties])].slice(0, 6);
    return [p.id];
  }
  switch (t) {
    case '@all': return cast.map((p) => p.id);
    case '@place': return [place];
    case '@area': return [area(place)];
    case '@faces': return FACES;
    default: return [t];
  }
}

/** An event that would take a follower of yours by chance does not happen. */
const spared = (def: WorldEventDef, cast: readonly Person[]): boolean => !!def.gone && cast.slice(def.gone[1]).some((p) => p.follower);

/** Where `h` happens: its place, one of its places by the day, a cast member's home or work, or the echo's place. */
function placeOf(s: Readonly<GameState>, def: WorldEventDef, h: Happening, cast: readonly Person[], echo: GameEvent | null): PlaceId {
  const pl = def.place;
  if (typeof pl !== 'string') return pl[keyedInt(s.seed, K.event, pl.length, h.od, idKey(def.id))]!;
  if (pl === '@them') {
    const them = echo?.unit ? s.people[echo.unit] : undefined;
    return echo?.place ?? (them && 'place' in them.at ? them.at.place : 'rows');
  }
  return pl.startsWith('@') ? (cast[Number(pl.slice(5) || 0)]?.[pl.startsWith('@home') ? 'home' : 'work'] ?? 'rows') : pl;
}

/** Who comes to an event's gathering: the cast it names, the grown of the households and the kin of those it names. */
function comers(s: Readonly<GameState>, g: Gather, cast: readonly Person[]): Person[] {
  const house = roster(s).house;
  const out = new Set<Person>();
  for (const i of g.cast ?? cast.keys()) if (cast[i]) out.add(cast[i]!);
  for (const i of g.house ?? []) for (const q of house.get(cast[i]!.household)!) if (grown(q)) out.add(q);
  let kin = 0;
  for (const i of g.kin ?? [])
    for (const q of [...house.get(cast[i]!.household)!, ...cast[i]!.ties.map((id) => s.people[id]!)])
      if (kin < GATHER_KIN && !q.gone && !out.has(q)) { out.add(q); kin++; }
  return [...out].filter((p) => !p.gone);
}

/** The gatherings `id` comes to today, by when they begin. */
export const gatheringsOf = (s: Readonly<GameState>, id: UnitId): readonly Gathering[] | undefined => today(s).gather.get(id);

/** Make `h` happen now: its people, place, words and doors. */
function happen(s: GameState, out: GameEvent[], w: World, h: Happening, echo: GameEvent | null): void {
  const def = WORLD_EVENTS[h.e]!;
  const who = echo?.unit ?? h.who;
  const them = who ? s.people[who] : undefined;
  const cast = castOf(s, h, them);
  if (!cast || spared(def, cast)) return;
  const k = idKey(def.id);
  const first = cast[0];
  const place = placeOf(s, def, h, cast, echo);
  const v = def.variant?.[0];
  const holds = v === 'mine' ? inMine(place) : v === 'fog' ? today(s).ws.includes('fog') : v === 'rain' ? today(s).ws.some((x) => x === 'rain' || x === 'storm')
    : v === 'bad' ? s.mine.shortDays > 0 : v === 'unpaid' ? keyed(s.seed, K.event, h.od, k) < 0.5 : v === 'follower' ? !!cast[1]?.follower : false;
  const effects = (holds ? def.variant![1] : undefined) ?? def.effects ?? [];
  const c: Ctx = { s, out, w };
  const until = dawnOf(dayOf(s.tick));
  for (const [kind, target, value, days] of effects) {
    for (const on of targets(target, cast, place, s)) {
      if (kind === 'suspicion') addHeat(c, on as FactionId, value, 'event');
      else s.effects.push({ kind, on, until: until + (days + 1) * DAY_TICKS, value });
    }
  }
  if (def.gone) for (const p of cast.slice(def.gone[1])) remove(c, p, def.gone[0]);
  const slots: Record<string, string | number> = { place: placeWord(place) };
  cast.slice(0, 3).forEach((p, i) => { slots[i === 0 ? 'name' : `name${i + 1}`] = p.name; });
  if (def.n) slots.n = def.n[0] + keyedInt(s.seed, K.event, def.n[1] - def.n[0] + 1, h.od, k + 1);
  if (def.list !== undefined) {
    const names = cast.slice(def.list).map((p) => p.name);
    slots.list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names.join('');
    slots.n = names.length;
  }
  if (def.names) {
    const used = new Set(roster(s).all.map((p) => p.name));
    for (let i = 1; i <= def.names; i++) slots[`new${i}`] = makeName(s.seed, 100000 + h.od * 1024 + h.oe * 4 + i, used);
  }
  const base = holds ? `event.${def.id}.${v}` : `event.${def.id}`;
  out.push({ tick: s.tick, kind: 'story', story: def.id, place, ...(first ? { unit: first.id } : {}), note: { key: noteKey(s, base, h.od, k), slots } });
}

/** The words of an echoed rule event: its kind, and its kind with the detail an echo may name. */
function echoKeys(s: Readonly<GameState>, e: GameEvent): string[] {
  switch (e.kind) {
    case 'lost': return [e.kind, `lost:${(e.unit && s.people[e.unit]?.gone) || ''}`];
    case 'threat': return e.how === 'landed' ? [`threat:${s.threats.find((t) => t.id === e.threat)?.kind ?? ''}`] : [];
    case 'play': return [`play:${e.card}`, `play:${e.cardKind}`];
    case 'count': return e.short > 0 ? ['count:short'] : [];
    case 'search': case 'devour': case 'exposed': return [e.kind];
    default: return [];
  }
}

/** An echo holds off while its first lasting door is still open. */
function echoing(s: Readonly<GameState>, def: WorldEventDef, echo: GameEvent): boolean {
  const e = def.effects?.find((x) => x[3] > 0 && x[0] !== 'suspicion');
  if (!e) return false;
  const them = echo.unit ? s.people[echo.unit] : undefined;
  const on = targets(e[1], them ? [them] : [], echo.place ?? '', s);
  return s.effects.some((x) => x.kind === e[0] && x.until > s.tick && on.includes(x.on ?? ''));
}

/** Who is doing what where, as a life note's words. */
function lifePool(s: Readonly<GameState>, p: Readonly<Person>): string | null {
  const a = p.at;
  if ('route' in a) return a.doing === 'ride' ? (inMine(a.route[a.route.length - 1]!) ? 'liftDown' : 'liftUp') : null;
  if (a.doing === 'sleep' || a.doing === 'offer') return null;
  if (a.doing === 'idle' && indoorsAt(s.weather) > 0 && a.place !== p.work) return 'shelter';
  return LIFE_NOTES.role[p.role] ?? LIFE_NOTES.at[a.place] ?? LIFE_NOTES.doing[a.doing] ?? null;
}

/** The world's answer to the rule events `out[from, to)`, a tick's or an action's: each echo whose words name one happens now. */
export function echoes(s: GameState, out: GameEvent[], w: World, from: number, to: number): void {
  const day = today(s).day;
  for (let i = from; i < to; i++) {
    const e = out[i]!;
    const keys = echoKeys(s, e);
    if (keys.length === 0) continue;
    for (const j of ECHOES) {
      const def = WORLD_EVENTS[j]!;
      if (def.echo!.some((x) => keys.includes(x)) && !echoing(s, def, e)) happen(s, out, w, { e: j, tick: s.tick, od: day, oe: j }, e);
    }
  }
}

/** The world's events and feed for this tick. */
export function stepEvents(s: GameState, out: GameEvent[], w: World): void {
  const m = today(s);
  const day = m.day;
  const ruled = out.length;
  if (s.tick === dawnOf(day)) {
    const kind = WEEK[(day - 1) % WEEK.length]!;
    out.push({ tick: s.tick, kind: 'story', story: 'day', note: { key: noteKey(s, `day.${kind.kind}`, day, 0) } });
    if (kind.carts) out.push({ tick: s.tick, kind: 'story', story: 'day', note: { key: noteKey(s, 'day.carts', day, 1) } });
  }
  for (let i = 0; i < m.list.length; i++) if (m.list[i]!.tick === s.tick) happen(s, out, w, m.list[i]!, null);
  echoes(s, out, w, 0, ruled);
  for (let i = 0; i < m.life.length; i++) {
    if (m.life[i] !== s.tick) continue;
    for (let t = 0; t < 8; t++) {
      const all = roster(s).all;
      const p = all[keyedInt(s.seed, K.note, all.length, day, i * 8 + t)]!;
      const pool = p.gone ? null : lifePool(s, p);
      if (!pool || !variants(`life.${pool}`)) continue;
      const place = 'place' in p.at ? p.at.place : p.at.route[p.at.route.length - 1]!;
      out.push({ tick: s.tick, kind: 'story', story: 'life', unit: p.id, place, note: { key: noteKey(s, `life.${pool}`, day, 100 + i), slots: { name: p.name, place: placeWord(place) } } });
      break;
    }
  }
}
