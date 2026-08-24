import { createLeagueAuth } from '@league/auth';

import { createPrismaClient, TenantDatabase, type Prisma } from '../src/index.js';

const ids = {
  organizationA: '00000000-0000-4000-8000-000000000001',
  organizationB: '00000000-0000-4000-8000-000000000002',
  leagueA: '00000000-0000-4000-8000-000000000101',
  leagueB: '00000000-0000-4000-8000-000000000102',
  seasonA: '00000000-0000-4000-8000-000000000201',
  seasonB: '00000000-0000-4000-8000-000000000202',
  homeTeam: '00000000-0000-4000-8000-000000000301',
  awayTeam: '00000000-0000-4000-8000-000000000302',
  homeTeamSeason: '00000000-0000-4000-8000-000000000401',
  awayTeamSeason: '00000000-0000-4000-8000-000000000402',
  venue: '00000000-0000-4000-8000-000000000501',
  field: '00000000-0000-4000-8000-000000000502',
  schedule: '00000000-0000-4000-8000-000000000601',
  game: '00000000-0000-4000-8000-000000000602',
  officerRoleA: '00000000-0000-4000-8000-000000000701',
  boardRoleA: '00000000-0000-4000-8000-000000000702',
  auditorRoleA: '00000000-0000-4000-8000-000000000703',
  officerRoleB: '00000000-0000-4000-8000-000000000704',
  operatorProvisionGrant: '00000000-0000-4000-8000-000000000901',
  operatorRevokeGrant: '00000000-0000-4000-8000-000000000902',
} as const;

const allOperationalPermissions = [
  'audit:read',
  'membership:read',
  'role:assign',
  'league:read',
  'league:create',
  'league:update',
  'season:create',
  'season:read',
  'season:update',
  'season:publish',
  'team:create',
  'team:read',
  'team:update',
  'team:publish',
  'venue:read',
  'venue:create',
  'venue:update',
  'field:create',
  'field:update',
] as const;

interface SeedIdentity {
  readonly name: string;
  readonly email: string;
}

async function ensureIdentity(
  prisma: ReturnType<typeof createPrismaClient>,
  auth: ReturnType<typeof createLeagueAuth>,
  identity: SeedIdentity,
  password: string,
): Promise<string> {
  const existing = await prisma.user.findUnique({ where: { email: identity.email } });
  if (existing !== null) {
    return existing.id;
  }

  await auth.api.signUpEmail({
    body: { email: identity.email, name: identity.name, password },
  });
  const created = await prisma.user.findUniqueOrThrow({ where: { email: identity.email } });
  return created.id;
}

