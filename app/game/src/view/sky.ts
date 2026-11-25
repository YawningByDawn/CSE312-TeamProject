import type { ViewModel, Weather } from '../types';
import { TICK_HZ } from '../content/clock';
import { clamp01, hash, smooth } from './tables';

// The sky over the world (#74): each weather's look eased toward the day's weather over TAU s of game time, and the wet
// it leaves (the ground wets in about half a minute of rain under the front and dries over minutes, faster in wind; the
// lower workings flood and drain more slowly still). Rain comes as a front sweeping across the town along the wind, its
// back edge following when it stops. On the view's clock: the gusts and the lightning (a strike a STRIKE_S slot by its
// chance, flickering out over 0.9 s). The grade, the sheen and the weather layer read it.

interface Look { rain: number; drop: number; cloud: number; dark: number; fog: number; wind: number; cold: number; bolts: number }
const LOOK: Record<Weather, Look> = {
  clear: { rain: 0, drop: 0, cloud: 0.12, dark: 0, fog: 0, wind: 0.22, cold: 0, bolts: 0 },
  overcast: { rain: 0, drop: 0, cloud: 0.9, dark: 0.42, fog: 0.06, wind: 0.32, cold: 0.1, bolts: 0 },
  drizzle: { rain: 0.3, drop: 0.1, cloud: 0.85, dark: 0.36, fog: 0.16, wind: 0.28, cold: 0.15, bolts: 0 },
  rain: { rain: 0.68, drop: 0.6, cloud: 0.95, dark: 0.52, fog: 0.08, wind: 0.5, cold: 0.1, bolts: 0 },
  storm: { rain: 1, drop: 1, cloud: 1, dark: 0.78, fog: 0.05, wind: 0.95, cold: 0.1, bolts: 0.16 },
  fog: { rain: 0, drop: 0, cloud: 0.5, dark: 0.22, fog: 0.92, wind: 0.07, cold: 0.25, bolts: 0 },
  wind: { rain: 0, drop: 0, cloud: 0.45, dark: 0.1, fog: 0, wind: 1, cold: 0.1, bolts: 0 },
  cold: { rain: 0, drop: 0, cloud: 0.2, dark: 0.12, fog: 0.4, wind: 0.05, cold: 1, bolts: 0 },
};
const KEYS = Object.keys(LOOK.clear) as (keyof Look)[];
/** seconds the look takes to follow the weather (time constant) */
const TAU = 1.2;
/** time constants (s): wetting, drying (shorter in wind), flooding, draining, puddles growing and drying */
const WET_UP = 35, WET_DOWN = 260, FLOOD_UP = 110, FLOOD_DOWN = 620, POOL_UP = 50, POOL_DOWN = 380;
const ease = (v: number, to: number, dt: number, tau: number): number => v + (to - v) * (1 - Math.exp(-dt / tau));
/** the way the wind blows (town frame, the state's `wind` each step), and the town's middle and half width along it, which the front crosses */
export const WIND = { x: 1, y: 0 };
export const TOWN_C = { x: 3062, y: 1745 }, TOWN_HALF = 2900;
/** seconds the front takes to cross the town; its soft width (town widths) */
const SWEEP_S = 7, BAND = 0.22;
/** a strike may fall each STRIKE_S s, somewhere in STRIKES (town units) */
const STRIKE_S = 0.25, STRIKES = [6400, 3600] as const;

/** a lightning flash at age a s: three flickers in a quarter second, then a fast decay */
function flashEnv(a: number): number {
  if (a < 0 || a > 0.9) return 0;
  const pulse = (c: number, w: number, h: number) => h * Math.max(0, 1 - Math.abs(a - c) / w);
  const p = Math.max(pulse(0.02, 0.045, 1), pulse(0.11, 0.04, 0.55), pulse(0.2, 0.05, 0.85));
  return clamp01(Math.max(p, a > 0.2 ? 0.85 * Math.exp(-(a - 0.2) / 0.12) : 0));
}

export class Sky {
  readonly look: Look = { ...LOOK.clear };
  wetness = 0;
  /** how far the town's puddles have grown: after the wet, and while it rains on */
  puddles = 0;
  flood = 0;
  /** the front's leading and trailing edges along the wind (-0.4 short of the town upwind, 1.4 past it) */
  front = 1.4;
  back = -0.4;
  gust = 0;
  flash = 0;
  /** the last strike: where (town units) and when (the view's clock) */
  readonly strike = { x: 0, y: 0, t: -9, k: 0 };
  private raining = false;
  private tick = -1;
  private time = NaN;

