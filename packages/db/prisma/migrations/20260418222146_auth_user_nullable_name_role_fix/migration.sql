-- AlterTable
ALTER TABLE "tenants" ALTER COLUMN "name" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "full_name" DROP NOT NULL,
ALTER COLUMN "role" SET DEFAULT 'owner';
