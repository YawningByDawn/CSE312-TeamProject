// The rebuilt game's interface at rest and its menus (src/ui), on seed 7 at three screen sizes, each reached through
// window.__hg and shot; at each shot no two boxes of the rest layout overlap and none leaves the screen.
//   python tools/browser_job.py --build node e2e/hud-rebuild-shots.cjs
// Writes screenshots/hud-<size>-<name>.png; exits 1 on a console error, an overlap, a box off screen, or a missing part.
const path = require('node:path');
const { launchBrowser, startStatic, collectConsole, ROOT } = require('./lib/browser.cjs');

const OUT = path.join(ROOT, 'screenshots');
const SIZES = [[1280, 720], [1600, 900], [2560, 1440]];

/** The rest layout's boxes (each anchor's parts, the hand's cards): overlapping pairs and boxes off the screen. */
const LAYOUT = () => {
  const rest = document.querySelector('#ui > .hg > .hg');
  const boxes = [...rest.querySelectorAll(':scope > .hg-a > *, .hg-card')].map((e, i) => {
    const r = e.getBoundingClientRect();
    return { n: `${i}:${e.textContent.trim().slice(0, 24)}`, l: r.left, t: r.top, r: r.right, b: r.bottom, card: e.matches('.hg-card, .hg-deck'), on: r.width > 0 && r.height > 0 && !e.closest('[hidden]') };
  }).filter((b) => b.on);
  const out = [];
  for (const b of boxes) if (b.l < -1 || b.t < -1 || b.r > innerWidth + 1 || b.b > innerHeight + 1) out.push(`off screen: ${b.n}`);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    if (a.card && b.card) continue;
    const ox = Math.min(a.r, b.r) - Math.max(a.l, b.l), oy = Math.min(a.b, b.b) - Math.max(a.t, b.t);
    if (ox > 2 && oy > 2) out.push(`overlap: ${a.n} x ${b.n}`);
  }
  return out;
};

