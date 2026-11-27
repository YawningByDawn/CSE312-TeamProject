import type { Creature, Food, Snap, StateMessage, World } from './types';

// The arena's socket: the hub's `/ws`, which only a logged-in player may open (the login cookie authorises it). The
// hub sends the map once ("world"), then a "state" a tick. Snapshots are kept for a second so the view can draw a
// little in the past, between two of them, and stay smooth whatever the tick rate.

const RECONNECT_MS = 1000;

/** Names arrive html-escaped, as every name the app sends; the canvas and textContent want them plain. */
function unescape(s: string): string {
  return s.includes('&') ? s.replace(/&(amp|lt|gt|#34|#39|quot);/g, (_, e: string) => ({ amp: '&', lt: '<', gt: '>', '#34': '"', '#39': "'", quot: '"' })[e]!) : s;
}

export type Status = 'offline' | 'connecting' | 'open' | 'lost' | 'kicked';

export class Net {
  world: World | null = null;
  snaps: Snap[] = [];
  status: Status = 'offline';
  private socket: WebSocket | null = null;
  private offset = NaN; // local seconds minus server seconds, from the quickest message lately
  private wanted = false;

  connect(): void {
    this.wanted = true;
    if (this.socket) return;
    this.status = 'connecting';
    const s = (this.socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`));
    let opened = false;
    s.onopen = () => {
      opened = true;
      this.status = 'open';
    };
    s.onmessage = (e) => this.receive(JSON.parse(e.data as string) as { type: string });
    s.onclose = () => {
      this.socket = null;
      this.snaps = [];
      this.offset = NaN;
      if (this.status === 'kicked') return;
      this.status = opened ? 'lost' : 'offline';
      if (this.wanted && opened) setTimeout(() => this.wanted && this.connect(), RECONNECT_MS);
    };
  }

  close(): void {
    this.wanted = false;
    this.socket?.close();
    this.socket = null;
    this.snaps = [];
    this.status = 'offline';
  }

  send(m: object): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(m));
  }

  /** The server's clock now, as best this side can tell. */
  serverNow(): number {
    return performance.now() / 1000 - this.offset;
  }

  private receive(m: { type: string }): void {
    if (m.type === 'world') {
      this.world = m as World;
      for (const s of this.world.species) s.name = unescape(s.name);
    } else if (m.type === 'kicked') {
      this.status = 'kicked';
    } else if (m.type === 'state') {
      const st = m as StateMessage;
      const o = performance.now() / 1000 - st.t;
      if (Number.isNaN(this.offset) || o < this.offset || o - this.offset > 1) this.offset = o;
      else this.offset += (o - this.offset) * 0.01;
      const creatures = new Map<number, Creature>();
      for (const [id, x, y, a, sp, hp, flags, name] of st.c) creatures.set(id, { id, x, y, a, sp, hp, flags, name: unescape(name) });
      const food = new Map<number, Food>();
      for (const [id, x, y, kind] of st.f) food.set(id, { id, x, y, kind });
      if (st.me && !st.me.alive) st.me.by = unescape(st.me.by);
      for (const row of st.lb) row.name = unescape(row.name);
      this.snaps.push({ t: st.t, x: st.x, y: st.y, me: st.me, creatures, food, eaten: st.e, board: st.lb, played: false });
      const keep = st.t - 1;
      while (this.snaps.length > 2 && this.snaps[0]!.t < keep) this.snaps.shift();
    }
  }
}
