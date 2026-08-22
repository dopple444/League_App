import { randomUUID } from 'node:crypto';

import type { AuthenticatedUser } from '@league/auth';
import { describe, expect, it } from 'vitest';

import { AccessService } from '../../src/services/access.service.js';
import { LeaguesService } from '../../src/services/leagues.service.js';
import { MutationService, type MutationContext } from '../../src/services/mutation.service.js';
import { PublicService } from '../../src/services/public.service.js';
import { SeasonsService } from '../../src/services/seasons.service.js';
import { TeamsService } from '../../src/services/teams.service.js';
import {
  databaseTestsEnabled,
  fixtureIds,
  testDatabase,
  userIdByEmail,
} from '../helpers/database.js';

function actor(id: string): AuthenticatedUser {
  return { id, email: 'admin@demo.invalid', name: 'Synthetic League Administrator' };
}

function mutationContext(
  organizationId: string,
  user: AuthenticatedUser,
  operation: string,
): MutationContext {
  const correlation = randomUUID();
  return {
    organizationId,
    user,
    idempotencyKey: `${operation}-${correlation}`,
    metadata: { requestId: `request-${correlation}`, source: 'WEB' },
  };
}

describe.skipIf(!databaseTestsEnabled)('league publication lifecycle', () => {
  it('rejects a seeded published-league slug change without mutating the league', async () => {
    const { prisma, database } = testDatabase();
    try {
      const adminId = await userIdByEmail(prisma, 'admin@demo.invalid');
      const admin = actor(adminId);
      const access = new AccessService(database);
      const leagues = new LeaguesService(database, access, new MutationService(database, access));
      const context = mutationContext(fixtureIds.organizationA, admin, 'published-slug-lock');
      const current = await database.withTenant(
        {
          organizationId: fixtureIds.organizationA,
          userId: adminId,
          requestId: `published-slug-before-${randomUUID()}`,
          source: 'API',
        },
        async (transaction) =>
          transaction.league.findUniqueOrThrow({
            where: {
              organizationId_id: {
                organizationId: fixtureIds.organizationA,
                id: fixtureIds.leagueA,
              },
            },
          }),
      );

      await expect(
        leagues.update(context, fixtureIds.leagueA, {
          expectedVersion: current.version,
          name: `${current.name} should not change`,
          slug: `published-slug-${randomUUID()}`,
          active: !current.active,
        }),
      ).rejects.toMatchObject({ code: 'PUBLISHED_LEAGUE_SLUG_LOCKED' });

      await database.withTenant(
        {
          organizationId: fixtureIds.organizationA,
          userId: adminId,
          requestId: `published-slug-after-${randomUUID()}`,
          source: 'API',
        },
        async (transaction) => {
          const [unchanged, idempotencyCount, auditCount, outboxCount] = await Promise.all([
            transaction.league.findUniqueOrThrow({
              where: {
                organizationId_id: {
                  organizationId: fixtureIds.organizationA,
                  id: fixtureIds.leagueA,
                },
              },
            }),
            transaction.idempotencyRecord.count({ where: { key: context.idempotencyKey } }),
            transaction.auditEvent.count({ where: { requestId: context.metadata.requestId } }),
            transaction.outboxEvent.count({ where: { requestId: context.metadata.requestId } }),
          ]);
          expect(unchanged).toEqual(current);
          expect({ auditCount, idempotencyCount, outboxCount }).toEqual({
            auditCount: 0,
            idempotencyCount: 0,
            outboxCount: 0,
          });
        },
      );

      await expect(
        new PublicService(database).league(
          'meade-county-demo',
          current.slug,
          `published-slug-public-${randomUUID()}`,
        ),
      ).resolves.toMatchObject({ league: { slug: current.slug } });
    } finally {
      await prisma.$disconnect();
    }
  });

  it('blocks inactive setup and publication while preserving reads, withdrawal, and later slug edits', async () => {
    const { prisma, database } = testDatabase();
    try {
      const adminId = await userIdByEmail(prisma, 'admin@demo.invalid');
      const admin = actor(adminId);
      const access = new AccessService(database);
      const mutations = new MutationService(database, access);
      const leagues = new LeaguesService(database, access, mutations);
      const seasons = new SeasonsService(database, access, mutations);
      const teams = new TeamsService(database, access, mutations);
      const publicSite = new PublicService(database);
      const unique = randomUUID();
      const originalName = `Lifecycle League ${unique}`;
      const originalSlug = `lifecycle-${unique}`;
      const blockedSeasonSlug = `blocked-${unique}`;

      const league = await leagues.create(
        mutationContext(fixtureIds.organizationA, admin, 'inactive-league-create'),
        { name: originalName, slug: originalSlug, active: false },
      );
      const blockedCreateContext = mutationContext(
        fixtureIds.organizationA,
        admin,
        'inactive-season-create',
      );
      await expect(
        seasons.create(blockedCreateContext, {
          leagueId: league.leagueId,
          name: 'Blocked inactive season',
          slug: blockedSeasonSlug,
          startDate: '2026-09-01',
          endDate: '2026-10-01',
          timezone: 'America/New_York',
        }),
      ).rejects.toMatchObject({ code: 'INACTIVE_LEAGUE' });

      const activated = await leagues.update(
        mutationContext(fixtureIds.organizationA, admin, 'lifecycle-league-activate'),
        league.leagueId,
        {
          expectedVersion: league.version,
          name: league.name,
          slug: league.slug,
          active: true,
        },
      );
      const season = await seasons.create(
        mutationContext(fixtureIds.organizationA, admin, 'lifecycle-season-create'),
        {
          leagueId: league.leagueId,
          name: `Lifecycle Season ${unique}`,
          slug: `season-${unique}`,
          startDate: '2026-09-01',
          endDate: '2026-10-01',
          timezone: 'America/New_York',
        },
      );
      const published = await seasons.publish(
        mutationContext(fixtureIds.organizationA, admin, 'lifecycle-season-publish'),
        season.seasonId,
        { expectedVersion: season.version },
      );
      const team = await teams.create(
        mutationContext(fixtureIds.organizationA, admin, 'lifecycle-team-create'),
        season.seasonId,
        {
          name: `Lifecycle Team ${unique}`,
          publicName: `Public Lifecycle Team ${unique}`,
          slug: `team-${unique}`,
        },
      );
      const teamPublication = await teams.publish(
        mutationContext(fixtureIds.organizationA, admin, 'lifecycle-team-publish'),
        season.seasonId,
        team.teamSeasonId,
        { expectedVersion: team.version },
      );

      const updatedName = `Lifecycle League Updated ${unique}`;
      const deactivated = await leagues.update(
        mutationContext(fixtureIds.organizationA, admin, 'lifecycle-league-deactivate'),
        league.leagueId,
        {
          expectedVersion: activated.version,
          name: updatedName,
          slug: originalSlug,
          active: false,
        },
      );
      expect(deactivated).toMatchObject({ active: false, name: updatedName, slug: originalSlug });
      await expect(
        publicSite.league(
          'meade-county-demo',
          originalSlug,
          `inactive-league-public-${randomUUID()}`,
        ),
      ).resolves.toMatchObject({
        league: { name: originalName, slug: originalSlug },
        currentSeason: { seasonId: season.seasonId },
      });

      const blockedPublishContext = mutationContext(
        fixtureIds.organizationA,
        admin,
        'inactive-season-publish',
      );
      await expect(
        seasons.publish(blockedPublishContext, season.seasonId, {
          expectedVersion: published.resourceVersion,
        }),
      ).rejects.toMatchObject({ code: 'INACTIVE_LEAGUE' });

      const blockedTeamName = `Blocked Inactive Team ${unique}`;
      const blockedTeamCreateContext = mutationContext(
        fixtureIds.organizationA,
        admin,
        'inactive-team-create',
      );
      await expect(
        teams.create(blockedTeamCreateContext, season.seasonId, {
          name: blockedTeamName,
          publicName: blockedTeamName,
          slug: `blocked-team-${unique}`,
        }),
      ).rejects.toMatchObject({ code: 'INACTIVE_LEAGUE' });

      const blockedTeamPublishContext = mutationContext(
        fixtureIds.organizationA,
        admin,
        'inactive-team-publish',
      );
      await expect(
        teams.publish(blockedTeamPublishContext, season.seasonId, team.teamSeasonId, {
          expectedVersion: teamPublication.resourceVersion,
        }),
      ).rejects.toMatchObject({ code: 'INACTIVE_LEAGUE' });

      await expect(
        publicSite.teams(
          'meade-county-demo',
          originalSlug,
          season.slug,
          `inactive-team-public-${randomUUID()}`,
        ),
      ).resolves.toMatchObject({
        items: [{ teamSeasonId: team.teamSeasonId, publicName: team.publicName }],
      });

      await database.withTenant(
        {
          organizationId: fixtureIds.organizationA,
          userId: adminId,
          requestId: `inactive-league-verify-${randomUUID()}`,
          source: 'API',
        },
        async (transaction) => {
          const [
            seasonState,
            teamState,
            activePublicationCount,
            activeTeamPublicationCount,
            blockedCreateCount,
            blockedPublishCount,
            blockedTeamCount,
            blockedTeamCreateCount,
            blockedTeamPublishCount,
          ] = await Promise.all([
            transaction.season.findUniqueOrThrow({
              where: {
                organizationId_id: {
                  organizationId: fixtureIds.organizationA,
                  id: season.seasonId,
                },
              },
              select: { version: true },
            }),
            transaction.teamSeason.findUniqueOrThrow({
              where: {
                organizationId_id: {
                  organizationId: fixtureIds.organizationA,
                  id: team.teamSeasonId,
                },
              },
              select: { version: true },
            }),
            transaction.publicationSnapshot.count({
              where: {
                organizationId: fixtureIds.organizationA,
                resourceKind: 'SEASON',
                resourceId: season.seasonId,
                withdrawnAt: null,
              },
            }),
            transaction.publicationSnapshot.count({
              where: {
                organizationId: fixtureIds.organizationA,
                resourceKind: 'TEAM_SEASON',
                resourceId: team.teamSeasonId,
                withdrawnAt: null,
              },
            }),
            transaction.idempotencyRecord.count({
              where: { key: blockedCreateContext.idempotencyKey },
            }),
            transaction.idempotencyRecord.count({
              where: { key: blockedPublishContext.idempotencyKey },
            }),
            transaction.team.count({ where: { name: blockedTeamName } }),
            transaction.idempotencyRecord.count({
              where: { key: blockedTeamCreateContext.idempotencyKey },
            }),
            transaction.idempotencyRecord.count({
              where: { key: blockedTeamPublishContext.idempotencyKey },
            }),
          ]);
          expect(seasonState.version).toBe(published.resourceVersion);
          expect(teamState.version).toBe(teamPublication.resourceVersion);
          expect(activePublicationCount).toBe(1);
          expect(activeTeamPublicationCount).toBe(1);
          expect(blockedCreateCount).toBe(0);
          expect(blockedPublishCount).toBe(0);
          expect(blockedTeamCount).toBe(0);
          expect(blockedTeamCreateCount).toBe(0);
          expect(blockedTeamPublishCount).toBe(0);
        },
      );

      const withdrawnTeam = await teams.withdraw(
        mutationContext(fixtureIds.organizationA, admin, 'inactive-team-withdraw'),
        season.seasonId,
        team.teamSeasonId,
        { expectedVersion: teamPublication.resourceVersion },
      );
      expect(withdrawnTeam.active).toBe(false);
      await expect(
        publicSite.teams(
          'meade-county-demo',
          originalSlug,
          season.slug,
          `withdrawn-team-public-${randomUUID()}`,
        ),
      ).resolves.toMatchObject({ items: [] });

      const withdrawn = await seasons.withdraw(
        mutationContext(fixtureIds.organizationA, admin, 'inactive-season-withdraw'),
        season.seasonId,
        { expectedVersion: published.resourceVersion },
      );
      expect(withdrawn.active).toBe(false);

      const retiredSlug = `${originalSlug}-retired`;
      const retired = await leagues.update(
        mutationContext(fixtureIds.organizationA, admin, 'withdrawn-league-slug'),
        league.leagueId,
        {
          expectedVersion: deactivated.version,
          name: deactivated.name,
          slug: retiredSlug,
          active: deactivated.active,
        },
      );
      expect(retired).toMatchObject({ active: false, name: updatedName, slug: retiredSlug });
    } finally {
      await prisma.$disconnect();
    }
  });
});
