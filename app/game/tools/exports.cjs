#!/usr/bin/env node
// Unused-export finder: lists every export of a shipped src/ module that no shipped module imports.
//   shipped     = reach.cjs's class (module graph from index.html -> src/main.ts)
//   test-only   imported by tests/, scripts/, gen/, dev/, e2e/ or tools/ only
//   nothing     imported by no file at all
//   local       the name is also used inside its own file (the `export` keyword is all that is unneeded)
// Imports are read from the AST (rolldown's oxc parser, TypeScript syntax): named, default and namespace imports,
// `export {x} from`, `export * from`, dynamic import(), import.meta.glob. A name imported through a barrel is resolved to the
// module that declares it; the barrel's re-export is no use. Conservative where the AST cannot tell: a namespace
// import that escapes (passed, indexed, spread), a dynamic import() or a glob counts every export of that module as used.
// `local` is a name match, not scope analysis: a `nothing` row is dead code only once `tsc --noUnusedLocals` flags it with its
// `export` removed; deleting it can leave imports and other exports unused, so run again until the report stops shrinking.
// One pass: an export used only by another unused export shows as used until that one is deleted; run again.
// This is a report, not a gate: whether a test-only export is a spec formula or a bot's need is a judgement the AST cannot make.
// Usage: node tools/exports.cjs [--json] [--all]   (--all also lists exports of tool-only src/ files)
'use strict';
const fs = require('node:fs');
const cp = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { parseAst } = require(require.resolve('rolldown/parseAst', { paths: [root] }));

const TOOL_DIRS = ['tests', 'scripts', 'gen', 'dev', 'e2e', 'tools'];
const EXT = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'];
const rel = (p) => path.relative(root, p).split(path.sep).join('/');

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

/** reach.cjs classifies every src/ file; its shipped set is the importer set that counts. */
function classes() {
  const r = cp.spawnSync('node', [path.join(__dirname, 'reach.cjs'), '--json'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error('reach.cjs --json failed: ' + r.stderr.slice(0, 500));
  return new Map(JSON.parse(r.stdout).files.map((f) => [f.file, f.cls]));
}

function resolveSpec(from, spec) {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(path.join(root, from)), spec);
  for (const c of [base, ...EXT.map((e) => base + e), ...EXT.map((e) => path.join(base, 'index' + e))]) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return rel(c);
  }
  return null;
}

/** Visit every node of an ESTree (oxc) AST. */
function visit(node, fn, parent = null) {
  if (!node || typeof node.type !== 'string') return;
  fn(node, parent);
  for (const k in node) {
    if (k === 'loc' || k === 'range') continue;
    const v = node[k];
    if (Array.isArray(v)) for (const c of v) { if (c && typeof c.type === 'string') visit(c, fn, node); }
    else if (v && typeof v.type === 'string') visit(v, fn, node);
  }
}

/** Identifiers a binding pattern declares (not its type annotation, defaults or computed keys). */
function bound(p, fn) {
  if (!p) return;
  if (p.type === 'Identifier') fn(p);
  else if (p.type === 'ObjectPattern') for (const x of p.properties) bound(x.type === 'RestElement' ? x.argument : x.value, fn);
  else if (p.type === 'ArrayPattern') for (const x of p.elements) bound(x?.type === 'RestElement' ? x.argument : x, fn);
  else if (p.type === 'AssignmentPattern') bound(p.left, fn);
}

const nameOf = (n) => (n.type === 'Identifier' ? n.name : n.value);

/**
 * exports: Map name -> {kind, line}; reexports: Map name -> {spec, orig ('*' for `export * as`)}; stars: [spec];
 * imports: [{spec | glob, items: [{name ('*' for a namespace), local, paths, escaped}], all}]
 */
