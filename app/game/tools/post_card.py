#!/usr/bin/env python3
"""post_card.py -- post one approval card to the workshop.  `python tools/post_card.py CARD.json [MEDIA ...]`

CARD.json holds one item: {"id", "category", "title", "notes", "media": [{"file", "caption", "role"}], "links": [{"label", "url"}]};
"created" defaults to now in UTC (a ruling older than it no longer stands, so a reposted card is pending again), "closed" to false, "session" to $CLAUDE_CODE_SESSION_ID (the posting session, which the workshop's ping switch messages with its ruled, unclosed cards once no card is pending). "role" is "before" / "after" (shown side by side) or empty. Every card but a playtest one
needs media. A playtest card ("category": "playtest", non-visual feel work) carries no media: "notes" is what changed, "steps" how to
test it (keys, where, what to feel for), "branch" and "commit" what to run. Each MEDIA path is copied into media/<id>/ beside
approvals.json (data/workshop/media/<id>/: the folder is the card id), and every media "file" must then be there. Types the workshop shows: png, jpg, gif, mp4.
A video (mp4 or webm) is re-encoded into <stem>.mp4 as H.264 and AAC with its index up front, the one format every browser plays, and the
card names that file.
Steps: back up the existing data/workshop/approvals.json to BACKUP/approvals_<ts>.json (the file is gitignored, so the backup is the only
recovery; BACKUP is C:/tmp/backup on Windows, /var/tmp/backup elsewhere), copy the media, replace the card with the same id in
approvals.json or append it (atomic replace), then GET every media url through the running workshop and print each with its status. The workshop reads the file
per request, so nothing restarts.
`python tools/post_card.py --rule ID [STATUS] [--note TEXT]` closes card ID once the owner has ruled on it: a ruling given in chat
(STATUS approved, rejected or revise, TEXT the owner's words) is first recorded through the workshop's decide route, the one writer
of approvals_decisions.json; a ruling made in the workshop is already there, so it takes no STATUS.
The cards live in the main checkout's data/workshop/ (the git common dir's worktree), whichever worktree this runs from: the workshop
serves that checkout. --url (default http://127.0.0.1:5298/workshop/hgi) points it at another instance.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import shutil
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TYPES = {".png", ".jpg", ".jpeg", ".gif", ".mp4"}   # tools/workshop/approvals.ts TYPES is the same list
BACKUP = Path("C:/tmp/backup" if os.name == "nt" else "/var/tmp/backup")
VIDEO = {".mp4", ".webm"}   # given videos, each shown as its re-encoded .mp4


def main_checkout(root: Path) -> Path:
    """`root`'s place in the checkout holding the git common dir: `root` itself in the main checkout, the main one's from any worktree."""
    out = subprocess.run(["git", "-C", str(root), "rev-parse", "--path-format=absolute", "--git-common-dir", "--show-prefix"], capture_output=True, text=True, check=True)
    common, prefix = out.stdout.split("\n")[:2]
    return Path(common).parent / prefix


def safe(name: str) -> bool:
    """One plain name, the rule the workshop serves by: no separators, no leading dot."""
    return bool(name) and name[0] != "." and not any(c in name for c in "/\\:")


def shown(name: str) -> str:
    """The file the workshop serves for a given media name: a video's .mp4, anything else itself."""
    p = Path(name)
    return p.stem + ".mp4" if p.suffix.lower() in VIDEO else name


def encode(src: Path, dst: Path) -> None:
    """Re-encode a video to H.264 (even size, yuv420p) and AAC, its index at the front so it plays before it has loaded."""
    tmp = dst.with_name(dst.stem + ".part.mp4")
    out = subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
                          "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-c:a", "aac", "-b:a", "192k",
                          "-movflags", "+faststart", str(tmp)], capture_output=True, text=True)
    if out.returncode:
        tmp.unlink(missing_ok=True)
        raise ValueError(f"{src}: ffmpeg could not encode it: {out.stderr.strip()[-400:]}")
    os.replace(tmp, dst)


def card_of(raw: dict) -> dict:
    """The card in the file's key order, defaults filled; raises ValueError on a bad id, file name or type."""
    for m in raw.get("media", []):
        if Path(m["file"]).suffix.lower() not in TYPES | VIDEO:
            raise ValueError(f"media {m['file']!r}: a plain file name of type {' '.join(sorted(TYPES | VIDEO))}")
    card = {
        "id": raw["id"],
        "category": raw.get("category", "other"),
        "title": raw["title"],
        "notes": raw.get("notes", ""),
        "media": [{"file": shown(m["file"]), "caption": m.get("caption", ""), "role": m.get("role", "")} for m in raw.get("media", [])],
        "links": [{"label": lk["label"], "url": lk["url"]} for lk in raw.get("links", [])],
        "created": raw.get("created") or dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S"),
        "closed": bool(raw.get("closed", False)),
        "session": raw.get("session") or os.environ.get("CLAUDE_CODE_SESSION_ID", ""),
    }
    if card["category"] == "playtest":
        extra = {k: raw.get(k, "") for k in ("steps", "branch", "commit")}
        if card["media"] or not all(extra.values()):
            raise ValueError("a playtest card carries no media and needs steps (how to test), branch and commit")
        card = {**{k: card[k] for k in ("id", "category", "title", "notes")}, **extra, **{k: card[k] for k in ("media", "links", "created", "closed", "session")}}
    elif not card["media"]:
        raise ValueError(f"a {card['category']} card needs media (only a playtest card has none)")
    if not safe(card["id"]):
        raise ValueError(f"card id {card['id']!r} is not a plain folder name")
    for m in card["media"]:
        if not safe(m["file"]) or Path(m["file"]).suffix.lower() not in TYPES:
            raise ValueError(f"media {m['file']!r}: a plain file name of type {' '.join(sorted(TYPES))}")
    return card


