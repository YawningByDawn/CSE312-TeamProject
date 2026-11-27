import type { Weather } from '../../types';
import { ID, LANTERN, outlineId, pack, type HoldIds } from './ids';
import { WEATHER, io, smooth } from './posture';

// A person's body this frame (#76-78): two baked steps of a loop (assets/poses) lerped, the blend
// from the last loop and a reaction over it, the weather's posture, the rig solved for the look's height and hunch, and
// the cut-out figure laid out as the baked parts it is made of (assets/people): each a part name, its variant bins and
// the transform from the part's frame into the figure's (rig units, feet at 0,0, facing +x). Allocates nothing a frame.

/** Pose channels (21) then the acting (fins, droop, flick, wick): one baked step. */
const HX = 0, HY = 1, LEAN = 2, NOD = 3, LOOK = 4, FNX = 5, FNY = 6, FFX = 7, FFY = 8, HNX = 9, HNY = 10, HFX = 11, HFY = 12;
const PROP = 13, ROT = 14, OX = 15, OY = 16, GRIP2 = 18, SQUASH = 19, ELB = 20, FIN = 21, DROOP = 22, FLICK = 23, WICK = 24;
export const STEP = 25;
/** what an upper-body reaction takes */
const UPPER = [NOD, LOOK, HNX, HNY, ELB, LEAN] as const;
/** joint offsets into the solved joints */
const HIP = 0, SHO = 2, NECK = 4, HEAD = 6, KNEE_N = 8, ANK_N = 10, TOE_N = 12, KNEE_F = 14, ANK_F = 16, TOE_F = 18;
const ELB_N = 20, HAND_N = 22, ELB_F = 24, HAND_F = 26;
// the rig's authored bones, and the wickfolk's body they are remapped onto (short legs, a big head)
const THIGH = 9.6, SHIN = 9.4, ANKLE = 1.3, TORSO = 11.4, NECK_L = 2, UPPER_ARM = 7.4, FOREARM = 7.0, SHOULDER_DX = 0.6;
const LEG_K = 10.3 / 19, UP_K = 13.3 / 11.4, ARM_K = 9.7 / 14.4, HEAD_R = 7.4;
const HIP_W = 8.6, SHOULDER_W = 8.2, FOLK_ANKLE = 0.8, FOLK_H = 40;
const PERSP = 0.2, TB = Math.PI / 16, PROP_STEPS = 48, TURN_3Q = 1.02;
const WICK_FRAMES = 6, WICK_FPS = 8, IMPACT_FRAMES = 8, IMPACT_DUR = 0.45, SMALL_WICK_PX = 28;
const BLEND = 0.32;
/** the rain's posture (0..1) past which a hooded look's hood is up */
const HOOD_WET = 0.45;
const GRIPPED = new Set(['pick', 'shovel', 'broom', 'stick', 'staff']);
/** the standing loops where the cold shows (arms hugged, stamping) and fog puts a lamp in the hand */
const CALM = new Set(['idle', 'watch', 'talk', 'ride', 'lookround', 'glance', 'ledger']);

export interface Series { dur: number; loop: boolean; gait: number; n: number; f: Float32Array; h: number[]; im?: number[] }
export interface Hold { near: string | null; far: string | null; back: string | null; cart: boolean; ground: string | null; gx: number; gy: number; twoHand: boolean }
/** a look's placement facts (people.json): its kit and its bones' rest lengths */
export interface Kit { back: boolean; long: boolean; waders: boolean; headBack: boolean; headKit: boolean; hoodup: boolean; closed: boolean; lift: number }
export interface Rest { thigh: number; shin: number; upper: number; fore: number; torso: number }
/** `rainHood`: the look's hood comes up in the rain; `outline`: its parts have outlines (an enemy's red line) */
export interface LookBody { hk: number; hunch: number; tilt: number; seed: number; kit: Kit; rest: Rest; rainHood: boolean; outline: boolean }


const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
const turnOfLook = (look: number): number => (look >= 0 ? look * TURN_3Q : TURN_3Q + -look * (Math.PI - TURN_3Q));
const angBin = (a: number): number => (((Math.round(a / ((2 * Math.PI) / PROP_STEPS)) % PROP_STEPS) + PROP_STEPS) % PROP_STEPS);

