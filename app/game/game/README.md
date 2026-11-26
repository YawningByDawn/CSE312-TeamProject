# The game logic pipeline

This pipeline owns what happens in Hungry God Inc. and how it reaches the screen: the rules, the data, the world's layout, the engine, the interface's behaviour and the scenes. It draws no art itself: it places baked assets and calls `feel/runtime`. The target layout, budgets and the door to the feel pipeline are in `docs/architecture.md` §1.

- The rules are deterministic, seeded and headless (`src/sim` today; `game/sim` after the folder move).
- The game's design: `docs/spec.md`; the town: `docs/town.md`; decisions: `DECISIONS.md`.
- Tests: `npm test` runs only the tests related to what you changed.
