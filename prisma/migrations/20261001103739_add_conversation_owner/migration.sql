-- Conversations created before logins have no owner. Every route used to
-- default to the demo employee, so they are assigned to user-123; on a fresh
-- database the table is empty and the UPDATE does nothing.

-- AlterTable: nullable first so existing rows can be backfilled
ALTER TABLE "Conversation" ADD COLUMN     "userId" TEXT;

UPDATE "Conversation" SET "userId" = 'user-123' WHERE "userId" IS NULL;

ALTER TABLE "Conversation" ALTER COLUMN "userId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Conversation_userId_idx" ON "Conversation"("userId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