/** Step `s` of a series at `u` (seconds into a clip, or the stride's distance), lerped into `out`; the step's hold index. */
function sample(s: Series, u: number, wrap: boolean, out: Float32Array, o = 0): number {
  const n = s.n, loop = wrap || s.loop;
  const x = loop ? ((((u / s.dur) % 1) + 1) % 1) * n : Math.min(1, Math.max(0, u / s.dur)) * (n - 1);
  const i = Math.floor(x), k = x - i, a = (i % n) * STEP, b = ((i + 1) % n) * STEP;
  const f = s.f;
  if (!loop && i >= n - 1) for (let c = 0; c < STEP; c++) out[o + c] = f[a + c]!;
  else for (let c = 0; c < STEP; c++) out[o + c] = f[a + c]! + (f[b + c]! - f[a + c]!) * k;
  return s.h.length === 1 ? s.h[0]! : s.h[Math.min(n - 1, Math.round(x) % n)]!;
}

/** One person's body: what it plays, the blend from what it played, the reaction over it, the solved joints and the parts. */
export class Body {
  readonly pose = new Float32Array(STEP);
  private readonly snap = new Float32Array(STEP);
  private readonly over = new Float32Array(STEP);
  readonly j = new Float32Array(28);
  series: Series | null = null;
  name = '';
  start = 0;
  private blendAt = -99;
  react: Series | null = null;
  reactName = '';
  reactAt = 0;
  reactFull = false;
  /** the hold this frame (a copy: fog may put a lamp in the hand) */
  readonly hold: Hold = { near: null, far: null, back: null, cart: false, ground: null, gx: 0, gy: 0, twoHand: false };
  ids: HoldIds = { near: -1, far: -1, back: -1, ground: -1 };
  private readonly fogIds: HoldIds = { near: -1, far: -1, back: -1, ground: -1 };
  /** Lie low: the hood is up over the wick */
  hood = false;
  /** the rain has a hooded look's hood up */
  private wetHood = false;
  holdIx = -1;
  // the solved figure
  torsoA = 0; headA = 0; ahx = 0; impactAt = -99; impactX = 0; impactY = 0;
  /** the crown light, rig units from the feet (facing +x) */
  lampX = 0;
  lampY = 0;
  // the laid-out parts: name id, packed bins, alpha and the 2x3 transform, PART numbers each
  readonly parts = new Float64Array(128 * PART);
  n = 0;
  /** the render time the layout just made next differs on its own: the wick's frame, a blink, a burst, a flutter */
  wake = Infinity;
  private due(at: number): void { if (at < this.wake) this.wake = at; }

  /** Play loop `name` from time `t`: a change blends from the pose shown. */
  play(name: string, s: Series, t: number): void {
    if (this.name === name) return;
    if (this.series) { this.snap.set(this.pose); this.blendAt = t; }
    this.name = name;
    this.series = s;
    this.start = t;
  }

  /** No blend and no reaction in play at `t`: the pose is the loop's own. */
  steady(t: number): boolean {
    return t - this.blendAt >= BLEND && (!this.react || t - this.reactAt >= this.react.dur);
  }

  /** A reaction over the loop from `t`: whole-body, or the head and arms. */
  reactTo(name: string, s: Series, t: number, full: boolean): void {
    this.react = s;
    this.reactName = name;
    this.reactAt = t;
    this.reactFull = full;
  }

