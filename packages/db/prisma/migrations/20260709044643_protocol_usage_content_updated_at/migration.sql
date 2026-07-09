-- AlterTable
ALTER TABLE "protocol_usages" ADD COLUMN     "content_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill: existing rows have no history distinguishing content writes from
-- modification-only writes, so seed content_updated_at from the row-level
-- updated_at (the closest available approximation) rather than "now".
UPDATE "protocol_usages" SET "content_updated_at" = "updated_at";
