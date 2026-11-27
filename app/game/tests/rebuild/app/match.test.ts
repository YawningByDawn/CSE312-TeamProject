import { describe, expect, it } from 'vitest';
import { MatchFeed } from '../../../src/app/match';
import type { MatchBody, MatchSetup, MatchWorld, Net, ViewModel } from '../../../src/types';

// The shared mine as the view model shows it: a match begins and ends with the hub's word, and each frame shows the
// players between the hub's last two ticks by the render time since the newer came, one tick behind and no further.

const setup: MatchSetup = { players: [{ name: 'ann', seat: 0 }, { name: 'bea', seat: 1 }], seats: [{ shrine: [532, 684], zones: ['westdrift', 'cartway', 'grave'] }, { shrine: [1996, 684], zones: ['sorting', 'heartvein', 'eastworks'] }], goal: 20, rate: 20 };
const body = (name: string, x: number, more: Partial<MatchBody> = {}): MatchBody => ({ name, x, y: 684, dx: 0, dy: 0, face: 1, walked: x, moving: false, carry: 0, swing: -1, ax: 0, ay: 0, stun: 0, ...more });
const world = (seq: number, ann: MatchBody, bea: MatchBody): MatchWorld => ({ seq, players: [ann, bea], crystals: [[1, 900, 700]], score: [3, 0], winner: -1 });

function feed(): { net: Net; vm: ViewModel; f: MatchFeed } {
  const net = { match: null, world: null, was: null } as unknown as Net;
  const vm = { time: 0, match: null } as unknown as ViewModel;
  return { net, vm, f: new MatchFeed(net, () => 'ann') };
}

describe('the match feed', () => {
  it('begins with the hub\'s match and its first tick, and ends when the hub ends it', () => {
    const { net, vm, f } = feed();
    expect(f.frame(vm)).toBe(null);
    net.match = setup;
    expect(f.frame(vm)).toBe(null); // no tick yet
    net.world = world(1, body('ann', 532), body('bea', 1996));
    expect(f.frame(vm)).toBe('began');
    expect(vm.match!.open.has('grave') && !vm.match!.open.has('bunks')).toBe(true);
    expect(vm.match!.shown.map((p) => [p.name, p.seat, p.me])).toEqual([['ann', 0, true], ['bea', 1, false]]);
    expect(f.frame(vm)).toBe(null);
    net.match = net.world = null;
    expect(f.frame(vm)).toBe('ended');
    expect(vm.match).toBe(null);
  });

  it('shows each player between the last two ticks by the time since the newer came', () => {
    const { net, vm, f } = feed();
    net.match = setup;
    net.was = world(1, body('ann', 532), body('bea', 1996));
    net.world = world(2, body('ann', 541, { moving: true }), body('bea', 1996));
    f.frame(vm);
    expect(vm.match!.shown[0]!.x).toBe(532);
    vm.time = 0.5 / setup.rate;
    f.frame(vm);
    expect(vm.match!.shown[0]!.x).toBeCloseTo(536.5);
    vm.time = 5;
    f.frame(vm);
    expect(vm.match!.shown[0]!.x).toBe(541); // never past the newest tick
    expect(vm.match!.score).toEqual([3, 0]);
  });

  it('shows a swing between its ticks, and one just begun from its start', () => {
    const { net, vm, f } = feed();
    net.match = setup;
    net.was = world(1, body('ann', 532, { swing: 0.1 }), body('bea', 1996));
    net.world = world(2, body('ann', 532, { swing: 0.15 }), body('bea', 1996, { swing: 0.05 }));
    f.frame(vm);
    vm.time = 0.5 / setup.rate;
    f.frame(vm);
    expect(vm.match!.shown[0]!.swing).toBeCloseTo(0.125);
    expect(vm.match!.shown[1]!.swing).toBeCloseTo(0.025);
  });
});
