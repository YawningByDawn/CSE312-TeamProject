import json
import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import post_card  # noqa: E402


def card(**kw):
    return {"id": "r-m2", "title": "Renderer M2", "category": "environment", "media": [{"file": "a.png", "caption": "a"}], **kw}


@pytest.fixture
def env(tmp_path):
    approvals = tmp_path / "approvals.json"
    approvals.write_text('{\n  "items": []\n}\n', encoding="utf-8")
    shot = tmp_path / "a.png"
    shot.write_bytes(b"png")
    return approvals, tmp_path / "media", shot


def bk(approvals):
    return approvals.parent / "bk"


def items(approvals):
    return json.loads(approvals.read_text(encoding="utf-8"))["items"]


@pytest.mark.parametrize("bad", ["", ".hid", "a/b", "a\\b", "c:x", ".."])
def test_a_bad_id_writes_nothing(env, bad):
    approvals, media, shot = env
    with pytest.raises(ValueError, match="plain folder name"):
        post_card.post(card(id=bad), [shot], approvals, media, bk(approvals))
    assert items(approvals) == [] and not media.exists()


def test_a_missing_media_file_writes_nothing(env):
    approvals, media, shot = env
    with pytest.raises(ValueError, match="no such file"):
        post_card.post(card(), [shot.with_name("nope.png")], approvals, media, bk(approvals))
    with pytest.raises(ValueError, match="media not given"):   # a.png named by the card but neither given nor in the folder
        post_card.post(card(), [], approvals, media, bk(approvals))
    assert items(approvals) == [] and not media.exists()


def test_a_card_needs_media_and_a_known_type(env):
    approvals, media, shot = env
    with pytest.raises(ValueError, match="needs media"):
        post_card.post(card(media=[]), [], approvals, media, bk(approvals))
    with pytest.raises(ValueError, match="of type"):
        post_card.post(card(media=[{"file": "a.bmp"}]), [shot], approvals, media, bk(approvals))


def test_a_playtest_card_has_steps_branch_commit_and_no_media(env):
    approvals, media, _ = env
    with pytest.raises(ValueError, match="playtest"):
        post_card.post({"id": "p", "title": "t", "category": "playtest"}, [], approvals, media, bk(approvals))
    post_card.post({"id": "p", "title": "t", "category": "playtest", "steps": "press 1", "branch": "b", "commit": "abc"}, [], approvals, media, bk(approvals))
    assert items(approvals)[0]["steps"] == "press 1"


def test_a_post_copies_the_media_and_appends_the_card(env):
    approvals, media, shot = env
    post_card.post(card(), [shot], approvals, media, bk(approvals))
    assert (media / "r-m2" / "a.png").read_bytes() == b"png"
    [it] = items(approvals)
    assert it["id"] == "r-m2" and it["closed"] is False and it["media"] == [{"file": "a.png", "caption": "a", "role": ""}]


def test_a_webm_is_shown_as_an_h264_mp4_with_its_sound(env, tmp_path):
    approvals, media, _ = env
    clip = tmp_path / "clip.webm"
    subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=65x49:d=0.2", "-f", "lavfi", "-i", "sine=d=0.2",
                    "-c:v", "libvpx-vp9", "-c:a", "libopus", str(clip)], check=True)
    post_card.post(card(media=[{"file": "clip.webm", "caption": "c"}]), [clip], approvals, media, bk(approvals))
    assert items(approvals)[0]["media"][0]["file"] == "clip.mp4" and not (media / "r-m2" / "clip.webm").exists()
    probe = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_name", "-of", "csv=p=0", str(media / "r-m2" / "clip.mp4")],
                           capture_output=True, text=True, check=True)
    assert probe.stdout.split() == ["h264", "aac"]


def test_the_same_id_replaces_the_card_in_place(env):
    approvals, media, shot = env
    post_card.post(card(id="first"), [shot], approvals, media, bk(approvals))
    post_card.post(card(), [shot], approvals, media, bk(approvals))
    post_card.post(card(title="Renderer M2, again"), [shot], approvals, media, bk(approvals))
    assert [(i["id"], i["title"]) for i in items(approvals)] == [("first", "Renderer M2"), ("r-m2", "Renderer M2, again")]
    assert not approvals.with_suffix(".json.tmp").exists()


