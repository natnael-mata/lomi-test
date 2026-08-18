-- The provider role: the people who run this copy of the product.
--
-- Above ADMIN in `satisfies()`, and the only role that can read the activity
-- log or the health board. An operator acts; a provider answers "who did that,
-- and when" — including about the operators.
--
-- Hand-trimmed from `prisma migrate diff`, which also proposed dropping eight
-- hand-written foreign keys and `User_deactivatedAt_idx`. Those exist because
-- the models use scalar ids rather than Prisma relations, so Prisma cannot see
-- them and offers to remove them on every diff. They stay.
--
-- Adding a value to an enum is additive and reversible by nothing: Postgres has
-- no DROP VALUE. That is the right shape for a role — a grant that cannot be
-- un-typed is one that cannot be silently removed from under the rows holding
-- it.

-- AlterEnum
ALTER TYPE "StaffRole" ADD VALUE 'PROVIDER';
