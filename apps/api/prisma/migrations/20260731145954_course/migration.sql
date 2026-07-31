-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Course_fieldId_idx" ON "Course"("fieldId");

-- CreateIndex
CREATE UNIQUE INDEX "Course_fieldId_slug_key" ON "Course"("fieldId", "slug");

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "Field"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

