# Perf contract - agents that profile or optimize

Target, the owner's machine at 2560x1440, all at once: the game's own work 1-2 ms a frame at rest, panning, zooming and with the Day running; no frame over 16 ms except at a scene change; no work at rest; a cold start to the title in seconds; main-thread time, memory, draw calls and bundle size no higher than before the change. Below the caps, less is still better. A gain bought with a linear rise in memory, uploads or draw calls is a cost increase. No speedup comes from polling, spinning or silently lowering fidelity. Every millisecond or count above the target, and every path breaking a rule below, is a named cost in `docs/perf.md`, removed without changing the look or feel.

## Rules

1. **No work at rest.** A still night issues no render, draw call, texture upload, layout, style recalculation or DOM write, and runs no timer, rAF loop or observer whose result nothing shows.
2. **Render only on change** of state, camera or a visible animation step, never on a timer. What moves at rest is sprites picked by phase, not repaints. Pan, zoom and the camera's breath are a matrix.
3. **No per-frame allocation of world views.** A view of the world is built once and updated in place.
4. **Draw budget.** At rest, panning and zooming: at most 30 draw calls, 0 texture uploads in the frame, 0 calls on a second 2D path, rAF script at most 2 ms. A new picture that costs a draw call or an upload at rest is a defect.
5. **Caches are keyed by data:** every input that changes the result, compared on use; never a timer or frame count. Zoom is quantised into buckets so a pan re-keys nothing. A baked asset carries its key in its manifest.
6. **Deferred work runs between frames** in slices of at most 5 ms, uploading what it painted in the same slice.
7. **Boot loads only what the first screen shows.** A scene's assets are fetched when it first shows and decoded off the main thread. No screen is shown low-res and then replaced.
8. **One tool per measurement** (`docs/perf.md`, Tools); a second script for the same number is deleted. A gate exits non-zero on failure and on any console error.

## Method

- Attribute before cutting: the profiler names at least 98% of the frame (`unattributed` under 2%) and every renderer pass and draw-call group. If it does not, fixing the profiler is the task.
- Cut the biggest named cost first, at its cause.
- Price each cut with `tools/perf_pairs.py`: alternated before/after pairs, N>=5, alternating which arm runs first, same seed and scene, arms from separate worktrees of one base. The alternation spreads other jobs' load, never a reservation. Report means, ranges, N and each run's load; a run under heavy load is reported as one, never dropped.
- GPU ms and frame times come only from the game VM or the owner's screen; a software renderer gives counts and ratios. Name each number's renderer. The owner's frame time comes through a playtest card whose `steps` say where to copy the F3 report.
- A sim speedup leaves the bot table identical.
- Sweep every run's console; a run with unexplained errors proves nothing.
- Prove with counts and reports, not shots. A shot only shows that something drawn did or did not change: the same URL and state in both arms, both cited.
- A look or quality cost is a number for the owner to decide, never traded silently. A change that moves a pixel of an approved picture goes as a card.

## Report

Commits; a before/after table in milliseconds with N beside draw calls, uploads, layouts and style recalculations, heap, allocations per frame, long tasks and bundle size from the same runs; what is still unexplained and how large; the next three costs and what would cut each.
