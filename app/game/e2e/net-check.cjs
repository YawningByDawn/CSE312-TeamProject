// The course framework's login and socket (src/app/net.ts) against stand-ins (Playwright routes `/ws` and the login's
// paths): logged in, it joins, lists who the hub has on, sends a game message as `{type:'game',data}`, hands a relayed
// one to its listeners, reconnects after a drop, and stays off after being kicked. The title's top right corner names
// who `/api/me` says is logged in: it logs out with a POST to `/logout` (and opens no socket after), and in through its popup:
// a refusal shows in the popup, Escape closes it, Register posts to `/register` and then `/login` as JSON, and the page reloads logged in.
//   VITE_HG_NET=/ws npx vite build --outDir dist/net
//   python tools/browser_job.py --ship dist/net node e2e/net-check.cjs
// Exits 1 on a failed check or a console error.
const { launchBrowser, startStatic, collectConsole } = require('./lib/browser.cjs');

(async () => {
  const srv = await startStatic('dist/net');
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = collectConsole(page);
  const hub = { joins: 0, got: [], sockets: [] };
  await page.routeWebSocket(/\/ws$/, (ws) => {
    hub.joins++;
    hub.sockets.push(ws);
    ws.onMessage((m) => {
      hub.got.push(JSON.parse(m));
      ws.send(JSON.stringify({ type: 'game', from: 'bea', data: { back: 1 } }));
    });
    ws.send(JSON.stringify({ type: 'state', players: [{ name: 'ann', x: 0, y: 0 }, { name: 'bea', x: 0, y: 0 }] }));
  });
  const me = { name: 'ann', logouts: 0 };
  await page.route(/\/api\/me$/, (r) => r.fulfill({ json: { username: me.name } }));
  await page.route(/\/logout$/, (r) => {
    me.logouts += r.request().method() === 'POST' ? 1 : 0;
    me.name = null;
    return r.fulfill({ status: 204 });
  });
  const posts = [];
  await page.route(/\/(login|register)$/, (r) => {
    const req = r.request();
    posts.push({ path: new URL(req.url()).pathname, type: req.headers()['content-type'], body: req.postData() });
    if (posts.length === 1) return r.fulfill({ status: 401, json: { error: 'wrong username or password' } });
    me.name = 'ann';
    return r.fulfill({ json: { username: 'ann' } });
  });
  const corner = (text) => page.waitForFunction((t) => [...document.querySelectorAll('.hg-t.hg-hit')].find((e) => e.textContent === t), text, { timeout: 30000 })
    .then((h) => h.asElement().boundingBox(), () => null);
  const failed = [];
  const check = (ok, what) => { console.log(`${ok ? 'ok' : 'FAILED'}: ${what}`); if (!ok) failed.push(what); };
  try {
    await page.goto(`${srv.url}/index.html?mute=1`, { timeout: 120000 });
    await page.waitForFunction(() => window.__hg && window.__hg.net && window.__hg.net.players.length === 2, null, { timeout: 120000 });
    check(true, 'joins the hub and lists who is on');
    const relayed = await page.evaluate(() => new Promise((res) => {
      window.__hg.net.onGame((from, data) => res({ from, data }));
      window.__hg.net.send({ hello: 1 });
    }));
    check(JSON.stringify(hub.got[0]) === '{"type":"game","data":{"hello":1}}', `sends {type:'game',data}: ${JSON.stringify(hub.got[0])}`);
    check(relayed.from === 'bea' && relayed.data.back === 1, `hands a relayed message to its listeners: ${JSON.stringify(relayed)}`);
    await hub.sockets[0].close();
    await page.waitForFunction(() => window.__hg.net.open, null, { timeout: 5000 }).catch(() => {});
    check(hub.joins === 2, `reconnects after a drop (joins ${hub.joins})`);
    hub.sockets[1].send(JSON.stringify({ type: 'kicked' }));
    await hub.sockets[1].close();
    await page.waitForTimeout(2500);
    check(hub.joins === 2 && !(await page.evaluate(() => window.__hg.net.open)), `stays off once kicked (joins ${hub.joins})`);
    const out = await corner('ann · Log out');
    check(out !== null && out.x + out.width > 1280 - 60 && out.x + out.width <= 1280 && out.y >= 0 && out.y < 60, `names who is logged in, top right: ${JSON.stringify(out)}`);
    await page.getByText('ann · Log out').click();
    const back = await corner('Log in');
    check(me.logouts === 1 && back !== null, `logs out with a POST to /logout and shows Log in (${me.logouts} posts)`);
    check(hub.joins === 2, `logged out, opens no socket (joins ${hub.joins})`);
    await page.getByText('Log in').click();
    const dialog = page.getByRole('dialog');
    const field = (name) => dialog.getByLabel(name);
    await field('Username').fill('ann');
    await field('Password').fill('hunter22x');
    await field('Password').press('Enter');
    await dialog.getByText('wrong username or password').waitFor({ timeout: 10000 });
    check(posts.length === 1 && posts[0].path === '/login' && posts[0].type === 'application/json' && posts[0].body === '{"username":"ann","password":"hunter22x"}', `Log in posts JSON to /login and shows its refusal: ${JSON.stringify(posts[0])}`);
    await field('Password').press('Escape');
    check(await dialog.count() === 0, 'Escape closes the popup');
    await page.getByText('Log in').click();
    await dialog.getByText('No account? Register').click();
    await field('Username').fill('ann');
    await field('Password').fill('hunter22x');
    await field('Password').press('Enter');
    const back2 = await corner('ann · Log out');
    check(posts.map((p) => p.path).join() === '/login,/register,/login' && back2 !== null, `Register posts /register then /login and reloads logged in: ${posts.map((p) => p.path)}`);
  } finally {
    await browser.close();
    await srv.stop();
  }
  // the browser logs the stubbed 401 refusal itself
  const bad = [...errors.filter((e) => !/status of 401/.test(e)), ...failed];
  console.log(bad.length ? `FAILED\n${bad.join('\n')}` : 'ok: the multiplayer socket');
  process.exit(bad.length ? 1 : 0);
})();
