import type { Account, Net } from '../types';

// The course framework: its login, and when the build names its hub (`VITE_HG_NET`: `/ws`) its multiplayer socket.
// The auth service answers `/register`, `/login` and `/logout` (POST, JSON; nginx routes them); `/api/me` names who is
// logged in (`username` null: nobody) and is asked only where there is a hub. Only a logged-in player opens the socket,
// which the login cookie authorises. The hub relays a `game` message to every other player, stamped with its sender, and
// sends who is on in its `state` messages. A socket that drops after opening reconnects, unless a newer tab took the
// player over (`kicked`).

const RECONNECT_MS = 1000;

export function connectFramework(path: string | undefined): { account: Account; net: Net | null } {
  const listeners: ((from: string, data: unknown) => void)[] = [];
  const net: Net = {
    players: [],
    open: false,
    send(data) {
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'game', data }));
    },
    onGame(f) {
      listeners.push(f);
    },
  };
  let socket: WebSocket | null = null;
  const connect = (): void => {
    const s = (socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${path}`));
    let kicked = false;
    s.onopen = () => { net.open = true; };
    s.onmessage = (e) => {
      const m = JSON.parse(e.data as string) as { type: string; players?: { name: string }[]; from?: string; data?: unknown };
      if (m.type === 'kicked') kicked = true;
      else if (m.type === 'state') net.players = m.players!.map((p) => p.name);
      else if (m.type === 'game') for (const f of listeners) f(m.from!, m.data);
    };
    s.onclose = () => {
      const was = net.open;
      net.open = false;
      net.players = [];
      socket = null;
      if (was && !kicked) setTimeout(connect, RECONNECT_MS);
    };
  };
  const account: Account = {
    name: null,
    signIn: async (mode, username, password) => {
      const post = (to: string): Promise<Response> => fetch(to, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
      let r = await post(`/${mode}`);
      if (r.ok && mode === 'register') r = await post('/login');
      if (r.ok) {
        location.reload();
        return null;
      }
      // the auth service answers a refusal as `{ error }`; anything else is not it
      if (r.headers.get('Content-Type')?.includes('json')) return ((await r.json()) as { error: string }).error;
      throw new Error(`${r.status}`);
    },
    logOut: () => void fetch('/logout', { method: 'POST' }).then(() => location.reload()),
  };
  if (path) {
    void fetch('/api/me').then(async (r) => {
      account.name = ((await r.json()) as { username: string | null }).username;
      if (account.name !== null) connect();
    });
  }
  return { account, net: path ? net : null };
}
