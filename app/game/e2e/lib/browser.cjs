// Shared Playwright helpers. Playwright is global (NODE_PATH=/usr/local/lib/node_modules_global).
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

/**
 * The one place a browser starts: headless chromium on the game VM's GPU (WebGL on Vulkan through ANGLE: the VM's
 * Virtio-GPU Venus), only inside a job that tools/browser_job.py runs there (gamejob.py sets GAMEJOB_OUT); anywhere else it
 * throws. The JS heap reads exact (`performance.memory`: the profiler's heap per stage).
 */
async function launchBrowser() {
  if (!process.env.GAMEJOB_OUT) throw new Error('a browser runs only on the game VM: python tools/browser_job.py <command>');
  const { chromium } = require('playwright');
  return chromium.launch({
    headless: true,
    args: ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu',
      '--autoplay-policy=no-user-gesture-required', '--enable-precise-memory-info'],
  });
}

/** launchBrowser, then one context and page. Returns { browser, context, page }. */
async function launch(opts = {}) {
  const dsf = opts.deviceScaleFactor || 1;
  const browser = await launchBrowser();
  const context = await browser.newContext({
    viewport: { width: opts.width || 1600, height: opts.height || 900 },
    deviceScaleFactor: dsf,
  });
  const page = await context.newPage();
  return { browser, context, page };
}

function ping(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => { res.resume(); resolve(res.statusCode >= 200 && res.statusCode < 500); });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => { req.destroy(); resolve(false); });
  });
}

/** Resolves true if nothing is bound to 127.0.0.1:port. */
function portIsFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, '127.0.0.1');
  });
}

function groupAlive(pid) {
  try { process.kill(-pid, 0); return true; } catch { return false; }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * The port a job's server binds: GAMEJOB_PORT (a base unique among the running jobs; gamejob.py sets it) plus `offset`,
 * which is under GAMEJOB_PORTS (the job may bind that many ports from its base). Every server of every job binds through here.
 */
function jobPort(offset = 0) {
  const base = Number(process.env.GAMEJOB_PORT);
  const count = Number(process.env.GAMEJOB_PORTS);
  if (!Number.isInteger(base) || base <= 0 || !Number.isInteger(count) || count <= 0) {
    throw new Error(`GAMEJOB_PORT=${process.env.GAMEJOB_PORT} GAMEJOB_PORTS=${process.env.GAMEJOB_PORTS}: a server runs only in a game VM job (python tools/browser_job.py)`);
  }
  if (!Number.isInteger(offset) || offset < 0 || offset >= count) throw new Error(`port offset ${offset}: not an integer in 0..${count - 1} (GAMEJOB_PORTS)`);
  return base + offset;
}

/**
 * Spawn the vite dev server and wait until it answers, on `jobPort(offset)`.
 * Throws if the port is already taken (never talks to a foreign server). Returns { url, stop() };
 * stop() returns a Promise resolving once the vite process group is gone (SIGKILL after ~2 s),
 * and is safe to call without awaiting and safe to call twice. The process group is also killed
 * on process exit / SIGINT / SIGTERM.
 */
async function startServer(offset = 0) {
  const port = jobPort(offset);
  const url = `http://127.0.0.1:${port}`;
  if (!(await portIsFree(port))) {
    throw new Error(`startServer: port ${port} is already in use; refusing to use a foreign server`);
  }
  const child = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  let exited = false;
  child.on('exit', () => { exited = true; });
  child.on('error', (e) => { log += 'spawn error: ' + e.message + '\n'; exited = true; });

  const killGroup = (sig) => { try { process.kill(-child.pid, sig); } catch {} };

  const onExit = () => killGroup('SIGKILL');
  const sigHandlers = {};
  for (const sig of ['SIGINT', 'SIGTERM']) {
    sigHandlers[sig] = () => {
      killGroup('SIGKILL');
      detach();
      // Re-raise so the default action (or the caller's own handlers) still applies.
      if (process.listenerCount(sig) === 0) process.kill(process.pid, sig);
    };
  }
  let detached = false;
  function detach() {
    if (detached) return;
    detached = true;
    process.removeListener('exit', onExit);
    for (const sig of Object.keys(sigHandlers)) process.removeListener(sig, sigHandlers[sig]);
  }
  process.on('exit', onExit);
  for (const sig of Object.keys(sigHandlers)) process.on(sig, sigHandlers[sig]);

  let stopping = null;
  function stop() {
    if (stopping) return stopping;
    detach();
    stopping = (async () => {
      killGroup('SIGTERM');
      const t0 = Date.now();
      let killed = false;
      while (groupAlive(child.pid)) {
        if (!killed && Date.now() - t0 > 2000) { killGroup('SIGKILL'); killed = true; }
        if (Date.now() - t0 > 5000) break;
        await sleep(40);
      }
    })();
    return stopping;
  }

  const fail = async (msg) => { await stop(); throw new Error(msg + ':\n' + log); };

  const deadline = Date.now() + 30000;
  let up = false;
  while (Date.now() < deadline) {
    if (exited) await fail('vite exited early');
    if (await ping(url + '/')) { up = true; break; }
    await sleep(150);
  }
  if (!up) await fail('vite did not start in time');
  // A response only counts if it came from the child we spawned.
  if (exited || child.exitCode !== null) await fail('vite exited before it could be used (something else may own the port)');
  return { url, stop };
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.webp': 'image/webp', '.bin': 'application/octet-stream', '.txt': 'text/plain' };
/** Serve a `vite build` directory on 127.0.0.1:`jobPort(offset)` in this process (a missing path answers 404). Returns { url, stop() }. */
function startStatic(dir, offset = 0) {
  const port = jobPort(offset);
  const root = path.resolve(dir);
  // a build that is not there serves 404s, and the page then waits on a game that never boots: fail here instead
  if (!fs.existsSync(path.join(root, 'index.html'))) throw new Error(`startStatic: no build at ${root} (index.html missing; a job that serves dist/ runs with --build)`);
  return new Promise((res) => {
    const srv = http.createServer((q, r) => {
      let f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
      if (f.endsWith('/')) f += 'index.html';
      if (!f.startsWith(root)) { r.writeHead(404); r.end(); return; }
      fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(b); });
    });
    srv.listen(port, '127.0.0.1', () => res({ url: `http://127.0.0.1:${port}`, stop: () => new Promise((z) => srv.close(z)) }));
  });
}

/** Record console errors and uncaught page errors. Returns the live array. */
function collectConsole(page) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + (e && e.message ? e.message : String(e))));
  return errors;
}

module.exports = { launch, launchBrowser, jobPort, startServer, startStatic, collectConsole, ROOT };
