-- Audit log v2: expand schema with actor type, category, status, metadata, request_id, error_code
-- Make tenant_id and entity fields nullable for system/auth events that predate a tenant

-- Drop old indexes
DROP INDEX IF EXISTS "audit_logs_tenant_id_entity_type_entity_id_idx";
DROP INDEX IF EXISTS "audit_logs_tenant_id_user_id_idx";
DROP INDEX IF EXISTS "audit_logs_created_at_idx";

-- Drop old foreign key constraints
ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_tenant_id_fkey";
ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_user_id_fkey";

-- Rename user_id → actor_user_id
ALTER TABLE "audit_logs" RENAME COLUMN "user_id" TO "actor_user_id";

-- Make tenant_id nullable (was NOT NULL)
ALTER TABLE "audit_logs" ALTER COLUMN "tenant_id" DROP NOT NULL;

-- Make entity_type nullable (was NOT NULL)
ALTER TABLE "audit_logs" ALTER COLUMN "entity_type" DROP NOT NULL;

-- Make entity_id nullable (was NOT NULL)
ALTER TABLE "audit_logs" ALTER COLUMN "entity_id" DROP NOT NULL;

-- Drop old varchar limit on user_agent to allow full text
ALTER TABLE "audit_logs" ALTER COLUMN "user_agent" TYPE TEXT;

-- Add new columns
ALTER TABLE "audit_logs"
  ADD COLUMN "actor_type"     VARCHAR(20) NOT NULL DEFAULT 'user',
  ADD COLUMN "on_behalf_of_id" UUID,
  ADD COLUMN "category"       VARCHAR(20) NOT NULL DEFAULT 'entity',
  ADD COLUMN "metadata"       JSONB,
  ADD COLUMN "request_id"     VARCHAR(128),
  ADD COLUMN "status"         VARCHAR(10) NOT NULL DEFAULT 'success',
  ADD COLUMN "error_code"     VARCHAR(100);

-- Re-add foreign keys
ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create new indexes
CREATE INDEX "audit_logs_tenant_id_created_at_idx" ON "audit_logs"("tenant_id", "created_at" DESC);
CREATE INDEX "audit_logs_tenant_id_entity_type_entity_id_idx" ON "audit_logs"("tenant_id", "entity_type", "entity_id");
CREATE INDEX "audit_logs_tenant_id_actor_user_id_created_at_idx" ON "audit_logs"("tenant_id", "actor_user_id", "created_at" DESC);
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at" DESC);
