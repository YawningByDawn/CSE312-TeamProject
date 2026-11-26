import { beforeEach, describe, expect, it } from 'vitest';
import { Pump, type Tracks } from '../../../src/app/pump';
import { PLAY_TPS } from '../../../src/content/clock';
import type { GameEvent, GameState, Sim } from '../../../src/types';

// The pump's contract: real seconds become ticks at a fixed rate, but only up to the state's `until` (the night's
// actions and the day move it); the title, a film, a pending choice and any phase but live hold the clock; a dawn
// replaces the one save, and Continue resumes it to the same run.

const DAY = 1200;
/** Ticks `seconds` of frames make, within the carry's one tick. */
const near = (tick: number, seconds: number): void => void expect(Math.abs(tick - seconds * PLAY_TPS)).toBeLessThanOrEqual(1);

/** A sim whose rules are a counter: deterministic from seed and tick, a dawn every DAY ticks. */
const sim: Sim = {
  create: (seed) => ({ v: 3, seed, tick: 0, until: 10 * DAY, phase: 'live', pending: null, rng: { s: seed } }) as unknown as GameState,
  step(s) {
    s.tick++;
    s.rng.s = (s.rng.s * 1103515245 + 12345) >>> 0;
    return s.tick % DAY === 0 ? [{ kind: 'dawn', tick: s.tick, weekday: 'work' } as GameEvent] : [];
  },
  act: () => ({ ok: true, why: [], events: [] }),
  legal: () => [],
};

function tracks(): Tracks {
  const none = () => {};
  return {
    sim,
    query: { day: (t: number) => Math.floor(t / DAY) + 1 } as Tracks['query'],
    view: { frame: none, filmLength: () => 2, filmPose: (f, _from, out) => void (out.x = f.t), load: async () => {}, pick: () => null, where: () => false, scale: () => 1, resize: none },
    ui: { mount: none, frame: none },
    audio: { load: async () => {}, frame: none, settings: none },
  };
}

/** Frames of 0.1 s. */
function frames(p: Pump, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * 10); i++) p.frame(0.1);
}

beforeEach(() => {
  const m = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  } as Storage;
});

describe('pump', () => {
  it('turns real seconds into ticks at PLAY_TPS and holds on the title and a film, never on a menu', () => {
    const p = new Pump(tracks(), 7, 1);
    frames(p, 1);
    expect(p.vm.state.tick).toBe(0); // the title
    p.begin(sim.create(7));
    frames(p, 3);
    near(p.vm.state.tick, 3);
    p.send({ kind: 'menu', menu: 'settings' });
    frames(p, 2);
    near(p.vm.state.tick, 5);
    p.send({ kind: 'newRun', seed: 7 }); // the opening film: 2 s
    frames(p, 1.5);
    expect(p.vm.film?.kind).toBe('opening');
    expect(p.vm.state.tick).toBe(0);
    frames(p, 1.5);
    expect(p.vm.film).toBeNull();
    expect(p.vm.state.tick).toBeGreaterThan(0);
  });

  it('hands the interface the real seconds of each frame, and render time is their sum', () => {
    const p = new Pump(tracks(), 7, 1);
    p.begin(sim.create(7));
    p.frame(0.25);
    expect(p.vm.dt).toBe(0.25);
    p.frame(0.5);
    expect(p.vm.dt).toBe(0.5);
    expect(p.vm.time).toBe(0.75);
  });

  it('ends a film, played or skipped, with the camera on its last pose', () => {
    const p = new Pump(tracks(), 7, 1);
    p.send({ kind: 'newRun', seed: 7 });
    frames(p, 3);
    expect(p.vm.camera.x).toBe(2);
    p.send({ kind: 'newRun', seed: 7 });
    p.vm.camera.x = 0;
    frames(p, 0.5);
    p.send({ kind: 'skipFilm' });
    expect(p.vm.film).toBeNull();
    expect(p.vm.camera.x).toBe(2);
  });

  it('holds while a choice is pending', () => {
    const p = new Pump(tracks(), 7, 1);
    const s = sim.create(7);
    s.pending = { kind: 'blessing', offers: [] };
    p.begin(s);
    frames(p, 2);
    expect(p.vm.state.tick).toBe(0);
  });

  it('saves at dawn, and Continue resumes the same run', () => {
    const a = new Pump(tracks(), 7, 1);
    a.begin(sim.create(7));
    a.ticks(DAY + 300);
    expect(a.vm.saved).toBe(2);
    const b = new Pump(tracks(), 99, 1);
    expect(b.vm.saved).toBe(2);
    b.send({ kind: 'continue' });
    expect(b.vm.title).toBe(false);
    expect(b.vm.state.tick).toBe(DAY);
    b.ticks(300);
    expect(b.vm.state).toEqual(a.vm.state);
  });

  it('no time passes by itself: the clock stands at `until` until an action or the day moves it on', () => {
    const p = new Pump(tracks(), 7, 1);
    const s = sim.create(7);
    s.until = 100;
    p.begin(s);
    frames(p, 10);
    expect(p.vm.state.tick).toBe(100);
    expect(p.running()).toBe(false);
    s.until = 160;
    frames(p, 10);
    expect(p.vm.state.tick).toBe(160);
  });

  it('Main menu leaves the run for the title with its save kept', () => {
    const p = new Pump(tracks(), 7, 1);
    p.begin(sim.create(7));
    p.ticks(DAY + 300);
    const at = p.vm.state;
    p.send({ kind: 'title' });
    expect(p.vm.title).toBe(true);
    expect(p.vm.saved).toBe(2);
    p.send({ kind: 'continue' });
    expect(p.vm.state.tick).toBe(DAY);
    expect(p.vm.state.seed).toBe(at.seed);
  });

  it('a later dawn replaces the save', () => {
    const p = new Pump(tracks(), 7, 1);
    p.begin(sim.create(7));
    p.ticks(3 * DAY);
    const q = new Pump(tracks(), 7, 1);
    q.send({ kind: 'continue' });
    expect(q.vm.state.tick).toBe(3 * DAY);
  });
});
