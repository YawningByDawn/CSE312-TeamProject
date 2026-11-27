// The course framework's login and socket (src/app/net.ts) against stand-ins (Playwright routes `/ws` and the login's
// paths): logged in, it joins, lists who the hub has on, sends a game message as `{type:'game',data}`, hands a relayed
// one to its listeners, reconnects after a drop, and stays off after being kicked. The title's top right corner names
// who `/api/me` says is logged in: it logs out with a POST to `/logout` (and opens no socket after), and in through its popup:
// a refusal shows in the popup, Escape closes it, Register posts to `/register` and then `/login` as JSON, and the page reloads logged in.
// The title's Multiplayer swaps its menu for Host, Search and Back, against a stub hub that speaks the lobby protocol (docs in README):
// Search's scrollable list centred on the screen with Back, Refresh and Join (dim until a lobby is picked) in a row at the bottom, a full lobby's refusal,
// the lobby the player is in, centred, with Back and Start (dim unless the host's) at the bottom; logged out, Multiplayer opens the login popup. Shots: screenshots/lobby-*.png.
//   VITE_HG_NET=/ws npx vite build --outDir dist/net
//   python tools/browser_job.py --ship dist/net node e2e/net-check.cjs
// Exits 1 on a failed check or a console error.
const path = require('node:path');
const { launchBrowser, startStatic, collectConsole, ROOT } = require('./lib/browser.cjs');

(async () => {
  const srv = await startStatic('dist/net');
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = collectConsole(page);
  const hub = { joins: 0, got: [], sockets: [], cyOpen: true };
  // the open lobbies as the hub lists them; `cy`'s is stale (it fills before anyone joins)
  const lobby = (host, members) => ({ host, name: `${host}'s lobby`, members, max: 4 });
  const open = () => ['bea', 'cy', 'dov', 'eli', 'fay', 'gus', 'hal', 'ivy'].filter((h) => h !== 'cy' || hub.cyOpen).map((h) => lobby(h, h === 'cy' ? ['cy', 'x', 'y'] : [h]));
  await page.routeWebSocket(/\/ws$/, (ws) => {
    hub.joins++;
    hub.sockets.push(ws);
    ws.onMessage((m) => {
      const msg = JSON.parse(m);
      hub.got.push(msg);
      const say = (o) => ws.send(JSON.stringify(o));
      if (msg.type === 'game') say({ type: 'game', from: 'bea', data: { back: 1 } });
      else if (msg.type === 'search') say({ type: 'lobbies', lobbies: open() });
      else if (msg.type === 'host') say({ type: 'lobby', lobby: lobby('ann', ['ann']) });
      else if (msg.type === 'leave') say({ type: 'lobby', lobby: null });
      else if (msg.type === 'start') say({ type: 'start' });
      else if (msg.type === 'join' && msg.host === 'cy') {
        hub.cyOpen = false;
        say({ type: 'lobbies', lobbies: open(), refused: 'full' });
      } else if (msg.type === 'join') say({ type: 'lobby', lobby: lobby(msg.host, [msg.host, 'ann']) });
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
    // the lobby screens, in the title's own menu
    const shot = (name) => page.screenshot({ path: path.join(ROOT, 'screenshots', `lobby-${name}.png`) });
    const text = (word) => page.getByText(word, { exact: true });
    const sent = () => hub.got.slice(1).map((m) => m.type + (m.host ? `:${m.host}` : '')).join();
    const dim = (word) => text(word).evaluate((e) => e.parentElement.classList.contains('hgp-off'));
    await text('Single player').waitFor({ timeout: 30000 });
    await page.waitForTimeout(2600);
    await shot('title');
    await text('Multiplayer').click();
    await text('Host').waitFor({ timeout: 10000 });
    check(await text('Search').count() === 1 && await text('Back').count() === 1 && await text('Single player').count() === 0 && await page.getByRole('dialog').count() === 0,
      'Multiplayer swaps the menu for Host, Search and Back, with no popup');
    await shot('choose');
    await text('Back').click();
    await text('Single player').waitFor({ timeout: 10000 });
    await text('Multiplayer').click();
    await text('Search').click();
    await text("bea's lobby").waitFor({ timeout: 10000 });
    const list = await page.evaluate(() => {
      const l = [...document.querySelectorAll('div')].find((d) => getComputedStyle(d).overflowY === 'auto' && d.scrollHeight > d.clientHeight);
      if (!l) return null;
      const r = l.parentElement.getBoundingClientRect();
      l.scrollTop = 9999;
      const at = l.scrollTop;
      l.scrollTop = 0;
      return { x: r.x, y: r.y, bottom: r.bottom, w: r.width, h: r.height, scrolled: at };
    });
    const backBox = await text('Back').boundingBox(), refresh = await text('Refresh').boundingBox();
    check(list !== null && list.scrolled > 0, `Search: the list scrolls (${JSON.stringify(list)})`);
    check(Math.abs(list.x + list.w / 2 - 640) < 3 && Math.abs(list.y + list.h / 2 - 360) < 3, `Search: the list is centred on the screen: ${JSON.stringify(list)}`);
    check(backBox.y > list.bottom && Math.abs(backBox.y - refresh.y) < 3, `Search: Back and Refresh share the bottom row: ${JSON.stringify([backBox, refresh])}`);
    check(await dim('Join'), 'Search: Join is dim until a lobby is picked');
    await shot('search');
    await text('Refresh').click();
    await text("cy's lobby").click();
    check(!(await dim('Join')), 'Search: Join lights once a lobby is picked');
    await shot('picked');
    await text('Join').click();
    await text('That lobby is full.').waitFor({ timeout: 10000 });
    check(!(await text("cy's lobby").count()) && (await dim('Join')), 'a full lobby refuses, leaves the list and dims Join');
    await shot('refused');
    await text("bea's lobby").click();
    await text('Join').click();
    await text('Players 2/4').waitFor({ timeout: 10000 });
    check(await text('ann').count() === 1 && await text('bea').count() === 1, 'joining shows the lobby and its members');
    check(await dim('Start') && await text('Waiting for the host to start.').count() === 1, 'a member who is not the host has Start dim, and the waiting line');
    await shot('room');
    await text('Back').click();
    await text('Refresh').waitFor({ timeout: 10000 });
    await text('Back').click();
    await text('Host').click();
    await text("ann's lobby").waitFor({ timeout: 10000 });
    check(await text('host').count() === 1 && !(await dim('Start')), "hosting names the lobby \"<host>'s lobby\" and gives the host a live Start");
    await shot('host');
    await text('Start').click();
    await text('The host started the game. Playing together is not built yet.').waitFor({ timeout: 10000 });
    check(await dim('Start'), 'Start reaches the members, and is spent');
    await page.keyboard.press('Escape');
    await text('Host').waitFor({ timeout: 10000 });
    await page.keyboard.press('Escape');
    await text('Single player').waitFor({ timeout: 10000 });
    check(true, 'Escape leaves the lobby, then goes back to the main entries');
    check(sent() === 'search,search,join:cy,join:bea,leave,host,start,leave', `the hub heard: ${sent()}`);
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
    await page.getByText('Multiplayer', { exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Username').waitFor({ timeout: 10000 });
    check(await dialog.getByText('Host').count() === 0, 'logged out, Multiplayer opens the login popup');
    await page.keyboard.press('Escape');
    await page.getByText('Log in').click();
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
