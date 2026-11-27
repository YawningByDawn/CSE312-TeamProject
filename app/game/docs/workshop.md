# Workshop

A Vite dev server that shows every harness page, the game and the owner's approval cards in one shell. Only the dev server serves it; `npm run build` never contains the shell.

Run: the plane starts it (`npm run workshop`, the owner's app); agents never do.

URL: `http://127.0.0.1:5298/workshop/hgi/` (port 5298, `--strictPort`, binds loopback, never opens a browser). The server's base is `/workshop/hgi/`, so the same URLs work behind the plane's `/workshop/hgi/` proxy, HMR websocket included (the proxy must forward the `vite-hmr` subprotocol). Readiness probe: `GET /workshop/hgi/pages.json`.

One config: `vite.config.ts` in `--mode workshop` sets the base and adds the `hgi-workshop` plugin (shell route, page list, approvals routes). The shell page is `dev/workshop.html` with `dev/src/workshop.ts`; it is excluded from the build entries and not reachable from `src/main.ts`.

Pages (left nav):

- Approvals: the cards in `data/workshop/approvals.json` with their pictures and videos; Approve, Reject, Revise with a note and Clear write the ruling and its history to `data/workshop/approvals_decisions.json` (atomic replace, `tools/workshop/approvals.ts`). `#approvals/<card id>` opens one card. The "ping session" chip in the bar is a switch kept in `data/workshop/approvals_ping.json` (`{"on": bool}`, off by default, POST `api/approvals/ping`): with it on, the ruling that leaves no card pending (a pending card is not closed and has no standing ruling: a ruling at or after the card's `created`, one definition in `tools/workshop/standing.ts` shared with the page) sends each posting session one message through the plane's `/api/messages` (port `$ZS_PLANE_PORT` or 8787, token `$CONTROL_PLANE_TOKEN` or `dev-local-token`). The message lists that session's unchecked cards, those ruled and not closed (`tools/post_card.py --rule` closes a card once the main session has acted on it): id, title, status, the note verbatim. A card with no session, or a refusing or unreachable plane, is returned in the decide answer as `pingError` and shown under the bar. Each card's Ping button, under its ruling buttons, sends that card's standing ruling and note to its posting session at once (POST `api/approvals/ping-card`), switch or not. The files are live state of the checkout the workshop serves, gitignored; a missing file is an empty one.
- Game: `index.html?scene=play&seed=7&mute=1`, and the same with `&view=2`.
- Dev pages: one entry per `dev/*.html`, read from the folder on every request of `pages.json`. The nav needs nothing but the file; a deleted page leaves it.

Add a page: put `dev/<name>.html` and its script in `dev/src/`, and its entry in `src/content/flags.json` (`contract.md`). The dev pages save nothing; the approvals files are the only write path.

Screenshots of a page: `python tools/shot.py --dev "/dev/town.html"` (a vite dev server over the worktree on the game VM; `--settle` is wall-clock ms).

## Cards

Every piece for the owner's verdict, visual or not, is a card.

- An agent prepares `CARD.json` (format in the docstring of `tools/post_card.py`) and its media and hands them back; the main session posts them (`docs/contracts/session.md`).
- `python tools/post_card.py CARD.json MEDIA...` copies the media into the main checkout's `app/game/data/workshop/media/<card id>/` (beside `approvals.json`, gitignored; the main checkout whichever worktree it runs from, since the workshop serves that one; never a temp folder, which the OS clears), first copies the existing `approvals.json` to `approvals_<timestamp>.json` in `C:/tmp/backup` (Windows) or `/var/tmp/backup` (the file is gitignored, so this is its only recovery), writes the card into `approvals.json` (replacing the card with the same id), and GETs every media URL through the workshop (`--url` to use the plane's). Tests: `tools/test_post_card.py`.
- Before a card: a blind review. Look at the evidence (shots, strips) beside the references first, list every gap or defect, then call PASS or FAIL. Only PASS goes to the owner.
- Media are png (also gif; a video as mp4 or webm, which `post_card.py` re-encodes to an H.264 mp4 with sound), each `"file"` with a `"caption"` saying what to look at. A piece that replaces existing art or motion carries the old one too: the same shot or strip from the committed baseline or from `main` is `"role": "before"`, the branch's is `"role": "after"`, same seed, camera and frames. `notes` says what changed, the defects found and fixed, and every one still open.
- A change with nothing to see (sound, perf) is a playtest card: `"category": "playtest"`, no media, `notes`, `steps`, `branch`, `commit`.
- A rejected card's note says what failed; the next attempt changes that.
