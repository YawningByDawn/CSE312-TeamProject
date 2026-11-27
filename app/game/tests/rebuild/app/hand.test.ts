import { beforeEach, describe, expect, it } from 'vitest';
import { Pump, type Tracks } from '../../../src/app/pump';
import { isDay } from '../../../src/content/clock';
import { makeSim } from '../../../src/sim';
import { handIdle } from '../../../src/ui/hud/cards';
import type { Intent } from '../../../src/types';

// The hand's one rule: a card is the god's at night. By day the sim refuses every card, so the hand rests and says so
// (`handIdle`); at night a discard and a play sent as the hand sends them (an `act` intent through the pump) take effect.

const { sim, query } = makeSim();
const none = () => {};

beforeEach(() => {
  const m = new Map<string, string>();
  globalThis.localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) } as Storage;
});

const act = (pump: Pump, action: Extract<Intent, { kind: 'act' }>['action']): void => pump.send({ kind: 'act', action });

/** Tick on until `done`, answering what stops the clock. */
function until(pump: Pump, done: () => boolean): void {
  const s = pump.vm.state;
  while (!done()) {
    expect(s.phase).toBe('live');
    if (s.pending?.kind === 'story') act(pump, { type: 'story', option: 1 });
    else if (s.pending?.kind === 'blessing') act(pump, { type: 'pickBlessing', blessing: s.pending.offers[0]! });
    else pump.ticks(1);
  }
}

/** A real run, the day played to the first dusk and its deal passed. */
function atDusk(): Pump {
  const t = { sim, query, view: { frame: none, filmLength: () => 1, filmPose: none, scale: () => 1 }, ui: { frame: none }, audio: { frame: none, settings: none } } as unknown as Tracks;
  const pump = new Pump(t, 7, 1);
  const s = pump.vm.state;
  pump.begin(s);
  until(pump, () => s.god.deal !== null);
  act(pump, { type: 'take', card: null });
  return pump;
}

describe('the hand', () => {
  it('rests by day, naming why, and a card sent by day stays', () => {
    const pump = atDusk();
    const s = pump.vm.state;
    act(pump, { type: 'sleep' });
    until(pump, () => isDay(s.tick));
    s.god.hand.push('soothingMurmur');
    expect(handIdle(query, s)).toBe('Act at dusk');
    const held = s.god.hand.slice();
    act(pump, { type: 'discard', card: held[0]! });
    expect(s.god.hand).toEqual(held);
  });

  it('is the god\'s at night: a discard and a play dragged out of it happen', () => {
    const pump = atDusk();
    const s = pump.vm.state;
    expect(isDay(s.tick)).toBe(false);
    expect(handIdle(query, s)).toBeNull();
    const kept = s.god.hand[0]!;
    act(pump, { type: 'discard', card: kept });
    expect(s.god.hand).not.toContain(kept);
    s.god.hand.push('soothingMurmur');
    const pay = Object.keys(s.crystals).filter((id) => 'pouch' in s.crystals[id]!.at);
    const played = s.god.played;
    act(pump, { type: 'play', card: 'soothingMurmur', pay });
    expect(s.god.hand).not.toContain('soothingMurmur');
    expect(s.god.played).toBe(played + 1);
    expect(pay.every((id) => !s.crystals[id])).toBe(true);
  });
});
