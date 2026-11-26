#!/usr/bin/env node
// Size guard for src/: counts NON-BLANK lines of .ts files only (no other extension, no file outside src/).
// Usage: node tools/size.cjs [check|table]
// `check` (land.py runs it) exits 1 when
//   - a src/ file has more than MAX_FILE lines and is not in OVER;
//   - a file in OVER has grown past the count recorded there;
//   - an OVER entry is stale: the file is gone or is back to MAX_FILE lines or fewer (delete the entry).
//   - a file in OVER is below the count recorded there (set the entry to its count, so it cannot grow back).
// It then prints src/ total and per-top-folder lines against CEILING and FOLDER_CAP. Those are reported, not enforced:
// the ceiling starts failing the build once src/ is under it.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

const MAX_FILE = 400;
const CEILING = 21500;
/** Per top-level src/ folder; the caps sum to CEILING. */
const FOLDER_CAP = {
  sim: 6000, content: 5300, view: 5000, ui: 3000, app: 1000, types: 700, audio: 400, '(root)': 100,
};

/**
 * The files over MAX_FILE lines ("file": lines recorded). The list only shrinks: a file not here fails `check` when it
 * passes MAX_FILE and a listed file fails when it grows past its number. A branch never edits this list: `lower` (run by
 * land.py on main's side of a rebase) sets each number down to its file's count and drops files at MAX_FILE or fewer lines.
 */
const OVER = {
  'src/app/app.ts': 749,
  'src/audio/index.ts': 710,
  'src/content/cards.ts': 672,
  'src/content/days.ts': 434,
  'src/content/gems.ts': 701,
  'src/content/index.ts': 481,
  'src/content/ledger.ts': 426,
  'src/content/loop.ts': 431,
  'src/content/people.ts': 488,
  'src/content/town.ts': 552,
  'src/content/world.ts': 1387,
  'src/feel-gen/props/parts.ts': 492,
  'src/feel-gen/props/pen.ts': 477,
  'src/feel-gen/props/turn.ts': 514,
  'src/feel/camera.ts': 494,
  'src/life/stage.ts': 992,
  'src/life/stageEvents.ts': 644,
  'src/render/ambient/index.ts': 421,
  'src/render/ambient/mine.ts': 817,
  'src/render/ambient/town.ts': 925,
  'src/render/art/boulders.ts': 602,
  'src/render/art/props.ts': 892,
  'src/render/art/props2.ts': 1233,
  'src/render/crystal/anim.ts': 493,
  'src/render/crystal/forms.ts': 1084,
  'src/render/crystal/index.ts': 643,
  'src/render/crystal/inked.ts': 604,
  'src/render/crystal/marks.ts': 687,
  'src/render/crystal/paint.ts': 553,
  'src/render/effects.ts': 802,
  'src/render/fog.ts': 601,
  'src/render/fx/core.ts': 403,
  'src/render/fx/ink.ts': 1043,
  'src/render/fx/kinds/craft.ts': 406,
  'src/render/fx/kinds/crystal.ts': 945,
  'src/render/fx/kinds/god.ts': 699,
  'src/render/fx/kinds/loop.ts': 695,
  'src/render/fx/kinds/miracles.ts': 477,
  'src/render/fx/kinds/wick.ts': 447,
  'src/render/fx/kinds/world.ts': 465,
  'src/render/fx/sim.ts': 478,
  'src/render/mine/bake.ts': 962,
  'src/render/mine/dress/zones.ts': 512,
  'src/render/mine/dressing.ts': 446,
  'src/render/mine/index.ts': 2434,
  'src/render/mine/lit.ts': 522,
  'src/render/mine/thread.ts': 522,
  'src/render/people/animator.ts': 615,
  'src/render/people/cast/folk/body.ts': 704,
  'src/render/people/cast/folk/clips4.ts': 555,
  'src/render/people/cast/folk/pose.ts': 452,
  'src/render/people/clips.ts': 486,
  'src/render/people/figure.ts': 1245,
  'src/render/people/life.ts': 622,
  'src/render/terrain/shade.ts': 1299,
  'src/render/terrain/slabs.ts': 919,
  'src/render/theme/body.ts': 481,
  'src/render/theme/folk.ts': 719,
  'src/render/theme/kit.ts': 859,
  'src/render/theme/props/life.ts': 578,
  'src/render/theme/props/things.ts': 1048,
  'src/render/town/art/ground.ts': 1024,
  'src/render/town/index.ts': 1785,
  'src/render/town/rock.ts': 749,
  'src/render/town/tiles.ts': 579,
  'src/render/town/townPlan.ts': 410,
  'src/render/weather/index.ts': 418,
  'src/render/weather/sky.ts': 592,
  'src/render/weather/town.ts': 412,
  'src/render/world/index.ts': 1127,
  'src/render/world/valley.ts': 678,
  'src/render/world/valleyArt.ts': 1142,
  'src/scenes/cutscene/shotDescent.ts': 664,
  'src/scenes/front/defeat.ts': 418,
  'src/scenes/front/title.ts': 500,
  'src/scenes/play/hudbridge.ts': 823,
  'src/scenes/play/index.ts': 1274,
  'src/scenes/play/realsim.ts': 450,
  'src/scenes/play/shade/hud.ts': 417,
  'src/scenes/play/shade/index.ts': 694,
  'src/scenes/play/shade/model.ts': 407,
  'src/scenes/play/world.ts': 652,
  'src/sim/cards.ts': 516,
  'src/sim/content/events.ts': 984,
  'src/sim/crystals.ts': 519,
  'src/sim/effects.ts': 435,
  'src/sim/legal.ts': 640,
  'src/sim/life.ts': 691,
  'src/sim/living/events.ts': 1648,
  'src/sim/living/feed.ts': 414,
  'src/sim/living/plans.ts': 956,
  'src/sim/living/society.ts': 522,
  'src/sim/mining.ts': 728,
  'src/sim/selectors.ts': 685,
  'src/sim/state.ts': 421,
  'src/sim/town.ts': 716,
  'src/sim/turn.ts': 535,
  'src/sim/types.ts': 1071,
  'src/sim/views.ts': 552,
  'src/ui/play/building.ts': 846,
  'src/ui/play/guide.ts': 503,
  'src/ui/play/index.ts': 672,
  'src/ui/play/kit/cards.ts': 735,
  'src/ui/play/kit/interiors.ts': 697,
  'src/ui/play/kit/objects.ts': 421,
  'src/ui/play/kit/rooms.ts': 519,
  'src/ui/play/rest.ts': 462,
  'src/ui/play/types.ts': 790,
  'src/ui/settings.ts': 460,
};

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}
const lines = (f) => fs.readFileSync(f, 'utf8').split('\n').filter((l) => l.trim() !== '').length;
const folderOf = (f) => (f.split('/').length === 2 ? '(root)' : f.split('/')[1]);

