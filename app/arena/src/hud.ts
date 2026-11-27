import { drawAnimal } from './animals';
import type { Frame } from './view';
import type { Circle, World } from './types';

const within = (set: Circle[], x: number, y: number): boolean => set.some((k) => Math.hypot(x - k.x, y - k.y) < k.r);

/** What the ground under a player means for them, if anything special. */
function terrainHint(world: World, x: number, y: number, tier: number, habitat: string): string {
  const climber = tier <= world.climbTier || habitat === 'air';
  if (within(world.rocks, x, y) && climber) return 'Up on the rocks: nothing bigger than tier ' + (world.climbTier + 1) + ' can follow (but fliers can)';
  if (within(world.reefs, x, y) && climber) return 'In the reef: nothing bigger than tier ' + (world.climbTier + 1) + ' fits (but fliers can)';
  if (within(world.tar, x, y) && habitat !== 'air') return climber ? 'Tar pit: light enough to skitter across. Big ones bog down here' : 'Tar pit: you are bogged down! Get out';
  if (within(world.islands, x, y)) return 'An island: sea creatures are stranded here';
  return '';
}

// The heads-up display, drawn on the canvas over the world in CSS pixels: what the player is, the leaderboard, the
// minimap, the bars and dials, and the messages that come and go. The evolution choice and the stat buttons are DOM
// (main.ts), since they are clicked.

const FONT = 'ui-rounded, "Nunito", "Segoe UI", system-ui, sans-serif';
const TAU = Math.PI * 2;

export const HABITAT_LABEL: Record<string, string> = { land: 'Land', sea: 'Sea', amph: 'Land & water', air: 'Flies' };
export const HABITAT_COLOR: Record<string, string> = { land: '#8fcf6a', sea: '#6cc2f0', amph: '#6adcc0', air: '#f2c45a' };

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

