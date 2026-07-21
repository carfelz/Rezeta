/**
 * Shared helpers for `*.int-spec.ts` integration tests that hit a real
 * Postgres database (`TEST_DATABASE_URL`, conventionally `rezeta_test`).
 *
 * Every helper here is a no-op-safe convenience — the actual "should this
 * suite run at all" decision lives in `hasTestDb()`, which every int-spec
 * file must guard its top-level `describe` with via `describe.skipIf`.
 */
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@rezeta/db'

/** True when an integration DB is configured for this process. Guard every int-spec file with this. */
export function hasTestDb(): boolean {
  return Boolean(process.env['TEST_DATABASE_URL'])
}

let sharedClient: PrismaClient | undefined

/**
 * A shared PrismaClient for test-side setup/assertions (seeding fixtures,
 * querying audit_logs, truncating). Production code under test constructs
 * its own `PrismaService` instances — those are separate connections to the
 * same physical database, which is fine for correctness at this suite's
 * scale.
 *
 * `DATABASE_URL` is expected to already point at `TEST_DATABASE_URL` — see
 * `vitest.integration.config.ts`, which overrides it via `test.env` for the
 * whole integration project.
 */
export function getTestPrisma(): PrismaClient {
  sharedClient ??= new PrismaClient()
  return sharedClient
}

export async function disconnectTestPrisma(): Promise<void> {
  if (sharedClient) {
    await sharedClient.$disconnect()
    sharedClient = undefined
  }
}

/**
 * Truncates every table in the `public` schema (except Prisma's own
 * migrations bookkeeping table) and resets identity sequences. Run before
 * each test — see rationale in `integration-setup-files.ts`.
 */
export async function truncateAll(prisma: PrismaClient = getTestPrisma()): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
  `
  if (tables.length === 0) return
  const names = tables.map((t) => `"${t.tablename}"`).join(', ')
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`)
}

/**
 * Polls for a row matching `where` in `audit_logs`. Several audit call sites
 * are fire-and-forget (`void this.auditLog.record(...)`), so the row may not
 * exist the instant the awaited service call returns — poll instead of a
 * single immediate query. Throws (failing the test with a clear message) if
 * the row never shows up within `timeoutMs`.
 */
export async function waitForAuditLog(
  prisma: PrismaClient,
  where: Record<string, unknown>,
  opts: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<Record<string, unknown>> {
  const timeoutMs = opts.timeoutMs ?? 2000
  const intervalMs = opts.intervalMs ?? 25
  const deadline = Date.now() + timeoutMs

  for (;;) {
    const row = await prisma.auditLog.findFirst({ where: where as never })
    if (row) return row as Record<string, unknown>
    if (Date.now() >= deadline) {
      throw new Error(
        `waitForAuditLog: no audit_logs row matched ${JSON.stringify(where)} within ${timeoutMs}ms`,
      )
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}

/** Minimal valid Tenant row for FK-satisfying fixtures. */
export async function createTestTenant(
  prisma: PrismaClient,
  overrides: Partial<{ name: string; type: string; plan: string }> = {},
): Promise<{ id: string }> {
  return prisma.tenant.create({
    data: {
      name: overrides.name ?? `Test Tenant ${randomUUID()}`,
      type: overrides.type ?? 'solo',
      plan: overrides.plan ?? 'free',
    },
    select: { id: true },
  })
}

/** Minimal valid User row for FK-satisfying fixtures. Unique externalUid/email per call. */
export async function createTestUser(
  prisma: PrismaClient,
  tenantId: string,
  overrides: Partial<{ role: string; email: string; fullName: string }> = {},
): Promise<{ id: string; role: string; email: string }> {
  const uid = randomUUID()
  return prisma.user.create({
    data: {
      tenantId,
      externalUid: `ext-${uid}`,
      email: overrides.email ?? `test-${uid}@example.com`,
      fullName: overrides.fullName ?? 'Test User',
      role: overrides.role ?? 'assistant',
    },
    select: { id: true, role: true, email: true },
  })
}

/** Minimal valid PlatformUser row for FK-satisfying fixtures. */
export async function createTestPlatformUser(
  prisma: PrismaClient,
  overrides: Partial<{ email: string; fullName: string }> = {},
): Promise<{ id: string; externalUid: string }> {
  const uid = randomUUID()
  return prisma.platformUser.create({
    data: {
      externalUid: `platform-ext-${uid}`,
      email: overrides.email ?? `platform-${uid}@example.com`,
      fullName: overrides.fullName ?? 'Test Platform User',
    },
    select: { id: true, externalUid: true },
  })
}