function scan(file) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  if (file.endsWith('.json')) return null;
  const lang = /\.tsx?$/.test(file) ? 'ts' : 'js';
  let ast;
  try { ast = parseAst(text, { lang, sourceType: 'module' }); } catch { return { failed: true, exports: new Map(), reexports: new Map(), stars: [], imports: [], text }; }
  const lineOf = (n) => text.slice(0, n.start).split('\n').length;
  const exports = new Map(), reexports = new Map(), stars = [], imports = [];
  const items = []; // every imported binding
  for (const s of ast.body) {
    if (s.type === 'ImportDeclaration') {
      const rec = { spec: s.source.value, items: [], all: false };
      for (const sp of s.specifiers) {
        const it = { name: sp.type === 'ImportSpecifier' ? nameOf(sp.imported) : sp.type === 'ImportDefaultSpecifier' ? 'default' : '*', local: sp.local.name, paths: [], heads: 0 };
        rec.items.push(it); items.push(it);
      }
      imports.push(rec);
    } else if (s.type === 'ExportAllDeclaration') {
      if (s.exported) reexports.set(nameOf(s.exported), { spec: s.source.value, orig: '*' });
      else stars.push(s.source.value);
    } else if (s.type === 'ExportDefaultDeclaration') {
      exports.set('default', { kind: 'default', line: lineOf(s) });
    } else if (s.type === 'ExportNamedDeclaration') {
      const d = s.declaration;
      if (d) {
        const kind = s.exportKind === 'type' || d.type.startsWith('TSInterface') || d.type.startsWith('TSTypeAlias') ? 'type' : d.type === 'VariableDeclaration' ? 'const' : d.type === 'FunctionDeclaration' ? 'function' : d.type === 'ClassDeclaration' ? 'class' : 'other';
        if (d.type === 'VariableDeclaration') {
          for (const dec of d.declarations) bound(dec.id, (n) => exports.set(n.name, { kind, line: lineOf(s) }));
        } else if (d.id) exports.set(d.id.name, { kind, line: lineOf(s) });
      } else if (s.source) {
        for (const sp of s.specifiers) reexports.set(nameOf(sp.exported), { spec: s.source.value, orig: nameOf(sp.local) }); // a re-export is no use; importers of the barrel are followed
      } else {
        for (const sp of s.specifiers) exports.set(nameOf(sp.exported), { kind: 'local-ref', line: lineOf(s), local: nameOf(sp.local) });
      }
    }
  }
  const byLocal = new Map(items.map((it) => [it.local, it]));
  const idCount = new Map();
  const body = { type: 'Program', body: ast.body.filter((s) => s.type !== 'ImportDeclaration') };
  // `a.b.c` / `A.B.C` chain tops rooted at an imported binding are member uses; any other mention of the binding escapes
  const chain = (n) => {
    const path_ = [];
    while (n.type === 'MemberExpression' && !n.computed || n.type === 'TSQualifiedName') {
      path_.unshift(n.type === 'MemberExpression' ? n.property.name : n.right.name);
      n = n.type === 'MemberExpression' ? n.object : n.left;
    }
    return n.type === 'Identifier' ? { root: n.name, path: path_ } : null;
  };
  visit(body, (n, parent) => {
    if (n.type === 'CallExpression' && n.callee.type === 'Identifier' && n.callee.name === 'require' && n.arguments[0]?.type === 'Literal') imports.push({ spec: n.arguments[0].value, items: [], all: true });
    if (n.type === 'ImportExpression' && n.source?.type === 'Literal') imports.push({ spec: n.source.value, items: [], all: true });
    else if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && n.callee.object?.type === 'MetaProperty' && n.callee.property?.name === 'glob') {
      const a = n.arguments[0];
      const pats = a?.type === 'Literal' ? [a.value] : a?.type === 'ArrayExpression' ? a.elements.map((e) => e.value) : [];
      for (const p of pats) imports.push({ glob: p, items: [], all: true });
    } else if (n.type === 'TSImportType') {
      const lit = n.source ?? n.argument?.literal ?? n.argument;
      const v = lit?.value ?? lit?.literal?.value;
      if (typeof v === 'string') imports.push({ spec: v, items: [], all: true });
    }
    if (n.type === 'Identifier') idCount.set(n.name, (idCount.get(n.name) ?? 0) + 1);
    const top = (n.type === 'MemberExpression' && !n.computed && !(parent?.type === 'MemberExpression' && !parent.computed && parent.object === n)) || (n.type === 'TSQualifiedName' && !(parent?.type === 'TSQualifiedName' && parent.left === n));
    if (top) {
      const c = chain(n);
      const it = c && byLocal.get(c.root);
      if (it) { it.paths.push(c.path); it.heads++; }
    }
  });
  for (const it of items) it.escaped = (idCount.get(it.local) ?? 0) > it.heads;
  return { exports, reexports, stars, imports, idCount, text };
}

