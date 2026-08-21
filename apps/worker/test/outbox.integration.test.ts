import { randomUUID } from 'node:crypto';

import { createPrismaClient, TenantDatabase } from '@league/database';
import { describe, expect, it } from 'vitest';

import type { OutboxDispatchJob } from '../src/outbox.contract.js';
import { OutboxRepository } from '../src/outbox.repository.js';

const testDatabaseUrl = process.env.HOST_TEST_DATABASE_URL ?? process.env.TEST_DATABASE_URL;
const testMigratorDatabaseUrl =
  process.env.HOST_TEST_MIGRATOR_DATABASE_URL ?? process.env.TEST_MIGRATOR_DATABASE_URL;
const databaseTestsEnabled = testDatabaseUrl !== undefined && testDatabaseUrl.length > 0;
const migratorTestsEnabled =
  testMigratorDatabaseUrl !== undefined && testMigratorDatabaseUrl.length > 0;
const organizations = {
  a: '00000000-0000-4000-8000-000000000001',
  b: '00000000-0000-4000-8000-000000000002',
} as const;

describe.skipIf(!databaseTestsEnabled)('transactional outbox relay database lifecycle', () => {
  it('discovers metadata only and denies wrong-tenant row access', async () => {
    const context = integrationDatabase();
    const marker = `outbox-discovery-${randomUUID()}`;
    try {
      const eventId = await createEvent(context.database, organizations.a, marker);
      await createEvent(context.database, organizations.b, marker);

      const discovered = await context.database.listDueOutboxOrganizationIds(100);
      expect(discovered).toEqual(expect.arrayContaining([organizations.a, organizations.b]));
      expect(discovered.every((value) => typeof value === 'string')).toBe(true);

      await context.database.withTenant(
        workerContext(organizations.b, `${marker}-wrong-tenant`),
        async (transaction) => {
          await expect(
            transaction.outboxEvent.findUnique({
              where: {
                organizationId_id: { organizationId: organizations.a, id: eventId },
              },
            }),
          ).resolves.toBeNull();
          await expect(
            transaction.outboxEvent.updateMany({
              where: { organizationId: organizations.a, id: eventId },
              data: { status: 'FAILED' },
            }),
          ).resolves.toMatchObject({ count: 0 });
        },
      );
    } finally {
      await cleanup(context.database, marker);
      await context.prisma.$disconnect();
    }
  });

  it('claims concurrently once, reclaims an expired lease, and fences stale completion', async () => {
    const first = integrationDatabase();
    const second = integrationDatabase();
    const marker = `outbox-fencing-${randomUUID()}`;
    try {
      const eventId = await createEvent(first.database, organizations.a, marker);
      const firstRepository = new OutboxRepository(first.database);
      const secondRepository = new OutboxRepository(second.database);
      const claimOptions = { batchSize: 1, leaseMs: 60_000, maxDispatchAttempts: 10 };

      const concurrent = await Promise.all([
        firstRepository.claimDue(organizations.a, claimOptions),
        secondRepository.claimDue(organizations.a, claimOptions),
      ]);
      const firstGeneration = concurrent.flatMap((result) => result.events);
      expect(firstGeneration).toHaveLength(1);
      expect(firstGeneration[0]).toMatchObject({ dispatchAttempt: 1, eventId });

      await first.database.withTenant(
        workerContext(organizations.a, `${marker}-expire`),
        async (transaction) => {
          await transaction.outboxEvent.updateMany({
            where: { organizationId: organizations.a, id: eventId },
            data: { availableAt: new Date(0) },
          });
        },
      );
      const reclaimed = await secondRepository.claimDue(organizations.a, claimOptions);
      expect(reclaimed.events).toHaveLength(1);
      expect(reclaimed.events[0]).toMatchObject({ dispatchAttempt: 2, eventId });

      const stale = dispatchJob(firstGeneration[0]);
      const current = dispatchJob(reclaimed.events[0]);
      await expect(firstRepository.complete(stale)).resolves.toBe(false);
      await expect(secondRepository.complete(current)).resolves.toBe(true);
      await expect(secondRepository.complete(current)).resolves.toBe(false);
    } finally {
      await cleanup(first.database, marker);
      await Promise.all([first.prisma.$disconnect(), second.prisma.$disconnect()]);
    }
  });

  it('moves an exhausted due generation to visible terminal failure', async () => {
    const context = integrationDatabase();
    const marker = `outbox-terminal-${randomUUID()}`;
    try {
      const healthBefore = await context.database.outboxRelayHealth();
      const eventId = await createEvent(context.database, organizations.a, marker, 2);
      const repository = new OutboxRepository(context.database);
      const claimed = await repository.claimDue(organizations.a, {
        batchSize: 1,
        leaseMs: 60_000,
        maxDispatchAttempts: 2,
      });

      expect(claimed).toEqual({ events: [], exhausted: 1 });
      await context.database.withTenant(
        workerContext(organizations.a, `${marker}-verify`),
        async (transaction) => {
          await expect(
            transaction.outboxEvent.findUniqueOrThrow({
              where: {
                organizationId_id: { organizationId: organizations.a, id: eventId },
              },
              select: { status: true },
            }),
          ).resolves.toEqual({ status: 'FAILED' });
        },
      );
      await expect(context.database.outboxRelayHealth()).resolves.toMatchObject({
        failed: healthBefore.failed + 1,
      });
    } finally {
      await cleanup(context.database, marker);
      await context.prisma.$disconnect();
    }
  });
});

