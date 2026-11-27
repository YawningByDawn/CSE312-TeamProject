import { drawAnimal } from './animals';
import { HABITAT_COLOR, HABITAT_LABEL } from './hud';
import type { MeAlive, Species, World } from './types';

// The game's clickable panels: the evolution choice (each species the player's own leads to, or staying as it is for
// a stat point), the stat buttons that spend points on bite, skill, health or speed, and the whole evolution tree.
// Keys work too: 1, 2, 3... pick an evolution, the last number stays; Z, X, C and V raise bite, skill, health, speed.

const KIND_TEXT: Record<string, string> = {
  charge: 'charges, hurting what it hits',
  stomp: 'hurts and throws back all around',
  spit: 'spits a shot that hurts what it hits',
  pull: 'hurts and drags in all around',
};

function icon(sp: Species, size: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = cv.height = size * dpr;
  cv.style.width = cv.style.height = `${size}px`;
  const c = cv.getContext('2d')!;
  c.scale(dpr, dpr);
  c.beginPath();
  c.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
  c.fillStyle = '#f6efd9';
  c.fill();
  c.lineWidth = 3;
  c.strokeStyle = HABITAT_COLOR[sp.habitat] ?? '#fff';
  c.stroke();
  drawAnimal(c, sp.name, size / 2 - size * 0.05, size / 2, size * 0.27, 0, 0.4, 0);
  return cv;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export type Stat = 'bite' | 'ability' | 'health' | 'speed';

const STATS: [Stat, string, string, string][] = [
  ['bite', 'Bite', 'KeyZ', '+20% bite'],
  ['ability', 'Skill', 'KeyX', '+20% skill'],
  ['health', 'Health', 'KeyC', '+15% health'],
  ['speed', 'Speed', 'KeyV', '+5% speed'],
];

export interface Actions {
  evolve(to: number): void;
  upgrade(stat: Stat): void;
}

export class Panels {
  private shownOffer = '';
  private shownStats = '';
  private choices: number[] = [];

  constructor(
    private evolvePanel: HTMLElement,
    private statsPanel: HTMLElement,
    private actions: Actions,
  ) {
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.repeat) return;
      const n = Number(e.key);
      if (!this.evolvePanel.hidden && n >= 1 && n <= this.choices.length) this.actions.evolve(this.choices[n - 1]!);
      const stat = STATS.find(([, , code]) => code === e.code);
      if (!this.statsPanel.hidden && stat) this.actions.upgrade(stat[0]);
    });
  }

  /** Shows the panels that fit the player's numbers now; `me` is null while they are not playing. */
  update(me: MeAlive | null, world: World | null): void {
    const offerKey = me?.offer && world ? `${me.sp}:${me.offer.join(',')}` : '';
    if (offerKey !== this.shownOffer) {
      this.shownOffer = offerKey;
      this.evolvePanel.hidden = !offerKey;
      if (offerKey) this.renderOffer(me!, world!);
    }
    const statsKey = me && world && me.points > 0 ? `${me.points}:${me.bite}:${me.ability}:${me.health}:${me.speed}:${world.maxLevel}` : '';
    if (statsKey !== this.shownStats) {
      this.shownStats = statsKey;
      this.statsPanel.hidden = !statsKey;
      if (statsKey) this.renderStats(me!, world!);
    }
  }

  private renderOffer(me: MeAlive, world: World): void {
    const here = world.species[me.sp]!;
    this.choices = [...me.offer!, -1];
    const box = el('div', 'evolve-box');
    box.append(el('p', 'evolve-title', 'Ready to evolve! Pick a path'));
    const row = el('div', 'evolve-row');
    for (const [i, to] of this.choices.entries()) {
      const b = el('button', 'evolve-opt');
      b.type = 'button';
      if (to < 0) {
        b.classList.add('stay');
        b.append(icon(here, 52), el('b', '', `Stay ${here.name}`), el('small', '', '+1 stat point: bite, skill, health or speed'));
      } else {
        const sp = world.species[to]!;
        const habitat = el('small', 'habitat', HABITAT_LABEL[sp.habitat] ?? '');
        habitat.style.color = HABITAT_COLOR[sp.habitat] ?? '';
        b.append(icon(sp, 52), el('b', '', sp.name), habitat, el('small', 'hpatk', `HP ${sp.hp} · ATK ${sp.atk}`), el('small', '', `${sp.ability.name}: ${KIND_TEXT[sp.ability.kind] ?? ''}`));
      }
      b.append(el('kbd', '', `${i + 1}`));
      b.addEventListener('click', () => {
        b.blur(); // so Space boosts rather than pressing it again
        this.actions.evolve(to);
      });
      row.append(b);
    }
    box.append(row);
    this.evolvePanel.replaceChildren(box);
  }

  private renderStats(me: MeAlive, world: World): void {
    const box = el('div', 'stats-box');
    box.append(el('p', 'stats-title', `${me.points} stat point${me.points === 1 ? '' : 's'}`));
    for (const [stat, label, code, what] of STATS) {
      const lv = me[stat];
      const b = el('button', 'stat-btn');
      b.type = 'button';
      b.title = what;
      const maxed = lv >= world.maxLevel;
      b.disabled = maxed;
      b.append(el('span', '', maxed ? `${label} maxed` : `${label} ${lv} → ${lv + 1}`), el('kbd', '', code.slice(3)));
      b.addEventListener('click', () => {
        b.blur();
        this.actions.upgrade(stat);
      });
      box.append(b);
    }
    this.statsPanel.replaceChildren(box);
  }
}

