import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const migrationUrl = new URL(
  '../prisma/migrations/20260822000100_privileged_mfa/migration.sql',
  import.meta.url,
);

describe('privileged MFA migration', () => {
  it('adds Better Auth factor state without weakening tenant isolation', async () => {
    const migration = await readFile(migrationUrl, 'utf8');

    expect(migration).toContain('ADD COLUMN "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false');
    expect(migration).toContain('CREATE TABLE "auth_two_factor"');
    expect(migration).toContain('FOREIGN KEY ("user_id") REFERENCES "auth_user"("id")');
    expect(migration).toContain('GRANT SELECT, INSERT, UPDATE, DELETE');
    expect(migration).not.toMatch(/DISABLE\s+ROW\s+LEVEL\s+SECURITY/iu);
    expect(migration).not.toMatch(/ALTER\s+TABLE\s+"?(organization|organization_membership)"?/iu);
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN|CONSTRAINT|POLICY)/iu);
  });
});
