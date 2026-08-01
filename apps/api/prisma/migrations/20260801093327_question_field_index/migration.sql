-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "fieldId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Question_fieldId_status_idx" ON "Question"("fieldId", "status");

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "Field"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

