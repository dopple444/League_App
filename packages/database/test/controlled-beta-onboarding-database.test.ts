import { createHash, randomUUID } from 'node:crypto';

import { afterAll, describe, expect, it } from 'vitest';

import { createPrismaClient, TenantDatabase } from '../src/index.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const databaseTestsEnabled = databaseUrl !== undefined && databaseUrl.length > 0;
const organizationA = '00000000-0000-4000-8000-000000000001';
const organizationB = '00000000-0000-4000-8000-000000000002';
const leagueA = '00000000-0000-4000-8000-000000000101';
const administratorRoleA = '00000000-0000-4000-8000-000000000701';

const prisma = databaseTestsEnabled ? createPrismaClient(databaseUrl) : null;

afterAll(async () => {
  await prisma?.$disconnect();
});

describe.skipIf(!databaseTestsEnabled)('controlled-beta onboarding database boundaries', () => {
  it('separates platform access, pending discovery, invitation resolution, and tenant RLS', async () => {
    if (prisma === null) throw new Error('Test database was not initialized.');
    const database = new TenantDatabase(prisma);
    const suffix = randomUUID();
    const pendingUser = await prisma.user.create({
      data: {
        name: 'Synthetic Pending Database User',
        email: `pending-${suffix}@example.invalid`,
        emailVerified: true,
      },
    });
    const operator = await prisma.user.findUniqueOrThrow({
      where: { email: 'operator@demo.invalid' },
    });
    const unprivileged = await prisma.user.findUniqueOrThrow({
      where: { email: 'board@demo.invalid' },
    });
    const invitationId = randomUUID();
    const tokenDigest = createHash('sha256').update(`synthetic-${suffix}`).digest('hex');

    try {
      const membership = await database.withTenant(
        {
          organizationId: organizationA,
          userId: pendingUser.id,
          requestId: `pending-create-${suffix}`,
          source: 'API',
        },
        async (transaction) =>
          transaction.organizationMembership.create({
            data: { organizationId: organizationA, userId: pendingUser.id },
          }),
      );
      expect(membership).toMatchObject({ status: 'PENDING', version: 1, activatedAt: null });
      await expect(database.listOrganizationIdsForUser(pendingUser.id)).resolves.toEqual([]);
      await expect(database.listPendingMembershipOrganizationIds(pendingUser.id)).resolves.toEqual([
        organizationA,
      ]);

      await database.withTenant(
        {
          organizationId: organizationA,
          userId: operator.id,
          requestId: `invitation-create-${suffix}`,
          source: 'API',
        },
        async (transaction) =>
          transaction.administratorInvitation.create({
            data: {
              id: invitationId,
              organizationId: organizationA,
              leagueId: leagueA,
              roleId: administratorRoleA,
              emailNormalized: `invite-${suffix}@example.invalid`,
              tokenDigest,
              expiresAt: new Date(Date.now() + 60 * 60 * 1000),
              createdByUserId: operator.id,
            },
          }),
      );

      await expect(prisma.administratorInvitation.findMany()).rejects.toThrow();
      await expect(
        database.withTenant(
          {
            organizationId: organizationB,
            userId: operator.id,
            requestId: `wrong-tenant-${suffix}`,
            source: 'API',
          },
          async (transaction) =>
            transaction.administratorInvitation.findUnique({ where: { tokenDigest } }),
        ),
      ).resolves.toBeNull();
      await expect(database.resolveAdministratorInvitationOrganization(tokenDigest)).resolves.toBe(
        organizationA,
      );
      await expect(
        database.resolvePlatformInvitationOrganization(operator.id, invitationId),
      ).resolves.toBe(organizationA);
      await expect(
        database.resolvePlatformInvitationOrganization(unprivileged.id, invitationId),
      ).rejects.toThrow();

      await expect(database.hasPlatformPermission(operator.id, 'TENANT_PROVISION')).resolves.toBe(
        true,
      );
      await expect(
        database.hasPlatformPermission(unprivileged.id, 'TENANT_PROVISION'),
      ).resolves.toBe(false);
      const platformRows = await database.listPlatformOnboarding(operator.id);
      expect(platformRows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            organizationId: organizationA,
            invitationId,
            administratorEmail: `invite-${suffix}@example.invalid`,
          }),
        ]),
      );
      expect(
        Object.keys(platformRows.find((row) => row.invitationId === invitationId) ?? {}),
      ).not.toContain('tokenDigest');
      await expect(database.listPlatformOnboarding(unprivileged.id)).rejects.toThrow();

      await database.withTenant(
        {
          organizationId: organizationA,
          userId: operator.id,
          requestId: `invitation-revoke-${suffix}`,
          source: 'API',
        },
        async (transaction) =>
          transaction.administratorInvitation.update({
            where: { organizationId_id: { organizationId: organizationA, id: invitationId } },
            data: {
              revokedAt: new Date(),
              revokedByUserId: operator.id,
              revocationReason: 'Synthetic database boundary verification.',
              version: { increment: 1 },
            },
          }),
      );
      await expect(database.resolveAdministratorInvitationOrganization(tokenDigest)).resolves.toBe(
        organizationA,
      );
    } finally {
      await database.withTenant(
        {
          organizationId: organizationA,
          userId: operator.id,
          requestId: `onboarding-cleanup-${suffix}`,
          source: 'API',
        },
        async (transaction) => {
          await transaction.administratorInvitation.deleteMany({ where: { id: invitationId } });
          await transaction.organizationMembership.deleteMany({
            where: { userId: pendingUser.id },
          });
        },
      );
      await prisma.user.delete({ where: { id: pendingUser.id } });
    }
  });
});
