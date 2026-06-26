# Partial Unique Indexes for Soft-Deleted Records + Global P2002 Handling

**Date:** 2026-06-26
**Status:** Approved design — ready for implementation plan

## Problem

Creating a `ProtocolCategory` named "consulta" after a same-named category had been
soft-deleted fails with an **unhandled 500**:

```
Invalid `this.prisma.protocolCategory.create()` invocation
Unique constraint failed on the fields: (`tenant_id`,`name`)
```

There are two independent root causes:

1. **Unique constraints count soft-deleted rows.** The project uses soft deletes
   (`deleted_at` flags) everywhere per its architectural principles, but the unique
   constraints do not exclude soft-deleted rows. A deleted category still occupies its
   `(tenant_id, name)` slot, so recreating the same name collides at the database level.
2. **Prisma errors leak as HTTP 500s.** The global catch-all `HttpExceptionFilter`
   (`apps/api/src/common/filters/http-exception.filter.ts`) has no branch for
   `PrismaClientKnownRequestError`, so a `P2002` unique violation falls through to
   `INTERNAL_ERROR` (500) instead of a clean `409 Conflict`.

This affects the whole project, not just categories — any unique constraint on a
soft-deletable model has the same latent failure.

## Scope

### In scope — Part A: partial unique indexes

Convert the unique constraints below to **partial** unique indexes
(`WHERE deleted_at IS NULL`) so that soft-deleted rows no longer block reuse, while
uniqueness among *live* rows is preserved.

| Model.Constraint | DB index name | Schema change |
| --- | --- | --- |
| `ProtocolCategory(tenant_id, name)` | `protocol_categories_tenant_id_name_key` | remove `@@unique` |
| `Invoice(tenant_id, invoice_number)` | `invoices_tenant_id_invoice_number_key` | remove `@@unique` |
| `Invoice.consultation_id` | `invoices_consultation_id_key` | remove `@unique` **and** flip the `Consultation.invoice Invoice?` back-relation to `invoices Invoice[]` |
| `ProtocolVersion(protocol_id, version_number)` | `protocol_versions_protocol_id_version_number_key` | remove `@@unique` |

### In scope — Part B: global P2002 → 409 mapping

A safety net so a *genuine live* duplicate produces a clean `409 Conflict` everywhere in
the app, never an unhandled 500:

- Add a generic `RESOURCE_CONFLICT` error code to `packages/shared/src/errors.ts`.
- Add a `Prisma.PrismaClientKnownRequestError` branch to `HttpExceptionFilter` mapping
  `P2002` → HTTP 409 with code `RESOURCE_CONFLICT`.

### Explicitly NOT converted

| Constraint | Reason |
| --- | --- |
| `User.external_uid` (`@unique`) | Queried via `prisma.user.findUnique({ where: { externalUid } })` in the auth/provisioning path (`users.repository.ts`). `findUnique` requires a *full* unique index; a partial index would break it. It is also a global auth identity where reuse-after-delete is not desired. |
| `DoctorLocation(user_id, location_id)` | Join table with **no** `deleted_at` (hard-delete model). Its `@@unique` backs an `upsert` (`locations.repository.ts`), which also requires a full unique index. |

### Out of scope (flagged, not done here)

- The missing **edit button** for protocol categories (frontend). This is what forced the
  delete-and-recreate that surfaced the bug, but it is a separate frontend change.
- Any **frontend** changes, including a Spanish user-facing message for `RESOURCE_CONFLICT`.
  Per decision on 2026-06-26, the frontend is left untouched for now; the API will return a
  clean 409 that the existing error surface renders generically.

## Design

### Part A — partial unique indexes

Prisma's schema language (PSL) cannot express partial indexes (`WHERE` clauses), so these
must be managed as **raw SQL** in a migration, with the corresponding `@@unique`/`@unique`
attributes removed from `schema.prisma`.

**Migration** — new directory
`packages/db/prisma/migrations/<timestamp>_partial_unique_soft_delete/migration.sql`.
For each of the four constraints:

