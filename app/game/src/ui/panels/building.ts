import type { Action, Answer, Facility, FactionId, GameState, Gift, JewelForm, Person, PlaceId, Query, Threat, ViewModel } from '../../types';
import { GIFTS } from '../../content/gifts';
import { FACILITY_ITEM } from '../../content/items';
import { ANSWER_ITEM, THREAT_SLOTS, THREATS } from '../../content/threats';
import { uiText } from '../../content/text';
import { bound } from '../../content/keys';
import { AREAS, PLACES } from '../../content/world';
import ROOMS from '../../content/rooms.json';
import { BLOOD, DIM, PALE, TILE_H, TILE_W, VIOLET, Words, attr, div, itemText, line, portrait, room, slab, stoneTile, surface, thingText, verb } from './art';
import { why1 } from './grave';
import type { Ctx, Panel } from './index';
import { placeName } from './person';

// A building's screen (inventory #119, 123): its room with whoever works there lit violet when yours and gold when the
// Flame's; its master and hands, each to whisper to; its bench (re-cutting, the forge, the other makings) or why it is
// shut; what waits to be given; the moves announced against it and their answers; the vault. A place with a move
// against it and no room shows the moves alone.

/** The room each building is shown in (one baked room a kind of building; gen/bake/interiors.ts bakes them from this table). */
const ROOM: Readonly<Record<PlaceId, string>> = ROOMS;
const roomOf = (p: PlaceId): string | null => (p.startsWith('home:') && AREAS[p.split(':')[1]!]?.region === 'town' ? 'home' : ROOM[p] ?? null);
const FORMS: readonly JewelForm[] = ['ring', 'amulet', 'circlet'];
const VAULT = new Set(['vault', 'councilhall']);
const W = 1200, RX = 336;

/** The moves aimed at a place, its area, or anyone who works there. */
function threatsAt(s: Readonly<GameState>, place: PlaceId, hands: readonly Person[]): Threat[] {
  const area = PLACES[place]?.area;
  return s.threats.filter((t) => t.target === place || t.target === area || hands.some((p) => p.id === t.target));
}

/** Who works there: the master first, then the hands, yours first. */
function handsOf(s: Readonly<GameState>, place: PlaceId): Person[] {
  const all = Object.values(s.people).filter((p) => p.gone === null && (p.masterOf.includes(place) || p.work === place || p.home === place));
  const master = (p: Person): number => (p.masterOf.includes(place) ? 0 : 1);
  return all.sort((a, b) => master(a) - master(b) || Number(b.follower) - Number(a.follower) || a.name.localeCompare(b.name));
}

const TOWN_AREAS = Object.keys(AREAS).filter((a) => AREAS[a]!.region === 'town');
const POWERS: readonly FactionId[] = ['temple', 'council', 'public'];
type Pick = [id: string, options: [id: string, words: string][]];

/** Each pick a gift needs, in order, with its options: a power; one who owes; how, when and where. */
function giftPicks(q: Query, s: Readonly<GameState>, g: Gift): Pick[] {
  const where: Pick = ['where', TOWN_AREAS.map((a) => [a, uiText(`area.${a}.name`)])];
  switch (g) {
    case 'rumour': return [['power', POWERS.map((f) => [f, uiText(`power.${f}`)])]];
    case 'debt': {
      const owe = Object.values(s.people).filter((p) => p.gone === null && !p.follower && p.ties.some((t) => q.tieKind(s, p.id, t) === 'owes'));
      return [['who', owe.slice(0, 12).map((p) => [p.id, p.name])]];
    }
    case 'food': return [
      ['how', [['poison', uiText('gift.poison')], ['bless', uiText('gift.bless')]]],
      ['day', Array.from({ length: GIFTS.food.days }, (_, i) => [String(i + 1), i ? uiText('gift.day.n', { n: i + 1 }) : uiText('gift.day.1')])],
      where,
    ];
    case 'guards': return [where];
    case 'records': return [];
  }
}

export class Building implements Panel {
  private sel: string | null = null;
  private form: JewelForm = 'ring';
  /** A gift's picks so far, by pick. */
  private picks: Record<string, string> = {};
  private place: PlaceId | null = null;
  constructor(private readonly c: Ctx) {}

