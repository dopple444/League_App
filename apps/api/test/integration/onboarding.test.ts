import { createHmac, randomUUID } from 'node:crypto';

import {
  BetterAuthSessionResolver,
  createLeagueAuth,
  type AuthenticatedUser,
  type LeagueAuth,
} from '@league/auth';
import type { ProvisionPlatformOnboardingInput } from '@league/contracts';
import type { TenantDatabase, TenantTransaction } from '@league/database';
import {
  AuthorizationDeniedError,
  IdempotencyConflictError,
  leagueAdministratorPermissions,
  permissions,
  platformPermissions,
} from '@league/domain';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  DuplicateOrganizationSlugError,
  InvitationUnavailableError,
  InvitationNotRevocableError,
  MfaEnrollmentRequiredError,
  PlatformAccessDeniedError,
} from '../../src/common/errors.js';
import type { RequestMetadata } from '../../src/common/request.js';
import { AccessService } from '../../src/services/access.service.js';
import { InvitationTokenService } from '../../src/services/invitation-token.service.js';
import { OnboardingService } from '../../src/services/onboarding.service.js';
import { PlatformMutationService } from '../../src/services/platform-mutation.service.js';
import {
  databaseTestsEnabled,
  fixtureIds,
  testDatabase,
  userIdByEmail,
} from '../helpers/database.js';

const authOrigin = 'http://localhost:3001';
const authSecret = 'integration-only-better-auth-secret-000000000000';

function actor(
  id: string,
  email: string,
  twoFactorEnabled: boolean,
  name = 'Synthetic Onboarding Actor',
): AuthenticatedUser {
  return { id, email, name, twoFactorEnabled };
}

function metadata(operation: string): RequestMetadata {
  return { requestId: `${operation}-${randomUUID()}`, source: 'API' };
}

function provisionInput(
  suffix: string,
  administratorEmail = `administrator-${suffix}@example.invalid`,
): ProvisionPlatformOnboardingInput {
  return {
    organizationName: `Controlled Beta Organization ${suffix}`,
    organizationSlug: `controlled-beta-${suffix}`,
    timezone: 'America/New_York',
    leagueName: `Controlled Beta League ${suffix}`,
    leagueSlug: `league-${suffix}`,
    administratorEmail,
    invitationExpiresInHours: 48,
    reason: 'Focused controlled-beta onboarding integration verification.',
  };
}

function createOnboarding(
  prisma: ReturnType<typeof testDatabase>['prisma'],
  database: TenantDatabase,
) {
  const invitationAuth = createLeagueAuth({
    prisma,
    secret: authSecret,
    baseURL: authOrigin,
    trustedOrigins: [authOrigin],
    allowSignUp: true,
  });
  const tokens = new InvitationTokenService(authSecret);
  return {
    onboarding: new OnboardingService(
      database,
      prisma,
      invitationAuth,
      tokens,
      new PlatformMutationService(database),
    ),
    invitationAuth,
    tokens,
  };
}

async function withPlatformActor<TResult>(
  database: TenantDatabase,
  userId: string,
  operation: (transaction: TenantTransaction) => Promise<TResult>,
): Promise<TResult> {
  return database.withTenant(
    {
      organizationId: fixtureIds.organizationA,
      userId,
      requestId: `platform-test-${randomUUID()}`,
      source: 'API',
    },
    operation,
  );
}

async function unavailableSignature(operation: () => Promise<unknown>) {
  let caught: unknown;
  try {
    await operation();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(InvitationUnavailableError);
  const unavailable = caught as InvitationUnavailableError;
  return { code: unavailable.code, message: unavailable.message, name: unavailable.name };
}

async function errorSignature<TError extends Error>(
  operation: () => Promise<unknown>,
  expected: abstract new () => TError,
) {
  let caught: unknown;
  try {
    await operation();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(expected);
  const typed = caught as TError & { readonly code?: string };
  return { code: typed.code, message: typed.message, name: typed.name };
}

const requestAuth = (
  auth: ReturnType<typeof createLeagueAuth>,
  path: string,
  body: unknown,
  cookie?: string,
): Promise<Response> =>
  auth.handler(
    new Request(`${authOrigin}/api/auth${path}`, {
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        Origin: authOrigin,
        ...(cookie === undefined ? {} : { Cookie: cookie }),
      },
      method: 'POST',
    }),
  );

function responseCookies(response: Response): string {
  const values = (
    response.headers as Headers & {
      getSetCookie?: () => string[];
    }
  ).getSetCookie?.() ?? [response.headers.get('set-cookie') ?? ''];
  return values
    .filter(Boolean)
    .map((value) => value.split(';', 1)[0])
    .join('; ');
}

function decodeBase32(encoded: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const character of encoded.replaceAll('=', '').toUpperCase()) {
    const value = alphabet.indexOf(character);
    if (value < 0) throw new Error('Unexpected Base32 character in generated TOTP secret.');
    bits += value.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }
  return Buffer.from(bytes);
}

function currentTotp(secret: string): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1_000 / 30)));
  const digest = createHmac('sha1', decodeBase32(secret)).update(counter).digest();
  const offset = (digest.at(-1) ?? 0) & 0x0f;
  const binary = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return binary.toString().padStart(6, '0');
}

