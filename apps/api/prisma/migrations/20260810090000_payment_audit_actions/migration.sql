-- An operator settling a claimed payment by hand is auditable (T-152).
--
-- Both outcomes, not just the grant. A refusal is the one a student is more
-- likely to dispute, and "we looked and the money was not there" is worthless as
-- a defence if nobody wrote down who looked.
--
-- Hand-trimmed from `prisma migrate diff`, which also proposed dropping eight
-- hand-written foreign keys and `User_deactivatedAt_idx`. Those exist because
-- the models use scalar ids rather than Prisma relations, so Prisma cannot see
-- them and offers to remove them on every diff. They stay.

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'PAYMENT_CONFIRMED';
ALTER TYPE "AuditAction" ADD VALUE 'PAYMENT_REJECTED';