(async () => {
  const srv = await startStatic('dist');
  const browser = await launchBrowser();
  const failed = [];
  try {
    for (const [W, H] of SIZES) {
      const page = await browser.newPage({ viewport: { width: W, height: H } });
      const errors = collectConsole(page);
      await page.goto(`${srv.url}/index.html?scene=play&seed=7&mute=1`, { timeout: 120000 });
      await page.waitForFunction(() => window.__hg && document.querySelector('.hg') && window.__hg.app.time > 0.5, null, { timeout: 120000 });
      const ev = (f, arg) => page.evaluate(f, arg);
      const shot = async (name, sel, layout = true) => {
        await page.waitForTimeout(700);
        if (sel && !(await page.$(sel))) failed.push(`${W}x${H} ${name}: nothing at ${sel}`);
        if (layout) for (const f of await ev(LAYOUT)) failed.push(`${W}x${H} ${name}: ${f}`);
        await page.screenshot({ path: path.join(OUT, `hud-${W}x${H}-${name}.png`) });
        console.log('shot', W, H, name);
      };
      await ev(() => {
        const s = window.__hg.state();
        window.__hg.act({ type: 'take', card: s.god.deal[0] });
        // to the day's second hour of shift
        for (let i = 0; i < 3000 && Math.floor(((s.tick + 1050) % 1200) / 50) !== 8; i++) window.__hg.ticks(1);
        s.god.hand = ['soothingMurmur', 'devour', 'crystalBloom', 'terrorize'];
        s.god.malice = 65;
      });
      await shot('day', '.hg-card');
      await page.hover('.hg-card:nth-child(2)');
      await shot('hand-hover', '.hg-card:hover', false);
      // its tip: two lines, then its details while Shift is held
      await page.keyboard.down('Shift');
      await page.hover('.hg-card:nth-child(3)');
      await shot('tip-details', '.hg-tip:not([hidden]) .hg-tdim', false);
      await page.keyboard.up('Shift');
      // a card dragged over the field, then dropped back on the hand: nothing is played
      const [cx, cy] = await page.$eval('.hg-card:nth-child(2)', (e) => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(W * 0.45, H * 0.35, { steps: 8 });
      await shot('hand-field', null, false);
      // a drag owns the pointer: no tip over anything while it is held
      if (await page.$('.hg-tip:not([hidden])')) failed.push(`${W}x${H} hand-field: a tip shows during the drag`);
      await page.mouse.move(cx, cy, { steps: 8 });
      await page.mouse.up();
      await shot('hand-back', '.hg-card:nth-child(4)', false);
      if (await page.$('.hgp-slab')) failed.push(`${W}x${H} hand-back: a card dropped on the hand was played`);
      // dragged over the discard zone at the right edge it lights it; the drop there discards it
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      // at the zone's foot, so its word shows over the card (design px from the bottom-right margin, at the ui's scale)
      const k = Math.min(W / 1600, H / 900);
      await page.mouse.move(W - 24 - 95 * k, H - 24 - 176 * k, { steps: 8 });
      await shot('hand-drag', null, false);
      if (await page.$('.hg-tip:not([hidden])')) failed.push(`${W}x${H} hand-drag: a tip shows during the drag`);
      await page.mouse.up();
      await page.waitForFunction(() => window.__hg.state().god.hand.length === 3, null, { timeout: 5000 })
        .catch(() => failed.push(`${W}x${H} hand-drag: the drop discarded nothing`));
      await page.mouse.move(W / 2, 40);
      await ev(() => { const s = window.__hg.state(); s.god.played = 1; s.god.nether = 3; window.__hg.ticks(1); });
      await shot('hand-fee', '.hg-rest');
      await ev(() => {
        const s = window.__hg.state();
        s.god.played = 0;
        s.threats.push({ id: 'shot1', faction: 'council', kind: 'inspection', target: 'heartvein', lands: s.tick + 160, walkers: [] });
        window.__hg.ticks(1);
      });
      await shot('warning', null);
      // the warning and a hint at the largest interface size (every hint taught again)
      await ev(() => window.__hg.send({ kind: 'settings', patch: { uiSize: 'large', seenHints: [] } }));
      await page.waitForTimeout(600);
      await shot('large-hint', '.hg-a > .hgp-in');
      await ev(() => window.__hg.send({ kind: 'settings', patch: { uiSize: 'medium' } }));
      for (const menu of ['stats', 'people', 'settings']) {
        await ev((m) => window.__hg.send({ kind: 'menu', menu: m }), menu);
        await shot(`menu-${menu}`, '.hgp-slab');
      }
      await ev(() => window.__hg.send({ kind: 'menu', menu: null }));
      await page.click('text=Reach the surface');
      await shot('goal-click', null);
      await ev(() => window.__hg.send({ kind: 'focus', focus: null }));
      await ev(() => {
        const s = window.__hg.state();
        s.god.played = 0;
        for (let i = 0; i < 3000 && Math.floor(((s.tick + 1050) % 1200) / 50) !== 23; i++) window.__hg.ticks(1);
        s.god.deal = null;
      });
      // the dusk panels close
      await page.waitForTimeout(500);
      for (let i = 0; i < 4 && (await page.$('.hgp-slab')); i++) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
      await shot('night', null);
      await ev(() => { const s = window.__hg.state(); s.god.deal = ['veinSight', 'sabotage', 'marrowFeast']; s.god.rerolls = 1; window.__hg.ticks(1); });
      await shot('deal', '.hg-big', false);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(600);
      if (await ev(() => window.__hg.state().god.deal !== null)) failed.push(`${W}x${H}: Escape did not decline the deal`);
      await ev(() => { const s = window.__hg.state(); s.god.hand.push('mend'); s.god.deal = ['veinSight', 'sabotage', 'marrowFeast']; window.__hg.ticks(1); });
      await shot('deal-full', '.hg-big', false);
      for (const e of errors) failed.push(`${W}x${H} ${e}`);
      await page.close();
    }
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
