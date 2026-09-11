-- Somebody can set a programme's exam date, and it is recorded (T-269).
--
-- `Field.examDate` has existed since the schema was written and nothing could
-- write it. `daysUntil` computes from it, `planFor` turns it into "answer this
-- many a day", and the landing page sells that as step three of four — so with
-- no way to set the date, the headline promise resolved to "No exam date is set
-- yet, so there is no daily target to work out", forever, for every programme.
--
-- The column needs no migration. The audit action does: one date governs every
-- student in the field, so setting it is exactly the kind of change somebody
-- may later have to answer for.
--
-- Hand-written. `prisma migrate diff` proposes dropping fourteen foreign keys
-- and several indexes that this schema declares by hand.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'EXAM_DATE_SET';
