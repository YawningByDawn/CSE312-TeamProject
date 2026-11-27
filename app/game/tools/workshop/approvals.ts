// The workshop's approvals back end (a Vite dev-server middleware, `npm run workshop` only). Cards live in data/workshop/approvals.json
// (written by tools/post_card.py); the owner's rulings live in data/workshop/approvals_decisions.json (written only here, atomically);
// the cards' pictures and videos live in data/workshop/media/<card id>/ (gitignored, never a temp folder) and are served from there.
// The ping switch lives in approvals_ping.json ({"on": bool}, off by default): with it on, the ruling that leaves no card pending
// (see standing.ts) sends each posting session one message through the plane's message route listing its cards that are ruled and
// not closed; a card with no session, or a failed send, is returned in the decide answer as pingError.
import { createReadStream, existsSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join } from 'node:path';
import { message, pendingCount, unchecked, type Card, type Ruling } from './standing';

/** Media types the workshop shows (tools/post_card.py TYPES is the same list). */
const TYPES: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.mp4': 'video/mp4',
};
const STATUSES = ['approved', 'rejected', 'revise', 'cleared'];
const IMMUTABLE = 'public, max-age=31536000, immutable';

/** One plain name: no separators, no leading dot (so no `..`). */
export const safe = (s: string): boolean => s.length > 0 && s[0] !== '.' && !/[/\\:]/.test(s);

interface Posted extends Card { media?: { file: string }[] }

/** Messages `session` through the plane; resolves to the error text, or '' when the plane took it (2xx). */
async function ping(session: string, text: string): Promise<string> {
  const port = process.env.ZS_PLANE_PORT || 8787;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-CP-Token': process.env.CONTROL_PLANE_TOKEN || 'dev-local-token' },
      body: JSON.stringify({ from_session: 'plane:approvals', from_origin: 'plane', to: session, kind: 'note', body: text }),
    });
    return r.ok ? '' : `the plane answered ${r.status}: ${(await r.text()).slice(0, 300)}`;
  } catch (e) {
    return `the plane is unreachable: ${e instanceof Error ? e.message : String(e)}`;
  }
}

/** One message per session; resolves to every problem (a card with no session, a refused send), '' when all went. */
async function pingUnchecked(cards: Card[], decisions: Record<string, Ruling[]>): Promise<string> {
  const { sessions, orphans } = unchecked(cards, decisions);
  const errors = orphans.map((r) => `${r.id} has no session to ping`);
  for (const [session, lines] of sessions) {
    const error = await ping(session, message(lines));
    if (error) errors.push(`session ${session.slice(0, 8)}: ${error}`);
  }
  return errors.join('; ');
}

function readJson<T>(path: string, empty: T): T {
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : empty;
}

