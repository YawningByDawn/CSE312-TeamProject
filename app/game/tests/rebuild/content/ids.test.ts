// Every id one content table names exists in the table it points into, and every named thing has its words.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BLESSING_IDS, blessingSlots } from '../../../src/content/blessings';
import { CALENDAR_EFFECTS, WEEK } from '../../../src/content/calendar';
import { STAGES } from '../../../src/content/stages';
import { STORIES } from '../../../src/content/stories';
import { DISCOVERIES } from '../../../src/content/discoveries';
import { PEOPLE } from '../../../src/content/people';
import { ROLES } from '../../../src/content/roles';
import { CARDS, cardSlots } from '../../../src/content/cards';
import { AFFINITY_IDS, BASE_IDS, CURSE_IDS, MOD_IDS } from '../../../src/content/gems';
import { FACILITY_ITEM, ITEMS } from '../../../src/content/items';
import { hasText, uiText } from '../../../src/content/text';
import { THREAT_KINDS, THREAT_SLOTS, THREATS } from '../../../src/content/threats';
import { TRAITS } from '../../../src/content/traits';
import { WEATHER_RULES } from '../../../src/content/weather';
import { AREAS, AREA_EDGES, DEEP, LIFT_LINK, NEIGHBOURS, PLACES } from '../../../src/content/world';
import { HOME_SLOTS } from '../../../src/content/day';
import { AT, DRESS, MINE_FRAME, TOWN, spotsOf, way } from '../../../src/content/map';

const FACTIONS = ['temple', 'council', 'public'];
const FACILITIES = ['faceting', 'jewelry', ...Object.keys(FACILITY_ITEM)];
const STAGE_IDS = Object.keys(STAGES);
const missing = (ids: Iterable<string>, table: object): string[] => [...ids].filter((id) => !(id in table));