/** A round dial that fills as something cools down. */
function dial(c: CanvasRenderingContext2D, x: number, y: number, ready: number, color: string, label: string, key: string): void {
  c.beginPath();
  c.arc(x, y, 21, 0, TAU);
  c.fillStyle = 'rgba(28,44,26,0.62)';
  c.fill();
  c.beginPath();
  c.moveTo(x, y);
  c.arc(x, y, 18, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0, Math.min(1, ready)));
  c.closePath();
  c.globalAlpha = ready >= 1 ? 1 : 0.45;
  c.fillStyle = color;
  c.fill();
  c.globalAlpha = 1;
  c.font = `800 10px ${FONT}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = '#1a2a1a';
  c.fillText(label, x, y - 2);
  c.font = `700 9px ${FONT}`;
  c.fillText(key, x, y + 8);
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

  /** `bottom` is how much of the screen's foot the DOM panels take, so the bars sit above them. */
  draw(c: CanvasRenderingContext2D, w: number, h: number, dpr: number, f: Frame, world: World | null, myName: string | null, playing: boolean, bottom: number): void {
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const t = performance.now() / 1000;
    const small = w < 700;
    const narrow = w < 560;
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
      const sp = world.species[me.sp]!;
      this.card(c, world, me.sp, me.bite, me.ability, me.health, me.speed, small);
      const need = world.needs[sp.tier] ?? 1;
      const bw = Math.min(560, w - 32);
      const x = (w - bw) / 2;
      const y = h - 44 - bottom;
      const top = sp.next.length === 0;
      const label = me.offer ? `${sp.name}  ·  ready to evolve!` : `${sp.name}  ·  ${me.progress} / ${need} XP  →  ${top ? 'stat point' : 'evolve'}`;
      bar(c, x, y, bw, 26, me.offer ? 1 : me.progress / need, me.offer ? '#8fe05a' : '#f2b84b', label);
      const half = (bw - 8) / 2;
      bar(c, x, y - 26, half, 20, me.hunger / 100, '#e98a3c', `Hunger ${me.hunger}`);
      bar(c, x + half + 8, y - 26, half, 20, me.hp / me.maxHp, me.hp > me.maxHp * 0.35 ? '#6cc24a' : '#e2533f', `Health ${me.hp}`);
      dial(c, x + bw - 22, y - 58, 1 - me.cooldown / world.boost, '#8fd3ff', 'BOOST', small ? '' : 'Space');
      dial(c, x + bw - 72, y - 58, 1 - me.abilityCd / sp.ability.cooldown, '#ffb14a', 'SKILL', small ? '' : 'E');
      const hint = terrainHint(world, f.camX, f.camY, sp.tier, sp.habitat);
      if (hint) { // top middle, clear of the evolution choice
        c.font = `700 ${small ? 12 : 14}px ${FONT}`;
        const tw = Math.min(w - 24, c.measureText(hint).width + 28);
        const hy = small ? 108 : 16;
        rounded(c, (w - tw) / 2, hy, tw, 26, 13);
        c.fillStyle = 'rgba(28,44,26,0.72)';
        c.fill();
        c.fillStyle = '#ffe9a8';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(hint, w / 2, hy + 14, tw - 20);
      }
    }

    this.leaderboard(c, w, narrow && me && playing ? 80 : 12, f, myName, small);
    if (!narrow) this.minimap(c, w, h, world, f, small);

    // toasts, top middle
    this.toasts = this.toasts.filter((m) => t - m.t0 < 3.2);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `700 16px ${FONT}`;
    for (const [i, m] of this.toasts.entries()) {
      const age = t - m.t0;
      c.globalAlpha = Math.min(1, age * 6, (3.2 - age) * 2);
      const y = (small ? 140 : 70) + i * 28;
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

  /** What the player is, top left: its picture, name, home and ability, and the levels bought with stat points. */
  private card(c: CanvasRenderingContext2D, world: World, spIndex: number, bite: number, ability: number, health: number, speed: number, small: boolean): void {
    const sp = world.species[spIndex]!;
    const x = 12;
    const y = 12;
    const size = small ? 46 : 56;
    const bw = small ? 190 : 260;
    rounded(c, x, y, bw, size + 12, 14);
    c.fillStyle = 'rgba(28,44,26,0.55)';
    c.fill();
    c.beginPath();
    c.arc(x + 6 + size / 2, y + 6 + size / 2, size / 2, 0, TAU);
    c.fillStyle = 'rgba(255,243,168,0.9)';
    c.fill();
    c.strokeStyle = HABITAT_COLOR[sp.habitat] ?? '#fff';
    c.lineWidth = 3;
    c.stroke();
    drawAnimal(c, sp.name, x + 6 + size / 2 - size * 0.06, y + 6 + size / 2, size * 0.3, 0, 0, 0);
    const tx = x + size + 16;
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
    c.fillStyle = '#fff';
    c.font = `800 ${small ? 15 : 17}px ${FONT}`;
    c.fillText(sp.name, tx, y + (small ? 24 : 26));
    c.font = `600 ${small ? 11 : 12}px ${FONT}`;
    c.fillStyle = HABITAT_COLOR[sp.habitat] ?? '#fff';
    c.fillText(`Tier ${sp.tier + 1} · ${HABITAT_LABEL[sp.habitat] ?? ''}`, tx, y + (small ? 39 : 43));
    c.fillStyle = 'rgba(255,255,255,0.9)';
    const atk = Math.round(sp.atk * (1 + 0.2 * bite));
    const hp = Math.round(sp.hp * (1 + 0.15 * health));
    const levels = [['Bite', bite], ['Skill', ability], ['HP', health], ['Spd', speed]].filter(([, lv]) => lv).map(([n, lv]) => `${n}+${lv}`).join(' ');
    c.fillText(small ? `HP ${hp} · ATK ${atk}` : `HP ${hp} · ATK ${atk} · ${levels || sp.ability.name}`, tx, y + (small ? 53 : 60));
    if (!small) {
      // what the outlines mean
      rounded(c, x, y + size + 16, 196, 22, 11);
      c.fillStyle = 'rgba(28,44,26,0.55)';
      c.fill();
      c.font = `700 12px ${FONT}`;
      c.fillStyle = '#7dff8f';
      c.fillText('● green: prey', x + 10, y + size + 31);
      c.fillStyle = '#ff8a80';
      c.fillText('● red: predator', x + 98, y + size + 31);
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
    const mw = small ? 110 : 168;
    const k = mw / world.w;
    const mh = world.h * k;
    const x = w - mw - 12;
    const y = h - mh - 12;
    rounded(c, x, y, mw, mh, 10);
    c.fillStyle = 'rgba(40,70,36,0.6)';
    c.fill();
    c.save();
    c.clip();
    c.beginPath();
    for (const [i, cx] of world.coast.entries()) c.lineTo(x + cx * k, y + i * world.coastStep * k);
    c.lineTo(x + mw, y + mh + 10);
    c.lineTo(x + mw, y);
    c.closePath();
    c.fillStyle = 'rgba(60,140,200,0.75)';
    c.fill();
    c.fillStyle = 'rgba(120,190,230,0.75)';
    for (const p of world.ponds) {
      c.beginPath();
      c.arc(x + p.x * k, y + p.y * k, Math.max(2, p.r * k), 0, TAU);
      c.fill();
    }
    c.fillStyle = 'rgba(110,180,90,0.7)';
    for (const b of world.bushes) {
      c.beginPath();
      c.arc(x + b.x * k, y + b.y * k, Math.max(1.2, b.r * k), 0, TAU);
      c.fill();
    }
    c.fillStyle = 'rgba(150,200,110,0.95)';
    for (const b of world.islands) {
      c.beginPath();
      c.arc(x + b.x * k, y + b.y * k, Math.max(2, b.r * k), 0, TAU);
      c.fill();
    }
    c.fillStyle = 'rgba(30,22,15,0.9)';
    for (const b of world.tar) {
      c.beginPath();
      c.arc(x + b.x * k, y + b.y * k, Math.max(1.5, b.r * k), 0, TAU);
      c.fill();
    }
    c.fillStyle = 'rgba(200,196,186,0.95)';
    for (const b of world.rocks) {
      c.beginPath();
      c.arc(x + b.x * k, y + b.y * k, Math.max(1.2, b.r * k), 0, TAU);
      c.fill();
    }
    c.fillStyle = 'rgba(240,140,120,0.95)';
    for (const b of world.reefs) {
      c.beginPath();
      c.arc(x + b.x * k, y + b.y * k, Math.max(1.2, b.r * k), 0, TAU);
      c.fill();
    }
    c.fillStyle = 'rgba(60,120,70,0.8)';
    for (const b of world.kelp) {
      c.beginPath();
      c.arc(x + b.x * k, y + b.y * k, Math.max(1.2, b.r * k), 0, TAU);
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