  /**
   * The pose at render time `t` (`u` the loop's own time or stride distance, `wrap` a one-shot clip played as a loop,
   * `facing` for the wind), with the weather's posture, solved for the look.
   */
  evaluate(t: number, u: number, wrap: boolean, holds: readonly Hold[], holdIds: readonly HoldIds[], look: LookBody, weather: Weather, facing: number, v: number): void {
    const p = this.pose, s = this.series!;
    const hi = sample(s, u, wrap, p);
    const bu = (t - this.blendAt) / BLEND;
    if (bu >= 0 && bu < 1) {
      const e = io(bu);
      for (let c = 0; c < STEP; c++) p[c] = lerp(this.snap[c]!, p[c]!, e);
    }
    const r = this.react;
    if (r) {
      const ot = t - this.reactAt;
      if (ot >= r.dur || ot < 0) this.react = null;
      else {
        const w = Math.min(1, ot / 0.25, (r.dur - ot) / 0.4), o = this.over;
        sample(r, ot, false, o);
        if (this.reactFull) for (let c = 0; c < STEP; c++) p[c] = lerp(p[c]!, o[c]!, io(w));
        else {
          const headOnly = this.reactName === 'glance' || this.reactName === 'lookround' ? 0 : 1;
          for (const c of UPPER) {
            const base = p[c]!, target = c === LEAN ? base + (o[c]! - 0.06) : o[c]!;
            p[c] = base + (target - base) * w * (c === HNX || c === HNY || c === ELB ? headOnly : 1);
          }
          for (let c = FIN; c < STEP; c++) p[c] = lerp(p[c]!, o[c]!, w);
        }
      }
    }
    if (hi !== this.holdIx) {
      this.holdIx = hi;
      Object.assign(this.hold, holds[hi]!);
      this.ids = holdIds[hi]!;
    }
    this.wetHood = look.rainHood && smooth(0.12, 0.45, WEATHER[weather][0]) > HOOD_WET;
    this.weather(t, look, weather, facing, v);
    this.solve(look);
    if (s.im) {
      // the pick's impact: the last strike of the loop, its burst at the pick head
      const ct = ((u % s.dur) + s.dur) % s.dur;
      let at = -99;
      for (const i of s.im) if (i <= ct) at = t - (ct - i);
      if (at > this.impactAt) {
        const pr = p[PROP]!;
        this.impactAt = at;
        this.impactX = this.j[HAND_N]! + (Math.cos(pr) * 13 + Math.cos(pr + 1.57) * 4.5) * UP_K;
        this.impactY = this.j[HAND_N + 1]! + (Math.sin(pr) * 13 + Math.sin(pr + 1.57) * 4.5) * UP_K;
      }
    }
  }

  /** Heads down in the rain, leaning into the wind, arms hugged and a stamp in the cold, a lamp held out in fog. */
  private weather(t: number, look: LookBody, w: Weather, facing: number, v: number): void {
    const W = WEATHER[w], wet = W[0], wind = W[1], cold = W[2], fog = W[3];
    const p = this.pose, gait = this.series!.gait > 0;
    if (wet + wind + cold + fog === 0 || p[ROT] !== 0) return;
    const calm = !gait && CALM.has(this.name);
    const d = smooth(0.12, 0.45, wet);
    p[LEAN] = p[LEAN]! + d * (gait ? 0.14 : 0.07);
    p[NOD] = p[NOD]! + d * 0.16;
    const wk = smooth(0.2, 0.8, wind);
    if (wk > 0) {
      const into = -facing, gust = 0.75 + 0.25 * Math.sin(t * 2.3 + v * 9) * Math.sin(t * 0.9 + v * 3);
      p[LEAN] = p[LEAN]! + wk * gust * (into > 0 ? 0.22 * into : 0.07 * into) * (gait ? 1 : 0.6);
      p[NOD] = p[NOD]! + wk * Math.max(0, into) * 0.12;
    }
    const c = smooth(0.25, 0.7, cold);
    if (c > 0 && (calm || gait)) {
      p[LEAN] = p[LEAN]! + c * 0.1;
      if (calm && p[GRIP2] === 0 && !this.hold.near) {
        const rub = Math.sin(t * 7 + v * 5) * 0.5;
        p[HNX] = lerp(p[HNX]!, 4 + rub, c); p[HNY] = lerp(p[HNY]!, -25, c);
        p[HFX] = lerp(p[HFX]!, 3.4 - rub, c); p[HFY] = lerp(p[HFY]!, -25.6, c);
        p[ELB] = lerp(p[ELB]!, 0.15, c);
        const sc = (t * 0.45 + v * 3) % 1;
        if (sc < 0.3) {
          const uu = sc / 0.3, ph = uu < 0.5 ? uu * 2 : (uu - 0.5) * 2, lift = Math.sin(Math.PI * ph) * 2.6 * c;
          if (uu < 0.5) p[FNY] = p[FNY]! - lift; else p[FFY] = p[FFY]! - lift;
        }
      } else if (gait) {
        p[HNX] = lerp(p[HNX]!, 3.2, c * 0.6); p[HNY] = lerp(p[HNY]!, -22, c * 0.6);
      }
    }
    const h = this.hold;
    if (smooth(0.35, 0.65, fog) > 0.5 && !h.near && !h.twoHand && !h.cart && (gait ? this.ids.near < 0 : calm)) {
      h.near = 'lantern';
      const f = this.fogIds, i = this.ids;
      f.far = i.far; f.back = i.back; f.ground = i.ground; f.near = LANTERN;
      this.ids = f;
      this.holdIx = -1;
      p[HNX] = gait ? 5 : 6.2; p[HNY] = gait ? -19.5 : -21; p[ELB] = 0.3;
    }
  }

