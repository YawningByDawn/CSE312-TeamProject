import type { Action, Person as P, PlaceId, Routine, ViewModel } from '../../types';
import { isDay } from '../../content/clock';
import { hasText, uiText } from '../../content/text';
import { bound, keyName } from '../../content/keys';
import { HOST } from '../../content/stats';
import { PLACES } from '../../content/world';
import { BLOOD, DIM, INK, PALE, VIOLET, Words, attr, backed, cell, line, portrait, slab, surface, verb } from './art';
import { why1 } from './grave';
import type { Ctx, Panel } from './index';

// The person slab (inventory #115): portrait, name, trade, what they do where, their ties, where they work; Whisper with
// its odds, or a follower's routines and Move; things to give them and to take back. Moving: the next place picked in
// the world is where they go, and the slab comes back.

const W = 340;
const ROUTINES: readonly Routine[] = ['pray', 'offer', 'lieLow', 'delve', 'skim'];
const STATS = ['strength', 'dexterity', 'intelligence', 'endurance', 'hp', 'devotion', 'resistance'] as const;
const ICON: Partial<Record<string, string>> = { move: 'icon.move', pray: 'icon.pray', offer: 'icon.offer', lieLow: 'icon.low', whisper: 'icon.whisper' };
/** Reasons that mean a routine is not theirs to have yet: its button is not shown. */
const NOT_YET = new Set(['why.rank', 'why.shade', 'why.notDigger', 'why.notHauler', 'why.deepOpen']);

/** A place's name: a home is the household's. */
export const placeName = (p: PlaceId): string => (p.startsWith('home:') ? uiText('person.home') : uiText(PLACES[p] ? `place.${p}.name` : `area.${p}.name`));

/** What they do where, now. */
function doing(p: Readonly<P>): string {
  const at = p.at;
  const where = 'place' in at ? at.place : at.route[at.route.length - 1]!;
  return uiText('person.doing', { doing: uiText(`doing.${at.doing}`), place: placeName(where) });
}

function oddsWord(odds: number): string {
  const word = odds < 0.35 ? 'unlikely' : odds < 0.6 ? 'even' : odds < 0.85 ? 'likely' : 'certain';
  return uiText('odds.text', { word: uiText(`odds.${word}`), pct: Math.round(odds * 100) });
}

export class Person implements Panel {
  /** Moving this follower: the focus key when Move was pressed. */
  private moving: { unit: string; from: string } | null = null;
  constructor(private readonly c: Ctx) {}

  key(vm: ViewModel): string | null {
    const f = vm.focus, s = vm.state;
    if (this.moving) {
      const k = JSON.stringify(f);
      if (k !== this.moving.from && f && 'place' in f) {
        const unit = this.moving.unit;
        this.moving = null;
        this.c.act({ type: 'move', unit, to: f.place });
        this.c.focus({ unit });
      }
      if (this.moving) return `move|${this.moving.unit}`;
    }
    const on = !vm.title && !vm.film && s.phase === 'live' && f !== null && 'unit' in f && s.people[f.unit] !== undefined;
    return on ? `person|${(f as { unit: string }).unit}|${this.c.rev}` : null;
  }

