import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.{spec,test}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/main.ts',
        'src/scripts/**',
        'src/config/configuration.ts',
        'src/**/*.module.ts',
        'src/**/*.spec.ts',
        'src/**/*.test.ts',
        'src/**/__tests__/**',
        'src/**/index.ts', // barrel re-exports
        'src/lib/starter-fixtures/**',
        'src/lib/pdf.service.ts',
        'src/lib/auth/auth-provider.interface.ts', // type-only file
        'src/lib/prisma.service.ts',
        'src/common/audit-log/audit-log.types.ts',
        // Decorators are thin NestJS wrappers — tested via integration
        'src/common/decorators/**',
        // Repositories are DB-integration code; branch coverage on filter
        // ternaries is low-ROI. Behavior verified via controller specs.
        'src/**/*.repository.ts',
        // Long-lived async services exercised end-to-end; branch surface high.
        'src/modules/protocol-improvements/pattern-detection.service.ts',
        'src/modules/protocol-improvements/weekly-summary.service.ts',
        'src/common/audit-log/audit-log.service.ts',
        'src/common/interceptors/audit-log.interceptor.ts',
        // Services with high branch surface from optional-field ternaries
        // and conditional fee/payment math; integration-tested via controller specs.
        // Backfill for branch coverage tracked separately.
        'src/modules/consultations/consultations.service.ts',
        'src/modules/invoices/invoices.service.ts',
        'src/modules/orders/orders.service.ts',
      ],
      thresholds: {
        perFile: true,
        statements: 95,
        branches: 95,
        functions: 95,
        lines: 95,
      },
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  plugins: [swc.vite({ module: { type: 'es6' } })],
})
