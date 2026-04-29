-- Protocol-in-Consultation migration
-- Adds: enhanced ProtocolUsage, ProtocolSuggestion, ImagingOrder, LabOrder,
--       PrescriptionItem, and various field additions across existing tables.

-- ── Consultation: add protocols_applied array ─────────────────────────────────
ALTER TABLE "consultations"
  ADD COLUMN "protocols_applied" TEXT[] NOT NULL DEFAULT '{}';

-- ── Prescription: add group support ──────────────────────────────────────────
ALTER TABLE "prescriptions"
  ADD COLUMN "group_title" VARCHAR(200),
  ADD COLUMN "group_order" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX "prescriptions_consultation_id_group_order_idx"
  ON "prescriptions"("consultation_id", "group_order");

-- ── PrescriptionItem ─────────────────────────────────────────────────────────
CREATE TABLE "prescription_items" (
  "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
  "prescription_id" UUID         NOT NULL,
  "drug"            VARCHAR(300) NOT NULL,
  "dose"            VARCHAR(200) NOT NULL,
  "route"           VARCHAR(100) NOT NULL,
  "frequency"       VARCHAR(200) NOT NULL,
  "duration"        VARCHAR(200) NOT NULL,
  "notes"           TEXT,
  "source"          VARCHAR(200),
  "sort_order"      INTEGER      NOT NULL DEFAULT 0,
  "created_at"      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT "prescription_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "prescription_items_prescription_id_fkey"
    FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE CASCADE
);

CREATE INDEX "prescription_items_prescription_id_idx"
  ON "prescription_items"("prescription_id");

-- ── ProtocolTemplate: add template_key and is_system ─────────────────────────
ALTER TABLE "protocol_templates"
  ADD COLUMN "template_key" VARCHAR(100),
  ADD COLUMN "is_system"    BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Protocol: add description, specialty, visibility, metadata ───────────────
ALTER TABLE "protocols"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "specialty"   VARCHAR(100),
  ADD COLUMN "visibility"  VARCHAR(20) NOT NULL DEFAULT 'private',
  ADD COLUMN "metadata"    JSONB;

-- ── ProtocolUsage: add working-copy + chain fields ───────────────────────────
ALTER TABLE "protocol_usages"
  ADD COLUMN "content"              JSONB        NOT NULL DEFAULT '{}',
  ADD COLUMN "modifications"        JSONB        NOT NULL DEFAULT '{}',
  ADD COLUMN "modification_summary" VARCHAR(500),
  ADD COLUMN "parent_usage_id"      UUID,
  ADD COLUMN "trigger_block_id"     VARCHAR(100),
  ADD COLUMN "depth"                INTEGER      NOT NULL DEFAULT 0,
  ADD COLUMN "status"               VARCHAR(20)  NOT NULL DEFAULT 'in_progress';

ALTER TABLE "protocol_usages"
  ADD CONSTRAINT "protocol_usages_parent_usage_id_fkey"
    FOREIGN KEY ("parent_usage_id") REFERENCES "protocol_usages"("id");

CREATE INDEX "protocol_usages_consultation_id_idx"  ON "protocol_usages"("consultation_id");
CREATE INDEX "protocol_usages_parent_usage_id_idx"  ON "protocol_usages"("parent_usage_id");
CREATE INDEX "protocol_usages_status_idx"           ON "protocol_usages"("status");
CREATE INDEX "protocol_usages_created_at_idx"       ON "protocol_usages"("created_at");
CREATE INDEX "protocol_usages_tenant_deleted_idx"   ON "protocol_usages"("tenant_id", "deleted_at");

-- ── ProtocolSuggestion ───────────────────────────────────────────────────────
CREATE TABLE "protocol_suggestions" (
  "id"                    UUID          NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"             UUID          NOT NULL,
  "protocol_id"           UUID          NOT NULL,
  "protocol_version_id"   UUID          NOT NULL,
  "pattern_type"          VARCHAR(100)  NOT NULL,
  "pattern_data"          JSONB         NOT NULL,
  "suggested_changes"     JSONB         NOT NULL,
  "impact_summary"        VARCHAR(500)  NOT NULL,
  "occurrence_count"      INTEGER       NOT NULL,
  "total_uses"            INTEGER       NOT NULL,
  "occurrence_percentage" DECIMAL(5,2)  NOT NULL,
  "status"                VARCHAR(20)   NOT NULL DEFAULT 'pending',
  "applied_at"            TIMESTAMPTZ,
  "dismissed_at"          TIMESTAMPTZ,
  "created_at"            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updated_at"            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT "protocol_suggestions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "protocol_suggestions_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id"),
  CONSTRAINT "protocol_suggestions_protocol_id_fkey"
    FOREIGN KEY ("protocol_id") REFERENCES "protocols"("id")
);

