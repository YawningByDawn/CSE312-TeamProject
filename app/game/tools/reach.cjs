#!/usr/bin/env node
// Reachability sweep: classifies every file under src/ as
//   shipped   reachable from index.html -> src/main.ts
//   tool-only not shipped, reachable from dev/*.html, dev/, scripts/, tests/, e2e/ or tools/
//   dead      reachable from nothing
// Imports are resolved by Vite's own bundler (vite build with the project's config), so
// import.meta.glob, new Worker(new URL(...)), ?raw / ?url imports and dynamic import() resolve exactly as they do
// in the shipped build. Reachability is the module graph, before tree-shaking.
// `check` (land.py runs it) exits 1 on any dead file, on any tool-only file not in REMAINING, and on any REMAINING entry
// that is no longer tool-only (moved, deleted or shipped), so the list only shrinks.
// Usage: node tools/reach.cjs [--json | check]
'use strict';
const fs = require('node:fs');
const cp = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

const TOOL_DIRS = ['dev', 'scripts', 'tests', 'e2e', 'tools'];
const CODE = /\.(ts|cjs|mjs|js)$/;
/** A licence text shipped beside the fonts it covers: not code, never classified. */
const LICENCE = /\/OFL\.txt$/;

/**
 * The tool-only src/ files that remain (kept for a generator, dev page or test), each under the queue row whose work moves
 * it out of src/ or deletes it. The list only shrinks: a tool-only file not here fails `check`, and so does an entry that
 * is no longer tool-only, so the row that clears one deletes its line.
 */
const REMAINING = {};

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const rel = (p) => path.relative(root, p).split(path.sep).join('/');
const strip = (id) => id.split('?')[0].replace(/^\0/, '');

/** Ids whose source can import nothing further (images, audio, fonts, binaries): the graph needs the id, never the bytes. */
const LEAF = /\.(?!(ts|tsx|js|mjs|cjs|jsx|json|html|css)$)\w+$/;

/**
 * One vite build; every module id that enters the graph (workers' sub-builds included) lands in `seen`. A package never
 * imports src/, so every bare import is left external, and a leaf asset loads as an empty module: the build walks the
 * project's own code only.
 */
async function graph(vite, input, ssr) {
  const seen = new Set();
  const recorder = {
    name: 'reach-recorder',
    buildEnd() { for (const id of this.getModuleIds()) seen.add(strip(id)); },
  };
  const graphOnly = {
    name: 'reach-graph-only',
    enforce: 'pre',
    resolveId(spec) { return /^[\w@]/.test(spec) && !path.isAbsolute(spec) ? { id: spec, external: true } : null; },
    load(id) { return LEAF.test(strip(id)) ? 'export default ""' : null; },
  };
  const inline = {
    root,
    configFile: false, // vite.config.ts lists every dev/*.html page in rollupOptions.input; merged in, it would make the dev pages "shipped"
    logLevel: 'silent',
    plugins: [graphOnly, recorder],
    worker: { plugins: () => [graphOnly, recorder] },
    build: { write: false, minify: false, reportCompressedSize: false, ssr, rollupOptions: { input } },
  };
  await vite.build(inline);
  return seen;
}

