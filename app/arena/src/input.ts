import type { Frame } from './view';

// Steering and boosting. The mouse steers: the creature heads for the pointer, slower the closer it is. WASD or the
// arrows steer instead while held. A click, Space or the touch button boosts; on a touch screen, a finger steers.

const KEYS: Record<string, [number, number]> = {
  KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
};

const typing = (e: Event): boolean => e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement;

export class Input {
  private px = NaN;
  private py = NaN;
  private touching = false;
  private touchy = false;
  private held = new Set<string>();
  private boost = false;

  constructor(canvas: HTMLCanvasElement, boostButton: HTMLButtonElement) {
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch' && !this.touching) return;
      this.px = e.clientX;
      this.py = e.clientY;
      this.held.clear();
    });
    canvas.addEventListener('pointerdown', (e) => {
      this.px = e.clientX;
      this.py = e.clientY;
      if (e.pointerType === 'touch') {
        this.touching = true;
        if (!this.touchy) {
          this.touchy = true;
          boostButton.hidden = false;
        }
      } else if (e.button === 0) this.boost = true;
    });
    window.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'touch') this.touching = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    boostButton.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.boost = true;
    });
    window.addEventListener('keydown', (e) => {
      if (typing(e)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) this.boost = true;
      } else if (KEYS[e.code]) {
        this.held.add(e.code);
      }
    });
    window.addEventListener('keyup', (e) => this.held.delete(e.code));
    window.addEventListener('blur', () => this.held.clear());
  }

  /** Where to steer, each in [-1, 1] and at most 1 long. */
  steer(f: Frame, w: number, h: number): { dx: number; dy: number } {
    if (this.held.size > 0) {
      let dx = 0;
      let dy = 0;
      for (const k of this.held) {
        dx += KEYS[k]![0];
        dy += KEYS[k]![1];
      }
      const m = Math.hypot(dx, dy);
      return m > 0 ? { dx: dx / m, dy: dy / m } : { dx: 0, dy: 0 };
    }
    if (Number.isNaN(this.px) || (this.touchy && !this.touching)) return { dx: 0, dy: 0 };
    const cx = f.mine?.x ?? w / 2;
    const cy = f.mine?.y ?? h / 2;
    const r = f.mine?.r ?? 20;
    const vx = this.px - cx;
    const vy = this.py - cy;
    const d = Math.hypot(vx, vy);
    if (d < r * 0.5) return { dx: 0, dy: 0 };
    const m = Math.min(1, (d - r * 0.5) / Math.max(60, Math.min(w, h) * 0.16));
    return { dx: (vx / d) * m, dy: (vy / d) * m };
  }

  /** Whether a boost was asked for since the last call. */
  takeBoost(): boolean {
    const b = this.boost;
    this.boost = false;
    return b;
  }
}
