-- Manual payments (T-145). Hand-trimmed per CLAUDE.md.

CREATE TYPE "PaymentMethod" AS ENUM ('BANK', 'CHAPA');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amountEtb" INTEGER NOT NULL,
    "txRef" TEXT NOT NULL,
    "note" TEXT,
    "settledBy" TEXT,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- One transfer settles one subscription. Without this the same receipt could be
-- submitted twice and an operator confirming both would grant twelve months for
-- one payment.
CREATE UNIQUE INDEX "Payment_txRef_key" ON "Payment"("txRef");
CREATE INDEX "Payment_userId_status_idx" ON "Payment"("userId", "status");
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RESTRICT: the record of a payment must outlive any attempt to tidy away the
-- subscription it settled.
ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_amount_positive" CHECK ("amountEtb" > 0);

-- A reference somebody can quote back. Empty is not a reference.
ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_txRef_present" CHECK (length(btrim("txRef")) > 0);

-- Settled means somebody settled it, and when.
ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_settled_has_actor"
  CHECK ("status" = 'PENDING' OR ("settledBy" IS NOT NULL AND "settledAt" IS NOT NULL));
