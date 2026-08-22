-- Fail before changing the schema when legacy data cannot satisfy the new venue-name invariant.
DO $duplicate_venue_names$
DECLARE
  duplicate_group_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER
  INTO duplicate_group_count
  FROM (
    SELECT 1
    FROM "venue"
    GROUP BY "organization_id", "name"
    HAVING COUNT(*) > 1
  ) AS duplicate_groups;

  IF duplicate_group_count > 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = format(
        'Cannot enforce venue name uniqueness: found %s duplicate organization/name group(s).',
        duplicate_group_count
      ),
      HINT = 'Rename duplicate venues within each organization before rerunning this migration.';
  END IF;
END
$duplicate_venue_names$;

-- Preserve stable facility identifiers while adding lifecycle and scheduling metadata.
ALTER TABLE "venue"
  ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "field"
  ADD COLUMN "has_lights" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "fence_distance_feet" INTEGER,
  ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "venue_organization_id_name_key"
  ON "venue"("organization_id", "name");

ALTER TABLE "field"
  ADD CONSTRAINT "field_fence_distance_feet_check"
  CHECK (
    "fence_distance_feet" IS NULL
    OR "fence_distance_feet" BETWEEN 100 AND 600
  );
