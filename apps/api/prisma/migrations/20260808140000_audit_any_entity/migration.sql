-- Widen the audit log beyond questions (T-167).
--
-- Every admin mutation must leave a record, and half of them are not about a
-- question. A second audit table would have been easier and wrong: "where is
-- the record" must have exactly one answer.
--
-- Hand-trimmed per CLAUDE.md — the generated diff also proposes dropping the
-- hand-written foreign keys on the exam tables.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'WEIGHTS_DERIVED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'WEIGHT_OVERRIDDEN';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'WEIGHT_OVERRIDE_CLEARED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'EXAM_BUILT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DEVICES_RESET';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ACCOUNT_DEACTIVATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ACCOUNT_REACTIVATED';

-- Added with a default so existing rows are valid, then the default is dropped:
-- every future row must say what it is about rather than inheriting a guess.
ALTER TABLE "AuditLog" ADD COLUMN "entity" TEXT NOT NULL DEFAULT 'question';
ALTER TABLE "AuditLog" ADD COLUMN "entityId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AuditLog" ADD COLUMN "reference" TEXT;

UPDATE "AuditLog" SET "entityId" = "questionId", "reference" = "stableId";

ALTER TABLE "AuditLog" ALTER COLUMN "entity" DROP DEFAULT;
ALTER TABLE "AuditLog" ALTER COLUMN "entityId" DROP DEFAULT;

-- Nullable now: a weight override has no question. The columns stay so existing
-- rows and existing queries keep resolving.
ALTER TABLE "AuditLog" ALTER COLUMN "questionId" DROP NOT NULL;
ALTER TABLE "AuditLog" ALTER COLUMN "stableId" DROP NOT NULL;

CREATE INDEX "AuditLog_entity_entityId_createdAt_idx"
  ON "AuditLog"("entity", "entityId", "createdAt");

-- An audit row that does not say what it acted on is not a record of anything.
ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_entity_present"
  CHECK (length(btrim("entity")) > 0 AND length(btrim("entityId")) > 0);
