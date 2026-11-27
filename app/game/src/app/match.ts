import type { MatchBody, MatchShown, MatchView, Net, ViewModel } from '../types';

// The shared mine as the view model shows it (DECISIONS §133). The hub runs the match and sends it every tick
// (`Net.world`, and the tick before as `Net.was`); each frame shows every player `k` of the way from the one to the
// other, `k` counted in render time from the frame the newer one came: one tick behind the hub, smooth between its
// steps. The crystals and the score are the newer tick's. `vm.match` is made when a match begins and kept for its life;
// its players are written in place each frame.

export class MatchFeed {
  private seq = -1;
  /** render time the newest tick came */
  private came = 0;
  private readonly byName = new Map<string, MatchShown>();

  constructor(private readonly net: Net, private readonly me: () => string | null) {}

  /** vm.match for this frame: 'began' the frame a match begins, 'ended' the frame it ends. */
  frame(vm: ViewModel): 'began' | 'ended' | null {
    const { match: setup, world, was } = this.net;
    if (!setup || !world) {
      if (!vm.match) return null;
      vm.match = null;
      this.byName.clear();
      return 'ended';
    }
    let began: 'began' | null = null;
    if (!vm.match || vm.match.setup !== setup) {
      vm.match = { setup, me: this.me() ?? '', open: new Set(setup.seats.flatMap((s) => s.zones)), shown: [], crystals: [], score: [], winner: -1 };
      this.byName.clear();
      this.seq = -1;
      began = 'began';
    }
    if (world.seq !== this.seq) {
      this.seq = world.seq;
      this.came = vm.time;
    }
    const m: MatchView = vm.match, k = Math.min(1, (vm.time - this.came) * setup.rate), dt = 1 / setup.rate;
    m.shown.length = 0;
    for (const b of world.players) {
      const a = was?.players.find((p) => p.name === b.name) ?? b;
      let s = this.byName.get(b.name);
      if (!s) {
        s = { ...b, seat: setup.players.find((p) => p.name === b.name)?.seat ?? 0, me: b.name === m.me };
        this.byName.set(b.name, s);
      }
      Object.assign(s, b);
      s.x = a.x + (b.x - a.x) * k;
      s.y = a.y + (b.y - a.y) * k;
      s.walked = a.walked + (b.walked - a.walked) * k;
      s.moving = b.moving || (a.moving && k < 1);
      s.swing = swing(a, b, k, dt);
      m.shown.push(s);
    }
    m.crystals = world.crystals;
    m.score = world.score;
    m.winner = world.winner;
    return began;
  }
}

/** Seconds into the swing as shown: between the two ticks' when both swing, else from the one that does. */
function swing(a: MatchBody, b: MatchBody, k: number, dt: number): number {
  if (b.swing >= 0) return a.swing >= 0 && a.swing <= b.swing ? a.swing + (b.swing - a.swing) * k : b.swing * k;
  return a.swing >= 0 ? a.swing + k * dt : -1;
}