  /** The joints from the pose: legs and arms two-bone chains, trunk and head from the hip, on the wickfolk's body. */
  private solve(look: LookBody): void {
    const p = this.pose, j = this.j, hk = look.hk, hunch = look.hunch * (this.series!.gait ? 0.6 : 1);
    const thigh = THIGH * hk * LEG_K, shin = SHIN * hk * LEG_K, torso = TORSO * hk * UP_K, ua = UPPER_ARM * hk * ARM_K, fa = FOREARM * hk * ARM_K;
    const ahx = p[HX]!, ahy = p[HY]! * hk, hx = ahx * LEG_K, hy = ahy * LEG_K;
    this.ahx = ahx;
    j[HIP] = hx; j[HIP + 1] = hy;
    const lean = p[LEAN]! + hunch;
    this.torsoA = lean;
    const sx = hx + Math.sin(lean) * torso + SHOULDER_DX, sy = hy - Math.cos(lean) * torso;
    j[SHO] = sx; j[SHO + 1] = sy;
    const asx = ahx + Math.sin(lean) * TORSO * hk + SHOULDER_DX, asy = ahy - Math.cos(lean) * TORSO * hk;
    const handX = (x: number): number => sx + (x - asx) * ARM_K, handY = (y: number): number => sy + (y - asy) * ARM_K;
    this.headA = lean * 0.6 + p[NOD]! + hunch * 0.8;
    const neckA = lean * 0.75 + hunch * 1.4 + p[NOD]! * 0.4, nk = NECK_L * 0.1;
    const nx = sx + Math.sin(neckA) * nk * hk * UP_K, ny = sy - Math.cos(neckA) * nk * hk * UP_K;
    j[NECK] = nx; j[NECK + 1] = ny;
    j[HEAD] = nx + Math.sin(neckA) * HEAD_R * 0.78 + 0.4; j[HEAD + 1] = ny - Math.cos(neckA) * HEAD_R * 0.78;
    ik(j, KNEE_N, hx + 0.5, hy, p[FNX]! * LEG_K, p[FNY]! * LEG_K - ANKLE, thigh, shin, 1, -0.15, 1.3);
    ik(j, KNEE_F, hx - 0.5, hy, p[FFX]! * LEG_K, p[FFY]! * LEG_K - ANKLE, thigh, shin, 1, -0.15, 1.3);
    for (let side = 0; side < 2; side++) {
      const a = side ? ANK_F : ANK_N, toe = side ? TOE_F : TOE_N, lift = -p[side ? FFY : FNY]!, tip = Math.min(0.6, lift * 0.12);
      j[toe] = j[a]! + Math.cos(tip) * 3.9;
      j[toe + 1] = j[a + 1]! + ANKLE - Math.sin(tip) * 3.2 * 0.6 - (lift > 0 ? 0.3 : 0);
    }
    const elb = p[ELB]!, bx = -1 + elb * 1.6, by = 0.6 - elb * 1.2;
    ik(j, ELB_N, sx + 0.3, sy + 0.4, handX(p[HNX]!), handY(p[HNY]!), ua, fa, bx, by);
    let hfx = handX(p[HFX]!), hfy = handY(p[HFY]!);
    const g2 = p[GRIP2]! * UP_K;
    if (g2 > 0) { hfx = j[HAND_N]! + Math.cos(p[PROP]!) * g2; hfy = j[HAND_N + 1]! + Math.sin(p[PROP]!) * g2; }
    ik(j, ELB_F, sx - 0.9, sy + 0.2, hfx, hfy, ua, fa, bx, by);
  }

