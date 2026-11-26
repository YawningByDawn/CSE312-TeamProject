#!/usr/bin/env node
// Player-visible strings outside src/content. One place holds the game's words: src/content/words, read through `uiText` (src/content/text.ts).
// This finds every string literal and template in src/ui, src/view and src/app that reaches a screen (text set on
// DOM/canvas/HUD view models, tooltips, card lines) by parsing each file on its own with Vite's parser (`parseSync`, oxc's ESTree).
// Not counted: ids, keys, CSS, colours, class lists, selectors, log/debug/error messages, comparisons, asset and type names.
// Usage: node tools/text.cjs [check|table|list [path-prefix]]
// `check` (land.py runs it) exits 1 when
//   - a file in SCOPE has more visible strings than its REMAINING entry (a file not listed holds none): move the words to src/content;
//   - a file in REMAINING has fewer than its entry (set the entry to the count; to 0 deletes it);
//   - a REMAINING entry names a file that is gone.
// `table` prints the count per file; `list` prints each string with its line and the context that made it visible.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { parseSync } = require(require.resolve('vite', { paths: [root] }));

const SCOPE = ['src/ui', 'src/view', 'src/app'];

/**
 * Folders where only a string handed to a text sink counts (textContent, fillText, a title or aria-label, a DOM text helper). The
 * view places pictures: the `name`, `label` and `note` strings in its tables are catalogue labels for dev sheets, tests and cache
 * keys, not words the player reads.
 */
const SINK_ONLY = ['src/view'];

/** Files that print only developer diagnostics (the debug hooks, the `?prof=1` profiler): never on the player's screen. */
const DEV_ONLY = new Set(['src/app/debug.ts', 'src/app/prof/index.ts', 'src/app/prof/report.ts']);

/**
 * The files that still hold visible strings ("file": count recorded). The list only shrinks: a file not here fails `check`
 * when it holds one, a listed file fails when its count differs from its number, and an entry whose file holds none (or is gone)
 * fails until its line is deleted, so the work that moves a file's words into src/content deletes its line.
 */
