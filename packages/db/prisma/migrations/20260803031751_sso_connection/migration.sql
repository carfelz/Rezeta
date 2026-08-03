-- CreateTable
CREATE TABLE "sso_connections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "type" VARCHAR(10) NOT NULL DEFAULT 'oidc',
    "provider_id" VARCHAR(120) NOT NULL,
    "display_name" VARCHAR(80) NOT NULL,
    "issuer_url" VARCHAR(512) NOT NULL,
    "client_id" VARCHAR(255) NOT NULL,
    "domains" TEXT[],
    "allow_password" BOOLEAN NOT NULL DEFAULT true,
    "status" VARCHAR(10) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sso_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sso_connections_provider_id_key" ON "sso_connections"("provider_id");

-- CreateIndex
CREATE INDEX "sso_connections_tenant_id_idx" ON "sso_connections"("tenant_id");

-- AddForeignKey
ALTER TABLE "sso_connections" ADD CONSTRAINT "sso_connections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
