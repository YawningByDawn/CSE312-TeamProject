import { installDebug } from './app/debug';
import { Input } from './app/input';
import { connectFramework } from './app/net';
import { Pump } from './app/pump';
import { flag } from './content/flags';
import { SOUNDS } from './content/sounds';
import { createAudio } from './audio';
import { makeSim } from './sim';
import { createUi } from './ui';
import { mountPanels } from './ui/panels';
import { createView } from './view';

// Boot: the tracks behind their interfaces, one pump, one rAF frame. `?scene=play` begins a run at once (no title, no
// opening); `?seed=N` fixes the seed; `?mute=1` mutes this load; `?fast=1` plays films eight times faster. The title logs in and out (the auth service's paths); a build
// with `VITE_HG_NET` (the course framework's) also asks who is logged in and joins the hub when logged in.

const FAST_FILMS = 8;

const canvas = document.getElementById('game') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui') as HTMLElement;
const seedFlag = Number(flag('seed'));
const seed = Number.isInteger(seedFlag) && seedFlag > 0 ? seedFlag : Math.floor(Math.random() * 0x7fffffff);
const netPath = import.meta.env.VITE_HG_NET as string | undefined;
const framework = connectFramework(netPath);

const { sim, query } = makeSim();
const muted = flag('mute') === '1';
const view = createView(canvas, window.devicePixelRatio || 1, query, muted);
const ui = createUi(mountPanels(framework.account, framework.net));
const audio = createAudio(query, SOUNDS, muted);
const pump = new Pump({ sim, query, view, ui, audio }, seed, flag('fast') === '1' ? FAST_FILMS : 1);
const input = new Input(pump, view, canvas);
installDebug(pump, sim, input, framework.net, framework.account);

function resize(): void {
  const w = uiRoot.parentElement!.clientWidth;
  const h = uiRoot.parentElement!.clientHeight;
  canvas.style.width = uiRoot.style.width = `${w}px`;
  canvas.style.height = uiRoot.style.height = `${h}px`;
  view.resize(w, h);
  input.resize(w, h);
}

window.addEventListener('resize', resize);

await Promise.all([view.load(), audio.load()]);
ui.mount(uiRoot, (i) => pump.send(i), query, (target, out) => view.where(target, out));
resize();
if (flag('scene') === 'play') pump.begin(sim.create(seed));

let last = performance.now();
requestAnimationFrame(function frame(now: number) {
  const dt = (now - last) / 1000;
  last = now;
  input.update(dt);
  pump.frame(dt);
  requestAnimationFrame(frame);
});
