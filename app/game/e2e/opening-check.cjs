// The opening (src/view/film/opening.ts): Begin on the title plays the video over the canvas, on the film's clock,
// and hands off to the first gameplay view and the starting gift when it ends.
//   python tools/browser_job.py --build node e2e/opening-check.cjs
// Writes screenshots/opening-<s>.png at 1, 4, 7.6 and 9 s after Begin; exits 1 on a failed check or a console error.
const path = require('node:path');
const { launchBrowser, startStatic, collectConsole, ROOT } = require('./lib/browser.cjs');

(async () => {
  const srv = await startStatic('dist');
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errors = collectConsole(page);
  const failed = [];
  const check = (ok, what) => { console.log(`${ok ? 'ok' : 'FAILED'}: ${what}`); if (!ok) failed.push(what); };
  const video = () => page.evaluate(() => { const v = document.querySelector('video'); return { hidden: v.hidden, paused: v.paused, t: v.currentTime, ready: v.readyState }; });
  try {
    await page.goto(`${srv.url}/index.html?mute=1`, { timeout: 120000 });
    await page.waitForSelector('.hgp-seed', { timeout: 120000 });
    await page.waitForFunction(() => document.querySelector('video').readyState >= 3, null, { timeout: 60000 });
    // Enter in the seed field begins, wherever the interface's scale puts the word
    await page.press('.hgp-seed', 'Enter');
    const t0 = Date.now();
    let prev = -1;
    for (const at of [1, 4, 7.6]) {
      await page.waitForTimeout(Math.max(0, at * 1000 - (Date.now() - t0)));
      const v = await video();
      check(!v.hidden && !v.paused && v.t > prev && Math.abs(v.t - at) < 0.6, `at ${at} s the video plays on the film's clock: ${JSON.stringify(v)}`);
      prev = v.t;
      await page.screenshot({ path: path.join(ROOT, 'screenshots', `opening-${at}.png`) });
    }
    await page.waitForTimeout(Math.max(0, 9000 - (Date.now() - t0)));
    const v = await video();
    const phase = await page.evaluate(() => window.__hg.state().phase);
    check(v.hidden && v.paused, `the video is gone after 8 s: ${JSON.stringify(v)}`);
    check(phase === 'bonus', `the starting gift follows (${phase})`);
    await page.screenshot({ path: path.join(ROOT, 'screenshots', 'opening-9.png') });
  } finally {
    await browser.close();
    await srv.stop();
  }
  const bad = [...errors, ...failed];
  console.log(bad.length ? `FAILED\n${bad.join('\n')}` : 'ok: the opening');
  process.exit(bad.length ? 1 : 0);
})();
