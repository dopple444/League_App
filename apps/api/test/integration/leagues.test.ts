import { randomUUID } from 'node:crypto';

import type { AuthenticatedUser } from '@league/auth';
import { createLeagueSchema, updateLeagueSchema } from '@league/contracts';
import { IdempotencyConflictError, VersionConflictError } from '@league/domain';
import { describe, expect, it } from 'vitest';

import { ResourceNotFoundError } from '../../src/common/errors.js';
import { AccessService } from '../../src/services/access.service.js';
import { LeaguesService } from '../../src/services/leagues.service.js';
import { MutationService, type MutationContext } from '../../src/services/mutation.service.js';
import {
  databaseTestsEnabled,
  fixtureIds,
  testDatabase,
  userIdByEmail,
} from '../helpers/database.js';

function actor(id: string, email: string): AuthenticatedUser {
  return { id, email, name: 'Synthetic League Administrator', twoFactorEnabled: true };
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

describe.skipIf(!databaseTestsEnabled)('league administration', () => {
  it('lists, creates, and updates leagues idempotently with attributable audit/outbox records', async () => {
    const { prisma, database } = testDatabase();
    try {
      const adminId = await userIdByEmail(prisma, 'admin@demo.invalid');
      const admin = actor(adminId, 'admin@demo.invalid');
      const access = new AccessService(database);
      const leagues = new LeaguesService(database, access, new MutationService(database, access));
      const unique = randomUUID();
      const createContext = mutationContext(fixtureIds.organizationA, admin, 'league-create');
      const createInput = {
        name: ` Integration League ${unique} `,
        slug: `integration-${unique}`,
        active: true,
      };

      const created = await leagues.create(createContext, createInput);
      await expect(leagues.create(createContext, createInput)).resolves.toEqual(created);
      expect(created).toMatchObject({
        organizationId: fixtureIds.organizationA,
        name: `Integration League ${unique}`,
        slug: createInput.slug,
        version: 1,
      });

      const updateContext = mutationContext(fixtureIds.organizationA, admin, 'league-update');
      const updateInput = {
        expectedVersion: created.version,
        name: `Updated League ${unique}`,
        slug: `updated-${unique}`,
        active: false,
      };
      const updated = await leagues.update(updateContext, created.leagueId, updateInput);
      await expect(leagues.update(updateContext, created.leagueId, updateInput)).resolves.toEqual(
        updated,
      );
      expect(updated).toMatchObject({
        name: updateInput.name,
        slug: updateInput.slug,
        active: false,
        version: created.version + 1,
      });

      const listed = await leagues.list(fixtureIds.organizationA, admin, {
        requestId: `league-list-${unique}`,
        source: 'WEB',
      });
      expect(listed.items.find((league) => league.leagueId === created.leagueId)).toEqual(updated);

      await database.withTenant(
        {
          organizationId: fixtureIds.organizationA,
          userId: adminId,
          requestId: `league-verify-${unique}`,
          source: 'API',
        },
        async (transaction) => {
          const [
            createAudits,
            createOutbox,
            updateAudits,
            updateOutbox,
            createReplay,
            updateReplay,
          ] = await Promise.all([
            transaction.auditEvent.findMany({
              where: { action: 'league.created', targetId: created.leagueId },
            }),
            transaction.outboxEvent.findMany({
              where: { eventType: 'league.created', aggregateId: created.leagueId },
            }),
            transaction.auditEvent.findMany({
              where: { action: 'league.updated', targetId: created.leagueId },
            }),
            transaction.outboxEvent.findMany({
              where: { eventType: 'league.updated', aggregateId: created.leagueId },
            }),
            transaction.idempotencyRecord.findUnique({
              where: {
                organizationId_actorUserId_key: {
                  organizationId: fixtureIds.organizationA,
                  actorUserId: adminId,
                  key: createContext.idempotencyKey,
                },
              },
            }),
            transaction.idempotencyRecord.findUnique({
              where: {
                organizationId_actorUserId_key: {
                  organizationId: fixtureIds.organizationA,
                  actorUserId: adminId,
                  key: updateContext.idempotencyKey,
                },
              },
            }),
          ]);
          expect(createAudits).toHaveLength(1);
          expect(createAudits[0]).toMatchObject({
            actorUserId: adminId,
            requestId: createContext.metadata.requestId,
            source: 'WEB',
            targetType: 'League',
          });
          expect(createAudits[0]?.before).toBeNull();
          expect(createAudits[0]?.after).not.toBeNull();
          expect(createOutbox).toHaveLength(1);
          expect(updateAudits).toHaveLength(1);
          expect(updateAudits[0]).toMatchObject({
            actorUserId: adminId,
            requestId: updateContext.metadata.requestId,
            source: 'WEB',
            targetType: 'League',
          });
          expect(updateAudits[0]?.before).not.toBeNull();
          expect(updateAudits[0]?.after).not.toBeNull();
          expect(updateOutbox).toHaveLength(1);
          expect(createReplay).toMatchObject({ responseStatus: 201 });
          expect(createReplay?.responseBody).toMatchObject({ leagueId: created.leagueId });
          expect(updateReplay).toMatchObject({ responseStatus: 200 });
        },
      );
    } finally {
      await prisma.$disconnect();
    }
  });

  it('replays concurrent same-key creates and deterministically rejects one stale concurrent update', async () => {
    const { prisma, database } = testDatabase();
    try {
      const adminId = await userIdByEmail(prisma, 'admin@demo.invalid');
      const admin = actor(adminId, 'admin@demo.invalid');
      const access = new AccessService(database);
      const leagues = new LeaguesService(database, access, new MutationService(database, access));
      const unique = randomUUID();
      const createContext = mutationContext(
        fixtureIds.organizationA,
        admin,
        'league-concurrent-create',
      );
      const input = {
        name: `Concurrent League ${unique}`,
        slug: `concurrent-${unique}`,
        active: true,
      };

      const responses = await Promise.all(
        Array.from({ length: 4 }, async () => leagues.create(createContext, input)),
      );
      expect(responses.every((response) => response.leagueId === responses[0]?.leagueId)).toBe(
        true,
      );
      const created = responses[0];
      expect(created).toBeDefined();
      if (created === undefined) return;

      const renameContext = mutationContext(
        fixtureIds.organizationA,
        admin,
        'league-concurrent-name',
      );
      const slugContext = mutationContext(
        fixtureIds.organizationA,
        admin,
        'league-concurrent-slug',
      );
      const outcomes = await Promise.allSettled([
        leagues.update(renameContext, created.leagueId, {
          expectedVersion: created.version,
          name: `Concurrent Winner ${unique}`,
          slug: created.slug,
          active: created.active,
        }),
        leagues.update(slugContext, created.leagueId, {
          expectedVersion: created.version,
          name: created.name,
          slug: `concurrent-winner-${unique}`,
          active: created.active,
        }),
      ]);
      const fulfilled = outcomes.filter(
        (outcome): outcome is PromiseFulfilledResult<typeof created> =>
          outcome.status === 'fulfilled',
      );
      const rejected = outcomes.filter(
        (outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected',
      );
      expect(fulfilled).toHaveLength(1);
      expect(fulfilled[0]?.value.version).toBe(created.version + 1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0]?.reason).toBeInstanceOf(VersionConflictError);

      await database.withTenant(
        {
          organizationId: fixtureIds.organizationA,
          userId: adminId,
          requestId: `league-concurrent-verify-${unique}`,
          source: 'API',
        },
        async (transaction) => {
          const [
            leagueCount,
            createAuditCount,
            createOutboxCount,
            updateAuditCount,
            updateOutboxCount,
          ] = await Promise.all([
            transaction.league.count({ where: { id: created.leagueId } }),
            transaction.auditEvent.count({
              where: { action: 'league.created', targetId: created.leagueId },
            }),
            transaction.outboxEvent.count({
              where: { eventType: 'league.created', aggregateId: created.leagueId },
            }),
            transaction.auditEvent.count({
              where: { action: 'league.updated', targetId: created.leagueId },
            }),
            transaction.outboxEvent.count({
              where: { eventType: 'league.updated', aggregateId: created.leagueId },
            }),
          ]);
          expect(leagueCount).toBe(1);
          expect(createAuditCount).toBe(1);
          expect(createOutboxCount).toBe(1);
          expect(updateAuditCount).toBe(1);
          expect(updateOutboxCount).toBe(1);
        },
      );
    } finally {
      await prisma.$disconnect();
    }
  });

  it('returns stable duplicate, stale-version, changed-idempotency, and strict-contract errors', async () => {
    const { prisma, database } = testDatabase();
    try {
      const admin = actor(await userIdByEmail(prisma, 'admin@demo.invalid'), 'admin@demo.invalid');
      const access = new AccessService(database);
      const leagues = new LeaguesService(database, access, new MutationService(database, access));
      const unique = randomUUID();
      const createContext = mutationContext(fixtureIds.organizationA, admin, 'league-conflict');
      const league = await leagues.create(createContext, {
        name: `Conflict League ${unique}`,
        slug: `conflict-${unique}`,
        active: true,
      });

      await expect(
        leagues.create(mutationContext(fixtureIds.organizationA, admin, 'league-duplicate'), {
          name: 'Another league',
          slug: league.slug,
          active: true,
        }),
      ).rejects.toMatchObject({ code: 'DUPLICATE_LEAGUE_SLUG' });

      const renameCandidate = await leagues.create(
        mutationContext(fixtureIds.organizationA, admin, 'league-duplicate-update-fixture'),
        {
          name: `Rename Candidate ${unique}`,
          slug: `rename-candidate-${unique}`,
          active: true,
        },
      );
      await expect(
        leagues.update(
          mutationContext(fixtureIds.organizationA, admin, 'league-duplicate-update'),
          renameCandidate.leagueId,
          {
            expectedVersion: renameCandidate.version,
            name: renameCandidate.name,
            slug: league.slug,
            active: renameCandidate.active,
          },
        ),
      ).rejects.toMatchObject({ code: 'DUPLICATE_LEAGUE_SLUG' });

      const updated = await leagues.update(
        mutationContext(fixtureIds.organizationA, admin, 'league-version'),
        league.leagueId,
        {
          expectedVersion: league.version,
          name: `Versioned League ${unique}`,
          slug: league.slug,
          active: league.active,
        },
      );
      await expect(
        leagues.update(
          mutationContext(fixtureIds.organizationA, admin, 'league-stale'),
          league.leagueId,
          {
            expectedVersion: league.version,
            name: league.name,
            slug: `stale-${unique}`,
            active: league.active,
          },
        ),
      ).rejects.toBeInstanceOf(VersionConflictError);
      expect(updated.version).toBe(league.version + 1);

      await expect(
        leagues.create(createContext, {
          name: 'Changed payload',
          slug: `changed-${unique}`,
          active: true,
        }),
      ).rejects.toBeInstanceOf(IdempotencyConflictError);

      expect(
        createLeagueSchema.safeParse({
          name: 'Strict league',
          slug: 'strict-league',
          active: true,
          extra: true,
        }).success,
      ).toBe(false);
      expect(updateLeagueSchema.safeParse({ expectedVersion: 1 }).success).toBe(false);
      expect(
        updateLeagueSchema.safeParse({
          expectedVersion: 1,
          name: 'Valid',
          slug: 'valid',
          active: true,
          extra: true,
        }).success,
      ).toBe(false);
    } finally {
      await prisma.$disconnect();
    }
  });

  it('denies restricted roles and hides cross-tenant league identifiers', async () => {
    const { prisma, database } = testDatabase();
    try {
      const [adminId, boardId, multiId] = await Promise.all([
        userIdByEmail(prisma, 'admin@demo.invalid'),
        userIdByEmail(prisma, 'board@demo.invalid'),
        userIdByEmail(prisma, 'multi-admin@demo.invalid'),
      ]);
      const admin = actor(adminId, 'admin@demo.invalid');
      const board = actor(boardId, 'board@demo.invalid');
      const multi = actor(multiId, 'multi-admin@demo.invalid');
      const access = new AccessService(database);
      const leagues = new LeaguesService(database, access, new MutationService(database, access));

      await expect(
        leagues.list(fixtureIds.organizationA, board, {
          requestId: `league-denied-${randomUUID()}`,
          source: 'WEB',
        }),
      ).rejects.toMatchObject({ code: 'AUTHORIZATION_DENIED' });

      const otherTenantLeague = await leagues.create(
        mutationContext(fixtureIds.organizationB, multi, 'league-other-tenant'),
        {
          name: `Neighbor League ${randomUUID()}`,
          slug: `neighbor-${randomUUID()}`,
          active: true,
        },
      );
      await expect(
        leagues.update(
          mutationContext(fixtureIds.organizationA, admin, 'league-wrong-tenant'),
          otherTenantLeague.leagueId,
          {
            expectedVersion: otherTenantLeague.version,
            name: 'Hidden League',
            slug: otherTenantLeague.slug,
            active: false,
          },
        ),
      ).rejects.toBeInstanceOf(ResourceNotFoundError);

      const listed = await leagues.list(fixtureIds.organizationA, admin, {
        requestId: `league-list-scope-${randomUUID()}`,
        source: 'API',
      });
      expect(listed.items.some((league) => league.leagueId === otherTenantLeague.leagueId)).toBe(
        false,
      );
    } finally {
      await prisma.$disconnect();
    }
  });
});
