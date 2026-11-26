import { defineConfig } from 'vite';
import { probes } from './probes.ts';

const root = import.meta.dirname;

export default defineConfig({
  // The Go app serves the build under /game/.
  base: '/game/',
  // The game joins the app's multiplayer hub (app/websocket) on the same host.
  define: { 'import.meta.env.VITE_HG_NET': JSON.stringify('/ws') },
  // probes(): the profiled copy of the game (`?prof=1`), built beside it and loaded only on that page.
  plugins: [probes(root)],
  build: { target: 'es2022', chunkSizeWarningLimit: 1024 },
});
