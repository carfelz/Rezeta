-- Rename the identity join column now that Rezeta will mint the value itself
-- (self-hosted auth design, slice 1). Column type is deliberately unchanged:
-- Firebase still issues 28-character UIDs, so the retype to uuid waits for
-- slice 2.
ALTER TABLE "users" RENAME COLUMN "external_uid" TO "identity_id";
ALTER TABLE "platform_users" RENAME COLUMN "external_uid" TO "identity_id";

ALTER INDEX "users_external_uid_key" RENAME TO "users_identity_id_key";
ALTER INDEX "users_external_uid_idx" RENAME TO "users_identity_id_idx";
ALTER INDEX "platform_users_external_uid_key" RENAME TO "platform_users_identity_id_key";
ALTER INDEX "platform_users_external_uid_idx" RENAME TO "platform_users_identity_id_idx";
