# DOCS — README.md and CREDITS.md (builder report, 2026-11-23)

Files written: `README.md` (new), `CREDITS.md` (rewritten), this file. Nothing else was edited, no git, no server left running. `DECISIONS.md` was not touched (no design decision was made; the two doc-only choices are listed at the end).

## At the top

**Non-permissive or unconfirmed licences** (all dev-only or not redistributed; none ships in the game):
- `lightningcss` 1.33.0 and `lightningcss-linux-x64-gnu` 1.33.0 — **MPL-2.0**, a hard dependency of Vite 8, build time only, unmodified.
- SciPy's wheel (`src/audio/devtools/audition/sheet.py`, an offline audio tool) bundles an **LGPL-2.1-or-later** library (libquadmath). Not redistributed.
- Chromium for Testing 153.0.8010.12 (Playwright's browser): **no licence file in the install**; recorded as "not recorded here".
- Shipped and conditional: IM Fell English (SIL OFL 1.1) — see "Origin not recorded / open".

**External network use at runtime: none found.** Every hit of `fetch(`, `XMLHttpRequest`, `new WebSocket`, `sendBeacon`, `EventSource`, `new Worker`, `http://`, `https://` in `src/`, `dev/`, `index.html` is classified in CREDITS.md §6: two same-origin `fetch` calls for the bundled prebuilt ground (`src/render/mine/prebuilt.ts:82-83`), one bundled `Worker`, nine SVG `xmlns` strings, two local-server URLs in dev audio scripts, one URL inside `OFL.txt`. No defect.

**Docs found a gap in the repo, not fixed (not mine to fix):** `npm run bots` runs `scripts/run-bots.ts`, which is a one-line stub (`console.log('bots not implemented yet')`). The real runner is `npx tsx scripts/sim-bots.ts`. README says so. CLAUDE.md's "Done" list should point at the real command, or `run-bots.ts` should forward to it (owner of `scripts/`).

## Origin not recorded / open

| Item | State |
|---|---|
| `src/ui/play/dev/mine-still.jpg` (1600×900, dev harness backdrop; ships only inside the built `dev-hud` page) | **origin not recorded — owner to confirm.** Probably a screenshot of our renderer; no header, sibling file, DECISIONS or handoff says so. |
| `docs/refs/{mine,town,town-target,region}.png` | supplied by the owner (spec §15 / CLAUDE.md); their upstream origin and rights are not recorded — **owner to confirm** before the repo is public. |
| `handoffs/ref/*.png` (6 crops) | derived from `mine.png` (`handoffs/ART-REFERENCE.md`). |
| **IM Fell English** (3 woff2 in `src/scenes/front/fonts/`) — **owner's open decision: keep / remove (nothing removed)** | Licence as recorded in the files themselves: each woff2 name table (I decoded it with Node's brotli; script was in the scratchpad) reads "© 2007 Igino Marini (www.iginomarini.com) With Reserved Font Name IM FELL English {Roman, Italic, SC}", licence URL `http://scripts.sil.org/OFL`, version 3.00. `OFL.txt` beside them is the OFL 1.1 text but its first line is "Google Inc." and it has **no copyright line naming Igino Marini**. The "via Fontsource" claim (in `fonts.ts` and the old CREDITS row) cannot be re-checked: `@fontsource/*` is not in `package.json` or `node_modules`. They are Latin subsets re-encoded to woff2 by a third party and used under the CSS names "HG Fell" / "HG Fell SC" (the OFL's Reserved Font Name clause concerns modified versions; whether a subset counts is the owner's call). ~175 kB, in the build. |
| `title-still.webp`, `render/mine/prebuilt/ground-1.*` | ours: baked from our renderer (DECISIONS FRONT section line 1026; `scripts/mine-ground-bake.cjs`). Recorded. |
| sfx-skill | reference only, MIT recorded second-hand by the audio builder (DECISIONS line 919); not installed, not re-verified. |

