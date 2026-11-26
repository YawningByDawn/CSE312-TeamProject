// The workshop shell's Approvals view: the cards tools/post_card.py posted, with their pictures and videos, and the owner's
// Approve / Reject / Revise (with a note) / Clear buttons. Rulings go to the dev server (tools/workshop/approvals.ts), which
// keeps the history in data/workshop/approvals_decisions.json. Imports nothing from the game.

interface Media { file: string; caption: string; role: string; v: number | null }
interface Card {
  id: string; category: string; title: string; notes: string; steps?: string; branch?: string; commit?: string;
  media: Media[]; links: { label: string; url: string }[]; created: string; closed: boolean; session?: string;
}
interface Ruling { at: string; status: string; note: string; pingError?: string }
interface State { items: Card[]; decisions: Record<string, Ruling[]>; ping: boolean }

type Filter = 'pending' | 'decided' | 'closed' | 'all';
const FILTERS: Filter[] = ['pending', 'decided', 'closed', 'all'];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/** The standing ruling (the newest, unless it is a clear), or undefined while the card is pending. */
function standing(s: State, id: string): Ruling | undefined {
  const last = s.decisions[id]?.at(-1);
  return last && last.status !== 'cleared' ? last : undefined;
}

const matches = (s: State, c: Card, f: Filter): boolean =>
  f === 'all' || (f === 'closed' ? c.closed : !c.closed && (f === 'pending') === !standing(s, c.id));

export function pendingCount(s: State): number {
  return s.items.filter((c) => matches(s, c, 'pending')).length;
}

const mediaUrl = (c: Card, m: Media): string => `approvals-media/${encodeURIComponent(c.id)}/${encodeURIComponent(m.file)}?v=${m.v}`;