def test_a_missing_approvals_file_is_an_empty_one(tmp_path):
    shot = tmp_path / "a.png"
    shot.write_bytes(b"png")
    approvals = tmp_path / "workshop" / "approvals.json"
    post_card.post(card(), [shot], approvals, tmp_path / "media", tmp_path / "bk")
    assert not (tmp_path / "bk").exists()   # nothing existed to back up
    assert [c["id"] for c in items(approvals)] == ["r-m2"]


def test_a_post_backs_up_the_previous_approvals_file(env):
    approvals, media, shot = env
    before = '{\n  "items": [{"id": "old"}]\n}\n'
    approvals.write_text(before, encoding="utf-8")
    post_card.post(card(), [shot], approvals, media, bk(approvals))
    [saved] = bk(approvals).glob("approvals_*.json")
    assert saved.read_text(encoding="utf-8") == before   # the previous content, not the new file
    assert approvals.read_text(encoding="utf-8") != before
    assert [i["id"] for i in items(approvals)] == ["old", "r-m2"]


def test_a_refused_post_leaves_no_backup(env):
    approvals, media, shot = env
    with pytest.raises(ValueError):
        post_card.post(card(id=".hid"), [shot], approvals, media, bk(approvals))
    assert not bk(approvals).exists()


def test_the_card_carries_the_posting_session_last(env, monkeypatch):
    approvals, media, shot = env
    monkeypatch.setenv("CLAUDE_CODE_SESSION_ID", "abcdef12-env")
    post_card.post(card(), [shot], approvals, media, bk(approvals))
    post_card.post(card(id="given", session="given-id"), [shot], approvals, media, bk(approvals))
    post_card.post({"id": "p", "title": "t", "category": "playtest", "steps": "s", "branch": "b", "commit": "c"}, [], approvals, media, bk(approvals))
    env_card, given, playtest = items(approvals)
    assert env_card["session"] == "abcdef12-env" and list(env_card)[-1] == "session"
    assert given["session"] == "given-id"
    assert list(playtest)[-1] == "session"


def worktree_pair(tmp_path):
    main, wt = tmp_path / "main", tmp_path / "wt"
    main.mkdir()
    for args in (["init", "-q"], ["commit", "-q", "--allow-empty", "-m", "x"], ["worktree", "add", "-q", str(wt), "-b", "side"]):
        subprocess.run(["git", "-C", str(main), "-c", "user.name=t", "-c", "user.email=t@t", *args], check=True, capture_output=True)
    return main.resolve(), wt


def test_main_checkout_is_the_same_from_the_main_checkout_and_from_a_worktree(tmp_path):
    main, wt = worktree_pair(tmp_path)
    assert post_card.main_checkout(main) == main
    assert post_card.main_checkout(wt) == main


def test_main_checkout_keeps_the_games_folder_of_a_bigger_repo(tmp_path):
    main, wt = worktree_pair(tmp_path)
    (main / "app/game").mkdir(parents=True)
    (wt / "app/game").mkdir(parents=True)
    assert post_card.main_checkout(wt / "app/game") == main / "app/game"


def test_main_writes_the_card_into_the_main_checkouts_workshop(tmp_path, monkeypatch):
    main, wt = worktree_pair(tmp_path)
    shot = tmp_path / "a.png"
    shot.write_bytes(b"png")
    spec = tmp_path / "card.json"
    spec.write_text(json.dumps(card()), encoding="utf-8")
    monkeypatch.setattr(post_card, "ROOT", wt)
    monkeypatch.setattr(post_card, "BACKUP", tmp_path / "bk")
    monkeypatch.setattr(post_card, "status", lambda url: 200)
    assert post_card.main([str(spec), str(shot)]) == 0
    assert [c["id"] for c in items(main / "data" / "workshop" / "approvals.json")] == ["r-m2"]
    assert (main / "data" / "workshop" / "media" / "r-m2" / "a.png").is_file()
    assert not (wt / "data").exists()


def test_close_marks_only_that_card_and_refuses_an_unknown_one(env):
    approvals, media, shot = env
    post_card.post(card(), [shot], approvals, media, bk(approvals))
    post_card.post(card(id="other"), [shot], approvals, media, bk(approvals))
    post_card.close(approvals, "r-m2")
    assert [(c["id"], c["closed"]) for c in items(approvals)] == [("r-m2", True), ("other", False)]
    with pytest.raises(ValueError, match="no card"):
        post_card.close(approvals, "nope")
