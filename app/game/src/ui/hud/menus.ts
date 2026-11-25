import type { FactionId, GameState, Intent, Menu, Person, Query, Settings, ViewModel } from '../../types';
import { hasText, uiText } from '../../content/text';
import { area, maxIchor, whereNow } from '../../sim/core';
import { portrait, verb, slab } from '../panels/art';
import { BLOOD, DIM, PALE, Pic, VIOLET, Words, attr, div, row, surface } from '../kit';
import type { Anchors } from '../index';
import { GOD_H } from './god';
import { POWERS_W } from './powers';

// The menus (inventory #107, 109, 110): what app's `vm.menu` holds open, one at a time over the rest layout. The stats
// menu (I, or the god's corner) hangs under the god's corner: each night's urges and stores, your people, your rank,
// the powers, a label and a number a row, its line on hover. The characters menu (P): yours, then those walking against
// you, a face, a name, a trade, where they are and what they do; a click looks at them. Settings (Esc, or the cog):
// the volumes, the interface's size, the hints. Each is built again only when what it shows may have moved.

const POWERS: readonly FactionId[] = ['temple', 'council', 'public'];
const STATS_W = 440;
const PEOPLE_W = 620, ROW_H = 70, NONE_H = 36, PEOPLE_H = 640;
const SET_W = 520;
const VOLUMES: readonly (keyof Settings & ('master' | 'music' | 'sfx' | 'ambience'))[] = ['master', 'music', 'sfx', 'ambience'];
const SIZES: readonly Settings['uiSize'][] = ['small', 'medium', 'large'];

type Row = [label: string, value: string, tone: string, tip: string];

export class Menus {
  private readonly cog: HTMLDivElement;
  private menu: Menu = null;
  private set: Readonly<Settings> | null = null;
  private hour = -1;
  private root: HTMLDivElement | null = null;

  constructor(private readonly at: Anchors, cogAt: HTMLElement, private readonly send: (i: Intent) => void, private readonly q: Query) {
    this.cog = surface(cogAt, 'slab', -POWERS_W - 56, 0, 44, 44, 'hg-hit');
    new Pic(this.cog, 22, 22, 'icon.cog');
    attr(this.cog, 'title', uiText('menu.settings'));
    // the cog stands left of the powers, where nothing else is
    this.cog.addEventListener('click', () => this.send({ kind: 'menu', menu: 'settings' }));
  }

  frame(vm: ViewModel): void {
    const s = vm.state, m = vm.menu, hour = Math.floor(this.q.hour(s.tick));
    // stats and people move with the state and the hour; settings with the settings (a new object on each change)
    if (m === this.menu && vm.settings === this.set && (m === 'settings' || (vm.fresh.length === 0 && hour === this.hour))) return;
    this.menu = m;
    this.set = vm.settings;
    this.hour = hour;
    this.root?.remove();
    this.root = null;
    if (!m) return;
    if (m === 'stats') this.stats(s);
    else if (m === 'people') this.people(s);
    else this.settings(vm.settings);
  }

  private close = (): void => this.send({ kind: 'menu', menu: null });

  /** A slab with its title tab and a Close plate, in `anchor` at (x, y). */
  private pane(anchor: HTMLElement, x: number, y: number, w: number, h: number, title: string): HTMLDivElement {
    this.root = div(anchor, 'hg-b hgp-in');
    const { el, say } = slab(this.root, x, y, w, h, title);
    verb(el, w - 120, 16, 100, 40, uiText('btn.close'), '', this.close, say);
    return el;
  }

  private stats(s: Readonly<GameState>): void {
    const st = this.q.stats(s), g = s.god;
    const sign = (n: number): string => `${n >= 0 ? '+' : ''}${n}`;
    const groups: [string, Row[]][] = [
      [uiText('stats.night'), [
        [uiText('stats.hunger', { word: uiText(`urge.hunger.${this.q.urge(s, 'hunger')}`) }), `${Math.round(g.hunger)}`, PALE, uiText('stats.hunger.tip', { n: sign(st.hungerRise ?? 0) })],
        [uiText('stats.malice', { word: uiText(`urge.malice.${this.q.urge(s, 'malice')}`) }), `${Math.round(g.malice)}`, BLOOD, uiText('stats.malice.tip', { n: sign(st.maliceRise ?? 0) })],
        [uiText('hud.ichor'), `${Math.round(g.ichor)} / ${maxIchor(s)}`, PALE, uiText('stats.ichor.tip')],
        [uiText('stats.nether'), `${Math.floor(g.nether)}  ${sign(Math.round(st.nether ?? 0))}`, VIOLET, uiText('stats.nether.tip')],
      ]],
      [uiText('stats.people'), [
        [uiText('stats.followers'), `${Object.values(s.people).filter((p) => p.follower && !p.gone).length}`, VIOLET, uiText('stats.followers.tip')],
        [uiText('stats.faith'), `${st.faith ?? 0}`, PALE, uiText('stats.faith.tip')],
        [uiText('stats.influence'), `${Math.round(st.influence ?? 0)}`, PALE, uiText('stats.influence.tip')],
        [uiText('stats.presence'), `${Math.round(st.presence ?? 0)}`, PALE, uiText('stats.presence.tip')],
      ]],
      [uiText('stats.rank', { n: g.level }), [
        [uiText('stats.xp'), `${st.xpToNext ?? 0}`, VIOLET, uiText('stats.xp.tip')],
      ]],
      [uiText('stats.powers'), [
        ...POWERS.map((f): Row => [uiText(`power.${f}`), `${Math.round(s.factions[f].suspicion)}`, s.factions[f].level >= 2 ? BLOOD : PALE, `${uiText(`power.${f}.${s.factions[f].level}`)}\n${uiText('stats.cooling', { n: st.cooling ?? 0 })}`]),
      ]],
    ];
    const h = 84 + groups.reduce((a, [, rows]) => a + 38 + rows.length * 30, 0) + 16;
    const el = this.pane(this.at.tl, 0, GOD_H + 12, STATS_W, h, uiText('menu.stats'));
    let y = 80;
    for (const [head, rows] of groups) {
      new Words(el, 28, y + 8, 17, DIM).set(head);
      y += 38;
      for (const [label, value, tone, tip] of rows) {
        const r = div(el, 'hg-b hg-hit', 20, y - 4, STATS_W - 40, 28);
        attr(r, 'title', `${label}\n${tip}`);
        new Words(r, 16, 2, 20, PALE).set(label);
        new Words(r, STATS_W - 40 - 216, 0, 22, tone, 'right', 200).num().set(value);
        y += 30;
      }
    }
  }