describe('content ids', () => {
  it('the world graph joins areas, and every place lies in an area', () => {
    expect(missing(AREA_EDGES.flat(), AREAS)).toEqual([]);
    expect(missing(Object.values(PLACES).map((p) => p.area), AREAS)).toEqual([]);
    expect(missing([DEEP, ...LIFT_LINK], AREAS)).toEqual([]);
    for (const [a, ns] of Object.entries(NEIGHBOURS)) for (const n of ns) expect(NEIGHBOURS[n], `${a}-${n}`).toContain(a);
    for (const a of Object.keys(AREAS)) expect(NEIGHBOURS[a]!.length, a).toBeGreaterThan(0);
    for (const [id, a] of Object.entries(AREAS)) expect(a.region === 'mine' ? a.depth > 0 : a.depth === 0, id).toBe(true);
  });

  it('every area, place and home lot lies in its frame, each step of a route has its line, and each place in sight has room', () => {
    const homes = Object.entries(HOME_SLOTS).flatMap(([a, n]) => Array.from({ length: n }, (_, i) => `home:${a}:${i}`));
    const areaOf = (p: string): string => PLACES[p]?.area ?? (p.startsWith('home:') ? p.split(':')[1]! : p);
    const inFrame = (p: string, x: number, y: number): boolean => {
      const f = AREAS[areaOf(p)]!.region === 'mine' ? MINE_FRAME : TOWN;
      return x >= 0 && y >= 0 && x <= f.w && y <= f.h;
    };
    const all = [...new Set([...Object.keys(AREAS), ...Object.keys(PLACES), ...homes])];
    expect(missing(all, AT)).toEqual([]);
    expect(Object.keys(AT).length).toBe(all.length);
    for (const p of all) expect(inFrame(p, ...AT[p]!), p).toBe(true);
    const lift = (a: string, b: string): boolean => LIFT_LINK.includes(a) && LIFT_LINK.includes(b);
    // a found shortcut joins the graph, so a route can walk it: it has its way like every other edge
    const shortcuts = Object.values(DISCOVERIES).flatMap((d) => (d.kind === 'shortcut' ? [d.link!] : []));
    expect(shortcuts.length).toBeGreaterThan(0);
    const steps = [...AREA_EDGES.filter(([a, b]) => !lift(a, b)), ...shortcuts, ...[...Object.keys(PLACES), ...homes].filter((p) => areaOf(p) !== p).map((p) => [p, areaOf(p)] as const)];
    for (const [a, b] of steps) {
      const l = way(b, a);
      expect([l[0], l[1], l[l.length - 2], l[l.length - 1]], `${b}>${a}`).toEqual([...AT[b]!, ...AT[a]!]);
    }
    const inSight = Object.keys(PLACES).filter((p) => AREAS[PLACES[p]!.area]!.region === 'mine' || !PLACES[p]!.indoor);
    for (const p of inSight) {
      const s = spotsOf(p, 'idle');
      expect(s?.length, p).toBeGreaterThan(0);
      for (let i = 0; i < s!.length; i += 3) expect(inFrame(p, s![i]!, s![i + 1]!), p).toBe(true);
    }
  });

  it('the mine dressing\'s lights, flames and glints stand in mine areas inside the frame', () => {
    for (const t of [...DRESS.lights, ...DRESS.flames, ...DRESS.glints]) {
      expect(AREAS[t.area]?.region, t.area).toBe('mine');
      expect(t.x >= 0 && t.y >= 0 && t.x <= MINE_FRAME.w && t.y <= MINE_FRAME.h, `${t.x},${t.y}`).toBe(true);
    }
  });

  it('roles work and walk at places', () => {
    for (const r of Object.values(ROLES)) expect(missing([...r.work, ...(r.rounds ?? [])], PLACES)).toEqual([]);
  });

  it('named people hold a role, a trait and a work place, and fit their trade’s headcount', () => {
    expect(new Set(PEOPLE.map((p) => p.id)).size).toBe(PEOPLE.length);
    expect(missing(PEOPLE.map((p) => p.role), ROLES)).toEqual([]);
    expect(missing(PEOPLE.map((p) => p.trait), TRAITS)).toEqual([]);
    expect(missing(PEOPLE.map((p) => p.work), PLACES)).toEqual([]);
    for (const [id, r] of Object.entries(ROLES)) expect(PEOPLE.filter((p) => p.role === id).length, id).toBeLessThanOrEqual(r.count);
    const ids = new Set(PEOPLE.map((p) => p.id));
    for (const [id, p] of Object.entries(PLACES)) if (p.officer) expect(ids.has(p.officer), id).toBe(true);
  });

  it('the calendar, the weather and the discoveries name areas (or a power, for notice)', () => {
    const effects = [...Object.values(CALENDAR_EFFECTS).flat(), ...Object.values(WEATHER_RULES).flatMap((w) => w.effects.map((e) => ({ ...e, value: e.full })))];
    for (const e of effects) {
      const ok = e.target === '*' || (e.kind === 'notice' ? FACTIONS.includes(e.target) : e.target in AREAS);
      expect(ok, `${e.kind} ${e.target}`).toBe(true);
    }
    expect(missing(Object.keys(DISCOVERIES), AREAS)).toEqual([]);
  });

  it('every area, place, role and named person has its words', () => {
    const keys = [
      ...Object.keys(AREAS).flatMap((a) => [`area.${a}.name`, `area.${a}.blurb`]),
      ...Object.keys(PLACES).map((p) => `place.${p}.name`),
      ...Object.keys(ROLES).flatMap((r) => [`role.${r}.name`, `role.${r}.plural`]),
      ...PEOPLE.map((p) => `person.${p.id}.bio`),
      ...Object.keys(TRAITS).flatMap((t) => [`trait.${t}.name`, `trait.${t}.line`, `trait.${t}.details`]),
      ...AFFINITY_IDS.flatMap((a) => [`affinity.${a}.name`, `affinity.${a}.word`]),
      ...BASE_IDS.flatMap((b) => [`base.${b}.name`, `base.${b}.line`]),
      ...MOD_IDS.map((m) => `mod.${m}.name`),
      ...CURSE_IDS.map((m) => `mod.${m}.price`),
      ...Object.keys(CARDS).flatMap((c) => [`card.${c}.name`, `card.${c}.line`, `card.${c}.details`]),
      ...Object.keys(ITEMS).flatMap((i) => [`item.${i}.name`, `item.${i}.line`, `item.${i}.gift`]),
      ...FACILITIES.flatMap((f) => [`facility.${f}.name`, `facility.${f}.makes`]),
    ];
    expect(keys.filter((k) => !hasText(k))).toEqual([]);
  });

  it('every card names traits that exist, and its words fill from its slots', () => {
    for (const d of Object.values(CARDS)) expect(missing(d.traits ?? [], TRAITS)).toEqual([]);
    for (const c of Object.keys(CARDS)) for (const k of ['line', 'details']) expect(() => uiText(`card.${c}.${k}`, cardSlots(c)), c).not.toThrow();
  });

  it('every threat, answer and discovery has its words, filled from its slots', () => {
    const keys = [
      ...THREAT_KINDS.flatMap((k) => [`threat.${k}.name`, `threat.${k}.lands`]),
      ...new Set(Object.values(THREATS).flatMap((t) => t.answers.map((a) => `answer.${a}.name`))),
      ...Object.keys(DISCOVERIES).flatMap((a) => [`discovery.${a}.hint`, `discovery.${a}.text`]),
      ...Object.entries(DISCOVERIES).filter(([, d]) => d.kind === 'loner').flatMap(([a]) => [`discovery.${a}.loner`, `discovery.${a}.bio`]),
      ...Object.keys(THREAT_SLOTS),
    ];
    for (const k of keys) expect(() => uiText(k, THREAT_SLOTS[k]), k).not.toThrow();
    for (const t of Object.values(THREATS)) expect(t.level !== undefined || t.floor !== undefined).toBe(true);
  });

  it('every stage, day and weather has its words, and every calendar and weather effect says why', () => {
    const keys = [
      ...STAGE_IDS.flatMap((st) => [
        ...['title', 'start', 'gate', 'end', 'defeat', 'inquisitor.arrive', 'inquisitor.leave', 'inquisitor.buried'].map((k) => `stage.${st}.${k}`),
        ...FACTIONS.flatMap((f) => [0, 1, 2, 3, 4].map((l) => `stage.${st}.hint.${f}.${l}`)),
        ...FACTIONS.flatMap((f) => [1, 2, 3, 4].map((l) => `stage.${st}.cross.${f}.${l}`)),
      ]),
      ...WEEK.flatMap((_, i) => [`day.${i}.name`, `day.${i}.line`]),
      ...Object.entries(CALENDAR_EFFECTS).flatMap(([d, es]) => es.map((e) => `calendar.${d}.${e.kind}.${e.target}`)),
      ...Object.entries(WEATHER_RULES).flatMap(([w, r]) => [`weather.${w}.line`, ...r.effects.map((e) => `weather.${w}.${e.kind}.${e.target}`)]),
    ];
    expect(keys.filter((k) => !hasText(k))).toEqual([]);
    expect(Object.values(STAGES).filter((st) => !PEOPLE.some((p) => p.id === st.crackdownLeader))).toEqual([]);
    for (const st of Object.values(STAGES)) expect(missing([st.gate, st.inquisitorHome, ...st.skimAreas, ...st.caveInAreas, st.hideout, st.arrivals], AREAS)).toEqual([]);
  });

  it('every story has its words, filled from its numbers and its cast', () => {
    for (const [id, d] of Object.entries(STORIES)) {
      const slots = { ...d.n, name: 'A', name2: 'B', place: 'here', boss: 'C', count: 2 };
      const parts = d.choice ? ['opt1.label', 'opt1.does', 'opt1.outcome', 'opt2.label', 'opt2.does', 'opt2.outcome'] : ['effect', 'outcome'];
      for (const k of ['title', 'body', ...parts]) expect(() => uiText(`story.${id}.${k}`, slots), `${id}.${k}`).not.toThrow();
    }
  });

  it('every reason the sim gives (a refusal, a heat note, an ending, a goal) has its words', () => {
    const dir = new URL('../../../src/sim/', import.meta.url);
    const src = readdirSync(dir, { recursive: true }).filter((f) => String(f).endsWith('.ts')).map((f) => readFileSync(new URL(String(f), dir), 'utf8')).join('\n');
    const keys = [
      ...[...src.matchAll(/key: '([a-zA-Z.]+)'/g)].map((m) => m[1]!),
      ...[...src.matchAll(/addHeat\([^;]*'([a-zA-Z]+)'\)/g)].map((m) => `heat.${m[1]}`),
      ...[...src.matchAll(/end\(c, (?:true|false), '([a-zA-Z]+)'\)/g)].map((m) => `end.${m[1]}`),
      ...[...src.matchAll(/loseIchor\(c, [^;]*, '([a-zA-Z]+)'\);/g)].map((m) => `ichor.${m[1]}`),
      ...[...src.matchAll(/addNether\(c, [^;]*, '([a-zA-Z]+)'\);/g)].map((m) => `nether.${m[1]}`),
      ...['devoured', 'taken', 'burned', 'dead', 'conscripted', 'left', 'lapsed'].map((g) => `people.${g}`),
    ];
    expect(src).not.toMatch(/(?:addHeat|loseIchor|addNether|end)\([^;]*`/);
    expect(keys.length).toBeGreaterThan(80);
    expect([...new Set(keys)].filter((k) => !hasText(k))).toEqual([]);
  });

  it('every blessing has its words, filled from its slots', () => {
    for (const b of BLESSING_IDS) for (const k of ['name', 'line', 'details']) expect(() => uiText(`blessing.${b}.${k}`, blessingSlots(b)), b).not.toThrow();
  });
});
