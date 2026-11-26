# Session contract - the main session only

The main session delegates, checks, lands and reports.

## Agents

- Every spawn declares `type: general|asset|animation|perf|misc` and `queue: <row>`. Asset agents get `asset.md`, animation agents `animation.md`, perf agents `perf.md`.
- Split an owner order into `docs/work-queue.md` items the turn it arrives, each specced so an agent starts with no scoping.
- Models: Opus for every task agent. Haiku for scoping and mass mechanical work: a task agent spawns its own. Haiku agents never count toward `agent_cap`; they have their own pool of twice it (`load_guard` enforces both).
- Keep `agent_cap` agents on work-queue items every turn, at most 2 of them asset or animation agents. Start the next item the turn a slot frees, unless the owner says otherwise.
- A spawn or a message giving an agent work names the row whose Goal covers that work. Using a row only to pass a gate, or attributing an agent to a row it does not work, is forbidden. Never route around a gate: fix its cause or ask the owner.
- An owner message waits in the session's order inbox (`<cache>/order-inbox/<session>.jsonl`) until it is marked queue (its id in a row's first cell) or `non-queue`, never a third way. One that orders, narrows, rescopes or rules on work is queue, however short or angry; marking it `non-queue` is a false marking.
- A cut runs as a pair: one agent builds the replacement, one deletes the files it replaces, without loss of anything the game shows.
- One agent per worktree and per topic. Before spawning, check no running agent owns the same files or the same row.
- Before a brief, read the row's State and `docs/queue-log.md`; never brief a fix that has landed.
- A brief starts with the queue row (Item, Goal, State) pasted verbatim from `docs/queue.md`, never paraphrased, then its work-queue item verbatim. The coordinator's additions (worktree, tests, what not to touch, review findings) follow below them and never restate or reinterpret either. Ask the owner when a word could mean two things.
- The queue holds only work the owner ordered. Never add, word or keep a row on your own judgement. A row's Goal is the owner's words verbatim; an added requirement is appended in their words. A Live row with no agent and nothing it waits on is a fault: staff it or close it the same turn. A row mostly worked by agents with one item waiting on the owner stays Live; its State names that item. The coordinator may reallocate a row to an existing agent; a row's own follow-ups join that row. A branch with no `Queue:` trailer (misc, tooling) lands unmarked.
- The queue and its agents hold the game's work only. An order for fleet machinery (engine, zunstack-app, the registry, hooks, gates, the plane) goes to the host session (`zsmsg.py send --to remote:<host label>`) as a spec, never as a row or an agent here.
- Stop an agent that is lost and start a fresh one on its item. An agent that stops without a hand-back: read its files, then resume it or start one successor, never both.
- Busy work that takes more than a few minutes (landing, rebases, card closing, queue edits, cleanup) goes to an agent, regardless of the agent cap; the main session replies to the owner first.

## Watch

- Keep `python tools/browser_watch.py` armed under Monitor (re-arm on expiry). Each stdout line is an event (a job failed or hung, one running long or lost, an orphan browser or Vite server, low memory); act on it the same turn.
- A browser job that fails (`tools/browser_job.py` prints each job's round trip and exit, and appends its start and end to the ledger the watcher reads) is a fault: find the agent, stop its run, and fix or report the cause before more runs start.
- A preview server or browser left running after its run or agent ended is an orphan: kill it the same turn, and tell the owner in one line what happened and what you did.

## Checking and landing

- An agent's report is a claim. Read its diff and its proof yourself: shots for render claims, bot tables for balance, before/after numbers from the current build for perf, a census for culls.
- Asset review is blind (`docs/workshop.md`, Cards): look at the evidence beside the references first, then call PASS or FAIL. Only PASS goes to the owner.
- Visual work goes to the owner as a card, non-visual feel work as a playtest card, posted only by the main session with `python tools/post_card.py CARD.json MEDIA...` (`docs/workshop.md`, Cards). Bug fixes land without a card.
- A card the owner rules on closes that turn: set `closed`, record the ruling in the row's State, start the revise work or queue it for the next slot, and drop the branches the ruling rejects or supersedes.
- Asset art and feel work land only on the owner's verdict. Deferred rows wait on the owner; no agent builds from them.
- The main session delegates land runs to an agent, never running them itself: `wt.py land <name>` runs `tools/land.py` in the worktree and removes it once the subject is on `main`. A landing that submits tests is rerun once the verdicts arrive.
- `docs/queue.md` holds open rows only. A State is replaced with current facts, never appended to.
- Priority: owner asks and important fixes, then performance, then cleanup and tooling.
- Don't clean up in place with more agents polishing old code. Delete first, then rebuild what's missing.
- Don't add a hint system or more text to fix confusion. Fix clarity in the picture.
- Don't redraw approved art (walls and so on) unasked.

## With the owner

- Report numbers, hashes and paths; say what is proven and what is not.
- Perf runs on the owner's screen only with the owner's approval for that run.
