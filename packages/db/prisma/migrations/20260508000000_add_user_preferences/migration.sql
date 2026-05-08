-- Add preferences JSONB column to users for cross-device-synced UI preferences
-- (e.g. consultation view mode). Defaults to empty object.
ALTER TABLE "users"
  ADD COLUMN "preferences" JSONB NOT NULL DEFAULT '{}'::jsonb;