/** Draws the whole evolution tree onto a canvas, tiers left to right, with `current` ringed. */
export function drawTree(cv: HTMLCanvasElement, world: World, current: number): void {
  const colW = 132;
  const rowH = 112;
  const tiers = Math.max(...world.species.map((s) => s.tier)) + 1;
  const columns: number[][] = Array.from({ length: tiers }, () => []);
  for (const [i, s] of world.species.entries()) columns[s.tier]!.push(i);
  const rows = Math.max(...columns.map((c) => c.length));
  const W = tiers * colW + 20;
  const H = rows * rowH + 60;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = W * dpr;
  cv.height = H * dpr;
  cv.style.width = `${W}px`;
  cv.style.height = `${H}px`;
  const c = cv.getContext('2d')!;
  c.scale(dpr, dpr);
  const at = new Map<number, [number, number]>();
  for (const [tier, col] of columns.entries()) {
    for (const [k, i] of col.entries()) at.set(i, [20 + tier * colW + colW / 2 - 10, 40 + (H - 60) / 2 + (k - (col.length - 1) / 2) * rowH]);
  }
  c.font = '700 12px ui-rounded, "Nunito", "Segoe UI", system-ui, sans-serif';
  c.textAlign = 'center';
  c.fillStyle = '#5b7a5a';
  for (let tier = 0; tier < tiers; tier++) c.fillText(tier >= 7 ? `Tier ${tier + 1} · mythic` : `Tier ${tier + 1}`, 20 + tier * colW + colW / 2 - 10, 18);
  c.lineWidth = 3;
  for (const [i, s] of world.species.entries()) {
    const [x, y] = at.get(i)!;
    for (const n of s.next) {
      const [nx, ny] = at.get(n)!;
      c.strokeStyle = HABITAT_COLOR[world.species[n]!.habitat] ?? '#ccc';
      c.globalAlpha = 0.7;
      c.beginPath();
      c.moveTo(x + 32, y);
      c.bezierCurveTo(x + 70, y, nx - 70, ny, nx - 32, ny);
      c.stroke();
      c.globalAlpha = 1;
    }
  }
  for (const [i, s] of world.species.entries()) {
    const [x, y] = at.get(i)!;
    c.beginPath();
    c.arc(x, y, 30, 0, Math.PI * 2);
    c.fillStyle = i === current ? '#fff3a8' : '#f6efd9';
    c.fill();
    c.lineWidth = i === current ? 5 : 3;
    c.strokeStyle = i === current ? '#f08a35' : (HABITAT_COLOR[s.habitat] ?? '#fff');
    c.stroke();
    drawAnimal(c, s.name, x - 2, y, 17, 0, 0.4, 0);
    c.fillStyle = '#233f27';
    c.font = '800 12px ui-rounded, "Nunito", "Segoe UI", system-ui, sans-serif';
    c.fillText(s.name, x, y + 46);
    c.fillStyle = '#5b7a5a';
    c.font = '600 10px ui-rounded, "Nunito", "Segoe UI", system-ui, sans-serif';
    c.fillText(`${s.ability.name} · ${s.hp}/${s.atk}`, x, y + 59);
  }
}
