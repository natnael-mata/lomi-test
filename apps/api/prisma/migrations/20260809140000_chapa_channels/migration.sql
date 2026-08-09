-- Chapa's direct-charge channels, and the provider's own reference (T-142).
--
-- Hand-trimmed from `prisma migrate diff`, which also proposed dropping eight
-- hand-written foreign keys and `User_deactivatedAt_idx`. Those exist because
-- the models use scalar ids rather than Prisma relations, so Prisma cannot see
-- them and offers to remove them on every diff. They stay.

-- AlterEnum
-- Two values in one migration is fine from PostgreSQL 12; neither is read back
-- in this transaction.
ALTER TYPE "PaymentMethod" ADD VALUE 'TELEBIRR';
ALTER TYPE "PaymentMethod" ADD VALUE 'CBEBIRR';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "providerRef" TEXT;
