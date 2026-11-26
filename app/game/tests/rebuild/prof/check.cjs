// The rebuilt game's profiler (src/app/prof) on index.html, in a production build: the game's page loads no probe;
// F3 reloads into the profiled page; with the clock running its report names at least 98% of the callback, its rows sum
// to the callback, the sim's ticks are broken down by function, the heap is exact; Copy report gives the text; F3
// leaves; zero console errors on every page.
//   python tools/browser_job.py --build STATIC=dist node tests/rebuild/prof/check.cjs
// Prints the report; writes screenshots/rebuild-profiler.png and screenshots/rebuild-profiler.txt.
const fs = require('node:fs');
const path = require('node:path');
const { launch, startStatic, collectConsole, ROOT } = require('../../../e2e/lib/browser.cjs');

const URL_PLAY = '/index.html?scene=play&seed=7&mute=1';
/** A probe's name in a script: `fn (dir/file.ts:line)`; only the profiled graph's chunks carry them. */
const PROBE_NAME = /\((?:app|sim|view|ui|audio|content)\/[\w/.]+\.ts:\d+\)/;

(async () => {
  if (!process.env.STATIC) throw new Error('STATIC=<vite build dir> is required');
  const srv = await startStatic(path.resolve(process.env.STATIC));
  const { browser, context, page } = await launch({ width: 2560, height: 1440 });
  let fail = 0;
  const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fail++; };
  const errs = collectConsole(page);
  // every script the page fetched, by URL: its text
  let scripts = [];
  page.on('response', (r) => { if (/\.js$/.test(new URL(r.url()).pathname)) scripts.push(r.text().then((t) => [r.url(), t])); });
  const fetched = async () => { const s = await Promise.all(scripts); scripts = []; return s; };
  // polling by time, not rAF: a waiting rAF callback would be a frame segment of its own
  const wait = (f, arg) => page.waitForFunction(f, arg, { timeout: 600000, polling: 100 });
  const settled = (s) => wait((t) => window.__hg && window.__hg.app.time > t, s);
  try {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: srv.url });
    await page.goto(srv.url + URL_PLAY);
    await settled(1);
    const plain = await fetched();
    ok(plain.length > 0 && plain.every(([, t]) => !PROBE_NAME.test(t)), `the game's page loads no probe (${plain.length} scripts)`);
    ok(await page.evaluate(() => window.__hg.prof === undefined), 'the game page has no report');

    await fetched();
    await page.keyboard.press('F3');
    await page.waitForURL(/[?&]prof=1/, { timeout: 60000 });
    await wait(() => window.__hg && window.__hg.prof);
    const prof = await fetched();
    ok(prof.some(([, t]) => PROBE_NAME.test(t)), `F3 reloads into the profiled page (${prof.length} scripts)`);
    // the run waits on the opening's deal: take a card and the clock runs; then a full window of frames
    const took = await page.evaluate(() => window.__hg.act(window.__hg.legal().find((a) => a.type === 'take' && a.card)).ok);
    ok(took, 'the clock runs (a card of the first deal taken)');
    // the window fills by frames, however long the machine's frames take
    await page.waitForFunction(() => window.__hg.prof().frames >= 240, null, { timeout: 600000, polling: 1000 });
    const { r, txt } = await page.evaluate(() => ({ r: window.__hg.prof(), txt: window.__hg.profText() }));
    console.log(txt);
    fs.mkdirSync(path.join(ROOT, 'screenshots'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'screenshots/rebuild-profiler.txt'), txt);
    const x = r.frame;
    ok(r.frames >= 240, `a full window (${r.frames} frames)`);
    ok(x.attributed >= 98, `named functions hold >= 98% of the callback (${x.attributed.toFixed(2)}%, unattributed ${x.unattributed.toFixed(4)} ms)`);
    const sum = r.functions.reduce((t, f) => t + f.ms, 0) + x.unattributed + x.probes;
    ok(Math.abs(sum - x.cb) <= 0.01 * x.cb + 0.005, `rows sum to the callback (${sum.toFixed(3)} vs ${x.cb.toFixed(3)} ms)`);
    ok(r.tick.perFrame > 0 && r.tick.rows.length >= 3 && r.tick.rows.some((f) => f.name.startsWith('sim.step (')), `sim ticks by function (${r.tick.perFrame.toFixed(2)}/f, ${r.tick.rows.length} rows)`);
    ok(['Pump.frame (', 'Pump.advance (', 'frame ('].every((n) => r.functions.some((f) => f.name.startsWith(n))), 'the pump and the loop are rows');
    ok(r.heapExact && x.allocKB !== null && r.functions.some((f) => f.kb > 0), `allocation by function (${x.allocKB === null ? '-' : x.allocKB.toFixed(1)} KB/f)`);
    ok([x.draws, x.uploads, r.memory.heapMB, r.memory.textureMB].every(Number.isFinite), `gpu and memory lines (${x.draws} draws/f, heap ${r.memory.heapMB.toFixed(1)} MB)`);
    await page.screenshot({ path: path.join(ROOT, 'screenshots/rebuild-profiler.png') });
    await page.click('text=Copy report');
    await wait(() => /copied/.test(document.body.textContent));
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    ok(clip.startsWith('HUNGRY GOD profiler (rebuild)'), `Copy report puts the report on the clipboard (${clip.length} chars)`);
    // the GPU's calls reach the report from any context: one frame of a WebGL2 canvas of its own (3 draws, a 64x64 upload)
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(function glProbe() {
      const gl = document.createElement('canvas').getContext('webgl2');
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 64, 64, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(64 * 64 * 4));
      for (let i = 0; i < 3; i++) gl.drawArrays(gl.TRIANGLES, 0, 3);
      requestAnimationFrame(() => requestAnimationFrame(done));
    })));
    const g = await page.evaluate(() => window.__hg.prof());
    ok(g.frame.draws > 0 && g.frame.uploads > 0 && g.memory.textures >= 1, `GPU draws, uploads and textures counted (${(g.frame.draws * g.frames).toFixed(0)} draws, ${(g.frame.uploadKB * g.frames).toFixed(0)} KB, ${g.memory.textures} textures)`);
    await page.keyboard.press('F3');
    await page.waitForURL((u) => !/[?&]prof=1/.test(u.search), { timeout: 60000 });
    await settled(0.5);
    ok(await page.evaluate(() => window.__hg.prof === undefined), 'F3 leaves the profiler');
  } finally {
    ok(errs.length === 0, `zero console errors (${errs.length})${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
    await browser.close();
    await srv.stop();
  }
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
