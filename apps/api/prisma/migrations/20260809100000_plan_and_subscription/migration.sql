-- Plans and subscriptions (T-140, T-140a, decisions D2/D3).
--
-- Hand-trimmed per CLAUDE.md: the generated diff also proposes dropping the
-- hand-written foreign keys on the exam tables, which are deliberate and
-- invisible to the datamodel.

CREATE TYPE "PlanCode" AS ENUM ('SIX_MONTH', 'TWELVE_MONTH');
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'CANCELLED');

CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "code" "PlanCode" NOT NULL,
    "months" INTEGER NOT NULL,
    -- Whole birr. Integer, never numeric/float: money here is never fractional,
    -- and a float is how a total becomes 499.99999999999994.
    "priceEtb" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");

-- A plan that grants no time, or costs nothing, is a bug rather than an offer.
ALTER TABLE "Plan"
  ADD CONSTRAINT "Plan_months_positive" CHECK ("months" > 0);
ALTER TABLE "Plan"
  ADD CONSTRAINT "Plan_price_positive" CHECK ("priceEtb" > 0);

CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "paidEtb" INTEGER NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "activatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Subscription_userId_status_idx" ON "Subscription"("userId", "status");
CREATE INDEX "Subscription_expiresAt_idx" ON "Subscription"("expiresAt");

ALTER TABLE "Subscription"
  ADD CONSTRAINT "Subscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RESTRICT, not CASCADE. A plan being deleted must not take the record of what
-- somebody bought with it — that record is the answer to "what was I charged".
ALTER TABLE "Subscription"
  ADD CONSTRAINT "Subscription_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Activation and expiry arrive together or not at all. A subscription with one
-- and not the other is either access with no end or an end with no beginning.
ALTER TABLE "Subscription"
  ADD CONSTRAINT "Subscription_activation_pairs"
  CHECK (("activatedAt" IS NULL) = ("expiresAt" IS NULL));

-- Access cannot expire before it began.
ALTER TABLE "Subscription"
  ADD CONSTRAINT "Subscription_expires_after_activation"
  CHECK ("expiresAt" IS NULL OR "expiresAt" > "activatedAt");

-- An ACTIVE subscription must have actually been activated.
ALTER TABLE "Subscription"
  ADD CONSTRAINT "Subscription_active_is_activated"
  CHECK ("status" <> 'ACTIVE' OR "activatedAt" IS NOT NULL);

-- The two launch plans (D2, D3). Inserted here rather than in a seed script so
-- every environment that runs migrations has them — a checkout with no plans is
-- a product that cannot take money, and a seed is a thing somebody forgets.
INSERT INTO "Plan" ("id", "code", "months", "priceEtb", "isActive", "updatedAt")
VALUES
  ('plan_six_month', 'SIX_MONTH', 6, 500, true, CURRENT_TIMESTAMP),
  ('plan_twelve_month', 'TWELVE_MONTH', 12, 800, true, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
