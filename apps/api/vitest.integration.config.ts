import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

const testDatabaseUrl = process.env['TEST_DATABASE_URL']

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.int-spec.ts'],
    globalSetup: ['src/test/integration-global-setup.ts'],
    setupFiles: ['src/test/integration-setup-files.ts'],
    // Every int-spec file truncates the whole database before each test (see
    // integration-setup-files.ts) — running files in parallel would let one
    // file's TRUNCATE wipe another file's in-progress fixtures.
    fileParallelism: false,
    // Fire-and-forget audit writes + a truncate-per-test cleanup strategy
    // both need generous headroom under load; the default 5s is tight when
    // running everything serially against a real DB.
    testTimeout: 15_000,
    hookTimeout: 30_000,
    // Declarative env for every worker, set at config-eval time (main
    // process) rather than mutated at runtime in globalSetup — see the
    // rationale in integration-global-setup.ts.
    env: testDatabaseUrl
      ? {
          DATABASE_URL: testDatabaseUrl,
          DIRECT_URL: testDatabaseUrl,
          // Non-prod strict mode: a failed audit insert rethrows instead of
          // being silently logged, so a payload/schema mismatch fails this
          // suite loudly. See AuditLogService.record.
          AUDIT_STRICT: '1',
        }
      : {},
    // No coverage gate here — integration tests exercise real DB constraints,
    // not statement/branch coverage; the 95%-per-file unit gate lives in
    // vitest.config.ts and must stay unaffected by this project.
  },
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  plugins: [swc.vite({ module: { type: 'es6' } })],
})