  private people(s: Readonly<GameState>): void {
    const live = Object.values(s.people).filter((p) => !p.gone);
    const walkers = new Set(s.threats.flatMap((t) => t.walkers));
    const against = live.filter((p) => !p.follower && walkers.has(p.id));
    const groups: [string, Person[]][] = [
      [uiText('people.yours'), live.filter((p) => p.follower)],
      [uiText('people.against'), against],
      // the masters of the buildings and the Elites: who is worth turning
      [uiText('people.known'), live.filter((p) => !p.follower && !against.includes(p) && (p.masterOf.length > 0 || p.standing === 'elite'))],
    ];
    const rows = groups.reduce((a, [, ps]) => a + 32 + (ps.length ? ps.length * ROW_H : NONE_H), 0);
    const h = Math.min(PEOPLE_H, 96 + rows);
    const el = this.pane(this.at.c, -PEOPLE_W / 2, -h / 2, PEOPLE_W, h, uiText('menu.people'));
    const list = div(el, 'hg-b hg-scroll', 20, 76, PEOPLE_W - 40, h - 96);
    let y = 0;
    for (const [head, ps] of groups) {
      const hr = row(list, 8, y + 6);
      new Words(hr, 0, 0, 17, DIM).set(head);
      new Words(hr, 0, 0, 17, DIM).num().set(String(ps.length));
      y += 32;
      if (ps.length === 0) {
        new Words(list, 8, y + 4, 17, DIM).set(uiText('people.none'));
        y += NONE_H;
      }
      for (const p of ps) {
        const r = div(list, 'hg-b hg-hit', 0, y, PEOPLE_W - 60, ROW_H - 6);
        portrait(r, s, p, 32, 32, 58);
        new Words(r, 72, 8, 20, p.follower ? VIOLET : PALE).set(p.name);
        new Words(r, 72, 36, 16, DIM).set(this.line(s, p));
        if (p.follower) new Words(r, PEOPLE_W - 76, 10, 20, PALE, 'right', 0).num().set(String(Math.round(p.stats.devotion)));
        r.addEventListener('click', () => {
          this.send({ kind: 'focus', focus: { unit: p.id } });
          this.close();
        });
        y += ROW_H;
      }
    }
    div(list, 'hg-b', 0, y, 1, 1);
  }

  /** A trade, where they are now and what they do, and a follower's standing order. */
  private line(s: Readonly<GameState>, p: Readonly<Person>): string {
    const at = whereNow(p, s.tick);
    const place = uiText(hasText(`place.${at}.name`) ? `place.${at}.name` : `area.${area(at)}.name`);
    const doing = uiText(`doing.${p.at.doing}`);
    const order = p.routine ? uiText('people.order', { order: uiText(`routine.${p.routine}`) }) : '';
    return uiText('people.line', { role: uiText(`role.${p.role}.name`), place, doing, order });
  }

  private settings(set: Readonly<Settings>): void {
    const el = this.pane(this.at.c, -SET_W / 2, -230, SET_W, 460, uiText('menu.settings'));
    VOLUMES.forEach((v, i) => {
      const y = 92 + i * 52;
      new Words(el, 36, y, 20, PALE).set(uiText(`settings.${v}`));
      const r = el.appendChild(document.createElement('input'));
      r.type = 'range';
      r.min = '0';
      r.max = '100';
      r.value = String(Math.round(set[v] * 100));
      r.className = 'hg-range';
      Object.assign(r.style, { left: '200px', top: `${y}px` });
      r.addEventListener('change', () => this.send({ kind: 'settings', patch: { [v]: Number(r.value) / 100 } }));
    });
    new Words(el, 36, 310, 20, PALE).set(uiText('settings.uiSize'));
    SIZES.forEach((z, i) => {
      const b = verb(el, 200 + i * 98, 298, 90, 42, uiText(`settings.size.${z}`), '', () => this.send({ kind: 'settings', patch: { uiSize: z } }), () => {});
      if (z !== set.uiSize) b.style.filter = 'saturate(0.3) brightness(0.8)';
    });
    new Words(el, 36, 374, 20, PALE).set(uiText('settings.hints'));
    // turned on again, every hint teaches once more
    const hints = verb(el, 200, 362, 150, 42, uiText(set.hints ? 'settings.on' : 'settings.off'), '', () => this.send({ kind: 'settings', patch: set.hints ? { hints: false } : { hints: true, seenHints: [] } }), () => {});
    attr(hints, 'title', uiText('settings.hintsTip'));
  }
}
