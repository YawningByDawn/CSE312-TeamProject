import { describe, expect, it } from 'vitest';
import { SOUNDS } from '../../../src/content/sounds';
import { MANIFEST, cueName } from '../../../src/audio';
import type { GameEvent } from '../../../src/types';

// Every event kind has a cue (the table's type requires the key), and every sound a cue or a film beat names is baked.

describe('sound cues', () => {
  it('every named sfx and stinger is in the manifest', () => {
    const named: string[] = [];
    for (const cue of Object.values(SOUNDS.cues)) {
      if (typeof cue === 'string') named.push(cue);
      else if (cue) named.push(...Object.values(cue.names));
    }
    for (const beats of Object.values(SOUNDS.films)) for (const b of beats) if (b.sfx) named.push(b.sfx);
    expect(named.filter((n) => !MANIFEST.sfx[n])).toEqual([]);
    const stingers = Object.values(SOUNDS.films).flat().flatMap((b) => (b.stinger ? [b.stinger] : []));
    expect(stingers.filter((n) => !MANIFEST.stingers[n])).toEqual([]);
  });

  it('a cue picks by a field of the event, else of its crystal', () => {
    const whisper = { kind: 'whisper', tick: 0, ok: false, odds: 0.5 } as GameEvent;
    expect(cueName(SOUNDS.cues.whisper, whisper)).toBe('convertFail');
    const strike = { kind: 'strike', tick: 0, crystal: 'c1', oneIn: 900 } as GameEvent;
    expect(cueName(SOUNDS.cues.strike, strike, { grade: 'royal' } as never)).toBe('crystalRare');
    expect(cueName(SOUNDS.cues.hunger, { kind: 'hunger', tick: 0, delta: 1 } as GameEvent)).toBeNull();
  });

  it('a number picks by its move: an Ichor gained is no Ichor lost, a place lost no place gained', () => {
    expect(cueName(SOUNDS.cues.ichor, { kind: 'ichor', tick: 0, delta: 0.5 } as GameEvent)).toBe('gorge');
    expect(cueName(SOUNDS.cues.ichor, { kind: 'ichor', tick: 0, delta: -1 } as GameEvent)).toBe('ichorLoss');
    expect(cueName(SOUNDS.cues.hold, { kind: 'hold', tick: 0, hold: 30, was: 60 } as GameEvent)).toBe('holdLoss');
    expect(cueName(SOUNDS.cues.suspicion, { kind: 'suspicion', tick: 0, faction: 'temple', level: 1, was: 2 } as GameEvent)).toBeNull();
  });
});
