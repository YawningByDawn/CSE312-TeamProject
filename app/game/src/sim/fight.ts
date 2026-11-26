/**
 * The fight (OVERHAUL, ov-combat; content's COMBAT): the host's pick swing on a click, and the skeletons that now and then
 * come out of the dark past the lit ground and hunt the host over the same ground. A blow lands at its second of the swing
 * (the baked clip's), the host's on what stands within reach in front of the aim, a skeleton's on the host if still within its
 * reach; damage is Strength's for the host, the day's for a skeleton, whose Hit Points are the day's too. A slain skeleton may
 * leave Nether. The host's HP are lost through `hurt` (host.ts: the fall).
 */
import { COMBAT } from '../content/combat';
import { DAY_TICK_S, dayOf } from '../content/clock';
import { WALK, areaAt } from '../content/mine';
import { act } from './colour';
import { addNether, ev, type Ctx } from './core';
import { mobDamage, mobHp, swingDamage } from './formulas';
import { hurt } from './host';
import { rand } from './rng';
import { clear, walk } from './walk';
import type { Body, Mob, Person } from '../types';

const K = COMBAT.skeleton, H = COMBAT.host;
const alive = (m: Readonly<Mob>): boolean => m.down < 0;

/** The swing key: the swing begins along (dx, dy) (the host's facing when it has no length), and ends any mining. */
export function swing(b: Body, dx: number, dy: number): void {
  const len = Math.hypot(dx, dy);
  [b.ax, b.ay] = len > 0 ? [dx / len, dy / len] : [b.face, 0];
  if (b.ax !== 0) b.face = b.ax > 0 ? 1 : -1;
  [b.swing, b.ore, b.work] = [0, null, 0];
}

/** One tick of the fight while a host stands: their swing, the skeletons' moves and blows, a new one now and then. */
export function fightTick(c: Ctx, host: Person, b: Body): void {
  hostSwing(c, host, b);
  const mobs = c.s.mobs;
  for (const m of mobs) mobTick(c, host, b, m);
  let n = 0;
  for (const m of mobs) if (m.down < COMBAT.corpse && m.stuck < COMBAT.spawn.lost && Math.hypot(m.x - b.x, m.y - b.y) <= COMBAT.spawn.leash) mobs[n++] = m;
  mobs.length = n;
  arrive(c, b);
}

function hostSwing(c: Ctx, host: Person, b: Body): void {
  if (b.swing < 0) return;
  const was = b.swing;
  b.swing += DAY_TICK_S;
  if (was < H.blow && b.swing >= H.blow) {
    const dmg = swingDamage(host.stats.strength);
    for (const m of c.s.mobs) if (alive(m) && inFront(b, m)) strike(c, m, dmg);
  }
  if (b.swing >= H.swing) b.swing = -1;
}

/** `m` stands within the host's reach and the half-arc of their aim (a body at their feet always). */
function inFront(b: Readonly<Body>, m: Readonly<Mob>): boolean {
  const ox = m.x - b.x, oy = m.y - b.y, d = Math.hypot(ox, oy);
  return d <= H.reach + K.radius && (d <= K.radius || (ox * b.ax + oy * b.ay) / d >= Math.cos(H.halfArc));
}

function strike(c: Ctx, m: Mob, dmg: number): void {
  m.hp = Math.max(0, m.hp - dmg);
  ev(c, { kind: 'hit', unit: m.id, amount: dmg });
  if (m.hp > 0) return;
  m.down = 0;
  const drop = rand(c.s.rng) < K.dropChance ? K.drop : 0;
  if (drop > 0) addNether(c, drop, 'slain');
  ev(c, { kind: 'slain', unit: m.id, nether: drop });
  const at = areaAt(m.x, m.y);
  if (at) act(c, at);
}

function mobTick(c: Ctx, host: Person, b: Body, m: Mob): void {
  [m.lx, m.ly] = [m.x, m.y];
  if (!alive(m)) {
    m.down += DAY_TICK_S;
    return;
  }
  const ox = b.x - m.x, oy = b.y - m.y, d = Math.hypot(ox, oy);
  if (d > 0) [m.dx, m.dy] = [ox / d, oy / d];
  if (ox !== 0) m.face = ox > 0 ? 1 : -1;
  if (m.swing < 0) {
    if (d > K.reach) {
      const [x, y] = [m.x, m.y];
      walk(m, K.speed, DAY_TICK_S);
      m.stuck = Math.hypot(m.x - x, m.y - y) < 0.25 * K.speed * DAY_TICK_S ? m.stuck + DAY_TICK_S : 0;
    } else m.swing = 0;
    return;
  }
  const was = m.swing;
  m.swing += DAY_TICK_S;
  if (was < K.blow && m.swing >= K.blow && d <= K.reach + WALK.bodyR && host.stats.hp > 0) {
    const dmg = mobDamage(dayOf(c.s.tick));
    hurt(c, host, dmg);
    ev(c, { kind: 'hit', unit: host.id, amount: dmg });
  }
  if (m.swing >= K.swing) m.swing = -1;
}

/** Now and then one comes out of the dark (it may come where rock hides the host: it is then lost, `stuck`): on clear ground between `near` and `far` of the host, while fewer than `max` stand. */
function arrive(c: Ctx, b: Body): void {
  const s = c.s, A = COMBAT.spawn;
  if (s.mobs.filter(alive).length >= A.max || rand(s.rng) >= A.chance) return;
  for (let i = 0; i < A.tries; i++) {
    const a = rand(s.rng) * 2 * Math.PI, r = A.near + rand(s.rng) * (A.far - A.near);
    const x = b.x + Math.cos(a) * r, y = b.y + Math.sin(a) * r;
    if (!clear(x, y)) continue;
    s.mobs.push({ id: `m${s.next++}`, x, y, lx: x, ly: y, face: x > b.x ? -1 : 1, dx: 0, dy: 0, walked: 0, hp: mobHp(dayOf(s.tick)), swing: -1, down: -1, stuck: 0 });
    return;
  }
}
