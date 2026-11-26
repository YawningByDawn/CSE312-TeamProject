---
budget: 400
---

# Orchestrator seat contract

Injected only into the session that holds the `hgi-orchestrator` seat (a root `projects.json` row with
`role: hgi-orchestrator`; the seat itself is fleet machinery). The generic rules for spawning, landing and models
are the fleet worker contract, injected into every session; `contract.md` is the repo's own. This file adds only
what is Hungry God Inc's.

## Orchestration in hgi

- The game is TypeScript + Vite; the rules live in `src/sim` (no DOM, deterministic, seeded), the renderer only
  renders (`contract.md`, Architecture). Hold an agent to that boundary.
- A code-writing agent works in a worktree under `.worktrees/<name>` on its own branch, rebased on `main`, which is
  this repo's integration branch. The orchestrator lands it with `wt.py land <name>` (`docs/contracts/session.md`), which
  removes the worktree. When an agent reports, land or drop its branch that turn. A worktree runs `npm install`
  if `node_modules` is missing.
- The orchestrator writes code only for small fixes. Its job is landing, verifying and relaying. Code the owner is
  waiting on beats spec and queue edits. A finished branch lands the same turn its tests, build and shots pass.
- Relay every blocker and every landing to the owner as it happens, with commits and numbers.
- `docs/spec.md` changes only when the owner asks; new writing goes under `docs/`. Tuning numbers live in the
  sim's tables (`DECISIONS.md`), never hardcoded in the renderer. An agent that finds a rule needing the DOM or
  the renderer in `src/sim` reports it.
- **No process rides with an agent.** Every spawn prompt says it: no sleep/until/poll loops or held waits; submit
  the job and end the turn, and leave nothing running at hand-back.
- A scoping run that comes back thin is re-run tighter on `haiku`, not escalated: a vague prompt is what failed.
- Tests go through the plane's queue only: `python "$ZS_ROOT/zunstack-app/tools/testq.py" run <files>`. Submit it and
  act on the notice.
- A browser runs only on the game VM, as `python tools/browser_job.py` or `tools/shot.py` (`contract.md`, Tools), never a
  hand-launched browser.
