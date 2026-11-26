// The frame's cost on seed 7, measured on the game's own page (no probe in it): its rAF callbacks timed and the heap's
// growth in them summed over 240 frames, in each state the target names (docs/contracts/perf.md): the mine at rest,
// panning, zooming, and the mine with the Day running. Then the profiled page (`?prof=1`) at rest
// for where the frame goes by function (its probes add their own time and allocation).
//   python tools/browser_job.py --build [OUT=<dir>] node e2e/perf.cjs
// Writes <OUT, default screenshots>/perf.json (`game` by state, the profiler's report and the VM's 1-minute load before
// the run) and perf.txt (the report's text); prints a line per state; exits 1 on a console error. tools/perf_pairs.py
// prices a change with it.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { launchBrowser, startStatic, collectConsole, ROOT } = require('./lib/browser.cjs');

const OUT = path.join(ROOT, process.env.OUT || 'screenshots');
const SETTLE_MS = 8000;
const FRAMES = 240;
const PAGE = 'index.html?scene=play&seed=7&mute=1';
/** the camera's moves while a window is measured: panning sways x, zooming sways the zoom (world units, zoom steps) */
const PAN = 100, ZOOM = 0.5, SWAY_HZ = 0.25;
fs.mkdirSync(OUT, { recursive: true });

/**
 * In the page before it boots: every rAF callback timed, and the heap's growth inside it summed, while `on`; and the
 * GPU's time for the commands each callback issues, one WebGL2 timer query round it (EXT_disjoint_timer_query_webgl2;
 * a query from frame to frame would hold the wait for the display too), read back when the GPU has it. `idle` once no
 * query is in flight.
 */
function timeFrames() {
  const raf = window.requestAnimationFrame.bind(window), mem = performance.memory;
  const w = (window.__rest = { on: false, frames: 0, last: -1, ms: 0, bytes: 0, gcs: 0, sway: null, gpu: null, gpuNs: 0, gpuN: 0, disjoint: 0, idle: true });
  const q = { gl: null, ext: undefined, cur: null, pend: [] };
  /** The finished queries read back; true when the GPU has every one. */
  const harvest = () => {
    if (q.ext === undefined) {
      q.gl = document.getElementById('game').getContext('webgl2');
      q.ext = (q.gl && q.gl.getExtension('EXT_disjoint_timer_query_webgl2')) || null;
      w.gpu = !!q.ext;
    }
    if (!q.ext) return true;
    const gl = q.gl;
    if (gl.getParameter(q.ext.GPU_DISJOINT_EXT)) w.disjoint++;
    while (q.pend.length && gl.getQueryParameter(q.pend[0], gl.QUERY_RESULT_AVAILABLE)) {
      const done = q.pend.shift();
      w.gpuNs += gl.getQueryParameter(done, gl.QUERY_RESULT);
      gl.deleteQuery(done);
    }
    return !q.pend.length;
  };
  window.requestAnimationFrame = (cb) => raf((t) => {
    if (!w.on) {
      if (!w.idle) w.idle = harvest();
      return cb(t);
    }
    if (t !== w.last) {
      w.frames++;
      w.last = t;
      harvest();
      // the camera's move for this frame, before the game's own callback reads it
      if (w.sway) window.__hg.camera(w.sway(t / 1000));
    }
    const gq = q.ext ? q.gl.createQuery() : null;
    if (gq) q.gl.beginQuery(q.ext.TIME_ELAPSED_EXT, gq);
    const h0 = mem.usedJSHeapSize, t0 = performance.now();
    try { cb(t); } finally {
      w.ms += performance.now() - t0;
      const d = mem.usedJSHeapSize - h0;
      if (d >= 0) w.bytes += d; else w.gcs++;
      if (gq) {
        q.gl.endQuery(q.ext.TIME_ELAPSED_EXT);
        q.pend.push(gq);
        w.gpuN++;
        w.idle = false;
      }
    }
  });
}

