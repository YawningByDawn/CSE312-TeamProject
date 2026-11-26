// The hand through the pointer, on seed 7 reached through window.__hg: by day it rests (no card can be pressed, the plate
// says why); at night a card dragged onto the discard zone is discarded, one dragged onto the field is played through the
// pay slab (src/ui/hud/cards.ts).
//   python tools/browser_job.py --build node e2e/cards-night.cjs
// Writes screenshots/cards-night-<name>.png; exits 1 on a console error, a card that stayed in the hand or a day that did not rest it.
const path = require('node:path');
const { launchBrowser, startStatic, collectConsole, ROOT } = require('./lib/browser.cjs');

const OUT = path.join(ROOT, 'screenshots');
const W = 1600, H = 900;

(async () => {
  const srv = await startStatic('dist');
  const browser = await launchBrowser();
  const failed = [];
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    const errors = collectConsole(page);
    await page.goto(`${srv.url}/index.html?scene=play&seed=7&mute=1`, { timeout: 120000 });
    await page.waitForFunction(() => window.__hg && document.querySelector('.hg') && window.__hg.app.time > 0.5, null, { timeout: 120000 });
    const ev = (f, arg) => page.evaluate(f, arg);
    const look = (name) => ev(() => { const s = window.__hg.state(), g = s.god; return { tick: s.tick, until: s.until, phase: s.phase, ap: g.ap, hand: g.hand, deal: g.deal, nether: g.nether, panels: [...document.querySelectorAll('.hgp-slab')].length }; }).then((x) => console.log(name, JSON.stringify(x)));
    const shot = async (name) => {
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(OUT, `cards-night-${name}.png`) });
      console.log('shot', name);
    };
    await look('boot');
    await ev(() => window.__hg.act({ type: 'take', card: window.__hg.state().god.deal[0] }));
    await look('taken');
    await ev(() => window.__hg.ticks(1));
    await page.waitForTimeout(300);
    await shot('day');
    if (!(await page.$('.hg-rest'))) failed.push('day: the hand does not rest');
    const [dx, dy] = await page.$eval('.hg-card', (e) => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    await page.mouse.move(dx, dy);
    await page.mouse.down();
    await page.mouse.move(dx, dy - 200, { steps: 6 });
    if (await page.locator('text=Discard').first().isVisible()) failed.push('day: a drag began');
    await page.mouse.up();
    // play on to the next dusk: the day's host chosen, the day run
    await ev(() => {
      const hg = window.__hg, s = hg.state();
      for (let i = 0; i < 20000 && !(s.tick > 700 && s.god.deal); i++) {
        if (s.pending) { hg.act(s.pending.kind === 'story' ? { type: 'story', option: 1 } : { type: 'pickBlessing', blessing: s.pending.offers[0] }); continue; }
        hg.ticks(1);
      }
    });
    await look('dusk');
    await shot('dusk');
    for (let i = 0; i < 4 && (await page.$('.hgp-slab')); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
    await look('closed');
    await shot('closed');
    await shot('night');
    // the card dragged to `where` (a function of the page once the drag has begun), shot over it, dropped
    const drag = async (name, where) => {
      const [cx, cy] = await page.$eval('.hg-card', (e) => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx - 20, cy - 60, { steps: 4 });
      const to = await where();
      await page.mouse.move(to[0], to[1], { steps: 8 });
      await shot(name);
      await page.mouse.up();
      await page.waitForTimeout(300);
    };
    await drag('drag-discard', async () => { const b = await page.locator('text=Discard').first().boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; });
    await look('discarded');
    if ((await ev(() => window.__hg.state().god.hand.length)) !== 0) failed.push('night: the discard left the card');
    await shot('discarded');
    await ev(() => { const s = window.__hg.state(); s.god.hand.push('soothingMurmur'); window.__hg.show({ kind: 'took', card: 'soothingMurmur', tick: s.tick }); });
    await page.waitForTimeout(300);
    await drag('drag-play', async () => [W * 0.45, H * 0.35]);
    await page.click('text=Pay');
    await page.waitForTimeout(300);
    await look('played');
    await shot('played');
    if ((await ev(() => window.__hg.state().god.hand.length)) !== 0) failed.push('night: the play left the card');
    if (errors.length) failed.push(...errors);
  } finally {
    await browser.close();
    await srv.stop();
  }
  if (failed.length) { console.log(failed.join('\n')); process.exit(1); }
})();
