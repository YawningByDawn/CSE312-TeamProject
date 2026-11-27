"""The card back's bake (cardback.py) is deterministic and the committed assets are what it makes: baked again into a
fresh folder, both files come out byte for byte the same, and its cell is the plate's size at the plate's k and origin."""
import json
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import cardback  # noqa: E402

FILES = ['cardback/cardback.webp', 'cardback/manifest.json']


def test_bake_is_fresh_and_deterministic():
    repo = cardback.ROOT / 'assets'
    with tempfile.TemporaryDirectory() as tmp:
        cardback.main(tmp)
        stale = [f for f in FILES if (Path(tmp) / 'assets' / f).read_bytes() != (repo / f).read_bytes()]
    assert stale == []


def test_back_stands_where_the_plate_stands():
    ui = json.loads((cardback.ROOT / 'assets/ui/manifest.json').read_text())['cells']['card.plate']
    back = json.loads((cardback.ROOT / 'assets/cardback/manifest.json').read_text())['cells']['card.back']
    assert back[4] == ui[4]
    # the picture is the plate's size plus a texel of padding each side; its origin is the plate's moved by that padding
    assert (back[2] - ui[2], back[3] - ui[3]) == (2, 2)
    assert (back[5] - ui[5], back[6] - ui[6]) == (1, 1)
