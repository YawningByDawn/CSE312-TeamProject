// Drives headless Chromium over the game, on the game VM. Only tools/shot.py starts it (through tools/browser_job.py):
//   node tools/shot-driver.cjs '<job json>'     (cwd: the job's copy of the worktree)
// job: { shots: [{url, file}], width, height, settleMs, waitFor, waitForMs, dev, result }. Serves the build at dist/ (dev:
// the vite dev server over the worktree), writes each shot's PNG at its worktree-relative file and the result JSON at
// `result`: { shots: [{ url, file, errors: [...], ms: { boot, settle, capture } }] } (boot: load and --wait-for; a phase that
// failed is absent). Always closes the browser and the server.
const fs = require('node:fs');
const path = require('node:path');
const { launchBrowser, startServer, startStatic } = require('../e2e/lib/browser.cjs');

async function main() {
  const job = JSON.parse(process.argv[2]);
  const srv = job.dev ? await startServer() : await startStatic('dist');
  const browser = await launchBrowser();
  const out = [];
  try {
    for (const s of job.shots) {
      const errors = [];
      const ms = {};
      let t = Date.now();
      const lap = (k) => { const now = Date.now(); ms[k] = now - t; t = now; };
      const page = await browser.newPage({ viewport: { width: job.width, height: job.height } });
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('pageerror', (e) => errors.push('PAGEERR ' + e.message));
      try {
        await page.goto(srv.url + s.url, { timeout: 120000 });
        // the game boots after the page's load event (src/app/boot.ts imports it): it is up once `__hg.app` is
        if (!job.dev) await page.waitForFunction(() => window.__hg && window.__hg.app, null, { timeout: job.waitForMs });
        if (job.waitFor) await page.waitForFunction(job.waitFor, null, { timeout: job.waitForMs });
        lap('boot');
        // the settle is GAME time (`__hg.app.time`, seconds): the app steps at most 50 ms a frame, so on a slow renderer
        // game time trails the wall clock and a wall-clock settle catches the world mid-reveal
        if (job.dev) {
          await page.waitForTimeout(job.settleMs); // a dev page is not the game: no game clock
        } else {
          const t0 = await page.evaluate(() => window.__hg.app.time);
          await page.waitForFunction((t) => window.__hg.app.time >= t, t0 + job.settleMs / 1000, { timeout: job.waitForMs, polling: 100 });
        }
        lap('settle');
        fs.mkdirSync(path.dirname(s.file), { recursive: true });
        await page.screenshot({ path: s.file });
        lap('capture');
      } catch (e) {
        errors.push('DRIVER ' + e.message);
      }
      await page.close();
      out.push({ url: s.url, file: s.file, errors, ms });
    }
  } finally {
    await browser.close();
    await srv.stop();
  }
  fs.mkdirSync(path.dirname(job.result), { recursive: true });
  fs.writeFileSync(job.result, JSON.stringify({ shots: out }) + '\n');
}

main().catch((e) => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(2); });
