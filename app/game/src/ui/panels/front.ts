import type { Bind, GameEvent, GameState, Reason, Settings, ViewModel } from '../../types';
import { AREAS } from '../../content/world';
import { uiText } from '../../content/text';
import { bound } from '../../content/keys';
import { DIM, PALE, VIOLET, Words, atlasMeta, attr, cell, div, line, mask, natural, tinted } from './art';
import type { Ctx, Panel } from './index';

// The front (inventory #1, 7, 94): the title over its still, with its baked lettering, the eye's glows and motes; the
// defeat's cause and words over the drained world, the god's last spark going out; the ending's lines over its film and
// the closing card after it. Coordinates are design px from the screen's centre.

const RUST = '#b5543a';
/** The god's last spark at the eye, at its own scale. */
const spark = (parent: HTMLElement): HTMLDivElement => cell(parent, 'defeat', 'spark', 0, 0, natural('defeat', 'spark').s);

/** A word of a menu: lit on hover or keys, a sub line under it. */
function item(parent: HTMLElement, x: number, y: number, size: number, text: string, sub: string, act: () => void): HTMLDivElement {
  const el = div(parent, 'hg-b hg-hit', x, y);
  el.style.transition = 'transform 0.15s, color 0.15s';
  new Words(el, 0, 0, size, 'rgba(236,226,204,0.72)').set(text);
  if (sub) new Words(el, 2, size + 4, 16, DIM).set(sub);
  // the lit word's mark (Menu shows it on the lit one): always the last child
  const mark = new Words(el, -18, size * 0.28, size * 0.6, VIOLET);
  mark.set('•');
  mark.el.hidden = true;
  el.addEventListener('click', act);
  el.addEventListener('mouseenter', () => el.dispatchEvent(new Event('hgp-focus')));
  return el;
}

/** Its two binds move the lit word; confirm takes it. */
class Menu {
  private i = 0;
  constructor(private readonly items: HTMLDivElement[], private readonly acts: (() => void)[]) {
    items.forEach((el, k) => el.addEventListener('hgp-focus', () => this.light(k)));
    this.light(0);
  }
  light(k: number): void {
    this.i = (k + this.items.length) % this.items.length;
    this.items.forEach((el, j) => {
      el.style.transform = j === this.i ? 'translateX(3px)' : '';
      (el.firstChild as HTMLElement).style.color = j === this.i ? '#f4ecdb' : 'rgba(236,226,204,0.72)';
      (el.lastChild as HTMLElement).hidden = j !== this.i;
    });
  }
  press(e: KeyboardEvent, set: Readonly<Settings>, back: Bind, next: Bind): boolean {
    if (bound(set, back, e)) this.light(this.i - 1);
    else if (bound(set, next, e)) this.light(this.i + 1);
    else if (bound(set, 'confirm', e)) this.acts[this.i]!();
    else return false;
    return true;
  }
}

/** The eye's glows: [cell, radius, from the eye, squash, faintest, brightest]. */
const GLOWS: readonly [string, number, number, number, number, number][] = [['glow.deep', 260, -30, 0.75, 0.1, 0.18], ['glow.eye', 60, 0, 0.5, 0.12, 0.22]];
const EMBERS = 16;
const MOTE: readonly number[] = [196, 160, 255];

/** The motes rising from the eye, each on its own loop: born in a spread over it, drifting up, out in 3 to 7 s. */
function embers(parent: HTMLElement): void {
  let seed = 21;
  const r = (): number => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32);
  for (let i = 0; i < EMBERS; i++) {
    const life = 3 + r() * 4;
    const m = div(parent, 'hg-b', (r() - 0.5) * 34, -6 + (r() - 0.5) * 10);
    m.style.cssText += `--dx:${((r() - 0.5) * 10 * life).toFixed(1)}px;--dy:${(-(14 + r() * 26) * life).toFixed(1)}px;--a:${(0.35 + r() * 0.5).toFixed(2)};`
      + `animation:hgp-ember ${life.toFixed(2)}s ${(-r() * life).toFixed(2)}s linear infinite`;
    // the mote's cell is baked per unit of radius
    tinted(div(m, 'hg-b hgp-sway'), 'title', 'ember', 0, 0, (0.8 + r() * 1.8) * natural('title', 'ember').s, MOTE, true);
  }
}

export class Title implements Panel {
  private menu: Menu | null = null;
  constructor(private readonly c: Ctx) {}