/** Type-only imports leave no runtime module, but the typecheck needs the file: the program tsc builds from `files` closes over them. */
function typeClosure(files) {
  const dir = fs.mkdtempSync(path.join(root, 'node_modules', '.reach-'));
  const cfg = path.join(dir, 'tsconfig.json');
  fs.writeFileSync(cfg, JSON.stringify({ extends: path.join(root, 'tsconfig.json'), compilerOptions: { rootDir: '/' }, include: [], files }));
  try {
    const r = cp.spawnSync(path.join(root, 'node_modules/.bin/tsc'), ['--listFilesOnly', '-p', cfg], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 });
    const out = r.stdout;
    if (!out.includes('lib.es5.d.ts')) throw new Error('tsc --listFilesOnly failed: ' + (r.stderr || out).slice(0, 500));
    return new Set(out.split('\n').filter((l) => l && !l.includes('/node_modules/')).map((l) => path.resolve(l.trim())));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

/** Tool files name src files by path string (readFileSync('src/...'), spawn args): keep those as tool-only. */
function pathMentions(files, srcSet) {
  const hit = new Set();
  const re = /src\/[A-Za-z0-9_./-]+/g;
  for (const f of files) {
    if (!CODE.test(f) && !/\.(py|sh|html)$/.test(f)) continue;
    const text = fs.readFileSync(f, 'utf8');
    for (const m of text.matchAll(re)) {
      const p = m[0].replace(/[.\/]+$/, '');
      if (srcSet.has(p)) hit.add(p);
      else for (const s of srcSet) if (s.startsWith(p + '/')) hit.add(s);
    }
  }
  return hit;
}

function check(files) {
  const owner = new Map(Object.entries(REMAINING).flatMap(([row, fs_]) => fs_.map((f) => [f, row])));
  const cls = new Map(files.map((f) => [f.file, f.cls]));
  const errs = [];
  for (const f of files) {
    if (f.cls === 'dead') errs.push(`reach: ${f.file} is reachable from nothing; delete it`);
    else if (f.cls === 'tool-only' && !owner.has(f.file)) errs.push(`reach: ${f.file} is reached only from tools, dev pages or tests, not from src/main.ts; move it out of src/ or add it to REMAINING in tools/reach.cjs under its owning row`);
  }
  for (const [f, row] of owner) if (cls.get(f) !== 'tool-only') errs.push(`reach: ${f} (${row}) is no longer tool-only (${cls.get(f) ?? 'gone'}); delete it from REMAINING in tools/reach.cjs`);
  for (const e of errs) console.error(e);
  if (errs.length) process.exit(1);
  console.log(`reach: ok (no dead file, ${owner.size} tool-only files, each owned by a row)`);
}

async function main() {
  const json = process.argv.includes('--json');
  const vite = await import(require.resolve('vite', { paths: [root] }));
  const srcFiles = walk(path.join(root, 'src')).filter((f) => !f.endsWith('.gitkeep')).map(rel).filter((f) => !LICENCE.test(f)).sort();
  const srcSet = new Set(srcFiles);

  const shipped = await graph(vite, { main: path.join(root, 'index.html') }, false);
  for (const id of typeClosure([...shipped].filter((f) => /\.ts$/.test(f) && f.startsWith(root + '/src/')))) shipped.add(id);

  const devHtml = walk(path.join(root, 'dev')).filter((f) => f.endsWith('.html'));
  const toolCode = TOOL_DIRS.flatMap((d) => walk(path.join(root, d))).filter((f) => CODE.test(f));
  toolCode.push(path.join(root, 'vite.config.ts'));
  const toolFiles = TOOL_DIRS.flatMap((d) => walk(path.join(root, d)));
  const tool = new Set();
  const browserIn = Object.fromEntries(devHtml.map((f) => ['dev-' + path.basename(f, '.html'), f]));
  for (const id of await graph(vite, browserIn, false)) tool.add(id);
  const nodeIn = Object.fromEntries(toolCode.map((f) => [rel(f), f]));
  for (const id of await graph(vite, nodeIn, true)) tool.add(id);
  for (const id of typeClosure(toolCode.filter((f) => /\.ts$/.test(f)))) tool.add(id);
  for (const p of pathMentions(toolFiles, srcSet)) tool.add(path.join(root, p));

  const lines = (f) => { const t = fs.readFileSync(path.join(root, f), 'utf8'); return t === '' ? 0 : t.split('\n').length - (t.endsWith('\n') ? 1 : 0); };
  const files = srcFiles.map((f) => {
    const abs = path.join(root, f);
    const cls = shipped.has(abs) ? 'shipped' : tool.has(abs) ? 'tool-only' : 'dead';
    return { file: f, folder: f.split('/').slice(0, 2).join('/'), cls, lines: lines(f) };
  });

  if (process.argv.includes('check')) { check(files); return; }

  const folders = {};
  const total = { shipped: [0, 0], 'tool-only': [0, 0], dead: [0, 0] };
  for (const f of files) {
    const t = (folders[f.folder] ??= { shipped: [0, 0], 'tool-only': [0, 0], dead: [0, 0] });
    t[f.cls][0]++; t[f.cls][1] += f.lines;
    total[f.cls][0]++; total[f.cls][1] += f.lines;
  }
  if (json) { process.stdout.write(JSON.stringify({ total, folders, files }, null, 1) + '\n'); return; }

  const row = (name, t) => name.padEnd(26) + ['shipped', 'tool-only', 'dead'].map((c) => (t[c][0] + 'f ' + t[c][1] + 'l').padStart(16)).join('') + (String(Object.values(t).reduce((a, x) => a + x[1], 0)) + 'l').padStart(10);
  console.log('folder'.padEnd(26) + ['shipped', 'tool-only', 'dead'].map((c) => c.padStart(16)).join('') + 'total'.padStart(10));
  for (const k of Object.keys(folders).sort()) console.log(row(k, folders[k]));
  console.log(row('TOTAL', total));
  for (const c of ['tool-only', 'dead']) {
    console.log(`\n${c}:`);
    for (const f of files.filter((x) => x.cls === c)) console.log(`${String(f.lines).padStart(6)} ${f.file}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
