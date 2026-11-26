"""The fight's bake (combat.py) is deterministic and the committed assets are what it makes: baked again over a copy of
them, every file comes out byte for byte the same (a painter changed without a bake fails here)."""
import shutil
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import combat  # noqa: E402

FILES = ['poses/poses.json', 'people/people.json', 'life/life.png', 'life/manifest.json', 'people/s01.hi.webp', 'poses/lo-4.webp']


def test_bake_is_fresh_and_deterministic():
    repo = combat.ROOT / 'assets'
    with tempfile.TemporaryDirectory() as tmp:
        for f in FILES:
            (Path(tmp) / 'assets' / f).parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(repo / f, Path(tmp) / 'assets' / f)
        combat.main(tmp)
        stale = [f for f in FILES if (Path(tmp) / 'assets' / f).read_bytes() != (repo / f).read_bytes()]
    assert stale == []
