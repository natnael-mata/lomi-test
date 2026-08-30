-- The opening question can be reported too (T-268).
--
-- `Report` referenced `Post` and nothing else, so only replies could be
-- reported. A thread's opening question is a `Thread` row, not a `Post` — which
-- meant an abusive or off-topic *question*, the most visible thing in a topic
-- and the thing every reply hangs off, could not be reported by anybody. QA
-- found the Report control on replies only and filed it as a real gap.
--
-- Both columns nullable with a CHECK that exactly one is set, rather than a
-- second table: the queue, the reasons, the one-report-per-person rule and the
-- reviewed/settled lifecycle are identical for both, and a parallel table would
-- be two of each with one of them quietly drifting.
--
-- Hand-written. `prisma migrate diff` proposes dropping fourteen foreign keys
-- and several indexes that this schema declares by hand.

ALTER TABLE "Report" ALTER COLUMN "postId" DROP NOT NULL;

ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "threadId" TEXT;

ALTER TABLE "Report"
  ADD CONSTRAINT "Report_threadId_fkey"
  FOREIGN KEY ("threadId") REFERENCES "Thread"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Exactly one target. Without this a row could name both, or neither, and the
-- queue would have to guess which one it is ruling on.
ALTER TABLE "Report"
  ADD CONSTRAINT "Report_one_target"
  CHECK (("postId" IS NULL) <> ("threadId" IS NULL));

-- One report per person per thread, matching the rule already held on posts: a
-- student who taps twice has not found two problems.
CREATE UNIQUE INDEX IF NOT EXISTS "Report_threadId_reporterId_key"
  ON "Report" ("threadId", "reporterId");

CREATE INDEX IF NOT EXISTS "Report_threadId_idx" ON "Report" ("threadId");
