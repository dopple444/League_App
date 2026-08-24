import { randomUUID } from 'node:crypto';

import { privilegedMfaRequired, type AuthenticatedUser, type LeagueAuth } from '@league/auth';
import {
  administratorInvitationAcceptanceSchema,
  administratorInvitationContextSchema,
  administratorInvitationRegistrationSchema,
  onboardingActivationListSchema,
  platformOnboardingListSchema,
  platformOnboardingSchema,
  provisionPlatformOnboardingResultSchema,
  securityPostureSchema,
  type AcceptAdministratorInvitationInput,
  type AdministratorInvitationAcceptanceDto,
  type AdministratorInvitationContextDto,
  type AdministratorInvitationRegistrationDto,
  type OnboardingActivationListDto,
  type PlatformOnboardingDto,
  type PlatformOnboardingListDto,
  type ProvisionPlatformOnboardingInput,
  type ProvisionPlatformOnboardingResultDto,
  type RegisterAdministratorInvitationInput,
  type RevokePlatformInvitationInput,
  type SecurityPostureDto,
} from '@league/contracts';
import type { Prisma, PrismaClient, TenantDatabase } from '@league/database';
import {
  IdempotencyConflictError,
  leagueAdministratorPermissions,
  platformPermissions,
  requestFingerprint,
} from '@league/domain';
import { Inject, Injectable } from '@nestjs/common';

import {
  DuplicateOrganizationSlugError,
  InvitationNotRevocableError,
  InvitationUnavailableError,
  MfaEnrollmentRequiredError,
  PlatformAccessDeniedError,
} from '../common/errors.js';
import type { RequestMetadata } from '../common/request.js';
import { INVITATION_AUTH, INVITATION_TOKENS, PRISMA, TENANT_DATABASE } from '../common/tokens.js';
import type { InvitationTokenService } from './invitation-token.service.js';
import {
  PlatformMutationService,
  type PlatformMutationContext,
} from './platform-mutation.service.js';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_TRANSACTION_ATTEMPTS = 5;

function hasPrismaCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

function invitationStatus(value: {
  readonly expiresAt: Date;
  readonly acceptedAt: Date | null;
  readonly revokedAt: Date | null;
  readonly activatedAt: Date | null;
}): PlatformOnboardingDto['status'] {
  if (value.revokedAt !== null) return 'REVOKED';
  if (value.activatedAt !== null) return 'ACTIVATED';
  if (value.acceptedAt !== null) return 'ACCEPTED_PENDING_MFA';
  if (value.expiresAt.getTime() <= Date.now()) return 'EXPIRED';
  return 'PENDING';
}

function maskEmail(email: string): string {
  const separator = email.lastIndexOf('@');
  if (separator <= 0) return 'issued address';
  const local = email.slice(0, separator);
  const domain = email.slice(separator + 1);
  return `${local.slice(0, 1)}${'*'.repeat(Math.min(Math.max(local.length - 1, 3), 8))}@${domain}`;
}

type PlatformOnboardingRow = Awaited<ReturnType<TenantDatabase['listPlatformOnboarding']>>[number];

function platformOnboardingDto(row: PlatformOnboardingRow): PlatformOnboardingDto {
  return platformOnboardingSchema.parse({
    organizationId: row.organizationId,
    organizationName: row.organizationName,
    organizationSlug: row.organizationSlug,
    timezone: row.timezone,
    leagueId: row.leagueId,
    leagueName: row.leagueName,
    leagueSlug: row.leagueSlug,
    invitationId: row.invitationId,
    administratorEmail: row.administratorEmail,
    status: invitationStatus(row),
    expiresAt: row.expiresAt.toISOString(),
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    activatedAt: row.activatedAt?.toISOString() ?? null,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
  });
}

interface InvitationRecord {
  readonly id: string;
  readonly organizationId: string;
  readonly leagueId: string;
  readonly roleId: string;
  readonly emailNormalized: string;
  readonly tokenDigest: string;
  readonly expiresAt: Date;
  readonly acceptedAt: Date | null;
  readonly revokedAt: Date | null;
  readonly activatedAt: Date | null;
  readonly version: number;
  readonly organization: { readonly name: string };
  readonly league: { readonly name: string };
}

