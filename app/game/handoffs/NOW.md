# NOW — how work runs from 2026-11-23 15:30 (owner's order; replaces RESTART.md and RULES.md for new agents)

Owner, verbatim: "Set up worktrees work properly … Resume operations on worktrees … get shit done. Only things like prop making animation UI etc needs loops with me IN THE LOOP. STOP WASTING FUCKING TOKENS … FUCKING LAND SHIT STOP ACCEPTING SLOP CLEAN YOUR SHIT UP". And: "1-2 is enough" (agents per area).

## Rules
1. **You work in your own git worktree** on your own branch. The worktree is created from the old `main` commit: before anything else run `git merge --ff-only claude/awesome-bell-b3lrep` in it (your branch must sit on the current work), then check `ls src tests`. If `node_modules` is missing: `ln -s /home/user/Hungry-God-Inc./node_modules node_modules`. Never touch the main checkout at `/home/user/Hungry-God-Inc.`, never switch branches, never push.
2. **Land it.** Your piece has a written "done". When it is met: `npx tsc --noEmit` clean, `npm test` green (changed-only), `git add -A && git commit -m "<piece>: <what landed>"` in your worktree, report. The orchestrator merges your branch. Uncommitted work is lost work.
3. **Spend little.** Read only this file, your brief, and the top block of your piece's handoff — not DECISIONS.md, not PROGRESS.md, not other handoffs unless your brief names a section. Do not re-measure what is not in your "done". Context: you auto-compact at about 400k tokens and keep working — never hand off because of context size; you finish your piece. Commit before long steps so nothing is lost across a compaction.
4. **Report in ≤ 30 lines**: what landed (commit hash), what is not done, proof paths. Update the top of your handoff in ≤ 30 lines; do not write essays.
5. **Owner-in-the-loop pieces (props, mushrooms, animation, UI, any new look):** build ONE sheet or strip, commit, stop and report. The owner approves or rejects before anything further is built. The orchestrator's grade and your own grade are not approval.
6. **No slop.** Do not report a visual above what a side-by-side crop against `docs/refs/mine.png` / `docs/refs/town-target.png` at equal pixel scale supports. Say plainly what is bad.
7. **No balance work**: no tuning passes, no bot-table reruns (owner's ruling). Functional rules and features only.
8. Browser runs only under `flock /tmp/hg-pw-$((PORT % 3)).lock`. Playwright: `NODE_PATH=/usr/local/lib/node_modules_global`. Write screenshots only under your own prefix in `screenshots/`. Never kill a process you did not start; kill the ones you did before reporting.
9. Nothing fetched from the network at run time by the game. External libraries and assets only with a permitting licence, recorded in `CREDITS.md`.

## Proof for the owner
Owner: "Stop combining 50 images send a few important ones the resolution is too low." Proof that goes to the owner is **a few single images at full resolution** — whole 1600×900 frames from the game, or 1:1 crops — each saved as its own file. No contact sheets, no grids, nothing downscaled. At most five images per report; name the one that matters most first.

## The style
**`docs/style.md` is binding for anything that is drawn, including the interface**: read it before drawing and check your result against each of its rules. Owner: "we have a clear style. I want triple A grade shit not kids doodles." Do not invent directions; execute that one.

## The owner's verdict on the art (2026-11-23)
Characters: fine ("charming"). Buildings: some look OK. Crystals: meh. **Props: 100 % rejected. Mushrooms: rejected.** Flat single-colour fills with thin even outlines read as clip-art; the references have texture, weighted ink, modelled volume and pooled light on every surface.

## State of the tree at the restart
`npx tsc --noEmit` clean. `npx vitest run`: 1448 pass, 6 fail — `tests/feel/dusk.test.ts` (1), `tests/feel/fastday.test.ts` (1), `tests/life/ground.test.ts` (3: walkers on blocked ground in the town), `tests/life/stage.test.ts` (1: followers on Offer do not reach the grave). The game does not yet play in the browser from the cutscene to the end of Shade.

## Keep the code small and organised
`docs/architecture.md` is the binding target: one of each thing, 80k lines in all. When your piece replaces something, delete what it replaces. Put shared code in one place and look for an existing helper before writing a new one.

## Tests
Run `npm test`: it runs only the tests related to the files you changed (against the working branch). Do not run the whole suite; `npm run test:all` is the orchestrator's, at the final gate.

## Worktrees
One builder, one worktree. The orchestrator merges a finished branch, then removes its worktree and deletes the branch in the same step. Worktrees are removed as soon as their work is merged or rejected; none is left lying around.
