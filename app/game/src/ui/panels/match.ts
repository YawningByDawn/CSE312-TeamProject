import type { Bind, ViewModel } from '../../types';
import { GOD_COLOURS, css } from '../../content/arena';
import { keyName } from '../../content/keys';
import { uiText } from '../../content/text';
import { DIM, PALE, VIOLET, Words, attr, div, slab, surface } from './art';
import { plate } from './lobby';
import type { Ctx, Panel } from './index';

// A match of the shared mine (multiplayer, DECISIONS §133), over the world while it plays: top left the gods' board,
// one row a seat (its colour, who serves it or that they are gone, the god's name, the crystals they carry and the
// score against the goal); each player's name over their head in their god's colour; at the window's bottom how to play
// and Leave (out of the match and the lobby); and once a god is given the goal, who won, centred. Design px from the
// screen's centre, the board and the foot pinned to the window's edges (`Ctx.half`).

const BOARD = { w: 340, top: 76, row: 54 };
const MOVE_KEYS: readonly Bind[] = ['up', 'left', 'down', 'right'];

export class Match implements Panel {
  private rows: { score: Words; carry: Words }[] = [];
  private readonly labels = new Map<string, Words>();
  private board: HTMLElement | null = null;
  private foot: HTMLElement | null = null;
  private leave: HTMLElement | null = null;
  private readonly at = { x: NaN, y: NaN };
  private readonly out = { x: 0, y: 0 };
  constructor(private readonly c: Ctx) {}

  key(vm: ViewModel): string | null {
    const m = vm.match;
    return m && `match|${m.setup.players.map((p) => p.name).join()}|${m.shown.map((p) => p.name).join()}|${m.winner}`;
  }

  build(root: HTMLElement, vm: ViewModel): void {
    const m = vm.match!, seats = m.setup.seats;
    this.board = div(root, 'hg-b');
    const { el } = slab(this.board, 0, 0, BOARD.w, BOARD.top + seats.length * BOARD.row + 12, uiText('match.title'));
    this.rows = seats.map((_, i) => {
      const r = surface(el, 'parchDark', 20, BOARD.top + i * BOARD.row, BOARD.w - 40, BOARD.row - 6), colour = css(GOD_COLOURS[i]!);
      const dot = div(r, 'hg-b', 12, 16, 14, 14);
      dot.style.cssText += `border-radius:50%;background:${colour};box-shadow:0 0 8px ${colour}`;
      const player = m.setup.players.find((p) => p.seat === i);
      const here = !!player && m.shown.some((p) => p.name === player.name);
      new Words(r, 36, 3, 20, here ? PALE : DIM).set(!here ? uiText('match.gone') : player.name === m.me ? uiText('match.you', { name: player.name }) : player.name);
      new Words(r, 36, 27, 15, colour).set(uiText(`match.god.${i}`));
      const carry = new Words(r, BOARD.w - 40 - 150, 13, 18, VIOLET, 'right', 60).num();
      attr(carry.el, 'title', uiText('match.carryTip'));
      return { carry, score: new Words(r, BOARD.w - 40 - 88, 11, 22, PALE, 'right', 76).num() };
    });
    this.foot = div(root, 'hg-b');
    const keys = MOVE_KEYS.map((b) => keyName(vm.settings.keys[b][0] ?? '')).join('');
    new Words(this.foot, -600, 0, 18, DIM, 'center', 1200).set(uiText('match.help', { keys, goal: m.setup.goal }));
    this.leave = div(root, 'hg-b');
    plate(this.leave, 0, uiText('match.leave'), () => this.c.multi?.back());
    if (m.winner >= 0) {
      const by = m.setup.players.find((p) => p.seat === m.winner)?.name ?? '', banner = div(root, 'hg-b', 0, -170);
      new Words(banner, -450, 0, 52, css(GOD_COLOURS[m.winner]!), 'center', 900).set(uiText('match.won', { god: uiText(`match.god.${m.winner}`) }));
      new Words(banner, -450, 70, 22, PALE, 'center', 900).set(by === m.me ? uiText('match.wonYou') : uiText('match.wonBy', { name: by }));
    }
    const heads = div(root, 'hg-b');
    this.labels.clear();
    for (const p of m.shown) this.labels.set(p.name, new Words(heads, -120, 0, 17, css(GOD_COLOURS[p.seat]!), 'center', 240));
    this.at.x = this.at.y = NaN;
    this.tick(vm);
  }

  tick(vm: ViewModel): void {
    const m = vm.match;
    if (!m) return;
    this.place();
    this.rows.forEach((r, i) => {
      const p = m.shown.find((s) => s.seat === i);
      r.score.set(uiText('match.score', { n: m.score[i] ?? 0, goal: m.setup.goal }));
      r.carry.set(p && p.carry > 0 ? uiText('match.carry', { n: p.carry }) : '');
    });
    for (const p of m.shown) {
      const w = this.labels.get(p.name);
      if (!w) continue;
      const on = this.c.where({ unit: `mp:${p.name}` }, this.out);
      w.el.hidden = !on;
      if (!on) continue;
      w.set(p.name);
      w.el.style.transform = `translate(${this.out.x.toFixed(1)}px, ${(this.out.y - 46).toFixed(1)}px)`;
    }
  }

  /** The board top left, the help line and Leave at the bottom, at their offsets from the window's own edges. */
  private place(): void {
    const { x, y } = this.c.half();
    if (x === this.at.x && y === this.at.y) return;
    this.at.x = x;
    this.at.y = y;
    const to = (el: HTMLElement | null, left: number, top: number): void => { if (el) Object.assign(el.style, { left: `${left}px`, top: `${top}px` }); };
    to(this.board, 24 - x, 24 - y);
    to(this.foot, 0, y - 44);
    to(this.leave, x - 110, y - 92);
  }
}
