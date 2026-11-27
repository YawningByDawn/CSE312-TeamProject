import type { Activity, ViewModel } from '../../types';
import { BONE, GOLD, HOVER, PALE, PICK_TICK, RING_ASPECT, VIOLET, type Shown } from './looks';

/** What a figure is placed from: where it stands (world units), what it does (`dx, dy` its heading, or its swing's aim; `dist` the stride's distance, `swing` the seconds into a swing, -1 at rest) and what it is (`chosen`: the host the god is in). */
export interface Spot {
  x: number; y: number; facing: number; doing: Activity; walking: boolean; dist: number; dx: number; dy: number; swing: number;
  gone: boolean; lieLow: boolean; follower: boolean; devotion: number; chosen: boolean; mob: boolean;
  /** days the host's mark on them has left (0: none): that many diamonds over the head */
  marked: number;
  /** the god whose light they carry (a shared mine's player), 0 for the player's own violet */
  paint: number;
}

/**
 * Under the feet: the wick's light pooled (violet for yours, brighter with devotion; gold the Flame's; pale the
 * Council's), the rings of the picked (pulsing, four ticks outward, PICK_TICK screen px long) and the hovered. The host
 * the god is in is picked out as the player's own pick is; a skeleton has no light of its own. True while any of it
 * pulses with the render time (the picked, the host's diamonds).
 */
export function marks(sh: Shown, p: Spot, vm: ViewModel, scale: number, x: number, y: number, px: number): boolean {
  const picked = p.chosen || (!!vm.focus && 'unit' in vm.focus && vm.focus.unit === sh.id);
  const hover = !picked && !!vm.hover && 'unit' in vm.hover && vm.hover.unit === sh.id;
  const pool = sh.pool, ring = sh.ring, beam = sh.beam, s = scale, pulse = picked ? 0.85 + 0.15 * Math.sin(vm.time * 3.2) : 1;
  pool.visible = !p.gone && !p.mob;
  const yours = p.follower || p.chosen, own = p.paint || VIOLET;
  pool.tint = yours ? own : sh.look.d.tally ? PALE : GOLD;
  pool.alpha = p.chosen ? 0.85 : p.follower ? 0.3 + 0.5 * Math.min(1, p.devotion / 100) : 0.18;
  const pr = ((yours ? 16 : 11) * s) / 32;
  pool.scale.set(pr, pr * 0.35);
  pool.position.set(x, y);
  ring.visible = picked || hover || p.follower;
  if (ring.visible) {
    ring.tint = picked ? BONE : hover ? HOVER : own;
    ring.alpha = picked ? 0.95 * pulse : hover ? 0.7 : 0.45;
    ring.scale.set((13 * s) / 48);
    ring.position.set(x, y);
  }
  const rx = 13 * s * 1.08, ry = rx * RING_ASPECT, len = PICK_TICK / px, w = 2 / px;
  sh.ticks.forEach((tk, i) => {
    tk.visible = picked;
    if (!picked) return;
    tk.tint = BONE;
    tk.alpha = 0.9 * pulse;
    tk.rotation = (i * Math.PI) / 2;
    tk.position.set(x + (i === 0 ? rx : i === 2 ? -rx : 0), y + (i === 1 ? ry : i === 3 ? -ry : 0));
    tk.setSize(i % 2 ? len * 0.5 : len, w);
  });
  // the host's mark on them: a violet diamond over the head for each day it has left
  sh.pips.forEach((pip, i) => {
    pip.visible = !p.gone && i < p.marked;
    if (!pip.visible) return;
    pip.tint = VIOLET;
    pip.alpha = 0.8 + 0.2 * Math.sin(vm.time * 2.4 + i * 1.3);
    pip.scale.set((12 * s) / pip.texture.frame.width);
    pip.position.set(x + (i - (p.marked - 1) / 2) * 14 * s, y - 52 * s);
  });
  beam.visible = picked || hover;
  if (beam.visible) {
    beam.tint = picked ? BONE : HOVER;
    beam.alpha = picked ? 0.22 : 0.12;
    beam.scale.set((24 * s) / 320, (46 * s) / 1000);
    beam.position.set(x, y);
  }
  return picked || p.marked > 0;
}
