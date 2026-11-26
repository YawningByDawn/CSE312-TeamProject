import { describe, expect, it } from 'vitest';
import { CARDS } from '../../../src/content/cards';
import { DAY_TICKS, dayOf, sinceDawn } from '../../../src/content/clock';
import { ROLES } from '../../../src/content/roles';
import { hasText, uiText } from '../../../src/content/text';
import { AREAS, PLACES } from '../../../src/content/world';
import { WORLD_EVENTS } from '../../../src/content/worldEvents';
import { eventsOf, populateWorld, spawn, stepWorld, tieKind } from '../../../src/sim/world';
import { gatheringsOf } from '../../../src/sim/world/events';
import type { GameEvent, GameState, Person } from '../../../src/types';

const fresh = (seed: number): GameState => {
  const z = { suspicion: 0, level: 0 };
  const s = {
    seed, tick: 0, weather: 'clear', stage: 'whisper', people: {}, places: {}, threats: [], effects: [], crystals: {}, items: {}, flags: {},
    factions: { temple: { ...z }, council: { ...z }, public: { ...z } }, mine: { carts: {}, expected: 0, shortDays: 0, delve: 0 },
    ledger: { crystals: 0, nether: 0, turned: 0, lost: 0, suspicion: { temple: 0, council: 0, public: 0 } },
    god: { blessings: [], sockets: [], level: 1 },
  } as unknown as GameState;
  populateWorld(s);
  return s;
};
const run = (s: GameState, to: number, each?: (s: GameState) => void): GameEvent[] => {
  const all: GameEvent[] = [];
  const out: GameEvent[] = [];
  while (s.tick < to) {
    s.tick++;
    out.length = 0;
    stepWorld(s, out);
    all.push(...out);
    each?.(s);
  }
  return all;
};
const FACTIONS = ['temple', 'council', 'public'];
const SLOTS = { name: 'A', name2: 'B', name3: 'C', place: 'here', n: 3, list: 'A and B', new1: 'D', new2: 'E' };

describe('the world events table', () => {
  it('names real trades, places, targets, chains and cards, and every event and variant has words', () => {
    const ids = new Set(WORLD_EVENTS.map((e) => e.id));
    expect(ids.size).toBe(WORLD_EVENTS.length);
    for (const e of WORLD_EVENTS) {
      for (const slot of e.cast) if (Array.isArray(slot)) for (const r of slot as string[]) expect(ROLES[r], `${e.id} ${r}`).toBeDefined();
      for (const p of typeof e.place === 'string' ? [e.place] : e.place) if (!p.startsWith('@')) expect(PLACES[p], `${e.id} ${p}`).toBeDefined();
      for (const [, t] of [...(e.effects ?? []), ...(e.variant?.[1] ?? [])])
        expect(t.startsWith('@') || t === '*' || !!PLACES[t] || !!AREAS[t] || FACTIONS.includes(t), `${e.id} ${t}`).toBe(true);
      if (e.chain) expect(ids.has(e.chain[0]), e.id).toBe(true);
      for (const x of e.echo ?? []) if (x.startsWith('play:')) expect(!!CARDS[x.slice(5)] || x === 'play:miracle', x).toBe(true);
      const keys = [`event.${e.id}`, ...(e.variant ? [`event.${e.id}.${e.variant[0]}`] : [])];
      for (const k of keys) {
        expect(hasText(`${k}.0`), k).toBe(true);
        for (let i = 0; hasText(`${k}.${i}`); i++) expect(() => uiText(`${k}.${i}`, SLOTS), `${k}.${i}`).not.toThrow();
      }
    }
  });
});