async function seedOrganizationA(
  database: TenantDatabase,
  users: Readonly<Record<'admin' | 'board' | 'auditor' | 'multi' | 'revoked', string>>,
): Promise<void> {
  await database.withTenant(
    { organizationId: ids.organizationA, userId: null, requestId: 'seed-org-a', source: 'SYSTEM' },
    async (tx) => {
      await tx.organization.upsert({
        where: { organizationId: ids.organizationA },
        create: {
          organizationId: ids.organizationA,
          slug: 'meade-county-demo',
          name: 'Meade County Church Softball League Demo',
          timezone: 'America/New_York',
        },
        update: { name: 'Meade County Church Softball League Demo', timezone: 'America/New_York' },
      });
      await tx.league.upsert({
        where: { organizationId_id: { organizationId: ids.organizationA, id: ids.leagueA } },
        create: {
          id: ids.leagueA,
          organizationId: ids.organizationA,
          slug: 'church-softball',
          name: 'Church Softball',
          active: true,
        },
        update: { slug: 'church-softball', name: 'Church Softball', active: true },
      });

      const roleDefinitions = [
        {
          id: ids.officerRoleA,
          key: 'league-administrator',
          name: 'League Administrator',
          authorityKind: 'OFFICER' as const,
          permissions: allOperationalPermissions,
        },
        {
          id: ids.boardRoleA,
          key: 'board-member',
          name: 'Board Member',
          authorityKind: 'BOARD' as const,
          permissions: ['audit:read', 'membership:read'] as const,
        },
        {
          id: ids.auditorRoleA,
          key: 'auditor',
          name: 'Auditor',
          authorityKind: 'AUDIT' as const,
          permissions: ['audit:read'] as const,
        },
      ];
      for (const definition of roleDefinitions) {
        await tx.role.upsert({
          where: { organizationId_id: { organizationId: ids.organizationA, id: definition.id } },
          create: {
            id: definition.id,
            organizationId: ids.organizationA,
            key: definition.key,
            name: definition.name,
            authorityKind: definition.authorityKind,
          },
          update: { name: definition.name, authorityKind: definition.authorityKind },
        });
        await tx.rolePermission.deleteMany({ where: { roleId: definition.id } });
        await tx.rolePermission.createMany({
          data: definition.permissions.map((permission) => ({
            organizationId: ids.organizationA,
            roleId: definition.id,
            permission,
          })),
        });
      }

      const memberships = [
        { userId: users.admin, roleId: ids.officerRoleA, suffix: '01' },
        { userId: users.board, roleId: ids.boardRoleA, suffix: '02' },
        { userId: users.auditor, roleId: ids.auditorRoleA, suffix: '03' },
        { userId: users.multi, roleId: ids.officerRoleA, suffix: '04' },
        { userId: users.revoked, roleId: ids.officerRoleA, suffix: '05' },
      ] as const;
      for (const membershipSeed of memberships) {
        const membership = await tx.organizationMembership.upsert({
          where: {
            organizationId_userId: {
              organizationId: ids.organizationA,
              userId: membershipSeed.userId,
            },
          },
          create: {
            organizationId: ids.organizationA,
            userId: membershipSeed.userId,
            status: 'ACTIVE',
          },
          update: { status: 'ACTIVE' },
        });
        await tx.roleAssignment.upsert({
          where: {
            organizationId_id: {
              organizationId: ids.organizationA,
              id: `00000000-0000-4000-8000-0000000008${membershipSeed.suffix}`,
            },
          },
          create: {
            id: `00000000-0000-4000-8000-0000000008${membershipSeed.suffix}`,
            organizationId: ids.organizationA,
            membershipId: membership.id,
            roleId: membershipSeed.roleId,
            validFrom: new Date('2026-01-01T00:00:00.000Z'),
            ...(membershipSeed.userId === users.revoked
              ? { revokedAt: new Date('2026-08-01T00:00:00.000Z'), revokedByUserId: users.admin }
              : {}),
          },
          update:
            membershipSeed.userId === users.revoked
              ? { revokedAt: new Date('2026-08-01T00:00:00.000Z'), revokedByUserId: users.admin }
              : { revokedAt: null, revokedByUserId: null },
        });
      }

      await tx.season.upsert({
        where: { organizationId_id: { organizationId: ids.organizationA, id: ids.seasonA } },
        create: {
          id: ids.seasonA,
          organizationId: ids.organizationA,
          leagueId: ids.leagueA,
          slug: 'spring-2026',
          name: 'Spring 2026',
          startDate: new Date('2026-04-01T00:00:00.000Z'),
          endDate: new Date('2026-07-31T00:00:00.000Z'),
          timezone: 'America/New_York',
        },
        update: {},
      });
      await tx.seasonConfigurationRevision.upsert({
        where: {
          organizationId_seasonId_revision: {
            organizationId: ids.organizationA,
            seasonId: ids.seasonA,
            revision: 1,
          },
        },
        create: {
          organizationId: ids.organizationA,
          seasonId: ids.seasonA,
          revision: 1,
          configuration: { fixtureOnly: true, source: 'synthetic' },
        },
        update: {},
      });

      const teams = [
        {
          teamId: ids.homeTeam,
          teamSeasonId: ids.homeTeamSeason,
          name: 'Demo Home Team Internal',
          publicName: 'Demo Home Team',
          slug: 'demo-home',
        },
        {
          teamId: ids.awayTeam,
          teamSeasonId: ids.awayTeamSeason,
          name: 'Demo Away Team Internal',
          publicName: 'Demo Away Team',
          slug: 'demo-away',
        },
      ];
      for (const team of teams) {
        await tx.team.upsert({
          where: { organizationId_id: { organizationId: ids.organizationA, id: team.teamId } },
          create: { id: team.teamId, organizationId: ids.organizationA, name: team.name },
          update: { name: team.name },
        });
        await tx.teamSeason.upsert({
          where: {
            organizationId_id: { organizationId: ids.organizationA, id: team.teamSeasonId },
          },
          create: {
            id: team.teamSeasonId,
            organizationId: ids.organizationA,
            seasonId: ids.seasonA,
            teamId: team.teamId,
            slug: team.slug,
            publicName: team.publicName,
          },
          update: { slug: team.slug, publicName: team.publicName },
        });
      }

      await tx.venue.upsert({
        where: { organizationId_id: { organizationId: ids.organizationA, id: ids.venue } },
        create: {
          id: ids.venue,
          organizationId: ids.organizationA,
          name: 'Synthetic Ballpark',
          active: true,
        },
        update: { name: 'Synthetic Ballpark', active: true },
      });
      await tx.field.upsert({
        where: { organizationId_id: { organizationId: ids.organizationA, id: ids.field } },
        create: {
          id: ids.field,
          organizationId: ids.organizationA,
          venueId: ids.venue,
          name: 'Demo Field 1',
          publicDirections: 'Use the signed public entrance.',
          hasLights: true,
          fenceDistanceFeet: 300,
          active: true,
        },
        update: {
          name: 'Demo Field 1',
          publicDirections: 'Use the signed public entrance.',
          hasLights: true,
          fenceDistanceFeet: 300,
          active: true,
        },
      });
      await tx.scheduleVersion.upsert({
        where: { organizationId_id: { organizationId: ids.organizationA, id: ids.schedule } },
        create: {
          id: ids.schedule,
          organizationId: ids.organizationA,
          seasonId: ids.seasonA,
          revision: 1,
        },
        update: {},
      });
      await tx.game.upsert({
        where: { organizationId_id: { organizationId: ids.organizationA, id: ids.game } },
        create: {
          id: ids.game,
          organizationId: ids.organizationA,
          seasonId: ids.seasonA,
          scheduleVersionId: ids.schedule,
          homeTeamSeasonId: ids.homeTeamSeason,
          awayTeamSeasonId: ids.awayTeamSeason,
          fieldId: ids.field,
          startsAt: new Date('2026-05-04T22:00:00.000Z'),
        },
        update: {},
      });

      const publicSeason: Prisma.InputJsonValue = {
        seasonId: ids.seasonA,
        slug: 'spring-2026',
        name: 'Spring 2026',
        startDate: '2026-04-01',
        endDate: '2026-07-31',
        timezone: 'America/New_York',
      };
      const seasonPayload: Prisma.InputJsonValue = {
        organization: {
          slug: 'meade-county-demo',
          name: 'Meade County Church Softball League Demo',
        },
        league: { slug: 'church-softball', name: 'Church Softball' },
        currentSeason: publicSeason,
      };
      await tx.publicationSnapshot.upsert({
        where: {
          organizationId_resourceKind_resourceId_revision: {
            organizationId: ids.organizationA,
            resourceKind: 'SEASON',
            resourceId: ids.seasonA,
            revision: 1,
          },
        },
        create: {
          organizationId: ids.organizationA,
          resourceKind: 'SEASON',
          resourceId: ids.seasonA,
          revision: 1,
          payload: seasonPayload,
        },
        update: {},
      });
      for (const team of teams) {
        const payload: Prisma.InputJsonValue = {
          seasonId: ids.seasonA,
          team: {
            teamSeasonId: team.teamSeasonId,
            slug: team.slug,
            publicName: team.publicName,
          },
        };
        await tx.publicationSnapshot.upsert({
          where: {
            organizationId_resourceKind_resourceId_revision: {
              organizationId: ids.organizationA,
              resourceKind: 'TEAM_SEASON',
              resourceId: team.teamSeasonId,
              revision: 1,
            },
          },
          create: {
            organizationId: ids.organizationA,
            resourceKind: 'TEAM_SEASON',
            resourceId: team.teamSeasonId,
            revision: 1,
            payload,
          },
          update: {},
        });
      }
      await tx.publicationSnapshot.upsert({
        where: {
          organizationId_resourceKind_resourceId_revision: {
            organizationId: ids.organizationA,
            resourceKind: 'SCHEDULE',
            resourceId: ids.schedule,
            revision: 1,
          },
        },
        create: {
          organizationId: ids.organizationA,
          resourceKind: 'SCHEDULE',
          resourceId: ids.schedule,
          revision: 1,
          payload: {
            season: publicSeason,
            items: [
              {
                gameId: ids.game,
                startsAt: '2026-05-04T22:00:00.000Z',
                status: 'SCHEDULED',
                homeTeam: {
                  teamSeasonId: ids.homeTeamSeason,
                  slug: 'demo-home',
                  publicName: 'Demo Home Team',
                },
                awayTeam: {
                  teamSeasonId: ids.awayTeamSeason,
                  slug: 'demo-away',
                  publicName: 'Demo Away Team',
                },
                field: {
                  name: 'Demo Field 1',
                  directions: 'Use the signed public entrance.',
                },
              },
            ],
          },
        },
        update: {},
      });
    },
  );
}

