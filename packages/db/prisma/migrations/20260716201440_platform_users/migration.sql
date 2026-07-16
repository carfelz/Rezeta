-- CreateTable
CREATE TABLE "platform_users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "external_uid" VARCHAR(128) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "full_name" VARCHAR(200),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "platform_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_users_external_uid_key" ON "platform_users"("external_uid");

-- CreateIndex
CREATE INDEX "platform_users_external_uid_idx" ON "platform_users"("external_uid");