describe('a month of the world', () => {
  const s = fresh(7);
  const events = run(s, 28 * DAY_TICKS);
  const notes = events.filter((e) => e.note);

  it('every note reads, and every day has 8 to 16 of them', () => {
    const per = new Map<number, number>();
    for (const e of notes) {
      expect(() => uiText(e.note!.key, e.note!.slots), e.note!.key).not.toThrow();
      per.set(dayOf(e.tick), (per.get(dayOf(e.tick)) ?? 0) + 1);
    }
    for (let d = 1; d < 28; d++) {
      expect(per.get(d), `day ${d}`).toBeGreaterThanOrEqual(8);
      expect(per.get(d), `day ${d}`).toBeLessThanOrEqual(16);
    }
  });

  it('events happen in their window, chains follow their openers, the dead and the levied are gone', () => {
    const stories = events.filter((e): e is Extract<GameEvent, { kind: 'story' }> => e.kind === 'story' && e.story !== 'day' && e.story !== 'life');
    expect(new Set(stories.map((e) => e.story)).size).toBeGreaterThan(30);
    for (const e of stories) {
      const def = WORLD_EVENTS.find((x) => x.id === e.story)!;
      if (def.echo) continue;
      expect(sinceDawn(e.tick), e.story).toBeGreaterThanOrEqual(def.at[0] - 0.05);
      expect(sinceDawn(e.tick), e.story).toBeLessThanOrEqual(def.at[1] + 0.05);
    }
    for (const e of stories.filter((x) => WORLD_EVENTS.find((d) => d.id === x.story)!.chance === 0 && !WORLD_EVENTS.find((d) => d.id === x.story)!.follows)) {
      const opener = WORLD_EVENTS.find((d) => d.chain?.[0] === e.story)!;
      expect(stories.some((o) => o.story === opener.id && o.tick < e.tick), e.story).toBe(true);
    }
    for (const e of stories.filter((x) => x.story === 'oldDeath')) expect(s.people[e.unit!]!.gone).toBe('dead');
    expect(s.effects.some((e) => e.kind === 'whisperZone' && e.value! > 0)).toBe(true);
  });

  it('a day is the same from the seed alone, and a dawn save continues identically', () => {
    for (let d = 1; d < 28; d++) expect(eventsOf(7, d)).toEqual(eventsOf(7, d));
    const a = fresh(11);
    run(a, 5 * DAY_TICKS - 650);
    const b = JSON.parse(JSON.stringify(a)) as GameState;
    expect(run(b, 8 * DAY_TICKS)).toEqual(run(a, 8 * DAY_TICKS));
    expect(b).toEqual(a);
  });
});

describe('the gatherings', () => {
  it('the crews called to a pay meeting come to the event', () => {
    const s = fresh(3);
    const came = new Map<string, [number, number]>();
    const stories = run(s, 200 * DAY_TICKS, (st) => {
      for (const p of Object.values(st.people)) {
        const g = p.gone ? undefined : gatheringsOf(st, p.id)?.find((x) => x.to - 1 === st.tick);
        if (!g) continue;
        const n = came.get(g.story) ?? [0, 0];
        n[1]++;
        if ('place' in p.at && p.at.place === g.place && p.at.doing === g.doing) n[0]++;
        came.set(g.story, n);
      }
    }).filter((e) => e.kind === 'story').map((e) => (e as Extract<GameEvent, { kind: 'story' }>).story);
    expect(stories).toContain('payMeeting');
    for (const id of ['payMeeting']) {
      const [here, all] = came.get(id) ?? [0, 0];
      expect(all, id).toBeGreaterThan(0);
      expect(here / all, id).toBeGreaterThan(0.75);
    }
  });
});

describe('newcomers', () => {
  it('a found loner waits where they hid, easy to turn; fresh hands bunk in the mine and go to a face', () => {
    const s = fresh(7);
    run(s, DAY_TICKS);
    const wen = spawn(s, 'loner', 'westdrift');
    expect([wen.name, wen.role, wen.home, wen.resistance]).toEqual(['Wen', 'digger', 'westdrift', 5]);
    const hand = spawn(s, 'fresh', 'bunks');
    expect(hand.role).toBe('digger');
    expect(new Set(Object.values(s.people).map((p) => p.name)).size).toBe(Object.keys(s.people).length);
    let dug = 0;
    run(s, 2 * DAY_TICKS, () => { if ('place' in hand.at && hand.at.place === hand.work && hand.at.doing === 'dig') dug++; });
    expect(dug).toBeGreaterThan(200);
    const b = JSON.parse(JSON.stringify(s)) as GameState;
    expect(run(b, 3 * DAY_TICKS)).toEqual(run(s, 3 * DAY_TICKS));
  });
});