def upsert(data: dict, card: dict) -> dict:
    items = data["items"]
    at = next((i for i, it in enumerate(items) if it["id"] == card["id"]), None)
    if at is None:
        items.append(card)
    else:
        items[at] = card
    return data


def post(raw: dict, files: list[Path], approvals: Path, media_root: Path, backup_dir: Path) -> dict:
    """Back up approvals.json, copy the media into media_root/<id>/, write the card. Nothing is written when a check fails."""
    card = card_of(raw)
    for f in files:
        if not f.is_file():
            raise ValueError(f"{f}: no such file")
    folder = media_root / card["id"]
    have = {shown(f.name) for f in files} | ({p.name for p in folder.iterdir()} if folder.is_dir() else set())
    missing = [m["file"] for m in card["media"] if m["file"] not in have]
    if missing:
        raise ValueError(f"media not given and not in {folder}: {missing}")
    text = approvals.read_bytes() if approvals.is_file() else None
    data = upsert(json.loads(text.decode("utf-8")) if text is not None else {"items": []}, card)
    if text is not None:
        backup_dir.mkdir(parents=True, exist_ok=True)
        (backup_dir / f"approvals_{dt.datetime.now():%Y%m%d%H%M%S}.json").write_bytes(text)
    folder.mkdir(parents=True, exist_ok=True)
    for f in files:
        if f.suffix.lower() in VIDEO:
            encode(f, folder / shown(f.name))
        elif f.resolve() != (folder / f.name).resolve():   # media already in the card's folder stays as it is
            shutil.copy2(f, folder / f.name)
    write(approvals, data)
    return card


def write(approvals: Path, data: dict) -> None:
    approvals.parent.mkdir(parents=True, exist_ok=True)
    tmp = approvals.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    os.replace(tmp, approvals)   # the workshop reads per request: never let it see half a file


def close(approvals: Path, cid: str) -> None:
    """Marks card `cid` closed; raises ValueError when there is no such card."""
    data = json.loads(approvals.read_text(encoding="utf-8"))
    card = next((it for it in data["items"] if it["id"] == cid), None)
    if card is None:
        raise ValueError(f"no card {cid!r}")
    card["closed"] = True
    write(approvals, data)


def decide(url: str, cid: str, status: str, note: str) -> None:
    """Records the owner's ruling through the running workshop; raises ValueError with its answer when it refuses."""
    req = urllib.request.Request(f"{url}/api/approvals/decide", json.dumps({"id": cid, "status": status, "note": note}).encode(),
                                 {"content-type": "application/json"})
    try:
        urllib.request.urlopen(req, timeout=30).read()
    except urllib.error.HTTPError as e:
        raise ValueError(f"the workshop refused the ruling: {e.code} {e.read().decode(errors='replace')[:300]}") from e


def status(url: str) -> int:
    """The HTTP status of a GET (the body read to the end), 0 when the workshop does not answer."""
    try:
        with urllib.request.urlopen(url, timeout=30) as r:
            while r.read(1 << 20):
                pass
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except OSError:
        return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("card", type=Path, nargs="?")
    ap.add_argument("media", type=Path, nargs="*")
    ap.add_argument("--url", default="http://127.0.0.1:5298/workshop/hgi")
    ap.add_argument("--rule", nargs="+", metavar=("ID", "STATUS"))
    ap.add_argument("--note", default="")
    a = ap.parse_args(argv)
    workshop = main_checkout(ROOT) / "data" / "workshop"
    if a.rule:
        if len(a.rule) > 2 or a.card:
            ap.error("--rule takes ID and an optional STATUS, and no card")
        try:
            if len(a.rule) == 2:
                decide(a.url, a.rule[0], a.rule[1], a.note)
            close(workshop / "approvals.json", a.rule[0])
        except (ValueError, OSError) as e:
            sys.exit(f"post_card: {e}")
        print(f"closed: {a.url}/#approvals/{urllib.parse.quote(a.rule[0])}")
        return 0
    if not a.card:
        ap.error("CARD.json is required")
    try:
        card = post(json.loads(a.card.read_text(encoding="utf-8")), a.media, workshop / "approvals.json", workshop / "media", BACKUP)
    except (ValueError, KeyError) as e:
        sys.exit(f"post_card: {e}; nothing written")
    q = urllib.parse.quote
    urls = [f"{a.url}/approvals-media/{q(card['id'])}/{q(m['file'])}" for m in card["media"]]
    bad = 0
    for u in urls:
        code = status(u)
        bad += code != 200
        print(f"{code or 'FAIL'}  {u}")
    print(f"card: {a.url}/#approvals/{q(card['id'])}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
