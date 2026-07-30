-- AlterTable
ALTER TABLE "login_events" ADD COLUMN     "mfa_used" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "mfa_enrolled_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "identity_policies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "mfa_requirement" VARCHAR(20) NOT NULL DEFAULT 'off',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "identity_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "identity_policies_tenant_id_key" ON "identity_policies"("tenant_id");

-- AddForeignKey
ALTER TABLE "identity_policies" ADD CONSTRAINT "identity_policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
