import type { CrystalId, FactionId, GameState, ViewModel } from '../../types';
import { uiText } from '../../content/text';
import { bound } from '../../content/keys';
import { BLOOD, DIM, PALE, VIOLET, Words, line, slab, stone, surface, verb } from './art';
import type { Ctx, Panel } from './index';

// Dusk (inventory #122, 47): each stone brought to the grave revealed in turn, the rarer the longer it is held, then the
// day's ledger with what the day's notes said happened. The clock stands under them (the night is the player's turn); the confirm key hurries the reveal and moves on, back closes.

const TIER: Record<string, number> = { dull: 0, clear: 1, bright: 2, blazing: 3, royal: 4, impossible: 5 };
const loud = (oneIn: number): number => (oneIn >= 10000 ? 3 : oneIn >= 1000 ? 2 : oneIn >= 100 ? 1 : 0);
const FACTIONS: readonly FactionId[] = ['temple', 'council', 'public'];
const LEDGER_S = 15;
/** The day's notes the card lists, each given three lines. */
const NOTES = 5, NOTE_H = 64;
/** After the last stone shows, the reveal is held this long to read it (more with a best find among several), then moves on. */
const READ_S = 1.4, BEST_S = 1.0;
/** The boxes' bottom edge: 64 design px above the screen's (the centre is 450 above it). */
const BOTTOM = 450 - 64;

/** A stone's way to the grave: offered by yours, brought unasked (tribute), the grave's seep. */
type Way = 'offer' | 'tribute' | 'seep';
interface Brought { id: CrystalId; from: string | null; way: Way }
const WORDS: Record<Way, string> = { offer: 'dusk.from', tribute: 'dusk.unaskedBy', seep: 'dusk.seep' };

export class Dusk implements Panel {
  /** The day's stones so far: offered by yours, or brought unasked (tribute). */
  private brought: Brought[] = [];
  /** The day's own notes, the latest NOTES of them: what the world did between dawn and dusk. */
  private notes: string[] = [];
  private stage: 'reveal' | 'ledger' | null = null;
  private start = 0;
  private fast = false;
  /** Seconds into the reveal at which each stone shows, and when it is all shown. */
  private at: number[] = [];
  private done = 0;
  /** Seconds into the reveal at which it moves on to the ledger by itself. */
  private leave = 0;
  private niches: HTMLElement[] = [];
  private cont: HTMLElement | null = null;
  private held = false;
  constructor(private readonly c: Ctx) {}

  key(vm: ViewModel): string | null {
    for (const e of vm.fresh) {
      if (e.note && e.kind !== 'weather' && !(e.kind === 'story' && (e.story === 'life' || e.story === 'day'))) this.notes = [...this.notes.slice(1 - NOTES), uiText(e.note.key, e.note.slots)];
      if (e.kind === 'dawn') { this.brought = []; this.notes = []; this.stage = null; }
      else if (e.kind === 'offer' || e.kind === 'tribute' || e.kind === 'seep') this.brought.push({ id: e.crystal, from: e.unit ?? null, way: e.kind });
      else if (e.kind === 'dusk') {
        this.stage = 'reveal';
        this.start = vm.time;
        this.fast = false;
      }
    }
    // a person, the grave or a menu (not settings) opened over the card closes it
    if (vm.title || vm.state.phase !== 'live' || vm.focus || (vm.menu && vm.menu !== 'settings')) this.stage = null;
    return this.stage ? `${this.stage}|${this.start}|${this.fast}` : null;
  }

  private next(vm: ViewModel): void {
    if (this.stage === 'reveal') {
      this.stage = 'ledger';
      this.start = vm.time;
    } else this.stage = null;
    this.c.redraw();
  }

  build(root: HTMLElement, vm: ViewModel): void {
    if (this.stage === 'ledger') this.ledger(root, vm.state, vm);
    else this.reveal(root, vm);
  }

