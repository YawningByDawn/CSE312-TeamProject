// The workshop shell (dev/workshop.html, served by `npm run workshop` only): a left nav of every dev/*.html page, listed by the
// dev server from the folder (`pages.json`), plus the game itself and the Approvals view, each shown in the main pane.
// Imports nothing from the game.
import { mountApprovals } from './approvals';

interface Entry { title: string; url: string }

const GAME: Entry[] = [{ title: 'Game', url: 'index.html?scene=play&seed=7&mute=1' }];
/** The hash of the Approvals view; `#approvals/<card id>` opens that card. */
const APPROVALS = 'approvals';

const nav = document.getElementById('nav') as HTMLElement;
const pane = document.getElementById('pane') as HTMLIFrameElement;
const approvalsPane = document.getElementById('approvals') as HTMLElement;
const here = document.getElementById('here') as HTMLElement;
const menu = document.getElementById('menu') as HTMLInputElement;
const links = new Map<string, HTMLAnchorElement>();

function section(heading: string, entries: Entry[]): void {
  nav.append(Object.assign(document.createElement('h2'), { textContent: heading }));
  for (const e of entries) {
    const a = document.createElement('a');
    a.href = '#' + e.url;
    a.textContent = e.title;
    links.set(e.url, a);
    nav.append(a);
  }
}

// a phone: picking a page folds the nav away
nav.addEventListener('click', (e) => { if ((e.target as Element).closest('a')) menu.checked = false; });

const pages = (await (await fetch('pages.json')).json()) as { name: string }[];
section('Review', [{ title: 'Approvals', url: APPROVALS }]);
section('Game', GAME);
section('Dev pages', pages.map((p) => ({ title: p.name, url: `dev/${p.name}.html` })));

const refreshApprovals = mountApprovals(approvalsPane, (n) => {
  links.get(APPROVALS)!.textContent = n ? `Approvals (${n})` : 'Approvals';
});

function show(): void {
  const hash = decodeURIComponent(location.hash.slice(1)) || GAME[0]!.url;
  const approvals = hash === APPROVALS || hash.startsWith(APPROVALS + '/');
  for (const [u, a] of links) a.classList.toggle('on', approvals ? u === APPROVALS : u === hash);
  here.textContent = links.get(approvals ? APPROVALS : hash)?.textContent ?? hash;
  approvalsPane.hidden = !approvals;
  pane.hidden = approvals;
  void refreshApprovals(); // the nav's pending count, and the cards when they are the pane
  if (!approvals && pane.getAttribute('src') !== hash) pane.setAttribute('src', hash);
}

addEventListener('hashchange', show);
show();
