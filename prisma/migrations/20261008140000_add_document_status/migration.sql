-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('processing', 'ready', 'rejected', 'failed');

-- AlterTable: documents uploaded before this were indexed during the upload
-- request, so they're already ready. The defaults only fill existing rows;
-- new ones start as processing and get updatedAt from Prisma.
ALTER TABLE "Document" ADD COLUMN     "error" TEXT,
ADD COLUMN     "status" "DocumentStatus" NOT NULL DEFAULT 'ready',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "uploadedById" TEXT,
ALTER COLUMN "chunkCount" SET DEFAULT 0;

ALTER TABLE "Document" ALTER COLUMN "status" SET DEFAULT 'processing',
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Document_fileName_idx" ON "Document"("fileName");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