  /**
   * The parts in draw order for the look, in its paint faded from `from` to `to` (`k` of the way; 0 the role's own, 1 a
   * follower's), at `devPx` device px per rig unit, at render time `t` with the person's variation `v`.
   */
  layout(look: LookBody, from: number, to: number, k: number, devPx: number, t: number, v: number): void {
    this.n = 0;
    this.wake = Infinity;
    L.self = this; L.from = from; L.to = to; L.k = k;
    const p = this.pose, j = this.j, h = this.hold, ids = this.ids, kit = look.kit, rest = look.rest, M = L.m0;
    const rot = p[ROT]!, squash = p[SQUASH]!, cr = Math.cos(rot), sr = Math.sin(rot), qx = 1 / Math.sqrt(squash);
    M[0] = cr * qx; M[1] = sr * qx; M[2] = -sr * squash; M[3] = cr * squash; M[4] = p[OX]! * UP_K; M[5] = p[OY]!;
    const look1 = p[LOOK]!, turn = turnOfLook(look1), c = Math.cos(turn), s = Math.abs(Math.sin(turn));
    const lh = HIP_W * 0.22, ah = SHOULDER_W * 0.42;
    const hipX = j[HIP]!, hipY = j[HIP + 1]!, shoX = j[SHO]!, shoY = j[SHO + 1]!;
    const grip2 = h.twoHand || (ids.near >= 0 && ids.far < 0 && Math.hypot(j[HAND_N]! - j[HAND_F]!, j[HAND_N + 1]! - j[HAND_F + 1]!) < 6);
    const th = Math.atan2(shoX - hipX, -(shoY - hipY)), torsoLen = Math.hypot(shoX - hipX, shoY - hipY);
    const away = look1 < -0.15, tb = Math.round(turn / TB);
    const hem = kit.long ? Math.round(Math.max(4, -hipY / Math.max(0.35, Math.cos(th)) - FOLK_ANKLE * 1.4)) : 0;
    if (kit.back && !away) { at(hipX, hipY, th); push(ID.bk, pack(tb, hem)); }
    if (ids.back >= 0) {
      at(shoX * 0.6 + hipX * 0.4 - Math.cos(this.torsoA) * 4.6, shoY * 0.6 + hipY * 0.4 - Math.sin(this.torsoA) * 4.6 - 1);
      paints(ids.back, pack());
    }
    if (ids.ground >= 0) { at(hipX + (h.gx - this.ahx) * UP_K, h.gy * UP_K); paints(ids.ground, pack(0)); }
    leg(j, KNEE_F, ANK_F, TOE_F, lh * c, -lh * s * PERSP, 0, kit, rest, turn + 0.2);
    if (ids.far >= 0 && !h.twoHand) { at(j[HAND_F]!, j[HAND_F + 1]!); paints(ids.far, pack(angBin(p[PROP]!))); }
    arm(j, ELB_F, HAND_F, ah * c, -ah * s * PERSP, grip2 ? 0 : 1, 0, ids.far >= 0 || grip2, shoX, shoY, rest);
    leg(j, KNEE_N, ANK_N, TOE_N, -lh * c, lh * s * PERSP, 1, kit, rest, turn - 0.2);
    at(hipX, hipY, th, 1, torsoLen / rest.torso);
    push(ID.tr, pack(away ? 1 : 0, tb, hem));
    // a follower's tell: a twist of violet cord at the throat
    const tell = to === 1 ? (from === to ? 1 : k) : from === 1 ? 1 - k : 0;
    if (tell > 0.05) { at(hipX, hipY, th, 1, torsoLen / rest.torso); push(ID.tell, pack(), Math.min(1, 0.35 + tell * 0.6)); }
    this.head(look, devPx, t, v);
    if (h.cart) { at(hipX - this.ahx * UP_K, 0, 0, UP_K * 0.86, UP_K * 0.8); paints(ID.ct, pack()); }
    const hx = j[HAND_N]!, hy = j[HAND_N + 1]!;
    if (ids.near >= 0) {
      if (h.twoHand) { at((hx + j[HAND_F]!) / 2, (hy + j[HAND_F + 1]!) / 2 + 1.5 * UP_K); paints(ids.near, pack(0)); }
      else { at(hx, hy); paints(ids.near, pack(angBin(p[PROP]!))); }
    }
    arm(j, ELB_N, HAND_N, -ah * c, ah * s * PERSP, 0, 1, ids.near >= 0, shoX, shoY, rest);
    if (ids.near >= 0 && !h.twoHand && GRIPPED.has(h.near!)) { at(hx, hy, p[PROP]!); paints(ID.gp, pack()); }
    const ia = t - this.impactAt;
    if (ia >= 0 && ia < IMPACT_DUR) {
      M[0] = 1; M[1] = 0; M[2] = 0; M[3] = 1; M[4] = 0; M[5] = 0;
      at(this.impactX, this.impactY);
      const fi = Math.min(IMPACT_FRAMES - 1, Math.floor((ia / IMPACT_DUR) * IMPACT_FRAMES));
      push(ID.im, pack(fi));
      this.due(t + ((fi + 1) / IMPACT_FRAMES) * IMPACT_DUR - ia);
    }
    if (look.outline) {
      // every part's outline first, under the parts: only the figure's rim shows
      const n = this.n, P = this.parts;
      P.copyWithin(n * PART, 0, n * PART);
      for (let i = 0; i < n; i++) P[i * PART] = outlineId(P[i * PART]!);
      this.n = 2 * n;
    }
  }

