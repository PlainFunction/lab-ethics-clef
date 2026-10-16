import { defineConfig } from 'vitest/config'

// Plain Node is enough: the AI binding is passed in, so tests use a fake.
export default defineConfig({ test: { include: ['test/**/*.test.ts'] } })
