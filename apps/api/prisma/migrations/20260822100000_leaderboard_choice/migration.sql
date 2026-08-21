-- "Never chose" is a third state, and juniors need it (T-257).
--
-- HAND-WRITTEN: see 20260821120000_source_grade. The generator's diff drops
-- fourteen hand-written foreign keys.
--
-- The column becomes nullable and the default is dropped. Existing rows keep
-- their explicit false, which is correct — every account that exists today is
-- on an exit-exam track and therefore senior, where false and null behave the
-- same way. Nulling them would be a change with no reason behind it.

ALTER TABLE "User" ALTER COLUMN "leaderboardOptOut" DROP NOT NULL;
ALTER TABLE "User" ALTER COLUMN "leaderboardOptOut" DROP DEFAULT;