function writeAtomic(path: string, data: unknown): void {
  writeFileSync(path + '.tmp', JSON.stringify(data, null, 2) + '\n');
  renameSync(path + '.tmp', path);
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

function body(req: IncomingMessage): Promise<string> {
  return new Promise((ok, fail) => {
    let text = '';
    req.setEncoding('utf8');
    req.on('data', (c: string) => { text += c; if (text.length > 65536) fail(new Error('body too large')); });
    req.on('end', () => ok(text));
    req.on('error', fail);
  });
}

/** An original served with ranges (a video seeks), cached for good when the url carries ?v=<mtime>. */
function serveMedia(req: IncomingMessage, res: ServerResponse, path: string, versioned: boolean): void {
  const st = statSync(path);
  res.setHeader('content-type', TYPES[extname(path).toLowerCase()]!);
  res.setHeader('accept-ranges', 'bytes');
  res.setHeader('last-modified', st.mtime.toUTCString());
  res.setHeader('cache-control', versioned ? IMMUTABLE : 'no-cache');
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
  let start = 0;
  let end = st.size - 1;
  if (m && (m[1] || m[2])) {
    if (m[1]) { start = Number(m[1]); if (m[2]) end = Math.min(end, Number(m[2])); } else { start = Math.max(0, st.size - Number(m[2])); }
    if (start > end) { res.statusCode = 416; res.setHeader('content-range', `bytes */${st.size}`); res.end(); return; }
    res.statusCode = 206;
    res.setHeader('content-range', `bytes ${start}-${end}/${st.size}`);
  }
  res.setHeader('content-length', end - start + 1);
  if (req.method === 'HEAD') { res.end(); return; }
  createReadStream(path, { start, end }).pipe(res);
}

/** `dir` holds approvals.json, approvals_decisions.json and media/; every route lives under `base`. */
export function approvals(base: string, dir: string) {
  const media = join(dir, 'media');
  const itemsPath = join(dir, 'approvals.json');
  const decisionsPath = join(dir, 'approvals_decisions.json');
  const pingPath = join(dir, 'approvals_ping.json');
  const pingOn = () => readJson<{ on?: boolean }>(pingPath, {}).on === true;
  const items = () => readJson<{ items: Posted[] }>(itemsPath, { items: [] }).items;

  return async (req: IncomingMessage, res: ServerResponse, next: () => void): Promise<void> => {
    const url = new URL(req.url ?? '', 'http://workshop');
    if (!url.pathname.startsWith(base)) return next();
    const route = url.pathname.slice(base.length);
    try {
      if (req.method === 'GET' && route === 'api/approvals') {
        // each media file carries its mtime (the cache-busting ?v=), or null when the file is not in media/
        const cards = items().map((c) => ({
          ...c, media: (c.media ?? []).map((f) => {
            const p = join(media, c.id, f.file);
            return { ...f, v: safe(c.id) && safe(f.file) && existsSync(p) ? statSync(p).mtimeMs : null };
          }),
        }));
        return send(res, 200, { items: cards, decisions: readJson<{ decisions: object }>(decisionsPath, { decisions: {} }).decisions, ping: pingOn() });
      }
      if (req.method === 'POST' && route === 'api/approvals/decide') {
        const d = JSON.parse(await body(req)) as { id?: string; status?: string; note?: string };
        const card = items().find((c) => c.id === d.id);
        if (!card) return send(res, 404, { error: 'no such card' });
        if (!d.status || !STATUSES.includes(d.status)) return send(res, 400, { error: `status is one of ${STATUSES.join(' ')}` });
        const note = (d.status === 'cleared' ? '' : String(d.note ?? '')).trim().slice(0, 2000);
        // read, append, replace: all synchronous after the body is in, so two rulings never interleave
        const file = readJson<{ decisions: Record<string, Ruling[]> }>(decisionsPath, { decisions: {} });
        const before = pendingCount(items(), file.decisions);
        const ruling = { at: new Date().toISOString().replace(/\.\d+Z$/, 'Z'), status: d.status, note };
        (file.decisions[card.id] ??= []).push(ruling);
        writeAtomic(decisionsPath, file);
        // the ruling that leaves no card pending sends the unchecked set
        const pingError = pingOn() && before > 0 && pendingCount(items(), file.decisions) === 0 ? await pingUnchecked(items(), file.decisions) : '';
        return send(res, 200, pingError ? { ...ruling, pingError } : ruling);
      }
      if (req.method === 'POST' && route === 'api/approvals/ping') {
        const on = (JSON.parse(await body(req)) as { on?: unknown }).on;
        if (typeof on !== 'boolean') return send(res, 400, { error: 'on is true or false' });
        writeAtomic(pingPath, { on });
        return send(res, 200, { on });
      }
      if ((req.method === 'GET' || req.method === 'HEAD') && route.startsWith('approvals-media/')) {
        const parts = route.slice('approvals-media/'.length).split('/').map(decodeURIComponent);
        const [id, file] = parts;
        const path = parts.length === 2 && id && file && safe(id) && safe(file) && TYPES[extname(file).toLowerCase()] ? join(media, id, file) : '';
        if (!path || !existsSync(path)) return send(res, 404, { error: 'no such media' });
        return serveMedia(req, res, path, url.searchParams.has('v'));
      }
    } catch (e) {
      return send(res, 500, { error: e instanceof Error ? e.message : String(e) });
    }
    next();
  };
}