async function seedOrganizationB(
  database: TenantDatabase,
  multiTenantUserId: string,
): Promise<void> {
  await database.withTenant(
    { organizationId: ids.organizationB, userId: null, requestId: 'seed-org-b', source: 'SYSTEM' },
    async (tx) => {
      await tx.organization.upsert({
        where: { organizationId: ids.organizationB },
        create: {
          organizationId: ids.organizationB,
          slug: 'neighbor-league-demo',
          name: 'Neighbor League Demo',
          timezone: 'America/Chicago',
        },
        update: {},
      });
      await tx.league.upsert({
        where: { organizationId_id: { organizationId: ids.organizationB, id: ids.leagueB } },
        create: {
          id: ids.leagueB,
          organizationId: ids.organizationB,
          slug: 'softball',
          name: 'Softball',
          active: true,
        },
        update: { slug: 'softball', name: 'Softball', active: true },
      });
      await tx.role.upsert({
        where: { organizationId_id: { organizationId: ids.organizationB, id: ids.officerRoleB } },
        create: {
          id: ids.officerRoleB,
          organizationId: ids.organizationB,
          key: 'league-administrator',
          name: 'League Administrator',
          authorityKind: 'OFFICER',
        },
        update: {},
      });
      await tx.rolePermission.deleteMany({ where: { roleId: ids.officerRoleB } });
      await tx.rolePermission.createMany({
        data: allOperationalPermissions.map((permission) => ({
          organizationId: ids.organizationB,
          roleId: ids.officerRoleB,
          permission,
        })),
      });
      const membership = await tx.organizationMembership.upsert({
        where: {
          organizationId_userId: {
            organizationId: ids.organizationB,
            userId: multiTenantUserId,
          },
        },
        create: {
          organizationId: ids.organizationB,
          userId: multiTenantUserId,
          status: 'ACTIVE',
        },
        update: { status: 'ACTIVE' },
      });
      await tx.roleAssignment.upsert({
        where: {
          organizationId_id: {
            organizationId: ids.organizationB,
            id: '00000000-0000-4000-8000-000000000806',
          },
        },
        create: {
          id: '00000000-0000-4000-8000-000000000806',
          organizationId: ids.organizationB,
          membershipId: membership.id,
          roleId: ids.officerRoleB,
          validFrom: new Date('2026-01-01T00:00:00.000Z'),
        },
        update: { revokedAt: null },
      });
      await tx.season.upsert({
        where: { organizationId_id: { organizationId: ids.organizationB, id: ids.seasonB } },
        create: {
          id: ids.seasonB,
          organizationId: ids.organizationB,
          leagueId: ids.leagueB,
          slug: 'private-2026',
          name: 'Private Draft 2026',
          startDate: new Date('2026-04-01T00:00:00.000Z'),
          endDate: new Date('2026-07-31T00:00:00.000Z'),
          timezone: 'America/Chicago',
        },
        update: {},
      });
    },
  );
}

