// rb-life's pieces in the rebuilt game (src/view/life, src/view/film) on seed 7 at 1280x720, reached through the
// debug API alone (window.__hg: act, legal, ticks, advance, show, camera, state):
//   python tools/browser_job.py --build [ONLY=bonus,cards,dusk,dawn,strikes,watershed,tithe,town,ending,lost] node e2e/life-rebuild-shots.cjs
// Each piece prints its name as it begins (a stuck piece is the last named); a renderer crash ends the run naming it.
// The opening's bonus is taken first (its panel covers the middle). A card is put in the hand, the god given the
// means, and played on its first legal target; the clock is ticked to dusk and dawn; each strike grade and a take are
// shown at a digger at their face, who is then picked; the watershed comes at a dawn with the rank and the pit head
// rooted; in the town, a person in each Activity met over a day, and the rain's hoods; the ending once the council
// hall is yours; the defeat drain on a fresh run. A film is stepped by `advance` to each mark. Writes
// screenshots/life/<piece>.png and prints what it could not reach; exits 1 on a console error.
const fs = require('node:fs');
const path = require('node:path');
const { launchBrowser, startStatic, collectConsole, ROOT } = require('./lib/browser.cjs');

const OUT = path.join(ROOT, 'screenshots/life');
const ONLY = (process.env.ONLY || 'bonus,cards,dusk,dawn,strikes,watershed,tithe,town,ending,lost').split(',');
const MAP = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/content/map.json'), 'utf8'));
const MINE = new Set([...fs.readFileSync(path.join(ROOT, 'src/content/world.ts'), 'utf8').matchAll(/^  (\w+): mine\(/gm)].map((m) => m[1]));
const MINE_ROLES = [...fs.readFileSync(path.join(ROOT, 'src/content/roles.ts'), 'utf8').matchAll(/^  (\w+): r\('mine'/gm)].map((m) => m[1]);
const CARDS = [...fs.readFileSync(path.join(ROOT, 'src/content/cards.ts'), 'utf8').matchAll(/^  (\w+): (?:miracle|evil)\(/gm)].map((m) => m[1]);
const GRADES = ['dull', 'clear', 'bright', 'blazing', 'royal', 'impossible'];
const ACTIVITIES = ['walk', 'work', 'eat', 'drink', 'talk', 'pray', 'preach', 'guard', 'search', 'trade', 'wash', 'play', 'idle', 'offer', 'mourn'];
const F = MAP.mine, ORIGIN = { x: F.x + F.w / F.per / 2, y: F.y + F.h / F.per / 2 };
const DAY = 1200, TPH = 50, NIGHT = 21 * TPH;
/** the nearest zoom the town shows whole at (src/view/camera.ts DESCENT) */
const TOWN_NEAR = 1.6;

const areaOf = (place) => (place.startsWith('home:') ? place.split(':')[1] : place);
/** the camera on a place: a mine area close, a town place at `zoom` */
function onPlace(place, zoom = 1.55) {
  const area = areaOf(place);
  const p = MAP.at[place] ?? MAP.at[area];
  if (!p) return null;
  return MINE.has(area) ? { x: F.x + p[0] / F.per - ORIGIN.x, y: F.y + (p[1] - 30) / F.per - ORIGIN.y, zoom: 0.45 } : { x: p[0] - ORIGIN.x, y: p[1] - 10 - ORIGIN.y, zoom };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await startStatic('dist');
  const browser = await launchBrowser();
  const missed = [], errors = [];
  let page, piece = 'boot';
  /** piece `name` wanted: named as it begins */
  const want = (name) => {
    if (!ONLY.includes(name)) return false;
    piece = name;
    console.log('piece', name);
    return true;
  };
  const boot = async () => {
    if (page) await page.close();
    piece = 'boot';
    page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('crash', () => { console.error(`renderer crashed in ${piece}`); process.exit(1); });
    const seen = collectConsole(page);
    // in order among the shots: an error, and Pixi's account of it
    page.on('console', (m) => { if (m.type() === 'error' || m.text().startsWith('PixiJS')) console.log(`console ${m.type()}: ${m.text().slice(0, 400)}`); });
    page.on('close', () => errors.push(...seen));
    await page.goto(`${srv.url}/index.html?scene=play&seed=7&mute=1`, { timeout: 120000 });
    await page.waitForFunction(() => window.__hg && window.__hg.app.time > 1, null, { timeout: 120000 });
  };
  const ev = (f, a) => page.evaluate(f, a);
  const cam = (c) => ev((x) => window.__hg.camera(x), c);
  const shot = async (name) => { await page.screenshot({ path: path.join(OUT, `${name}.png`) }); console.log('shot', name); };
  /** live: shots at real seconds after now */
  const after = async (name, marks) => { let t = 0; for (const [i, s] of marks.entries()) { await page.waitForTimeout((s - t) * 1000); t = s; await shot(`${name}-${i}`); } };
  /** a film just begun, stepped by render time to each mark (seconds into it) */
  const film = async (name, marks) => {
    let t = 0;
    for (const [i, m] of marks.entries()) { await ev((d) => window.__hg.advance(d), m - t); t = m; await page.waitForTimeout(100); await shot(`${name}-${i}`); }
  };
  /** any deal on the table taken and any story answered, so no panel covers the view and nothing holds the clock */
  const clear = () => ev(() => {
    const h = window.__hg;
    for (let i = 0; i < 8; i++) {
      const s = h.state();
      if (s.god.deal && s.god.deal.length) { h.act({ type: 'take', card: s.god.deal[0] }); continue; }
      if (!s.pending) return;
      const a = h.legal().find((x) => ['story', 'answer', 'chooseCut', 'pickBlessing'].includes(x.type));
      if (!a || !h.act(a).ok) return;
    }
  });
  /** the sim run to hour `h` of the day (at least one tick), what it dealt cleared, a dusk's ledger closed (Escape) */
  const toHour = async (h) => {
    const dusk = await ev(([h, DAY, NIGHT, DUSK]) => {
      const now = (window.__hg.state().tick + NIGHT) % DAY, n = ((h - now) % DAY + DAY) % DAY || DAY;
      window.__hg.ticks(n);
      return (((DUSK - now) % DAY + DAY) % DAY || DAY) <= n;
    }, [h * TPH, DAY, NIGHT, 18 * TPH]);
    await clear();
    if (dusk) { await page.waitForTimeout(150); await page.keyboard.press('Escape'); }
  };

  await boot();
  if (want('bonus')) await shot('bonus');
  await clear();
  const grave = onPlace('grave');
  if (want('cards')) {
    // a miracle wants a follower to land on: a few hands of the mine turned
    await ev((mine) => { for (const p of Object.values(window.__hg.state().people).filter((x) => !x.gone && 'place' in x.at && mine.includes(x.at.place)).slice(0, 8)) p.follower = true; }, [...MINE]);
    for (const id of CARDS) {
      const played = await ev((id) => {
        const h = window.__hg, s = h.state();
        s.god.hand = [id];
        s.god.nether = Math.max(s.god.nether, 99);
        s.god.ichor = Math.max(s.god.ichor, 9);
        // royal stones in the grave's pouch to pay a miracle with (copies of a stone the run has)
        const like = Object.values(s.crystals)[0];
        for (let i = 0; like && i < 4; i++) s.crystals[`shot-${id}-${i}`] = { ...like, id: `shot-${id}-${i}`, grade: 'royal', mods: [], odd: null, at: { pouch: true } };
        for (const a of h.legal()) {
          if (a.type !== 'play' || a.card !== id) continue;
          const at = a.target && s.people[a.target] ? ('place' in s.people[a.target].at ? s.people[a.target].at.place : null) : a.target ?? 'grave';
          if (h.act(a).ok) return at ?? 'grave';
        }
        return { why: h.act({ type: 'play', card: id, pay: [] }).why.map((w) => w.key).join(' ') };
      }, id);
      if (typeof played !== 'string') { missed.push(`card ${id}: no legal play (${played.why})`); continue; }
      await cam(onPlace(played) ?? grave);
      await page.waitForTimeout(900);
      await shot(`card-${id}`);
      await page.waitForTimeout(2600);
      await clear();
    }
  }
  if (want('dusk')) {
    await cam({ ...grave, zoom: 0.6 });
    await toHour(18);
    await after('dusk', [0.5, 1.2, 2.0, 2.8]);
    await clear();
  }
  if (want('dawn')) {
    await cam({ x: 0, y: 0, zoom: 1 });
    await toHour(5);
    await after('dawn', [0.6, 1.4, 2.2, 3.0, 3.8]);
    await clear();
  }
  if (want('strikes')) {
    await toHour(9);
    const digger = await ev((mine) => {
      const p = Object.values(window.__hg.state().people).find((x) => !x.gone && x.role === 'digger' && 'place' in x.at && x.at.doing === 'dig' && mine.includes(x.at.place));
      return p ? { id: p.id, place: p.at.place } : null;
    }, [...MINE]);
    if (!digger) missed.push('strikes: no digger at a face at 9');
    else {
      await cam({ ...onPlace(digger.place), zoom: 0.15 });
      await page.waitForTimeout(600);
      for (const [g, grade] of GRADES.entries()) {
        await ev(([d, grade]) => window.__hg.show({ kind: 'strike', unit: d.id, place: d.place, crystal: null, grade, oneIn: 1 }), [digger, grade]);
        await after(`strike${g}`, [0.3, 0.9]);
        await page.waitForTimeout(1500);
      }
      await ev((d) => window.__hg.send({ kind: 'focus', focus: { unit: d.id } }), digger);
      await page.waitForTimeout(500);
      await shot('picked');
      await ev(() => window.__hg.send({ kind: 'focus', focus: null }));
      // a find of 1 in 10,000: the take's film
      await ev((d) => window.__hg.show({ kind: 'strike', unit: d.id, place: d.place, crystal: null, grade: 'royal', oneIn: 20000 }), digger);
      await film('take', [0, 0.8, 1.6, 2.4, 3.2]);
    }
  }
  let shade = false;
  if (['watershed', 'tithe', 'town', 'ending'].some((x) => ONLY.includes(x))) {
    // past dusk first, so no ledger is up (nor Escape pressed) while the film plays
    await toHour(19);
    await cam({ ...grave, zoom: 0.8 });
    await ev(() => { const s = window.__hg.state(); s.god.level = Math.max(s.god.level, 9); s.flags.surfaceRooted = true; });
    await toHour(5);
    shade = await ev(() => window.__hg.state().stage === 'shade');
    if (!shade) missed.push('watershed: the stage did not turn at dawn');
    else if (want('watershed')) await film('watershed', [0, 5.5, 11, 16.5, 22]);
    else await ev(() => window.__hg.send({ kind: 'skipFilm' }));
    await clear();
  }
  if (shade && want('tithe')) {
    // a follower in the town carries the tithe home at shift end
    const who = await ev(() => {
      const s = window.__hg.state();
      const p = Object.values(s.people).find((x) => !x.gone && x.home && !x.home.startsWith('home:bunks') && 'place' in x.at && !['grave', 'bunks'].includes(x.home));
      if (p) p.follower = true;
      return p ? p.work : null;
    });
    if (!who) missed.push('tithe: no townsperson to turn');
    else {
      await cam({ x: 0, y: 0, zoom: 1.4 });
      await toHour(17);
      await after('tithe', [0.4, 1.0, 1.6]);
    }
  }
  if (shade && want('town')) {
    // a townsperson in each Activity, met over a day, close
    const left = new Set(ACTIVITIES);
    for (const h of [7, 9, 11, 13, 15, 17, 19, 21]) {
      await toHour(h);
      const met = await ev(([left, mine, mineRoles]) => Object.values(window.__hg.state().people)
        .filter((x) => !x.gone && 'place' in x.at && left.includes(x.at.doing) && !x.at.place.startsWith('home:') && !mine.includes(x.at.place) && !mineRoles.includes(x.role))
        .map((x) => ({ doing: x.at.doing, place: x.at.place, role: x.role })), [[...left], [...MINE], MINE_ROLES]);
      for (const m of met) {
        if (!left.has(m.doing)) continue;
        left.delete(m.doing);
        await cam(onPlace(m.place, TOWN_NEAR));
        await page.waitForTimeout(700);
        await shot(`town-${m.doing}-${m.role}`);
      }
      // a walker: anyone on a route through the town
      if (left.has('walk')) {
        const w = await ev((mine) => {
          const p = Object.values(window.__hg.state().people).find((x) => !x.gone && 'route' in x.at && x.at.route.some((r) => !mine.includes(r) && !r.startsWith('home:')));
          return p ? p.at.route.find((r) => !mine.includes(r) && !r.startsWith('home:')) : null;
        }, [...MINE]);
        if (w) { left.delete('walk'); await cam(onPlace(w, TOWN_NEAR)); await page.waitForTimeout(700); await shot('town-walk'); }
      }
    }
    for (const a of left) missed.push(`town: nobody met at ${a}`);
    // the rain: the hooded looks' hoods up
    await toHour(11);
    await ev(() => { window.__hg.state().weather = 'rain'; });
    await cam(onPlace('market', TOWN_NEAR));
    await page.waitForTimeout(900);
    await shot('town-rain');
  }
  if (shade && want('ending')) {
    // the council hall yours: its master and its hands turned, the vault opened
    const ok = await ev(() => {
      const h = window.__hg, s = h.state();
      for (const p of Object.values(s.people)) if (!p.gone && (p.masterOf.includes('councilhall') || p.work === 'councilhall')) p.follower = true;
      return h.act({ type: 'openVault' }).ok;
    });
    if (!ok) missed.push('ending: the vault would not open');
    else await film('ending', [0, 4, 8, 12, 16, 20, 25, 30, 33.5]);
  }
  if (want('lost')) {
    await boot();
    await clear();
    // past dusk first: the dawn that loses the run crosses no ledger
    await toHour(19);
    await cam({ ...grave, zoom: 1 });
    // starving with a last spark of ichor and nobody to eat at dawn, the god eats itself
    await ev(() => { const s = window.__hg.state(); s.god.hunger = 100; s.god.ichor = 1; for (const p of Object.values(s.people)) p.follower = false; });
    await toHour(5);
    if (await ev(() => window.__hg.state().phase !== 'lost')) missed.push('lost: the god did not starve at dawn');
    else await after('lost', [0.5, 1.5, 2.5, 3.6, 5, 6.5, 7.5]);
  }
  await page.close();
  for (const m of missed) console.log('missed:', m);
  await browser.close();
  srv.close?.();
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });
