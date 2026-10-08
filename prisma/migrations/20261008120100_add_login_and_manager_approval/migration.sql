-- AlterTable: email nullable first so existing employees can be backfilled.
-- They get a placeholder address and no password, so they can't log in
-- until an admin (or the seed) sets real credentials.
ALTER TABLE "Employee" ADD COLUMN     "email" TEXT,
ADD COLUMN     "managerId" TEXT,
ADD COLUMN     "passwordHash" TEXT;

UPDATE "Employee" SET "email" = lower("id") || '@peopledesk.local' WHERE "email" IS NULL;

ALTER TABLE "Employee" ALTER COLUMN "email" SET NOT NULL;

-- AlterTable
ALTER TABLE "LeaveApplication" ADD COLUMN     "decidedAt" TIMESTAMP(3),
ADD COLUMN     "decidedById" TEXT,
ADD COLUMN     "decisionNote" TEXT,
ADD COLUMN     "reason" TEXT,
ALTER COLUMN "status" SET DEFAULT 'pending';

-- CreateIndex
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");

-- CreateIndex
CREATE INDEX "Employee_managerId_idx" ON "Employee"("managerId");

-- CreateIndex
CREATE INDEX "LeaveApplication_status_idx" ON "LeaveApplication"("status");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveApplication" ADD CONSTRAINT "LeaveApplication_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