async function main(): Promise<void> {
  const password = process.env.DEMO_ADMIN_PASSWORD;
  const secret = process.env.BETTER_AUTH_SECRET;
  if (password === undefined || password.length < 12) {
    throw new Error(
      'DEMO_ADMIN_PASSWORD with at least 12 characters is required for synthetic seed data.',
    );
  }
  if (secret === undefined || secret.length < 32) {
    throw new Error(
      'BETTER_AUTH_SECRET with at least 32 characters is required for synthetic seed data.',
    );
  }

  const prisma = createPrismaClient(process.env.DATABASE_URL);
  try {
    const auth = createLeagueAuth({
      prisma,
      secret,
      baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:8080',
      trustedOrigins: [process.env.WEB_ORIGIN ?? 'http://localhost:8080'],
      allowSignUp: true,
    });
    const identities = {
      admin: { name: 'Synthetic League Administrator', email: 'admin@demo.invalid' },
      board: { name: 'Synthetic Board Member', email: 'board@demo.invalid' },
      auditor: { name: 'Synthetic Auditor', email: 'auditor@demo.invalid' },
      multi: { name: 'Synthetic Multi-Tenant Administrator', email: 'multi-admin@demo.invalid' },
      revoked: { name: 'Synthetic Revoked Officer', email: 'revoked@demo.invalid' },
      operator: { name: 'Synthetic Platform Operator', email: 'operator@demo.invalid' },
    } as const;
    const users = {
      admin: await ensureIdentity(prisma, auth, identities.admin, password),
      board: await ensureIdentity(prisma, auth, identities.board, password),
      auditor: await ensureIdentity(prisma, auth, identities.auditor, password),
      multi: await ensureIdentity(prisma, auth, identities.multi, password),
      revoked: await ensureIdentity(prisma, auth, identities.revoked, password),
      operator: await ensureIdentity(prisma, auth, identities.operator, password),
    };

    const platformGrants = [
      { id: ids.operatorProvisionGrant, permission: 'TENANT_PROVISION' as const },
      { id: ids.operatorRevokeGrant, permission: 'INVITATION_REVOKE' as const },
    ];
    for (const grant of platformGrants) {
      await prisma.platformPermissionGrant.upsert({
        where: { id: grant.id },
        create: {
          id: grant.id,
          userId: users.operator,
          permission: grant.permission,
          validFrom: new Date('2026-01-01T00:00:00.000Z'),
          reason: 'Synthetic controlled-beta Platform Operator fixture.',
        },
        update: {
          userId: users.operator,
          permission: grant.permission,
          validFrom: new Date('2026-01-01T00:00:00.000Z'),
          expiresAt: null,
          revokedAt: null,
          revokedByUserId: null,
          revocationReason: null,
          reason: 'Synthetic controlled-beta Platform Operator fixture.',
        },
      });
    }

    const database = new TenantDatabase(prisma);
    await seedOrganizationA(database, users);
    await seedOrganizationB(database, users.multi);
  } finally {
    await prisma.$disconnect();
  }
}

await main();
