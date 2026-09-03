import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// .mts extension is deliberate, matching options-tracker-web: native ESM config
// loading otherwise warns about a CommonJS/ESM mismatch.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // No DOM. Everything under src/lib/game/ is pure by design, and that is all
    // we test. Canvas rendering and the portal SDKs are verified by hand.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