describe('the rules echo, and the doors work', () => {
  it('days after a going: the devoured get an empty burning on the day their roll says', () => {
    const s = fresh(5);
    run(s, DAY_TICKS);
    const went = dayOf(s.tick);
    const diggers = Object.values(s.people).filter((x) => x.role === 'digger');
    diggers.forEach((p, i) => Object.assign(p, { gone: i % 2 ? 'taken' : 'devoured', goneDay: went }));
    const stories = run(s, s.tick + 6 * DAY_TICKS).filter((e): e is Extract<GameEvent, { kind: 'story' }> => e.kind === 'story');
    // the burning waits out a storm
    for (const [id, way, lo, hi] of [['emptyBurning', 'devoured', 2, 6]] as const) {
      const told = stories.filter((e) => e.story === id);
      expect(told.length, id).toBeGreaterThan(0);
      expect(new Set(told.map((e) => e.unit)).size, id).toBe(told.length);
      for (const e of told) {
        expect(s.people[e.unit!]!.gone, id).toBe(way);
        expect(dayOf(e.tick) - went, id).toBeGreaterThanOrEqual(lo);
        expect(dayOf(e.tick) - went, id).toBeLessThanOrEqual(hi);
      }
    }
    expect(stories.filter((e) => e.story === 'emptyBurning').length).toBe(diggers.length / 2);
  });

  it('a devoured person goes missing in the talk of the rows, once while it lasts', () => {
    const s = fresh(3);
    run(s, DAY_TICKS);
    const p = Object.values(s.people).find((x) => x.role === 'digger')!;
    p.gone = 'devoured';
    const out: GameEvent[] = [{ tick: s.tick + 1, kind: 'devour', unit: p.id }];
    s.tick++;
    stepWorld(s, out);
    expect(out.some((e) => e.kind === 'story' && e.story === 'missing' && e.unit === p.id)).toBe(true);
    const again: GameEvent[] = [{ tick: s.tick + 1, kind: 'devour', unit: p.id }];
    s.tick++;
    stepWorld(s, again);
    expect(again.some((e) => e.kind === 'story' && e.story === 'missing')).toBe(false);
  });

  it('a strike keeps the faces empty', () => {
    const s = fresh(5);
    const t = 2 * DAY_TICKS - 650 + 4 * 50;
    run(s, t);
    const faces = ['heartvein', 'eastworks', 'westdrift', 'lowgallery', 'sump', 'grave'];
    const atFace = (): number => Object.values(s.people).filter((p) => p.role === 'digger' && !p.gone && faces.includes(p.work) && 'place' in p.at && p.at.place === p.work).length;
    const before = atFace();
    for (const f of faces) s.effects.push({ kind: 'crew', on: f, until: t + DAY_TICKS, value: 0 });
    run(s, t + 100);
    expect(before).toBeGreaterThan(2);
    expect(atFace()).toBe(0);
  });
});

describe('trades with hours of their own, and the kinds of ties', () => {
  const s = fresh(7);
  const where = (role: string, hour: number): string[] => {
    run(s, 2 * DAY_TICKS - 650 + Math.round(hour * 50));
    return Object.values(s.people).filter((p) => p.role === role).map((p) => ('place' in p.at ? p.at.place : 'walking'));
  };

  it('the overseer counts at the lift', () => {
    expect(where('overseer', 12.8)).toContain('lift');
  });

  it('every tie has a kind, read the same from both ends; debts, rivals and lovers exist', () => {
    const kinds = new Map<string, number>();
    for (const p of Object.values(s.people) as Person[])
      for (const id of p.ties) {
        const k = tieKind(s, p, s.people[id]!);
        const back = tieKind(s, s.people[id]!, p);
        expect(k === 'owes' ? back === 'owed' : k === 'owed' ? back === 'owes' : back === k, `${p.id}-${id}`).toBe(true);
        kinds.set(k, (kinds.get(k) ?? 0) + 1);
      }
    for (const k of ['kin', 'owes', 'owed', 'rival', 'lover', 'friend']) expect(kinds.get(k), k).toBeGreaterThan(5);
  });

  it('a tie keeps its kind when someone takes other work and when newcomers come', () => {
    const t = fresh(7);
    const all = (): string[] => (Object.values(t.people) as Person[]).flatMap((p) => p.ties.map((id) => `${p.id}>${id}:${tieKind(t, p, t.people[id]!)}`));
    const before = all();
    const rival = (Object.values(t.people) as Person[]).find((p) => p.ties.some((id) => tieKind(t, p, t.people[id]!) === 'rival'))!;
    rival.work = rival.work === 'rows' ? 'tavern' : 'rows';
    spawn(t, 'fresh', 'bunks');
    spawn(t, 'loner', 'westdrift');
    expect(all()).toEqual(before);
  });
});
