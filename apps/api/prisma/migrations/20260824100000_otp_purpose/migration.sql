-- A one-time code says what it is for (T-266).
--
-- **A reset code and a sign-up code must not be interchangeable.** Until now
-- there was one kind, so a code issued to prove a number during sign-up would
-- have satisfied a password reset on an existing account just as well. Reset is
-- a second equal front door onto a live account, not a convenience bolted onto
-- sign-in, and a front door that accepts another door's key is not a door.
--
-- Hand-written. `prisma migrate diff` proposes dropping fourteen foreign keys
-- and several indexes that this schema declares by hand.

CREATE TYPE "OtpPurpose" AS ENUM ('REGISTER', 'RESET');

-- `REGISTER` for every existing row, which is what they all were: nothing has
-- ever issued a reset code, because the route to do so did not exist. The
-- default carries that forward for any writer not yet updated.
ALTER TABLE "OtpCode"
  ADD COLUMN "purpose" "OtpPurpose" NOT NULL DEFAULT 'REGISTER';

-- The lookup is always "the newest code of THIS kind for this number" — the
-- resend cooldown, the verify step and the sweep all ask it that way. Without
-- purpose in the index, a reset in flight would be found by a sign-up's
-- cooldown check and silently rate-limit an unrelated flow.
DROP INDEX IF EXISTS "OtpCode_phone_createdAt_idx";
CREATE INDEX "OtpCode_phone_purpose_createdAt_idx"
  ON "OtpCode" ("phone", "purpose", "createdAt");

-- And when a number may try again (T-266).
--
-- On the code row rather than on the account: the number is what is being
-- attacked, and it may have no account at all. A lock that only applies to
-- registered numbers is a slower way of asking which numbers are registered.
ALTER TABLE "OtpCode" ADD COLUMN "lockedUntil" TIMESTAMP(3);

-- A lock that begins before the code exists is not a state a real row reaches;
-- it is a clock bug, and one that would silently unlock every attempt.
ALTER TABLE "OtpCode"
  ADD CONSTRAINT "OtpCode_lock_after_creation"
  CHECK ("lockedUntil" IS NULL OR "lockedUntil" > "createdAt");