  /** The name in its baked lettering, over its breathing underglow; the ink bleeds in left to right. */
  private name(root: HTMLElement): void {
    const [bw, bh] = atlasMeta('title').nameBox as [number, number];
    // the old screen centred the name's box 42 px right of centre at y 205
    const box = div(root, 'hg-b', 42 - bw / 2, 205 - 450 - bh / 2, bw, bh);
    attr(box, 'aria-label', `${uiText('title.word')} ${uiText('title.inc')}`);
    const glow = div(box, 'hg-b', 0, 0);
    glow.style.animation = 'hgp-fade 1.3s 1.18s both';
    const g = cell(div(glow, 'hg-b hgp-glow'), 'title', 'name.glow', 0, 0, natural('title', 'name.glow').s);
    g.classList.add('hgp-add');
    g.parentElement!.style.cssText += '--a0:0.22;--a1:0.34';
    const wipe = natural('title', 'wipe');
    const win = div(box, 'hg-b', 0, 0, wipe.w, bh);
    mask(win, 'title', 'wipe', wipe.s, (wipe.s * bh) / wipe.h);
    const ink = div(win, 'hg-b', 0, 0);
    for (const [el, w] of [[win, -wipe.w], [ink, wipe.w]] as const) el.style.cssText += `--w:${w}px;animation:hgp-wipe 2.2s 0.3s cubic-bezier(0.2,0.7,0.3,1) both`;
    cell(ink, 'title', 'name.ink', 0, 0, natural('title', 'name.ink').s);
  }

  key(vm: ViewModel): string | null {
    return vm.title ? `title|${vm.saved}|${vm.settings.master > 0}|${this.c.account?.name}` : null;
  }

  build(root: HTMLElement, vm: ViewModel): void {
    const send = this.c.send;
    const ground = div(root, 'hg-b', -1200, -700, 2400, 1400);
    ground.style.background = '#000';
    // before the still is up, the spark alone in the black where the eye will be
    const alone = div(root, 'hg-b', EYE.x, EYE.y);
    alone.style.animation = 'hgp-tspark 2.4s both';
    spark(alone).classList.add('hgp-add');
    const still = div(root, 'hg-b', 0, 0);
    still.style.animation = 'hgp-still 2.4s both, hgp-breath 9.5s ease-in-out infinite alternate';
    cell(still, 'front', 'still', -800, -450, 1 / 1.2);
    // the eye's breathing light (deep and wide, small and bright) and the motes rising from it, in with the still
    const lit = div(root, 'hg-b', EYE.x, EYE.y);
    lit.style.animation = 'hgp-still 2.4s both';
    for (const [name, r, dy, squash, a0, a1] of GLOWS) {
      // a glow's cell is baked per unit of radius
      const g = cell(div(lit, 'hg-b hgp-glow', 0, dy), 'title', name, 0, 0, r * natural('title', name).s);
      g.classList.add('hgp-add');
      g.parentElement!.style.cssText += `--a0:${a0};--a1:${a1};transform:scaleY(${squash})`;
    }
    embers(lit);
    this.name(root);

    const nav = div(root, 'hg-b', -682, 150);
    nav.style.animation = 'hgp-fade 1.1s 0.9s both';
    attr(nav, 'aria-label', uiText('title.menu'));
    const seedOf = (): number | undefined => (field.value.trim() ? Number(field.value.trim()) >>> 0 : undefined);
    const acts: (() => void)[] = [];
    if (vm.saved !== null) acts.push(() => send({ kind: 'continue' }));
    acts.push(() => send({ kind: 'newRun', ...(seedOf() !== undefined ? { seed: seedOf()! } : {}) }), () => send({ kind: 'menu', menu: 'settings' }));
    const words = vm.saved !== null
      ? [[uiText('btn.proceed'), uiText('title.continueSub', { n: vm.saved })], [uiText('title.beginAnew'), '']]
      : [[uiText('title.begin'), '']];
    let y = 0;
    const items = words.map(([w, sub], k) => {
      const el = item(nav, 0, y, 34, w!, sub!, acts[k]!);
      y += sub ? 70 : 50;
      return el;
    });
    items.push(item(nav, 0, y + 6, 24, uiText('title.settings'), '', acts[acts.length - 1]!));
    this.menu = new Menu(items, acts);

    const row = div(nav, 'hg-b', 230, words.length * 50 - 44);
    new Words(row, 0, 0, 12, DIM).set(uiText('title.seed').toUpperCase());
    const field = row.appendChild(document.createElement('input'));
    field.className = 'hgp-seed';
    Object.assign(field.style, { left: '0px', top: '18px', width: '86px', fontSize: '16px' });
    field.inputMode = 'numeric';
    field.maxLength = 9;
    field.placeholder = uiText('title.seedRandom');
    field.title = `${uiText('title.seed')}: ${uiText('title.seedTip')}`;
    field.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') acts[vm.saved !== null ? 1 : 0]!();
    });
    const dice = item(row, 104, 18, 17, uiText('title.rollWord'), '', () => { field.value = String(1 + Math.floor(Math.random() * 999999998)); });
    attr(dice, 'title', uiText('title.roll'));

    const foot = div(root, 'hg-b', 782, 412);
    const quiet = new Words(foot, -540, 0, 13, 'rgba(236,226,204,0.38)', 'right', 500);
    quiet.el.style.fontStyle = 'italic';
    quiet.set(uiText('title.quiet'));
    const on = vm.settings.master > 0;
    const sound = item(foot, 0, -6, 22, on ? '♪' : '–', '', () => send({ kind: 'settings', patch: { master: on ? 0 : 1 } }));
    attr(sound, 'title', uiText(on ? 'title.soundOn' : 'title.soundOff'));

    const account = this.c.account;
    if (account) {
      const name = account.name;
      const corner = new Words(root, 282, -432, 20, 'rgba(236,226,204,0.72)', 'right', 500);
      corner.el.classList.add('hg-hit');
      corner.set(name === null ? uiText('title.logIn') : uiText('title.logOut', { name }));
      corner.el.addEventListener('click', name === null ? this.c.signIn : account.logOut);
    }
  }

  press(e: KeyboardEvent, vm: ViewModel): boolean {
    return this.menu?.press(e, vm.settings, 'up', 'down') ?? false;
  }
}

