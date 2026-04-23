/*
  Warnings:

  - A unique constraint covering the columns `[tenant_id,name]` on the table `protocol_types` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "protocol_templates" DROP CONSTRAINT "protocol_templates_tenant_id_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "protocol_types_tenant_id_name_key" ON "protocol_types"("tenant_id", "name");

-- AddForeignKey
ALTER TABLE "protocol_templates" ADD CONSTRAINT "protocol_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