  private reveal(root: HTMLElement, vm: ViewModel): void {
    const s = vm.state;
    const shown = this.brought.filter((b) => s.crystals[b.id]);
    const cols = Math.min(10, Math.max(3, shown.length));
    const w = Math.max(460, 48 + cols * 80), h = 262;
    const { el, say } = slab(root, -w / 2, BOTTOM - h, w, h, uiText('dusk.offering'));
    new Words(el, w - 228, 30, 19, DIM, 'right', 200).set(uiText('dusk.count', { n: shown.length }));
    // each stone's beats: set, then revealed and held, rarer longer; the whole fits about 5.6 s
    const base = shown.map((b) => 260 + TIER[s.crystals[b.id]!.grade]! * 150 + loud(s.crystals[b.id]!.oneIn) * 260);
    const k = Math.min(1, 5600 / base.reduce((a, x) => a + 500 + x, 1)) * (this.fast ? 0.25 : 1);
    let t = 0;
    this.at = base.map((x, i) => {
      t += (180 + TIER[s.crystals[shown[i]!.id]!.grade]! * 40) * k;
      const at = t / 1000;
      t += (320 + x) * k;
      return at;
    });
    this.done = t / 1000;
    this.leave = this.done + (this.fast ? 0.1 : READ_S + (shown.length > 1 ? BEST_S : 0));
    const x0 = (w - shown.length * 80) / 2 + 7;
    this.niches = shown.map((b, i) => {
      const c = s.crystals[b.id]!;
      const n = surface(el, 'parchDark', x0 + i * 80, 84, 66, 120);
      if (b.from) new Words(n, 0, -18, 13, b.way === 'tribute' ? DIM : VIOLET, 'center', 66).set(s.people[b.from]?.name ?? '');
      const pic = surface(n, 'violetDim', 0, 0, 66, 120);
      pic.style.opacity = '0';
      pic.style.transition = 'opacity 0.3s';
      stone(pic, c, 33, 84, 56);
      new Words(pic, 0, 96, 14, PALE, 'center', 66).set(uiText(`grade.${c.grade}`));
      pic.title = uiText(WORDS[b.way], { name: c.name, from: b.from ? s.people[b.from]?.name ?? '' : '' });
      return pic;
    });
    if (shown.length === 0) {
      new Words(el, 28, 96, 22, PALE).set(uiText('dusk.nothing'));
      new Words(el, 28, 132, 17, DIM).set(uiText('dusk.offerHint'));
    }
    verb(el, w - 290, h - 64, 124, 44, uiText('btn.faster'), '', () => { this.fast = true; this.c.redraw(); }, say);
    this.cont = verb(el, w - 152, h - 64, 124, 44, uiText('btn.proceed'), '', () => this.next(vm), say);
    this.cont.hidden = shown.length > 0;
    el.addEventListener('click', () => { if (!this.fast) { this.fast = true; this.c.redraw(); } });
  }

  private ledger(root: HTMLElement, s: Readonly<GameState>, vm: ViewModel): void {
    const l = s.ledger;
    const rows: [string, string, string][] = [
      [uiText('ledger.grave'), `+${l.crystals}`, VIOLET],
      [uiText('ledger.nether'), `+${Math.round(l.nether)}`, VIOLET],
      [uiText('ledger.turned'), String(l.turned), VIOLET],
      [uiText('ledger.lost'), String(l.lost), l.lost ? BLOOD : DIM],
      ...FACTIONS.filter((f) => l.suspicion[f] !== 0).map((f): [string, string, string] => [uiText('ledger.heat', { power: uiText(`power.${f}`) }), `${l.suspicion[f] > 0 ? '+' : ''}${l.suspicion[f]}`, '#9fb8d8']),
    ];
    const top = 80 + rows.length * 32;
    const h = top + (this.notes.length ? 36 + this.notes.length * NOTE_H : 0) + 76;
    const { el, say } = slab(root, -260, BOTTOM - h, 520, h, uiText('ledger.title', { n: this.c.q.day(s.tick) }));
    rows.forEach(([k, v, color], i) => {
      new Words(el, 36, 82 + i * 32, 20, PALE).set(k);
      new Words(el, 384, 80 + i * 32, 22, color, 'right', 100).set(v);
    });
    if (this.notes.length) new Words(el, 36, top + 8, 17, DIM).set(uiText('ledger.happened'));
    this.notes.forEach((n, i) => line(el, 36, top + 38 + i * NOTE_H, 448, 16, PALE, n));
    el.addEventListener('mouseenter', () => { this.held = true; });
    el.addEventListener('mouseleave', () => { this.held = false; this.start = vm.time; });
    verb(el, 520 - 152, h - 64, 124, 44, uiText('btn.proceed'), '', () => this.next(vm), say);
  }

  tick(vm: ViewModel): void {
    const t = vm.time - this.start;
    if (this.stage === 'ledger') {
      if (!this.held && t > LEDGER_S) this.next(vm);
      return;
    }
    this.niches.forEach((n, i) => {
      const on = t >= this.at[i]!;
      if ((n.style.opacity === '1') !== on) n.style.opacity = on ? '1' : '0';
    });
    if (this.cont && this.cont.hidden && t >= this.done) this.cont.hidden = false;
    if (t >= this.leave) this.next(vm);
  }

  press(e: KeyboardEvent, vm: ViewModel): boolean {
    if (bound(vm.settings, 'back', e)) {
      this.stage = null;
      this.c.redraw();
    } else if (bound(vm.settings, 'confirm', e)) {
      if (this.stage === 'reveal' && vm.time - this.start < this.done) {
        this.fast = true;
        this.c.redraw();
      } else this.next(vm);
    } else return false;
    return true;
  }
}