/** The run's days lasted, everyone it turned, its mine, how far it rose and its whispers: what the defeat tells. */
function runLines(s: Readonly<GameState>, days: number): string[] {
  const t = s.tally;
  const mine = Object.keys(AREAS);
  const pct = Math.round((100 * mine.filter((a) => s.places[a]!.rooted).length) / mine.length);
  const realm = uiText(`realm.${Math.min(7, s.god.level)}`);
  return [
    days <= 1 ? uiText('defeat.nights.one') : uiText('defeat.nights.many', { n: days }),
    t.turned === 0 ? uiText('defeat.followers.none') : t.turned === 1 ? uiText('defeat.followers.one') : uiText('defeat.followers.many', { ever: t.turned, peak: t.peak }),
    pct === 0 ? uiText('defeat.mine.none') : pct === 100 ? uiText('defeat.mine.all') : uiText('defeat.mine.end', { pct }),
    uiText(s.flags.liftRooted ? 'defeat.reach.lift' : 'defeat.reach.none', { realm }),
    t.whispers === 0 ? uiText('defeat.whispers.none') : uiText('defeat.whispers.some', { w: t.whispers, c: t.turned }),
  ];
}

const CAUSE: Record<string, string> = { 'end.ichor': 'starved', 'end.sealed': 'council', 'end.rootedOut': 'alone' };
/** The grave's eye on the title's still, from the screen's centre. */
const EYE = { x: 0, y: 218 };

export class Defeat implements Panel {
  private why: Reason | null = null;
  private menu: Menu | null = null;
  private last: HTMLDivElement | null = null;
  private readonly eye = { x: 0, y: 0 };
  constructor(private readonly c: Ctx) {}

  key(vm: ViewModel): string | null {
    const end = vm.fresh.find((e): e is Extract<GameEvent, { kind: 'end' }> => e.kind === 'end');
    if (end) this.why = end.why;
    return vm.state.phase === 'lost' && !vm.title && this.why ? `lost|${vm.state.seed}|${vm.state.tick}` : null;
  }