describe.skipIf(!migratorTestsEnabled)('outbox relay database privileges', () => {
  it('limits the definer role to discovery columns and prevents runtime event rewrites', async () => {
    if (testMigratorDatabaseUrl === undefined)
      throw new Error('A migrator database URL is required.');
    const prisma = createPrismaClient(testMigratorDatabaseUrl);
    try {
      const rows = await prisma.$queryRaw<
        {
          owner_can_read_organization: boolean;
          owner_can_read_payload: boolean;
          runtime_can_delete: boolean;
          runtime_can_update_payload: boolean;
          runtime_can_update_status: boolean;
        }[]
      >`
        SELECT
          has_column_privilege(
            'league_rls_owner',
            'public.outbox_event',
            'organization_id',
            'SELECT'
          ) AS owner_can_read_organization,
          has_column_privilege(
            'league_rls_owner',
            'public.outbox_event',
            'payload',
            'SELECT'
          ) AS owner_can_read_payload,
          has_table_privilege(
            'league_runtime',
            'public.outbox_event',
            'DELETE'
          ) AS runtime_can_delete,
          has_column_privilege(
            'league_runtime',
            'public.outbox_event',
            'payload',
            'UPDATE'
          ) AS runtime_can_update_payload,
          has_column_privilege(
            'league_runtime',
            'public.outbox_event',
            'status',
            'UPDATE'
          ) AS runtime_can_update_status
      `;

      expect(rows).toEqual([
        {
          owner_can_read_organization: true,
          owner_can_read_payload: false,
          runtime_can_delete: false,
          runtime_can_update_payload: false,
          runtime_can_update_status: true,
        },
      ]);
    } finally {
      await prisma.$disconnect();
    }
  });
});

function integrationDatabase() {
  if (testDatabaseUrl === undefined) throw new Error('A test database URL is required.');
  const prisma = createPrismaClient(testDatabaseUrl);
  return { database: new TenantDatabase(prisma), prisma };
}

async function createEvent(
  database: TenantDatabase,
  organizationId: string,
  requestId: string,
  attempts = 0,
): Promise<string> {
  return database.withTenant(workerContext(organizationId, requestId), async (transaction) => {
    const event = await transaction.outboxEvent.create({
      data: {
        aggregateId: randomUUID(),
        aggregateType: 'SyntheticOutboxIntegration',
        attempts,
        availableAt: new Date(0),
        eventType: 'synthetic.outbox.integration',
        organizationId,
        payload: { syntheticPrivateMarker: randomUUID() },
        requestId,
      },
      select: { id: true },
    });
    return event.id;
  });
}

async function cleanup(database: TenantDatabase, requestIdPrefix: string): Promise<void> {
  for (const organizationId of Object.values(organizations)) {
    await database.withTenant(
      workerContext(organizationId, `${requestIdPrefix}-cleanup`),
      async (transaction) => {
        await transaction.outboxEvent.deleteMany({
          where: { requestId: { startsWith: requestIdPrefix } },
        });
      },
    );
  }
}

function workerContext(organizationId: string, requestId: string) {
  return { organizationId, requestId, source: 'WORKER' as const, userId: null };
}

function dispatchJob(
  event:
    | {
        aggregateId: string;
        aggregateType: string;
        dispatchAttempt: number;
        eventId: string;
        eventType: string;
        organizationId: string;
        requestId: string;
      }
    | undefined,
): OutboxDispatchJob {
  if (event === undefined) throw new Error('Expected a claimed outbox event.');
  return { actor: { kind: 'SYSTEM' }, ...event, schemaVersion: 1 };
}
