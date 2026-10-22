import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Plain Node is enough: the AI binding is passed in, so tests use a fake.
// Telemetry's one Workers import is stood in for (test/cloudflare-workers.ts).
export default defineConfig({
  resolve: { alias: { 'cloudflare:workers': fileURLToPath(new URL('./test/cloudflare-workers.ts', import.meta.url)) } },
  test: { include: ['test/**/*.test.ts'] },
})