CREATE INDEX "protocol_suggestions_protocol_id_status_idx"
  ON "protocol_suggestions"("protocol_id", "status");
CREATE INDEX "protocol_suggestions_tenant_id_idx"
  ON "protocol_suggestions"("tenant_id");
CREATE INDEX "protocol_suggestions_created_at_idx"
  ON "protocol_suggestions"("created_at");

-- ── ImagingOrder ─────────────────────────────────────────────────────────────
CREATE TABLE "imaging_orders" (
  "id"                  UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"           UUID         NOT NULL,
  "consultation_id"     UUID         NOT NULL,
  "patient_id"          UUID         NOT NULL,
  "user_id"             UUID         NOT NULL,
  "group_title"         VARCHAR(200),
  "group_order"         INTEGER      NOT NULL DEFAULT 1,
  "study_type"          VARCHAR(300) NOT NULL,
  "indication"          VARCHAR(500) NOT NULL,
  "urgency"             VARCHAR(20)  NOT NULL DEFAULT 'routine',
  "contrast"            BOOLEAN      NOT NULL DEFAULT FALSE,
  "fasting_required"    BOOLEAN      NOT NULL DEFAULT FALSE,
  "special_instructions" TEXT,
  "source"              VARCHAR(200),
  "status"              VARCHAR(20)  NOT NULL DEFAULT 'draft',
  "signed_at"           TIMESTAMPTZ,
  "pdf_url"             VARCHAR(2048),
  "created_at"          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updated_at"          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "deleted_at"          TIMESTAMPTZ,

  CONSTRAINT "imaging_orders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "imaging_orders_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id"),
  CONSTRAINT "imaging_orders_consultation_id_fkey"
    FOREIGN KEY ("consultation_id") REFERENCES "consultations"("id"),
  CONSTRAINT "imaging_orders_patient_id_fkey"
    FOREIGN KEY ("patient_id") REFERENCES "patients"("id"),
  CONSTRAINT "imaging_orders_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
);

CREATE INDEX "imaging_orders_consultation_id_group_order_idx"
  ON "imaging_orders"("consultation_id", "group_order");
CREATE INDEX "imaging_orders_tenant_id_idx"
  ON "imaging_orders"("tenant_id");
CREATE INDEX "imaging_orders_tenant_deleted_idx"
  ON "imaging_orders"("tenant_id", "deleted_at");

-- ── LabOrder ─────────────────────────────────────────────────────────────────
CREATE TABLE "lab_orders" (
  "id"                  UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"           UUID         NOT NULL,
  "consultation_id"     UUID         NOT NULL,
  "patient_id"          UUID         NOT NULL,
  "user_id"             UUID         NOT NULL,
  "group_title"         VARCHAR(200),
  "group_order"         INTEGER      NOT NULL DEFAULT 1,
  "test_name"           VARCHAR(300) NOT NULL,
  "test_code"           VARCHAR(50),
  "indication"          VARCHAR(500) NOT NULL,
  "urgency"             VARCHAR(20)  NOT NULL DEFAULT 'routine',
  "fasting_required"    BOOLEAN      NOT NULL DEFAULT FALSE,
  "sample_type"         VARCHAR(50)  NOT NULL,
  "special_instructions" TEXT,
  "source"              VARCHAR(200),
  "status"              VARCHAR(20)  NOT NULL DEFAULT 'draft',
  "signed_at"           TIMESTAMPTZ,
  "pdf_url"             VARCHAR(2048),
  "created_at"          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updated_at"          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "deleted_at"          TIMESTAMPTZ,

  CONSTRAINT "lab_orders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lab_orders_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id"),
  CONSTRAINT "lab_orders_consultation_id_fkey"
    FOREIGN KEY ("consultation_id") REFERENCES "consultations"("id"),
  CONSTRAINT "lab_orders_patient_id_fkey"
    FOREIGN KEY ("patient_id") REFERENCES "patients"("id"),
  CONSTRAINT "lab_orders_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
);

CREATE INDEX "lab_orders_consultation_id_group_order_idx"
  ON "lab_orders"("consultation_id", "group_order");
CREATE INDEX "lab_orders_tenant_id_idx"
  ON "lab_orders"("tenant_id");
CREATE INDEX "lab_orders_tenant_deleted_idx"
  ON "lab_orders"("tenant_id", "deleted_at");
