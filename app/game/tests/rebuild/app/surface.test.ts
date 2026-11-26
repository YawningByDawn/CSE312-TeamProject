import { describe, expect, it } from 'vitest';
import { nearest } from '../../../src/ui/kit';
import manifest from '../../../assets/ui/manifest.json';

// A slab is painted at its size (its grit, its shadow band, its hatching), so a panel's slab is never stretched far: the
// baked slab nearest each box the interface lays out is within 1.7x of it on both sides.

const sizes = manifest.sizes as unknown as Record<string, [number, number]>;
// the HUD's plates, the three menus, the grave (its slab, its item sheet), the choice and person panels, a note's strip
const BOXES: [number, number][] = [
  [372, 164], [336, 118], [372, 250], [372, 184], [372, 66], [252, 66], [560, 64],
  [440, 520], [620, 640], [560, 580], [870, 640], [560, 258], [520, 150], [520, 110], [640, 320], [640, 480], [520, 300],
];

describe('the baked surfaces', () => {
  it.each(BOXES)('a %i x %i slab is cut from a picture of about its size', (w, h) => {
    const [rw, rh] = sizes[nearest('slab', w, h)]!;
    expect(Math.max(w / rw, rw / w)).toBeLessThanOrEqual(1.7);
    expect(Math.max(h / rh, rh / h)).toBeLessThanOrEqual(1.7);
  });
});