const REMAINING = {};
/** Property keys whose string value is shown to the player. */
const TEXT_KEYS = new Set([
  'text', 'label', 'title', 'name', 'line', 'lines', 'hint', 'hints', 'tip', 'tips', 'tooltip', 'sub', 'subtitle', 'body', 'desc',
  'description', 'caption', 'heading', 'header', 'msg', 'message', 'prompt', 'verb', 'word', 'note', 'blurb', 'intro', 'details',
  'detail', 'cta', 'button', 'placeholder', 'alt', 'ariaLabel', 'toast', 'status', 'reason', 'why', 'gift', 'footer', 'quote',
]);
/** Keys whose value is shown even as one lowercase word (the others need a capital or a second word: `title: 'silence'` is an id). */
const STRONG_KEYS = new Set(['text', 'label', 'line', 'lines', 'hint', 'tip', 'tooltip', 'body', 'sub', 'caption', 'placeholder', 'alt']);
/** Properties the profiler overlay and debug readouts are assigned to. */
const DEV_PROPS = new Set(['renderer', 'extra']);
/** Property keys never shown: styles, colours, ids, kinds. */
const CODE_KEYS = new Set([
  'cls', 'class', 'className', 'id', 'kind', 'type', 'color', 'colour', 'fill', 'stroke', 'font', 'fontFamily', 'css', 'style', 'key',
  'src', 'href', 'url', 'icon', 'glyph', 'event', 'tag', 'mode', 'align', 'baseline', 'cursor', 'display', 'filter', 'transform',
  'blend', 'composite', 'op', 'role', 'sel', 'selector', 'anchor', 'slot', 'variant', 'form', 'shape', 'recipe', 'ease',
]);
/** `x.prop = 'string'` assignments that reach the screen. */
const TEXT_ASSIGN = new Set(['textContent', 'innerText', 'innerHTML', 'title', 'placeholder', 'ariaLabel', 'alt', 'label', 'text', 'nodeValue', 'data']);
/** Calls whose arguments are never shown (ids, selectors, classes, log lines, formatters). */
const QUIET_CALLS = new Set([
  'log', 'warn', 'error', 'info', 'debug', 'assert', 'Error', 'TypeError', 'RangeError', 'querySelector', 'querySelectorAll',
  'getElementById', 'createElement', 'createElementNS', 'add', 'remove', 'toggle', 'contains', 'addEventListener', 'removeEventListener',
  'getAttribute', 'hasAttribute', 'removeAttribute', 'setProperty', 'removeProperty', 'getContext', 'includes', 'startsWith', 'endsWith',
  'indexOf', 'lastIndexOf', 'has', 'get', 'set', 'delete', 'matches', 'closest', 'test', 'match', 'matchAll', 'replace', 'replaceAll',
  'split', 'join', 'padStart', 'padEnd', 'RegExp', 'import', 'require', 'flagValue', 'flagOn', 'sheetQuery', 'reloadWithout',
  'setItem', 'getItem', 'removeItem', 'dispatchEvent', 'CustomEvent', 'Event', 'KeyboardEvent', 'MouseEvent', 'postMessage', 'fetch',
  'ui', 'card', 'person', 'place', 'stat', 'why', 'reason', 'ready', 'then', 'catch', 'finally', 'sort', 'localeCompare', 'font',
  'measureText', 'createLinearGradient', 'addColorStop', 'attachShadow', 'insertAdjacentHTML', 'begin', 'count', 'matchMedia',
  'toLocaleString', 'toLocaleDateString', 'toLocaleTimeString', 'toFixed', 'Intl', 'NumberFormat', 'DateTimeFormat',
]);
/** Plain functions (not methods) whose arguments are never shown. */
const FUNC_QUIET = new Set([
  'Error', 'TypeError', 'RangeError', 'RegExp', 'require', 'import', 'flagValue', 'flagOn', 'sheetQuery', 'reloadWithout', 'CustomEvent',
  'Event', 'KeyboardEvent', 'MouseEvent', 'fetch', 'matchMedia', 'assert', 'Intl', 'NumberFormat', 'DateTimeFormat', 'Map', 'Set', 'WeakMap',
]);
/** Quiet methods that a whole sentence still passes through (`notes.add(id, 'Press again to end it.')`). */
const SENTENCE_OK = new Set(['add', 'set', 'push']);
/** Methods whose second argument is the text that replaces the first. */
const REPLACERS = new Set(['replace', 'replaceAll']);
/** `x.prop = …` targets that are never words. */
const NON_TEXT_ASSIGN = new Set([
  'className', 'id', 'type', 'href', 'src', 'fillStyle', 'strokeStyle', 'font', 'textAlign', 'textBaseline', 'cursor', 'display', 'name', 'value',
  'htmlFor', 'rel', 'target', 'dir', 'lang', 'accept', 'role', 'cssText', 'direction', 'globalCompositeOperation', 'filter', 'lineCap', 'lineJoin', 'mode',
]);
/** Calls whose argument at an index is text shown. */
const TEXT_CALLS = {
  fillText: (i) => i === 0, strokeText: (i) => i === 0, createTextNode: (i) => i === 0, append: () => true, appendChild: () => true,
  prepend: () => true, at: (i) => i === 1, h: (i) => i >= 2, text: (i) => i === 1, button: (i) => i === 1, tab: (i) => i === 0, toast: (i) => i === 0,
  announce: (i) => i === 0, Text: (i) => i === 0, BitmapText: (i) => i === 0, HTMLText: (i) => i === 0,
};
const ATTR_TEXT = new Set(['title', 'aria-label', 'alt', 'placeholder', 'aria-valuetext', 'aria-description']);
const NON_TEXT_BIN = new Set(['===', '!==', '==', '!=', '<', '>', '<=', '>=', 'in', 'instanceof']);

const rel = (p) => path.relative(root, p).split(path.sep).join('/');
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.test.ts') && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

