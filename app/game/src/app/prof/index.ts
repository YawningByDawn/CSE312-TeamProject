import type { DebugApi } from '../../types';
import { wrapGpu } from './gpu';
import { count, resolution, segment } from './probe';
import { report, setResolution, text } from './report';

// The profiled page (`?prof=1`; F3 on the game's page loads it, F3 here leaves): every rAF callback runs as a frame's
// segment, the GPU's calls are counted, and a panel shows the top of the report twice a second.

/** Frames between panel refreshes. */
const EVERY = 30;
const TOP = 14;

/** The panel refreshes on the page's own rAF, outside the measured callbacks. */
function panel(raf: (cb: FrameRequestCallback) => number): void {
  const box = document.body.appendChild(document.createElement('div'));
  box.style.cssText = 'position:fixed;right:8px;top:8px;z-index:99;max-width:min(860px,96vw);background:#000c;color:#d8d0ff;'
    + 'font:11px/1.35 monospace;padding:6px 8px;border:1px solid #6a5acd;pointer-events:auto;white-space:pre;overflow:hidden';
  const bar = box.appendChild(document.createElement('div'));
  const copy = bar.appendChild(document.createElement('button'));
  copy.textContent = 'Copy report';
  const said = bar.appendChild(document.createElement('span'));
  said.textContent = '  F3 leaves the profiler';
  const out = box.appendChild(document.createElement('div'));
  copy.onclick = () => {
    void navigator.clipboard.writeText(text()).then(() => { said.textContent = '  copied'; });
  };
  let shown = -1;
  const tick = (): void => {
    if (count - shown >= EVERY) {
      shown = count;
      out.textContent = text().split('\n').slice(0, 11 + TOP).join('\n');
    }
    raf(tick);
  };
  raf(tick);
}

/** Before the game loads: frames by rAF, the GPU's calls, the panel; `window.__hg` gains the report once it boots. */
export function install(): void {
  setResolution(resolution());
  wrapGpu();
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((t) => segment(cb, t));
  panel(raf);
}

export function attach(): void {
  const hg = (window as unknown as { __hg: DebugApi }).__hg;
  hg.prof = report;
  hg.profText = () => text();
}
