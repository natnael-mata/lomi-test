-- Keep weightPct inside 0..100.
--
-- Hand-written: Prisma's schema language has no CHECK constraint, so this
-- cannot be expressed in schema.prisma and will not appear in `migrate diff`
-- output. Review future generated migrations for a DROP of this constraint.
--
-- NULL is allowed on purpose: a topic has no weight until T-134 derives it,
-- and T-046 refuses to publish a question whose topic is still unweighted.
ALTER TABLE "Topic"
  ADD CONSTRAINT "Topic_weightPct_range"
  CHECK ("weightPct" IS NULL OR ("weightPct" >= 0 AND "weightPct" <= 100));