  private head(look: LookBody, devPx: number, t: number, v: number): void {
    const p = this.pose, j = this.j, kit = look.kit;
    const R = HEAD_R * (0.94 + 0.06 * look.hk);
    const look1 = p[LOOK]!, back = look1 < -0.15;
    const fl = p[FLICK]! > 0 ? p[FLICK]! * Math.max(0, Math.sin(t * 17 + v * 9)) * (Math.sin(t * 1.3 + v * 4) > 0.2 ? 1 : 0) : 0;
    const flick = fl > 0.35 * p[FLICK]! && p[FLICK]! > 0.05 ? p[FLICK]! : 0;
    const finIn = p[FIN]!, droop = p[DROOP]!, wick = p[WICK]!;
    const covered = this.hood || this.wetHood || kit.hoodup;
    // the acting the head shows: fin pose and amount, the wick's state, the eyes
    const fin = flick > 0.45 ? 4 : droop > 0.45 ? 3 : finIn < -0.3 ? 2 : finIn > 0.45 ? 1 : 0;
    const finK = fin === 2 ? Math.min(1, -finIn * 1.1) : fin === 1 ? Math.min(1, finIn * 1.1) : fin === 3 ? Math.min(1, droop) : 1;
    const st = wick <= 0.04 ? 4 : wick > 1.32 ? 3 : wick < 0.45 ? 1 : fin === 2 && wick < 0.7 ? 2 : 0;
    let eyes = wick < 0.45 ? 2 : fin === 2 ? 3 : fin === 3 ? 1 : 0;
    const tq = Math.round(turnOfLook(back ? -look1 : look1) / TB), fk = Math.round(finK * 4);
    const bp = (t + (look.seed % 97) * 0.053) % 4.3, blink = eyes === 0 && bp < 0.13;
    if (eyes === 0) this.due(t + (blink ? 0.13 : 4.3) - bp);
    if (p[FLICK]! > 0) this.due(t);
    if (blink) eyes = 2;
    const finB = covered ? 0 : fin, fkc = covered ? 0 : fk, cov = covered ? 1 : 0;
    const wickOn = !covered && !kit.closed, sp = Math.round(Math.max(0, Math.min(1, wick)) * 4);
    const ang = this.headA * 0.7 + look.tilt, xs = back ? -1 : 1, hx = j[HEAD]!, hy = j[HEAD + 1]!;
    if (!covered && kit.headBack) { at(hx, hy, ang, xs, 1); push(ID.hb, pack(tq)); }
    at(hx, hy, ang, xs, 1); push(ID.hu, pack(cov, finB, tq, fkc));
    if (wickOn && st !== 4) { at(hx, hy, ang, xs, 1); paints(ID.cr, pack(st, sp, tq)); }
    at(hx, hy, ang, xs, 1); push(ID.ho, pack(cov, finB, eyes, tq, fkc));
    if (!covered && kit.headKit) { at(hx, hy, ang, xs, 1); push(ID.hk, pack(tq)); }
    const ct = Math.sin(tq * TB), cpx = -0.12 * R * ct, cpy = -0.97 * R - kit.lift * R + R * 0.04;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    this.lampX = hx + xs * cpx * ca - cpy * sa;
    this.lampY = hy + xs * cpx * sa + cpy * ca;
    if (wickOn) {
      const big = devPx * R * (FOLK_H / HEAD_R) < SMALL_WICK_PX ? 1.3 : 1;
      const ph = t * WICK_FPS + (look.seed % 13), fr = Math.floor(ph) % WICK_FRAMES;
      this.due(t + (Math.floor(ph) + 1 - ph) / WICK_FPS);
      at(hx, hy, ang, xs, 1);
      const F = L.fr;
      F[4] = this.lampX; F[5] = this.lampY;
      for (let i = 0; i < 4; i++) F[i] = F[i]! * big;
      paints(ID.wk, pack(st, sp, fr));
    } else if (covered && wick > 0.05) { at(hx, hy, ang, xs, 1); paints(ID.gl, pack(), Math.min(1, wick)); }
  }
}

