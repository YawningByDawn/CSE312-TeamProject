// The rebuilt game played whole in the browser: the title, Begin on seed 7, the opening film played out, then the
// decent bot (scripts/bots/play.ts, bundled into the page) acting through window.__hg in the night's turn (the clock plays the day itself),
// to the mine's end.
//   python tools/browser_job.py --build node e2e/rebuild-fullrun.cjs
// Writes screenshots/rbrun-<moment>.png; exits 1 on a console error, a refused action, or a run that does not end.
const path = require('node:path');
const { buildSync } = require('esbuild');
const { launchBrowser, startStatic, collectConsole, ROOT } = require('./lib/browser.cjs');

const OUT = path.join(ROOT, 'screenshots');
const SEED = 7;
const MAX_DAYS = 80;

const bot = buildSync({
  stdin: {
    contents: "import { scripted, dayAct } from './scripts/bots/play'; import { makeSim } from './src/sim'; import { isDay } from './src/content/clock';"
      + " window.__rbBot = { next: scripted('decent'), day: (s, q) => dayAct('decent', s, q), q: makeSim().query, isDay };",
    resolveDir: ROOT, loader: 'ts',
  },
  bundle: true, format: 'iife', platform: 'browser', target: 'es2022', write: false,
}).outputFiles[0].text;

(async () => {
  const srv = await startStatic('dist');
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.addInitScript(bot);
  const errors = collectConsole(page);
  const failed = [];
  const shot = async (name) => {
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, `rbrun-${name}.png`) });
    console.log('shot', name);
  };
  try {
    await page.goto(`${srv.url}/index.html?mute=1`, { timeout: 120000 });
    await page.waitForSelector('.hgp-seed', { timeout: 120000 });
    await page.waitForTimeout(2600);
    await shot('title');
    await page.fill('.hgp-seed', String(SEED));
    // Enter in the seed field begins, wherever the interface's scale puts the word
    await page.press('.hgp-seed', 'Enter');
    await page.waitForFunction(() => window.__hg && window.__hg.state().phase === 'bonus', null, { timeout: 60000 });
    await shot('opening');
    // the opening film plays out on its own clock
    await page.evaluate(() => window.__hg.advance(60));
    await shot('bonus');
    for (let day = 0; day < MAX_DAYS; day++) {
      const r = await page.evaluate(() => {
        const hg = window.__hg, bot = window.__rbBot;
        const refused = [];
        const day0 = bot.q.day(hg.state().tick);
        let stood = 0, standAt = -1;
        // one dawn to the next: the night is the bot's turn (each point spent runs the clock on, then it sleeps), the day is played an hour at a time as the host
        for (let guard = 0; guard < 5000; guard++) {
          const s = hg.state();
          if (s.phase === 'won' || s.phase === 'lost' || bot.q.day(s.tick) !== day0) break;
          if (!s.pending && bot.q.picking(s)) {
            const pick = bot.day(s, bot.q);
            const res = hg.act(pick);
            if (!res.ok) { refused.push(JSON.stringify(pick) + ' ' + res.why.map((w) => w.key).join(',')); break; }
            continue;
          }
          if (!s.pending && s.tick < s.until) {
            // the day: the host acts every tick as the bots' own run does (mines, delivers, swings, marks); the night's actions play in real time
            if (!window.__rbBot.isDay(s.tick)) { hg.advance(30); continue; }
            const a = bot.day(s, bot.q);
            if (a) {
              const res = hg.act(a);
              if (!res.ok) { refused.push(JSON.stringify(a) + ' ' + res.why.map((w) => w.key).join(',')); break; }
            }
            hg.ticks(1);
            continue;
          }
          if (s.tick !== standAt) { standAt = s.tick; stood = 0; }
          let a = bot.next(s, bot.q);
          if (!s.pending && (!a || stood++ >= 24)) a = { type: 'sleep' };
          if (!a) { refused.push('stuck on a choice'); break; }
          const res = hg.act(a);
          if (!res.ok) { refused.push(JSON.stringify(a) + ' ' + res.why.map((w) => w.key).join(',')); break; }
        }
        const s = hg.state();
        return { phase: s.phase, day: bot.q.day(s.tick), level: s.god.level, followers: Object.values(s.people).filter((p) => p.follower).length, refused };
      });
      failed.push(...r.refused.map((x) => `day ${r.day}: refused ${x}`));
      console.log(`day ${r.day}: ${r.phase} L${r.level} ${r.followers} followers`);
      if (day === 3) await shot('mine');
      if (r.phase === 'won' || r.phase === 'lost') {
        await page.evaluate(() => window.__hg.advance(12));
        await shot(`end-${r.phase}`);
        await page.evaluate(() => window.__hg.advance(30));
        await shot(`after-${r.phase}`);
        break;
      }
      if (day === MAX_DAYS - 1) failed.push(`no end by day ${r.day}`);
    }
  } catch (e) {
    failed.push(String(e && e.stack ? e.stack : e));
  } finally {
    await browser.close();
    await srv.stop();
  }
  const bad = [...errors, ...failed];
  console.log(bad.length ? `FAILED\n${bad.join('\n')}` : 'ok: title to the end, no console error, nothing refused');
  process.exit(bad.length ? 1 : 0);
})();
