import { configDefaults, defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { approvals } from './tools/workshop/approvals.ts';
import { probes } from './tools/probes.ts';

const root = dirname(fileURLToPath(import.meta.url));
const devDir = resolve(root, 'dev');

/** The workshop shell lives in dev/ but is never a build entry and never a nav entry of itself. */
const SHELL = 'workshop';

/** The dev/*.html harness pages, read from the folder on every call: a deleted page is gone at once. */
function devPages(): string[] {
  if (!existsSync(devDir)) return [];
  return readdirSync(devDir).filter((f) => f.endsWith('.html')).map((f) => f.slice(0, -5)).filter((n) => n !== SHELL).sort();
}

/** `npm run workshop` only: the shell answers at the base URL, `pages.json` lists the dev pages for its nav, and the approvals routes. */
function workshop(base: string): Plugin {
  const title = (n: string) => /<title>([^<]*)<\/title>/.exec(readFileSync(resolve(devDir, `${n}.html`), 'utf8'))?.[1] ?? n;
  return {
    name: 'hgi-workshop',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(approvals(base, resolve(root, 'data/workshop')));
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0];
        if (path === base + 'pages.json') {
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify(devPages().map((n) => ({ name: n, title: title(n), url: `dev/${n}.html` }))));
          return;
        }
        if (path === base) req.url = `${base}dev/${SHELL}.html`;
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const shell = mode === 'workshop';
  // `npm run build` is the course's build (`--mode course`): the Go app serves it at the site's root and the game joins the
  // app's hub (app/websocket) on the same host. Every other command serves the game with no hub.
  const course = mode === 'course';
  const base = '/workshop/hgi/';
  return {
    base: shell ? base : course ? '/' : './',
    define: course ? { 'import.meta.env.VITE_HG_NET': JSON.stringify('/ws') } : {},
    // probes(): the rebuilt game's profiled copy (`?prof=1`), built beside the game and loaded only on that page.
    plugins: shell ? [workshop(base), probes(root)] : [probes(root)],
    // The workshop runs from the main checkout, which every landing rewrites: it never reloads the owner's page.
    server: shell ? { hmr: false } : {},
    build: {
      target: 'es2022',
      // Hidden maps: `assets/*.js.map` beside the scripts, never named in them, so the page never loads one (the
      // scripts are byte for byte the same); the perf tools read profiles back to source with them (e2e/lib/srcmap.cjs).
      sourcemap: course ? false : 'hidden',
      chunkSizeWarningLimit: 1024,
      // The build is the game; the dev/*.html pages are served by the dev server (`npm run dev`, `npm run workshop`).
      rollupOptions: { input: { main: resolve(root, 'index.html') } },
    },
    test: {
      environment: 'node',
      // Whole runs (bots, full playthroughs) live in tests/slow/ and run only with `npm run test:slow`.
      include: process.env.SLOW ? ['tests/slow/**/*.test.ts'] : ['tests/**/*.test.ts'],
      exclude: [...configDefaults.exclude, ...(process.env.SLOW ? [] : ['tests/slow/**'])],
    },
  };
});
