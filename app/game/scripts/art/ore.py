"""The mine's ore seams, baked into their own atlas (docs/art-pipeline.md: ore/).

python scripts/art/ore.py [root]   (Python 3 with Pillow and NumPy; deterministic: run twice, the same bytes)

An ore site (src/content/mine.ts ORE_SITES) is the foot of a wall face the view shows standing; its seam is a vein of
violet crystal running up that face: the rock split open along a jagged line, the cleft packed with crystal set in it, a
few points breaking out and the rock cracked round it. Nothing stands on the floor.
Cells, origin at the foot (the site's point), the vein rising up the screen from it:
- `seam-<tier>-<v>`: tier 0..2 (the ore's tier 1..3: longer, wider, more crystal), two variants each.
- `rim-<tier>-<v>`: the seam's silhouette as a white rim, for the view to tint and pulse on the ore in reach.
"""
import json
import math
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from paint import Layer, clip, mark, pack, path, poly, ramp, render, seg, union  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
K = 6                     # px per mine unit (the max-zoom density is 5)
CRACK = ramp('#0b0a0c', '#141218', '#1e1a24', '#2a2530')
CRYSTAL = ramp('#3a2360', '#6b46b8', '#a784e6', '#c1adc5')
CORE = (0xf4, 0xec, 0xff)
WHITE = ramp('#ffffff', '#ffffff', '#ffffff', '#ffffff')
# per tier: the seam's height up the face (mine units; a person is about 36 tall, a face at least 48), its widest
# half-width, its crystals and the cracks running off it into the rock
SIZE = [(34, 6.6, 12, 2), (40, 7.6, 16, 2), (46, 8.6, 20, 3)]
RIM = 1.4


def rnd(seed, i):
    return (math.sin(seed * 12.9898 + i * 78.233) * 43758.5453) % 1


def spine(x, y, dx, h, n, sd, k, jag=3.2):
    """a jagged line from (x, y) up `h` with a drift `dx`: n kinks"""
    return [(x + dx * j / n + (rnd(sd, k + j) - 0.5) * jag * (0 < j < n), y - h * j / n) for j in range(n + 1)]


def normal(pts, j):
    (ox, oy), (qx, qy) = pts[max(j - 1, 0)], pts[min(j + 1, len(pts) - 1)]
    L = math.hypot(qx - ox, qy - oy) or 1
    return -(qy - oy) / L, (qx - ox) / L


def lens(pts, hw, sd, k):
    """the rock split open along the line: widest a third of the way up, closing to a crack at both ends, its lips jagged"""
    left, right = [], []
    for j, (px, py) in enumerate(pts):
        t = j / (len(pts) - 1)
        w = hw * math.sin(math.pi * t ** 0.8) + 0.5
        nx, ny = normal(pts, j)
        a, b = w * (0.6 + 0.8 * rnd(sd, k + j)), w * (0.6 + 0.8 * rnd(sd, k + 40 + j))
        left.append((px + nx * a, py + ny * a))
        right.append((px - nx * b, py - ny * b))
    return left + right[::-1]


def prism(x, y, ang, ln, w):
    """a crystal lying in the face, its point towards `ang` (radians from straight up): a long hexagon seen from the front"""
    c, s = math.cos(ang), math.sin(ang)
    pts = [(-w, ln * 0.3), (-w, -ln * 0.45), (0, -ln * 0.7), (w, -ln * 0.45), (w, ln * 0.3), (0, ln * 0.45)]
    return poly([(x + px * c - py * s, y + px * s + py * c) for px, py in pts]), (x - s * ln * 0.1, y - c * ln * 0.1), (s, c)


