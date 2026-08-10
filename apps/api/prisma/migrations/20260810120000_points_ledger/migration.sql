-- The points ledger and the leaderboard opt-out (T-190, T-191, T-194).
--
-- No `totalPoints` and no `streakDays` column, deliberately: a counter kept in
-- step by a write path is one that will eventually disagree with the rows it
-- claims to summarise, and the first anybody hears of it is a student saying
-- their number is wrong. Total points is a SUM over this table and the streak is
-- a COUNT of distinct days.
--
-- Hand-trimmed from `prisma migrate diff`, which also proposed dropping eight
-- hand-written foreign keys and `User_deactivatedAt_idx`. Those exist because
-- the models use scalar ids rather than Prisma relations, so Prisma cannot see
-- them and offers to remove them on every diff. They stay.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "leaderboardOptOut" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PointEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PointEntry_userId_day_idx" ON "PointEntry"("userId", "day");
CREATE INDEX "PointEntry_userId_createdAt_idx" ON "PointEntry"("userId", "createdAt");
CREATE INDEX "PointEntry_day_idx" ON "PointEntry"("day");

-- The foreign key, written by hand for the same reason as the exam tables:
-- Prisma cannot see it, so it survives every `migrate diff`.
--
-- CASCADE, unlike Payment's RESTRICT. A deleted account's points are not a
-- financial record anybody may need to answer for later — they are motivation
-- copy, and leaving orphan rows in a leaderboard query is worse than losing them.
ALTER TABLE "PointEntry"
  ADD CONSTRAINT "PointEntry_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Every row names its source (T-190), enforced by the database rather than by a
-- convention every future write path has to remember.
ALTER TABLE "PointEntry"
  ADD CONSTRAINT "PointEntry_names_its_source"
  CHECK (length(btrim("ruleId")) > 0 AND length(btrim("reason")) > 0);