  build(root: HTMLElement, vm: ViewModel): void {
    const s = vm.state, why = this.why!;
    // the world drains round the grave's eye under it (the view); the screen takes the pointer from the world
    div(root, 'hg-b hgp-slab', -1200, -700, 2400, 1400);
    // the god's last spark at the grave's eye gutters and goes out
    this.last = div(root, 'hg-b', 0, 0);
    this.last.style.animation = 'hgp-spark 8.6s linear both';
    spark(this.last).classList.add('hgp-add', 'hgp-gutter');
    this.tick();
    const col = div(root, 'hg-b', -440, -330, 880);
    const at = (el: HTMLElement, delay: number): void => { el.classList.add('hgp-in'); el.style.animationDelay = `${delay}s`; };
    const days = this.c.q.day(s.tick);
    const kicker = new Words(col, 0, 0, 14, RUST, 'center', 880);
    kicker.set((days > 0 ? uiText('defeat.kicker', { n: days }) : uiText('defeat.kickerBare')).toUpperCase());
    at(kicker.el, 0.7);
    // what killed the god, in one picture: 240 x 120 of its units in a 352 x 176 box, its cell 3 px a unit
    const cause = CAUSE[why.key]!;
    const pic = div(col, 'hg-b', 264, 26, 352, 176);
    cell(pic, 'defeat', `cause.${cause}`, 0, 0, (352 / 240) * natural('defeat', `cause.${cause}`).s);
    attr(pic, 'aria-label', uiText(`defeat.label.${cause}`));
    at(pic, 1.5);
    const said = line(col, 0, 214, 880, 40, '#efe6d2', uiText(why.key, why.slots));
    said.style.textAlign = 'center';
    at(said, 0.7);
    runLines(s, days).forEach((t, i) => {
      const l = new Words(col, 0, 340 + i * 30, 20, PALE, 'center', 880);
      l.set(t);
      at(l.el, 2.5 + 0.32 * i);
    });
    const acts = [
      () => this.c.send({ kind: 'newRun' }),
      () => this.c.send({ kind: 'newRun', seed: s.seed }),
      () => this.c.send({ kind: 'title' }),
    ];
    const subs = [uiText('defeat.againSub'), uiText('defeat.sameSub', { seed: s.seed }), ''];
    const items = [uiText('defeat.again'), uiText('defeat.same'), uiText('defeat.title')].map((w, i) => item(col, 200 + i * 190, 510, 24, w, subs[i]!, acts[i]!));
    for (const el of items) at(el, 4.6);
    this.menu = new Menu(items, acts);
    // the starting gift the run kept
    if (s.tally.gift) {
      const kept = new Words(col, 0, 600, 15, DIM, 'center', 880);
      kept.el.style.fontStyle = 'italic';
      kept.set(uiText('defeat.kept', { name: uiText(`card.${s.tally.gift}.name`) }));
      at(kept.el, 4.9);
    }
  }

  /** The spark stands on the eye as the view shows it, and is out while the eye is off the screen. */
  tick(): void {
    const on = this.c.where('grave', this.eye), st = this.last!.style;
    this.last!.hidden = !on;
    // (its animation owns its transform)
    if (on) st.left = `${this.eye.x}px`, st.top = `${this.eye.y}px`;
  }

  press(e: KeyboardEvent, vm: ViewModel): boolean {
    if (bound(vm.settings, 'again', e)) {
      this.c.send({ kind: 'newRun', seed: vm.state.seed });
      return true;
    }
    return this.menu?.press(e, vm.settings, 'left', 'right') ?? false;
  }
}

export class Ending implements Panel {
  constructor(private readonly c: Ctx) {}

  key(vm: ViewModel): string | null {
    return vm.state.phase === 'won' && !vm.film && !vm.title ? `card|${vm.state.tick}` : null;
  }

  build(root: HTMLElement, vm: ViewModel): void {
    const s = vm.state;
    const veil = div(root, 'hg-b hgp-slab', -1200, -700, 2400, 1400);
    veil.style.background = '#05040a';
    veil.addEventListener('click', () => this.c.send({ kind: 'title' }));
    const t = new Words(root, -800, -150, 74, '#efe4ff', 'center', 1600);
    t.set(uiText('game.title'));
    new Words(root, -800, -60, 13, DIM, 'center', 1600).set(uiText('finale.tagline'));
    const best = Object.values(s.crystals).sort((a, b) => b.oneIn - a.oneIn)[0];
    const odds = best && best.oneIn > 1 ? uiText('finale.tally.odds', { n: best.oneIn }) : '';
    const rows: [string, string][] = [
      [uiText('finale.tally.nights'), String(Math.max(1, this.c.q.day(s.tick)))],
      [uiText('finale.tally.followers'), String(Object.values(s.people).filter((p) => p.follower && p.gone === null).length)],
      [uiText('finale.tally.best'), best ? uiText('finale.tally.bestWith', { name: best.name, grade: uiText(`grade.${best.grade}`), odds }) : uiText('finale.tally.none')],
    ];
    rows.forEach(([k, v], i) => {
      new Words(root, -816, -20 + i * 40, 20, 'rgb(170,160,190)', 'right', 800).set(k);
      new Words(root, 16, -22 + i * 40, 24, 'rgb(238,230,250)').set(v);
    });
    const hungry = new Words(root, -800, 160, 34, 'rgb(222,202,255)', 'center', 1600);
    hungry.el.style.fontStyle = 'italic';
    hungry.set(uiText('finale.hungry'));
    hungry.el.classList.add('hgp-in');
    const back = new Words(root, -800, 270, 18, VIOLET, 'center', 1600);
    back.set(uiText('finale.returnToTitle'));
    back.el.style.animation = 'hgp-fade 0.9s 1.2s both, hgp-pulse 2.4s 2.1s ease-in-out infinite alternate';
  }


  press(e: KeyboardEvent, vm: ViewModel): boolean {
    if (vm.film || !(bound(vm.settings, 'confirm', e) || bound(vm.settings, 'back', e))) return false;
    this.c.send({ kind: 'title' });
    return true;
  }
}