function main() {
  const json = process.argv.includes('--json');
  const showAll = process.argv.includes('--all');
  const cls = classes();
  const srcFiles = [...cls.keys()].filter((f) => /\.(ts|tsx|js|mjs|cjs)$/.test(f));
  const info = new Map();
  for (const f of srcFiles) info.set(f, scan(f));
  const toolFiles = TOOL_DIRS.flatMap((d) => walk(path.join(root, d))).map(rel).filter((f) => /\.(ts|cjs|mjs|js)$/.test(f) && f !== 'tools/exports.cjs');
  toolFiles.push('vite.config.ts');
  const toolInfo = new Map(toolFiles.map((f) => [f, scan(f)]));
  const failed = [...info, ...toolInfo].filter(([, i]) => i?.failed).map(([f]) => f);
  if (failed.length) throw new Error('could not parse: ' + failed.join(', '));

  /** (file, name) through barrels to the declaring (file, name). */
  const origin = (file, name, seen = new Set()) => {
    const key = file + '\0' + name;
    if (seen.has(key)) return null;
    seen.add(key);
    const i = info.get(file);
    if (!i) return null;
    if (i.exports.has(name)) return { file, name };
    const re = i.reexports.get(name);
    if (re) { const t = resolveSpec(file, re.spec); return !t ? null : re.orig === '*' ? { ns: t } : origin(t, re.orig, seen); }
    if (name !== 'default') for (const s of i.stars) { const t = resolveSpec(file, s); const r = t && origin(t, name, seen); if (r) return r; }
    return null;
  };
  const allNames = (file, seen = new Set()) => {
    const i = info.get(file);
    if (!i || seen.has(file)) return [];
    seen.add(file);
    const out = [...i.exports.keys(), ...i.reexports.keys()];
    for (const s of i.stars) { const t = resolveSpec(file, s); if (t) out.push(...allNames(t, seen)); }
    return out;
  };
  const globFiles = (from, pat) => {
    const full = path.posix.normalize(path.posix.join(path.posix.dirname(from), pat));
    const rx = new RegExp('^' + full.replace(/[.+^$()|\\]/g, '\\$&').replace(/\{([^}]*)\}/g, (_, a) => '(' + a.split(',').join('|') + ')').replace(/\*\*\//g, '(.*/)?').replace(/\*/g, '[^/]*') + '$');
    return srcFiles.filter((f) => rx.test(f));
  };
  const used = { shipped: new Map(), tool: new Map() };
  const mark = (bucket, o, importer) => {
    const k = o.file + '\0' + o.name;
    if (!bucket.has(k)) bucket.set(k, new Set());
    bucket.get(k).add(importer);
  };
  /** Names of module `mod` reached through `paths` (member chains from a namespace); none or escaped = every export. */
  const useModule = (importer, bucket, mod, paths, escaped, seen = new Set()) => {
    const key = mod + JSON.stringify(paths) + escaped;
    if (seen.has(key)) return;
    seen.add(key);
    if (escaped || !paths.length) { for (const n of allNames(mod)) useName(importer, bucket, mod, n, [], true, seen); return; }
    for (const p of paths) useName(importer, bucket, mod, p[0], [p.slice(1)], false, seen);
  };
  const useName = (importer, bucket, mod, name, paths, escaped, seen) => {
    const o = origin(mod, name);
    if (!o) return;
    if (o.ns) useModule(importer, bucket, o.ns, paths.filter((p) => p.length), escaped || paths.some((p) => !p.length), seen);
    else mark(bucket, o, importer);
  };
  const consume = (importer, rec, bucket) => {
    const targets = rec.glob ? globFiles(importer, rec.glob) : [resolveSpec(importer, rec.spec)].filter(Boolean);
    for (const t of targets) {
      if (!info.has(t)) continue;
      if (rec.all) { useModule(importer, bucket, t, [], true); continue; }
      for (const it of rec.items) {
        if (it.name === '*') useModule(importer, bucket, t, it.paths, it.escaped);
        else useName(importer, bucket, t, it.name, it.paths.length ? it.paths : [], it.escaped || !it.paths.length, new Set());
      }
    }
  };
  for (const [f, i] of info) if (cls.get(f) === 'shipped') for (const rec of i.imports) consume(f, rec, used.shipped);
  for (const [f, i] of toolInfo) for (const rec of i.imports) consume(f, rec, used.tool);
  // a tool-only src/ file's own imports are tool use
  for (const [f, i] of info) if (cls.get(f) !== 'shipped') for (const rec of i.imports) consume(f, rec, used.tool);

  const rows = [];
  for (const [f, i] of info) {
    if (cls.get(f) !== 'shipped' && !showAll) continue;
    for (const [name, ex] of i.exports) {
      const k = f + '\0' + name;
      if (used.shipped.has(k)) continue;
      const by = [...(used.tool.get(k) ?? [])].sort();
      const ref = ex.kind === 'local-ref' ? ex.local : name;
      const local = (i.idCount.get(ref) ?? 0) > (ex.kind === 'local-ref' ? 2 : 1);
      rows.push({ file: f, line: ex.line, name, kind: ex.kind, class: by.length ? 'test-only' : 'nothing', local, usedBy: by });
    }
  }
  rows.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  if (json) { process.stdout.write(JSON.stringify(rows, null, 1) + '\n'); return; }
  const tally = { 'test-only': 0, nothing: 0 };
  for (const r of rows) {
    tally[r.class]++;
    const tail = r.usedBy.length ? '  <- ' + r.usedBy.slice(0, 3).join(', ') + (r.usedBy.length > 3 ? ` +${r.usedBy.length - 3}` : '') : '';
    console.log(`${r.file}:${r.line} ${r.name} (${r.kind}) ${r.class}${r.local ? ' local' : ''}${tail}`);
  }
  const shippedCount = srcFiles.filter((f) => cls.get(f) === 'shipped').length;
  console.log(`\nexports: ${rows.length} not imported by any shipped module in ${shippedCount} shipped files (${tally['test-only']} test-only, ${tally.nothing} nothing; ${rows.filter((r) => r.local).length} also used inside their own file)`);
}
main();
