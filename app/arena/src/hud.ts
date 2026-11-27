import { drawAnimal } from './animals';
import type { Frame } from './view';
import type { World } from './types';

// The heads-up display, drawn on the canvas over the world in CSS pixels: the food chain, the leaderboard, the
// minimap, the player's bars, and the messages that come and go.

const FONT = 'ui-rounded, "Nunito", "Segoe UI", system-ui, sans-serif';
const TAU = Math.PI * 2;

interface Toast {
  text: string;
  color: string;
  t0: number;
}

function rounded(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

function bar(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, share: number, fill: string, label: string): void {
  rounded(c, x, y, w, h, h / 2);
  c.fillStyle = 'rgba(28,44,26,0.62)';
  c.fill();
  if (share > 0) {
    rounded(c, x + 2, y + 2, Math.max(h - 4, (w - 4) * Math.min(1, share)), h - 4, (h - 4) / 2);
    c.fillStyle = fill;
    c.fill();
  }
  c.font = `700 ${Math.round(h * 0.6)}px ${FONT}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.lineWidth = 3;
  c.strokeStyle = 'rgba(28,44,26,0.8)';
  c.strokeText(label, x + w / 2, y + h / 2 + 1);
  c.fillStyle = '#fff';
  c.fillText(label, x + w / 2, y + h / 2 + 1);
}

export class Hud {
  private toasts: Toast[] = [];
  private banner: { title: string; sub: string; t0: number } | null = null;

  toast(text: string, color = '#ffffff'): void {
    this.toasts.push({ text, color, t0: performance.now() / 1000 });
    if (this.toasts.length > 4) this.toasts.shift();
  }

  announce(title: string, sub: string): void {
    this.banner = { title, sub, t0: performance.now() / 1000 };
  }

  draw(c: CanvasRenderingContext2D, w: number, h: number, dpr: number, f: Frame, world: World | null, myName: string | null, playing: boolean): void {
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const t = performance.now() / 1000;
    const small = w < 700;
    const me = f.me?.alive ? f.me : null;

    if (me && f.threat > 0.05) {
      const g = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
      g.addColorStop(0, 'rgba(200,40,30,0)');
      g.addColorStop(1, `rgba(200,40,30,${0.32 * f.threat})`);
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    }
    if (!world) return;

    if (me && playing) {
      this.chain(c, world, me.sp, small);
      const sp = world.species[me.sp]!;
      const next = world.species[me.sp + 1];
      const bw = Math.min(560, w - 32);
      const x = (w - bw) / 2;
      const y = h - 44;
      const share = next ? (me.xp - sp.xp) / (next.xp - sp.xp) : 1;
      bar(c, x, y, bw, 26, share, '#f2b84b', next ? `${sp.name}  ·  ${me.xp} / ${next.xp} XP  →  ${next.name}` : `${sp.name}  ·  ${me.xp} XP  ·  top of the food chain`);
      const half = (bw - 8) / 2;
      bar(c, x, y - 26, half, 20, me.hunger / 100, '#e98a3c', `Hunger ${me.hunger}`);
      bar(c, x + half + 8, y - 26, half, 20, me.hp / 100, me.hp > 35 ? '#6cc24a' : '#e2533f', `Health ${me.hp}`);
      // the boost, a dial that fills as it cools down
      const bx = x + bw - 24;
      const by = y - 58;
      const ready = me.cooldown <= 0 && me.hunger >= 4;
      c.beginPath();
      c.arc(bx, by, 18, 0, TAU);
      c.fillStyle = 'rgba(28,44,26,0.62)';
      c.fill();
      c.beginPath();
      c.moveTo(bx, by);
      c.arc(bx, by, 15, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - me.cooldown / world.boost));
      c.closePath();
      c.fillStyle = ready ? '#8fd3ff' : 'rgba(143,211,255,0.45)';
      c.fill();
      c.font = `700 11px ${FONT}`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = '#16324a';
      c.fillText('BOOST', bx, by + 1);
    }

    // on a narrow screen the leaderboard goes under the food chain, and there is no room for the minimap
    const narrow = w < 560;
    this.leaderboard(c, w, narrow && me && playing ? 54 : 12, f, myName, small);
    if (!narrow) this.minimap(c, w, h, world, f, small);

    // toasts, top middle
    this.toasts = this.toasts.filter((m) => t - m.t0 < 3.2);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `700 16px ${FONT}`;
    for (const [i, m] of this.toasts.entries()) {
      const age = t - m.t0;
      c.globalAlpha = Math.min(1, age * 6, (3.2 - age) * 2);
      const y = (small ? 92 : 70) + i * 28;
      const tw = c.measureText(m.text).width + 28;
      rounded(c, w / 2 - tw / 2, y - 13, tw, 26, 13);
      c.fillStyle = 'rgba(28,44,26,0.62)';
      c.fill();
      c.fillStyle = m.color;
      c.fillText(m.text, w / 2, y + 1);
      c.globalAlpha = 1;
    }
    if (this.banner) {
      const age = t - this.banner.t0;
      if (age > 3) this.banner = null;
      else {
        const pop = Math.min(1, age * 5);
        c.globalAlpha = Math.min(1, (3 - age) * 2);
        c.save();
        c.translate(w / 2, h * 0.3);
        c.scale(0.7 + pop * 0.3, 0.7 + pop * 0.3);
        c.font = `800 ${small ? 30 : 42}px ${FONT}`;
        c.lineWidth = 7;
        c.strokeStyle = 'rgba(28,44,26,0.85)';
        c.strokeText(this.banner.title, 0, 0);
        c.fillStyle = '#fff3a8';
        c.fillText(this.banner.title, 0, 0);
        c.font = `600 ${small ? 15 : 18}px ${FONT}`;
        c.lineWidth = 4;
        c.strokeText(this.banner.sub, 0, small ? 32 : 40);
        c.fillStyle = '#ffffff';
        c.fillText(this.banner.sub, 0, small ? 32 : 40);
        c.restore();
        c.globalAlpha = 1;
      }
    }
  }

  /** The whole food chain, top left: green is food, red is danger. */
  private chain(c: CanvasRenderingContext2D, world: World, mine: number, small: boolean): void {
    const size = small ? 24 : 34;
    const n = world.species.length;
    const x0 = 12;
    const y0 = 12;
    rounded(c, x0 - 6, y0 - 6, n * size + 12, size + (small ? 12 : 30), 12);
    c.fillStyle = 'rgba(28,44,26,0.45)';
    c.fill();
    for (let i = 0; i < n; i++) {
      const cx = x0 + i * size + size / 2;
      const cy = y0 + size / 2;
      c.beginPath();
      c.arc(cx, cy, size / 2 - 2, 0, TAU);
      c.fillStyle = i < mine ? 'rgba(130,210,100,0.55)' : i === mine ? 'rgba(255,243,168,0.95)' : 'rgba(235,110,90,0.5)';
      c.fill();
      if (i === mine) {
        c.strokeStyle = '#fff';
        c.lineWidth = 2;
        c.stroke();
      }
      drawAnimal(c, i, cx - size * 0.06, cy, size * 0.27, 0, 0, 0);
    }
    if (!small) {
      c.font = `600 12px ${FONT}`;
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.fillStyle = '#fff';
      c.fillText('Eat the green · flee the red · bite your own size with a boost', x0, y0 + size + 11);
    }
  }

  private leaderboard(c: CanvasRenderingContext2D, w: number, y: number, f: Frame, myName: string | null, small: boolean): void {
    const rows = f.board.slice(0, small ? 5 : 10);
    if (rows.length === 0) return;
    const bw = small ? 150 : 200;
    const x = w - bw - 12;
    const lh = small ? 17 : 20;
    rounded(c, x, y, bw, 30 + rows.length * lh, 12);
    c.fillStyle = 'rgba(28,44,26,0.5)';
    c.fill();
    c.textBaseline = 'middle';
    c.font = `800 ${small ? 12 : 14}px ${FONT}`;
    c.textAlign = 'center';
    c.fillStyle = '#fff3a8';
    c.fillText('Biggest appetites', x + bw / 2, y + 15);
    c.font = `600 ${small ? 11 : 13}px ${FONT}`;
    for (const [i, r] of rows.entries()) {
      const ry = y + 32 + i * lh;
      const mine = !r.bot && r.name === myName;
      c.fillStyle = mine ? '#fff3a8' : r.bot ? 'rgba(255,255,255,0.7)' : '#ffffff';
      c.textAlign = 'left';
      const name = r.name.length > 13 ? `${r.name.slice(0, 12)}…` : r.name;
      c.fillText(`${i + 1}. ${name}`, x + 10, ry);
      c.textAlign = 'right';
      c.fillText(`${r.xp}`, x + bw - 10, ry);
    }
  }

  private minimap(c: CanvasRenderingContext2D, w: number, h: number, world: World, f: Frame, small: boolean): void {
    const size = small ? 90 : 140;
    const x = w - size - 12;
    const y = h - size - 12;
    const k = size / world.w;
    rounded(c, x, y, size, size, 10);
    c.fillStyle = 'rgba(28,44,26,0.5)';
    c.fill();
    c.save();
    c.clip();
    c.fillStyle = 'rgba(120,190,230,0.75)';
    for (const p of world.ponds) {
      c.beginPath();
      c.arc(x + p.x * k, y + p.y * k, Math.max(2, p.r * k), 0, TAU);
      c.fill();
    }
    c.fillStyle = 'rgba(110,180,90,0.7)';
    for (const b of world.bushes) {
      c.beginPath();
      c.arc(x + b.x * k, y + b.y * k, Math.max(1.5, b.r * k), 0, TAU);
      c.fill();
    }
    c.restore();
    const vw = (w / f.scale) * k;
    const vh = (h / f.scale) * k;
    c.strokeStyle = 'rgba(255,255,255,0.5)';
    c.lineWidth = 1;
    c.strokeRect(x + f.camX * k - vw / 2, y + f.camY * k - vh / 2, vw, vh);
    if (f.me?.alive) {
      c.beginPath();
      c.arc(x + f.camX * k, y + f.camY * k, 3.5, 0, TAU);
      c.fillStyle = '#fff3a8';
      c.fill();
    }
  }
}
