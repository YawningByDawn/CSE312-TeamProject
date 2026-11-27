import type { MatchShown, UnitId, ViewModel } from '../../types';
import { GOD_COLOURS } from '../../content/arena';
import { MINE_FRAME } from '../../content/map';
import { frameOf } from '../camera';
import { mx, my } from './looks';
import type { People } from './people';

// The shared mine's players in the people layer (multiplayer, DECISIONS §133): while a match plays they are the only
// figures, each a miner of the digger looks (one picked by their name) placed every frame where the match shows them
// (they move between the hub's ticks): walking by the distance walked, swinging by the seconds into a swing, startled by a
// blow. Each stands in their god's light (the pool and ring a follower has, in the god's colour) and is washed in it;
// this player's own is picked out as the host is.

/** each player's stun as last placed: a new one startles them */
const stunned = new Map<UnitId, boolean>();

/** A god's colour as a figure's wash: halfway to white, so the ink still reads. */
const pale = (c: number): number => ((((c >> 16) + 255) >> 1) << 16) | (((((c >> 8) & 255) + 255) >> 1) << 8) | (((c & 255) + 255) >> 1);

/** The match's frame of the people layer: its players placed, everyone else hidden; the run's people are placed afresh
 * once it ends (its end moves the state as the layers see it). */
export function placeMatch(pp: People, vm: ViewModel): boolean {
  const at = pp.at, v = pp.view, pad = 40;
  frameOf(vm.camera, pp.screen.w, pp.screen.h, at);
  const a = at.a;
  v.x0 = -at.e / a - pad; v.y0 = -at.f / a - pad; v.x1 = (pp.screen.w - at.e) / a + pad; v.y1 = (pp.screen.h - at.f) / a + pad;
  const stamp = ++pp.last.stamp;
  for (const p of vm.match!.shown) place(pp, p, vm, a, stamp);
  for (const sh of pp.shown.values()) if (sh.stamp !== stamp) pp.hide(sh);
  pp.on.length = 0;
  pp.count = 0;
  pp.stamps.flush();
  return true;
}

function place(pp: People, p: MatchShown, vm: ViewModel, a: number, stamp: number): void {
  const id = `mp:${p.name}`, sh = pp.shown.get(id) ?? pp.make(id, 'digger', true), S = pp.spot;
  if (!sh.look.lo) return void pp.hide(sh);
  const swinging = p.swing >= 0 && p.stun <= 0;
  S.x = mx(p.x); S.y = my(p.y); S.facing = p.face;
  S.walking = p.moving && !swinging && p.stun <= 0;
  S.doing = S.walking ? 'walk' : 'idle';
  S.dist = p.walked / MINE_FRAME.per;
  [S.dx, S.dy, S.swing] = swinging ? [p.ax, p.ay, p.swing] : [p.dx, p.dy, -1];
  S.gone = false; S.lieLow = false; S.follower = true; S.devotion = 100; S.chosen = p.me; S.mob = false; S.marked = 0;
  S.paint = GOD_COLOURS[p.seat] ?? 0;
  const hit = p.stun > 0, ix = pp.roles[sh.role]!.startle;
  if (hit && !stunned.get(id) && ix !== undefined) sh.body.reactTo('startle', pp.series[ix]!, vm.time, true);
  stunned.set(id, hit);
  sh.root.tint = pale(S.paint);
  pp.show(sh, S, vm, a, stamp);
}
