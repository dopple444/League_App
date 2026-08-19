import { randomUUID } from 'node:crypto';

import type { AuthenticatedUser } from '@league/auth';
import { describe, expect, it, vi } from 'vitest';

import { ResourceNotFoundError } from '../../src/common/errors.js';
import { AccessService } from '../../src/services/access.service.js';
import { MutationService, type MutationContext } from '../../src/services/mutation.service.js';
import { PublicService } from '../../src/services/public.service.js';
import { SeasonsService } from '../../src/services/seasons.service.js';
import {
  databaseTestsEnabled,
  fixtureIds,
  testDatabase,
  userIdByEmail,
} from '../helpers/database.js';

describe.skipIf(!databaseTestsEnabled)('Milestone 1 authoritative vertical slice', () => {
  it('creates idempotently with attributable audit and outbox records', async () => {
    const { prisma, database } = testDatabase();
    try {
      const adminId = await userIdByEmail(prisma, 'admin@demo.invalid');
      const actor: AuthenticatedUser = {
        id: adminId,
        name: 'Synthetic League Administrator',
        email: 'admin@demo.invalid',
      };
      const access = new AccessService(database);
      const mutations = new MutationService(database, access);
      const seasons = new SeasonsService(database, access, mutations);
      const unique = randomUUID();
      const context: MutationContext = {
        organizationId: fixtureIds.organizationA,
        user: actor,
        idempotencyKey: `season-create-${unique}`,
        metadata: { requestId: `request-${unique}`, source: 'WEB' },
      };
      const input = {
        leagueId: fixtureIds.leagueA,
        name: 'Integration Season',
        slug: `integration-${unique}`,
        startDate: '2026-09-01',
        endDate: '2026-10-01',
        timezone: 'America/New_York',
      };

      const created = await seasons.create(context, input);
      await expect(seasons.create(context, input)).resolves.toEqual(created);

      await database.withTenant(
        {
          organizationId: fixtureIds.organizationA,
          userId: adminId,
          requestId: 'verify-audit',
          source: 'API',
        },
        async (transaction) => {
          const audits = await transaction.auditEvent.findMany({
            where: { action: 'season.created', targetId: created.seasonId },
          });
          const outbox = await transaction.outboxEvent.findMany({
            where: { eventType: 'season.created', aggregateId: created.seasonId },
          });
          expect(audits).toHaveLength(1);
          expect(audits[0]).toMatchObject({
            actorUserId: adminId,
            organizationId: fixtureIds.organizationA,
            action: 'season.created',
            targetType: 'Season',
            targetId: created.seasonId,
            requestId: context.metadata.requestId,
            source: 'WEB',
            before: null,
          });
          expect(audits[0]?.after).not.toBeNull();
          expect(outbox).toHaveLength(1);
        },
      );

      const updated = await seasons.update(
        { ...context, idempotencyKey: `season-update-${unique}` },
        created.seasonId,
        { expectedVersion: created.version, name: 'Integration Season Updated' },
      );
      await database.withTenant(
        {
          organizationId: fixtureIds.organizationA,
          userId: adminId,
          requestId: 'verify-update-audit',
          source: 'API',
        },
        async (transaction) => {
          const audit = await transaction.auditEvent.findFirstOrThrow({
            where: { action: 'season.updated', targetId: updated.seasonId },
            orderBy: { occurredAt: 'desc' },
          });
          expect(audit.before).not.toBeNull();
          expect(audit.after).not.toBeNull();
        },
      );
    } finally {
      await prisma.$disconnect();
    }
  });

  it('rolls back state and idempotency when audit/outbox recording fails', async () => {
    const { prisma, database } = testDatabase();
    try {
      const adminId = await userIdByEmail(prisma, 'admin@demo.invalid');
      const access = new AccessService(database);
      const mutations = new MutationService(database, access);
      vi.spyOn(mutations, 'record').mockRejectedValueOnce(new Error('forced audit failure'));
      const seasons = new SeasonsService(database, access, mutations);
      const unique = randomUUID();
      const context: MutationContext = {
        organizationId: fixtureIds.organizationA,
        user: { id: adminId, name: 'Synthetic Admin', email: 'admin@demo.invalid' },
        idempotencyKey: `rollback-${unique}`,
        metadata: { requestId: `rollback-request-${unique}`, source: 'API' },
      };
      const slug = `rollback-${unique}`;
      await expect(
        seasons.create(context, {
          leagueId: fixtureIds.leagueA,
          name: 'Must Roll Back',
          slug,
          startDate: '2026-09-01',
          endDate: '2026-10-01',
          timezone: 'America/New_York',
        }),
      ).rejects.toThrow('forced audit failure');

      await database.withTenant(
        {
          organizationId: fixtureIds.organizationA,
          userId: adminId,
          requestId: 'verify-rollback',
          source: 'API',
        },
        async (transaction) => {
          await expect(transaction.season.count({ where: { slug } })).resolves.toBe(0);
          await expect(
            transaction.idempotencyRecord.count({ where: { key: context.idempotencyKey } }),
          ).resolves.toBe(0);
        },
      );
    } finally {
      await prisma.$disconnect();
    }
  });

  it('serves only published snapshot data and keeps drafts private', async () => {
    const { prisma, database } = testDatabase();
    try {
      const publicService = new PublicService(database);
      await expect(
        publicService.league('meade-county-demo', 'church-softball', 'public-league'),
      ).resolves.toMatchObject({
        organization: { slug: 'meade-county-demo' },
        league: { slug: 'church-softball' },
        currentSeason: { slug: 'spring-2026' },
      });
      await expect(
        publicService.schedule(
          'meade-county-demo',
          'church-softball',
          'spring-2026',
          'public-schedule',
        ),
      ).resolves.toMatchObject({ items: [{ status: 'SCHEDULED' }] });
      await expect(
        publicService.teams(
          'meade-county-demo',
          'church-softball',
          'not-published',
          'private-season',
        ),
      ).rejects.toBeInstanceOf(ResourceNotFoundError);
    } finally {
      await prisma.$disconnect();
    }
  });
});
