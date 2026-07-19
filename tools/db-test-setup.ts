/**
 * One-time local provisioning for the API integration-test database.
 *
 * Creates `rezeta_test` on the same Postgres server as `rezeta_dev` (if it
 * doesn't already exist) and runs `prisma migrate deploy` against it so the
 * schema is current. Safe to re-run — database creation is idempotent
 * (skips if it already exists) and `migrate deploy` only applies pending
 * migrations.
 *
 * Convention: `TEST_DATABASE_URL` — same host/creds as `DATABASE_URL`, dbname
 * `rezeta_test`. Defaults to swapping the dbname off `DATABASE_URL`/`.env` if
 * `TEST_DATABASE_URL` isn't set.
 *
 * Run:
 *   pnpm db:test:setup
 *
 * This ONLY ever touches the `rezeta_test` database (and the `postgres`
 * maintenance database, solely to issue `CREATE DATABASE`) — it never runs
 * against `rezeta_dev`.
 */
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')
const dbPackageDir = path.join(repoRoot, 'packages', 'db')

function deriveTestUrl(): string {
  const explicit = process.env['TEST_DATABASE_URL']
  if (explicit) return explicit

  const base = process.env['DATABASE_URL']
  if (!base) {
    console.error(
      'ERROR: neither TEST_DATABASE_URL nor DATABASE_URL is set. ' +
        'Set TEST_DATABASE_URL explicitly, or DATABASE_URL (rezeta_test will be derived from it).',
    )
    process.exit(1)
  }
  const url = new URL(base)
  url.pathname = '/rezeta_test'
  return url.toString()
}

function maintenanceUrlFor(testUrl: string): string {
  const url = new URL(testUrl)
  url.pathname = '/postgres'
  return url.toString()
}

function isAlreadyExistsError(stderr: string): boolean {
  // Postgres 42P04: duplicate_database
  return /already exists/i.test(stderr) || /42P04/.test(stderr)
}

function createDatabaseIfMissing(testUrl: string): void {
  const dbName = new URL(testUrl).pathname.replace(/^\//, '')
  const maintenanceUrl = maintenanceUrlFor(testUrl)
  try {
    execFileSync(
      'pnpm',
      ['exec', 'prisma', 'db', 'execute', '--stdin', `--url=${maintenanceUrl}`],
      { cwd: dbPackageDir, input: `CREATE DATABASE "${dbName}";`, stdio: ['pipe', 'inherit', 'pipe'] },
    )
    console.log(`Created database "${dbName}".`)
  } catch (err) {
    const stderr = err instanceof Error && 'stderr' in err ? String((err as { stderr: unknown }).stderr) : ''
    if (isAlreadyExistsError(stderr)) {
      console.log(`Database "${dbName}" already exists — skipping creation.`)
      return
    }
    throw err
  }
}

function migrate(testUrl: string): void {
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy', '--schema=prisma/schema.prisma'], {
    cwd: dbPackageDir,
    env: { ...process.env, DATABASE_URL: testUrl, DIRECT_URL: testUrl },
    stdio: 'inherit',
  })
}

const testUrl = deriveTestUrl()
console.log(`Provisioning integration test database: ${new URL(testUrl).pathname.replace(/^\//, '')}`)
createDatabaseIfMissing(testUrl)
migrate(testUrl)
console.log('Done. Run integration tests with:')
console.log(`  TEST_DATABASE_URL=${testUrl} pnpm test:integration`)