  key(vm: ViewModel): string | null {
    const f = vm.focus, s = vm.state;
    if (vm.title || vm.film || s.phase !== 'live' || !f || !('place' in f) || f.place === 'grave') return null;
    const p = f.place;
    if (!roomOf(p) && !threatsAt(s, p, []).length) return null;
    if (p !== this.place) {
      this.place = p;
      this.picks = {};
    }
    return `building|${p}|${this.c.rev}|${this.sel}|${this.form}|${JSON.stringify(this.picks)}`;
  }

  build(root: HTMLElement, vm: ViewModel): void {
    const s = vm.state, q = this.c.q;
    const place = (vm.focus as { place: PlaceId }).place;
    const name = roomOf(place) ? placeName(place) : uiText(`area.${AREAS[place] ? place : PLACES[place]!.area}.name`);
    const hands = roomOf(place) ? handsOf(s, place) : [];
    const threats = threatsAt(s, place, hands);
    const shown = roomOf(place);
    const { el, say } = slab(root, -W / 2, -440, W, shown ? 880 : 130 + threats.length * 96, name);
    verb(el, W - 130, 14, 106, 44, uiText('btn.close'), '', () => this.c.focus(null), say);
    let y = 70;
    if (shown) {
      const mine = hands.filter((p) => p.follower).length;
      new Words(el, 360, 28, 19, mine ? VIOLET : DIM).set(hands.length ? uiText('building.lit', { n: mine, total: hands.length }) : uiText('building.nobodyNow'));
      room(el, shown, 16, y, hands);
      y += 292;
    }
    for (const t of threats.slice(0, 2)) y = this.band(el, s, t, y, say) + 8;
    if (!shown) return;

    // the people, left
    const rows = Math.max(1, Math.floor((870 - y) / 62) - 1);
    new Words(el, 16, y, 18, DIM).set(uiText(hands.length ? 'building.whoWorks' : 'building.nobodyWorks'));
    hands.slice(0, rows).forEach((p, i) => {
      const ry = y + 28 + i * 62;
      const r = div(el, 'hg-b hg-hit', 14, ry, 310, 58);
      portrait(r, s, p, 24, 29, 46);
      new Words(r, 54, 6, 20, p.follower ? VIOLET : PALE).set(p.name);
      new Words(r, 54, 32, 15, DIM).set(uiText(p.masterOf.includes(place) ? 'building.master' : `role.${p.role}.name`));
      r.addEventListener('click', () => this.c.focus({ unit: p.id }));
      if (p.follower) new Words(r, 222, 18, 17, VIOLET).set(uiText('building.yours'));
      else {
        const a: Action = { type: 'whisper', target: p.id };
        const ch = q.check(s, a);
        verb(r, 214, 4, 96, 50, uiText('btn.whisper'), why1(ch), () => this.c.act(a), say, ch.odds !== undefined ? uiText('building.odds', { pct: Math.round(ch.odds * 100) }) : '');
      }
    });
    if (hands.length > rows) {
      const rest = hands.slice(rows);
      new Words(el, 16, y + 28 + rows * 62, 16, DIM).set(uiText('building.moreMine', { n: rest.length, mine: rest.filter((p) => p.follower).length }));
    }

    // the bench, right
    const f = PLACES[place]?.facility, gift = PLACES[place]?.gift;
    if (VAULT.has(place)) this.vault(el, s, y, say);
    else if (f) this.bench(el, s, f, y, say, hands);
    else if (gift) this.gift(el, s, gift, y, say);
    else if (place.startsWith('home:')) this.hearth(el, s, place, y);
    else line(el, RX, y, 840, 18, DIM, uiText('building.givesNothing'));
  }

  /** A home's hearth: its standing gift, lit when more than half the household is yours. */
  private hearth(el: HTMLElement, s: Readonly<GameState>, place: PlaceId, y: number): void {
    const yours = this.c.q.hearths(s).includes(place);
    new Words(el, RX, y, 22, yours ? VIOLET : PALE).set(uiText('gift.hearth.name'));
    line(el, RX, y + 30, 840, 17, DIM, uiText('gift.hearth.line', { hold: GIFTS.hearth.hold }));
    if (!yours) line(el, RX, y + 60, 840, 17, PALE, uiText('building.hearthNot'));
  }

