import './style.css';
import { Hud } from './hud';
import { Input } from './input';
import { Net } from './net';
import type { MeDead } from './types';
import { View } from './view';

// Gobble Grove's page: the menu (log in or register, then play), the canvas, and the loop that draws a frame and
// sends the player's steering. Logging in uses the auth service (`/login`, `/register`, `/logout`); `/api/me` says
// who is logged in; the arena runs on the app's hub at `/ws`.

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const canvas = $<HTMLCanvasElement>('view');
const ctx = canvas.getContext('2d')!;
const menu = $('menu');
const dead = $('dead');
const auth = $<HTMLFormElement>('auth');
const authError = $('auth-error');
const ready = $('ready');
const offline = $('offline');
const status = $('status');

const net = new Net();
// for scripts that drive the game in a browser, as the old game's `window.__hg`
(window as unknown as { __gg: { net: Net } }).__gg = { net };
const hud = new Hud();
const input = new Input(canvas, $<HTMLButtonElement>('boost-btn'));
let myName: string | null = null;
let playing = false;
let deathTimer = 0;

const TIPS = [
  'Bushes hide beetles, frogs, hares and hedgehogs from everything bigger.',
  'Frogs swim fast, and nothing can see them under water.',
  'A boost bites a creature your size, and a smaller one bites a creature a tier up.',
  'The bigger you are, the faster you get hungry: big creatures have to hunt.',
  'A creature that starves leaves meat behind.',
  'Boosting costs a little hunger, so keep your belly full.',
];

const view = new View({
  spawned: () => {
    playing = true;
    clearTimeout(deathTimer);
    menu.hidden = dead.hidden = true;
  },
  died: (me) => {
    playing = false;
    deathTimer = window.setTimeout(() => showDeath(me), 900);
  },
  evolved: (sp) => {
    const s = net.world?.species[sp];
    if (!s) return;
    const top = sp === (net.world?.species.length ?? 0) - 1;
    hud.announce(`You're a ${s.name}!`, top ? 'Top of the food chain' : s.swims ? 'Swim fast, and hide under water' : s.hides ? 'Still small enough to hide in bushes' : 'Too big for bushes: hunt, or be hunted');
  },
  ate: (name, sp) => hud.toast(`You ate ${name} the ${net.world?.species[sp]?.name ?? 'creature'}`, '#c9ffb0'),
});

function showDeath(me: MeDead): void {
  const species = net.world?.species ?? [];
  $('dead-title').textContent = me.by ? 'You were eaten!' : 'You starved!';
  $('dead-sub').textContent = me.by ? `by ${me.by}, a ${species[me.bySp]?.name ?? 'creature'}` : 'Big creatures get hungry fast.';
  $('st-sp').textContent = species[me.sp]?.name ?? '?';
  $('st-xp').textContent = `${me.xp}`;
  $('st-kills').textContent = `${me.kills}`;
  $('st-time').textContent = `${Math.floor(me.secs / 60)}:${`${me.secs % 60}`.padStart(2, '0')}`;
  $('dead-tip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)]!;
  menu.hidden = true;
  dead.hidden = false;
  $('again').focus();
}

function showMenu(): void {
  dead.hidden = true;
  menu.hidden = false;
  auth.hidden = myName !== null;
  ready.hidden = myName === null;
  if (myName !== null) {
    $('who').textContent = myName;
    $('play').focus();
  }
}

/** The logged-in username, null for nobody, undefined when the server cannot be reached. */
async function whoAmI(): Promise<string | null | undefined> {
  try {
    const r = await fetch('/api/me');
    if (!r.ok || !r.headers.get('Content-Type')?.includes('json')) return undefined;
    const name = ((await r.json()) as { username: string | null }).username;
    return name === null ? null : new DOMParser().parseFromString(name, 'text/html').documentElement.textContent;
  } catch {
    return undefined;
  }
}

async function start(): Promise<void> {
  const name = await whoAmI();
  offline.hidden = name !== undefined;
  myName = name ?? null;
  showMenu();
  if (name === undefined) auth.hidden = true;
  if (myName !== null) net.connect();
}

function play(): void {
  if (net.status !== 'open') return;
  net.send({ type: 'spawn' });
  playing = true;
  menu.hidden = dead.hidden = true;
  canvas.focus();
}

auth.addEventListener('submit', async (e) => {
  e.preventDefault();
  const mode = (e.submitter as HTMLButtonElement | null)?.value === 'register' ? 'register' : 'login';
  const data = new FormData(auth);
  const body = JSON.stringify({ username: data.get('username'), password: data.get('password') });
  const post = (to: string): Promise<Response> => fetch(to, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  authError.textContent = '';
  try {
    let r = await post(`/${mode}`);
    if (r.ok && mode === 'register') r = await post('/login');
    if (!r.ok) {
      authError.textContent = r.headers.get('Content-Type')?.includes('json') ? ((await r.json()) as { error: string }).error : `The server said ${r.status}.`;
      return;
    }
    auth.reset();
    await start();
  } catch {
    authError.textContent = "Can't reach the server.";
  }
});

$('play').addEventListener('click', play);
$('again').addEventListener('click', play);
$('to-menu').addEventListener('click', showMenu);
$('logout').addEventListener('click', async () => {
  await fetch('/logout', { method: 'POST' }).catch(() => undefined);
  net.close();
  myName = null;
  playing = false;
  showMenu();
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'Enter' && !dead.hidden) play();
});

// the loop
let last = performance.now();
let sent = { dx: 0, dy: 0, at: 0 };

function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const f = view.frame(ctx, w, h, dpr, net, now / 1000, dt);
  hud.draw(ctx, w, h, dpr, f, net.world, myName, playing);

  if (f.me?.alive && playing) {
    const s = input.steer(f, w, h);
    const dx = Math.round(s.dx * 100) / 100;
    const dy = Math.round(s.dy * 100) / 100;
    if (now - sent.at > 50 && (Math.abs(dx - sent.dx) > 0.02 || Math.abs(dy - sent.dy) > 0.02 || now - sent.at > 1000)) {
      net.send({ type: 'input', dx, dy });
      sent = { dx, dy, at: now };
    }
    if (input.takeBoost()) net.send({ type: 'boost' });
  } else {
    input.takeBoost();
  }

  const says = net.status === 'lost' ? 'Connection lost, reconnecting…' : net.status === 'kicked' ? 'You opened the game in another tab.' : net.status === 'connecting' && myName ? 'Connecting…' : '';
  status.hidden = says === '';
  if (status.textContent !== says) status.textContent = says;
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
void start();
