# Hungry God Inc.

You are the Hungry One: a god that fell, was buried, and had a mine dug into its grave. The souls of the dead harden into violet crystals around you, and you feed on them and on belief. Above you live the wickfolk, small pale people with a living light on the crown of their heads; turn them one whisper at a time until the mine's crystals flow to your grave instead of your enemy's, then follow the crystals up into the town.

It is a turn-based strategy game for the browser (TypeScript, Vite, Canvas 2D). This repository holds a playable slice: the opening, the mine (the Whisper stage), the watershed, and the town of Deepwell (the Shade stage) up to the ending beat. Later stages are in `docs/spec.md` but are not built.

## Requirements

- Node.js 22.12 or newer (the repo was developed on 22.23) and npm. Vitest 5 asks for Node 22.12+, 24 or 26+.
- A recent desktop browser with Canvas 2D and WebAudio. Sound starts after your first click.
- Nothing else. The game has no runtime dependencies and fetches nothing but its own files; all sound is baked from our own synthesiser into a few Ogg Opus packs (`assets/audio/`, `npm run bake:audio`) and all art is drawn by code.

## Install and run

```
npm install
npm run dev        # dev server at http://127.0.0.1:5173
```

Open http://127.0.0.1:5173/ and press Begin.

```
npm run build      # type-check (tsc --noEmit), then vite build into dist/
npm run preview    # serve dist/ at http://127.0.0.1:4173
npm run typecheck  # tsc --noEmit only
```

`npm run build` builds the game only (`index.html`). The harness pages in `dev/` are served by the dev server (`npm run dev`, `npm run workshop`) and are never built.

<!-- TODO(docs): boot time. The mine's ground is baked in the background while the title shows (a prebuilt copy for seed 1 ships in src/render/mine/prebuilt/). Once the play scene's owners have measured a cold start, state it here and say whether other seeds wait longer. -->

## How to play

A run is a string of turns. One turn is one night and the day after it.

**1. Night: you act.** Everyone sleeps. You have a few Actions (the top bar shows how many are left; each rank of Divinity gives one more). You spend them on:

- **Whisper.** Click a person, then press Whisper. It costs one Action and some Nether, and gives a chance to turn them. The odds are shown first, with the reasons that sway them; a failed whisper still softens the target. You can reach people standing on or next to your colour, or beside a follower. The sleeper by your grave is the easiest first one.
- **Routines.** A follower has one standing routine, and changing it costs an Action. **Pray** is the default: Nether for you, colour where they stand, and now and then an unasked crystal. **Offer** brings you everything they dig, every dusk, at more risk. **Lie low** hands everything in at the count and keeps their head down: no stones, no heat. Higher ranks unlock more (Delve, Skim, Preach, Stand watch).
- **Move.** A one-off request that a follower be reassigned to another place, to a face of the mine or a spot above ground. It can fail, more often the further it is from their usual path.
- **Cards.** Each night two hands are dealt: three **Miracles** and three **Acts of evil**. Play one from each, or skip. Click a card to read it, or drag it up to play it. A miracle is paid for by burning crystals (you choose which); an act of evil quiets Malice, gives you something real and is noticed by someone. Cards and crystals cost no Actions.
- **The grave and your crystals.** Open the Grave to see what you hold. A crystal can be **eaten** (Hunger falls), **burned** to pay for a miracle, **set** in one of your grave's sockets (its lines work while it is set; two of one nature strengthen each other), or **crafted**: Enchant adds a line or rerolls one for Nether, with a small chance of a curse; Recombine merges two crystals into one new one. Every crystal shows how rare its roll was ("1 in 48,000"). Other crafts (cutting, jewelry, false weights, profaning, black draughts) wait locked until you take over the right building in the town.

When you are done, press **End Night**.

**2. The Day: it plays out.** The sun comes up and the whole world runs at speed, dawn to dusk in roughly fifteen to twenty seconds by design: the colour creeps outward, the shift rides the lift down, picks swing, strikes glint, carts roll, the count is taken, your followers do what you set them to, the other side walks its rounds, weather passes over. Short notes appear where things happen and collect in a feed you can click. You can pause, change the speed or skip to dusk.

**3. Dusk: the offering and the count.** Followers come to your grave with crystals, unasked tribute and everything your Offerers dug, and each stone is set down and revealed one by one. A short ledger says what the day gave and cost, including **the count**: what came up the lift against what the mine should have yielded. Then the next night's cards are dealt. Every so often you are offered a blessing to pick (one of three).

