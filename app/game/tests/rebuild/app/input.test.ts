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
    const vm = { camera: { x: 0, y: 0, zoom: 1 }, film: null, title: false, hostAt: { on: false } } as unknown as ViewModel;
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
    const vm = { camera: { x: 0, y: 0, zoom: 1 }, film: { kind: 'opening', t: 0 }, title: false, hostAt: { on: false }, settings: { keys: KEYS } } as unknown as ViewModel;
    const input = new Input({ vm, send: (i: unknown) => sent.push(i) } as unknown as Pump, { scale: () => 1 } as unknown as View, on as unknown as HTMLCanvasElement);
    keys.keydown!({ key: ' ', repeat: false, target: {}, preventDefault() {} });
    for (let i = 0; i < 3; i++) input.update(0.25);
    expect(sent).toEqual([]);
    input.update(0.25);
    expect(sent).toEqual([{ kind: 'skipFilm' }]);
  });

  it('with a host the move keys are its heading, sent when the sim\'s differs, and the camera goes in on it and follows', () => {
    const keys: Record<string, (e: unknown) => void> = {};
    const on = { addEventListener: (k: string, f: (e: unknown) => void) => void (keys[k] = f) };
    globalThis.window = on as unknown as Window & typeof globalThis;
    const acts: unknown[] = [];
    const vm = {
      camera: { x: 0, y: 0, zoom: 1 }, film: null, title: false, settings: { keys: KEYS }, hostAt: { on: true, x: 1200, y: 700 },
      state: { host: 'g01', body: { dx: 0, dy: 0 } },
    } as unknown as ViewModel;
    const act = (a: { dx: number; dy: number }): void => void (acts.push(a), Object.assign(vm.state.body!, { dx: a.dx, dy: a.dy }));
    const input = new Input({ vm, act } as unknown as Pump, { scale: (z: number) => 64 / 2 ** z } as View, on as unknown as HTMLCanvasElement);
    input.resize(800, 600);
    keys.keydown!({ key: 'd', repeat: false, target: {}, preventDefault() {} });
    keys.keydown!({ key: 'w', repeat: false, target: {}, preventDefault() {} });
    expect(acts).toEqual([{ type: 'walk', dx: 1, dy: 0 }, { type: 'walk', dx: 1, dy: -1 }]);
    for (let i = 0; i < 300; i++) input.update(1 / 60);
    expect(acts).toHaveLength(2); // nothing is sent but on a change
    expect(vm.camera.zoom).toBeLessThan(0.2);
    const [x, y] = [vm.camera.x, vm.camera.y];
    keys.keyup!({ key: 'd', target: {} });
    input.update(1 / 60);
    expect(acts[2]).toEqual({ type: 'walk', dx: 0, dy: -1 });
    expect([vm.camera.x, vm.camera.y]).toEqual([x, y]); // held keys do not pan a followed camera
  });
});
