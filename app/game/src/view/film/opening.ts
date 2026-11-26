import type { ViewModel } from '../../types';
import { smooth } from '../tables';
import openingUrl from '../../../assets/opening/opening.mp4?url';

// The opening (INTRO): the approved opening's last 8 s (the eye opens, the crystal rises, the god's thread spreads),
// recorded from the game as it stood before the rebuild with its own sound (docs/art-pipeline.md, Opening). One video
// over the canvas, under the panels: it follows the film's clock, holds when the clock holds, takes its loudness from
// the settings' master and music, and fades over its last half second onto the first gameplay view under it.

export const OPENING_S = 8;
const FADE = 0.5;
/** the video seeks to the film's clock when they drift further apart than this (s) */
const DRIFT = 0.15;

export class Opening {
  private readonly el = document.createElement('video');
  private last = -1;

  constructor(canvas: HTMLCanvasElement, muted: boolean) {
    const v = this.el;
    v.muted = muted;
    v.playsInline = true;
    v.preload = 'auto';
    v.hidden = true;
    v.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;pointer-events:none;background:#000';
    canvas.after(v);
  }

  /** Fetched once the first screen is up: the opening follows the title. */
  load(): void {
    this.el.src = openingUrl;
  }

  frame(vm: ViewModel): void {
    const v = this.el, f = vm.film, t = f?.kind === 'opening' ? f.t : -1;
    if (t < 0 || t >= OPENING_S) {
      if (!v.hidden) {
        v.pause();
        v.hidden = true;
      }
      this.last = -1;
      return;
    }
    v.hidden = false;
    const s = vm.settings;
    v.volume = s.master * s.master * s.music * s.music;
    v.style.opacity = String(1 - smooth(OPENING_S - FADE, OPENING_S, t));
    const held = t === this.last;
    this.last = t;
    if (held) return void v.pause();
    // a seek in flight leaves currentTime behind: one seek at a time, or each frame would restart it
    if (!v.seeking && Math.abs(v.currentTime - t) > DRIFT) v.currentTime = t;
    if (v.paused) void v.play();
  }
}
