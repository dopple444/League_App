import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const migrationUrl = new URL(
  '../prisma/migrations/20260821000300_league_management/migration.sql',
  import.meta.url,
);
const seedUrl = new URL('../prisma/seed.ts', import.meta.url);

describe('league management migration', () => {
  it('backfills active and optimistic-version values for existing leagues', async () => {
    const migration = await readFile(migrationUrl, 'utf8');

    expect(migration).toContain('ALTER TABLE "league"');
    expect(migration).toContain('ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true');
    expect(migration).toContain('ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1');
  });

  it('leaves tenant RLS and composite league constraints intact', async () => {
    const migration = await readFile(migrationUrl, 'utf8');

    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN|CONSTRAINT|POLICY)/i);
    expect(migration).not.toMatch(/DISABLE\s+ROW\s+LEVEL\s+SECURITY/i);
    expect(migration).not.toMatch(/ALTER\s+COLUMN\s+"?(organization_id|id)"?/i);
  });
});

describe('league management seed baseline', () => {
  it('grants league administration and restores both demo leagues to active', async () => {
    const seed = await readFile(seedUrl, 'utf8');

    expect(seed).toContain("'league:read'");
    expect(seed).toContain("'league:create'");
    expect(seed).toContain("'league:update'");
    expect(seed).toMatch(/slug: 'church-softball',[\s\S]*?active: true/);
    expect(seed).toMatch(/slug: 'softball',[\s\S]*?active: true/);
  });
});
