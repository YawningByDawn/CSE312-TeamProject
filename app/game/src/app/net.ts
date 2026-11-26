import type { Net } from '../types';

// Multiplayer: one socket to the host's hub, when the build names its path (`VITE_HG_NET`: the course framework's
// `/ws`, authorised by its login cookie). The hub relays a `game` message to every other player, stamped with its
// sender, and sends who is on in its `state` messages. A socket the hub refuses (not logged in) leaves the game solo;
// one that drops after opening reconnects, unless a newer tab took the player over (`kicked`).

const RECONNECT_MS = 1000;

export function connectNet(path: string): Net {
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
  connect();
  return net;
}
