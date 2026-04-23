-- Slice A: Schema Rework
-- Migrates from old model (system templates, direct template_id on protocols)
-- to three-layer model (ProtocolTemplate → ProtocolType → Protocol).
-- Destructive: truncates all protocol engine tables. No production data exists.

-- Step 1: Drop all protocol engine rows and FKs that reference old structure

TRUNCATE TABLE "protocol_usages" CASCADE;
TRUNCATE TABLE "protocol_versions" CASCADE;
TRUNCATE TABLE "protocols" CASCADE;
TRUNCATE TABLE "protocol_templates" CASCADE;

-- Step 2: Drop old columns and constraints from protocol_templates

ALTER TABLE "protocol_templates"
  DROP CONSTRAINT IF EXISTS "protocol_templates_templateKey_locale_key",
  DROP COLUMN IF EXISTS "template_key",
  DROP COLUMN IF EXISTS "locale",
  DROP COLUMN IF EXISTS "category",
  DROP COLUMN IF EXISTS "icon",
  DROP COLUMN IF EXISTS "is_system";

-- Step 3: Make tenant_id required on protocol_templates

ALTER TABLE "protocol_templates"
  ALTER COLUMN "tenant_id" SET NOT NULL;

-- Step 4: Add is_seeded to protocol_templates

ALTER TABLE "protocol_templates"
  ADD COLUMN IF NOT EXISTS "is_seeded" BOOLEAN NOT NULL DEFAULT false;

-- Step 5: Add seeded_at to tenants

ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "seeded_at" TIMESTAMP(3);

-- Step 6: Create protocol_types table

CREATE TABLE "protocol_types" (
    "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"   UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "name"        VARCHAR(200) NOT NULL,
    "is_seeded"   BOOLEAN NOT NULL DEFAULT false,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,
    "deleted_at"  TIMESTAMP(3),

    CONSTRAINT "protocol_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "protocol_types_tenant_id_name_key"
  ON "protocol_types"("tenant_id", "name")
  WHERE "deleted_at" IS NULL;

CREATE INDEX "protocol_types_tenant_id_idx"
  ON "protocol_types"("tenant_id");

CREATE INDEX "protocol_types_tenant_id_template_id_idx"
  ON "protocol_types"("tenant_id", "template_id");

CREATE INDEX "protocol_types_tenant_id_deleted_at_idx"
  ON "protocol_types"("tenant_id", "deleted_at");

ALTER TABLE "protocol_types"
  ADD CONSTRAINT "protocol_types_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "protocol_types_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "protocol_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 7: Replace template_id with type_id on protocols
--         Also drop original_protocol_id, visibility, specialty columns

ALTER TABLE "protocols"
  DROP COLUMN IF EXISTS "template_id",
  DROP COLUMN IF EXISTS "original_protocol_id",
  DROP COLUMN IF EXISTS "visibility",
  DROP COLUMN IF EXISTS "specialty";

ALTER TABLE "protocols"
  ADD COLUMN "type_id" UUID NOT NULL;

CREATE INDEX "protocols_tenant_id_type_id_idx"
  ON "protocols"("tenant_id", "type_id");

ALTER TABLE "protocols"
  ADD CONSTRAINT "protocols_type_id_fkey"
    FOREIGN KEY ("type_id") REFERENCES "protocol_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 8: Add missing index on protocol_templates

CREATE INDEX IF NOT EXISTS "protocol_templates_tenant_id_deleted_at_idx"
  ON "protocol_templates"("tenant_id", "deleted_at");