/** A small figure's box in rig units (feet at 0,0, facing +x): every part of every baked step lies inside it, the
 * lying loops' heads (sleep, collapse) at its ends, a rope held high on the ride at its top. */
export const BOX = { x0: -28, x1: 43, y0: -69, y1: 22 } as const;
/** The finest stamp px per rig unit (stamps.ts): where a figure stops being small (28 device px over 40 rig units) rounded up. */
export const R_MAX = 2 ** -0.5;
/** Stamp px per rig unit for a figure shown at `devPx` device px per rig unit: quarter octaves at or above it. */
export const bucket = (devPx: number): number => Math.min(R_MAX, Math.max(2 ** -4, 2 ** (Math.ceil(Math.log2(devPx) * 4) / 4)));

/** numbers a laid-out part takes: name id, packed bins, alpha, a, b, c, d, e, f */
export const PART = 9;

/** the layout's scratch: the body being laid out, its paints, the figure's matrix and the next part's frame */
const L = { self: null as unknown as Body, from: 0, to: 0, k: 1, m0: new Float64Array(6), fr: new Float64Array(6) };

function push(id: number, bins: number, alpha = 1): void {
  const b = L.self;
  if (b.n * PART >= b.parts.length) return;
  const M = L.m0, F = L.fr, o = b.n++ * PART, out = b.parts;
  out[o] = id; out[o + 1] = bins; out[o + 2] = alpha;
  out[o + 3] = M[0]! * F[0]! + M[2]! * F[1]!; out[o + 4] = M[1]! * F[0]! + M[3]! * F[1]!;
  out[o + 5] = M[0]! * F[2]! + M[2]! * F[3]!; out[o + 6] = M[1]! * F[2]! + M[3]! * F[3]!;
  out[o + 7] = M[0]! * F[4]! + M[2]! * F[5]! + M[4]!; out[o + 8] = M[1]! * F[4]! + M[3]! * F[5]! + M[5]!;
}
/** a part that differs by paint: in the paint faded from, and over it the paint faded to */
function paints(id: number, bins: number, alpha = 1): void {
  if (L.from !== L.to && L.k < 1) { push(id + L.from, bins, alpha); push(id + L.to, bins, alpha * L.k); }
  else push(id + L.to, bins, alpha);
}
/** the frame for the next parts: translate (x, y), rotate r, scale (sx, sy) */
function at(x: number, y: number, r = 0, sx = 1, sy = 1): void {
  const c = Math.cos(r), s = Math.sin(r), F = L.fr;
  F[0] = c * sx; F[1] = s * sx; F[2] = -s * sy; F[3] = c * sy; F[4] = x; F[5] = y;
}
/** a limb segment from a to b: its part runs along +x for the bone's rest length */
function seg(id: number, ax: number, ay: number, bx: number, by: number, l0: number): void {
  const dx = bx - ax, dy = by - ay;
  at(ax, ay, Math.atan2(dy, dx), Math.hypot(dx, dy) / l0, 1);
  push(id, pack());
}
function leg(j: Float32Array, knee: number, ank: number, toe: number, ox: number, oy: number, side: 0 | 1, kit: Kit, rest: Rest, footTurn: number): void {
  const n = ID.leg[side]!;
  const hx = j[HIP]! + ox, hy = j[HIP + 1]! + oy, kx = j[knee]! + ox, ky = j[knee + 1]! + oy, ax = j[ank]! + ox, ay = j[ank + 1]! + oy;
  seg(n.thi, hx, hy, kx, ky, rest.thigh);
  seg(n.shi, kx, ky, ax, ay, rest.shin);
  seg(n.shc, kx, ky, ax, ay, rest.shin);
  seg(n.thc, hx, hy, kx, ky, rest.thigh);
  if (!kit.waders) { at(kx, ky, Math.atan2(ay - ky, ax - kx)); push(n.bd, pack()); }
  at(ax - 0.9, Math.max(ay + 1.0, j[toe + 1]! + oy));
  push(n.ft, pack(Math.round(footTurn / TB)));
}
function arm(j: Float32Array, elb: number, hand: number, ox: number, oy: number, handOff: number, side: 0 | 1, grip: boolean, shoX: number, shoY: number, rest: Rest): void {
  const n = ID.arm[side]!;
  const sx = shoX + ox, sy = shoY + oy + 0.6, ex = j[elb]! + ox, ey = j[elb + 1]! + oy;
  const hx = j[hand]! + ox * handOff, hy = j[hand + 1]! + oy * handOff;
  seg(n.uai, sx, sy, ex, ey, rest.upper);
  seg(n.fai, ex, ey, hx, hy, rest.fore);
  seg(n.fac, ex, ey, hx, hy, rest.fore);
  seg(n.uac, sx, sy, ex, ey, rest.upper);
  at(hx, hy, Math.atan2(hy - ey, hx - ex));
  push(n.hd[grip ? 1 : 0]!, pack());
}

