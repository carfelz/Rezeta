-- Convert full unique constraints to PARTIAL unique indexes (WHERE deleted_at IS NULL)
-- on soft-deletable models, so soft-deleted rows no longer block reuse of their values.
--
-- Safe to apply in any environment, including ones with existing data:
--   * The previous full unique index already guaranteed global uniqueness, so the set of
--     *live* rows (deleted_at IS NULL) is necessarily already unique — the partial index
--     cannot fail to build on existing data.
--   * Index names are reused so the schema's logical names stay stable.
--   * DROP ... IF EXISTS keeps the migration idempotent if a prior partial fix was applied.
--
-- Partial indexes cannot be expressed in Prisma schema (PSL), so these indexes are managed
-- here in raw SQL and the corresponding @@unique/@unique attributes were removed from
-- schema.prisma.

-- protocol_categories (tenant_id, name)
DROP INDEX IF EXISTS "protocol_categories_tenant_id_name_key";
CREATE UNIQUE INDEX "protocol_categories_tenant_id_name_key"
  ON "protocol_categories" ("tenant_id", "name")
  WHERE "deleted_at" IS NULL;

-- invoices (tenant_id, invoice_number)
DROP INDEX IF EXISTS "invoices_tenant_id_invoice_number_key";
CREATE UNIQUE INDEX "invoices_tenant_id_invoice_number_key"
  ON "invoices" ("tenant_id", "invoice_number")
  WHERE "deleted_at" IS NULL;

-- invoices (consultation_id) — at most one *live* invoice per consultation
DROP INDEX IF EXISTS "invoices_consultation_id_key";
CREATE UNIQUE INDEX "invoices_consultation_id_key"
  ON "invoices" ("consultation_id")
  WHERE "deleted_at" IS NULL;

-- protocol_versions (protocol_id, version_number)
DROP INDEX IF EXISTS "protocol_versions_protocol_id_version_number_key";
CREATE UNIQUE INDEX "protocol_versions_protocol_id_version_number_key"
  ON "protocol_versions" ("protocol_id", "version_number")
  WHERE "deleted_at" IS NULL;
