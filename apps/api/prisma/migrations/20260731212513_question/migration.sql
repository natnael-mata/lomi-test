-- CreateEnum
CREATE TYPE "QType" AS ENUM ('CONCEPT', 'CALCULATION');

-- CreateEnum
CREATE TYPE "QStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'RETIRED');

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "qType" "QType" NOT NULL,
    "stem" TEXT NOT NULL,
    "conceptLine" TEXT,
    "explanation" TEXT,
    "timeLimitSec" INTEGER NOT NULL,
    "status" "QStatus" NOT NULL DEFAULT 'DRAFT',
    "authorId" TEXT,
    "reviewerId" TEXT,
    "sourceRef" TEXT,
    "year" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Question_topicId_idx" ON "Question"("topicId");

-- CreateIndex
CREATE INDEX "Question_status_idx" ON "Question"("status");

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

