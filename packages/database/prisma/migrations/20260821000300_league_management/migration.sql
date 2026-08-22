-- Existing leagues remain active and begin at optimistic version 1. This is
-- intentionally additive so the composite tenant keys and forced RLS policy
-- established by the foundation migration remain unchanged.
ALTER TABLE "league"
  ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
