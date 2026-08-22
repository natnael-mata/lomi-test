-- Phone-and-password sign-in (T-263).
--
-- HAND-WRITTEN, for the reason recorded in 20260821120000_source_grade: the
-- generator's diff drops fourteen hand-written foreign keys.
--
-- Nullable and no default. Every account that exists today signed in through
-- Telegram and has no password, and null is the honest reading of that — a
-- placeholder hash would be a password somebody could theoretically guess,
-- where null cannot be signed in with at all.

ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;

-- The sign-in lookup, and the only way this column is ever read.
-- Partial: an account with no password can never match, so there is no reason
-- for it to sit in the index.
CREATE INDEX "User_phone_password_idx" ON "User" ("phone") WHERE "passwordHash" IS NOT NULL;
