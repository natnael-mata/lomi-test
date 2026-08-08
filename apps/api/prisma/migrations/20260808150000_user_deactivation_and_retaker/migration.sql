-- Account deactivation (T-164) and the retaker flag (T-166, D8).
--
-- Hand-trimmed per CLAUDE.md — the generated diff also proposes dropping the
-- hand-written foreign keys on the exam tables.

ALTER TABLE "User" ADD COLUMN "deactivatedAt" TIMESTAMP(3);

-- Nullable, and it means "nobody asked". Not the same as false: treating an
-- unasked student as a first-time sitter is a quiet assumption that surfaces
-- later as a wrong number in a report.
ALTER TABLE "User" ADD COLUMN "isRetaker" BOOLEAN;

-- Finding the deactivated accounts is an operator query, not a student one.
CREATE INDEX "User_deactivatedAt_idx" ON "User"("deactivatedAt");
