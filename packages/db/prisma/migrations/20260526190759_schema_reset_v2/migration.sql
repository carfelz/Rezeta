/*
  Warnings:

  - You are about to drop the column `assessment` on the `consultations` table. All the data in the column will be lost.
  - You are about to drop the column `chief_complaint` on the `consultations` table. All the data in the column will be lost.
  - You are about to drop the column `consulted_at` on the `consultations` table. All the data in the column will be lost.
  - You are about to drop the column `content_hash` on the `consultations` table. All the data in the column will be lost.
  - You are about to drop the column `diagnoses` on the `consultations` table. All the data in the column will be lost.
  - You are about to drop the column `objective` on the `consultations` table. All the data in the column will be lost.
  - You are about to drop the column `plan` on the `consultations` table. All the data in the column will be lost.
  - You are about to drop the column `signed_by` on the `consultations` table. All the data in the column will be lost.
  - You are about to drop the column `subjective` on the `consultations` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `consultations` table. All the data in the column will be lost.
  - You are about to drop the column `vitals` on the `consultations` table. All the data in the column will be lost.
  - You are about to drop the column `contrast` on the `imaging_orders` table. All the data in the column will be lost.
  - You are about to drop the column `fasting_required` on the `imaging_orders` table. All the data in the column will be lost.
  - You are about to drop the column `indication` on the `imaging_orders` table. All the data in the column will be lost.
  - You are about to drop the column `source` on the `imaging_orders` table. All the data in the column will be lost.
  - You are about to drop the column `special_instructions` on the `imaging_orders` table. All the data in the column will be lost.
  - You are about to drop the column `study_type` on the `imaging_orders` table. All the data in the column will be lost.
  - You are about to drop the column `urgency` on the `imaging_orders` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `imaging_orders` table. All the data in the column will be lost.
  - You are about to drop the column `fasting_required` on the `lab_orders` table. All the data in the column will be lost.
  - You are about to drop the column `indication` on the `lab_orders` table. All the data in the column will be lost.
  - You are about to drop the column `sample_type` on the `lab_orders` table. All the data in the column will be lost.
  - You are about to drop the column `source` on the `lab_orders` table. All the data in the column will be lost.
  - You are about to drop the column `special_instructions` on the `lab_orders` table. All the data in the column will be lost.
  - You are about to drop the column `test_code` on the `lab_orders` table. All the data in the column will be lost.
  - You are about to drop the column `test_name` on the `lab_orders` table. All the data in the column will be lost.
  - You are about to drop the column `urgency` on the `lab_orders` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `lab_orders` table. All the data in the column will be lost.
  - You are about to drop the column `sort_order` on the `prescription_items` table. All the data in the column will be lost.
  - You are about to drop the column `items` on the `prescriptions` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `prescriptions` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `prescriptions` table. All the data in the column will be lost.
  - You are about to drop the column `checked_state` on the `protocol_usages` table. All the data in the column will be lost.
  - You are about to drop the column `type_id` on the `protocols` table. All the data in the column will be lost.
  - You are about to drop the `protocol_types` table. If the table is not empty, all the data it contains will be lost.
  - Adds required column `doctor_id` to `consultations`, `imaging_orders`, `lab_orders`, and `prescriptions`. Backfilled from the existing `user_id` column before `SET NOT NULL`, so this is safe on populated tables (manual edit; see migration body).

*/
-- DropForeignKey
ALTER TABLE "consultations" DROP CONSTRAINT "consultations_signed_by_fkey";

-- DropForeignKey
ALTER TABLE "consultations" DROP CONSTRAINT "consultations_user_id_fkey";

-- DropForeignKey
ALTER TABLE "imaging_orders" DROP CONSTRAINT "imaging_orders_user_id_fkey";

-- DropForeignKey
ALTER TABLE "lab_orders" DROP CONSTRAINT "lab_orders_user_id_fkey";

-- DropForeignKey
ALTER TABLE "prescriptions" DROP CONSTRAINT "prescriptions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "protocol_types" DROP CONSTRAINT "protocol_types_template_id_fkey";

-- DropForeignKey
ALTER TABLE "protocol_types" DROP CONSTRAINT "protocol_types_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "protocols" DROP CONSTRAINT "protocols_type_id_fkey";

-- DropIndex
DROP INDEX "consultations_appointment_id_key";

-- DropIndex
DROP INDEX "consultations_tenant_id_user_id_consulted_at_idx";

-- DropIndex
DROP INDEX "protocols_tenant_id_type_id_idx";

-- AlterTable: backfill doctor_id from user_id before enforcing NOT NULL (survives populated tables)
ALTER TABLE "consultations" ADD COLUMN "doctor_id" UUID;
UPDATE "consultations" SET "doctor_id" = "user_id" WHERE "doctor_id" IS NULL;
ALTER TABLE "consultations" ALTER COLUMN "doctor_id" SET NOT NULL,
DROP COLUMN "assessment",
DROP COLUMN "chief_complaint",
DROP COLUMN "consulted_at",
DROP COLUMN "content_hash",
DROP COLUMN "diagnoses",
DROP COLUMN "objective",
DROP COLUMN "plan",
DROP COLUMN "signed_by",
DROP COLUMN "subjective",
DROP COLUMN "user_id",
DROP COLUMN "vitals",
ADD COLUMN     "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "status" SET DEFAULT 'open';