  /** A move announced against it: what lands when, and each answer it can take here. */
  private band(el: HTMLElement, s: Readonly<GameState>, t: Threat, y: number, say: (w: string) => void): number {
    const b = surface(el, 'parchDark', 14, y, W - 28, 88);
    const when = uiText('building.when', { day: this.c.q.day(t.lands), hour: Math.floor(this.c.q.hour(t.lands)) });
    new Words(b, 16, 12, 20, BLOOD).set(`${uiText(`threat.${t.kind}.name`)}, ${when}`);
    line(b, 16, 40, 560, 15, PALE, uiText(`threat.${t.kind}.lands`, THREAT_SLOTS[`threat.${t.kind}.lands`]));
    const answers: [string, string][] = [];
    for (const a of THREATS[t.kind].answers) {
      if (a === 'favour' || a === 'hide') answers.push([a, a]);
      else if (ANSWER_ITEM[a]) for (const it of Object.values(s.items)) if (it.wearer === null && it.kind === ANSWER_ITEM[a]) answers.push([a, it.id]);
    }
    answers.slice(0, 4).forEach(([a, by], i) => {
      const act: Action = { type: 'answer', threat: t.id, with: by };
      const label = uiText(`answer.${a as Answer}.name`);
      verb(b, 600 + i * 140, 14, 132, 60, label.charAt(0).toUpperCase() + label.slice(1), why1(this.c.q.check(s, act)), () => this.c.act(act), say, uiText('building.oneAction'));
    });
    if (answers.length === 0) new Words(b, 600, 34, 16, DIM).set(uiText('building.noAnswer'));
    return y + 88;
  }

  private bench(el: HTMLElement, s: Readonly<GameState>, f: Facility, y: number, say: (w: string) => void, hands: readonly Person[]): void {
    const q = this.c.q;
    new Words(el, RX, y, 22, PALE).set(uiText(`facility.${f}.name`));
    line(el, RX, y + 30, 840, 17, DIM, uiText(`facility.${f}.makes`));
    y += 66;
    const st = q.facilities(s).find((x) => x.facility === f)!;
    if (!st.open) {
      for (const r of st.why.slice(0, 3)) {
        line(el, RX, y, 840, 17, PALE, uiText(r.key, r.slots));
        y += 46;
      }
      return;
    }
    const pouch = Object.values(s.crystals).filter((c) => 'pouch' in c.at);
    if (this.sel && !s.crystals[this.sel]) this.sel = null;
    if (pouch.length === 0) line(el, RX, y, 840, 17, DIM, uiText('building.noLooseStones'));
    pouch.slice(0, 10).forEach((c, i) => {
      stoneTile(el, RX + i * (TILE_W + 10), y, c, uiText(`grade.${c.grade}`), c.id === this.sel, () => { this.sel = c.id; this.c.redraw(); });
    });
    y += TILE_H + 12;
    const c = this.sel ? s.crystals[this.sel]! : null;
    if (c) {
      let a: Action;
      let label: string;
      if (f === 'faceting') {
        a = { type: 'facet', crystal: c.id };
        label = uiText('btn.recutIt');
        line(el, RX, y, 560, 17, PALE, uiText('building.recutHint'));
      } else if (f === 'jewelry') {
        a = { type: 'forge', crystal: c.id, form: this.form };
        label = uiText('btn.forgeIt');
        FORMS.forEach((form, i) => {
          const p = surface(el, form === this.form ? 'violet' : 'parchDark', RX + i * 186, y, 176, 96, 'hg-hit');
          line(p, 10, 8, 156, 16, PALE, thingText(form, 'name', c.name));
          line(p, 10, 50, 156, 13, DIM, thingText(form, 'line'));
          p.addEventListener('click', () => { this.form = form; this.c.redraw(); });
        });
      } else {
        const kind = FACILITY_ITEM[f];
        a = { type: 'craft', facility: f, crystal: c.id };
        label = uiText('btn.makeIt');
        new Words(el, RX, y, 20, PALE).set(thingText(kind, 'name', c.name));
        line(el, RX, y + 28, 560, 16, VIOLET, uiText('building.wornByYours', { boon: thingText(kind, 'line') }));
        line(el, RX, y + 64, 560, 16, BLOOD, uiText('building.slippedElse', { curse: thingText(kind, 'gift') }));
      }
      const ch = q.check(s, a);
      verb(el, RX + 588, y, 260, 84, label, why1(ch), () => this.c.act(a), say, uiText('grave.nether', { n: ch.nether }));
      y += 112;
    } else if (pouch.length > 0) {
      line(el, RX, y, 560, 17, DIM, uiText('building.pickFromTray'));
      y += 40;
    }
    // what waits to be given, to whoever works here
    const hand = Object.values(s.items).filter((it) => it.wearer === null);
    if (hand.length === 0) return;
    const it = hand[0]!;
    line(el, RX, y, 840, 17, PALE, uiText(hand.length > 1 ? 'building.waitsMore' : 'building.waits', { name: itemText(s, it, 'name'), n: hand.length - 1 }));
    hands.slice(0, 5).forEach((p, i) => {
      const a: Action = { type: 'give', item: it.id, unit: p.id };
      const b = verb(el, RX + i * 168, y + 30, 160, 52, p.name, why1(this.c.q.check(s, a)), () => this.c.act(a), say, '', p.follower ? VIOLET : BLOOD);
      attr(b, 'title', p.follower ? uiText('building.wearsIt', { name: p.name, boon: itemText(s, it, 'line') }) : uiText('building.slippedTo', { name: p.name, curse: itemText(s, it, 'gift') }));
    });
  }

