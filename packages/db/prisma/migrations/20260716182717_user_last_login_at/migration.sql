-- Track the user's first successful sign-in. NULL means the account was created
-- by an admin (invitation sent) but the person has not yet signed in. The roster
-- derives an "invited" vs "active" status from this column.
ALTER TABLE "users" ADD COLUMN "last_login_at" TIMESTAMP(3);
