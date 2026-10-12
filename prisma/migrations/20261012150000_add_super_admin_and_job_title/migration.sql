-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'super_admin';

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "jobTitle" TEXT;
