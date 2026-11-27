import './style.css';
import { Hud } from './hud';
import { Input } from './input';
import { Net } from './net';
import { drawTree, Panels } from './panels';
import type { MeDead } from './types';
import { View } from './view';

// Gobble Grove's page: the menu (play as a guest, or log in or register to keep a name), the canvas, the panels, and
// the loop that draws a frame and sends the player's steering. Logging in uses the auth service (`/login`,
// `/register`, `/logout`); `/api/me` says who is logged in; the arena runs on the app's hub at `/ws`, opened with the
// login cookie or, for a guest, a random key this tab keeps.

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const canvas = $<HTMLCanvasElement>('view');
const ctx = canvas.getContext('2d')!;
const menu = $('menu');
const dead = $('dead');
const tree = $('tree');
const auth = $<HTMLFormElement>('auth');
const authError = $('auth-error');
const ready = $('ready');
const offline = $('offline');
const status = $('status');

const net = new Net();
// for scripts that drive the game in a browser, as the old game's `window.__hg`
(window as unknown as { __gg: { net: Net } }).__gg = { net };
const hud = new Hud();
const input = new Input(canvas, $('touch'), $<HTMLButtonElement>('boost-btn'), $<HTMLButtonElement>('ability-btn'));
const panels = new Panels($('evolve'), $('stats'), {
  evolve: (to) => net.send({ type: 'evolve', to }),
  upgrade: (stat) => net.send({ type: 'upgrade', stat }),
});
let account: string | null = null; // the logged-in username; null for a guest
let playing = false;
let deathTimer = 0;

const TIPS = [
  'Bitten? You are thrown clear and run faster for a moment: get away!',
  'Nothing takes more than half your health in one hit, so keep moving.',
  'You bite back when bitten, and a boost into a bigger creature bites it too.',
  'Ferns hide the small ones on land, and kelp at sea.',
  'Rocks and reefs are too steep for anything above tier 4: small creatures are safe up there. Fliers can still reach you.',
  'Tar pits bog big creatures down, while small ones skitter across.',
  'Ginkgo trees, termite mounds and nests keep growing food, and the meat on a fallen giant\'s bones grows back. Watch for a glowing starfruit!',
  'Devil Frogs hide under water, and lead to the sea.',
  'Red outlines can eat you; green ones you can eat.',
  'Skills hurt anything, bigger creatures less. Stay a tier for a point, and make yours hurt more.',
  'The bigger you are, the faster you get hungry: big creatures have to hunt.',
  'Land creatures crawl in the sea, and sea creatures flop on land. Fliers go anywhere.',
  'Bots never grow past tier 7: the mythical tiers are for players.',
];

/** This tab's guest key: random, kept for the tab so a reload is the same guest. */
function guestKey(): string {
  try {
    const kept = sessionStorage.getItem('gg-guest');
    if (kept && /^[0-9a-f]{32}$/.test(kept)) return kept;
  } catch {
    // no storage: a fresh key each load
  }
  const key = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
  try {
    sessionStorage.setItem('gg-guest', key);
  } catch {
    // as above
  }
  return key;
}

const view = new View({
  spawned: () => {
    playing = true;
    clearTimeout(deathTimer);
    menu.hidden = dead.hidden = tree.hidden = true;
  },
  died: (me) => {
    playing = false;
    deathTimer = window.setTimeout(() => showDeath(me), 900);
  },
  evolved: (sp) => {
    const s = net.world?.species[sp];
    if (!s) return;
    const top = s.next.length === 0;
    const home = s.habitat === 'sea' ? 'The sea is yours' : s.habitat === 'air' ? 'You fly over land and sea' : s.habitat === 'amph' ? 'At home on land and in water' : 'A creature of the land';
    hud.announce(`You're a ${s.name}!`, top ? 'The top of the chain: more xp now earns stat points' : `${home} · Skill: ${s.ability.name}`);
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

function showMenu(reachable: boolean): void {
  dead.hidden = true;
  menu.hidden = false;
  ready.hidden = !reachable;
  auth.hidden = !reachable || account !== null;
  offline.hidden = reachable;
  const who = $('who');
  who.replaceChildren();
  if (account !== null) {
    const out = document.createElement('button');
    out.type = 'button';
    out.className = 'link';
    out.textContent = 'Log out';
    out.addEventListener('click', logOut);
    const b = document.createElement('b');
    b.textContent = account;
    who.append('Playing as ', b, ' · ', out);
  } else {
    who.textContent = "You'll play as a guest.";
  }
  $('play').textContent = account === null ? 'Play as guest' : 'Play';
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

/** Finds out who is playing and opens the socket for them: logged in, or as this tab's guest. */
async function start(): Promise<void> {
  const name = await whoAmI();
  account = name ?? null;
  showMenu(name !== undefined);
  if (name === undefined) return;
  net.close();
  net.connect(account === null ? guestKey() : null);
}

async function logOut(): Promise<void> {
  await fetch('/logout', { method: 'POST' }).catch(() => undefined);
  playing = false;
  await start();
}

function play(): void {
  if (net.status !== 'open') return;
  net.send({ type: 'spawn' });
  playing = true;
  menu.hidden = dead.hidden = tree.hidden = true;
}

function openTree(): void {
  if (!net.world) return;
  const me = net.snaps.at(-1)?.me;
  drawTree($<HTMLCanvasElement>('tree-canvas'), net.world, me?.alive ? me.sp : -1);
  tree.hidden = false;
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
$('to-menu').addEventListener('click', () => showMenu(true));
$('tree-open').addEventListener('click', openTree);
$('tree-close').addEventListener('click', () => (tree.hidden = true));
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (e.code === 'Enter' && !dead.hidden) play();
  if (e.code === 'KeyT') tree.hidden ? openTree() : (tree.hidden = true);
  if (e.code === 'Escape') tree.hidden = true;
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
  hud.draw(ctx, w, h, dpr, f, net.world, net.name, playing, 0);
  const alive = f.me?.alive && playing ? f.me : null;
  panels.update(alive, net.world);

  if (alive) {
    const s = input.steer(f, w, h);
    const dx = Math.round(s.dx * 100) / 100;
    const dy = Math.round(s.dy * 100) / 100;
    if (now - sent.at > 50 && (Math.abs(dx - sent.dx) > 0.02 || Math.abs(dy - sent.dy) > 0.02 || now - sent.at > 1000)) {
      net.send({ type: 'input', dx, dy });
      sent = { dx, dy, at: now };
    }
    if (input.takeBoost()) net.send({ type: 'boost' });
    if (input.takeSkill()) net.send({ type: 'ability' });
  } else {
    input.takeBoost();
    input.takeSkill();
  }

  const says = net.status === 'lost' ? 'Connection lost, reconnecting…' : net.status === 'kicked' ? 'You opened the game in another tab.' : net.status === 'connecting' ? 'Connecting…' : '';
  status.hidden = says === '';
  if (status.textContent !== says) status.textContent = says;
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
void start();
