import { defineConfig } from 'vite'
import { resolve } from 'path'

/**
 * Chronicle AI — Integration Test Config
 * Phase 1.5
 *
 * Separate from vite.config.ts deliberately:
 *   - environment: 'node' (no DOM needed; these test the Supabase service layer)
 *   - NO setupFiles — integration tests must NOT load the global Supabase mock
 *     from tests/setup.ts. They talk to a real database.
 *   - Only picks up tests/integration/** — never runs alongside unit tests.
 *
 * Run with: npm run test:integration
 * Requires: a real local Supabase/Postgres instance (see SETUP.md).
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    // Integration tests hit a real DB — run them serially to avoid
    // cross-test data races on shared tables.
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
})