### What watches you

The top bar's **Danger** shows three bars, one for each faction that is watching:

- **The Council** (the mine's owners) watches the count, missing stones and missing people. It answers with searches at the lift, more guards, lockdowns.
- **The Temple of the Flame** watches your colour, prayer to you and relics. It answers with wards, purges that burn your colour out, an inquisitor and finally a crusade.
- **The Public** watches fear, deaths and things that cannot be explained. It answers with rumours, informers and a mob.

Greed raises them: stones your followers keep make the count come up short; deeds are noticed. They cool slowly when you give them nothing. Click Danger to see who has noticed you and what comes next.

Two more pressures run all the time. **Hunger** rises every night: eat crystals to ease it, and at the top you turn ravenous and devour someone unasked. **Malice** rises every night too: let it out with an act of evil, or your followers start doing evil on their own.

### How you lose

- **Ichor**, your life, reaches zero. You lose it when your colour is purged from an area, when followers are taken, when a hunter reaches your grave or a relic of yours is destroyed.
- **In the town**, the Council can close the pit head: each seal on its writ brings the end nearer, and the last seal ends the run.

### How you reach the town

Reach Divinity level 4 (Shade) and have a follower reach the pit head above the mine. The camera then pulls back, the mine shrinks into a glowing point in the pit, and the town of Deepwell opens around it, mostly gray and black.

<!-- TODO(docs): confirm the exact trigger for the watershed once the play scene's owners finish. The spec says Shade (level 4) and the pit head fully in your colour; the sim (src/sim/turn.ts, selectors.ts) checks level 4 and a follower having reached the surface. -->

### The town (Shade stage)

Here the crystals go: the tally house, the gem workshop, the forge, the chapel of the Flame, the apothecary and the Council's vault. People appear as crowds and groups; the masters of those places are **Elites**. Click a crowd or an Elite to open its card and whisper to it as a group; take a building and you gain its craft. The first serious pushback comes here: the factions announce their moves a day or two ahead (a writ to seal the pit head, a levy, a rite, wards, burnings, a crusade) and you can answer them with items, an Elite's favour or a dark deed before they land.

<!-- TODO(docs): Shade stage controls. The town stage reads its own keys (Esc opens Settings); what is confirmed is clicking a crowd or Elite for its card. Write out the town's controls, the answer-a-threat buttons and the building crafts once the stage is final. -->

### Where the slice ends

At Divinity 7 with the town's gate in your colour, the ending beat plays: the gate, the road, and far off the city and the greater mines that feed it. Tier II waits; it is not built.

## Controls

Settings lists the keys too (the gear in the top-right corner, or Esc).

| Input | What it does |
|---|---|
| Click | pick a person or a place; press a button |
| Drag or arrow keys | move the view |
| Mouse wheel, `+` / `-` | zoom, from one miner out to the whole town |
| `Z` or the top-right button | switch between "Whole world" and "My mine" |
| Right-click or `Esc` | cancel; with nothing to cancel, `Esc` opens Settings |
| `Enter` | End Night (if you have done nothing tonight it asks you to press again) |
| `Space` | skip the Day to dusk; also continue past a ledger |
| `W` / `M` | Whisper / Move, while a person's card is open |
| `E` | eat a crystal |
| `G` | open or close the Grave |
| `C` | open the Chronicle (everything that has happened) |
| `1` to `9` | read a card in your hand; `Enter` plays it, `←` `→` move between cards |
| `1`, `2`, `4` and `P` | during the Day: speed, and pause |

On the title screen: `Enter` begins, `↑` `↓` choose, a seed field lets you replay a seed (the same seed and the same choices always give the same run; leave it empty for a random one). In the opening, Skip (`Esc`) jumps to the starting pick. The starting pick shows three offers: `1` `2` `3` or `←` `→` then `Enter`, `D` for details.

Settings has five tabs: **Sound** (Master, Music, Effects, Ambience, Mute, Mute in the background), **Display** (Fullscreen, Interface size, Brightness, Reduce motion), **Game** (Dawn replay speed, Skip the opening, Show hints, Show hints again, Pan speed, Invert zoom), **Keys**, and **Run** (Restart run, New run, Title screen). Settings are kept in your browser's local storage.

### Saving

The run is saved automatically in your browser after every action. If a run is saved, the title screen offers **Continue** (it shows the night and the rank) and **Begin anew**.

<!-- TODO(docs): save / resume. Confirm with the play scene's owners what a resume restores (mid-Day, mid-Dusk, the town stage) and what happens to the save at the ending. -->

## URL flags

Add them to the address, for example `http://127.0.0.1:5173/?scene=play&seed=7&mute=1`.

| Flag | Effect |
|---|---|
| `seed=N` | the run's seed |
| `scene=play` | skip the title and the opening and go straight to the game (also `cutscene`, `bonus`; default `title`) |
| `bonus=<id>` | with `scene=play`: take this starting offer, if it is one of that seed's three (for example `lingeringThrone`); otherwise the first offer is taken |
| `mute=1` | mute this page load (it does not change the saved setting) |
| `fast=1` | shorter transitions and fades (used by the tests) |
| `sim=standin` | play on the old stand-in rules instead of the real simulation (`sim=real` is the default) |
| `weather=0` | switch the world's weather drawing off |

The game also publishes `window.__hg`, a debug and test API (see `src/app/debug.ts`).

## Tests, bots and screenshots

- **Unit tests:** `python "$ZS_ROOT/zunstack-app/tools/testq.py" run <files>` runs vitest files (`*.test.ts` under `tests/`, at most 25 per call): the sim (every spec formula, determinism, invariants), the content, the renderers' contracts and the play scene's wiring. The simulation in `src/sim` is deterministic, seeded and runs without a browser.
- **Bot players:** `python tools/bots.py 500 all` plays 500 seeded runs for each bot (sensible, greedy, cautious, random) with no browser, under a memory cap, and prints the balance table. The results and what they mean are in `BALANCE.md`.
- **Screenshots and browser checks:** `python tools/shot.py` runs the game headless on the game VM (`tools/browser_job.py` runs every browser job there) and writes stills to `screenshots/`, which git ignores; `screenshots/baselines/` holds the committed reference images. Failing on any console error is part of every run.
- **Landing:** `python tools/land.py` lands a worktree onto local `main`.
- **The shot loop:** `e2e/playtest/shots.cjs` plays the real build like a player through every beat of the game (boot, title, opening, starting pick, a night, the Day, dusk, cards, crystals, zooms, the watershed, Shade, the ending) and writes a still and a six-frame strip for each beat, with a verdict, to `screenshots/reel/` (`INDEX.md` is the table, `sheet.png` the contact sheet). Its options (`--seed N`, `--until <beat>`, `--start <beat>`, `--from saved|night:N|lastmine|lasttown`) are listed at the top of the script; it runs itself on the game VM.

## Project layout

| Folder | What is in it |
|---|---|
| `src/sim/` | the simulation: rules, state, selectors, the bots (`bots/`) and the living society (`living/`) |
| `src/scenes/` | the screens: title and starting pick (`front`), opening (`cutscene`), the game (`play`, with the town stage in `play/shade`), watershed and ending (`finale`), defeat |
| `src/render/` | everything drawn: mine, town, terrain, people, crystals, weather, effects, the shared theme kit |
| `src/ui/` | the HUD and the interface kit (`ui/play` is the in-game HUD) |
| `src/audio/` | the sound player (packs decoded or streamed on demand); `gen/audio/` is the synthesiser the bake runs, outside `src/` |
| `src/content/` | the words: names, cards, events, tooltips, story text |
| `src/feel/`, `src/life/` | the Day's fast-forward film and the people's daily lives staged on screen |
| `src/app/` | the app shell: scene registry, settings, save, debug API |
| `tests/` | unit tests (vitest) |
| `scripts/` | headless tools: the bot runner, sim tuning, content counts, the mine's ground bake |
| `e2e/` | Playwright scripts that drive the game and take screenshots |
| `dev/` | one harness page per piece (HUD, crystals, town, audio and so on) |
| `docs/` | the spec (`spec.md`), the world bible (`theme.md`) and the reference images (`refs/`) |
| `handoffs/` | the builders' running notes, one file per piece |
| `tools/` | the fleet tools: `shot.py`, `bots.py`, `land.py` |
| `screenshots/` | shot output, ignored by git; `baselines/` is the committed reference set |

Top-level notes: `docs/spec.md` (what the game is), `DECISIONS.md` (every design decision), `BALANCE.md` (bot results), `PROGRESS.md` (state of the work), `contract.md` (the project's working rules), `docs/queue.md` (open work).

## Credits and licences

Third-party tools, fonts and the licence of each are listed in `CREDITS.md`.
