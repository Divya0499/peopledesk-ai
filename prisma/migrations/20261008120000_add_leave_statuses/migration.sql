-- On its own: PostgreSQL can't use a new enum value in the same transaction
-- that adds it, and the next migration makes 'pending' the default.
ALTER TYPE "LeaveStatus" ADD VALUE 'pending';
ALTER TYPE "LeaveStatus" ADD VALUE 'cancelled';