## Confirmed: all audio is synthesised, all art is code
- No `.wav/.mp3/.ogg/.flac` file anywhere outside `node_modules` (find), and no `decodeAudioData`, `<audio>`, `HTMLAudioElement`, `createMediaElementSource` in `src/` (grep). No exception.
- Raster files in `src/`, `dev/`: `title-still.webp`, `prebuilt/ground-1.webp` (+ `.bin`, `.json`), `mine-still.jpg`, 3 woff2. No `public/` folder. No `@font-face` and no `url(` to a file in `src/`, `dev/`, `index.html` (only `url("${scene}")` in `src/ui/play/art.ts`, which takes a generated card-art string).
- The game imports no npm package (grep of `from '…'` / `import('…')` / `require('…')` for bare names over `src/` and `dev/`: none). `package.json` has only `devDependencies`.

## Verification table

| Claim | How verified | Result |
|---|---|---|
| Scripts `dev`, `build`, `preview`, `typecheck`, `test`, `bots`, `e2e` exist; commands, hosts and ports (5173 dev, 4173 preview) | `cat package.json`; `npm run` (lists them) | match |
| `npm ls --depth=0`: 5 devDependencies, no dependencies, versions in CREDITS | `npm ls --depth=0`; `package.json` of each in `node_modules` | typescript 7.0.2, vite 8.3.8, vitest 5.1.1, tsx 4.23.15, @types/node 26.6.6 |
| Licence of every installed package (42) | node script reading every `node_modules/**/package.json` (`license`, repository, LICENSE file name) | 34 MIT, 4 Apache-2.0, 2 MPL-2.0 (lightningcss ×2), 1 ISC, 1 BSD-3-Clause; LICENSE texts of typescript (Apache 2.0), vite, tsx, vitest, @types/node, lightningcss (MPL 2.0) opened and match |
| Playwright 1.63.0, Apache-2.0, repo URL | `/usr/local/lib/node_modules_global/playwright/package.json`; `head LICENSE` | match |
| Chromium 153.0.8010.12, no licence file | `chrome --version`; `find /opt/pw-browsers/chromium-1243 -maxdepth 3 -iname "*licen*"` | version read; no file found |
| Python 3.13.18, Pillow 12.3.0 MIT-CMU, NumPy 2.5.3, SciPy 1.18.1 | `python3 -I` + `importlib.metadata` | as listed; SciPy metadata shows a bundled libquadmath under LGPL-2.1-or-later |
| Which scripts use Python/PIL/scipy | `grep -n "^import\|^from"` on `shots.py`, `sheet.py`, `.claude/hooks/context_guard.py` (stdlib only); `grep python3` in `e2e/` | shots.py: PIL; sheet.py: numpy, PIL, scipy; front-shots/town-shots call python3 with PIL |
| Font files, their licence text, name tables | `ls -la`; `head OFL.txt`; Node brotli decode of the woff2 name tables | as in the table above |
| `title-still` / prebuilt ground are ours | `grep -rn` for the file names; DECISIONS line 1026; head of `prebuilt.ts`, `mine-ground-bake.cjs`, `ground-1.json` | recorded as baked by our code |
| Build does not include `docs/refs` | read `vite.config.ts` (inputs: `index.html` + `dev/*.html`); grep `src/`, `dev/` for imports from `docs/` or `handoffs/ref` (none; one runtime URL string in `src/render/dev/peopleSheets.ts:53`); `ls /tmp/loop/dist/assets` (an older build, 05:12) | fonts + title-still only, no reference picture |
| The build includes every `dev/*.html` page | read `vite.config.ts` `pages()` | yes. Not built here (slow, shared box); README says "builds every page in `dev/`" from the config. |
| Vite's own helper is in the bundle | `grep -l modulepreload /tmp/loop/dist/assets/*.js` | present in that older build |
| Title menu: Begin / Continue (night · realm) / Begin anew / Settings, seed field + dice, Enter, ↑ ↓, Esc | `src/scenes/front/title.ts` (lines ~106-125, `keys()` ~508); `src/scenes/title/index.ts:307` registers front's `createTitleScene` | match. (The older `TitleScene` class inside `src/scenes/title/index.ts` is dead code: the registration at its bottom uses front's scene.) |
| Opening is skippable (Skip button, `Esc`), ~40 s | `src/scenes/cutscene/index.ts` header, `buildSkip`, `onKey` | match; README does not state the length |
| Starting pick: 3 offers, `1 2 3`, `← →`, `Enter`, `D` | `src/scenes/front/bonus.ts:606` | match |
| Play controls: click, drag/arrows/WASD, wheel/+/-, `Z`, right-click/`Esc`, `Enter`, `Space`; "Whole world" / "My mine" | `PlayScene.keys()` and `onKey` in `src/scenes/play/index.ts` (~1214-1280); button text at lines 230, 1035 | match |
| `W` Whisper, `M` Move on an open person card | `src/ui/play/cards.ts:360-372` | match |
| `E` eat, `G` grave, `C` chronicle, `1-9` read card / `Enter` plays / `← →`, Day `1 2 4` speed and `P` pause, `Space`/`Enter` skip | `src/ui/play/night.ts:143`, `grave.ts:733`, `index.ts:677-683`, `hand.ts:644`, `day.ts:109` | match |
| HUD's own words (End Night, Whisper, Move, Pray, Offer, Lie low, Skip, Danger, Grave, Chronicle, "Eat a crystal", Enchant/"Add a line"/Reroll, Recombine, "Burn and cast", Continue, "Follow the day") | `src/ui/play/words.ts`, `src/content/loop.ts` ROUTINES | match; "Follow the day" is not used in README |
| Routine descriptions; Delve/Skim/Preach/Stand watch exist | `src/content/loop.ts:30-80`; spec §8 | match |
| Settings tabs and every setting named | `src/ui/settings.ts` lines 82-90, 230-345; `src/app/settings.ts` | match |
| Autosave and Continue | `src/app/session.ts` (`save()`, `readSave`, `load`), settings Run tab text "saved automatically after every action" | match |
| URL flags `seed`, `scene`, `bonus`, `mute`, `fast`, `sim`, `weather` | `src/main.ts` header and `boot()`, `src/app/app.ts:116-121`, `src/scenes/play/sim.ts:106`, `src/scenes/play/world.ts:197`; `bonus` ids from `src/sim/types3.ts` | match. `standin=` and `t=` exist (dev / cutscene) and are left out of README on purpose |
| Hunger "ravenous" (devours someone at the top) | `src/sim/turn.ts` `ravenous()` | match; the spec says "eat one of your own followers unasked", the sim eats the most devoted follower or, with none, a stranger |
| Loss: Ichor 0; the writ's last seal ("The pit head is sealed") | `src/sim/effects.ts:179-188`, `src/sim/town.ts:245-260` | match |
| Win: Divinity 7 + gate (`citygate`) rooted | `src/sim/turn.ts:383-401`, `balance.ts` `winLevel: 7` | match |
| Watershed: Divinity 4 and a follower at the surface | `src/sim/turn.ts` `checkGate`, `selectors.ts` `shadeProgress` | see "Spec vs sim" below |
| Threat kinds (writ, levy, rite, ward, burning, crusade), announced 1-2 days ahead, answers | `handoffs/P4.md` top block (v3.3) | from the handoff; not re-checked in the sim code |
| Crowd/Elite click opens a card | `handoffs/PLAY-SHADE.md` top, `handoffs/HUD.md` v6 block | from handoffs |
| Smoke test: port 5199, zero console errors, `screenshots/smoke.png` | head of `e2e/smoke.cjs`, `startServer` in `e2e/lib/browser.cjs` | read, **not run** |
| Shot loop: flags `--smoke`, `--seed`, `--out`; builds, then `flock`; output in `screenshots/reel/` (`INDEX.md`, `sheet.png`) | head and lines 40-65 of `e2e/playtest/shots.cjs`; `ls screenshots/reel`; reel beats list | read, **not run** |
| Bots: `scripts/sim-bots.ts 500 all --md`, bot names sensible/greedy/cautious/random, ~1 h | head of the script, `BOT_IDS` in `src/sim/bots/index.ts`, BALANCE.md header ("56 min wall") | read, **not run** |
| `npm run bots` is a stub | `cat scripts/run-bots.ts` | one line, prints "bots not implemented yet". I did not run it (the sandbox refused a combined command containing it; reading the file is conclusive). |
| Project layout rows | `ls src src/* dev e2e scripts tests`; head of `src/life/index.ts`, `src/feel/index.ts` | match |
| Node requirement | engines fields of vite, vitest, tsx, typescript; `node --version` = 22.23.5 | vite `^20.19 \|\| >=22.12`, vitest `^22.12 \|\| ^24 \|\| >=26` |

