import { parseSync, type Plugin } from 'vite';
import { relative, resolve, dirname } from 'node:path';

// The profiled graph of the rebuilt game (src/app/prof): `import('<module>.ts?prof')` loads a copy of a src module
// with a probe around the body of every named function, whose relative imports load their own `?prof` copies. The
// game's own graph is never touched, so the profiler costs nothing while it is off.

/** The probes' runtime: one instance shared by both graphs, never itself probed. */
const RUNTIME = '/src/app/prof/';
const PROBE = `${RUNTIME}probe.ts`;

/** A probed module: its code and the names of its probes, in id order from the `first` it was given. */
export interface Probed { code: string; names: string[] }

type N = { type: string; start: number; end: number; [k: string]: unknown };
const isFn = (n: unknown): n is N => !!n && /^(FunctionExpression|ArrowFunctionExpression)$/.test((n as N).type);
const keyName = (k: N, computed: unknown): string | null =>
  computed ? null : k.type === 'Identifier' || k.type === 'PrivateIdentifier' ? (k.name as string) : k.type === 'Literal' ? String(k.value) : null;

/**
 * `code` (TypeScript, `file` relative to src) with `__P.b(id);try{` at the start of each named function's body and
 * `}finally{__P.e()}` at its end, on the same lines. Named: declarations, functions bound to a name, object and class
 * methods (`owner.key`: the object's binding, else the enclosing function). Anonymous callbacks, accessors, async
 * functions and generators are left in the function around them. Relative imports gain `?prof`.
 */
export function instrument(code: string, file: string, first: number): Probed {
  const { program, errors } = parseSync(file, code, { lang: 'ts' });
  if (errors.length) throw new Error(`${file}: ${errors[0]!.message}`);
  const lines: number[] = [0];
  for (let i = 0; i < code.length; i++) if (code.charCodeAt(i) === 10) lines.push(i + 1);
  const lineOf = (at: number): number => {
    let lo = 0, hi = lines.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (lines[m]! <= at) lo = m; else hi = m - 1; }
    return lo + 1;
  };
  const edits: [number, string][] = [];
  const names: string[] = [];

  const probe = (fn: N, name: string): void => {
    const body = fn.body as N | null;
    if (!body || fn.async || fn.generator) return;
    const id = first + names.length;
    names.push(`${name} (${file}:${lineOf(fn.start)})`);
    if (body.type === 'BlockStatement') {
      const stmts = body.body as N[];
      let at = body.start + 1;
      for (const s of stmts) if (s.directive !== undefined) at = s.end; else break;
      edits.push([at, `__P.b(${id});try{`], [body.end - 1, '}finally{__P.e()}']);
    } else edits.push([body.start, `{__P.b(${id});try{return (`], [body.end, `)}finally{__P.e()}}`]);
  };

  const source = (s: unknown, typeOnly: unknown): void => {
    const lit = s as N | null;
    if (!lit || typeOnly === 'type' || typeof lit.value !== 'string') return;
    const v = lit.value;
    if (!v.startsWith('.') || v.includes('?') || /\.(?!ts$)[a-z0-9]+$/i.test(v)) return;
    if (resolve('/src', dirname(file), v).startsWith(RUNTIME)) return;
    edits.push([lit.end - 1, '?prof']);
  };

  /** `owner`: the name an object's or a class's members are named under; `fn`: the enclosing named function. */
  const visit = (n: unknown, owner: string | null, fn: string | null): void => {
    if (Array.isArray(n)) { for (const x of n) visit(x, owner, fn); return; }
    if (!n || typeof n !== 'object') return;
    const node = n as N;
    switch (node.type) {
      case 'ImportDeclaration': source(node.source, node.importKind); return;
      case 'ExportNamedDeclaration': case 'ExportAllDeclaration': source(node.source, node.exportKind); break;
      case 'ImportExpression': source(node.source, null); break;
      case 'FunctionDeclaration': {
        const name = (node.id as N | null)?.name as string | undefined;
        if (name) probe(node, name);
        visit(node.body, null, name ?? fn);
        return;
      }
      case 'VariableDeclarator': {
        const id = node.id as N, init = node.init as N | null;
        const name = id.type === 'Identifier' ? (id.name as string) : null;
        if (name && isFn(init)) { probe(init, name); visit(init.body, null, name); return; }
        if (name && init && /^(ObjectExpression|ClassExpression)$/.test(init.type)) { visit(init, name, fn); return; }
        break;
      }
      case 'ClassDeclaration': case 'ClassExpression': {
        const name = ((node.id as N | null)?.name as string | undefined) ?? owner ?? fn ?? 'class';
        visit((node.body as N).body, name, fn);
        return;
      }
      case 'MethodDefinition': case 'PropertyDefinition': case 'Property': {
        const key = keyName(node.key as N, node.computed);
        const value = node.value as N | null;
        const accessor = node.kind === 'get' || node.kind === 'set';
        if (key && isFn(value) && !accessor) {
          const name = `${owner ?? fn ?? '{}'}.${key}`;
          probe(value, name);
          visit(value.body, null, name);
          return;
        }
        visit(value, null, fn);
        return;
      }
      case 'ObjectExpression': visit(node.properties, owner ?? fn, fn); return;
      case 'FunctionExpression': {
        const name = (node.id as N | null)?.name as string | undefined;
        if (name) probe(node, name);
        visit(node.body, null, name ?? fn);
        return;
      }
      default: break;
    }
    for (const k in node) if (k !== 'type' && k !== 'start' && k !== 'end') visit(node[k], null, fn);
  };
  visit(program.body, null, null);

  edits.sort((a, b) => a[0] - b[0]);
  let out = `import { P as __P } from '${PROBE}';__P.n(${first}, ${JSON.stringify(names)});`, at = 0;
  for (const [i, s] of edits) { out += code.slice(at, i) + s; at = i; }
  return { code: out + code.slice(at), names };
}

/** The Vite plugin: probes each `src/**.ts?prof` module but the runtime's; ids run on across modules. */
export function probes(root: string): Plugin {
  const src = resolve(root, 'src');
  let next = 0;
  return {
    name: 'hgi-probes',
    enforce: 'pre',
    transform(code, id) {
      const [path, query] = id.split('?');
      if (query !== 'prof' || !path!.endsWith('.ts') || !path!.startsWith(src + '/') || path!.startsWith(resolve(root, RUNTIME.slice(1)))) return null;
      const p = instrument(code, relative(src, path!), next);
      next += p.names.length;
      return { code: p.code, map: null };
    },
  };
}
