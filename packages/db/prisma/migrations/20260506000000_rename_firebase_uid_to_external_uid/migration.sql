-- Rename users.firebase_uid → users.external_uid (preserves data, no drop/recreate).
-- The unique constraint and the dedicated index travel with the column.

ALTER TABLE "users" RENAME COLUMN "firebase_uid" TO "external_uid";

-- Rename the auto-generated unique index/constraint to match the new column name.
ALTER INDEX "users_firebase_uid_key" RENAME TO "users_external_uid_key";

-- Rename the explicit @@index([firebaseUid]) index.
ALTER INDEX "users_firebase_uid_idx" RENAME TO "users_external_uid_idx";
