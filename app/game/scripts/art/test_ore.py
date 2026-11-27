"""The ore seams' bake (ore.py) is deterministic and the committed atlas is what it makes: baked again into a scratch
root, both files come out byte for byte the same (a painter changed without a bake fails here)."""
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ore  # noqa: E402


def test_bake_is_fresh_and_deterministic():
    with tempfile.TemporaryDirectory() as tmp:
        ore.main(tmp)
        stale = [f for f in ('ore.png', 'manifest.json')
                 if (Path(tmp) / 'assets/ore' / f).read_bytes() != (ore.ROOT / 'assets/ore' / f).read_bytes()]
    assert stale == []