@Injectable()
export class OnboardingService {
  constructor(
    @Inject(TENANT_DATABASE) private readonly database: TenantDatabase,
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(INVITATION_AUTH) private readonly invitationAuth: LeagueAuth,
    @Inject(INVITATION_TOKENS) private readonly tokens: InvitationTokenService,
    @Inject(PlatformMutationService) private readonly platformMutations: PlatformMutationService,
  ) {}

  async securityPosture(user: AuthenticatedUser): Promise<SecurityPostureDto> {
    const [canProvision, canRevoke, pendingOrganizations] = await Promise.all([
      this.database.hasPlatformPermission(user.id, platformPermissions.tenantProvision),
      this.database.hasPlatformPermission(user.id, platformPermissions.invitationRevoke),
      this.database.listPendingMembershipOrganizationIds(user.id),
    ]);
    const platformAccess = canProvision || canRevoke;
    const pendingActivation = pendingOrganizations.length > 0;
    return securityPostureSchema.parse({
      mfaEnabled: user.twoFactorEnabled,
      mfaRequired:
        privilegedMfaRequired(process.env.NODE_ENV, process.env.PRIVILEGED_MFA_REQUIRED) ||
        platformAccess ||
        pendingActivation,
      platformAccess,
      pendingActivation,
    });
  }

  async listPlatformOnboarding(user: AuthenticatedUser): Promise<PlatformOnboardingListDto> {
    if (!user.twoFactorEnabled) throw new MfaEnrollmentRequiredError();
    const canProvision = await this.database.hasPlatformPermission(
      user.id,
      platformPermissions.tenantProvision,
    );
    const canRevoke = await this.database.hasPlatformPermission(
      user.id,
      platformPermissions.invitationRevoke,
    );
    if (!canProvision && !canRevoke) throw new PlatformAccessDeniedError();
    const rows = await this.database.listPlatformOnboarding(user.id);
    return platformOnboardingListSchema.parse({
      canProvisionTenants: canProvision,
      canRevokeInvitations: canRevoke,
      items: rows.map(platformOnboardingDto),
    });
  }

  async provision(
    context: Omit<PlatformMutationContext, 'organizationId'>,
    input: ProvisionPlatformOnboardingInput,
  ): Promise<ProvisionPlatformOnboardingResultDto> {
    const organizationId = randomUUID();
    const leagueId = randomUUID();
    const roleId = randomUUID();
    const invitationId = randomUUID();
    const invitationToken = this.tokens.tokenFor(invitationId);
    const tokenDigest = this.tokens.digest(invitationToken);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + input.invitationExpiresInHours * 60 * 60 * 1000);

    let stored: PlatformOnboardingDto;
    try {
      stored = await this.platformMutations.execute({
        context: { ...context, organizationId },
        permission: platformPermissions.tenantProvision,
        fingerprintPayload: { operation: 'controlled-beta.provision', input },
        responseSchema: platformOnboardingSchema,
        responseStatus: 201,
        operation: async (transaction) => {
          await transaction.organization.create({
            data: {
              organizationId,
              name: input.organizationName,
              slug: input.organizationSlug,
              timezone: input.timezone,
            },
          });
          await transaction.league.create({
            data: {
              id: leagueId,
              organizationId,
              name: input.leagueName,
              slug: input.leagueSlug,
              active: true,
            },
          });
          await transaction.role.create({
            data: {
              id: roleId,
              organizationId,
              key: 'league-administrator',
              name: 'League Administrator',
              authorityKind: 'OPERATIONS',
            },
          });
          await transaction.rolePermission.createMany({
            data: leagueAdministratorPermissions.map((permission) => ({
              organizationId,
              roleId,
              permission,
            })),
          });
          await transaction.administratorInvitation.create({
            data: {
              id: invitationId,
              organizationId,
              leagueId,
              roleId,
              emailNormalized: input.administratorEmail,
              tokenDigest,
              expiresAt,
              createdByUserId: context.user.id,
            },
          });

          const safeAfter = {
            organizationId,
            organizationSlug: input.organizationSlug,
            leagueId,
            leagueSlug: input.leagueSlug,
            invitationId,
            invitationExpiresAt: expiresAt.toISOString(),
          } satisfies Prisma.InputJsonObject;
          await Promise.all([
            transaction.platformAuditEvent.create({
              data: {
                actorUserId: context.user.id,
                action: 'controlled_beta.organization.provisioned',
                targetType: 'Organization',
                targetId: organizationId,
                after: safeAfter,
                reason: input.reason,
                requestId: context.metadata.requestId,
                source: context.metadata.source,
              },
            }),
            transaction.auditEvent.create({
              data: {
                organizationId,
                actorUserId: context.user.id,
                action: 'organization.provisioned',
                targetType: 'Organization',
                targetId: organizationId,
                after: safeAfter,
                reason: input.reason,
                requestId: context.metadata.requestId,
                source: context.metadata.source,
              },
            }),
            transaction.outboxEvent.create({
              data: {
                organizationId,
                eventType: 'organization.provisioned',
                aggregateType: 'Organization',
                aggregateId: organizationId,
                payload: safeAfter,
                requestId: context.metadata.requestId,
              },
            }),
          ]);

          return platformOnboardingSchema.parse({
            organizationId,
            organizationName: input.organizationName,
            organizationSlug: input.organizationSlug,
            timezone: input.timezone,
            leagueId,
            leagueName: input.leagueName,
            leagueSlug: input.leagueSlug,
            invitationId,
            administratorEmail: input.administratorEmail,
            status: 'PENDING',
            expiresAt: expiresAt.toISOString(),
            acceptedAt: null,
            revokedAt: null,
            activatedAt: null,
            version: 1,
            createdAt: now.toISOString(),
          });
        },
      });
    } catch (error) {
      if (hasPrismaCode(error, 'P2002')) throw new DuplicateOrganizationSlugError();
      throw error;
    }

