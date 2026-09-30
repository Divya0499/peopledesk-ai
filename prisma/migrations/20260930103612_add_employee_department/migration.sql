-- AlterTable
-- Existing rows (the demo employee) are backfilled as "Engineering"; the
-- default is then dropped so new rows must set a department explicitly.
ALTER TABLE "Employee" ADD COLUMN     "department" TEXT NOT NULL DEFAULT 'Engineering';
ALTER TABLE "Employee" ALTER COLUMN "department" DROP DEFAULT;
