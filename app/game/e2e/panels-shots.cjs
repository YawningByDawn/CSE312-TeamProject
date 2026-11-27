// The rebuilt game's panels (src/ui/panels), each reached through window.__hg on seed 7 and shot:
//   python tools/browser_job.py --build node e2e/panels-shots.cjs
// Writes screenshots/panels-<name>.png; exits 1 on a console error or a panel that does not open.
const path = require('node:path');
const { launchBrowser, startStatic, collectConsole, ROOT } = require('./lib/browser.cjs');

const OUT = path.join(ROOT, 'screenshots');
const W = 1600, H = 900;

async function boot(browser, base, query) {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errors = collectConsole(page);
  await page.goto(`${base}/index.html${query}`, { timeout: 120000 });
  await page.waitForFunction(() => window.__hg && document.querySelector('.hg') && window.__hg.app.time > 0.5, null, { timeout: 120000 });
  return { page, errors };
}

(async () => {
  const srv = await startStatic('dist');
  const browser = await launchBrowser();
  const failed = [];
  const shot = async (page, name, sel) => {
    await page.waitForTimeout(400);
    if (sel) await page.waitForSelector(sel, { state: 'attached', timeout: 3000 }).catch(() => failed.push(`${name}: nothing at ${sel}`));
    await page.screenshot({ path: path.join(OUT, `panels-${name}.png`) });
    console.log('shot', name);
  };
  try {
    const t = await boot(browser, srv.url, '?seed=7&mute=1');
    await t.page.waitForTimeout(2600);
    await shot(t.page, 'title', '.hgp-seed');
    const { page, errors } = await boot(browser, srv.url, '?scene=play&seed=7&mute=1');
    const ev = (f, arg) => page.evaluate(f, arg);
    await ev(() => window.__hg.send({ kind: 'focus', focus: { place: 'grave' } }));
    await shot(page, 'grave', '.hgp-slab');
    await ev(() => {
      const s = window.__hg.state();
      const c = Object.values(s.crystals).sort((a, b) => b.mods.length - a.mods.length)[0];
      // a royal stone of faith, so its light and its grade's signs show
      c.grade = 'royal';
      c.affinity = 'faith';
      window.__hg.send({ kind: 'focus', focus: null });
      return c.id;
    }).then(async (id) => {
      await page.waitForTimeout(200);
      await ev((cid) => window.__hg.send({ kind: 'focus', focus: { crystal: cid } }), id);
    });
    await shot(page, 'crystal', '.hgp-slab');
    // paying a miracle: each stone's offered worth, the sum against the stage's price
    // (the hand is laid out again when Nether moves)
    await ev(() => { const s = window.__hg.state(); s.god.hand = ['soothingMurmur', 'marrowFeast']; s.god.nether += 1; window.__hg.send({ kind: 'focus', focus: null }); window.__hg.ticks(1); });
    await page.waitForTimeout(300);
    // a card is played by dragging it onto the field
    const b = await page.locator('.hg-card').first().boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y - 240, { steps: 6 });
    await page.mouse.up();
    await shot(page, 'pay', '.hgp-slab');
    await page.keyboard.press('Escape');
    // a stranger in reach, then one turned
    const who = await ev(() => {
      const s = window.__hg.state();
      const ids = Object.keys(s.people).filter((id) => s.people[id].role && !s.people[id].follower);
      for (let i = 0; i < 40; i++) {
        for (const id of ids) if (window.__hg.act({ type: 'whisper', target: id }).ok) break;
        if (Object.values(s.people).some((p) => p.follower)) break;
        window.__hg.ticks(1200);
      }
      const f = Object.values(s.people).find((p) => p.follower);
      const stranger = window.__hg.legal().find((a) => a.type === 'whisper');
      return { follower: f && f.id, stranger: stranger ? stranger.target : ids[0] };
    });
    // the days run past a dusk: once a frame has opened it, its reveal closed, so the slabs show alone
    await page.waitForTimeout(400);
    await page.keyboard.press('Escape');
    await ev((id) => window.__hg.send({ kind: 'focus', focus: { unit: id } }), who.stranger);
    await shot(page, 'person', '.hgp-slab');
    // the odds' reasons in the tip, held for its details
    await page.keyboard.down('Shift');
    await page.hover('.hgp-odds');
    await shot(page, 'person-odds', '.hg-tip:not([hidden]) .hg-tdim');
    await page.keyboard.up('Shift');
    if (who.follower) {
      await ev((id) => window.__hg.send({ kind: 'focus', focus: { unit: id } }), who.follower);
      await shot(page, 'follower', '.hgp-slab');
    } else failed.push('follower: nobody turned in 40 days');
    await ev(() => window.__hg.send({ kind: 'focus', focus: null }));
    // the picks the clock waits on
    await ev(() => { window.__hg.state().pending = { kind: 'blessing', offers: ['luckyVein', 'gemcutter', 'thirdHand'] }; window.__hg.ticks(1); });
    await shot(page, 'blessing', '.hgp-hov');
    await ev(() => { window.__hg.state().pending = { kind: 'story', story: 'dreamTalker', options: 2, unit: Object.keys(window.__hg.state().people)[0], place: 'heartvein' }; window.__hg.ticks(1); });
    await shot(page, 'story', '.hgp-slab');
    await ev(() => {
      const s = window.__hg.state();
      const c = Object.values(s.crystals).find((x) => x.mods.length > 0);
      s.pending = { kind: 'facet', crystal: c.id, cuts: [c.mods, c.mods.slice(0, 1), c.mods.slice(-1)] };
      window.__hg.ticks(1);
    });
    await shot(page, 'facet', '.hgp-hov');
    await ev(() => { window.__hg.state().pending = null; });
    // dusk: run the clock to it, then the ledger
    await ev(() => {
      const s = window.__hg.state();
      for (const p of Object.values(s.people)) if (p.follower) window.__hg.act({ type: 'setRoutine', unit: p.id, routine: 'offer' });
      // dusk deals the cards: the tick that deals new ones is the next dusk's
      const was = JSON.stringify(s.god.deal);
      for (let i = 0; i < 3000 && (!s.god.deal || JSON.stringify(s.god.deal) === was); i++) window.__hg.ticks(1);
    });
    await shot(page, 'dusk', '.hgp-slab');
    await ev(() => window.__hg.advance(9));
    await shot(page, 'ledger', '.hgp-slab');
    await page.keyboard.press('Escape');
    await ev(() => window.__hg.send({ kind: 'focus', focus: null }));
    await ev(() => { window.__hg.state().pending = null; });
    // the end: a closing card, then a defeat on a fresh run
    await ev(() => { window.__hg.state().phase = 'won'; window.__hg.ticks(1); });
    await shot(page, 'ending', '.hgp-slab');
    await ev(() => window.__hg.send({ kind: 'newRun', seed: 7 }));
    await ev(() => window.__hg.send({ kind: 'skipFilm' }));
    await ev(() => {
      const s = window.__hg.state();
      window.__hg.act({ type: 'take', card: s.god.deal[0] });
      s.god.ichor = 1;
      s.god.hunger = 100;
      for (let i = 0; i < 6000 && s.phase !== 'lost'; i++) window.__hg.ticks(1);
    });
    // the spark still lit, then the words and the way on
    await page.waitForTimeout(2400);
    await shot(page, 'defeat-spark', '.hgp-gutter');
    await page.waitForTimeout(2800);
    await shot(page, 'defeat', '.hgp-seed, .hg-hit');
    for (const e of [...t.errors, ...errors]) failed.push(e);
  } finally {
    await browser.close();
    await srv.stop();
  }
  if (failed.length) {
    console.log('FAILED\n' + failed.join('\n'));
    process.exit(1);
  }
  console.log('ok');
})();
