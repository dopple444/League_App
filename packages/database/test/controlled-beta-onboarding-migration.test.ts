import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const migrationUrl = new URL(
  '../prisma/migrations/20260824000100_controlled_beta_onboarding/migration.sql',
  import.meta.url,
);
const pendingStateMigrationUrl = new URL(
  '../prisma/migrations/20260823000100_pending_membership_state/migration.sql',
  import.meta.url,
);
const restrictedGrantReadsMigrationUrl = new URL(
  '../prisma/migrations/20260824000200_restrict_platform_grant_reads/migration.sql',
  import.meta.url,
);
const platformActorRlsMigrationUrl = new URL(
  '../prisma/migrations/20260824000300_platform_actor_rls/migration.sql',
  import.meta.url,
);
const schemaUrl = new URL('../prisma/schema.prisma', import.meta.url);
const seedUrl = new URL('../prisma/seed.ts', import.meta.url);

describe('controlled-beta onboarding migration', () => {
  it('makes new memberships fail closed without changing existing membership rows', async () => {
    const [migration, pendingStateMigration, schema, seed] = await Promise.all([
      readFile(migrationUrl, 'utf8'),
      readFile(pendingStateMigrationUrl, 'utf8'),
      readFile(schemaUrl, 'utf8'),
      readFile(seedUrl, 'utf8'),
    ]);

    expect(pendingStateMigration).toContain(
      `ALTER TYPE "MembershipStatus" ADD VALUE IF NOT EXISTS 'PENDING' BEFORE 'ACTIVE'`,
    );
    expect(migration).toContain(`ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
    expect(schema).toMatch(/status\s+MembershipStatus\s+@default\(PENDING\)/u);
    expect(seed.match(/status: 'ACTIVE'/gu)).toHaveLength(4);
    expect(migration).not.toMatch(/UPDATE\s+"organization_membership"/iu);
  });

  it('adds separate platform authority, safe idempotency, and append-only audit history', async () => {
    const [migration, restrictedGrantReadsMigration, platformActorRlsMigration] = await Promise.all(
      [
        readFile(migrationUrl, 'utf8'),
        readFile(restrictedGrantReadsMigrationUrl, 'utf8'),
        readFile(platformActorRlsMigrationUrl, 'utf8'),
      ],
    );

    expect(migration).toContain(`CREATE TYPE "PlatformPermission"`);
    expect(migration).toContain(`'TENANT_PROVISION', 'INVITATION_REVOKE'`);
    expect(migration).toContain(`CREATE TABLE "platform_permission_grant"`);
    expect(migration).toContain(`CREATE TABLE "platform_idempotency_record"`);
    expect(migration).toContain(`CREATE TABLE "platform_audit_event"`);
    expect(migration).toContain('CREATE TRIGGER platform_audit_event_append_only');
    expect(migration).toContain('app.has_platform_permission');
    expect(migration).toContain('effective platform permission is required');
    expect(migration).not.toMatch(
      /GRANT\s+(?:INSERT|UPDATE|DELETE)[^;]*"platform_permission_grant"\s+TO\s+league_runtime/iu,
    );
    expect(restrictedGrantReadsMigration).toContain(
      'REVOKE SELECT ON "platform_permission_grant" FROM league_runtime',
    );
    expect(platformActorRlsMigration).toContain(
      'ALTER TABLE "platform_idempotency_record" FORCE ROW LEVEL SECURITY',
    );
    expect(platformActorRlsMigration).toContain(
      'ALTER TABLE "platform_audit_event" FORCE ROW LEVEL SECURITY',
    );
    expect(
      platformActorRlsMigration.match(/CREATE POLICY platform_actor_isolation/gu),
    ).toHaveLength(2);
  });

  it('stores only invitation digests behind forced tenant RLS and narrow resolver functions', async () => {
    const migration = await readFile(migrationUrl, 'utf8');

    expect(migration).toContain(`CREATE TABLE "administrator_invitation"`);
    expect(migration).toContain(`CHECK ("token_digest" ~ '^[0-9a-f]{64}$')`);
    expect(migration).toContain('ALTER TABLE "administrator_invitation" ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('ALTER TABLE "administrator_invitation" FORCE ROW LEVEL SECURITY');
    expect(migration).toContain('app.resolve_administrator_invitation_organization');
    expect(migration).toContain('app.resolve_platform_invitation_organization');
    expect(migration).toContain('app.list_pending_membership_organizations');
    expect(migration).toContain('app.list_platform_onboarding');
    expect(migration).not.toMatch(/"(raw_)?token"\s+(?:TEXT|VARCHAR|BYTEA)/iu);

    const listFunction = migration.match(
      /CREATE OR REPLACE FUNCTION app\.list_platform_onboarding\(\)[\s\S]*?ALTER FUNCTION app\.has_platform_permission/u,
    )?.[0];
    expect(listFunction).toBeDefined();
    expect(listFunction).not.toContain('token_digest');
  });

  it('is forward-only and retains invitation and audit history', async () => {
    const migration = await readFile(migrationUrl, 'utf8');

    expect(migration).not.toMatch(/DISABLE\s+ROW\s+LEVEL\s+SECURITY/iu);
    expect(migration).not.toMatch(/DROP\s+(?:TABLE|COLUMN|TYPE|CONSTRAINT|POLICY)/iu);
    expect(migration).not.toMatch(/TRUNCATE\s+/iu);
  });
});
