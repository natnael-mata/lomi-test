-- The school year a question came from, and the year span its track draws on.
--
-- HAND-WRITTEN, not the generator's output. `prisma migrate diff` proposes
-- dropping fourteen foreign keys and several indexes that were written by hand
-- and are not expressible in the Prisma schema; applying its script would take
-- the referential integrity of half the database with it. Only the three
-- additions below are wanted.
--
-- All three are nullable and carry no default, so this is safe on a filled
-- bank: every existing row reads null, which is exactly right for the
-- university exit exam and honestly "unknown" for anything else until the
-- spreadsheet that supplies it is re-imported.

ALTER TABLE "Field" ADD COLUMN "minGrade" INTEGER;
ALTER TABLE "Field" ADD COLUMN "maxGrade" INTEGER;

-- A span is both ends or neither: a track with a floor and no ceiling cannot be
-- validated against, and the importer would silently accept anything above it.
ALTER TABLE "Field" ADD CONSTRAINT "Field_grade_span_whole"
  CHECK (("minGrade" IS NULL) = ("maxGrade" IS NULL));

-- Ordered, so a transposed pair fails at the write rather than rejecting every
-- question in the track.
ALTER TABLE "Field" ADD CONSTRAINT "Field_grade_span_ordered"
  CHECK ("minGrade" IS NULL OR "minGrade" <= "maxGrade");

ALTER TABLE "Question" ADD COLUMN "sourceGrade" INTEGER;

-- Ethiopian schooling runs 1–12. Anything outside it is a typo or a mis-mapped
-- column, and the importer's own check is the friendly version of this one.
ALTER TABLE "Question" ADD CONSTRAINT "Question_sourceGrade_plausible"
  CHECK ("sourceGrade" IS NULL OR ("sourceGrade" BETWEEN 1 AND 12));

-- The diagnostic groups by it inside a field, which is the only way it is read.
CREATE INDEX "Question_fieldId_sourceGrade_idx" ON "Question" ("fieldId", "sourceGrade");
