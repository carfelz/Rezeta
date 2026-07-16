-- Widen the role vocabulary. The legacy `owner` role is renamed to `super_admin`,
-- and the column default for newly provisioned rows changes from `owner` to `assistant`.
-- `doctor` rows are unaffected. Role values remain free-form VarChar (no Prisma enum);
-- validation lives in the shared Zod schema.

-- Data migration: promote existing owners to super_admin.
UPDATE "users" SET "role" = 'super_admin' WHERE "role" = 'owner';

-- Schema: new default role for provisioned rows.
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'assistant';
