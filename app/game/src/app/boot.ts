/// <reference path="./prof/probed.d.ts" />
import { flag } from '../content/flags';

// The page's entry (index.html): the game, or with `?prof=1` the profiled game, a copy of every src module with a
// probe in each named function (tools/probes.ts, src/app/prof). The game's own modules carry no probe.

if (flag('prof') === '1') {
  const prof = await import('./prof');
  prof.install();
  await import('../main.ts?prof');
  prof.attach();
} else await import('../main');
