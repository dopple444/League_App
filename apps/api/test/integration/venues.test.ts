import { randomUUID } from 'node:crypto';

import type { AuthenticatedUser } from '@league/auth';
import { createFieldSchema } from '@league/contracts';
import { IdempotencyConflictError, VersionConflictError } from '@league/domain';
import { describe, expect, it } from 'vitest';

import { ResourceNotFoundError } from '../../src/common/errors.js';
import { AccessService } from '../../src/services/access.service.js';
import { MutationService, type MutationContext } from '../../src/services/mutation.service.js';
import { VenuesService } from '../../src/services/venues.service.js';
import {
  databaseTestsEnabled,
  fixtureIds,
  testDatabase,
  userIdByEmail,
} from '../helpers/database.js';

function actor(id: string, email: string): AuthenticatedUser {
  return { id, email, name: 'Synthetic Facility Administrator' };
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

describe.skipIf(!databaseTestsEnabled)('venue and field administration', () => {
  it('creates and updates venues and fields idempotently with one audit/outbox pair per write', async () => {
    const { prisma, database } = testDatabase();
    try {
      const adminId = await userIdByEmail(prisma, 'admin@demo.invalid');
      const admin = actor(adminId, 'admin@demo.invalid');
      const access = new AccessService(database);
      const mutations = new MutationService(database, access);
      const venues = new VenuesService(database, access, mutations);
      const unique = randomUUID();

      const createVenueContext = mutationContext(fixtureIds.organizationA, admin, 'venue-create');
      const createdVenue = await venues.createVenue(createVenueContext, {
        name: ` Integration Venue ${unique} `,
        active: true,
      });
      await expect(
        venues.createVenue(createVenueContext, {
          name: ` Integration Venue ${unique} `,
          active: true,
        }),
      ).resolves.toEqual(createdVenue);

      const updateVenueContext = mutationContext(fixtureIds.organizationA, admin, 'venue-update');
      const updatedVenue = await venues.updateVenue(updateVenueContext, createdVenue.venueId, {
        expectedVersion: createdVenue.version,
        name: `Integration Venue Updated ${unique}`,
        active: false,
      });
      await expect(
        venues.updateVenue(updateVenueContext, createdVenue.venueId, {
          expectedVersion: createdVenue.version,
          name: `Integration Venue Updated ${unique}`,
          active: false,
        }),
      ).resolves.toEqual(updatedVenue);

      const createFieldContext = mutationContext(fixtureIds.organizationA, admin, 'field-create');
      const createdField = await venues.createField(createFieldContext, createdVenue.venueId, {
        name: ' Field 7 ',
        publicDirections: ' Use the synthetic north entrance. ',
        hasLights: true,
        fenceDistanceFeet: 315,
        active: true,
      });
      await expect(
        venues.createField(createFieldContext, createdVenue.venueId, {
          name: ' Field 7 ',
          publicDirections: ' Use the synthetic north entrance. ',
          hasLights: true,
          fenceDistanceFeet: 315,
          active: true,
        }),
      ).resolves.toEqual(createdField);

      const updateFieldContext = mutationContext(fixtureIds.organizationA, admin, 'field-update');
      const updatedField = await venues.updateField(
        updateFieldContext,
        createdVenue.venueId,
        createdField.fieldId,
        {
          expectedVersion: createdField.version,
          publicDirections: '',
          hasLights: false,
          fenceDistanceFeet: null,
          active: false,
        },
      );
      expect(updatedField).toMatchObject({
        publicDirections: null,
        hasLights: false,
        fenceDistanceFeet: null,
        active: false,
        version: createdField.version + 1,
      });

      const listed = await venues.list(fixtureIds.organizationA, admin, {
        requestId: `list-${unique}`,
        source: 'WEB',
      });
      expect(listed.items.find((venue) => venue.venueId === createdVenue.venueId)).toMatchObject({
        name: updatedVenue.name,
        fields: [{ fieldId: createdField.fieldId, name: createdField.name }],
      });

      await database.withTenant(
        {
          organizationId: fixtureIds.organizationA,
          userId: adminId,
          requestId: `verify-${unique}`,
          source: 'API',
        },
        async (transaction) => {
          for (const expected of [
            {
              action: 'venue.created',
              targetId: createdVenue.venueId,
              requestId: createVenueContext.metadata.requestId,
              update: false,
            },
            {
              action: 'venue.updated',
              targetId: createdVenue.venueId,
              requestId: updateVenueContext.metadata.requestId,
              update: true,
            },
            {
              action: 'field.created',
              targetId: createdField.fieldId,
              requestId: createFieldContext.metadata.requestId,
              update: false,
            },
            {
              action: 'field.updated',
              targetId: createdField.fieldId,
              requestId: updateFieldContext.metadata.requestId,
              update: true,
            },
          ]) {
            const [audits, outbox] = await Promise.all([
              transaction.auditEvent.findMany({
                where: { action: expected.action, targetId: expected.targetId },
              }),
              transaction.outboxEvent.findMany({
                where: { eventType: expected.action, aggregateId: expected.targetId },
              }),
            ]);
            expect(audits).toHaveLength(1);
            expect(audits[0]).toMatchObject({
              organizationId: fixtureIds.organizationA,
              actorUserId: adminId,
              action: expected.action,
              targetId: expected.targetId,
              requestId: expected.requestId,
              source: 'WEB',
            });
            expect(audits[0]?.after).not.toBeNull();
            expect(audits[0]?.before === null).toBe(!expected.update);
            expect(outbox).toHaveLength(1);
            expect(outbox[0]?.requestId).toBe(expected.requestId);
          }
        },
      );
    } finally {
      await prisma.$disconnect();
    }
  });

  it('replays concurrent creates from one idempotency key with one committed mutation', async () => {
    const { prisma, database } = testDatabase();
    try {
      const adminId = await userIdByEmail(prisma, 'admin@demo.invalid');
      const admin = actor(adminId, 'admin@demo.invalid');
      const access = new AccessService(database);
      const venues = new VenuesService(database, access, new MutationService(database, access));
      const unique = randomUUID();
      const context = mutationContext(fixtureIds.organizationA, admin, 'concurrent-create');
      const input = { name: `Concurrent Replay Venue ${unique}`, active: true } as const;

      const responses = await Promise.all(
        Array.from({ length: 4 }, async () => venues.createVenue(context, input)),
      );
      expect(responses.every((response) => response.venueId === responses[0]?.venueId)).toBe(true);
      expect(responses.every((response) => response.version === 1)).toBe(true);

      await database.withTenant(
        {
          organizationId: fixtureIds.organizationA,
          userId: adminId,
          requestId: `verify-concurrent-create-${unique}`,
          source: 'API',
        },
        async (transaction) => {
          const response = responses[0];
          expect(response).toBeDefined();
          if (response === undefined) {
            return;
          }
          const [venueCount, auditCount, outboxCount, idempotency] = await Promise.all([
            transaction.venue.count({ where: { name: input.name } }),
            transaction.auditEvent.count({
              where: { action: 'venue.created', targetId: response.venueId },
            }),
            transaction.outboxEvent.count({
              where: { eventType: 'venue.created', aggregateId: response.venueId },
            }),
            transaction.idempotencyRecord.findUnique({
              where: {
                organizationId_actorUserId_key: {
                  organizationId: fixtureIds.organizationA,
                  actorUserId: adminId,
                  key: context.idempotencyKey,
                },
              },
            }),
          ]);
          expect(venueCount).toBe(1);
          expect(auditCount).toBe(1);
          expect(outboxCount).toBe(1);
          expect(idempotency).toMatchObject({ responseStatus: 201 });
          expect(idempotency?.responseBody).toMatchObject({ venueId: response.venueId });
        },
      );
    } finally {
      await prisma.$disconnect();
    }
  });

  it('maps concurrent different-key updates from one version to one deterministic conflict', async () => {
    const { prisma, database } = testDatabase();
    try {
      const adminId = await userIdByEmail(prisma, 'admin@demo.invalid');
      const admin = actor(adminId, 'admin@demo.invalid');
      const access = new AccessService(database);
      const venues = new VenuesService(database, access, new MutationService(database, access));
      const unique = randomUUID();
      const venue = await venues.createVenue(
        mutationContext(fixtureIds.organizationA, admin, 'concurrent-update-fixture'),
        { name: `Concurrent Update Venue ${unique}` },
      );
      const renameContext = mutationContext(
        fixtureIds.organizationA,
        admin,
        'concurrent-update-rename',
      );
      const deactivateContext = mutationContext(
        fixtureIds.organizationA,
        admin,
        'concurrent-update-deactivate',
      );

      const outcomes = await Promise.allSettled([
        venues.updateVenue(renameContext, venue.venueId, {
          expectedVersion: venue.version,
          name: `Concurrent Update Winner ${unique}`,
        }),
        venues.updateVenue(deactivateContext, venue.venueId, {
          expectedVersion: venue.version,
          active: false,
        }),
      ]);
      const fulfilled = outcomes.filter(
        (outcome): outcome is PromiseFulfilledResult<typeof venue> =>
          outcome.status === 'fulfilled',
      );
      const rejected = outcomes.filter(
        (outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected',
      );
      expect(fulfilled).toHaveLength(1);
      expect(fulfilled[0]?.value.version).toBe(venue.version + 1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0]?.reason).toBeInstanceOf(VersionConflictError);

      await database.withTenant(
        {
          organizationId: fixtureIds.organizationA,
          userId: adminId,
          requestId: `verify-concurrent-update-${unique}`,
          source: 'API',
        },
        async (transaction) => {
          const [persisted, auditCount, outboxCount, idempotencyCount] = await Promise.all([
            transaction.venue.findUniqueOrThrow({
              where: {
                organizationId_id: {
                  organizationId: fixtureIds.organizationA,
                  id: venue.venueId,
                },
              },
            }),
            transaction.auditEvent.count({
              where: { action: 'venue.updated', targetId: venue.venueId },
            }),
            transaction.outboxEvent.count({
              where: { eventType: 'venue.updated', aggregateId: venue.venueId },
            }),
            transaction.idempotencyRecord.count({
              where: {
                organizationId: fixtureIds.organizationA,
                actorUserId: adminId,
                key: { in: [renameContext.idempotencyKey, deactivateContext.idempotencyKey] },
              },
            }),
          ]);
          expect(persisted.version).toBe(venue.version + 1);
          expect(auditCount).toBe(1);
          expect(outboxCount).toBe(1);
          expect(idempotencyCount).toBe(1);
        },
      );
    } finally {
      await prisma.$disconnect();
    }
  });

  it('returns stable duplicate, stale-version, idempotency, and validation conflicts', async () => {
    const { prisma, database } = testDatabase();
    try {
      const admin = actor(await userIdByEmail(prisma, 'admin@demo.invalid'), 'admin@demo.invalid');
      const access = new AccessService(database);
      const venues = new VenuesService(database, access, new MutationService(database, access));
      const unique = randomUUID();
      const venueContext = mutationContext(fixtureIds.organizationA, admin, 'conflict-venue');
      const venue = await venues.createVenue(venueContext, { name: `Conflict Venue ${unique}` });

      await expect(
        venues.createVenue(mutationContext(fixtureIds.organizationA, admin, 'duplicate-venue'), {
          name: venue.name,
        }),
      ).rejects.toMatchObject({ code: 'DUPLICATE_VENUE_NAME' });

      const fieldContext = mutationContext(fixtureIds.organizationA, admin, 'conflict-field');
      const field = await venues.createField(fieldContext, venue.venueId, { name: 'Field 1' });
      await expect(
        venues.createField(
          mutationContext(fixtureIds.organizationA, admin, 'duplicate-field'),
          venue.venueId,
          { name: field.name },
        ),
      ).rejects.toMatchObject({ code: 'DUPLICATE_FIELD_NAME' });

      const updated = await venues.updateField(
        mutationContext(fixtureIds.organizationA, admin, 'version-field'),
        venue.venueId,
        field.fieldId,
        { expectedVersion: field.version, hasLights: true },
      );
      expect(updated.version).toBe(field.version + 1);
      await expect(
        venues.updateField(
          mutationContext(fixtureIds.organizationA, admin, 'stale-field'),
          venue.venueId,
          field.fieldId,
          { expectedVersion: field.version, active: false },
        ),
      ).rejects.toBeInstanceOf(VersionConflictError);

      await expect(
        venues.createVenue(venueContext, { name: `Changed Conflict Venue ${unique}` }),
      ).rejects.toBeInstanceOf(IdempotencyConflictError);

      await expect(
        venues.updateVenue(
          mutationContext(fixtureIds.organizationA, admin, 'empty-venue-update'),
          venue.venueId,
          { expectedVersion: venue.version },
        ),
      ).rejects.toMatchObject({ name: 'ZodError' });

      expect(
        createFieldSchema.safeParse({ name: 'Too Short', fenceDistanceFeet: 99 }).success,
      ).toBe(false);
      expect(
        createFieldSchema.safeParse({ name: 'Fractional', fenceDistanceFeet: 300.5 }).success,
      ).toBe(false);

      await expect(
        database.withTenant(
          {
            organizationId: fixtureIds.organizationA,
            userId: admin.id,
            requestId: `database-fence-check-${unique}`,
            source: 'API',
          },
          async (transaction) =>
            transaction.field.create({
              data: {
                organizationId: fixtureIds.organizationA,
                venueId: venue.venueId,
                name: `Invalid DB Field ${unique}`,
                fenceDistanceFeet: 99,
              },
            }),
        ),
      ).rejects.toThrow();
    } finally {
      await prisma.$disconnect();
    }
  });

  it('denies restricted roles and hides cross-tenant facility identifiers', async () => {
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
      const venues = new VenuesService(database, access, new MutationService(database, access));

      await expect(
        venues.list(fixtureIds.organizationA, board, {
          requestId: `denied-${randomUUID()}`,
          source: 'WEB',
        }),
      ).rejects.toMatchObject({ code: 'AUTHORIZATION_DENIED' });

      const otherTenantVenue = await venues.createVenue(
        mutationContext(fixtureIds.organizationB, multi, 'other-tenant-venue'),
        { name: `Neighbor Venue ${randomUUID()}` },
      );
      const otherTenantField = await venues.createField(
        mutationContext(fixtureIds.organizationB, multi, 'other-tenant-field'),
        otherTenantVenue.venueId,
        { name: 'Neighbor Field' },
      );
      await expect(
        venues.updateVenue(
          mutationContext(fixtureIds.organizationA, admin, 'wrong-tenant-venue'),
          otherTenantVenue.venueId,
          { expectedVersion: otherTenantVenue.version, active: false },
        ),
      ).rejects.toBeInstanceOf(ResourceNotFoundError);
      await expect(
        venues.createField(
          mutationContext(fixtureIds.organizationA, admin, 'wrong-tenant-field'),
          otherTenantVenue.venueId,
          { name: 'Hidden Field' },
        ),
      ).rejects.toBeInstanceOf(ResourceNotFoundError);
      await expect(
        venues.updateField(
          mutationContext(fixtureIds.organizationA, admin, 'wrong-tenant-field-update'),
          otherTenantVenue.venueId,
          otherTenantField.fieldId,
          { expectedVersion: otherTenantField.version, active: false },
        ),
      ).rejects.toBeInstanceOf(ResourceNotFoundError);
    } finally {
      await prisma.$disconnect();
    }
  });
});
