-- Removes the seeded test accounts (telegramId in the reserved tester range).
-- telegramId is text; the CASE casts only a ten digit negative number, so a
-- real (positive) Telegram id is never even parsed.
-- They share a password that is in the repository, so on a live server they
-- are a way in as any of them, the ADMIN and PROVIDER testers included.
--
-- Every table with a foreign key to "User" cascades, so one delete per user
-- takes their attempts, sittings, payments, subscriptions, points, sessions,
-- bot profile, posts, threads and reports with it. "StaffMember"."userId" has
-- no foreign key, so staff grants are deleted explicitly first. Columns that
-- only record history (AuditLog.actorId, Payment.settledBy, Question.authorId,
-- Question.reviewerId) are left as they are.
\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE testers ON COMMIT DROP AS
  SELECT id, "displayName", phone, "createdAt"
  FROM "User"
  WHERE (CASE WHEN "telegramId" ~ '^-[0-9]{10}$' THEN "telegramId"::bigint END) BETWEEN -2000000000 AND -1000000000;

\echo '--- tester accounts found'
SELECT count(*) AS testers FROM testers;
SELECT t."displayName", t.phone, to_char(t."createdAt", 'YYYY-MM-DD') AS created, s.role AS staff_role
  FROM testers t LEFT JOIN "StaffMember" s ON s."userId" = t.id ORDER BY 1;

\echo '--- history rows that name a tester and are kept'
SELECT
  (SELECT count(*) FROM "AuditLog" WHERE "actorId" IN (SELECT id FROM testers)) AS audit_rows,
  (SELECT count(*) FROM "Payment" WHERE "settledBy" IN (SELECT id FROM testers)
      AND "userId" NOT IN (SELECT id FROM testers)) AS real_payments_settled_by_a_tester,
  (SELECT count(*) FROM "Question" WHERE "authorId" IN (SELECT id FROM testers)
      OR "reviewerId" IN (SELECT id FROM testers)) AS questions_touched;

DELETE FROM "StaffMember" WHERE "userId" IN (SELECT id FROM testers);
DELETE FROM "User" WHERE id IN (SELECT id FROM testers);

\echo '--- left in the tester range after the delete (must be 0)'
SELECT count(*) AS remaining FROM "User" WHERE (CASE WHEN "telegramId" ~ '^-[0-9]{10}$' THEN "telegramId"::bigint END) BETWEEN -2000000000 AND -1000000000;