const sizes = new Map(walk(path.join(root, 'src')).map((f) => [path.relative(root, f).split(path.sep).join('/'), lines(f)]));

function table() {
  const by = new Map();
  let total = 0;
  for (const [f, n] of sizes) { total += n; by.set(folderOf(f), (by.get(folderOf(f)) ?? 0) + n); }
  const over = [...sizes.values()].filter((n) => n > MAX_FILE);
  console.log(`src/ total ${total} of ${CEILING} (${total > CEILING ? 'over by ' + (total - CEILING) : 'under'}); ${sizes.size} files, ${over.length} over ${MAX_FILE} lines (${over.reduce((a, b) => a + b, 0)} lines)`);
  console.log('folder'.padEnd(12) + 'lines'.padStart(8) + 'cap'.padStart(8));
  for (const [k, n] of [...by.entries()].sort((a, b) => b[1] - a[1])) {
    const cap = FOLDER_CAP[k];
    console.log(k.padEnd(12) + String(n).padStart(8) + String(cap ?? '-').padStart(8) + (cap === undefined ? '  no cap' : n > cap ? `  over by ${n - cap}` : ''));
  }
}

function check() {
  const bad = [];
  for (const [f, n] of sizes) {
    if (n <= MAX_FILE) continue;
    if (!(f in OVER)) bad.push(`size: ${f} has ${n} lines, over ${MAX_FILE}; split it (a file is not added to OVER)`);
    else if (n > OVER[f]) bad.push(`size: ${f} grew from ${OVER[f]} to ${n} lines`);
  }
  for (const m of bad) console.error(m);
  table();
  if (bad.length) process.exit(1);
  console.log(`size: ok (${Object.keys(OVER).length} files over ${MAX_FILE} lines, each recorded in OVER)`);
}

/** Rewrites OVER to each file's count where it shrank, dropping files at MAX_FILE or fewer lines and gone files; never raises one. */
function lower() {
  const keep = Object.entries(OVER).filter(([f]) => (sizes.get(f) ?? 0) > MAX_FILE).map(([f, n]) => [f, Math.min(n, sizes.get(f))]);
  const body = keep.map(([f, n]) => `  '${f}': ${n},\n`).join('');
  const me = path.join(root, 'tools/size.cjs');
  const text = fs.readFileSync(me, 'utf8');
  fs.writeFileSync(me, text.replace(/^const OVER = \{\n[\s\S]*?^\};/m, `const OVER = {\n${body}};`));
  console.log(`size: OVER lowered to ${keep.length} files`);
}

const run = { check, table, lower };
const cmd = process.argv[2] ?? 'check';
if (run[cmd]) run[cmd]();
else { console.error('usage: node tools/size.cjs [check|table|lower]'); process.exit(2); }