def seam(tier, v):
    """the seam's layers back to front and the points it spans"""
    h, hw, n, nv = SIZE[tier]
    sd = tier * 7 + v * 3 + 1
    flip = -1 if v else 1
    main = spine(0, 2, flip * h * 0.3, h, 10, sd, 0)
    cleft = poly(lens(main, hw, sd, 100))
    layers, span = [], list(main)
    # the rock cracked round the seam: thin cracks wandering off it, tapering into the face
    for i in range(nv):
        j = 2 + (i * 3) % 5
        px, py = main[j]
        side = 1 if (i + v) % 2 else -1
        run = spine(px, py, side * (hw + 4 + 5 * rnd(sd, 70 + i)), (rnd(sd, 80 + i) - 0.4) * 14, 4, sd, 90 + i * 7, 5.0)
        line = union(*[seg(*a, *b, 0.9 * (1 - k / 4) + 0.15, 0.9 * (1 - (k + 1) / 4) + 0.15) for k, (a, b) in enumerate(zip(run, run[1:]))])
        layers.append(Layer(line, CRACK, lw=0.2, flat=True))
        span += run
    # the cleft, dark in its depth
    layers.append(Layer(cleft, CRACK, lw=0.45, shade=1.4, lit=0.7))
    # the crystal packed in it, set in the rock: each clipped to the cleft but the few whose points break out of it
    for i in sorted(range(n), key=lambda i: -rnd(sd, 200 + i)):
        t = 0.08 + 0.84 * rnd(sd, 210 + i)
        j = min(int(t * (len(main) - 1)), len(main) - 2)
        f = t * (len(main) - 1) - j
        (ax, ay), (bx, by) = main[j], main[j + 1]
        nx, ny = normal(main, j)
        across = (rnd(sd, 220 + i) - 0.5) * hw * 1.1 * math.sin(math.pi * t ** 0.8)
        x, y = ax + (bx - ax) * f + nx * across, ay + (by - ay) * f + ny * across
        ang = math.atan2(bx - ax, -(by - ay)) * 0.5 + (rnd(sd, 230 + i) - 0.5) * 1.6
        ln = (4.5 + 4.5 * rnd(sd, 240 + i)) * (1 + 0.12 * tier)
        w = 1.2 + 1.0 * rnd(sd, 250 + i) + 0.2 * tier
        shape, (gx, gy), (s, c) = prism(x, y, ang, ln, w)
        if i % 5:
            shape = clip(shape, cleft)
        glint = path([(gx - s * ln * 0.25, gy + c * ln * 0.25), (gx + s * ln * 0.2, gy - c * ln * 0.2)], 0.3)
        layers.append(Layer(shape, CRYSTAL, lw=0.35, shade=w * 0.55, lit=w * 0.5, marks=[mark(glint, CORE, 0.9)] if i % 2 == 0 else []))
    return layers, span


def rim(pic):
    """the seam's silhouette grown by RIM, less the silhouette: white, its alpha ramped as the seam's edge is"""
    a, r = pic[..., 3].astype(np.float32), RIM * K
    grown, n = a.copy(), math.ceil(r)
    for dy in range(-n, n + 1):
        for dx in range(-n, n + 1):
            if 0 < dx * dx + dy * dy <= r * r:
                grown[max(dy, 0):a.shape[0] + min(dy, 0), max(dx, 0):a.shape[1] + min(dx, 0)] = np.maximum(
                    grown[max(dy, 0):a.shape[0] + min(dy, 0), max(dx, 0):a.shape[1] + min(dx, 0)],
                    a[max(-dy, 0):a.shape[0] + min(-dy, 0), max(-dx, 0):a.shape[1] + min(-dx, 0)])
    out = np.full(pic.shape, 255, np.uint8)
    out[..., 3] = (grown - a).clip(0, 255).astype(np.uint8)
    return out


def cell(name, pic, ox, oy):
    return name, pic, [round(-ox * K, 3), round(-oy * K, 3)]


def bake(OUT):
    cells = []
    for tier in range(3):
        for v in range(2):
            layers, span = seam(tier, v)
            xs, ys = [x for x, _ in span], [y for _, y in span]
            pad = SIZE[tier][1] * 1.6 + 6 + RIM
            box = (min(xs) - pad, min(ys) - pad, max(xs) + pad, max(ys) + 2 + RIM)
            pic, ox, oy = render(layers, *box, 1 / K)
            cells.append(cell(f'seam-{tier}-{v}', pic, ox, oy))
            cells.append(cell(f'rim-{tier}-{v}', rim(pic), ox, oy))
    at, page = pack([c[1] for c in cells], 512)
    m = {'note': 'MINE ORE SEAMS, baked by scripts/art/ore.py. cells: name -> [x, y, w, h, k, ax, ay] (k px per mine unit, '
                 'the origin at the seam\'s foot, where its wall face meets the ground). seam-<tier>-<v> in its own colours; '
                 'rim-<tier>-<v> white, for the view to tint.',
         'file': 'ore.png', 'w': int(page.shape[1]), 'h': int(page.shape[0]), 'levels': 1,
         'cells': {name: [x, y, pic.shape[1], pic.shape[0], K, *o] for (name, pic, o), (x, y) in zip(cells, at)}}
    OUT.mkdir(parents=True, exist_ok=True)
    Image.fromarray(page, 'RGBA').save(OUT / 'ore.png', optimize=True)
    (OUT / 'manifest.json').write_text(json.dumps(m, separators=(',', ':')) + '\n')


def main(root=ROOT):
    t0 = time.time()
    out = Path(root) / 'assets/ore'
    bake(out)
    for f in ('ore.png', 'manifest.json'):
        print(f'{f}: {(out / f).stat().st_size} B')
    print(f'baked in {time.time() - t0:.1f} s')


if __name__ == '__main__':
    main(*sys.argv[1:])
