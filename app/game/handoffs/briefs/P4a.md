# Brief — P4a: open-world simulation (finish)

Handoff/log: `handoffs/P4.md` (read all of it: status list, rules added, API changes; the previous builder was stopped mid-tuning — steps 1–5 and 7 are done, 6 and 8 and the "remaining" critic items are open). Scratch `/tmp/p4a/`. No port needed (headless).
Read: `docs/spec.md` (formulas, stages, factions), `DECISIONS.md` §0–§13 (§13.1–13.3 one seamless world and names, §13.7 **it is a slice: tune only the first ~15–20 turns; the late game must run but is not tuned; Shade stays lean**), `handoffs/P1-critic-r2.md` (blind critic 6/10 on the mine-only sim with the orchestrator's fix direction), `handoffs/P1.md` (tools: `scripts/sim-tune.ts`, `scripts/sim-smoke.ts`).

## What the sim is
Deterministic, seeded, pure, headless (`createGame`, `legalActions`, `applyAction`, `endTurn`; JSON state with the PRNG inside). One world graph from turn 1: 12 mine areas + 13 town blocks, edge `lift`–`minehead`. Stages unlock targets in place (Whisper: individuals incl. town loners; Shade: groups and Elites). The watershed is a `stageAdvanced` event (merge rule: mine followers with Devotion < 70 become "the Congregation", ≤ 4 Apostles). Win = the ending beat at the top of Shade (`won`). Spec formulas exact and unit-tested.

## Remaining work
1. **Early game (turns 1–20) — the part that is tuned:** night 1 always affords one whisper; a typical action costs ≈ 15–30 % of that night's Nether through turn ~20 (measure per 5-turn bucket); no dead turns; decent strategies reach Shade in about 15–25 turns; careful play is threatened a few times but usually survives (decent bots dip to ≤ half Ichor in ~40–60 % of runs, lose 5–15 %); the Temple track bites careful players too; starting bonuses within ~12 points of win rate for a mid-skill bot; turn-1 Gorge not free; Crystal Bloom a choice; unused actions get a reason or are cut.
2. **Texts state real numbers**, generated from the constants the code uses (every order, miracle, evil act, event option, bonus); a test that parses hints against applied effects; fix the wrong texts listed in the critic file (Old Scars, Conscription, Informer, the pools event, Lie Low).
3. **Late game / Shade:** must run to `won` or `lost` without stalls, crashes or illegal states under greedy, cautious and random bots (500+ seeds each); a decent strategy finishes Shade in roughly 40–60 turns if that falls out cheaply, otherwise report the honest number — do not spend effort tuning it (§13.7).
4. Clean-ups from the critic's minor list that touch correctness (odds divisor disagreement, dead tunables, stage literals outside content files, tests that assert buggy values).
5. Bots in `src/sim/bots/` (greedy, cautious, random, plus the tuning ones) with a stable API for the later bots/BALANCE piece; `scripts/sim-smoke.ts` prints the summary table. Write `### P4a — Open-world sim` at the end of `DECISIONS.md` (rules added, numbers) and keep the "API changes for the UI" list in `handoffs/P4.md` exact — the UI builder works from it.

## Ownership
Yours only: `src/sim/**`, `tests/sim/**`, `scripts/sim-smoke.ts`, `scripts/sim-tune.ts`, `handoffs/P4.md`. Code ids stay; player-facing names follow §13.3. `npx vitest run tests/sim` green; `npx tsc --noEmit` clean for your files (UI files that break on your API changes are the UI builder's — list every break in the handoff).

## Report
Bot table (strategy × win %, median turn to Shade, median turns to end, min-Ichor stats, Nether-spend share per 5-turn bucket, action usage), bonus spread, what is tuned vs deliberately not, API breaks, known issues.