/** The words a literal shows: static text with `${…}` as `#`. */
const staticText = (node) => (node.type === 'TemplateLiteral' ? node.quasis.map((q) => q.value.cooked).join('#') : node.value);
/** Plain speech: two or more words, one of them lowercase, and not CSS, a path, a selector or code. */
function prose(s) {
  const t = s.replace(/\{[^{}]*\}/g, '#').replace(/<[^>]*>/g, ' ').trim();
  if (/^(\d+|#)\s+[a-z]{3,}(\s+[a-z]+)*$/.test(t)) return true;
  if (!/[A-Za-z]{2,}[^A-Za-z]+[A-Za-z#]/.test(t) || !/\s/.test(t)) return false;
  if (/^[#.[\]>~+*]/.test(t) && !/^#\s/.test(t)) return false;
  if (/;\s*[a-z-]+\s*:|:\s*[^ ]+;|\b(rgba?|hsla?|translate[XY]?|scale|rotate|calc|var|url|cubic-bezier|linear-gradient|radial-gradient)\(/.test(t)) return false;
  if (/^(\d+(\.\d+)?(px|em|rem|%|s|ms)?\s*)+$/.test(t)) return false;
  if (/^[a-z0-9_-]+(\s+[a-z0-9_#-]+)*$/.test(t) && !/\s(a|an|the|of|to|is|in|on|and|you|your|they|it|no|not|one|more|from|for|with)\s/.test(` ${t} `)) return false;
  if (/^(\d+(px|em|rem)?\s+)?(bold|italic|normal|\d+px)\b.*(serif|sans|mono|system|Georgia|Arial)/i.test(t)) return false;
  return /[a-z]{2}/.test(t);
}
/** A colour, CSS, a font list, SVG attributes, a media query, a regexp source or a file path: never words. */
function codeLike(s) {
  const t = s.trim();
  return /^#[0-9a-fA-F]{3,8}$/.test(t) || /[a-z-]+\s*:\s*[^;]+;/.test(t) || /\b(serif|sans-serif|monospace)\b/.test(t) || /\w+=\\?"/.test(t)
    || /^\(.*\)$/.test(t) || /^[\w./-]+\.(png|webp|svg|json|ts|js|css)$/.test(t) || /^(rgba?|hsla?|inset|polygon|circle|ellipse)\(/.test(t) || /^[A-Za-z]+-[A-Za-z-]+$/.test(t) || /^[a-z-]+:[^ ]/.test(t) || /^\\?"[^"]*\\?"(,|$)/.test(t);
}
/** One capitalised word, as a label would be ("Close", "Temple"). */
const labelWord = (s) => /^[A-Z][a-z]{2,}([ '’-][A-Za-z]+)?[.!?:]?$/.test(s.trim());

/** Nodes that pass a value on unchanged: a literal inside one counts where the wrapper lands. */
const WRAPPERS = new Set(['ParenthesizedExpression', 'TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression', 'TSTypeAssertion',
  'ArrayExpression', 'SpreadElement', 'TemplateLiteral', 'ConditionalExpression']);
/** Operators whose result carries the literal's words on. */
const CARRY_OPS = new Set(['+', '??', '||', '&&', '+=']);
/** Parents whose literal is never words: types, module names, switch cases, enum members, decorators. */
const NEVER = new Set(['TSLiteralType', 'TSImportType', 'ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration', 'SwitchCase',
  'TSExternalModuleReference', 'TSEnumMember', 'TSModuleDeclaration', 'Decorator']);
const isText = (n) => (n.type === 'Literal' && typeof n.value === 'string') || n.type === 'TemplateLiteral';
const literalType = (t) => t.type === 'TSLiteralType' || t.type === 'TSNullKeyword';

const calleeName = (call) => {
  let e = call.callee;
  while (e.type === 'ParenthesizedExpression' || e.type === 'TSNonNullExpression') e = e.expression;
  if (e.type === 'Identifier') return e.name;
  if (e.type === 'MemberExpression' && !e.computed) return e.property.name;
  return '';
};
const propName = (e) => {
  if (e.type === 'Identifier') return e.name;
  if (e.type === 'MemberExpression' && !e.computed) return e.property.name;
  if (e.type === 'MemberExpression' && e.property.type === 'Literal' && typeof e.property.value === 'string') return e.property.value;
  return '';
};
const keyName = (n) => (n.type === 'Identifier' ? n.name : n.type === 'Literal' && /string|number/.test(typeof n.value) ? String(n.value) : '');
/** The type annotation a declaration puts on its initializer, or null. */
const declaredType = (p) => {
  const a = p.type === 'VariableDeclarator' ? p.id.typeAnnotation : p.type === 'PropertyDefinition' ? p.typeAnnotation
    : p.type === 'AssignmentPattern' ? p.left.typeAnnotation : p.type === 'ArrowFunctionExpression' ? p.returnType : null;
  return a ? a.typeAnnotation : null;
};

/** Why a string or template literal in `code` is visible, or null. Nodes carry `parent`. */
function classify(node, code) {
  const src = (n) => code.slice(n.start, n.end);
  const s = staticText(node);
  if (!/[A-Za-z]/.test(s) || codeLike(s)) return null;
  // a template whose holes are class lists (`${cls} num`) is CSS
  if (node.type === 'TemplateLiteral' && node.expressions.some((e) => /\b(cls|class|className)\b/i.test(src(e)))) return null;
  let n = node;
  let p = n.parent;
  // climb through wrappers that pass the value on
  for (;;) {
    if (WRAPPERS.has(p.type)) {
      if (p.type === 'ConditionalExpression' && p.test === n) return null;
    } else if (/^(Binary|Logical|Assignment)Expression$/.test(p.type)) {
      if (NON_TEXT_BIN.has(p.operator)) return null;
      if (!CARRY_OPS.has(p.operator)) break;
    } else break;
    n = p; p = p.parent;
  }
  const k = p.type;
  if (NEVER.has(k) || (k === 'MemberExpression' && p.computed) || (p.computed && p.key === n)) return null;
  // `['Enter', 'Escape'].includes(key)`: the list a quiet method reads
  if (k === 'MemberExpression' && p.object === n && QUIET_CALLS.has(p.property.name)) return null;
  if (k === 'Property' && p.value === n) {
    const key = keyName(p.key);
    if (CODE_KEYS.has(key)) return null;
    if (TEXT_KEYS.has(key)) return /\s/.test(s.trim()) || /^[A-Z]/.test(s) || STRONG_KEYS.has(key) ? `{${key}}` : null;
    return prose(s) || (labelWord(s) && !/\s{2}/.test(s)) ? `{${key}}~` : null;
  }
  if (k === 'AssignmentExpression' && p.operator === '=' && p.right === n) {
    const name = propName(p.left);
    if (TEXT_ASSIGN.has(name)) return `.${name} =`;
    if (NON_TEXT_ASSIGN.has(name) || /(^|\.)style\./.test(src(p.left))) return null;
    return prose(s) || labelWord(s) ? `${name || 'assign'} =~` : null;
  }
  if (k === 'CallExpression' || k === 'NewExpression') {
    const idx = p.arguments.indexOf(n);
    if (idx < 0) return null;
    const method = k === 'CallExpression' && p.callee.type === 'MemberExpression' && !p.callee.computed;
    const name = k === 'CallExpression' ? calleeName(p) : p.callee.type === 'Identifier' ? p.callee.name : '';
    if (method && /(^|\.)log$/.test(src(p.callee.object))) return null;
    if (name === 'setAttribute') {
      const a0 = p.arguments[0];
      return idx === 1 && a0.type === 'Literal' && ATTR_TEXT.has(a0.value) ? `setAttribute(${a0.value})` : null;
    }
    if (method ? QUIET_CALLS.has(name) && !(REPLACERS.has(name) && idx === 1) && !(SENTENCE_OK.has(name) && /^[A-Z].*\s.*[.!?]$/.test(s.trim())) : FUNC_QUIET.has(name)) return null;
    if (name in TEXT_CALLS) return TEXT_CALLS[name](idx) ? `${name}()` : null;
    return prose(s) || labelWord(s) ? `${name || 'call'}()~` : null;
  }
  // a value whose declared type is a union of string literals is an id of that type, not a word
  const t = declaredType(p);
  if (t && (literalType(t) || (t.type === 'TSUnionType' && t.types.every(literalType)))) return null;
  if (k === 'ArrowFunctionExpression' && p.parent.type === 'AssignmentExpression' && DEV_PROPS.has(propName(p.parent.left))) return null;
  return prose(s) || labelWord(s) ? `${k}~` : null;
}

/** The visible strings of one source file: [{line, text, why}] in source order. */
function visible(f, code) {
  const { program, errors } = parseSync(f, code, { lang: 'ts' });
  if (errors.length) throw new Error(`text: ${f}: ${errors[0].message}`);
  const sinkOnly = SINK_ONLY.some((d) => f.startsWith(d + '/'));
  const out = [];
  const visit = (node, parent) => {
    node.parent = parent;
    if (isText(node)) {
      let why = classify(node, code);
      if (why && sinkOnly && (why.endsWith('~') || why.startsWith('{'))) why = null;
      if (why) out.push({ line: code.slice(0, node.start).split('\n').length, text: staticText(node), why, start: node.start });
      if (node.type !== 'TemplateLiteral') return;
    }
    for (const key in node) {
      if (key === 'parent') continue;
      const v = node[key];
      if (Array.isArray(v)) { for (const x of v) if (x && typeof x.type === 'string') visit(x, node); }
      else if (v && typeof v.type === 'string') visit(v, node);
    }
  };
  visit(program, null);
  return out.sort((a, b) => a.start - b.start).map(({ line, text, why }) => ({ line, text, why }));
}

/** file -> its visible strings, for every file in SCOPE that holds any. */
function scan() {
  const found = new Map();
  for (const abs of SCOPE.flatMap((d) => walk(path.join(root, d)))) {
    const f = rel(abs);
    if (DEV_ONLY.has(f)) continue;
    const out = visible(f, fs.readFileSync(abs, 'utf8'));
    if (out.length) found.set(f, out);
  }
  return found;
}

function main() {
  const cmd = process.argv[2] ?? 'check';
  if (!['check', 'table', 'list'].includes(cmd)) { console.error('usage: node tools/text.cjs [check|table|list [path-prefix]]'); process.exit(2); }
  const prefix = process.argv[3] ?? '';
  const found = scan();

  const counts = new Map([...found].map(([f, v]) => [f, v.length]));
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  if (cmd === 'list') {
    for (const [f, v] of found) {
      if (!f.startsWith(prefix)) continue;
      console.log(`${f} (${v.length})`);
      for (const x of v) console.log(`  ${x.line}\t${x.why}\t${JSON.stringify(x.text)}`);
    }
    return;
  }
  const table = () => {
    const by = new Map();
    for (const [f, n] of counts) { const d = f.split('/').slice(0, 2).join('/'); by.set(d, (by.get(d) ?? 0) + n); }
    for (const [f, n] of [...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))) console.log(String(n).padStart(5) + '  ' + f);
    console.log(`text: ${total} visible strings in ${counts.size} files (${[...by].map(([d, n]) => `${d} ${n}`).join(', ')})`);
  };
  if (cmd === 'table') return table();

  const bad = [];
  for (const [f, n] of counts) {
    if (!(f in REMAINING)) bad.push(`text: ${f} holds ${n} player-visible string(s); move the words to src/content (a file is not added to REMAINING)`);
    else if (n > REMAINING[f]) bad.push(`text: ${f} grew from ${REMAINING[f]} to ${n} strings; move the new words to src/content`);
    else if (n < REMAINING[f]) bad.push(`text: ${f} is down to ${n} strings; set its REMAINING entry to ${n}`);
  }
  for (const f of Object.keys(REMAINING)) {
    if (!fs.existsSync(path.join(root, f))) bad.push(`text: ${f} no longer exists; delete it from REMAINING in tools/text.cjs`);
    else if (!counts.has(f)) bad.push(`text: ${f} holds no visible strings; delete it from REMAINING in tools/text.cjs`);
  }
  for (const m of bad) console.error(m);
  if (bad.length) process.exit(1);
  console.log(`text: ok (${total} strings remain in ${counts.size} files, each recorded in REMAINING)`);
}
if (require.main === module) main();
module.exports = { visible };
