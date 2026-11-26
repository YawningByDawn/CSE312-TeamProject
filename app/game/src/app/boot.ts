/// <reference path="./prof/probed.d.ts" />
// src/app, the shell that joins the tracks (src/main.ts builds them behind their interfaces). Owns the one pump
// (pump.ts: real seconds into whole sim ticks, what holds the clock, the films' time, the one camera, the view model
// handed each frame to the view, the ui and the audio), input (input.ts: keys and the pointer into intents and camera
// moves), the save and the settings in localStorage (save.ts), `window.__hg` (debug.ts), the course framework's login
// and game socket (net.ts) and the page's entry (this file). Reads every track through src/types; the sim's state
// changes only through `Sim.step` and `Sim.act`.
// The page's entry (index.html): the game, or with `?prof=1` the profiled game, a copy of every src module with a
// probe in each named function (tools/probes.ts, src/app/prof). The game's own modules carry no probe.
import { flag } from '../content/flags';
import { uiText } from '../content/text';

document.title = uiText('game.title');
if (flag('prof') === '1') {
  const prof = await import('./prof');
  prof.install();
  await import('../main.ts?prof');
  prof.attach();
} else await import('../main');