```sql
DROP INDEX "protocol_categories_tenant_id_name_key";
CREATE UNIQUE INDEX "protocol_categories_tenant_id_name_key"
  ON "protocol_categories" ("tenant_id", "name")
  WHERE "deleted_at" IS NULL;
```

…and analogously for `invoices_tenant_id_invoice_number_key`,
`invoices_consultation_id_key`, and `protocol_versions_protocol_id_version_number_key`.
Reusing the original index names keeps `prisma migrate` drift checks quiet and keeps the
names predictable. The `DROP`/`CREATE` is safe because the existing full unique constraint
already guarantees no duplicate *live* rows exist, so the new partial index cannot fail to
build.

**Schema (`packages/db/prisma/schema.prisma`):**

- Remove the `@@unique([...])` lines for `ProtocolCategory`, `Invoice` (invoice number),
  and `ProtocolVersion`. Keep/add a plain `@@index([...])` where useful for lookup
  performance on live rows (the partial unique index also serves live-row lookups; add a
  non-unique index only if a query needs it).
- Remove `@unique` from `Invoice.consultationId`, and change the back-relation on
  `Consultation` from `invoice Invoice?` (one-to-one) to `invoices Invoice[]`
  (one-to-many). This is required because Prisma's one-to-one declaration forces the
  referenced scalar to be `@unique`. Verified: no backend code reads the
  `consultation.invoice` relation accessor, so the cardinality change has near-zero blast
  radius. The partial index still enforces at most one *live* invoice per consultation.
- Add a short comment at the top of each affected model noting that its uniqueness is
  enforced by a partial index managed in raw SQL (so a future reader doesn't "fix" the
  missing `@@unique`).

Because these indexes are no longer described in PSL, `prisma db pull` would not
re-introduce them; the migration is the source of truth. This is the standard Prisma
pattern for partial indexes.

### Part B — global P2002 → 409 mapping

**`packages/shared/src/errors.ts`:** add to the `ErrorCode` enum:

```ts
RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
```

**`apps/api/src/common/filters/http-exception.filter.ts`:** before the generic
`else` (500) branch, add:

```ts
} else if (
  exception instanceof Prisma.PrismaClientKnownRequestError &&
  exception.code === 'P2002'
) {
  status = HttpStatus.CONFLICT
  const isProd = process.env.NODE_ENV === 'production'
  error = {
    code: ErrorCode.RESOURCE_CONFLICT,
    message: 'A record with these values already exists',
    ...(isProd ? {} : { details: { target: exception.meta?.target } }),
  }
}
```

`Prisma` is imported from the generated client (`@rezeta/db` / `@prisma/client`,
matching the existing import convention in the repository layer). Only `P2002` is mapped
in this change; other Prisma error codes continue to fall through to the existing handler.

## Testing

- **Filter unit test** (`http-exception.filter.spec.ts`): a `PrismaClientKnownRequestError`
  with `code: 'P2002'` produces HTTP 409 and `RESOURCE_CONFLICT`; an unrelated error still
  produces 500.
- **ProtocolCategory** (repository/integration against the test DB): create → soft-delete →
  recreate the same `(tenant_id, name)` **succeeds**; two live rows with the same name fail
  at the DB level (and surface as 409 through the filter).
- **Invoice**: create → soft-delete → recreate same `(tenant_id, invoice_number)` succeeds;
  one live invoice per consultation still enforced.
- **ProtocolVersion**: create → soft-delete → recreate same `(protocol_id, version_number)`
  succeeds.
- **Migration** is applied against the test database as part of the suite.
- Gates: `pnpm lint` clean, `pnpm test` green, coverage ≥ 90% across packages.

## Changelog

Prepend a `[2026-06-26]` entry to `CHANGELOG.md` documenting:
- **Fixed:** soft-deleted records no longer block reuse of unique values (categories,
  invoice numbers, invoice-per-consultation, protocol versions).
- **Added:** global mapping of Prisma `P2002` unique violations to HTTP 409
  `RESOURCE_CONFLICT`.
- **Changed:** `Consultation.invoice` relation is now a list (`invoices`) to support the
  partial unique index on `Invoice.consultation_id`.
