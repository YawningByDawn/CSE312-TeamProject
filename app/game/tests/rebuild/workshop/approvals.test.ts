import { createServer, type Server } from 'node:http';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { approvals } from '../../../tools/workshop/approvals';
import { message, pendingCount, unchecked } from '../../../tools/workshop/standing';

// The ping switch: off by default, set by POST api/approvals/ping; with it on, the ruling that leaves no card pending messages each
// posting session its ruled, unclosed cards through the plane; a card with no session, or a refusing or absent plane, comes back in the decide answer.

interface Got { path: string; token: unknown; body: Record<string, string> }
let dir: string;
let workshop: Server;
let plane: Server;
let got: Got[];
let planeStatus: number;
let base: string;

const listen = (s: Server): Promise<number> => new Promise((ok) => s.listen(0, '127.0.0.1', () => ok((s.address() as AddressInfo).port)));
const post = async (route: string, body: object): Promise<{ status: number; json: Record<string, unknown> }> => {
  const r = await fetch(`${base}/w/api/approvals/${route}`, { method: 'POST', body: JSON.stringify(body) });
  return { status: r.status, json: (await r.json()) as Record<string, unknown> };
};
const cards = (...items: object[]): void => writeFileSync(join(dir, 'approvals.json'), JSON.stringify({ items }));

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'ping-'));
  got = [];
  planeStatus = 200;
  plane = createServer((req, res) => {
    let text = '';
    req.on('data', (c) => { text += c; });
    req.on('end', () => {
      got.push({ path: req.url ?? '', token: req.headers['x-cp-token'], body: JSON.parse(text) as Record<string, string> });
      res.statusCode = planeStatus;
      res.end('refused');
    });
  });
  process.env.ZS_PLANE_PORT = String(await listen(plane));
  const mw = approvals('/w/', dir);
  workshop = createServer((req, res) => void mw(req, res, () => { res.statusCode = 404; res.end(); }));
  base = `http://127.0.0.1:${await listen(workshop)}`;
  const created = '2026-01-01T00:00:00Z';
  cards({ id: 'c1', title: 'A card', session: 'abcdef12-3456', created }, { id: 'c2', title: 'No session', created });
});

afterEach(() => { workshop.closeAllConnections(); plane.closeAllConnections(); workshop.close(); plane.close(); delete process.env.ZS_PLANE_PORT; });

describe('the pending and unchecked sets', () => {
  const card = (id: string, extra: object = {}) => ({ id, title: `T${id}`, created: '2026-11-27T10:00:00Z', ...extra });
  const r = (at: string, status: string, note = '') => ({ at, status, note });
  const cards = [card('a', { session: 's1' }), card('b', { session: 's2' }), card('c'), card('d', { session: 's1', closed: true }), card('e', { session: 's1' })];
  const ok = '2026-11-27T11:00:00Z';
  const d = { a: [r(ok, 'approved')], b: [r(ok, 'revise', 'fix\nthe gold')], c: [r(ok, 'rejected')], d: [r(ok, 'approved')], e: [r('2026-11-27T09:00:00Z', 'approved')] };

  it('counts cards not closed with no standing ruling: older than the card, a clear, or none', () => {
    expect(pendingCount(cards, d)).toBe(1);
    expect(pendingCount(cards, { ...d, a: [r(ok, 'approved'), r(ok, 'cleared')] })).toBe(2);
    expect(pendingCount([card('x')], {})).toBe(1);
  });

  it('groups the ruled, unclosed cards by session; no session is an orphan', () => {
    const u = unchecked(cards, d);
    expect([...u.sessions].map(([s, l]) => [s, l.map((x) => x.id)])).toEqual([['s1', ['a']], ['s2', ['b']]]);
    expect(u.orphans.map((x) => x.id)).toEqual(['c']);
  });

  it('writes one message per session with the note verbatim', () => {
    expect(message(unchecked(cards, d).sessions.get('s2')!)).toBe(
      'Workshop approvals: no card is left pending. Your cards the owner ruled on:\n- b "Tb": revise. Note: fix\nthe gold');
  });
});

describe('the approvals ping switch', () => {
  it('is off by default, set by the POST, and shown in the GET', async () => {
    const read = async () => ((await (await fetch(`${base}/w/api/approvals`)).json()) as { ping: boolean }).ping;
    expect(await read()).toBe(false);
    expect((await post('ping', { on: 'yes' })).status).toBe(400);
    await post('ping', { on: true });
    expect(await read()).toBe(true);
    expect(JSON.parse(readFileSync(join(dir, 'approvals_ping.json'), 'utf8'))).toEqual({ on: true });
  });

  it('sends nothing while off, while a card is pending, or for a clear', async () => {
    await post('decide', { id: 'c1', status: 'approved' });
    await post('decide', { id: 'c2', status: 'approved' });
    await post('ping', { on: true });
    await post('decide', { id: 'c2', status: 'cleared' });
    await post('decide', { id: 'c1', status: 'rejected' });
    expect(got).toEqual([]);
  });

  it('messages each session once, when the last pending card is ruled', async () => {
    await post('ping', { on: true });
    await post('decide', { id: 'c1', status: 'revise', note: ' fix the gold ' });
    expect(got).toEqual([]);
    const last = await post('decide', { id: 'c2', status: 'rejected' });
    expect(last.json.pingError).toBe('c2 has no session to ping');
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({ path: '/api/messages', token: 'dev-local-token' });
    expect(got[0]!.body).toEqual({
      from_session: 'plane:approvals', from_origin: 'plane', to: 'abcdef12-3456', kind: 'note',
      body: 'Workshop approvals: no card is left pending. Your cards the owner ruled on:\n- c1 "A card": revise. Note: fix the gold',
    });
    await post('decide', { id: 'c2', status: 'approved' });
    expect(got).toHaveLength(1);
  });

  it('returns a refusing or unreachable plane in the answer, the ruling still recorded', async () => {
    await post('ping', { on: true });
    await post('decide', { id: 'c1', status: 'approved' });
    planeStatus = 503;
    const refused = await post('decide', { id: 'c2', status: 'approved' });
    expect(refused.status).toBe(200);
    expect(String(refused.json.pingError)).toMatch(/503/);
    plane.closeAllConnections();
    plane.close();
    await post('decide', { id: 'c1', status: 'cleared' });
    const down = await post('decide', { id: 'c1', status: 'rejected' });
    expect(String(down.json.pingError)).toMatch(/unreachable/);
    const decisions = JSON.parse(readFileSync(join(dir, 'approvals_decisions.json'), 'utf8')) as { decisions: { c1: object[] } };
    expect(decisions.decisions.c1).toHaveLength(3);
  });
});
