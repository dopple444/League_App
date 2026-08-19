import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  databaseTestsEnabled,
  fixtureIds,
  testDatabase,
  userIdByEmail,
} from '../helpers/database.js';

describe.skipIf(!databaseTestsEnabled)('PostgreSQL tenant isolation', () => {
  it('denies missing context and filters wrong-tenant identifiers', async () => {
    const { prisma, database } = testDatabase();
    try {
      await expect(prisma.season.findMany()).rejects.toThrow();
      const adminId = await userIdByEmail(prisma, 'admin@demo.invalid');
      await expect(
        database.withTenant(
          {
            organizationId: fixtureIds.organizationA,
            userId: adminId,
            requestId: 'tenancy-read',
            source: 'API',
          },
          async (transaction) =>
            transaction.season.findUnique({
              where: {
                organizationId_id: {
                  organizationId: fixtureIds.organizationA,
                  id: fixtureIds.seasonB,
                },
              },
            }),
        ),
      ).resolves.toBeNull();
    } finally {
      await prisma.$disconnect();
    }
  });

  it('derives pre-tenant membership from user context and resolves only published tenants', async () => {
    const { prisma, database } = testDatabase();
    try {
      const multiId = await userIdByEmail(prisma, 'multi-admin@demo.invalid');
      await expect(database.listOrganizationIdsForUser(multiId)).resolves.toEqual(
        expect.arrayContaining([fixtureIds.organizationA, fixtureIds.organizationB]),
      );
      await expect(
        database.resolvePublicOrganization('meade-county-demo', 'church-softball'),
      ).resolves.toBe(fixtureIds.organizationA);
      await expect(
        database.resolvePublicOrganization('neighbor-league-demo', 'softball'),
      ).resolves.toBeNull();
    } finally {
      await prisma.$disconnect();
    }
  });

  it('rejects cross-season games through composite foreign keys', async () => {
    const { prisma, database } = testDatabase();
    try {
      const adminId = await userIdByEmail(prisma, 'admin@demo.invalid');
      await expect(
        database.withTenant(
          {
            organizationId: fixtureIds.organizationA,
            userId: adminId,
            requestId: 'cross-season-game',
            source: 'API',
          },
          async (transaction) => {
            const season = await transaction.season.create({
              data: {
                organizationId: fixtureIds.organizationA,
                leagueId: fixtureIds.leagueA,
                slug: `isolation-${randomUUID()}`,
                name: 'Isolation Fixture',
                startDate: new Date('2026-08-01T00:00:00.000Z'),
                endDate: new Date('2026-09-01T00:00:00.000Z'),
                timezone: 'America/New_York',
              },
            });
            await transaction.game.create({
              data: {
                organizationId: fixtureIds.organizationA,
                seasonId: season.id,
                scheduleVersionId: '00000000-0000-4000-8000-000000000601',
                homeTeamSeasonId: '00000000-0000-4000-8000-000000000401',
                awayTeamSeasonId: '00000000-0000-4000-8000-000000000402',
                fieldId: '00000000-0000-4000-8000-000000000502',
                startsAt: new Date('2026-08-10T22:00:00.000Z'),
              },
            });
          },
        ),
      ).rejects.toThrow();
    } finally {
      await prisma.$disconnect();
    }
  });

  it('enforces append-only configuration and publication payloads', async () => {
    const { prisma, database } = testDatabase();
    try {
      const adminId = await userIdByEmail(prisma, 'admin@demo.invalid');
      await expect(
        database.withTenant(
          {
            organizationId: fixtureIds.organizationA,
            userId: adminId,
            requestId: 'immutable-config',
            source: 'API',
          },
          async (transaction) =>
            transaction.seasonConfigurationRevision.updateMany({
              where: { seasonId: fixtureIds.seasonA },
              data: { configuration: { changed: true } },
            }),
        ),
      ).rejects.toThrow();
      await expect(
        database.withTenant(
          {
            organizationId: fixtureIds.organizationA,
            userId: adminId,
            requestId: 'immutable-publication',
            source: 'API',
          },
          async (transaction) =>
            transaction.publicationSnapshot.updateMany({
              where: { resourceKind: 'TEAM_SEASON', resourceId: fixtureIds.teamSeasonA },
              data: { payload: { unsafe: true } },
            }),
        ),
      ).rejects.toThrow();
    } finally {
      await prisma.$disconnect();
    }
  });
});
