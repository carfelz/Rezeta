import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/main.tsx',
        'src/test/**',
        'src/**/__tests__/**',
        'src/**/*.stories.{ts,tsx}',
        'src/**/*.d.ts',
        'src/i18n/**',
        // Pages are integration-level — E2E tested with Playwright
        'src/pages/**',
        // App shell / routing — require full app context
        'src/App.tsx',
        'src/AuthGate.tsx',
        'src/AppLayout.tsx',
        'src/Sidebar.tsx',
        'src/Topbar.tsx',
        // Auth gate / routing components — require full app context
        'src/components/auth/**',
        // Layout shell components — require full app context
        'src/components/layout/**',
        // Protocol editor components — complex UI, integration-tested
        'src/components/protocols/**',
        // Consultation order queue panel — complex UI, integration-tested
        'src/components/consultations/**',
        // Template editor — complex UI, integration-tested
        'src/components/template/**',
        // Protocol block renderer — complex UI, integration-tested via E2E
        'src/components/ui/ProtocolBlock.tsx',
        // Barrel re-export files — no logic to test
        'src/components/ui/index.ts',
        // Firebase module init — module-level side effects, not unit-testable
        'src/lib/firebase.ts',
      ],
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
})
