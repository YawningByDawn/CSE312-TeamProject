import { describe, expect, it } from 'vitest';
import { KEYS } from '../../../src/content/keys';
import { Input } from '../../../src/app/input';
import type { Pump } from '../../../src/app/pump';
import type { View, ViewModel } from '../../../src/types';

// `__hg.camera` moves the camera and the goal it eases to together, so a shot holds the zoom and place it set.

describe('input', () => {
  it('a jump holds: the camera stays where it was set while frames ease', () => {
    const on = { addEventListener() {} };
    globalThis.window = on as unknown as Window & typeof globalThis;
    const vm = { camera: { x: 0, y: 0, zoom: 1 }, film: null, title: false } as unknown as ViewModel;
    const input = new Input({ vm } as Pump, { scale: (z: number) => 64 / 2 ** z } as View, on as unknown as HTMLCanvasElement);
    input.resize(800, 600);
    input.jump({ x: 120, zoom: 2.5 });
    for (let i = 0; i < 60; i++) input.update(1 / 60);
    expect(vm.camera).toEqual({ x: 120, y: 0, zoom: 2.5 });
  });

  it('Space held through a film skips it after a second of the frame clock', () => {
    const keys: Record<string, (e: unknown) => void> = {};
    const on = { addEventListener: (k: string, f: (e: unknown) => void) => void (keys[k] = f) };
    globalThis.window = on as unknown as Window & typeof globalThis;
    const sent: unknown[] = [];
    const vm = { camera: { x: 0, y: 0, zoom: 1 }, film: { kind: 'opening', t: 0 }, title: false, settings: { keys: KEYS } } as unknown as ViewModel;
    const input = new Input({ vm, send: (i: unknown) => sent.push(i) } as unknown as Pump, { scale: () => 1 } as unknown as View, on as unknown as HTMLCanvasElement);
    keys.keydown!({ key: ' ', repeat: false, target: {}, preventDefault() {} });
    for (let i = 0; i < 3; i++) input.update(0.25);
    expect(sent).toEqual([]);
    input.update(0.25);
    expect(sent).toEqual([{ kind: 'skipFilm' }]);
  });
});
