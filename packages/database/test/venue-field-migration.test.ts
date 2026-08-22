import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const migrationUrl = new URL(
  '../prisma/migrations/20260821000200_venue_field_management/migration.sql',
  import.meta.url,
);

describe('venue and field migration', () => {
  it('is additive and preserves valid fence-distance and duplicate-name invariants', async () => {
    const migration = await readFile(migrationUrl, 'utf8');

    expect(migration).toContain('ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true');
    expect(migration).toContain('ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1');
    expect(migration).toContain('ADD COLUMN "has_lights" BOOLEAN NOT NULL DEFAULT false');
    expect(migration).toContain('"fence_distance_feet" BETWEEN 100 AND 600');
    expect(migration).toContain('"venue_organization_id_name_key"');
    expect(migration).toContain('Cannot enforce venue name uniqueness');
    expect(migration.indexOf('Cannot enforce venue name uniqueness')).toBeLessThan(
      migration.indexOf('ALTER TABLE "venue"'),
    );
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
  });
});
