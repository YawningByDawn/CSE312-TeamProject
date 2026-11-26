#!/usr/bin/env node
// Systems survey of src/: lines per system (shipped / tool-only, from tools/reach.cjs), who imports each system,
// import-direction violations of contract.md, query switches per system, `void x;` lines.
// Usage: node tools/systems.cjs [table|edges|violations|check|switches|switch-lines|voids|entry <system>|all]
// `check` exits 1 on any violation not in REMAINING and on any REMAINING entry that no longer violates (land.py runs it).
'use strict';
const fs = require('node:fs');
const cp = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

/** A system is a top-level src/ folder; src/sim, content, view, ui and app split one level further. */
const SPLIT = new Set(['sim', 'content', 'view', 'ui', 'app']);
function systemOf(f) {
  const p = f.split('/'); // src/<a>/<b>/...
  if (p.length === 2) return 'src/(root)';
  if (SPLIT.has(p[1]) && p.length > 3) return p.slice(0, 3).join('/');
  if (SPLIT.has(p[1])) return p[0] + '/' + p[1] + '/(root)';
  return p.slice(0, 2).join('/');
}
const layerOf = (f) => (f.split('/').length === 2 ? 'main' : f.split('/')[1]);

/** contract.md: types import nothing; content imports types; sim content and types; view, ui, audio sim, content and types; app and main all. */
const ALLOWED = {
  types: ['types'], content: ['content', 'types'], sim: ['sim', 'content', 'types'],
  view: ['view', 'sim', 'content', 'types'], ui: ['ui', 'sim', 'content', 'types'], audio: ['audio', 'sim', 'content', 'types'],
};

/** Every file under src/ (the import graph's nodes). */
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (!e.name.startsWith('.')) out.push(path.relative(root, p).split(path.sep).join('/'));
  }
  return out;
}
let files = walk(path.join(root, 'src')).sort().map((file) => ({ file }));
let byFile = new Map(files.map((f) => [f.file, f]));
/** The survey commands' files with their shipped / tool-only class and line count, from tools/reach.cjs (`check` needs neither). */
function classify() {
  files = JSON.parse(cp.execFileSync('node', [path.join(__dirname, 'reach.cjs'), '--json'], { cwd: root, maxBuffer: 1 << 28 }).toString()).files;
  byFile = new Map(files.map((f) => [f.file, f]));
}

const RES = ['.ts', '/index.ts', '.tsx', '.js', ''];
function resolve(from, spec) {
  if (!spec.startsWith('.')) return null;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
  for (const e of RES) if (byFile.has(base + e)) return base + e;
  return null;
}
const IMPORT = [
  /\b(import|export)(\s+type)?\s[^'"`;]*?\sfrom\s*['"]([^'"]+)['"]/g,
  /\bimport(\s+type)?\s*['"]([^'"]+)['"]/g,
  /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
];
const text = new Map();
const edges = []; // {from, to, line, type}
for (const f of files) {
  const t = fs.readFileSync(path.join(root, f.file), 'utf8');
  text.set(f.file, t);
  const lineAt = (i) => t.slice(0, i).split('\n').length;
  for (const [k, re] of IMPORT.entries()) {
    for (const m of t.matchAll(re)) {
      const spec = k === 0 ? m[3] : k === 1 ? m[2] : m[1];
      const type = k === 0 ? !!m[2] : k === 1 ? !!m[1] : false;
      const to = resolve(f.file, spec);
      if (to) edges.push({ from: f.file, to, line: lineAt(m.index), type });
    }
  }
}

function table() {
  const sys = new Map();
  for (const f of files) {
    const s = sys.get(systemOf(f.file)) ?? { n: 0, shipped: 0, tool: 0 };
    s.n++; f.cls === 'shipped' ? (s.shipped += f.lines) : (s.tool += f.lines);
    sys.set(systemOf(f.file), s);
  }
  const rows = [...sys.entries()].sort((a, b) => b[1].shipped + b[1].tool - a[1].shipped - a[1].tool);
  console.log('system'.padEnd(30) + 'files'.padStart(6) + 'shipped'.padStart(9) + 'tool-only'.padStart(10) + 'total'.padStart(8));
  for (const [k, s] of rows) console.log(k.padEnd(30) + String(s.n).padStart(6) + String(s.shipped).padStart(9) + String(s.tool).padStart(10) + String(s.shipped + s.tool).padStart(8));
}

