-- CreateEnum
CREATE TYPE "SittingCloseReason" AS ENUM ('SUBMITTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "conceptCount" INTEGER NOT NULL,
    "calculationCount" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "builtBy" TEXT NOT NULL,
    "builtAt" TIMESTAMP(3) NOT NULL,
    "topicPlan" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamQuestion" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "qType" "QType" NOT NULL,
    "timeLimitSec" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sitting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "closeReason" "SittingCloseReason",
    "scoreCorrect" INTEGER,
    "answeredCount" INTEGER,
    "startedBySessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sitting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SittingAnswer" (
    "id" TEXT NOT NULL,
    "sittingId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "chosenLabel" "OptionLabel",
    "isFlagged" BOOLEAN NOT NULL DEFAULT false,
    "answeredAt" TIMESTAMP(3),
    "answeredBySessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SittingAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SittingResult" (
    "id" TEXT NOT NULL,
    "sittingId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "chosenLabel" "OptionLabel",
    "isCorrect" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SittingResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Exam_fieldId_isActive_idx" ON "Exam"("fieldId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Exam_fieldId_slug_key" ON "Exam"("fieldId", "slug");

-- CreateIndex
CREATE INDEX "ExamQuestion_questionId_idx" ON "ExamQuestion"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamQuestion_examId_position_key" ON "ExamQuestion"("examId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ExamQuestion_examId_questionId_key" ON "ExamQuestion"("examId", "questionId");

-- CreateIndex
CREATE INDEX "Sitting_userId_fieldId_startedAt_idx" ON "Sitting"("userId", "fieldId", "startedAt");

-- CreateIndex
CREATE INDEX "Sitting_closedAt_endsAt_idx" ON "Sitting"("closedAt", "endsAt");

-- CreateIndex
CREATE INDEX "Sitting_examId_idx" ON "Sitting"("examId");

-- CreateIndex
CREATE INDEX "SittingAnswer_sittingId_idx" ON "SittingAnswer"("sittingId");

-- CreateIndex
CREATE UNIQUE INDEX "SittingAnswer_sittingId_questionId_key" ON "SittingAnswer"("sittingId", "questionId");

-- CreateIndex
CREATE INDEX "SittingResult_sittingId_idx" ON "SittingResult"("sittingId");

-- CreateIndex
CREATE INDEX "SittingResult_topicId_idx" ON "SittingResult"("topicId");

-- CreateIndex
CREATE UNIQUE INDEX "SittingResult_sittingId_questionId_key" ON "SittingResult"("sittingId", "questionId");

-- AddForeignKey
ALTER TABLE "ExamQuestion" ADD CONSTRAINT "ExamQuestion_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sitting" ADD CONSTRAINT "Sitting_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SittingAnswer" ADD CONSTRAINT "SittingAnswer_sittingId_fkey" FOREIGN KEY ("sittingId") REFERENCES "Sitting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SittingResult" ADD CONSTRAINT "SittingResult_sittingId_fkey" FOREIGN KEY ("sittingId") REFERENCES "Sitting"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- HAND-WRITTEN. None of the following appears in `migrate diff` output.
-- REVIEW EVERY FUTURE GENERATED MIGRATION FOR A DROP OF ANY OBJECT BELOW.
--
-- These foreign keys are deliberately absent from schema.prisma so the new
-- models could be APPENDED without editing Field, User, Question or Topic — a
-- parallel Phase 8 session owns those blocks and two edits to the same lines
-- conflict. The constraints are still wanted; they just live here.
--
-- Prisma also cannot express a partial unique index, which is the only real
-- enforcement of "one live sitting per student per programme".
-- ---------------------------------------------------------------------------

ALTER TABLE "Exam" ADD CONSTRAINT "Exam_fieldId_fkey"
  FOREIGN KEY ("fieldId") REFERENCES "Field"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ExamQuestion" ADD CONSTRAINT "ExamQuestion_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExamQuestion" ADD CONSTRAINT "ExamQuestion_topicId_fkey"
  FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Sitting" ADD CONSTRAINT "Sitting_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Sitting" ADD CONSTRAINT "Sitting_fieldId_fkey"
  FOREIGN KEY ("fieldId") REFERENCES "Field"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SittingAnswer" ADD CONSTRAINT "SittingAnswer_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SittingResult" ADD CONSTRAINT "SittingResult_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SittingResult" ADD CONSTRAINT "SittingResult_topicId_fkey"
  FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The only enforcement of "one live sitting per student per programme".
--
-- A read-then-write check loses the race that actually happens: a double-tap on
-- Start over a slow connection gives two live sittings, two deadlines and two
-- scores against one paper. It is also the only thing stopping refresh-and-
-- restart from being an infinite timer — which defeats T-122 without the client
-- clock being touched at all, and T-122's stated test would still pass.
CREATE UNIQUE INDEX "Sitting_one_live_per_user_field"
  ON "Sitting" ("userId", "fieldId") WHERE "closedAt" IS NULL;

-- A mix must only be representable as a valid mix.
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_counts_positive"
  CHECK ("conceptCount" >= 0 AND "calculationCount" >= 0 AND "durationSec" > 0);
