# Animation contract - agents that make motion

Motion is judged on screen at game timing and slowed, at the game's zoom levels, close up. Work one piece at a time: a walk or idle cycle, an effect, a transition, the cutscene, the Day. All motion is code: no authored clips, no video.

## Rules

- Motion is a pure function of sim state and time. The sim never waits on an animation; the renderer animates toward state. A skipped or fast-forwarded animation lands on the same state.
- People are sprites posed by one module (`src/view/life/people.ts`, the body a frame `rig.ts`): a loop for what each does, a walk's stride by the distance walked, the same in the mine and the town. They do what the rules say; nobody stands still.
- The Day's length is `DAY_TICKS` at `TICK_HZ` (`src/content/clock.ts`). The pause holds the clock and a held Space skips a film (`src/app/pump.ts`, `src/app/input.ts`); both always work.
- Transitions (cutscene to play, the watershed, the ending) have no cut and no pop: the last frame of one is the first of the next.
- Timing and easing numbers live in one table beside the piece.
- A repeating motion closes on its first frame; its seam is a defect.
- A motion has one owner, the piece's module. A second path that moves the same thing is deleted.

## Making a piece

1. Write what it does in sim terms: the state it reads, the beats, each beat's duration (the table's numbers).
2. Build it as a pure `(state, t) -> pose` function, which carries the unit test, and the renderer call that draws the pose.
3. Watch it stepped (`window.__hg.app.stop()`, then `window.__hg.advance(ms)`, one 1/60 s frame a step), never in a live run.
4. List every defect against the proof below, fix, repeat until the list is empty.

## Review proof

- Two frame strips from the same seed (`?scene=play&seed=7&mute=1`): every frame one step apart, and even steps over the whole piece. Close-ups of hands, props and edges at the zoom it is read at. Strips come from an `e2e/` script stepping `__hg.advance` (pattern: `e2e/playtest/watershed-strip.cjs`).
- Skip proof: played through and skipped with the game's own control (Escape in the cutscene, skip-to-dusk in the Day), it ends on the same frame; both shots cited.
- Blind review (`docs/workshop.md`, Cards), listing pop, foot slide, jitter at loop or blend, flash, a frame that differs on skip, a cut at a transition.
- In the game: a shot sequence with zero console errors. A piece not in the game yet is judged on its `dev/` page.

## Card

Both strips and the close-ups are the card's media; `notes` names any reduced-motion or skip difference.
