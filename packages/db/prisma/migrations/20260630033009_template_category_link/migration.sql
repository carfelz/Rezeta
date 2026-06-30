-- Protocol.template_id (nullable, informational)
ALTER TABLE "protocols" ADD COLUMN "template_id" UUID;
ALTER TABLE "protocols"
  ADD CONSTRAINT "protocols_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "protocol_templates"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ProtocolTemplate.category_id — add nullable first
ALTER TABLE "protocol_templates" ADD COLUMN "category_id" UUID;

-- Defensive: ensure every tenant that owns templates has at least one category.
INSERT INTO "protocol_categories" ("id", "tenant_id", "name", "color", "is_seeded", "created_at", "updated_at")
SELECT gen_random_uuid(), t."tenant_id", 'Emergencias', '#EF4444', true, now(), now()
FROM (SELECT DISTINCT "tenant_id" FROM "protocol_templates") t
WHERE NOT EXISTS (
  SELECT 1 FROM "protocol_categories" c
  WHERE c."tenant_id" = t."tenant_id" AND c."deleted_at" IS NULL
);

-- Backfill: each template -> its tenant's earliest-created live category.
UPDATE "protocol_templates" pt
SET "category_id" = sub."category_id"
FROM (
  SELECT DISTINCT ON (c."tenant_id") c."tenant_id", c."id" AS "category_id"
  FROM "protocol_categories" c
  WHERE c."deleted_at" IS NULL
  ORDER BY c."tenant_id", c."created_at" ASC
) sub
WHERE pt."tenant_id" = sub."tenant_id";

-- Enforce NOT NULL + FK now that every row has a value.
ALTER TABLE "protocol_templates" ALTER COLUMN "category_id" SET NOT NULL;
ALTER TABLE "protocol_templates"
  ADD CONSTRAINT "protocol_templates_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "protocol_categories"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "protocol_templates_category_id_idx" ON "protocol_templates"("category_id");

-- invoices.consultation_id index (schema drift from prior migration).
CREATE INDEX "invoices_consultation_id_idx" ON "invoices"("consultation_id");
