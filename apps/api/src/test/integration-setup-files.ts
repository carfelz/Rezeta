/**
 * Vitest `setupFiles` entry for the API integration project. Runs inside
 * every test-file worker (unlike `globalSetup`, which runs once in the main
 * process before workers start).
 *
 * Cleanup strategy: TRUNCATE all tables before each test, rather than
 * wrapping each test in a rolled-back transaction. Rejected the transaction
 * approach because several audit call sites are fire-and-forget
 * (`void this.auditLog.record(...)` — see e.g. `PermissionsService.updateModule`)
 * and production code never threads a shared `Prisma.TransactionClient`
 * through to `AuditLogRepository.insert`. A per-test transaction would need
 * every repository call in the chain to run on the *same* connection as the
 * test's transaction wrapper, which the fire-and-forget writes don't — they'd
 * either race the rollback or silently land on a different pooled
 * connection outside the transaction. Table truncation has no such
 * ordering dependency: every write, awaited or not, lands in the real
 * database, and `waitForAuditLog` (see `db-test-utils.ts`) polls for it.
 *
 * This suite additionally runs test files serially (`fileParallelism: false`
 * in `vitest.integration.config.ts`) — a per-test global TRUNCATE is only
 * safe when files don't share the database concurrently.
 */
import { afterAll, beforeEach } from 'vitest'
import { disconnectTestPrisma, getTestPrisma, hasTestDb, truncateAll } from './db-test-utils.js'

if (hasTestDb()) {
  beforeEach(async () => {
    await truncateAll(getTestPrisma())
  })

  afterAll(async () => {
    await disconnectTestPrisma()
  })
}