    // Reconstructing from the stable invitation UUID keeps idempotency replay exact without ever
    // storing the bearer in the idempotency, tenant, audit, or outbox records.
    return provisionPlatformOnboardingResultSchema.parse({
      ...stored,
      invitationToken: this.tokens.tokenFor(stored.invitationId),
    });
  }

  async revoke(
    context: Omit<PlatformMutationContext, 'organizationId'>,
    invitationId: string,
    input: RevokePlatformInvitationInput,
  ): Promise<PlatformOnboardingDto> {
    // Resolve no invitation identifier until the caller has passed both assurance and authority
    // checks. PlatformMutationService repeats the grant check inside the mutation transaction so
    // a concurrent grant revocation also fails closed.
    if (!context.user.twoFactorEnabled) throw new MfaEnrollmentRequiredError();
    const canRevoke = await this.database.hasPlatformPermission(
      context.user.id,
      platformPermissions.invitationRevoke,
    );
    if (!canRevoke) throw new PlatformAccessDeniedError();
    const organizationId = await this.database.resolvePlatformInvitationOrganization(
      context.user.id,
      invitationId,
    );
    if (organizationId === null) throw new InvitationNotRevocableError();

    return this.platformMutations.execute({
      context: { ...context, organizationId },
      permission: platformPermissions.invitationRevoke,
      fingerprintPayload: { operation: 'controlled-beta.invitation.revoke', invitationId, input },
      responseSchema: platformOnboardingSchema,
      operation: async (transaction) => {
        const invitation = await transaction.administratorInvitation.findUnique({
          where: { organizationId_id: { organizationId, id: invitationId } },
          include: { organization: true, league: true },
        });
        if (
          invitation === null ||
          invitation.version !== input.expectedVersion ||
          invitation.acceptedAt !== null ||
          invitation.revokedAt !== null ||
          invitation.expiresAt.getTime() <= Date.now()
        ) {
          throw new InvitationNotRevocableError();
        }

        const revokedAt = new Date();
        const updated = await transaction.administratorInvitation.update({
          where: { organizationId_id: { organizationId, id: invitationId } },
          data: {
            revokedAt,
            revokedByUserId: context.user.id,
            revocationReason: input.reason,
            version: { increment: 1 },
          },
          include: { organization: true, league: true },
        });
        const safeAfter = {
          invitationId,
          status: 'REVOKED',
          revokedAt: revokedAt.toISOString(),
        } satisfies Prisma.InputJsonObject;
        await Promise.all([
          transaction.platformAuditEvent.create({
            data: {
              actorUserId: context.user.id,
              action: 'controlled_beta.invitation.revoked',
              targetType: 'AdministratorInvitation',
              targetId: invitationId,
              before: { version: invitation.version, status: 'PENDING' },
              after: safeAfter,
              reason: input.reason,
              requestId: context.metadata.requestId,
              source: context.metadata.source,
            },
          }),
          transaction.auditEvent.create({
            data: {
              organizationId,
              actorUserId: context.user.id,
              action: 'administrator_invitation.revoked',
              targetType: 'AdministratorInvitation',
              targetId: invitationId,
              before: { version: invitation.version, status: 'PENDING' },
              after: safeAfter,
              reason: input.reason,
              requestId: context.metadata.requestId,
              source: context.metadata.source,
            },
          }),
          transaction.outboxEvent.create({
            data: {
              organizationId,
              eventType: 'administrator_invitation.revoked',
              aggregateType: 'AdministratorInvitation',
              aggregateId: invitationId,
              payload: safeAfter,
              requestId: context.metadata.requestId,
            },
          }),
        ]);

        return platformOnboardingSchema.parse({
          organizationId,
          organizationName: updated.organization.name,
          organizationSlug: updated.organization.slug,
          timezone: updated.organization.timezone,
          leagueId: updated.leagueId,
          leagueName: updated.league.name,
          leagueSlug: updated.league.slug,
          invitationId: updated.id,
          administratorEmail: updated.emailNormalized,
          status: 'REVOKED',
          expiresAt: updated.expiresAt.toISOString(),
          acceptedAt: null,
          revokedAt: updated.revokedAt?.toISOString() ?? revokedAt.toISOString(),
          activatedAt: null,
          version: updated.version,
          createdAt: updated.createdAt.toISOString(),
        });
      },
    });
  }

  async inspect(
    invitationToken: string,
    metadata: RequestMetadata,
  ): Promise<AdministratorInvitationContextDto> {
    const invitation = await this.usableInvitation(invitationToken, metadata);
    return administratorInvitationContextSchema.parse({
      organizationName: invitation.organization.name,
      leagueName: invitation.league.name,
      administratorEmailHint: maskEmail(invitation.emailNormalized),
      expiresAt: invitation.expiresAt.toISOString(),
    });
  }

  async register(
    input: RegisterAdministratorInvitationInput,
    metadata: RequestMetadata,
  ): Promise<AdministratorInvitationRegistrationDto> {
    const invitation = await this.usableInvitation(input.invitationToken, metadata);
    const existing = await this.prisma.user.findUnique({
      where: { email: invitation.emailNormalized },
      select: { id: true },
    });
    const createdOrRaced = existing === null;
    if (existing === null) {
      try {
        await this.invitationAuth.api.signUpEmail({
          body: {
            email: invitation.emailNormalized,
            name: input.name,
            password: input.password,
          },
        });
      } catch (error) {
        const raced = await this.prisma.user.findUnique({
          where: { email: invitation.emailNormalized },
          select: { id: true },
        });
        if (raced === null) throw error;
      }
    }
    const identity = await this.prisma.user.findUniqueOrThrow({
      where: { email: invitation.emailNormalized },
      select: { id: true },
    });
    await this.prisma.$transaction(async (transaction) => {
      // This conditional transition is both the normal post-sign-up cleanup and recovery for a
      // prior request interrupted after Better Auth created the identity. An identity already
      // verified when this request began yields count zero and preserves every legitimate session.
      const verified = await transaction.user.updateMany({
        where: { id: identity.id, emailVerified: false },
        data: { emailVerified: true },
      });
      if (createdOrRaced || verified.count === 1) {
        // The internal sign-up API has no HTTP cookie recipient, so its session is orphaned. Delete
        // it in the same transaction as verification; either both cleanup steps commit or neither.
        await transaction.session.deleteMany({ where: { userId: identity.id } });
      }
    });
    return administratorInvitationRegistrationSchema.parse({ continueToSignIn: true });
  }

  async accept(
    user: AuthenticatedUser,
    metadata: RequestMetadata,
    idempotencyKey: string,
    input: AcceptAdministratorInvitationInput,
  ): Promise<AdministratorInvitationAcceptanceDto> {
    const tokenDigest = this.tokens.digest(input.invitationToken);
    const organizationId =
      await this.database.resolveAdministratorInvitationOrganization(tokenDigest);
    if (organizationId === null) throw new InvitationUnavailableError();
    const fingerprint = requestFingerprint({
      operation: 'administrator-invitation.accept',
      tokenDigest,
    });

    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        return await this.database.withTenant(
          {
            organizationId,
            userId: user.id,
            requestId: metadata.requestId,
            source: metadata.source,
          },
          async (transaction) => {
            const existing = await transaction.idempotencyRecord.findUnique({
              where: {
                organizationId_actorUserId_key: {
                  organizationId,
                  actorUserId: user.id,
                  key: idempotencyKey,
                },
              },
            });
            if (existing !== null && existing.expiresAt.getTime() > Date.now()) {
              if (existing.requestHash !== fingerprint) throw new IdempotencyConflictError();
              return administratorInvitationAcceptanceSchema.parse(existing.responseBody);
            }
            if (existing !== null) {
              await transaction.idempotencyRecord.delete({
                where: { organizationId_id: { organizationId, id: existing.id } },
              });
            }

            const invitation = await transaction.administratorInvitation.findUnique({
              where: { tokenDigest },
            });
            if (
              invitation === null ||
              invitation.organizationId !== organizationId ||
              invitation.emailNormalized !== user.email.trim().toLowerCase() ||
              invitation.acceptedAt !== null ||
              invitation.revokedAt !== null ||
              invitation.expiresAt.getTime() <= Date.now()
            ) {
              throw new InvitationUnavailableError();
            }
            const priorMembership = await transaction.organizationMembership.findUnique({
              where: { organizationId_userId: { organizationId, userId: user.id } },
              select: { id: true },
            });
            if (priorMembership !== null) throw new InvitationUnavailableError();

            const reservation = await transaction.idempotencyRecord.create({
              data: {
                organizationId,
                actorUserId: user.id,
                key: idempotencyKey,
                requestHash: fingerprint,
                responseStatus: 200,
                responseBody: {},
                expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
              },
              select: { id: true },
            });
            const acceptedAt = new Date();
            const updated = await transaction.administratorInvitation.updateMany({
              where: {
                organizationId,
                id: invitation.id,
                version: invitation.version,
                acceptedAt: null,
                revokedAt: null,
                expiresAt: { gt: acceptedAt },
              },
              data: {
                acceptedAt,
                acceptedByUserId: user.id,
                version: { increment: 1 },
              },
            });
            if (updated.count !== 1) throw new InvitationUnavailableError();
            const membership = await transaction.organizationMembership.create({
              data: { organizationId, userId: user.id, status: 'PENDING' },
            });
            await transaction.roleAssignment.create({
              data: {
                organizationId,
                membershipId: membership.id,
                roleId: invitation.roleId,
                validFrom: acceptedAt,
              },
            });
            const result = administratorInvitationAcceptanceSchema.parse({
              accepted: true,
              membershipStatus: 'PENDING',
              mfaRequired: true,
              acceptedAt: acceptedAt.toISOString(),
            });
            const safeAfter = {
              invitationId: invitation.id,
              membershipId: membership.id,
              roleId: invitation.roleId,
              membershipStatus: 'PENDING',
            } satisfies Prisma.InputJsonObject;
            await Promise.all([
              transaction.auditEvent.create({
                data: {
                  organizationId,
                  actorUserId: user.id,
                  action: 'administrator_invitation.accepted',
                  targetType: 'AdministratorInvitation',
                  targetId: invitation.id,
                  after: safeAfter,
                  requestId: metadata.requestId,
                  source: metadata.source,
                },
              }),
              transaction.outboxEvent.create({
                data: {
                  organizationId,
                  eventType: 'administrator_invitation.accepted',
                  aggregateType: 'AdministratorInvitation',
                  aggregateId: invitation.id,
                  payload: safeAfter,
                  requestId: metadata.requestId,
                },
              }),
              transaction.idempotencyRecord.update({
                where: { organizationId_id: { organizationId, id: reservation.id } },
                data: {
                  responseBody: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue,
                },
              }),
            ]);
            return result;
          },
        );
      } catch (error) {
        if (attempt < MAX_TRANSACTION_ATTEMPTS && hasPrismaCode(error, 'P2034')) continue;
        if (attempt < MAX_TRANSACTION_ATTEMPTS && hasPrismaCode(error, 'P2002')) continue;
        throw error;
      }
    }
    throw new Error('Invitation acceptance transaction retry loop exhausted unexpectedly.');
  }

  async activate(
    user: AuthenticatedUser,
    metadata: RequestMetadata,
  ): Promise<OnboardingActivationListDto> {
    if (!user.twoFactorEnabled) throw new MfaEnrollmentRequiredError();
    const organizationIds = await this.database.listPendingMembershipOrganizationIds(user.id);
    const items: OnboardingActivationListDto['items'][number][] = [];

    for (const organizationId of organizationIds) {
      const activated = await this.activateOrganization(organizationId, user, metadata);
      if (activated !== null) items.push(activated);
    }
    return onboardingActivationListSchema.parse({ items });
  }

  private async activateOrganization(
    organizationId: string,
    user: AuthenticatedUser,
    metadata: RequestMetadata,
  ): Promise<OnboardingActivationListDto['items'][number] | null> {
    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        return await this.database.withTenant(
          {
            organizationId,
            userId: user.id,
            requestId: metadata.requestId,
            source: metadata.source,
          },
          async (transaction) => {
            const membership = await transaction.organizationMembership.findUnique({
              where: { organizationId_userId: { organizationId, userId: user.id } },
            });
            if (membership === null || membership.status !== 'PENDING') return null;
            const invitation = await transaction.administratorInvitation.findFirst({
              where: {
                organizationId,
                acceptedByUserId: user.id,
                acceptedAt: { not: null },
                activatedAt: null,
                revokedAt: null,
              },
              orderBy: { acceptedAt: 'asc' },
            });
            if (invitation === null) return null;

            const activatedAt = new Date();
            const changed = await transaction.organizationMembership.updateMany({
              where: {
                organizationId,
                id: membership.id,
                status: 'PENDING',
                version: membership.version,
              },
              data: {
                status: 'ACTIVE',
                activatedAt,
                version: { increment: 1 },
              },
            });
            if (changed.count !== 1) return null;
            await transaction.administratorInvitation.update({
              where: { organizationId_id: { organizationId, id: invitation.id } },
              data: {
                activatedAt,
                activatedByUserId: user.id,
                version: { increment: 1 },
              },
            });
            const result = {
              organizationId,
              membershipId: membership.id,
              membershipStatus: 'ACTIVE' as const,
              activatedAt: activatedAt.toISOString(),
            };
            const safeAfter = {
              invitationId: invitation.id,
              membershipId: membership.id,
              membershipStatus: 'ACTIVE',
              activatedAt: activatedAt.toISOString(),
            } satisfies Prisma.InputJsonObject;
            await Promise.all([
              transaction.auditEvent.create({
                data: {
                  organizationId,
                  actorUserId: user.id,
                  action: 'organization_membership.activated_after_mfa',
                  targetType: 'OrganizationMembership',
                  targetId: membership.id,
                  before: { membershipStatus: 'PENDING' },
                  after: safeAfter,
                  reason: 'Verified MFA enrollment or challenge completed.',
                  requestId: metadata.requestId,
                  source: metadata.source,
                },
              }),
              transaction.outboxEvent.create({
                data: {
                  organizationId,
                  eventType: 'organization_membership.activated_after_mfa',
                  aggregateType: 'OrganizationMembership',
                  aggregateId: membership.id,
                  payload: safeAfter,
                  requestId: metadata.requestId,
                },
              }),
            ]);
            return result;
          },
        );
      } catch (error) {
        if (attempt < MAX_TRANSACTION_ATTEMPTS && hasPrismaCode(error, 'P2034')) continue;
        throw error;
      }
    }
    throw new Error('Membership activation transaction retry loop exhausted unexpectedly.');
  }

  private async usableInvitation(
    invitationToken: string,
    metadata: RequestMetadata,
  ): Promise<InvitationRecord> {
    const tokenDigest = this.tokens.digest(invitationToken);
    const organizationId =
      await this.database.resolveAdministratorInvitationOrganization(tokenDigest);
    if (organizationId === null) throw new InvitationUnavailableError();
    return this.database.withTenant(
      {
        organizationId,
        userId: null,
        requestId: metadata.requestId,
        source: metadata.source,
      },
      async (transaction) => {
        const invitation = await transaction.administratorInvitation.findUnique({
          where: { tokenDigest },
          include: { organization: true, league: true },
        });
        if (
          invitation === null ||
          invitation.organizationId !== organizationId ||
          invitation.acceptedAt !== null ||
          invitation.revokedAt !== null ||
          invitation.expiresAt.getTime() <= Date.now()
        ) {
          throw new InvitationUnavailableError();
        }
        return invitation;
      },
    );
  }
}
