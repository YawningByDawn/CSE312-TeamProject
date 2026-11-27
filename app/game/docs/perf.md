# Performance: where the frame goes

This page holds the measured state and every cost above the target. The target and the rules are in `docs/contracts/perf.md`; the one tool per measurement is in Tools below.

## How these numbers are made

- **Machine:** the game VM (6 vCPU, an RTX 3080 through Virtio-GPU Venus, WebGL on Vulkan through ANGLE), at 1600x900, DPR 1, seed 7, on a production build. These are the VM's milliseconds, not the owner's.
- **The VM's present caps its frame rate:** a page that only clears a 2560x1440 WebGL2 canvas each frame runs at 8-9 fps there, and at 60 fps at 1280x720. A run at 2560x1440 shows about 8 fps whatever the game does; its counts (draws, uploads, ms per function) still hold.
- **Command:** `python tools/browser_job.py --build node e2e/perf.cjs`: the game's own page left still 8 s, then its rAF callbacks timed over 240 frames in each state (the camera moved through `__hg.camera` while panning and zooming); then the profiled page (`?prof=1`) at rest, for its report.
- **cb** is the rAF callback mean: the game's CPU work in the frame.
- **GPU** is the GPU's time for the commands the frame's callbacks issue: one WebGL2 timer query (`EXT_disjoint_timer_query_webgl2`) round each callback, summed per frame. A query from frame to frame would hold the wait for the display, about the whole 16.7 ms.

## The frame by state (game VM, N=1, 1600x900, the game's own page)

| state | cb mean ms | GPU ms | alloc KB/f | GCs in 240 frames |
|---|---|---|---|---|
| the mine at rest (the first night, its deal waiting, 8 s on) | 1.65 | 0.79 | 0.0 | 0 |
| panning (x swaying 100 units at 0.25 Hz) | 0.34 | 0.54 | 0.0 | 0 |
| zooming (zoom 0.5 to 1.5 at 0.25 Hz) | 0.77 | 0.92 | 0.0 | 0 |
| the town at rest (zoom 2.2) | 0.19 | 0.54 | 0.0 | 0 |
| the mine with the Day running | 0.39 | 0.53 | 0.0 | 0 |

The profiled page at rest: 59.9 fps, 10 draws and 0 uploads a frame, heap 72 MB, 84 textures (302 MB). Its ms and KB are its probes' as much as the game's: a probe wraps every named function in a call that is never inlined, so numbers crossing it are boxed and allocate. It names where the frame goes; the game's own page gives what the frame costs.

## Named costs above the target

The mine at rest in the first night: the callback takes 1.6 ms (1.64 and 1.67 in two runs), against 0.5 panning, and the profiled page names People.parts, Stamps.flush and createView.frame with about 70 people rigged each frame while the night stands still; rule 1 of `docs/contracts/perf.md` forbids that work. Every other state takes under 1 ms on the CPU and the GPU a frame and nothing is allocated. Not measured: the owner's screen; at 2560x1440 a frame has 2.56 times these pixels, so the GPU's share there is larger.

## Tools

Every browser script runs on the game VM as `python tools/browser_job.py --build [NAME=VALUE]... node e2e/<script>`: `--build` puts a production build of the worktree at `dist/` in the job's copy, each `NAME=VALUE` is the job's environment (paths worktree-relative), and what the job writes under the worktree (`screenshots/`, `OUT=`) comes back.

| Measurement | The one tool |
|---|---|
| Where the frame goes, by function | the profiled page, `index.html?...&prof=1` (F3 on the game's page reloads into it, F3 leaves). `tools/probes.ts` builds a `?prof` copy of every src module with a probe around each named function's body; the game's own modules carry none, so off costs nothing but the entry's one dynamic import (`src/app/boot.ts`). The runtime (`src/app/prof/`) times each rAF callback as a frame segment and credits time between probe edges to the function on top: every named function's self ms, calls, KB and GPU draw calls and uploads, per frame and per sim tick (`sim.step`'s subtree), the work between frames, the call tree; rows, `unattributed` (callback time outside every probe) and `probes` (its own cost) sum to the callback. With the exact heap, alternate blocks of 30 frames read the heap at every edge and give the bytes; only the other frames give the times. The clock steps 0.1 ms with jitter unless the page is cross-origin isolated, so a function's ms is a mean over the 240-frame window. `__hg.prof()` is the report as numbers, `__hg.profText()` the Copy report text |
| The profiler works | `python tools/browser_job.py --build STATIC=dist node tests/rebuild/prof/check.cjs`: the game's page loads no probe, F3 opens the profiled page, named functions hold at least 98% of the callback with the clock running, rows sum to it, ticks break down by function, allocation by function, GPU calls counted, Copy report, F3 leaves, zero console errors |
| The frame's cost by state | `e2e/perf.cjs` (`OUT=<dir>`): the game's own callback ms, allocation and GCs in each state (`game`), the profiler's report at rest and the VM's 1-minute load before the run in `perf.json`, the report's text in `perf.txt`; exits 1 on a console error |
| A change priced before and after | `python tools/perf_pairs.py --pairs N --before <worktree>`: alternated pairs of `e2e/perf.cjs` (this worktree the after arm), each run's VM load beside it, the mean, range and N per metric and arm in `screenshots/pairs/<stamp>/summary.json` |
| Sim speed | `python tools/bots.py -- 200 sensible --fresh --workers=1` prints `N seeds x M bots in S s` |
| Bundle and baked-asset size | `npm run build`, then the sizes in `dist/` without the `.map` files (the page never loads them); the bytes of `assets/` |
| What a drawn thing looks like | `python tools/shot.py`. It proves a picture did or did not change, never a count |
