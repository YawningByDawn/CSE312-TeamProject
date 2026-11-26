#!/usr/bin/env python3
"""Two or more labelled pictures side by side in one PNG (ImageMagick `montage` is not on the game VM).

    python3 e2e/lib/montage.py OUT.png LABEL1 IMG1 LABEL2 IMG2 [LABEL3 IMG3 ...]

Each picture is scaled to the first one's size, under a one-line caption on a dark ground.
"""
import sys

from PIL import Image, ImageDraw, ImageFont


def main(argv: list[str]) -> int:
    if len(argv) < 5 or len(argv) % 2 == 0:
        print(__doc__, file=sys.stderr)
        return 2
    out, pairs = argv[0], list(zip(argv[1::2], argv[2::2]))
    imgs = [(label, Image.open(path).convert('RGB')) for label, path in pairs]
    w, h = imgs[0][1].size
    pad, cap = 6, 40
    try:
        font = ImageFont.truetype('DejaVuSans.ttf', 24)
    except OSError:
        font = ImageFont.load_default()
    sheet = Image.new('RGB', (len(imgs) * (w + pad) + pad, h + cap + 2 * pad), '#111111')
    d = ImageDraw.Draw(sheet)
    for i, (label, im) in enumerate(imgs):
        x = pad + i * (w + pad)
        d.text((x + 4, pad + 6), label, fill='#dddddd', font=font)
        sheet.paste(im.resize((w, h)), (x, pad + cap))
    sheet.save(out)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
