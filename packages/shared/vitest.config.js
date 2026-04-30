import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.{spec,test}.ts', '__tests__/**/*.{spec,test}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        'src/**/*.test.ts',
        'src/types/**',
        'src/**/index.ts',
        'src/errors.ts',
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
//# sourceMappingURL=vitest.config.js.map
