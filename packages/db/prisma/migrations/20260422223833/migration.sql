-- DropForeignKey
ALTER TABLE "protocol_templates" DROP CONSTRAINT "protocol_templates_tenant_id_fkey";

-- AddForeignKey
ALTER TABLE "protocol_templates" ADD CONSTRAINT "protocol_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
