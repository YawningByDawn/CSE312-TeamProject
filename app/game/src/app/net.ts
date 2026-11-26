import type { Account, Net } from '../types';

// The course framework, when the build names its hub (`VITE_HG_NET`: `/ws`): its login and its multiplayer socket.
// `/api/me` names who is logged in (`username` null: nobody); its page `/account` logs in, and `/logout` logs out.
// Only a logged-in player opens the socket, which the login cookie authorises. The hub relays a `game` message to
// every other player, stamped with its sender, and sends who is on in its `state` messages. A socket that drops after
// opening reconnects, unless a newer tab took the player over (`kicked`).

const RECONNECT_MS = 1000;

export function connectFramework(path: string): { account: Account; net: Net } {
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
    logIn: () => location.assign('/account'),
    logOut: () => void fetch('/logout', { method: 'POST' }).then(() => location.reload()),
  };
  void fetch('/api/me').then(async (r) => {
    account.name = ((await r.json()) as { username: string | null }).username;
    if (account.name !== null) connect();
  });
  return { account, net };
}
