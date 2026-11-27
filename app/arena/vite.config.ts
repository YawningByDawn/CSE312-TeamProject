import { defineConfig } from 'vite';

// `npm run dev` serves the game alone and forwards the backend's routes to the compose stack (`docker compose up`,
// on localhost:8080), so logging in and the arena's socket work while the client hot-reloads. The Host header is kept,
// as the app and auth services check that a request's Origin matches it.
const backend = 'http://localhost:8080';

export default defineConfig({
  base: '/',
  build: { outDir: 'dist', target: 'es2022' },
  server: {
    proxy: {
      '/ws': { target: backend, ws: true },
      '/api': backend,
      '/login': backend,
      '/register': backend,
      '/logout': backend,
    },
  },
});