(async () => {
  const vm = { load1Start: Math.round(os.loadavg()[0] * 100) / 100 };
  const srv = await startStatic('dist');
  const browser = await launchBrowser();
  const errors = [];
  const open = async (url, init) => {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    if (init) await page.addInitScript(init);
    errors.push(collectConsole(page));
    await page.goto(`${srv.url}/${url}`, { timeout: 120000 });
    await page.waitForFunction(() => window.__hg, null, { timeout: 120000 });
    await page.waitForTimeout(SETTLE_MS);
    return page;
  };
  const game = {};
  try {
    const plain = await open(PAGE, timeFrames);
    /** One window of FRAMES frames; `sway` (a function's source, of seconds, giving a camera) moves the camera in it. */
    const measure = async (name, sway) => {
      await plain.evaluate((s) => {
        const w = window.__rest;
        Object.assign(w, { frames: 0, ms: 0, bytes: 0, gcs: 0, gpuNs: 0, gpuN: 0, disjoint: 0, last: -1, sway: s ? new Function('t', `return (${s})(t)`) : null, on: true });
      }, sway ?? null);
      await plain.waitForFunction((n) => window.__rest.frames >= n, FRAMES, { timeout: 120000 });
      await plain.evaluate(() => { const w = window.__rest; w.on = false; w.sway = null; });
      // the last frames' GPU times arrive a few frames later
      await plain.waitForFunction(() => window.__rest.idle, null, { timeout: 10000 });
      const g = await plain.evaluate(() => ({ ...window.__rest }));
      game[name] = { frames: g.frames, cb: g.ms / g.frames, allocKB: g.bytes / 1024 / g.frames, gcs: g.gcs,
        gpu: g.gpu ? g.gpuNs / 1e6 / g.frames : null, queries: g.gpuN, disjoint: g.disjoint };
      const r = game[name];
      console.log(`${name.padEnd(5)} ${r.frames} frames: cb ${r.cb.toFixed(3)} ms, alloc ${r.allocKB.toFixed(1)} KB/f, ${r.gcs} GCs; `
        + `GPU ${r.gpu === null ? 'no timer query' : `${r.gpu.toFixed(3)} ms a frame (${r.queries} queries, ${r.disjoint} disjoint)`}`);
    };
    await measure('rest');
    await measure('pan', `(t) => ({ x: ${PAN} * Math.sin(2 * Math.PI * ${SWAY_HZ} * t), y: 0, zoom: 1 })`);
    await measure('zoom', `(t) => ({ x: 0, y: 0, zoom: 1 + ${ZOOM} * Math.sin(2 * Math.PI * ${SWAY_HZ} * t) })`);
    await plain.evaluate(() => {
      const take = window.__hg.legal().find((a) => a.type === 'take');
      if (!take || !window.__hg.act(take).ok) throw new Error('perf: the starting gift could not be taken');
    });
    await plain.waitForTimeout(2000);
    await measure('day');
    await plain.close();

    const prof = await open(`${PAGE}&prof=1`);
    const r = await prof.evaluate(() => window.__hg.prof());
    const txt = await prof.evaluate(() => window.__hg.profText());
    fs.writeFileSync(path.join(OUT, 'perf.json'), JSON.stringify({ game, ...r, vm }, null, 1));
    fs.writeFileSync(path.join(OUT, 'perf.txt'), txt);
    const f = r.frame;
    console.log(`profiled rest, ${r.frames} frames: cb ${f.cb.toFixed(2)} ms (p95 ${f.cbP95.toFixed(2)}, worst ${f.cbWorst.toFixed(2)}), `
      + `interval ${f.interval.toFixed(2)} ms (${(1000 / f.interval).toFixed(1)} fps), draws ${f.draws}, uploads ${f.uploads}, `
      + `alloc ${f.allocKB === null ? '-' : f.allocKB.toFixed(1)} KB/f, heap ${r.memory.heapMB.toFixed(1)} MB`);
  } finally {
    await browser.close();
    await srv.stop();
  }
  const bad = errors.flat();
  if (bad.length) {
    console.error(bad.join('\n'));
    process.exit(1);
  }
})().catch((e) => { console.error(e); process.exit(1); });
