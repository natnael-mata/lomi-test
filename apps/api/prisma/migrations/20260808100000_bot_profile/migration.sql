-- A student's relationship with the Telegram bot (T-180, T-181, T-182).
--
-- Hand-trimmed, per CLAUDE.md: `prisma migrate diff` also proposes dropping the
-- hand-written foreign keys on the exam tables, which are deliberate and
-- invisible to the datamodel. Only the new table is here.

CREATE TABLE "BotProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "referredVia" TEXT,
    "botOptOut" BOOLEAN NOT NULL DEFAULT false,
    "lastDailySentOn" TEXT,
    "chatId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BotProfile_userId_key" ON "BotProfile"("userId");
CREATE INDEX "BotProfile_botOptOut_lastDailySentOn_idx"
  ON "BotProfile"("botOptOut", "lastDailySentOn");

-- The profile goes when the student does.
ALTER TABLE "BotProfile"
  ADD CONSTRAINT "BotProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A calendar day, not an instant. Enforced here because the whole point of the
-- column is that nobody compares it against `now - 24h` (see the schema note).
ALTER TABLE "BotProfile"
  ADD CONSTRAINT "BotProfile_lastDailySentOn_is_a_date"
  CHECK ("lastDailySentOn" IS NULL OR "lastDailySentOn" ~ '^\d{4}-\d{2}-\d{2}$');
