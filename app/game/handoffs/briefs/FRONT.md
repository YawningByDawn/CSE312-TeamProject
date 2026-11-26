# Brief — FRONT: title screen, starting-bonus pick, defeat, pause — the frame around the game

Handoff/log: `handoffs/FRONT.md`. Port **5229**. Scratch `/tmp/front/`.
Read: `CLAUDE.md` (scope items 1–2: the cutscene's last shot becomes the first gameplay view with no cut; pick one of 3 random offers); `docs/spec.md` (starting bonus); `DECISIONS.md` §13.3, §13.6, §13.10, §14.1, §14.7; `handoffs/P7.md` (cutscene: its last shot and hand-over to play); `handoffs/P5-fix.md` (shell, settings, layout units, save/continue if any); `handoffs/P4.md` (`chooseBonus`, bonus content, `phase: 'bonus'`, defeat/`won` events); `src/scenes/title/**`, `src/scenes/defeat/**`, `src/scenes/_placeholders.ts` (current placeholders — read-only); `handoffs/briefs/HUD.md` (visual language), `handoffs/briefs/FEEL.md`, `handoffs/briefs/WRITING.md`.

These screens are placeholders today. They are the first and last things a player sees.

## Build `src/scenes/front/`
1. **Title (`title.ts`):** a living picture, not a menu on black — the grave in the dark mine drawn with the real renderer (or a baked still of it) breathing faintly, the game's name hand-lettered/inked, Start / Continue (if a run is saved) / Settings, a seed line small; first input also unlocks audio; fits every layout size (incl. 1015×240 and 640×300); idle motion; a clean cross into the cutscene.
2. **Starting-bonus pick (`bonus.ts`):** an overlay on the play scene's first frame (the cutscene's last shot stays underneath, no cut): three offers rise out of the grave as inked cards — name, two short lines, Details on demand, what it changes shown by a tiny picture rather than numbers; hover/press feel; the chosen card sinks into the grave and its effect is visible at once in the world; keyboard/touch; deterministic offers from the seed; reroll only if the spec allows it.
3. **Defeat (`defeat.ts`):** what killed you in one plain sentence and one picture (starved; rooted out by the Temple; the last follower lost), the run in five lines (nights, followers, how much of the mine was yours, how far up you got), "Again" (new seed) / "Same seed" / Title; the world visibly dies behind it (colour draining to gray, then black).
4. **Pause and resume states** that the shell lacks (if the shell already has them, polish only through requests).
5. All with sound cues (names from the audio builder's list), motion per the feel rules, zero console errors.

## Working alongside others
You build in the new directory `src/scenes/front/**` and register nothing in the app yourself: export scene objects with the same scene interface the app uses (read `src/app/app.ts`), plus `dev/front.html` that mounts each one standalone. The play-scene builder (owner of the app wiring once the shell builder reports) switches the registrations — write the exact three-line change under "Requests to PLAY-v2" in your handoff.

## Proof and self-grading
`e2e/front-shots.cjs`: every screen/state at 1600×900, 1366×768, 1015×240, 640×300 + 8-frame strips of each transition (title → cutscene, cards rising, pick, defeat drain) → `screenshots/front-*.png`; layout/clipping checks; `handoffs/RULES.md` rule 13 (self-grade against "would this ship in a good indie game?", keep going until ≥ 8).

## Ownership
Yours only: `src/scenes/front/**`, `dev/front.html`, `e2e/front-shots.cjs`, `screenshots/front-*.png`, `handoffs/FRONT.md`. Append `### FRONT — Title, bonus pick, defeat` to `DECISIONS.md`.