  /** A gift: what it does, each pick it needs as a row of chips (the first taken to start with), its verb for the whole pick. */
  private gift(el: HTMLElement, s: Readonly<GameState>, g: Gift, y: number, say: (w: string) => void): void {
    new Words(el, RX, y, 22, PALE).set(uiText(`gift.${g}.name`));
    line(el, RX, y + 30, 840, 17, DIM, uiText(`gift.${g}.line`, { cool: GIFTS.rumour.cool, resist: -GIFTS.debt.resist, days: GIFTS.food.days }));
    y += 72;
    const picked: Record<string, string> = {};
    for (const [id, options] of giftPicks(this.c.q, s, g)) {
      const on = options.some(([o]) => o === this.picks[id]) ? this.picks[id]! : options[0]?.[0];
      if (on === undefined) continue;
      picked[id] = on;
      new Words(el, RX, y + 9, 17, DIM).set(uiText(`gift.pick.${id}`));
      options.forEach(([o, label], i) => {
        const b = surface(el, o === on ? 'violet' : 'parchDark', RX + 80 + (i % 5) * 152, y + Math.floor(i / 5) * 44, 144, 38, 'hg-hit');
        new Words(b, 0, 9, 16, PALE, 'center', 144).set(label);
        b.addEventListener('click', () => { this.picks = { ...this.picks, [id]: o }; this.c.redraw(); });
      });
      y += Math.ceil(options.length / 5) * 44 + 8;
    }
    const target = picked.power ?? picked.who ?? picked.where;
    const a: Action = {
      type: 'useGift', gift: g,
      ...(target ? { target } : {}),
      ...(picked.how ? { mode: picked.how as 'poison' | 'bless', day: Number(picked.day) } : {}),
    };
    const ch = this.c.q.check(s, a);
    verb(el, RX, y + 6, 300, 64, uiText(`gift.${g}.name`), why1(ch), () => this.c.act(a), say, uiText('gift.cost', { ap: ch.ap, n: ch.nether }));
  }

  private vault(el: HTMLElement, s: Readonly<GameState>, y: number, say: (w: string) => void): void {
    new Words(el, RX, y, 24, s.flags.vaultOpen ? VIOLET : PALE).set(uiText(s.flags.vaultOpen ? 'building.vaultOpen' : 'building.vault'));
    line(el, RX, y + 36, 480, 18, PALE, uiText('building.vaultLine'));
    const a: Action = { type: 'openVault' };
    verb(el, RX + 560, y, 270, 84, uiText('btn.openVault'), why1(this.c.q.check(s, a)), () => this.c.act(a), say, uiText('building.oneAction'));
  }

  press(e: KeyboardEvent, vm: ViewModel): boolean {
    if (!bound(vm.settings, 'back', e)) return false;
    this.c.focus(null);
    return true;
  }
}
