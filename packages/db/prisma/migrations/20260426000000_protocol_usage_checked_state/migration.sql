-- Add checked_state and completed_at to protocol_usages
ALTER TABLE "protocol_usages"
  ADD COLUMN "checked_state" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "completed_at" TIMESTAMPTZ;