-- AlterTable: backfill doctor_id from user_id before enforcing NOT NULL (survives populated tables)
ALTER TABLE "imaging_orders" ADD COLUMN "doctor_id" UUID;
UPDATE "imaging_orders" SET "doctor_id" = "user_id" WHERE "doctor_id" IS NULL;
ALTER TABLE "imaging_orders" ALTER COLUMN "doctor_id" SET NOT NULL,
DROP COLUMN "contrast",
DROP COLUMN "fasting_required",
DROP COLUMN "indication",
DROP COLUMN "source",
DROP COLUMN "special_instructions",
DROP COLUMN "study_type",
DROP COLUMN "urgency",
DROP COLUMN "user_id",
ALTER COLUMN "status" SET DEFAULT 'queued';

-- AlterTable: backfill doctor_id from user_id before enforcing NOT NULL (survives populated tables)
ALTER TABLE "lab_orders" ADD COLUMN "doctor_id" UUID;
UPDATE "lab_orders" SET "doctor_id" = "user_id" WHERE "doctor_id" IS NULL;
ALTER TABLE "lab_orders" ALTER COLUMN "doctor_id" SET NOT NULL,
DROP COLUMN "fasting_required",
DROP COLUMN "indication",
DROP COLUMN "sample_type",
DROP COLUMN "source",
DROP COLUMN "special_instructions",
DROP COLUMN "test_code",
DROP COLUMN "test_name",
DROP COLUMN "urgency",
DROP COLUMN "user_id",
ALTER COLUMN "status" SET DEFAULT 'queued';

-- AlterTable
ALTER TABLE "prescription_items" DROP COLUMN "sort_order";

-- AlterTable: backfill doctor_id from user_id before enforcing NOT NULL (survives populated tables)
ALTER TABLE "prescriptions" ADD COLUMN "doctor_id" UUID;
UPDATE "prescriptions" SET "doctor_id" = "user_id" WHERE "doctor_id" IS NULL;
ALTER TABLE "prescriptions" ALTER COLUMN "doctor_id" SET NOT NULL,
DROP COLUMN "items",
DROP COLUMN "notes",
DROP COLUMN "user_id",
ALTER COLUMN "status" SET DEFAULT 'queued';

-- AlterTable
ALTER TABLE "protocol_usages" DROP COLUMN "checked_state";

-- AlterTable
ALTER TABLE "protocols" DROP COLUMN "type_id",
ADD COLUMN     "category_id" UUID;

-- DropTable
DROP TABLE "protocol_types";

-- CreateTable
CREATE TABLE "protocol_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "color" VARCHAR(20) NOT NULL DEFAULT '#6B7280',
    "is_seeded" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "protocol_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imaging_order_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "imaging_order_id" UUID NOT NULL,
    "study_type" VARCHAR(300) NOT NULL,
    "indication" VARCHAR(500) NOT NULL,
    "urgency" VARCHAR(20) NOT NULL DEFAULT 'routine',
    "contrast" BOOLEAN NOT NULL DEFAULT false,
    "fasting_required" BOOLEAN NOT NULL DEFAULT false,
    "special_instructions" TEXT,
    "source" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imaging_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_order_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lab_order_id" UUID NOT NULL,
    "test_name" VARCHAR(300) NOT NULL,
    "indication" VARCHAR(500) NOT NULL,
    "urgency" VARCHAR(20) NOT NULL DEFAULT 'routine',
    "fasting_required" BOOLEAN NOT NULL DEFAULT false,
    "sample_type" VARCHAR(50) NOT NULL DEFAULT 'blood',
    "special_instructions" TEXT,
    "source" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "protocol_categories_tenant_id_idx" ON "protocol_categories"("tenant_id");

-- CreateIndex
CREATE INDEX "protocol_categories_tenant_id_deleted_at_idx" ON "protocol_categories"("tenant_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "protocol_categories_tenant_id_name_key" ON "protocol_categories"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "imaging_order_items_imaging_order_id_idx" ON "imaging_order_items"("imaging_order_id");

-- CreateIndex
CREATE INDEX "lab_order_items_lab_order_id_idx" ON "lab_order_items"("lab_order_id");

-- CreateIndex
CREATE INDEX "consultations_tenant_id_doctor_id_started_at_idx" ON "consultations"("tenant_id", "doctor_id", "started_at");

-- CreateIndex
CREATE INDEX "consultations_status_idx" ON "consultations"("status");

-- CreateIndex
CREATE INDEX "protocols_tenant_id_category_id_idx" ON "protocols"("tenant_id", "category_id");

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "protocols" ADD CONSTRAINT "protocols_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "protocol_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "protocol_categories" ADD CONSTRAINT "protocol_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imaging_orders" ADD CONSTRAINT "imaging_orders_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imaging_order_items" ADD CONSTRAINT "imaging_order_items_imaging_order_id_fkey" FOREIGN KEY ("imaging_order_id") REFERENCES "imaging_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_order_items" ADD CONSTRAINT "lab_order_items_lab_order_id_fkey" FOREIGN KEY ("lab_order_id") REFERENCES "lab_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
