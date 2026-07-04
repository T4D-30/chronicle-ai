import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React runtime — changes rarely, benefits most from long cache TTL
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Supabase client — large SDK, rarely changes
          'vendor-supabase': ['@supabase/supabase-js'],
          // State management
          'vendor-state': ['zustand'],
          // App engine — deterministic game logic, no UI deps
          'engine': [
            './src/lib/engine/character',
            './src/lib/engine/conditions',
            './src/lib/engine/dice',
            './src/lib/engine/equipment',
            './src/lib/engine/intent',
            './src/lib/engine/outcome',
            './src/lib/engine/pipeline',
            './src/lib/engine/resolveAction',
            './src/lib/engine/skills',
          ],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    css: true,
    // Integration tests require a real local Supabase/Postgres instance and
    // are excluded from the default unit test run. Run them explicitly via
    // `npm run test:integration`.
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/integration/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/vite-env.d.ts'],
    },
  },
})