Not run on purpose: `tsc --noEmit` (slow), the full test suite, bots, `vite build`, any browser or server.

## Spec vs sim: discrepancies README had to choose a side on (orchestrator / owner)
1. **Reaching Shade.** Spec §12 / the README brief: Divinity 4 **and the pit head fully in your colour**. The sim only needs Divinity 4 and `flags.surfaceReached` (a follower reached the surface). README follows the sim and carries a `TODO(docs)`.
2. **Winning.** Spec §12: the ending beat is "at the top of Shade, with the vault open". The sim wins at Divinity 7 with the `citygate` rooted (no vault condition). README follows the sim.
3. **Losing.** Spec §13 also loses "when you have no followers, no colour beyond your grave and no way to whisper (rooted out)". I found no such check in `src/sim` (grep `rooted out|noFollowers`). README lists only Ichor 0 and the sealed pit head. Not confirmed either way.
4. **Starving.** Spec: you eat one of your followers unasked each night at the top; sim: devotion drain while starving and a separate "ravenous" devour. README states only the ravenous devour.

## Controls to confirm (left out of the README or hedged)
- `X` / `Delete` discards a card in `hand.ts`; README leaves it out because the spec only lets you play one or skip, and I could not tell whether the live hands offer discards.
- `S` = Recall / "send" on an open person card (`cards.ts` key map): Send is deprecated in the HUD; left out.
- A card's drag-up-to-play and the "Skip" button on a hand: both are in the HUD words ("Drag up to play", `hand.skip`) and README mentions drag; not verified in the running game.
- "Follow the day" and Pause buttons on the Day strip: `P` is listed; the "Follow the day" toggle is omitted.
- Right-click cancel is in the scene's own key list; not exercised.
- Any town-stage-specific keys or buttons (the stage reads its own keys; only `Esc` is known).
- The Day's real length (the README says "roughly fifteen to twenty seconds by design"; measured length not checked).
- `Dawn replay` setting: its label belongs to the old "dawn" wording; README uses the label as shown ("Dawn replay speed").
- Whether the HUD key `W` (Whisper) shadows the WASD pan key while a card is open: by code order yes; harmless; not mentioned.

## Places a later pass must update (HTML comments in README.md, search `TODO(docs)`)
1. **Boot time** (under Install and run).
2. **Watershed trigger** (spec vs sim, above).
3. **Shade stage controls** (the town's controls, answer-a-threat buttons, building crafts).
4. **Save / resume** (what a resume restores, mid-Day, mid-Dusk, the town, the save at the ending).

## Two doc-only choices (not worth a DECISIONS entry, flagged here)
- CREDITS.md now lists transitive dev dependencies and global tools, not only the direct ones, so that the "no unlisted licence" claim holds.
- README names `scripts/sim-bots.ts` rather than `npm run bots` as the bot command until the stub is replaced.

## What the owner must decide
1. Keep or remove the IM Fell English fonts (and whether the `OFL.txt` "Google Inc." line / Reserved Font Name concern matters to them).
2. Confirm or replace `src/ui/play/dev/mine-still.jpg` (provenance), and confirm rights to publish `docs/refs/*.png`.
3. Which side of the three spec-vs-sim differences is correct (watershed trigger, win condition, "rooted out" loss), so README and spec agree.
4. Whether `npm run bots` should forward to `scripts/sim-bots.ts`.
