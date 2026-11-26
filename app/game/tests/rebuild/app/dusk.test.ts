import { describe, expect, it } from 'vitest';
import { Dusk } from '../../../src/ui/panels/dusk';
import type { GameEvent, ViewModel } from '../../../src/types';

// The dusk card is the day's: the dawn that follows the night closes it, so it never sits under the dawn's pick.

const vm = (...kinds: string[]): ViewModel =>
  ({ title: false, time: 0, focus: null, menu: null, state: { phase: 'live' }, fresh: kinds.map((kind) => ({ kind, tick: 0, weekday: 'work' }) as GameEvent) }) as unknown as ViewModel;

describe('the dusk card', () => {
  it('opens at the dusk and is shut by the next dawn, however quick the night', () => {
    const card = new Dusk({} as never);
    expect(card.key(vm())).toBeNull();
    expect(card.key(vm('dusk'))).not.toBeNull();
    expect(card.key(vm())).not.toBeNull();
    expect(card.key(vm('dawn'))).toBeNull();
    expect(card.key(vm())).toBeNull();
  });

  it('gives way to a person, the grave or a menu opened over it, but not to settings', () => {
    const card = new Dusk({} as never);
    card.key(vm('dusk'));
    expect(card.key({ ...vm(), menu: 'settings' })).not.toBeNull();
    expect(card.key({ ...vm(), menu: 'people' })).toBeNull();
    card.key(vm('dusk'));
    expect(card.key({ ...vm(), focus: { unit: 'g01' } })).toBeNull();
  });
});
