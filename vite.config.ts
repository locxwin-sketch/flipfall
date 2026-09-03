import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

// base: './' is load-bearing. GitHub Pages project sites serve from /<repo>/, and
// portals serve from a nested CDN path. An absolute-path build renders a blank page
// in both. See docs/ARCHITECTURE.md.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 8192,
    // One JS chunk on purpose — portals measure load time. Nothing forces this;
    // the codebase simply has no dynamic imports, so Rollup emits a single chunk.
    // If a dynamic import is ever added, disable code splitting here instead.
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
