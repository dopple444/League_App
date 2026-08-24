-- PostgreSQL requires a newly added enum value to commit before a later
-- transaction can use it in a column default or constraint. Keep this small,
-- additive prerequisite separate from the onboarding schema migration.
ALTER TYPE "MembershipStatus" ADD VALUE IF NOT EXISTS 'PENDING' BEFORE 'ACTIVE';