function edgesTable() {
  const m = new Map();
  for (const e of edges) {
    const a = systemOf(e.from), b = systemOf(e.to);
    if (a === b) continue;
    const k = a + ' -> ' + b;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  for (const [k, n] of [...m.entries()].sort()) console.log(String(n).padStart(4), k);
}

/** Every import that breaks the layer rule. */
function violationList() {
  const out = [];
  for (const e of edges) {
    const a = layerOf(e.from), b = layerOf(e.to);
    const ok = ALLOWED[a];
    if (!ok || ok.includes(b)) continue;
    out.push({ ...e, a, b });
  }
  return out;
}

function violations() {
  for (const e of violationList()) {
    console.log(`${e.from}:${e.line} -> ${e.to}${e.type ? ' (type-only)' : ''}  [${e.a} imports ${e.b}]${byFile.get(e.from).cls === 'shipped' ? '' : ' tool-only'}`);
  }
}

/**
 * The violations that remain ("importing file -> imported file"), each with the queue row whose work removes it. The list
 * only shrinks: a violation not here fails `check`, and so does an entry that no longer violates, so the row that fixes
 * one deletes its line.
 */
const REMAINING = {};

function check() {
  const found = new Set(violationList().map((e) => `${e.from} -> ${e.to}`));
  const fresh = [...found].filter((k) => !(k in REMAINING));
  const gone = Object.keys(REMAINING).filter((k) => !found.has(k));
  for (const k of fresh) console.error(`layers: new import-direction violation (contract.md Architecture): ${k}`);
  for (const k of gone) console.error(`layers: ${k} no longer violates; delete it from REMAINING in tools/systems.cjs`);
  if (fresh.length || gone.length) process.exit(1);
  console.log(`layers: ok (${found.size} remaining violations, each owned by a row)`);
}

/** Query switches: a name read through URLSearchParams / location.search / a `[?&]name=` regex. */
function switches() {
  const out = new Map(); // name -> Set(file:line)
  const add = (n, f, l) => { if (!out.has(n)) out.set(n, new Set()); out.get(n).add(`${f}:${l}`); };
  for (const f of files) {
    const t = text.get(f.file);
    if (!/URLSearchParams|location\.search|\.params\b|\bparams\b|urlFlag|viewWanted/.test(t)) continue;
    t.split('\n').forEach((ln, i) => {
      for (const m of ln.matchAll(/\b(params|p|q|Q|ps|sp|qs|search|o\.params|sc\.params|app\.params|this\.params|u\.searchParams|searchParams)\??\.(get|has)\(\s*['"](\w+)['"]/g)) {
        if (/^(skip|\w*\.skip)$/.test(m[1])) continue;
        add(m[3], f.file, i + 1);
      }
      for (const m of ln.matchAll(/new URLSearchParams\([^)]*\)\.get\(\s*['"](\w+)['"]/g)) add(m[1], f.file, i + 1);
      for (const m of ln.matchAll(/\[\?&\](\w+)=?/g)) add(m[1], f.file, i + 1);
      for (const m of ln.matchAll(/\/!?(\w+)=\d\/\.test\(/g)) add(m[1], f.file, i + 1);
      for (const m of ln.matchAll(/urlFlag\(\s*['"](\w+)['"]/g)) add(m[1], f.file, i + 1);
    });
  }
  return out;
}
function switchTable() {
  const sw = switches();
  const per = new Map(); // system -> {game:Set, tool:Set}
  for (const [name, locs] of sw) {
    for (const loc of locs) {
      const file = loc.split(':')[0];
      const s = systemOf(file);
      const isTool = byFile.get(file).cls !== 'shipped';
      const e = per.get(s) ?? { game: new Set(), dev: new Set() };
      (isTool ? e.dev : e.game).add(name);
      per.set(s, e);
    }
  }
  const all = new Set(), game = new Set();
  for (const e of per.values()) { e.game.forEach((n) => { all.add(n); game.add(n); }); e.dev.forEach((n) => all.add(n)); }
  console.log(`distinct switches: ${all.size}; read by shipped code (reachable from index.html): ${game.size}`);
  for (const [s, e] of [...per.entries()].sort()) console.log(s.padEnd(28), 'game:', [...e.game].sort().join(',') || '-', '| tool-only:', [...e.dev].sort().join(',') || '-');
}

/** One line per switch read by shipped code: name, then file:line of every read. */
function switchLines() {
  for (const [name, locs] of [...switches().entries()].sort()) {
    const g = [...locs].filter((l) => byFile.get(l.split(':')[0]).cls === 'shipped');
    if (g.length) console.log(name.padEnd(14), g.join(' '));
  }
}

function voids() {
  const per = new Map();
  for (const f of files) {
    const n = (text.get(f.file).match(/^\s*void [\w.$, ]+;\s*(\/\/.*)?$/gm) ?? []).length;
    if (n) per.set(systemOf(f.file), (per.get(systemOf(f.file)) ?? 0) + n);
  }
  for (const [k, n] of [...per.entries()].sort((a, b) => b[1] - a[1])) console.log(String(n).padStart(4), k);
}

/** Files of a system with importers from other systems: the entry points. */
function entry(sys) {
  const into = new Map();
  for (const e of edges) {
    if (systemOf(e.to) !== sys || systemOf(e.from) === sys) continue;
    const r = into.get(e.to) ?? new Map();
    r.set(systemOf(e.from) + (byFile.get(e.from).cls === 'shipped' ? '' : ' [tool]'), (r.get(systemOf(e.from)) ?? 0) + 1);
    into.set(e.to, r);
  }
  for (const [to, r] of [...into.entries()].sort((a, b) => b[1].size - a[1].size)) console.log(to.padEnd(52), String(byFile.get(to).lines).padStart(5), [...r.keys()].join(', '));
}

const cmd = process.argv[2] ?? 'all';
if (cmd !== 'check') classify();
if (cmd === 'entry') entry(process.argv[3]);
else {
  const run = { table, edges: edgesTable, violations, check, switches: switchTable, 'switch-lines': switchLines, voids };
  if (run[cmd]) run[cmd]();
  else for (const [k, fn] of Object.entries(run)) { console.log('## ' + k); fn(); console.log(); }
}
