-- Whether the student named the reason, not just the letter (T-255).
--
-- HAND-WRITTEN, for the reason recorded in 20260821120000_source_grade: the
-- generator's diff drops fourteen hand-written foreign keys.
--
-- Nullable and no default, so every existing attempt reads "never asked" —
-- which is true. Backfilling them as false would retroactively un-beat
-- questions students answered correctly under the old rule; backfilling true
-- would credit guesses. Null is the only honest reading of history.

ALTER TABLE "Attempt" ADD COLUMN "reasonCorrect" BOOLEAN;
ALTER TABLE "Attempt" ADD COLUMN "reasonChoiceId" TEXT;

-- A choice with no verdict, or a verdict with no choice, is a half-written
-- record — the pair is set together or not at all.
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_reason_pair_whole"
  CHECK (("reasonCorrect" IS NULL) = ("reasonChoiceId" IS NULL));

-- Coverage asks "which questions has this user beaten in this field", which is
-- this index exactly. Partial, because only beaten rows are ever counted and
-- the table is the largest in the product.
CREATE INDEX "Attempt_beaten_idx" ON "Attempt" ("userId", "fieldId", "questionId")
  WHERE "isCorrect" = true AND "reasonCorrect" = true;