  /** The rain's band at a town point: the look's rain under the front. */
  rainAt(x: number, y: number): number {
    if (this.look.rain < 0.01) return 0;
    const u = 0.5 + ((x - TOWN_C.x) * WIND.x + (y - TOWN_C.y) * WIND.y) / (2 * TOWN_HALF);
    return this.look.rain * smooth(this.front, this.front - BAND, u) * smooth(this.back - BAND, this.back, u);
  }

  /** The share of the town under the front. */
  cover(): number {
    return clamp01(Math.min(this.front, 1) - Math.max(this.back, 0));
  }

  /** How fast the mine drips (1 dry): the wet seeping down and the flood. */
  seep(): number {
    return 1 + 3 * Math.max(this.wetness * 0.6, this.flood);
  }

  /** Follow the state's weather by the ticks gone since the last call (a new run or a step back settles it at once). */
  step(vm: ViewModel): void {
    this.live(vm.time);
    WIND.x = Math.cos(vm.state.wind); WIND.y = Math.sin(vm.state.wind);
    const t = vm.state.tick, to = LOOK[vm.state.weather], L = this.look;
    if (t === this.tick) return;
    const dt = (t - this.tick) / TICK_HZ, settle = this.tick < 0 || dt < 0;
    this.tick = t;
    if (settle) {
      Object.assign(L, to);
      this.raining = L.rain > 0.05;
      this.front = 1.4;
      this.back = -0.4;
      this.wetness = clamp01(L.rain * 1.6);
      this.puddles = smooth(0.35, 0.9, this.wetness);
      this.flood = clamp01(L.rain * 0.72);
      return;
    }
    for (const k of KEYS) L[k] = ease(L[k], to[k], dt, TAU);
    // the front comes in from upwind when rain starts (from the back edge when it returns mid-clearance)
    const want = to.rain > 0.05;
    if (want !== this.raining) {
      if (want) this.front = this.back > 0 && this.back < 1.4 ? this.back : -0.4;
      this.back = -0.4;
      this.raining = want;
    }
    const here = L.rain * this.cover(), wet = clamp01(here * 1.6), flood = clamp01(here * 0.72);
    this.wetness = ease(this.wetness, wet, dt, wet > this.wetness ? WET_UP : WET_DOWN / (1 + L.wind * 0.8));
    this.flood = ease(this.flood, flood, dt, flood > this.flood ? FLOOD_UP : FLOOD_DOWN);
    const pools = smooth(0.35, 0.9, this.wetness) * (0.5 + 0.5 * clamp01(here * 2));
    this.puddles = ease(this.puddles, pools, dt, pools > this.puddles ? POOL_UP : POOL_DOWN);
  }

  /** The front's sweep, the gusts and the lightning on the view's clock. */
  private live(t: number): void {
    const dt = Number.isNaN(this.time) ? 0 : Math.max(0, t - this.time), L = this.look;
    if (dt === 0 && !Number.isNaN(this.time)) return;
    const from = Number.isNaN(this.time) ? Math.floor(t / STRIKE_S) : Math.floor(this.time / STRIKE_S) + 1;
    this.time = t;
    this.front = Math.min(1.4, this.front + dt / SWEEP_S);
    if (!this.raining) this.back = Math.min(1.4, this.back + dt / SWEEP_S);
    const i = Math.floor(t * 0.23), f = t * 0.23 - i, n = hash(i, 7, 9) + (hash(i + 1, 7, 9) - hash(i, 7, 9)) * f * f * (3 - 2 * f);
    this.gust = smooth(0.5, 0.92, n) * clamp01(L.wind * 1.4);
    // the slots since the last frame (a flash outlives four of them: none older can show)
    const to = Math.floor(t / STRIKE_S), S = this.strike;
    for (let s = Math.max(from, to - 4); s <= to; s++) {
      if (hash(s, 41, 7) < 1 - Math.exp(-L.bolts * STRIKE_S)) Object.assign(S, { x: STRIKES[0] * (0.1 + 0.8 * hash(s, 43, 7)), y: STRIKES[1] * (0.1 + 0.8 * hash(s, 44, 7)), t: s * STRIKE_S, k: 0.7 + 0.3 * hash(s, 42, 7) });
    }
    this.flash = flashEnv(t - S.t) * S.k;
  }
}
