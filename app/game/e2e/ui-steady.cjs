// The interface holds still and answers a second click (src/ui), on seed 7: a HUD button that opens a panel closes it
// when clicked again (the god's corner: stats; the pouch: the grave; the cog: settings); an open menu is not faded in
// again when an in-game hour passes under it; the panels keep the same nodes through the hour.
//   python tools/browser_job.py --build node e2e/ui-steady.cjs
// Exits 1 on a console error or a failed check.
const { launchBrowser, startStatic, collectConsole } = require('./lib/browser.cjs');

const LAYER = (n) => `#ui > .hg > .hg:nth-child(${n}) > .hg-a`;
const GOD = `${LAYER(1)}:nth-child(2) > .hg-hit`;
const POUCH = `${LAYER(1)}:nth-child(3) > .hg-hit`;
const COG = `${LAYER(1)}:nth-child(2) > .hg-hit:last-child`;

(async () => {
  const srv = await startStatic('dist');
  const browser = await launchBrowser();
  const failed = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    const errors = collectConsole(page);
    await page.goto(`${srv.url}/index.html?scene=play&seed=7&mute=1`, { timeout: 120000 });
    await page.waitForFunction(() => window.__hg && document.querySelector('.hg') && window.__hg.app.time > 0.5, null, { timeout: 120000 });
    await page.evaluate(() => {
      const s = window.__hg.state();
      window.__hg.act({ type: 'take', card: s.god.deal[0] });
      window.fades = 0;
      document.addEventListener('animationstart', () => window.fades++, true);
    });
    const slabs = () => page.evaluate(() => document.querySelectorAll('#ui .hgp-slab').length);
    const click = async (sel) => {
      const b = await page.locator(sel).first().boundingBox();
      await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      await page.waitForTimeout(200);
    };
    const check = (what, got, want) => { if (got !== want) failed.push(`${what}: ${got}, wanted ${want}`); console.log(what, got); };

    for (const [name, sel] of [['god corner', GOD], ['pouch', POUCH], ['cog', COG]]) {
      await click(sel);
      check(`${name} opens`, await slabs(), 1);
      await click(sel);
      check(`${name} closes`, await slabs(), 0);
    }

    // an open menu, an hour on: no fade again; an open grave: its nodes stay
    await click(GOD);
    const fades = await page.evaluate(() => window.fades);
    await page.evaluate(() => { window.__hg.ticks(150); });
    await page.waitForTimeout(400);
    check('stats faded again in 3 hours', (await page.evaluate(() => window.fades)) - fades, 0);
    await click(GOD);
    await click(POUCH);
    await page.evaluate(() => { window.slab = document.querySelector('#ui .hgp-slab'); window.__hg.ticks(150); });
    await page.waitForTimeout(400);
    check('grave kept its nodes in 3 hours', await page.evaluate(() => window.slab.isConnected), true);

    failed.push(...errors);
  } finally {
    await browser.close();
    await srv.stop();
  }
  if (failed.length) { console.log(failed.join('\n')); process.exit(1); }
})();