/** Mounts the view into `root`; `onCount` gets the pending count after every load. Returns a refresh to call when the view is shown. */
export function mountApprovals(root: HTMLElement, onCount: (n: number) => void): () => Promise<void> {
  let state: State = { items: [], decisions: {}, ping: false };
  const pingErrors = new Map<string, string>();
  let filter: Filter = 'pending';
  let category = '';
  const open = new Set<string>();
  const drafts = new Map<string, string>();
  let shown = '';

  const load = async (): Promise<void> => {
    const next = (await (await fetch('api/approvals')).json()) as State;
    onCount(pendingCount(next));
    const sig = JSON.stringify(next);
    if (sig === shown) return;
    shown = sig;
    state = next;
    render();
  };

  const decide = async (c: Card, status: string): Promise<void> => {
    const r = await fetch('api/approvals/decide', { method: 'POST', body: JSON.stringify({ id: c.id, status, note: drafts.get(c.id) ?? '' }) });
    if (!r.ok) { alert(((await r.json()) as { error: string }).error); return; }
    drafts.delete(c.id);
    const err = ((await r.json()) as Ruling).pingError;
    if (err) pingErrors.set(c.id, err); else pingErrors.delete(c.id);
    await load();
    render();   // the error shows even when the load changed nothing
  };

  const setPing = async (on: boolean): Promise<void> => {
    await fetch('api/approvals/ping', { method: 'POST', body: JSON.stringify({ on }) });
    await load();
  };

  const figure = (c: Card, m: Media, tag: string): HTMLElement => {
    const f = el('figure', 'ap-fig');
    if (m.v === null) {
      f.append(el('div', 'ap-missing', `missing: ${m.file}`));
    } else if (/\.mp4$/i.test(m.file)) {
      const v = el('video');
      v.src = mediaUrl(c, m);
      v.controls = true; v.loop = true; v.preload = 'metadata';
      f.append(v);
    } else {
      const img = el('img');
      img.src = mediaUrl(c, m);
      img.loading = 'lazy';
      img.alt = m.caption;
      img.addEventListener('click', () => lightbox(img.src, m.caption));
      f.append(img);
    }
    f.append(el('figcaption', '', (tag ? tag + ' - ' : '') + m.caption));
    return f;
  };

  const lightbox = (src: string, caption: string): void => {
    const box = el('div', 'ap-lightbox');
    const img = el('img');
    img.src = src;
    img.alt = caption;
    box.append(img, el('div', 'cap', caption + ' - click to close'));
    box.addEventListener('click', () => box.remove());
    document.body.append(box);
  };

  const card = (c: Card): HTMLElement => {
    const cur = standing(state, c.id);
    const status = c.closed ? 'closed' : cur?.status ?? 'pending';
    const isOpen = open.has(c.id);
    const box = el('div', `ap-card ${status}`);
    box.id = `ap-${c.id}`;
    const head = el('div', 'ap-head');
    const title = el('span', 'ap-title', c.title);
    const toggle = (): void => {
      if (!open.delete(c.id)) open.add(c.id);
      history.replaceState(null, '', `#approvals${open.has(c.id) ? `/${encodeURIComponent(c.id)}` : ''}`);
      render();
    };
    title.addEventListener('click', toggle);
    const btn = el('button', '', isOpen ? 'collapse' : 'open');
    btn.addEventListener('click', toggle);
    head.append(el('span', 'ap-cat', c.category), title, el('span', `ap-badge ${status}`, status === 'revise' ? 'needs revision' : status), el('span', 'ap-meta', c.created), btn);
    box.append(head);
    if (cur?.note && !isOpen) box.append(el('div', 'ap-meta', `your note: ${cur.note}`));
    if (!isOpen) return box;

    if (c.notes) box.append(el('div', 'ap-notes', c.notes));
    if (c.category === 'playtest') {
      box.append(el('div', 'ap-notes', `How to test\n${c.steps ?? ''}`), el('div', 'ap-meta', `branch ${c.branch} - commit ${c.commit}`));
    }
    const gallery = el('div', 'ap-media');
    const before = c.media.find((m) => m.role === 'before');
    const after = c.media.find((m) => m.role === 'after');
    const paired = before && after;
    if (paired) { const pair = el('div', 'ap-pair'); pair.append(figure(c, before, 'before'), figure(c, after, 'after')); gallery.append(pair); }
    for (const m of c.media) if (!paired || (m !== before && m !== after)) gallery.append(figure(c, m, m.role));
    box.append(gallery);
    if (c.links.length) {
      const links = el('div', 'ap-links');
      for (const l of c.links) { const a = el('a', '', l.label); a.href = l.url; a.target = '_blank'; links.append(a); }
      box.append(links);
    }

    const note = el('textarea');
    note.placeholder = 'note (why / what to revise)';
    note.maxLength = 2000;
    note.value = drafts.get(c.id) ?? '';
    const revise = el('button', cur?.status === 'revise' ? 'on' : '', 'Revise with note');
    revise.disabled = !note.value.trim();
    note.addEventListener('input', () => { drafts.set(c.id, note.value); revise.disabled = !note.value.trim(); });
    const button = (label: string, status: string, on: boolean): HTMLButtonElement => {
      const b = el('button', on ? 'on' : '', label);
      b.addEventListener('click', () => void decide(c, status));
      return b;
    };
    revise.addEventListener('click', () => void decide(c, 'revise'));
    const row = el('div', 'ap-decide');
    row.append(button('Approve', 'approved', cur?.status === 'approved'), button('Reject', 'rejected', cur?.status === 'rejected'), note, revise);
    if (cur) row.append(button('Clear', 'cleared', false));
    box.append(row);
    if (state.ping) box.append(el('div', 'ap-meta', c.session ? `pings session ${c.session.slice(0, 8)}` : 'no session on this card to ping'));
    const pingError = pingErrors.get(c.id);
    if (pingError) box.append(el('div', 'ap-meta', `ping failed: ${pingError}`));

    const hist = state.decisions[c.id] ?? [];
    if (hist.length) {
      const h = el('div', 'ap-hist', 'decision history');
      for (const r of [...hist].reverse()) {
        const line = el('div', 'row-h');
        line.append(el('span', `ap-badge ${r.status}`, r.status), el('span', 'ap-meta', r.at), el('span', 'note', r.note));
        h.append(line);
      }
      box.append(h);
    }
    return box;
  };

  const render = (): void => {
    root.replaceChildren();
    const bar = el('div', 'ap-bar');
    for (const f of FILTERS) {
      const chip = el('button', f === filter ? 'on' : '', `${f} (${state.items.filter((c) => matches(state, c, f)).length})`);
      chip.addEventListener('click', () => { filter = f; render(); });
      bar.append(chip);
    }
    const cats = [...new Set(state.items.map((c) => c.category))];
    if (cats.length) {
      bar.append(el('span', 'ap-meta', 'category'));
      for (const k of ['', ...cats]) {
        const chip = el('button', k === category ? 'on' : '', k || 'all');
        chip.addEventListener('click', () => { category = k; render(); });
        bar.append(chip);
      }
    }
    const pingChip = el('button', state.ping ? 'on' : '', `ping session: ${state.ping ? 'on' : 'off'}`);
    pingChip.addEventListener('click', () => void setPing(!state.ping));
    bar.append(pingChip);
    root.append(el('h2', '', 'Pending approval'), bar);
    if (!state.items.length) root.append(el('p', 'ap-meta', 'Nothing in the queue. Post a card with python tools/post_card.py CARD.json MEDIA...'));
    const rank = (c: Card): number => (c.closed ? 2 : standing(state, c.id) ? 1 : 0);
    const list = el('div', 'ap-list');
    const visible = state.items.filter((c) => matches(state, c, filter) && (!category || c.category === category));
    visible.sort((a, b) => rank(a) - rank(b) || b.created.localeCompare(a.created) || a.id.localeCompare(b.id));
    for (const c of visible) list.append(card(c));
    root.append(list);
  };

  // a card posted or ruled on while the page is open shows without a reload
  setInterval(() => { if (root.offsetParent !== null) void load(); }, 5000);

  return async () => {
    const id = decodeURIComponent(location.hash.slice(1)).split('/')[1];
    if (id) { open.add(id); filter = 'all'; }
    shown = '';
    await load();
    if (id) document.getElementById(`ap-${id}`)?.scrollIntoView();
  };
}
