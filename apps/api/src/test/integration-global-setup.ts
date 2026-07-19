/**
 * Vitest `globalSetup` for the API integration project (`vitest.integration.config.ts`).
 *
 * Runs once, in the main process, before any test file is collected or run.
 * Responsibilities:
 *   1. If `TEST_DATABASE_URL` is unset, log a skip notice and return — the
 *      integration project must not fail just because no local/CI Postgres
 *      is wired up. Individual `*.int-spec.ts` files additionally guard
 *      their `describe` block with `describe.skipIf(!hasTestDb())` so no
 *      test even attempts to connect.
 *   2. Otherwise, run `prisma migrate deploy` against `TEST_DATABASE_URL` so
 *      the schema is current, then truncate every table once so the suite
 *      starts from a known-empty database regardless of what a previous
 *      (possibly crashed) run left behind.
 *
 * Deliberately does NOT touch `DATABASE_URL`/`AUDIT_STRICT` in `process.env`
 * here — those are set declaratively via `test.env` in
 * `vitest.integration.config.ts` so every worker sees them from the moment
 * it starts, instead of relying on env mutations in this main-process-only
 * hook propagating to spawned worker threads/processes.
 */
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { PrismaClient } from '@rezeta/db'

// CommonJS output (apps/api has no "type":"module"), so use the native
// `__dirname` — matching app.module.ts / main.ts — rather than import.meta.
const here = __dirname
// apps/api/src/test -> repo root -> packages/db
const dbPackageDir = path.resolve(here, '..', '..', '..', '..', 'packages', 'db')

export default async function setup(): Promise<void> {
  const url = process.env['TEST_DATABASE_URL']
  if (!url) {
    console.warn(
      '[integration] TEST_DATABASE_URL is not set — skipping the integration suite. ' +
        'Run `pnpm db:test:setup` for one-time local provisioning, then re-run with ' +
        'TEST_DATABASE_URL=postgresql://rezeta:<pw>@localhost:5432/rezeta_test.',
    )
    return
  }

  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy', '--schema=prisma/schema.prisma'], {
    cwd: dbPackageDir,
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
    stdio: 'inherit',
  })

  const prisma = new PrismaClient({ datasources: { db: { url } } })
  try {
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
    `
    if (tables.length > 0) {
      const names = tables.map((t) => `"${t.tablename}"`).join(', ')
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`)
    }
  } finally {
    await prisma.$disconnect()
  }
}