  build(root: HTMLElement, vm: ViewModel): void {
    const s = vm.state, q = this.c.q;
    if (this.moving) {
      const { el } = slab(root, 260, 250, 520, 110, s.people[this.moving.unit]!.name);
      line(el, 24, 70, 472, 19, VIOLET, uiText('person.moveWhere', { back: keyName(vm.settings.keys.back[0] ?? '') }));
      return;
    }
    const p = s.people[(vm.focus as { unit: string }).unit]!;
    const { el, fit } = backed(root, -388, -360, W, 10);
    const status = new Words(el, 16, 0, 16, BLOOD);
    const say = (why: string): void => status.set(why);
    portrait(el, s, p, 64, 78, 100);
    const tw = Math.max(132, Math.min(198, p.name.length * 15 + 22));
    surface(el, 'parch', 128, 18, tw, 46);
    new Words(el, 128, 28, p.name.length > 11 ? 24 : 30, INK, 'center', tw).set(p.name);
    new Words(el, 132, 72, 17, DIM).set(uiText(`role.${p.role}.name`));
    let y = 96;
    const text = (t: string, color = PALE, size = 18): void => {
      line(el, 132, y, W - 144, size, color, t);
      y += Math.ceil(t.length / 22) * size * 1.25;
    };
    text(p.gone ? uiText('person.fallen') : p.follower && p.routine ? `${uiText(`routine.${p.routine}`)} · ${doing(p)}` : doing(p));
    const left = q.markLeft(s, p.id);
    if (left > 0) text(uiText('person.marked', { n: left }), VIOLET);
    y = Math.max(y, 140);
    if (hasText(`person.${p.id}.bio`)) {
      const bio = uiText(`person.${p.id}.bio`);
      line(el, 16, y, W - 32, 16, DIM, bio).style.fontStyle = 'italic';
      y += Math.ceil(bio.length / 38) * 20 + 8;
    }
    STATS.forEach((k, i) => {
      const x = 16 + (i % 2) * 160, ny = y + Math.floor(i / 2) * 24;
      const v = k === 'resistance' ? p.resistance : p.stats[k];
      new Words(el, x, ny, 16, DIM).set(uiText(`person.stat.${k}`));
      new Words(el, x, ny, 18, PALE, 'right', 140).num().set(k === 'hp' ? `${Math.round(v)} / ${Math.round(q.maxHp(p))}` : String(Math.round(v)));
    });
    y += Math.ceil(STATS.length / 2) * 24 + 8;
    const work = verb(el, 100, y, W - 116, 34, placeName(p.work), '', () => this.c.focus({ place: p.work }), say);
    attr(work, 'title', uiText('person.open', { name: placeName(p.work) }));
    new Words(el, 16, y + 8, 16, DIM).set(uiText('person.worksAt'));
    y += 46;
    for (const t of p.ties.slice(0, 4)) {
      const o = s.people[t];
      if (!o) continue;
      const tie = new Words(el, 16, y, 16, o.follower ? VIOLET : DIM);
      tie.set(uiText('person.tie', { name: o.name, tie: uiText(`tie.kind.${q.tieKind(s, p.id, t)}`) }));
      tie.el.classList.add('hg-hit');
      tie.el.addEventListener('click', () => this.c.focus({ unit: t }));
      y += 22;
    }

    // by day the only act is the swap: the host's list of others to wear, or this one when they are on it
    y += 8;
    const day = isDay(s.tick);
    const others = day ? q.hosts(s).filter((id) => id !== s.host && (p.id === s.host || id === p.id)) : [];
    if (others.length > 0) {
      if (p.id === s.host) new Words(el, 16, y, 16, DIM).set(uiText('host.swap'));
      others.forEach((id, i) => {
        const o = s.people[id]!;
        const sub = `${uiText('host.hp', { hp: Math.round(o.stats.hp), max: Math.round(q.maxHp(o)) })} · ${uiText(`role.${o.role}.name`)}`;
        verb(el, 14, y + (p.id === s.host ? 26 : 0) + i * 60, W - 28, 52, uiText(p.id === s.host ? 'host.swapTo' : 'host.wear', { name: o.name }), '', () => {
          this.c.act({ type: 'possess', unit: id });
          this.c.focus({ unit: id });
        }, say, sub);
      });
      y += (p.id === s.host ? 26 : 0) + others.length * 60;
    }

    // the acts: Whisper for anyone else; Move and the routines for a follower
    const acts: { id: string; label: string; a: Action | null; lit?: boolean; cap?: string }[] = [];
    if (p.gone) {
      if (p.gone === 'dead' && p.stats.devotion > 0) {
        text(uiText('btn.reviveCost', { n: HOST.reviveStones }), VIOLET, 16);
        acts.push({ id: 'revive', label: uiText('btn.revive'), a: { type: 'revive', unit: p.id } });
      }
    } else if (!p.follower) {
      // by day the mark (its key on the plate), by night the whisper it opens
      const marked = p.marked === q.day(s.tick);
      if (day) acts.push({ id: 'mark', label: uiText(marked ? 'btn.marked' : 'btn.mark'), a: { type: 'mark', target: p.id }, lit: marked, cap: keyName(vm.settings.keys.mark[0] ?? '') });
      else acts.push({ id: 'whisper', label: uiText('btn.whisper'), a: { type: 'whisper', target: p.id } });
    } else if (!day) {
      acts.push({ id: 'move', label: uiText('btn.move'), a: null });
      for (const r of ROUTINES) {
        const a: Action = { type: 'setRoutine', unit: p.id, routine: r };
        const w = q.check(s, a).why[0]?.key;
        if (p.routine === r || !w || !NOT_YET.has(w)) acts.push({ id: r, label: uiText(`routine.${r}`), a, lit: p.routine === r });
      }
    }
    acts.forEach((x, i) => {
      const bx = 14 + (i % 4) * 80, by = y + Math.floor(i / 4) * 128;
      const ch = x.a ? q.check(s, x.a) : null;
      const why = x.lit ? '' : ch ? why1(ch) : '';
      const b = surface(el, x.lit ? 'violet' : why ? 'violetDim' : 'parchDark', bx, by, 74, 76, `hg-hit${why ? ' hgp-off' : ''}`);
      if (ICON[x.id]) cell(b, 'ui', ICON[x.id]!, 37, 40, 0.5);
      else new Words(b, 0, 28, 22, PALE, 'center', 74).set(x.cap ?? x.label.charAt(0));
      new Words(el, bx, by + 84, 16, x.lit ? VIOLET : PALE, 'center', 74).set(x.lit ? `${x.label} ·` : x.label);
      if (why) {
        attr(b, 'title', why);
        line(el, bx - 3, by + 104, 80, 13, BLOOD, why).style.textAlign = 'center';
      }
      b.addEventListener('click', () => {
        if (why) say(why);
        else if (x.lit) return;
        else if (x.a) this.c.act(x.a);
        else {
          this.moving = { unit: p.id, from: JSON.stringify(vm.focus) };
          this.c.redraw();
        }
      });
      if (x.id === 'whisper' && !why) {
        // the odds, and in the tip each term that moves them
        const o = q.odds(s, p.id);
        const odds = new Words(el, 104, by + 24, 22, VIOLET);
        odds.set(oddsWord(o.odds));
        odds.el.classList.add('hg-hit', 'hgp-odds');
        attr(odds.el, 'title', [oddsWord(o.odds), ...o.why.map((r) => uiText(r.key, r.slots))].join('\n'));
      }
    });
    y += Math.ceil(acts.length / 4) * 128;

    status.el.style.top = `${y + 4}px`;
    fit(y + 30);
  }

  press(e: KeyboardEvent, vm: ViewModel): boolean {
    if (!bound(vm.settings, 'back', e)) return false;
    if (this.moving) {
      this.moving = null;
      this.c.redraw();
    } else this.c.focus(null);
    return true;
  }
}
