-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "stableId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Question_stableId_key" ON "Question"("stableId");

