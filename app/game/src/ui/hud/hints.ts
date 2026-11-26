import type { GameEvent, GameState, Intent, ViewModel } from '../../types';
import { BALANCE } from '../../content/balance';
import { uiText } from '../../content/text';
import { line } from '../panels/art';
import { DIM, INK, Words, div, surface } from '../kit';
import type { Anchors, Corner } from '../index';
import { GOD_W, GOD_Y } from './god';
import { GOAL_Y } from './goal';

// Hints (inventory #106): each teaches one thing and sits by it, one at a time, while hints are on in Settings. It goes
// when the player does the thing, after a while, or on a click; a hint gone does not come back, in this run or the
// next, until hints are turned on again in Settings. The first three
// days teach the loop: whisper, the actions refilling, a follower's offering, the hand, the goal; Hunger when it bites.

const W = 300, H = 116;
/** Seconds a hint stands at most. */
const LIFE = 14;

interface Hint {
  id: string;
  /** Where it sits: a corner and its top left there, clear of the parts at rest. */
  at: [Corner, number, number];
  when(s: Readonly<GameState>, day: number): boolean;
  /** Done by the player: it goes and is not shown again. */
  done(s: Readonly<GameState>, e: GameEvent): boolean;
}

const followers = (s: Readonly<GameState>): number => Object.values(s.people).filter((p) => p.follower).length;

const HINTS: readonly Hint[] = [
  { id: 'whisper', at: ['c', -W / 2, -390], when: (s, d) => d <= 3 && followers(s) === 0, done: (_, e) => e.kind === 'whisper' || e.kind === 'turned' },
  { id: 'offer', at: ['c', -W / 2, -390], when: (s, d) => d <= 3 && followers(s) > 0, done: (_, e) => e.kind === 'routine' && e.routine === 'offer' },
  { id: 'hand', at: ['bc', -W / 2, -248 - H], when: (s, d) => d <= 3 && s.god.hand.length > 0 && !s.god.deal, done: (_, e) => e.kind === 'play' },
  { id: 'goal', at: ['tr', -GOD_W - 16 - W, GOAL_Y], when: (_, d) => d >= 2 && d <= 3, done: () => false },
  { id: 'hunger', at: ['tr', -GOD_W - 16 - W, GOD_Y], when: (s) => s.god.hunger >= BALANCE.starvingAt, done: (_, e) => e.kind === 'eat' },
];

export class Hints {
  /** The hints taught: the settings' (kept across runs; turning hints on again clears them), and those gone since. */
  private gone = new Set<string>();
  private seen: readonly string[] | null = null;
  private cur: Hint | null = null;
  private until = 0;
  private box: HTMLDivElement | null = null;
  private open = false;

  constructor(private readonly at: Anchors, private readonly day: (tick: number) => number, private readonly send: (i: Intent) => void) {}

  private taught(id: string): void {
    if (this.gone.has(id)) return;
    this.gone.add(id);
    this.send({ kind: 'settings', patch: { seenHints: [...this.gone] } });
  }

  frame(vm: ViewModel): void {
    const s = vm.state;
    if (vm.settings.seenHints !== this.seen) this.gone = new Set((this.seen = vm.settings.seenHints));
    const open = vm.settings.hints && s.phase === 'live' && !s.god.deal && !vm.menu;
    // the rules are read only when the state moved, the hint's time ran out, or it may show or hide
    if (vm.fresh.length === 0 && open === this.open && (!this.cur || vm.time < this.until)) return;
    this.open = open;
    for (const e of vm.fresh) for (const h of HINTS) if (h.done(s, e)) this.taught(h.id);
    const d = this.day(s.tick);
    let next = this.cur;
    if (next && (this.gone.has(next.id) || vm.time >= this.until || !next.when(s, d))) {
      this.taught(next.id);
      next = null;
    }
    if (!open) next = null;
    else next ??= HINTS.find((h) => !this.gone.has(h.id) && h.when(s, d)) ?? null;
    if (next === this.cur) return;
    if (next) this.until = vm.time + LIFE;
    this.cur = next;
    this.box?.remove();
    this.box = null;
    if (!next) return;
    const [corner, x, y] = next.at;
    const b = (this.box = div(this.at[corner], 'hg-b hg-hit hgp-in', x, y, W, H));
    surface(b, 'parch', 0, 0, W, H);
    new Words(b, 18, 12, 21, INK).set(uiText(`hint.${next.id}.title`));
    line(b, 18, 40, W - 36, 16, INK, uiText(`hint.${next.id}.body`));
    new Words(b, 0, H - 22, 13, DIM, 'right', W - 14).set(uiText('hint.close'));
    b.addEventListener('click', () => {
      this.taught(next.id);
      this.until = 0;
    });
  }
}
