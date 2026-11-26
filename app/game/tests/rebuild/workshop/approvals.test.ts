import { createServer, type Server } from 'node:http';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { approvals } from '../../../tools/workshop/approvals';

// The ping switch: off by default, set by POST api/approvals/ping; with it on, a ruling of approved, rejected or revise
// notes the card's session through the plane; a refusing or absent plane comes back in the decide answer.

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
  cards({ id: 'c1', title: 'A card', session: 'abcdef12-3456' }, { id: 'c2', title: 'No session' });
});

afterEach(() => { workshop.closeAllConnections(); plane.closeAllConnections(); workshop.close(); plane.close(); delete process.env.ZS_PLANE_PORT; });

describe('the approvals ping switch', () => {
  it('is off by default, set by the POST, and shown in the GET', async () => {
    const read = async () => ((await (await fetch(`${base}/w/api/approvals`)).json()) as { ping: boolean }).ping;
    expect(await read()).toBe(false);
    expect((await post('ping', { on: 'yes' })).status).toBe(400);
    await post('ping', { on: true });
    expect(await read()).toBe(true);
    expect(JSON.parse(readFileSync(join(dir, 'approvals_ping.json'), 'utf8'))).toEqual({ on: true });
  });

  it('sends no note while off, for a clear, or for a card with no session', async () => {
    await post('decide', { id: 'c1', status: 'approved' });
    await post('ping', { on: true });
    await post('decide', { id: 'c1', status: 'cleared' });
    await post('decide', { id: 'c2', status: 'rejected' });
    expect(got).toEqual([]);
  });

  it.each(['approved', 'rejected', 'revise'])('notes the posting session on %s', async (status) => {
    await post('ping', { on: true });
    const r = await post('decide', { id: 'c1', status, note: ' fix the gold ' });
    expect(r.json.pingError).toBeUndefined();
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({ path: '/api/messages', token: 'dev-local-token' });
    expect(got[0]!.body).toEqual({
      from_session: 'plane:approvals', from_origin: 'plane', to: 'abcdef12-3456', kind: 'note',
      body: `Workshop approvals: the owner ruled ${status} on "A card" (c1). Note: fix the gold`,
    });
  });

  it('ends the note with a period when the ruling has no note', async () => {
    await post('ping', { on: true });
    await post('decide', { id: 'c1', status: 'approved' });
    expect(got[0]!.body.body).toBe('Workshop approvals: the owner ruled approved on "A card" (c1).');
  });

  it('returns a refusing or unreachable plane in the answer, the ruling still recorded', async () => {
    await post('ping', { on: true });
    planeStatus = 503;
    const refused = await post('decide', { id: 'c1', status: 'approved' });
    expect(refused.status).toBe(200);
    expect(refused.json.pingError).toMatch(/503/);
    plane.closeAllConnections();
    plane.close();
    const down = await post('decide', { id: 'c1', status: 'rejected' });
    expect(String(down.json.pingError)).toMatch(/unreachable/);
    const decisions = JSON.parse(readFileSync(join(dir, 'approvals_decisions.json'), 'utf8')) as { decisions: { c1: object[] } };
    expect(decisions.decisions.c1).toHaveLength(2);
  });
});
