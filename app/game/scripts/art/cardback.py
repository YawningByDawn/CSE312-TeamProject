"""The card's back, baked as a sheet of its own (docs/art-pipeline.md: cardback/).

python scripts/art/cardback.py [root]   (Python 3 with Pillow and NumPy; deterministic: run twice, the same bytes)

`card.back` is the face-down card the deal rises with: a stone slab inked like `card.plate` (assets/ui) with the god's eye
cut into it, the same 330 x 492 px at k = 2 and the same origin, so it stands where the plate stands. The ui's DOM places it
(src/ui/hud/cards.ts) and turns it over; nothing is drawn live.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import paint  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
# the plate's cell (assets/ui/manifest.json card.plate): its size in px, k, and the origin the card's top left sits at
W, H, K, OX, OY = 330, 492, 2, 8, 6
CX, CY = W / 2, H / 2

STONE = paint.ramp('#121211', '#1b1b1a', '#2a2927', '#403f3b')
VIOLET = paint.ramp('#3a2360', '#6b46b8', '#a784e6', '#c1adc5')
SLIT = paint.ramp('#0b0a0c', '#150f22', '#241540', '#3a2360')


def rbox(cx, cy, hx, hy, r):
    return lambda X, Y: np.hypot(np.maximum(np.abs(X - cx) - (hx - r), 0), np.maximum(np.abs(Y - cy) - (hy - r), 0)) - r


def ring(cx, cy, r, t):
    c = paint.circle(cx, cy, r)
    return lambda X, Y: np.abs(c(X, Y)) - t / 2


def layers():
    slab = paint.wob(rbox(CX, CY, W / 2 - 9, H / 2 - 7, 14), 0.5, 3)
    frame = paint.cut(rbox(CX, CY, W / 2 - 24, H / 2 - 22, 8), rbox(CX, CY, W / 2 - 29, H / 2 - 27, 6))
    # short chisel hatches in the slab's grain, like the plate's
    hatch = paint.union(*[paint.seg(x, y, x + 9, y - 14, 1.4) for x, y in [(58, 70), (90, 102), (246, 84), (268, 130), (70, 380), (112, 420), (232, 396), (262, 440), (52, 250), (278, 232)]])
    lens = paint.clip(paint.circle(CX, CY - 92, 118), paint.circle(CX, CY + 92, 118))
    rays = paint.union(*[paint.seg(CX + np.cos(a) * 96, CY + np.sin(a) * 96, CX + np.cos(a) * 122, CY + np.sin(a) * 122, 2.6, 1.2) for a in np.linspace(0, 2 * np.pi, 13)[:-1]])
    return [
        paint.Layer(slab, STONE, lw=2.6, marks=(paint.mark(frame, (0x0b, 0x0a, 0x0c)), paint.mark(hatch, (0x0b, 0x0a, 0x0c), 0.8))),
        paint.Layer(paint.union(ring(CX, CY, 92, 7), rays), VIOLET, lw=1.8),
        paint.Layer(lens, VIOLET, lw=2.2),
        paint.Layer(paint.ellipse(CX, CY, 17, 52), SLIT, lw=2.4),
    ]


def main(root=ROOT):
    pic, ox, oy = paint.render(layers(), 0, 0, W, H, 1)
    out = Path(root) / 'assets/cardback'
    out.mkdir(parents=True, exist_ok=True)
    Image.fromarray(pic, 'RGBA').save(out / 'cardback.webp', 'WEBP', lossless=True, quality=100, method=6, exact=False)
    h, w = pic.shape[:2]
    manifest = {
        'note': "CARD BACK, baked by scripts/art/cardback.py. card.back: the face-down card, k = 2 px per CSS px, origin the card's top left (assets/ui card.plate shares it): the deal's cards rise with it and turn over to the plate.",
        'file': 'cardback.webp', 'w': w, 'h': h, 'levels': 1,
        'cells': {'card.back': [0, 0, w, h, K, OX + int(-ox), OY + int(-oy)]},
    }
    (out / 'manifest.json').write_text(json.dumps(manifest, separators=(',', ':'), ensure_ascii=False) + '\n')
    print(f'cardback/cardback.webp: {(out / "cardback.webp").stat().st_size} B')


if __name__ == '__main__':
    main(*sys.argv[1:])
