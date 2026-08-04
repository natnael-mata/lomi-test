-- A reviewer's override of a derived topic weight (T-134a).
--
-- Hand-trimmed. `prisma migrate diff` also proposed dropping eight foreign keys
-- on Exam, ExamQuestion, Sitting, SittingAnswer and SittingResult. Those are
-- real and deliberate: those models use plain scalar ids so the parallel
-- payments branch can edit the same tables without collision, and their FKs are
-- written by hand in 20260804140000_exam_and_sitting. Prisma cannot see them in
-- the datamodel, so it reads them as drift and offers to remove them. Applying
-- that would delete the referential integrity of the whole exam subsystem.

CREATE TABLE "TopicWeightOverride" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "weightPct" INTEGER NOT NULL,
    "derivedPct" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "setBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopicWeightOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TopicWeightOverride_topicId_key" ON "TopicWeightOverride"("topicId");
CREATE INDEX "TopicWeightOverride_topicId_idx" ON "TopicWeightOverride"("topicId");

-- The topic must exist, and an override must not outlive it.
ALTER TABLE "TopicWeightOverride"
  ADD CONSTRAINT "TopicWeightOverride_topicId_fkey"
  FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A weight outside 0..100 is not a weight. Checked here rather than only in the
-- service, because the service is one of several things that can write this row.
ALTER TABLE "TopicWeightOverride"
  ADD CONSTRAINT "TopicWeightOverride_pct_range"
  CHECK ("weightPct" >= 0 AND "weightPct" <= 100 AND "derivedPct" >= 0 AND "derivedPct" <= 100);

-- An override with an empty reason is indistinguishable from a typo later on.
ALTER TABLE "TopicWeightOverride"
  ADD CONSTRAINT "TopicWeightOverride_reason_present"
  CHECK (length(btrim("reason")) > 0);
