-- CreateTable
CREATE TABLE "Step" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "stepNo" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "formula" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Step_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Step_questionId_idx" ON "Step"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "Step_questionId_stepNo_key" ON "Step"("questionId", "stepNo");

-- AddForeignKey
ALTER TABLE "Step" ADD CONSTRAINT "Step_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

