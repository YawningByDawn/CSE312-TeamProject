---
budget: 600
---

# hungry-god-inc - session contract

Turn-based strategy for the browser: you are a fallen god feeding on the souls crystallized in a mine, turning its people one whisper at a time. TypeScript, Vite, PixiJS, WebAudio. The bar is a shipped indie game. Prototype.

## Docs

- Design: `docs/spec.md` (the floor: decide everything marked "To decide"), `docs/theme.md`, `docs/{vision,style,town,architecture}.md`, `docs/refs/` (`mine.png` is the visual target). Read the spec and refs first. Record every design decision in `DECISIONS.md`.
- `docs/queue.md`: open rows and every queue rule; `docs/work-queue.md`: their tasks; `docs/queue-log.md`: the landing log.
- Contracts: this file (everyone), `docs/contracts/session.md` (main session), `asset.md`, `animation.md`, `perf.md` (those agents). A rule lives in one of them only. Facts: `docs/art-pipeline.md`, `docs/perf.md`, `docs/workshop.md`.

## Scope

As `docs/spec.md` sets them: the opening cutscene into the first gameplay view with no cut, a starting bonus (one of 3), the Whisper stage (the mine), the watershed pull-back, the Shade stage (the town), and an ending beat that teases the city.

## Work

- The repo is CSE312-TeamProject; the game's root is its `app/game/`. Every path in this file and in `docs/` is relative to `app/game/`, and every tool runs from it. The team's server (`compose.yaml`, `app/Dockerfile`, the Go app, `auth/`, `nginx/`) is not ours: leave it alone unless the owner orders a change. `npm run build` is the team's build (`--mode course`: base `/game/`, the hub at `/ws`); `npm run dev` and every tool serve the game at `/`.
- Work only in your brief's worktree (`$ZS_ROOT/engine/Universal/tooling/lib/wt.py new CSE312-TeamProject <name>`). Never push, merge, land, restart, or touch the owner's checkout. Drop every other worktree you make before hand-back.
- Before work or naming a cause, read the row's State and `docs/queue-log.md`: the fix may have landed.
- Every commit in this repo is authored as `doritomayhem`, its `user.name`; never override the author.
- Hand scoping and mass mechanical work to your own Haiku agents; do the task yourself.
- Commit each working piece as you go. Near your context limit, commit and hand back a precise to-do list.
- Done means: `npm run typecheck` clean, changed files' tests green, `npm run build` passes, the game runs cutscene to end of Shade with zero console errors, and shots you looked at for anything the screen shows.
- Balance (500+ seeded runs per bot, in `BALANCE.md`): a decent strategy reaches Shade in 15-25 turns and finishes it in 40-60; the cautious bot usually survives, the random bot usually loses, no strategy dominates, no turn is dead.
- Tests: one per spec formula, plus a few whole-run checks; none for what the screen does not show. Deleted code takes its tests in the same commit.
- Code budget: 30,000 non-blank lines in `src/`, 30,000 in everything else. Lines only go down.
- The hand-back commit carries `Directive:` and `Landed:` trailers; its subject never starts with `queue:`. Work on a row also carries `Queue: <row>`, and its last commit sets that row's State: `working:` or `waiting on <who>:` and current facts, at most 60 words, no `|`, never calling its own branch pending or not landed; a done row is removed. Before hand-back, `python tools/land.py --check` passes.
- A new third-party library, font or asset goes in `CREDITS.md` with its licence.
- Report numbers, paths, hashes and what you did not check. Report a blocker at once.

## Architecture

    src/types                        -> nothing (types only)
    src/content                      -> src/types
    src/sim                          -> src/content, src/types
    src/view, src/ui, src/audio      -> src/sim, src/content, src/types
    src/app, src/main.ts             -> all
    dev/src, scripts, tests          -> may import src; src never imports them

- `land.py` runs these checks; each exception list only shrinks:
  - `tools/systems.cjs`: the table. A lower layer gets what it needs from a higher one at boot, never by import.
  - `tools/size.cjs`: no `src/` file over 400 non-blank lines unless listed, and none grows past its count. A branch never edits the list; `land.py` lowers it.
  - `tools/reach.cjs`: every `src/` file is reached from `index.html`.
  - `tools/flags.cjs`: only `src/content/flags.ts` reads the query string; every flag and `dev/*.html` page has a `src/content/flags.json` entry with a row and a deletion date.
  - `tools/text.cjs`: player-visible words live in `src/content/words/`, read with `uiText(key, slots)`.
- The sim is headless and deterministic from its seed: no DOM, canvas, IO, wall-clock or `Math.random`. Its rules and numbers live in its tables (`DECISIONS.md`). The renderer reads sim state, never changes it.
- Nothing draws live. The frame places baked assets: place sprite, pick frame. Painters run offline and ship nothing; nothing draws at load.

## Tools

- A browser runs only on the game VM, as `python tools/browser_job.py [--build] [NAME=VALUE]... <command>`; `e2e/lib/browser.cjs` `launchBrowser` is the one launch, and every server binds `jobPort(offset)`. Never `npx playwright`, `npm run bots` or `playwright install`. `tools/browser_watch.py` is the main session's job watcher (`docs/contracts/session.md`, Watch).
- The VM admits jobs by live load alone: no queue, slot, budget or exclusive job. Every job has one timeout, the hang cap `HANG_CAP_S`, never per script (`tools/test_browser_job.py`).
- `tools/shot.py` (`--dev` for a dev page) is the only way to take a frame; look at every shot you cite. `screenshots/baselines/` changes only on the owner's verdict.
- Run jobs with Bash `run_in_background`, never inside `timeout` or another wrapper; never sleep or poll. Start a run only with 4 GB free.
- A run that is refused, fails or hits the hang cap: stop and report it with its output. Do not retry around it, switch routes, launch a browser another way, or edit the tools or their locks.
- `tools/browser_job.py`, `tools/shot.py` and `tools/browser_watch.py` change behaviour only with the owner's approval.
- Workshop: one instance on :5298, started by the owner's app. Never start another.
- `python tools/bots.py 500 all`: the balance table.
- A dev switch, debug hook or A/B flag you add is deleted before the commit unless the brief orders it. Permanent: `?scene=play&seed=7&mute=1`, `&fast=1` (films eight times faster) and `&prof=1` (the profiler; F3 toggles it). `window.__hg` is the debug and test API.
