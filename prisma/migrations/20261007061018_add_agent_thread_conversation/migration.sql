-- AlterTable
ALTER TABLE "AgentThread" ADD COLUMN     "conversationId" TEXT;

-- CreateIndex
CREATE INDEX "AgentThread_conversationId_idx" ON "AgentThread"("conversationId");

-- AddForeignKey
ALTER TABLE "AgentThread" ADD CONSTRAINT "AgentThread_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
