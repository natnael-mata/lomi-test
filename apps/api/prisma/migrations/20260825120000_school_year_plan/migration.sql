-- One annual price for Grade 12 and below (T-268).
--
-- The exit-exam ladder — six months at Br 500, twelve at Br 800, with the
-- per-month saving spelled out — is a decision for somebody choosing how long to
-- study before a national exam they are sitting themselves. A school-track
-- subscription is usually bought by a parent, once, for a child, and offering
-- them a duration trade-off is asking a question they have no basis to answer.
--
-- So: one plan, one year, Br 300. Not a discount on the exit-exam price, a
-- different product for a different buyer.
--
-- Hand-written. `prisma migrate diff` proposes dropping fourteen foreign keys
-- and several indexes that this schema declares by hand.

ALTER TYPE "PlanCode" ADD VALUE IF NOT EXISTS 'SCHOOL_YEAR';

-- The plan itself. `ON CONFLICT DO NOTHING` so re-running is safe and so a
-- price changed by hand on a live box is not silently reset by a redeploy.
INSERT INTO "Plan" ("id", "code", "months", "priceEtb", "isActive", "createdAt", "updatedAt")
VALUES ('plan_school_year', 'SCHOOL_YEAR', 12, 300, true, NOW(), NOW())
ON CONFLICT ("code") DO NOTHING;
