#!/usr/bin/env node
// Flag and dev-sheet guard. src/content/flags.json lists every query switch and every dev sheet with what it does, the queue row
// that decides it and a deletion date; src/content/flags.ts is the only code that reads the query string.
// Usage: node tools/flags.cjs [check|table]
// `check` (land.py runs it) exits 1 when
//   - src/ reads the query string anywhere but src/content/flags.ts (URLSearchParams, location.search / href / hash, searchParams,
//     a `[?&]name=` regex);
//   - an entry lacks `what`, a row naming a docs/queue.md row (a permanent entry names `contract.md` and is documented there) or an
//     `until` date (`permanent` only for the documented dev switches); a date later than DEFAULT_UNTIL needs a `why`;
//   - an entry's date has passed;
//   - a page (dev/*.html, or a root *.html but index.html) has no `sheets` entry, or an entry's page is gone;
//   - a flag or a sheet is not read by any code: a flag by a flag/reloadFlipped call naming it in src/, a
//     sheet with no page by a sheetQuery call naming it;
//   - a call names a flag or sheet that has no entry.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

const TABLE = 'src/content/flags.json';
const MODULE = 'src/content/flags.ts';
const DEFAULT_UNTIL = '2026-12-15';
const PERMANENT_ROW = 'contract.md';

function walk(dir, ext, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, ext, out);
    else if (ext.some((x) => e.name.endsWith(x))) out.push(p);
  }
  return out;
}
const rel = (p) => path.relative(root, p).split(path.sep).join('/');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const table = JSON.parse(read(TABLE));
const today = new Date().toISOString().slice(0, 10);
// docs/queue.md and docs/queue-deferred.md are one set of rows, as land.py reads them
const queueRows = new Set([...(read('docs/queue.md') + read('docs/queue-deferred.md')).matchAll(/^\|\s*([A-Z][A-Z0-9 ]*?)\s*(?:\([^)|]*\)\s*)?\|/gm)].map((m) => m[1]).filter((n) => n !== 'ITEM'));
const contract = read('contract.md');

const QUERY_READ = [
  /URLSearchParams/, /\blocation\.(search|href|hash)\b/, /\bsearchParams\b/, /\[\?&\]\w+/,
];

function check() {
  const bad = [];
  const src = walk(path.join(root, 'src'), ['.ts']).map(rel);

  for (const f of src) {
    if (f === MODULE) continue;
    read(f).split('\n').forEach((ln, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(ln)) return;
      if (QUERY_READ.some((re) => re.test(ln))) bad.push(`flags: ${f}:${i + 1} reads the query string; read it through ${MODULE} (flag / reloadFlipped / pageQuery)`);
    });
  }

  for (const [kind, entries] of Object.entries(table)) {
    for (const [name, e] of Object.entries(entries)) {
      const at = `flags: ${kind}.${name}`;
      if (!e.what) bad.push(`${at} has no \`what\``);
      if (!e.row) bad.push(`${at} has no queue row`);
      else if (e.until === 'permanent') {
        if (e.row !== PERMANENT_ROW) bad.push(`${at} is permanent, so its row is ${PERMANENT_ROW}`);
        else if (kind === 'flags' && !new RegExp(`[?&]${name}=`).test(contract)) bad.push(`${at} is permanent but contract.md does not document ?${name}=`);
      } else if (!queueRows.has(e.row)) bad.push(`${at}: row "${e.row}" is not a queue row`);
      if (!e.until) bad.push(`${at} has no deletion date`);
      else if (e.until !== 'permanent') {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(e.until) || Number.isNaN(Date.parse(e.until))) bad.push(`${at}: date "${e.until}" is not YYYY-MM-DD`);
        else if (e.until < today) bad.push(`${at} passed its date ${e.until}: delete it and what reads it (or the row moves the date with a reason)`);
        else if (e.until > DEFAULT_UNTIL && !e.why) bad.push(`${at}: a date after ${DEFAULT_UNTIL} needs a \`why\``);
      }
    }
  }

  const calls = (fns, files) => {
    const seen = new Set();
    const re = new RegExp(`\\b(?:${fns})\\(\\s*'(\\w+)'`, 'g');
    for (const f of files) for (const m of read(f).matchAll(re)) seen.add(m[1]);
    return seen;
  };
  const devSrc = walk(path.join(root, 'dev', 'src'), ['.ts']).map(rel);
  const flagCalls = calls('flag|reloadFlipped', src);
  const sheetCalls = calls('sheetQuery', [...src, ...devSrc]);

  for (const name of Object.keys(table.flags)) if (!flagCalls.has(name)) bad.push(`flags: flags.${name} is read by no code; delete its entry`);
  for (const n of flagCalls) if (!(n in table.flags)) bad.push(`flags: code reads ?${n}= and flags.json has no entry for it`);
  for (const n of sheetCalls) if (!(n in table.sheets)) bad.push(`flags: code reads sheet "${n}" and flags.json has no sheets entry for it`);

  // every page but the game's own index.html: dev/*.html and any other page at the root
  const html = (dir) => fs.readdirSync(path.join(root, dir)).filter((f) => f.endsWith('.html')).map((f) => path.posix.join(dir, f));
  const pages = [...html('dev'), ...html('.').filter((f) => f !== 'index.html')];
  const listed = new Set(Object.values(table.sheets).map((s) => s.page).filter(Boolean));
  for (const p of pages) if (!listed.has(p)) bad.push(`flags: ${p} has no entry in ${TABLE} sheets (what, row, date)`);
  for (const [name, s] of Object.entries(table.sheets)) {
    if (s.page && !pages.includes(s.page)) bad.push(`flags: sheets.${name}: ${s.page} is gone; delete its entry`);
    if (!s.page && !sheetCalls.has(name)) bad.push(`flags: sheets.${name} has no page and no sheetQuery('${name}') reads it; delete its entry`);
  }

  for (const m of bad) console.error(m);
  if (bad.length) process.exit(1);
  console.log(`flags: ok (${Object.keys(table.flags).length} flags, ${Object.keys(table.sheets).length} dev sheets, each with a row and a date; the query string is read only in ${MODULE})`);
}

function show() {
  for (const [kind, entries] of Object.entries(table)) {
    console.log(`## ${kind}`);
    for (const [name, e] of Object.entries(entries)) console.log(name.padEnd(13), e.until.padEnd(11), e.row.padEnd(11), e.what);
  }
}

const run = { check, table: show };
const cmd = process.argv[2] ?? 'check';
if (run[cmd]) run[cmd]();
else { console.error('usage: node tools/flags.cjs [check|table]'); process.exit(2); }
