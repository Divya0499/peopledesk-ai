-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('employee', 'admin');

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'employee';
