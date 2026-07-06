-- CreateTable
CREATE TABLE "consultation_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "consultation_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "sections" JSONB NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL,
    "signed_at" TIMESTAMP(3),
    "signed_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "consultation_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consultation_records_tenant_id_patient_id_idx" ON "consultation_records"("tenant_id", "patient_id");

-- CreateIndex
CREATE UNIQUE INDEX "consultation_records_consultation_id_version_number_key" ON "consultation_records"("consultation_id", "version_number");

-- AddForeignKey
ALTER TABLE "consultation_records" ADD CONSTRAINT "consultation_records_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_records" ADD CONSTRAINT "consultation_records_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