describe.skipIf(!databaseTestsEnabled)('controlled-beta onboarding API service', () => {
  it('requires MFA and an effective platform grant before platform reads or writes', async () => {
    const { prisma, database } = testDatabase();
    try {
      const operatorId = await userIdByEmail(prisma, 'operator@demo.invalid');
      const administratorId = await userIdByEmail(prisma, 'admin@demo.invalid');
      const operatorWithoutMfa = actor(operatorId, 'operator@demo.invalid', false);
      const administrator = actor(administratorId, 'admin@demo.invalid', true);
      const { onboarding } = createOnboarding(prisma, database);
      const mfaKey = `mfa-denied-${randomUUID()}`;
      const accessKey = `platform-denied-${randomUUID()}`;

      await expect(
        onboarding.provision(
          {
            user: operatorWithoutMfa,
            idempotencyKey: mfaKey,
            metadata: metadata('mfa-denied'),
          },
          provisionInput(randomUUID()),
        ),
      ).rejects.toBeInstanceOf(MfaEnrollmentRequiredError);
      await expect(onboarding.listPlatformOnboarding(operatorWithoutMfa)).rejects.toBeInstanceOf(
        MfaEnrollmentRequiredError,
      );

      await expect(
        onboarding.provision(
          {
            user: administrator,
            idempotencyKey: accessKey,
            metadata: metadata('platform-denied'),
          },
          provisionInput(randomUUID()),
        ),
      ).rejects.toBeInstanceOf(PlatformAccessDeniedError);
      await expect(onboarding.listPlatformOnboarding(administrator)).rejects.toBeInstanceOf(
        PlatformAccessDeniedError,
      );

      await expect(
        withPlatformActor(database, operatorId, (transaction) =>
          transaction.platformIdempotencyRecord.count({
            where: { actorUserId: operatorId, key: mfaKey },
          }),
        ),
      ).resolves.toBe(0);
      await expect(
        withPlatformActor(database, administratorId, (transaction) =>
          transaction.platformIdempotencyRecord.count({
            where: { actorUserId: administratorId, key: accessKey },
          }),
        ),
      ).resolves.toBe(0);

      // Runtime callers have no table-level grant enumeration path. The scoped helper remains
      // usable by platform services after the SELECT grant was revoked.
      await expect(prisma.platformPermissionGrant.findMany()).rejects.toThrow();
      await expect(database.hasPlatformPermission(operatorId, 'TENANT_PROVISION')).resolves.toBe(
        true,
      );
      await expect(
        database.hasPlatformPermission(administratorId, 'TENANT_PROVISION'),
      ).resolves.toBe(false);
      await expect(onboarding.securityPosture(operatorWithoutMfa)).resolves.toMatchObject({
        mfaEnabled: false,
        mfaRequired: true,
        platformAccess: true,
        pendingActivation: false,
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  it('checks revoke assurance and authority before resolution, then serializes revoke races', async () => {
    const { prisma, database } = testDatabase();
    try {
      const operatorId = await userIdByEmail(prisma, 'operator@demo.invalid');
      const administratorId = await userIdByEmail(prisma, 'admin@demo.invalid');
      const operator = actor(operatorId, 'operator@demo.invalid', true, 'Platform Operator');
      const operatorWithoutMfa = { ...operator, twoFactorEnabled: false };
      const administrator = actor(administratorId, 'admin@demo.invalid', true);
      const { onboarding } = createOnboarding(prisma, database);
      const suffix = randomUUID();
      const existing = await onboarding.provision(
        {
          user: operator,
          idempotencyKey: `revoke-precheck-fixture-${suffix}`,
          metadata: metadata('revoke-precheck-fixture'),
        },
        provisionInput(randomUUID()),
      );
      const unknownInvitationId = randomUUID();
      const revokeInput = {
        expectedVersion: 1,
        reason: 'Focused revoke authorization verification.',
      };

      const mfaKeys = [`revoke-mfa-existing-${suffix}`, `revoke-mfa-unknown-${suffix}`];
      const mfaExisting = await errorSignature(
        () =>
          onboarding.revoke(
            {
              user: operatorWithoutMfa,
              idempotencyKey: mfaKeys[0] ?? '',
              metadata: metadata('revoke-mfa-existing'),
            },
            existing.invitationId,
            revokeInput,
          ),
        MfaEnrollmentRequiredError,
      );
      const mfaUnknown = await errorSignature(
        () =>
          onboarding.revoke(
            {
              user: operatorWithoutMfa,
              idempotencyKey: mfaKeys[1] ?? '',
              metadata: metadata('revoke-mfa-unknown'),
            },
            unknownInvitationId,
            revokeInput,
          ),
        MfaEnrollmentRequiredError,
      );
      expect(mfaUnknown).toEqual(mfaExisting);

      const deniedKeys = [`revoke-denied-existing-${suffix}`, `revoke-denied-unknown-${suffix}`];
      const deniedExisting = await errorSignature(
        () =>
          onboarding.revoke(
            {
              user: administrator,
              idempotencyKey: deniedKeys[0] ?? '',
              metadata: metadata('revoke-denied-existing'),
            },
            existing.invitationId,
            revokeInput,
          ),
        PlatformAccessDeniedError,
      );
      const deniedUnknown = await errorSignature(
        () =>
          onboarding.revoke(
            {
              user: administrator,
              idempotencyKey: deniedKeys[1] ?? '',
              metadata: metadata('revoke-denied-unknown'),
            },
            unknownInvitationId,
            revokeInput,
          ),
        PlatformAccessDeniedError,
      );
      expect(deniedUnknown).toEqual(deniedExisting);
      await expect(
        withPlatformActor(database, operatorId, (transaction) =>
          transaction.platformIdempotencyRecord.count({
            where: { key: { in: mfaKeys } },
          }),
        ),
      ).resolves.toBe(0);
      await expect(
        withPlatformActor(database, administratorId, (transaction) =>
          transaction.platformIdempotencyRecord.count({
            where: { key: { in: deniedKeys } },
          }),
        ),
      ).resolves.toBe(0);

      const raced = await onboarding.provision(
        {
          user: operator,
          idempotencyKey: `revoke-race-fixture-${suffix}`,
          metadata: metadata('revoke-race-fixture'),
        },
        provisionInput(randomUUID()),
      );
      const raceKeys = [`revoke-race-a-${suffix}`, `revoke-race-b-${suffix}`] as const;
      const raceContexts = raceKeys.map((idempotencyKey) => ({
        user: operator,
        idempotencyKey,
        metadata: metadata(idempotencyKey),
      }));
      const raceResults = await Promise.allSettled(
        raceContexts.map((context) =>
          onboarding.revoke(context, raced.invitationId, {
            expectedVersion: raced.version,
            reason: 'Concurrent revoke winner verification.',
          }),
        ),
      );
      const winningIndex = raceResults.findIndex((result) => result.status === 'fulfilled');
      const losingResults = raceResults.filter((result) => result.status === 'rejected');
      expect(winningIndex).toBeGreaterThanOrEqual(0);
      expect(losingResults).toHaveLength(1);
      expect(losingResults[0]).toMatchObject({
        status: 'rejected',
        reason: expect.any(InvitationNotRevocableError),
      });
      const winningContext = raceContexts[winningIndex];
      const winningResult = raceResults[winningIndex];
      if (winningContext === undefined || winningResult?.status !== 'fulfilled') {
        throw new Error('Concurrent revoke did not produce exactly one winner.');
      }
      await expect(
        onboarding.revoke(winningContext, raced.invitationId, {
          expectedVersion: raced.version,
          reason: 'Concurrent revoke winner verification.',
        }),
      ).resolves.toEqual(winningResult.value);
      await expect(
        onboarding.revoke(winningContext, raced.invitationId, {
          expectedVersion: raced.version,
          reason: 'Changed reason must conflict on replay.',
        }),
      ).rejects.toBeInstanceOf(IdempotencyConflictError);

      const platformState = await withPlatformActor(database, operatorId, async (transaction) => ({
        idempotency: await transaction.platformIdempotencyRecord.count({
          where: { key: { in: [...raceKeys] } },
        }),
        audit: await transaction.platformAuditEvent.count({
          where: {
            action: 'controlled_beta.invitation.revoked',
            targetId: raced.invitationId,
          },
        }),
      }));
      expect(platformState).toEqual({ idempotency: 1, audit: 1 });
      await database.withTenant(
        {
          organizationId: raced.organizationId,
          userId: operatorId,
          requestId: `verify-revoke-race-${suffix}`,
          source: 'API',
        },
        async (transaction) => {
          const [invitation, audits, outbox] = await Promise.all([
            transaction.administratorInvitation.findUniqueOrThrow({
              where: {
                organizationId_id: {
                  organizationId: raced.organizationId,
                  id: raced.invitationId,
                },
              },
            }),
            transaction.auditEvent.count({
              where: {
                action: 'administrator_invitation.revoked',
                targetId: raced.invitationId,
              },
            }),
            transaction.outboxEvent.count({
              where: {
                eventType: 'administrator_invitation.revoked',
                aggregateId: raced.invitationId,
              },
            }),
          ]);
          expect(invitation).toMatchObject({ version: 2, revokedAt: expect.any(Date) });
          expect(audits).toBe(1);
          expect(outbox).toBe(1);
        },
      );
    } finally {
      await prisma.$disconnect();
    }
  });

  it('provisions atomically, replays exactly, and never persists the copy-once bearer', async () => {
    const { prisma, database } = testDatabase();
    try {
      const operatorId = await userIdByEmail(prisma, 'operator@demo.invalid');
      const administratorId = await userIdByEmail(prisma, 'admin@demo.invalid');
      const operator = actor(operatorId, 'operator@demo.invalid', true, 'Platform Operator');
      const { onboarding, tokens } = createOnboarding(prisma, database);
      const suffix = randomUUID();
      const input = provisionInput(suffix);
      const idempotencyKey = `provision-${suffix}`;
      const request = metadata('provision');
      const context = { user: operator, idempotencyKey, metadata: request };

      const provisioned = await onboarding.provision(context, input);
      await expect(onboarding.provision(context, input)).resolves.toEqual(provisioned);
      await expect(
        onboarding.provision(context, { ...input, leagueName: `${input.leagueName} changed` }),
      ).rejects.toBeInstanceOf(IdempotencyConflictError);
      expect(provisioned).toMatchObject({
        organizationName: input.organizationName,
        organizationSlug: input.organizationSlug,
        leagueName: input.leagueName,
        leagueSlug: input.leagueSlug,
        administratorEmail: input.administratorEmail,
        status: 'PENDING',
        version: 1,
      });
      expect(provisioned.invitationToken).toHaveLength(43);

      const platformState = await withPlatformActor(database, operatorId, async (transaction) => {
        const [idempotency, audits] = await Promise.all([
          transaction.platformIdempotencyRecord.findMany({
            where: { actorUserId: operatorId, key: idempotencyKey },
          }),
          transaction.platformAuditEvent.findMany({
            where: {
              actorUserId: operatorId,
              action: 'controlled_beta.organization.provisioned',
              targetId: provisioned.organizationId,
            },
          }),
        ]);
        return { idempotency, audits };
      });
      expect(platformState.idempotency).toHaveLength(1);
      expect(platformState.audits).toHaveLength(1);
      const platformIdempotency = platformState.idempotency[0];
      const platformAudit = platformState.audits[0];
      if (platformIdempotency === undefined || platformAudit === undefined) {
        throw new Error('Provisioning did not create its platform control records.');
      }
      expect(platformIdempotency.responseStatus).toBe(201);
      expect(platformIdempotency.responseBody).not.toHaveProperty('invitationToken');
      expect(JSON.stringify(platformState)).not.toContain(provisioned.invitationToken);

      await database.withTenant(
        {
          organizationId: provisioned.organizationId,
          userId: operatorId,
          requestId: `verify-provision-${suffix}`,
          source: 'API',
        },
        async (transaction) => {
          const [organization, league, role, invitation, memberships, audits, outbox] =
            await Promise.all([
              transaction.organization.findUniqueOrThrow({
                where: { organizationId: provisioned.organizationId },
              }),
              transaction.league.findUniqueOrThrow({
                where: {
                  organizationId_id: {
                    organizationId: provisioned.organizationId,
                    id: provisioned.leagueId,
                  },
                },
              }),
              transaction.role.findUniqueOrThrow({
                where: {
                  organizationId_key: {
                    organizationId: provisioned.organizationId,
                    key: 'league-administrator',
                  },
                },
                include: { permissions: true },
              }),
              transaction.administratorInvitation.findUniqueOrThrow({
                where: { tokenDigest: tokens.digest(provisioned.invitationToken) },
              }),
              transaction.organizationMembership.findMany({
                where: { userId: operatorId },
              }),
              transaction.auditEvent.findMany({
                where: { action: 'organization.provisioned', targetId: provisioned.organizationId },
              }),
              transaction.outboxEvent.findMany({
                where: {
                  eventType: 'organization.provisioned',
                  aggregateId: provisioned.organizationId,
                },
              }),
            ]);
          expect(organization).toMatchObject({
            name: input.organizationName,
            slug: input.organizationSlug,
            timezone: input.timezone,
          });
          expect(league).toMatchObject({
            name: input.leagueName,
            slug: input.leagueSlug,
            active: true,
          });
          expect(role.authorityKind).toBe('OPERATIONS');
          expect(role.permissions.map((entry) => entry.permission).sort()).toEqual(
            [...leagueAdministratorPermissions].sort(),
          );
          expect(invitation).toMatchObject({
            id: provisioned.invitationId,
            emailNormalized: input.administratorEmail,
            tokenDigest: tokens.digest(provisioned.invitationToken),
            version: 1,
            acceptedAt: null,
            revokedAt: null,
            activatedAt: null,
          });
          expect(invitation.tokenDigest).not.toBe(provisioned.invitationToken);
          expect(memberships).toEqual([]);
          expect(audits).toHaveLength(1);
          expect(outbox).toHaveLength(1);
          expect(JSON.stringify({ audits, outbox })).not.toContain(provisioned.invitationToken);
          expect(JSON.stringify({ audits, outbox })).not.toContain(input.administratorEmail);
        },
      );

      const list = await onboarding.listPlatformOnboarding(operator);
      expect(list).toMatchObject({
        canProvisionTenants: true,
        canRevokeInvitations: true,
      });
      const listed = list.items.find((item) => item.invitationId === provisioned.invitationId);
      expect(listed).toMatchObject({
        status: 'PENDING',
        administratorEmail: input.administratorEmail,
      });
      expect(listed).not.toHaveProperty('invitationToken');

      const failedKey = `duplicate-slug-${suffix}`;
      const failedRequest = metadata('duplicate-slug');
      await expect(
        onboarding.provision(
          { user: operator, idempotencyKey: failedKey, metadata: failedRequest },
          {
            ...provisionInput(randomUUID()),
            organizationSlug: input.organizationSlug,
          },
        ),
      ).rejects.toBeInstanceOf(DuplicateOrganizationSlugError);

      const failedPlatformState = await withPlatformActor(
        database,
        operatorId,
        async (transaction) => ({
          idempotency: await transaction.platformIdempotencyRecord.count({
            where: { actorUserId: operatorId, key: failedKey },
          }),
          audit: await transaction.platformAuditEvent.count({
            where: { actorUserId: operatorId, requestId: failedRequest.requestId },
          }),
        }),
      );
      expect(failedPlatformState).toEqual({ idempotency: 0, audit: 0 });
      expect(
        (await onboarding.listPlatformOnboarding(operator)).items.filter(
          (item) => item.organizationSlug === input.organizationSlug,
        ),
      ).toHaveLength(1);

      // A different authenticated actor cannot enumerate or alter the operator's global rows.
      await expect(
        withPlatformActor(database, administratorId, async (transaction) => ({
          idempotency: await transaction.platformIdempotencyRecord.findFirst({
            where: { id: platformIdempotency.id },
          }),
          audit: await transaction.platformAuditEvent.findFirst({
            where: { id: platformAudit.id },
          }),
          changed: await transaction.platformIdempotencyRecord.updateMany({
            where: { id: platformIdempotency.id },
            data: { responseStatus: 418 },
          }),
        })),
      ).resolves.toEqual({ idempotency: null, audit: null, changed: { count: 0 } });
      await expect(
        withPlatformActor(database, operatorId, (transaction) =>
          transaction.platformIdempotencyRecord.findUniqueOrThrow({
            where: { id: platformIdempotency.id },
          }),
        ),
      ).resolves.toMatchObject({ responseStatus: 201 });
    } finally {
      await prisma.$disconnect();
    }
  });

  it('serializes concurrent provision replays and rolls back a late platform operation failure', async () => {
    const { prisma, database } = testDatabase();
    try {
      const operatorId = await userIdByEmail(prisma, 'operator@demo.invalid');
      const operator = actor(operatorId, 'operator@demo.invalid', true, 'Platform Operator');
      const { onboarding } = createOnboarding(prisma, database);
      const suffix = randomUUID();
      const input = provisionInput(suffix);
      const concurrentKey = `concurrent-provision-${suffix}`;
      const context = {
        user: operator,
        idempotencyKey: concurrentKey,
        metadata: metadata('concurrent-provision'),
      };

      const [left, right] = await Promise.all([
        onboarding.provision(context, input),
        onboarding.provision(context, input),
      ]);
      expect(right).toEqual(left);
      const platformState = await withPlatformActor(database, operatorId, async (transaction) => ({
        idempotency: await transaction.platformIdempotencyRecord.count({
          where: { key: concurrentKey },
        }),
        audit: await transaction.platformAuditEvent.count({
          where: {
            action: 'controlled_beta.organization.provisioned',
            targetId: left.organizationId,
          },
        }),
      }));
      expect(platformState).toEqual({ idempotency: 1, audit: 1 });
      expect(
        (await onboarding.listPlatformOnboarding(operator)).items.filter(
          (item) => item.organizationSlug === input.organizationSlug,
        ),
      ).toHaveLength(1);
      await database.withTenant(
        {
          organizationId: left.organizationId,
          userId: operatorId,
          requestId: `verify-concurrent-provision-${suffix}`,
          source: 'API',
        },
        async (transaction) => {
          await expect(
            transaction.auditEvent.count({
              where: { action: 'organization.provisioned', targetId: left.organizationId },
            }),
          ).resolves.toBe(1);
          await expect(
            transaction.outboxEvent.count({
              where: { eventType: 'organization.provisioned', aggregateId: left.organizationId },
            }),
          ).resolves.toBe(1);
        },
      );

      const rollbackOrganizationId = randomUUID();
      const rollbackKey = `late-rollback-${suffix}`;
      const rollbackMetadata = metadata('late-rollback');
      const platformMutations = new PlatformMutationService(database);
      await expect(
        platformMutations.execute({
          context: {
            organizationId: rollbackOrganizationId,
            user: operator,
            idempotencyKey: rollbackKey,
            metadata: rollbackMetadata,
          },
          permission: platformPermissions.tenantProvision,
          fingerprintPayload: { operation: 'integration.late-rollback', rollbackOrganizationId },
          responseSchema: z.object({ completed: z.literal(true) }).strict(),
          operation: async (transaction) => {
            await transaction.organization.create({
              data: {
                organizationId: rollbackOrganizationId,
                name: `Late Rollback ${suffix}`,
                slug: `late-rollback-${suffix}`,
                timezone: 'America/New_York',
              },
            });
            await transaction.platformAuditEvent.create({
              data: {
                actorUserId: operatorId,
                action: 'integration.late_rollback',
                targetType: 'Organization',
                targetId: rollbackOrganizationId,
                reason: 'This event must roll back with the forced late failure.',
                requestId: rollbackMetadata.requestId,
                source: rollbackMetadata.source,
              },
            });
            await transaction.auditEvent.create({
              data: {
                organizationId: rollbackOrganizationId,
                actorUserId: operatorId,
                action: 'integration.late_rollback',
                targetType: 'Organization',
                targetId: rollbackOrganizationId,
                reason: 'This event must roll back with the forced late failure.',
                requestId: rollbackMetadata.requestId,
                source: rollbackMetadata.source,
              },
            });
            await transaction.outboxEvent.create({
              data: {
                organizationId: rollbackOrganizationId,
                eventType: 'integration.late_rollback',
                aggregateType: 'Organization',
                aggregateId: rollbackOrganizationId,
                payload: { rollbackOrganizationId },
                requestId: rollbackMetadata.requestId,
              },
            });
            throw new Error('forced late platform operation failure');
          },
        }),
      ).rejects.toThrow('forced late platform operation failure');

      await expect(
        withPlatformActor(database, operatorId, async (transaction) => ({
          idempotency: await transaction.platformIdempotencyRecord.count({
            where: { key: rollbackKey },
          }),
          audit: await transaction.platformAuditEvent.count({
            where: { requestId: rollbackMetadata.requestId },
          }),
        })),
      ).resolves.toEqual({ idempotency: 0, audit: 0 });
      await database.withTenant(
        {
          organizationId: rollbackOrganizationId,
          userId: operatorId,
          requestId: `verify-late-rollback-${suffix}`,
          source: 'API',
        },
        async (transaction) => {
          await expect(
            transaction.organization.count({
              where: { organizationId: rollbackOrganizationId },
            }),
          ).resolves.toBe(0);
          await expect(
            transaction.auditEvent.count({ where: { requestId: rollbackMetadata.requestId } }),
          ).resolves.toBe(0);
          await expect(
            transaction.outboxEvent.count({ where: { requestId: rollbackMetadata.requestId } }),
          ).resolves.toBe(0);
        },
      );
    } finally {
      await prisma.$disconnect();
    }
  });

  it('recovers interrupted invitation signup cleanup without changing verified identities', async () => {
    const { prisma, database } = testDatabase();
    try {
      const operatorId = await userIdByEmail(prisma, 'operator@demo.invalid');
      const operator = actor(operatorId, 'operator@demo.invalid', true, 'Platform Operator');
      const { onboarding, invitationAuth, tokens } = createOnboarding(prisma, database);
      const suffix = randomUUID();
      const recoveryEmail = `registration-recovery-${suffix}@example.invalid`;
      const recoveryPassword = `Recovery-${suffix}-Password`;
      const recoveryInvitation = await onboarding.provision(
        {
          user: operator,
          idempotencyKey: `registration-recovery-${suffix}`,
          metadata: metadata('registration-recovery'),
        },
        provisionInput(randomUUID(), recoveryEmail),
      );

      await invitationAuth.api.signUpEmail({
        body: {
          email: recoveryEmail,
          name: 'Interrupted Invitation Identity',
          password: recoveryPassword,
        },
      });
      const interrupted = await prisma.user.findUniqueOrThrow({
        where: { email: recoveryEmail },
      });
      const passwordBeforeRecovery = await prisma.account.findFirstOrThrow({
        where: { userId: interrupted.id, providerId: 'credential' },
        select: { password: true },
      });
      expect(interrupted.emailVerified).toBe(false);
      await expect(prisma.session.count({ where: { userId: interrupted.id } })).resolves.toBe(1);

      await expect(
        onboarding.register(
          {
            invitationToken: recoveryInvitation.invitationToken,
            name: 'Must Not Replace Existing Name',
            password: `Changed-${suffix}-Password`,
          },
          metadata('recover-registration'),
        ),
      ).resolves.toEqual({ continueToSignIn: true });
      await expect(
        prisma.user.findUniqueOrThrow({ where: { id: interrupted.id } }),
      ).resolves.toMatchObject({
        name: 'Interrupted Invitation Identity',
        emailVerified: true,
      });
      await expect(prisma.session.count({ where: { userId: interrupted.id } })).resolves.toBe(0);
      await expect(
        prisma.account.findFirstOrThrow({
          where: { userId: interrupted.id, providerId: 'credential' },
          select: { password: true },
        }),
      ).resolves.toEqual(passwordBeforeRecovery);

      const preservedSession = await prisma.session.create({
        data: {
          userId: interrupted.id,
          token: `verified-registration-${randomUUID()}`,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      await expect(
        onboarding.register(
          {
            invitationToken: recoveryInvitation.invitationToken,
            name: 'Still Must Not Replace Existing Name',
            password: `Another-${suffix}-Password`,
          },
          metadata('retry-registration'),
        ),
      ).resolves.toEqual({ continueToSignIn: true });
      await expect(
        prisma.session.findUnique({ where: { id: preservedSession.id } }),
      ).resolves.toMatchObject({ id: preservedSession.id, userId: interrupted.id });
      await expect(
        prisma.account.findFirstOrThrow({
          where: { userId: interrupted.id, providerId: 'credential' },
          select: { password: true },
        }),
      ).resolves.toEqual(passwordBeforeRecovery);

      const verifiedRaceEmail = `registration-verified-race-${suffix}@example.invalid`;
      const verifiedRaceInvitation = await onboarding.provision(
        {
          user: operator,
          idempotencyKey: `registration-verified-race-${suffix}`,
          metadata: metadata('registration-verified-race'),
        },
        provisionInput(randomUUID(), verifiedRaceEmail),
      );
      const verifiedRaceAuth: LeagueAuth = {
        ...invitationAuth,
        api: {
          ...invitationAuth.api,
          signUpEmail: async (registration) => {
            const result = await invitationAuth.api.signUpEmail(registration);
            await prisma.user.update({
              where: { email: verifiedRaceEmail },
              data: { emailVerified: true },
            });
            return result;
          },
        },
      };
      const raceOnboarding = new OnboardingService(
        database,
        prisma,
        verifiedRaceAuth,
        tokens,
        new PlatformMutationService(database),
      );
      await expect(
        raceOnboarding.register(
          {
            invitationToken: verifiedRaceInvitation.invitationToken,
            name: 'Verified During Invitation Signup',
            password: `Verified-Race-${suffix}-Password`,
          },
          metadata('verified-race-registration'),
        ),
      ).resolves.toEqual({ continueToSignIn: true });
      const verifiedRaceIdentity = await prisma.user.findUniqueOrThrow({
        where: { email: verifiedRaceEmail },
      });
      expect(verifiedRaceIdentity.emailVerified).toBe(true);
      await expect(
        prisma.session.count({ where: { userId: verifiedRaceIdentity.id } }),
      ).resolves.toBe(0);
    } finally {
      await prisma.$disconnect();
    }
  });

  it('binds invitation identity, keeps PENDING authority hidden, and activates only after MFA', async () => {
    const { prisma, database } = testDatabase();
    try {
      const operatorId = await userIdByEmail(prisma, 'operator@demo.invalid');
      const wrongAddressId = await userIdByEmail(prisma, 'admin@demo.invalid');
      const operator = actor(operatorId, 'operator@demo.invalid', true, 'Platform Operator');
      const wrongAddress = actor(wrongAddressId, 'admin@demo.invalid', true);
      const { onboarding, invitationAuth } = createOnboarding(prisma, database);
      const access = new AccessService(database);
      const suffix = randomUUID();
      const invitedEmail = `invited-${suffix}@example.invalid`;
      const input = provisionInput(suffix, invitedEmail);
      const acceptedInvitation = await onboarding.provision(
        {
          user: operator,
          idempotencyKey: `accept-flow-${suffix}`,
          metadata: metadata('accept-flow'),
        },
        input,
      );

      const invalid = await unavailableSignature(() =>
        onboarding.inspect('x'.repeat(43), metadata('invalid-invitation')),
      );

      const revoked = await onboarding.provision(
        {
          user: operator,
          idempotencyKey: `revoked-provision-${suffix}`,
          metadata: metadata('revoked-provision'),
        },
        provisionInput(randomUUID()),
      );
      await onboarding.revoke(
        {
          user: operator,
          idempotencyKey: `revoke-${suffix}`,
          metadata: metadata('revoke'),
        },
        revoked.invitationId,
        { expectedVersion: revoked.version, reason: 'Invitation revoked by integration test.' },
      );
      const revokedSignature = await unavailableSignature(() =>
        onboarding.inspect(revoked.invitationToken, metadata('revoked-invitation')),
      );

      const expired = await onboarding.provision(
        {
          user: operator,
          idempotencyKey: `expired-provision-${suffix}`,
          metadata: metadata('expired-provision'),
        },
        provisionInput(randomUUID()),
      );
      await database.withTenant(
        {
          organizationId: expired.organizationId,
          userId: operatorId,
          requestId: `expire-${suffix}`,
          source: 'API',
        },
        (transaction) =>
          transaction.administratorInvitation.update({
            where: {
              organizationId_id: {
                organizationId: expired.organizationId,
                id: expired.invitationId,
              },
            },
            data: {
              createdAt: new Date(Date.now() - 120_000),
              expiresAt: new Date(Date.now() - 60_000),
            },
          }),
      );
      const expiredSignature = await unavailableSignature(() =>
        onboarding.inspect(expired.invitationToken, metadata('expired-invitation')),
      );
      expect(revokedSignature).toEqual(invalid);
      expect(expiredSignature).toEqual(invalid);

      await expect(
        onboarding.inspect(acceptedInvitation.invitationToken, metadata('inspect-invitation')),
      ).resolves.toMatchObject({
        organizationName: input.organizationName,
        leagueName: input.leagueName,
        administratorEmailHint: expect.stringContaining('@example.invalid'),
      });

      const wrongAddressKey = `wrong-address-${suffix}`;
      expect(
        await unavailableSignature(() =>
          onboarding.accept(wrongAddress, metadata('wrong-address'), wrongAddressKey, {
            invitationToken: acceptedInvitation.invitationToken,
          }),
        ),
      ).toEqual(invalid);
      await database.withTenant(
        {
          organizationId: acceptedInvitation.organizationId,
          userId: operatorId,
          requestId: `verify-wrong-address-${suffix}`,
          source: 'API',
        },
        async (transaction) => {
          await expect(
            transaction.organizationMembership.findUnique({
              where: {
                organizationId_userId: {
                  organizationId: acceptedInvitation.organizationId,
                  userId: wrongAddressId,
                },
              },
            }),
          ).resolves.toBeNull();
          await expect(
            transaction.idempotencyRecord.count({ where: { key: wrongAddressKey } }),
          ).resolves.toBe(0);
        },
      );

      const password = `Invitation-${suffix}-Password`;
      await expect(
        onboarding.register(
          {
            invitationToken: acceptedInvitation.invitationToken,
            name: 'Invited Administrator',
            password,
          },
          metadata('register-invitation'),
        ),
      ).resolves.toEqual({ continueToSignIn: true });
      const identity = await prisma.user.findUniqueOrThrow({ where: { email: invitedEmail } });
      expect(identity.emailVerified).toBe(true);
      expect(identity.twoFactorEnabled).toBe(false);
      await expect(prisma.session.count({ where: { userId: identity.id } })).resolves.toBe(0);

      const signIn = await requestAuth(invitationAuth, '/sign-in/email', {
        email: invitedEmail,
        password,
      });
      expect(signIn.status).toBe(200);
      const preEnrollmentCookie = responseCookies(signIn);
      expect(preEnrollmentCookie).toContain('session_token');
      const resolver = new BetterAuthSessionResolver(invitationAuth);
      const inviteeWithoutMfa = await resolver.resolve(
        new Headers({ Cookie: preEnrollmentCookie }),
      );
      if (inviteeWithoutMfa === null) {
        throw new Error('Invitation sign-in did not produce an authenticated session.');
      }
      expect(inviteeWithoutMfa).toMatchObject({
        id: identity.id,
        email: invitedEmail,
        twoFactorEnabled: false,
      });

      const acceptanceKeys = [`accept-a-${suffix}`, `accept-b-${suffix}`] as const;
      const acceptanceContexts = acceptanceKeys.map((idempotencyKey) => ({
        idempotencyKey,
        metadata: metadata(idempotencyKey),
      }));
      const acceptanceResults = await Promise.allSettled(
        acceptanceContexts.map((context) =>
          onboarding.accept(inviteeWithoutMfa, context.metadata, context.idempotencyKey, {
            invitationToken: acceptedInvitation.invitationToken,
          }),
        ),
      );
      const acceptanceWinnerIndex = acceptanceResults.findIndex(
        (result) => result.status === 'fulfilled',
      );
      const acceptanceLosers = acceptanceResults.filter((result) => result.status === 'rejected');
      expect(acceptanceWinnerIndex).toBeGreaterThanOrEqual(0);
      expect(acceptanceLosers).toHaveLength(1);
      expect(acceptanceLosers[0]).toMatchObject({
        status: 'rejected',
        reason: expect.any(InvitationUnavailableError),
      });
      const acceptanceWinner = acceptanceResults[acceptanceWinnerIndex];
      const acceptanceContext = acceptanceContexts[acceptanceWinnerIndex];
      if (acceptanceWinner?.status !== 'fulfilled' || acceptanceContext === undefined) {
        throw new Error('Concurrent acceptance did not produce exactly one winner.');
      }
      const acceptance = acceptanceWinner.value;
      await expect(
        onboarding.accept(
          inviteeWithoutMfa,
          acceptanceContext.metadata,
          acceptanceContext.idempotencyKey,
          {
            invitationToken: acceptedInvitation.invitationToken,
          },
        ),
      ).resolves.toEqual(acceptance);
      expect(acceptance).toMatchObject({
        accepted: true,
        membershipStatus: 'PENDING',
        mfaRequired: true,
      });
      expect(Object.keys(acceptance).sort()).toEqual([
        'accepted',
        'acceptedAt',
        'membershipStatus',
        'mfaRequired',
      ]);
      expect(
        await unavailableSignature(() =>
          onboarding.inspect(acceptedInvitation.invitationToken, metadata('accepted-invitation')),
        ),
      ).toEqual(invalid);
      await database.withTenant(
        {
          organizationId: acceptedInvitation.organizationId,
          userId: identity.id,
          requestId: `verify-acceptance-race-${suffix}`,
          source: 'API',
        },
        async (transaction) => {
          await expect(
            transaction.idempotencyRecord.count({
              where: { actorUserId: identity.id, key: { in: [...acceptanceKeys] } },
            }),
          ).resolves.toBe(1);
          await expect(
            transaction.organizationMembership.count({ where: { userId: identity.id } }),
          ).resolves.toBe(1);
          await expect(
            transaction.auditEvent.count({
              where: { action: 'administrator_invitation.accepted', actorUserId: identity.id },
            }),
          ).resolves.toBe(1);
          await expect(
            transaction.outboxEvent.count({
              where: {
                eventType: 'administrator_invitation.accepted',
                aggregateId: acceptedInvitation.invitationId,
              },
            }),
          ).resolves.toBe(1);
        },
      );

      await expect(
        access.listOrganizations(inviteeWithoutMfa, metadata('pending-organizations')),
      ).resolves.toEqual({ items: [] });
      await expect(
        database.withTenant(
          {
            organizationId: acceptedInvitation.organizationId,
            userId: identity.id,
            requestId: `pending-authority-${suffix}`,
            source: 'API',
          },
          (transaction) =>
            access.assertPermission(
              transaction,
              acceptedInvitation.organizationId,
              identity.id,
              permissions.leagueRead,
            ),
        ),
      ).rejects.toBeInstanceOf(AuthorizationDeniedError);
      await expect(onboarding.securityPosture(inviteeWithoutMfa)).resolves.toMatchObject({
        mfaEnabled: false,
        mfaRequired: true,
        platformAccess: false,
        pendingActivation: true,
      });
      await expect(
        onboarding.activate(inviteeWithoutMfa, metadata('activation-without-mfa')),
      ).rejects.toBeInstanceOf(MfaEnrollmentRequiredError);

      const enable = await requestAuth(
        invitationAuth,
        '/two-factor/enable',
        { password },
        preEnrollmentCookie,
      );
      expect(enable.status).toBe(200);
      const enrollment = (await enable.json()) as { totpURI: string };
      const totpSecret = new URL(enrollment.totpURI).searchParams.get('secret');
      expect(totpSecret).toBeTruthy();
      const verifyEnrollment = await requestAuth(
        invitationAuth,
        '/two-factor/verify-totp',
        { code: currentTotp(totpSecret ?? ''), trustDevice: false },
        preEnrollmentCookie,
      );
      expect(verifyEnrollment.status).toBe(200);
      const verifiedCookie = responseCookies(verifyEnrollment);
      expect(verifiedCookie).toContain('session_token');
      await expect(
        resolver.resolve(new Headers({ Cookie: preEnrollmentCookie })),
      ).resolves.toBeNull();
      const inviteeWithMfa = await resolver.resolve(new Headers({ Cookie: verifiedCookie }));
      if (inviteeWithMfa === null) {
        throw new Error('Verified TOTP enrollment did not produce a replacement session.');
      }
      expect(inviteeWithMfa).toMatchObject({
        id: identity.id,
        email: invitedEmail,
        twoFactorEnabled: true,
      });
      await expect(
        prisma.user.findUniqueOrThrow({ where: { id: identity.id } }),
      ).resolves.toMatchObject({ twoFactorEnabled: true });
      await expect(prisma.session.count({ where: { userId: identity.id } })).resolves.toBe(1);
      const activationMetadata = metadata('activate-invitation');
      const activation = await onboarding.activate(inviteeWithMfa, activationMetadata);
      expect(activation.items).toHaveLength(1);
      const activationItem = activation.items[0];
      if (activationItem === undefined) {
        throw new Error('Pending administrator membership was not activated.');
      }
      expect(activationItem).toMatchObject({
        organizationId: acceptedInvitation.organizationId,
        membershipStatus: 'ACTIVE',
      });

      await database.withTenant(
        {
          organizationId: acceptedInvitation.organizationId,
          userId: identity.id,
          requestId: `verify-activation-${suffix}`,
          source: 'API',
        },
        async (transaction) => {
          const [membership, invitation, activationAudits, activationOutbox, acceptanceAudits] =
            await Promise.all([
              transaction.organizationMembership.findUniqueOrThrow({
                where: {
                  organizationId_userId: {
                    organizationId: acceptedInvitation.organizationId,
                    userId: identity.id,
                  },
                },
                include: { roleAssignments: true },
              }),
              transaction.administratorInvitation.findUniqueOrThrow({
                where: {
                  tokenDigest: new InvitationTokenService(authSecret).digest(
                    acceptedInvitation.invitationToken,
                  ),
                },
              }),
              transaction.auditEvent.findMany({
                where: {
                  action: 'organization_membership.activated_after_mfa',
                  actorUserId: identity.id,
                },
              }),
              transaction.outboxEvent.findMany({
                where: {
                  eventType: 'organization_membership.activated_after_mfa',
                  aggregateId: activationItem.membershipId,
                },
              }),
              transaction.auditEvent.findMany({
                where: {
                  action: 'administrator_invitation.accepted',
                  actorUserId: identity.id,
                },
              }),
            ]);
          expect(membership).toMatchObject({
            id: activationItem.membershipId,
            status: 'ACTIVE',
            version: 2,
            activatedAt: expect.any(Date),
          });
          expect(membership.roleAssignments).toHaveLength(1);
          expect(invitation).toMatchObject({
            acceptedByUserId: identity.id,
            activatedByUserId: identity.id,
            activatedAt: expect.any(Date),
            version: 3,
          });
          expect(acceptanceAudits).toHaveLength(1);
          expect(activationAudits).toHaveLength(1);
          expect(activationOutbox).toHaveLength(1);
          expect(
            JSON.stringify({ acceptanceAudits, activationAudits, activationOutbox }),
          ).not.toContain(acceptedInvitation.invitationToken);
          expect(
            JSON.stringify({ acceptanceAudits, activationAudits, activationOutbox }),
          ).not.toContain(invitedEmail);
        },
      );

      const organizations = await access.listOrganizations(
        inviteeWithMfa,
        metadata('active-organizations'),
      );
      expect(organizations.items).toEqual([
        expect.objectContaining({
          organizationId: acceptedInvitation.organizationId,
          permissions: [...leagueAdministratorPermissions].sort(),
        }),
      ]);
      await expect(
        onboarding.activate(inviteeWithMfa, metadata('repeat-activation')),
      ).resolves.toEqual({ items: [] });
    } finally {
      await prisma.$disconnect();
    }
  });

  it('keeps open email/password signup disabled outside invitation registration', async () => {
    const { prisma } = testDatabase();
    const email = `open-signup-${randomUUID()}@example.invalid`;
    const auth = createLeagueAuth({
      prisma,
      secret: authSecret,
      baseURL: authOrigin,
      trustedOrigins: [authOrigin],
    });
    try {
      const response = await requestAuth(auth, '/sign-up/email', {
        email,
        name: 'Uninvited Registration Attempt',
        password: `Uninvited-${randomUUID()}-Password`,
      });
      expect(response.status).toBeGreaterThanOrEqual(400);
      await expect(prisma.user.count({ where: { email } })).resolves.toBe(0);
    } finally {
      await prisma.$disconnect();
    }
  });
});
