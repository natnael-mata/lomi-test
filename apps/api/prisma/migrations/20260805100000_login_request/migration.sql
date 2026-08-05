-- Telegram deep-link sign-in (T-075–T-078).
--
-- Hand-trimmed, per CLAUDE.md: `prisma migrate diff` also proposes dropping the
-- hand-written foreign keys on the exam tables, which are deliberate and
-- invisible to the datamodel. Only the new table is here.

CREATE TABLE "LoginRequest" (
    "id" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "pollSecretHash" TEXT NOT NULL,
    "pairingCode" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "telegramId" TEXT,
    "telegramUsername" TEXT,
    "declinedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "sessionId" TEXT,
    "requestedFromIp" TEXT,
    "deviceLabel" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LoginRequest_nonce_key" ON "LoginRequest"("nonce");
CREATE INDEX "LoginRequest_expiresAt_idx" ON "LoginRequest"("expiresAt");
CREATE INDEX "LoginRequest_createdAt_idx" ON "LoginRequest"("createdAt");

-- A request cannot be both approved and declined. The two columns exist to keep
-- "somebody tried to sign in as me" findable, and a row that claims both would
-- make that record useless.
ALTER TABLE "LoginRequest"
  ADD CONSTRAINT "LoginRequest_not_both_outcomes"
  CHECK ("approvedAt" IS NULL OR "declinedAt" IS NULL);

-- Claiming requires approval. Enforced here as well as in the service, because
-- this is the constraint that stands between a nonce and a session.
ALTER TABLE "LoginRequest"
  ADD CONSTRAINT "LoginRequest_claim_needs_approval"
  CHECK ("claimedAt" IS NULL OR "approvedAt" IS NOT NULL);
