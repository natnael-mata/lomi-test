-- CreateEnum
CREATE TYPE "ImportFlag" AS ENUM ('RAW', 'NEEDS_ANSWER', 'NEEDS_EXPLANATION', 'NEEDS_TOPIC_REVIEW', 'READY');

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "importFlags" "ImportFlag"[];

