-- One-time codes for phone registration (T-264).
--
-- HAND-WRITTEN, for the reason recorded in 20260821120000_source_grade.
--
-- No foreign key to "User", on purpose: a registration code is sent to a number
-- that has no account yet, and that is the whole point of it.

CREATE TABLE "OtpCode" (
  "id"         TEXT NOT NULL,
  "phone"      TEXT NOT NULL,
  "codeHash"   TEXT NOT NULL,
  "expiresAt"  TIMESTAMP(3) NOT NULL,
  "attempts"   INTEGER NOT NULL DEFAULT 0,
  "consumedAt" TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- The two reads: the newest code for a phone (cooldown and verification), and
-- the expired ones (housekeeping).
CREATE INDEX "OtpCode_phone_createdAt_idx" ON "OtpCode" ("phone", "createdAt");
CREATE INDEX "OtpCode_expiresAt_idx" ON "OtpCode" ("expiresAt");

-- A code cannot expire before it was created, and attempts cannot go negative.
-- Both are impossible through the service; a CHECK is what makes them impossible
-- through anything else.
ALTER TABLE "OtpCode" ADD CONSTRAINT "OtpCode_expires_after_creation"
  CHECK ("expiresAt" > "createdAt");
ALTER TABLE "OtpCode" ADD CONSTRAINT "OtpCode_attempts_not_negative"
  CHECK ("attempts" >= 0);
