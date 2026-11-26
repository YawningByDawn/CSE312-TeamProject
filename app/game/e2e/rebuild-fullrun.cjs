// The rebuilt game played whole in the browser: the title, Begin on seed 7, the opening film played out, then the
// decent bot (scripts/bots/play.ts, bundled into the page) acting through window.__hg while the clock runs in ticks,
// through the watershed into Shade and its end.
//   python tools/browser_job.py --build node e2e/rebuild-fullrun.cjs
// Writes screenshots/rbrun-<moment>.png; exits 1 on a console error, a refused action, or a run that does not end.
const path = require('node:path');
const { buildSync } = require('esbuild');
const { launchBrowser, startStatic, collectConsole, ROOT } = require('./lib/browser.cjs');

const OUT = path.join(ROOT, 'screenshots');
const SEED = 7;
const MAX_DAYS = 80;
const BEAT = 25; // ticks between the bot's turns: half an hour of the clock

const bot = buildSync({
  stdin: {
    contents: "import { scripted } from './scripts/bots/play'; import { makeSim } from './src/sim';"
      + " window.__rbBot = { next: scripted('decent'), q: makeSim().query };",
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
    // Begin, where the title shows it at 1600x900 (its hit box is the drawn word, not a laid-out box)
    await page.mouse.click(160, 615);
    await page.waitForFunction(() => window.__hg && window.__hg.state().phase === 'bonus', null, { timeout: 60000 });
    await shot('opening');
    // the opening film plays out on its own clock
    await page.evaluate(() => window.__hg.advance(60));
    await shot('bonus');
    let shade = false;
    for (let day = 0; day < MAX_DAYS; day++) {
      const r = await page.evaluate(({ beat }) => {
        const hg = window.__hg;
        const refused = [];
        for (let k = 0; k < 48; k++) {
          for (let i = 0; i < 24; i++) {
            const s = hg.state();
            if (s.phase !== 'live' && s.phase !== 'bonus') break;
            const a = window.__rbBot.next(s, window.__rbBot.q);
            if (!a) break;
            const res = hg.act(a);
            if (!res.ok) { refused.push(JSON.stringify(a) + ' ' + res.why.map((w) => w.key).join(',')); break; }
          }
          const s = hg.state();
          if (s.phase === 'won' || s.phase === 'lost') break;
          // the real clock's way: films hold it, then it runs on at ten ticks a second
          hg.advance(beat / 10);
        }
        const s = hg.state();
        return { phase: s.phase, stage: s.stage, day: window.__rbBot.q.day(s.tick), level: s.god.level, followers: Object.values(s.people).filter((p) => p.follower).length, refused };
      }, { beat: BEAT });
      failed.push(...r.refused.map((x) => `day ${r.day}: refused ${x}`));
      console.log(`day ${r.day}: ${r.phase} ${r.stage} L${r.level} ${r.followers} followers`);
      if (day === 3) await shot('mine');
      if (r.stage === 'shade' && !shade) {
        shade = true;
        await page.evaluate(() => window.__hg.advance(10));
        await shot('watershed');
        await page.evaluate(() => window.__hg.advance(20));
        await shot('shade');
      }
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