/** Two-bone IK from (ax, ay) to (tx, ty): the middle joint at `o`, the end at `o + 2`, bending toward (bendX, bendY). */
function ik(out: Float32Array, o: number, ax: number, ay: number, tx: number, ty: number, l1: number, l2: number, bendX: number, bendY: number, stretch = 1): void {
  let dx = tx - ax, dy = ty - ay, d = Math.hypot(dx, dy);
  if (stretch > 1 && d > (l1 + l2) * 0.999) { const k = Math.min(stretch, d / ((l1 + l2) * 0.999)); l1 *= k; l2 *= k; }
  const maxD = (l1 + l2) * 0.999, minD = Math.abs(l1 - l2) + 0.01;
  if (d > maxD) { dx *= maxD / d; dy *= maxD / d; d = maxD; }
  if (d < minD) { const k = minD / Math.max(d, 1e-4); dx *= k; dy *= k; d = minD; }
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a)), ux = dx / d, uy = dy / d;
  let nx = -uy, ny = ux;
  if (nx * bendX + ny * bendY < 0) { nx = -nx; ny = -ny; }
  out[o] = ax + ux * a + nx * h;
  out[o + 1] = ay + uy * a + ny * h;
  out[o + 2] = ax + dx;
  out[o + 3] = ay + dy;
}
