-- Community threads, replies and reports (T-195, T-196, T-197).
--
-- Hand-trimmed from `prisma migrate diff`, which also proposed dropping nine
-- hand-written foreign keys and `User_deactivatedAt_idx`. Those exist because
-- the models use scalar ids rather than Prisma relations, so Prisma cannot see
-- them and offers to remove them on every diff. They stay.

-- CreateTable
CREATE TABLE "Thread" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "hiddenAt" TIMESTAMP(3),
    "hiddenBy" TEXT,
    "hiddenNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Thread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "hiddenAt" TIMESTAMP(3),
    "hiddenBy" TEXT,
    "hiddenNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Thread_topicId_createdAt_idx" ON "Thread"("topicId", "createdAt");
CREATE INDEX "Thread_fieldId_createdAt_idx" ON "Thread"("fieldId", "createdAt");
CREATE INDEX "Thread_authorId_idx" ON "Thread"("authorId");
CREATE INDEX "Thread_hiddenAt_idx" ON "Thread"("hiddenAt");
CREATE INDEX "Post_threadId_createdAt_idx" ON "Post"("threadId", "createdAt");
CREATE INDEX "Post_authorId_idx" ON "Post"("authorId");
CREATE INDEX "Post_hiddenAt_idx" ON "Post"("hiddenAt");
CREATE INDEX "Report_reviewedAt_createdAt_idx" ON "Report"("reviewedAt", "createdAt");

-- One report per person per post. A student who taps twice has not found two
-- problems, and a queue that counts them twice misleads whoever works it.
CREATE UNIQUE INDEX "Report_postId_reporterId_key" ON "Report"("postId", "reporterId");

-- Prisma's own relations.
ALTER TABLE "Post"
  ADD CONSTRAINT "Post_threadId_fkey"
  FOREIGN KEY ("threadId") REFERENCES "Thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Report"
  ADD CONSTRAINT "Report_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-written, for the scalar ids Prisma cannot see.
--
-- RESTRICT on topic and field, like every other reference to the taxonomy: a
-- topic with threads under it is not something to delete by accident, and the
-- question bank is the product's asset.
ALTER TABLE "Thread"
  ADD CONSTRAINT "Thread_topicId_fkey"
  FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Thread"
  ADD CONSTRAINT "Thread_fieldId_fkey"
  FOREIGN KEY ("fieldId") REFERENCES "Field"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CASCADE on authors. A deleted account's posts go with it: unlike a payment,
-- a comment is not a record anybody has to answer for later, and an orphan post
-- attributed to nobody is worse than a missing one.
ALTER TABLE "Thread"
  ADD CONSTRAINT "Thread_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Post"
  ADD CONSTRAINT "Post_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Report"
  ADD CONSTRAINT "Report_reporterId_fkey"
  FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A thread's denormalised field must match its topic's real field.
--
-- The same drift `Question.fieldId` has, and the same answer: enforced by the
-- database rather than trusted to every future write path. Without it, a
-- mismatched row shows one programme's discussion to another's students.
CREATE OR REPLACE FUNCTION thread_field_matches_topic() RETURNS trigger AS $$
DECLARE
  real_field TEXT;
BEGIN
  SELECT c."fieldId" INTO real_field
  FROM "Topic" t JOIN "Course" c ON c.id = t."courseId"
  WHERE t.id = NEW."topicId";

  IF real_field IS DISTINCT FROM NEW."fieldId" THEN
    RAISE EXCEPTION 'Thread.fieldId (%) does not match the field of its topic (%)',
      NEW."fieldId", real_field;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER thread_field_matches_topic_trigger
  BEFORE INSERT OR UPDATE OF "topicId", "fieldId" ON "Thread"
  FOR EACH ROW EXECUTE FUNCTION thread_field_matches_topic();

-- A post's body is never empty. The service checks it too; this is what makes
-- it true of every write path, including the one somebody adds next year.
ALTER TABLE "Post" ADD CONSTRAINT "Post_body_not_empty" CHECK (length(btrim("body")) > 0);
ALTER TABLE "Thread" ADD CONSTRAINT "Thread_body_not_empty" CHECK (length(btrim("body")) > 0);
ALTER TABLE "Thread" ADD CONSTRAINT "Thread_title_not_empty" CHECK (length(btrim("title")) > 0);
