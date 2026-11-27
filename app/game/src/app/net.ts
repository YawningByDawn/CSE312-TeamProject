import { makeAccount } from '../account';
import type { Account, Lobby, MatchSetup, MatchWorld, Net } from '../types';

// The course framework: its login, and when the build names its hub (`VITE_HG_NET`: `/ws`) its multiplayer socket.
// The auth service answers `/register`, `/login` and `/logout` (POST, JSON; nginx routes them); `/api/me` names who is
// logged in (`username` null: nobody) and is asked only where there is a hub. Only a logged-in player opens the socket,
// which the login cookie authorises. The hub relays a `game` message to every other player, stamped with its sender, and
// sends who is on in its `state` messages. A player hosts, searches, joins and leaves lobbies with `host`, `search`,
// `join` (a host's name), `leave` and, for the host, `start`; the hub answers with `lobby` (the one this player is in, null for none), `lobbies`
// (the open ones, with `refused` when a join was) and `match` (the shared mine the host's Start began, null once it ends or
// this player leaves it). In a match the player sends `input` (the heading held) and `strike` (an aim), and the hub sends
// `world`, the match as it stands, every tick. A socket that drops after opening reconnects, unless a newer tab took the
// player over (`kicked`).

const RECONNECT_MS = 1000;

type Message = {
  type: string; players?: { name: string }[]; from?: string; data?: unknown; lobby?: Lobby | null; lobbies?: Lobby[]; refused?: string;
  match?: MatchSetup | null;
} & Partial<MatchWorld>;

export function connectFramework(path: string | undefined): { account: Account; net: Net | null } {
  const listeners: ((from: string, data: unknown) => void)[] = [];
  const net: Net = {
    players: [], open: false, lobby: null, lobbies: [], refused: '', match: null, world: null, was: null, rev: 0,
    send: (data) => say({ type: 'game', data }),
    onGame: (f) => void listeners.push(f),
    host: () => say({ type: 'host' }),
    search: () => say({ type: 'search' }),
    join: (host) => say({ type: 'join', host }),
    leave: () => say({ type: 'leave' }),
    start: () => say({ type: 'start' }),
    move: (dx, dy) => say({ type: 'input', dx, dy }),
    strike: (dx, dy) => say({ type: 'strike', dx, dy }),
  };
  const say = (m: object): void => {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(m));
  };
  /** A match begins or ends: its steps so far go with the last. */
  const setMatch = (m: MatchSetup | null): void => {
    net.match = m;
    net.world = net.was = null;
    net.rev++;
  };
  let socket: WebSocket | null = null;
  const connect = (): void => {
    const s = (socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${path}`));
    let kicked = false;
    s.onopen = () => { net.open = true; };
    s.onmessage = (e) => {
      const m = JSON.parse(e.data as string) as Message;
      if (m.type === 'world') {
        if (net.match) [net.was, net.world] = [net.world, m as MatchWorld];
      } else if (m.type === 'kicked') kicked = true;
      else if (m.type === 'state') net.players = m.players!.map((p) => p.name);
      else if (m.type === 'game') for (const f of listeners) f(m.from!, m.data);
      else if (m.type === 'lobby') { net.lobby = m.lobby!; net.rev++; }
      else if (m.type === 'match') setMatch(m.match!);
      else if (m.type === 'lobbies') { net.lobbies = m.lobbies!; net.refused = m.refused ?? ''; net.rev++; }
    };
    s.onclose = () => {
      const was = net.open;
      net.open = false;
      net.players = [];
      net.lobby = null;
      net.lobbies = [];
      net.refused = '';
      setMatch(null);
      socket = null;
      if (was && !kicked) setTimeout(connect, RECONNECT_MS);
    };
  };
  const account = makeAccount();
  if (path) {
    void fetch('/api/me').then(async (r) => {
      account.name = ((await r.json()) as { username: string | null }).username;
      if (account.name !== null) connect();
    });
  }
  return { account, net: path ? net : null };
}
