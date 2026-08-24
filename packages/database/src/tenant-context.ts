import type { Prisma, PrismaClient } from './generated/prisma/client.js';

export type RequestSource = 'WEB' | 'MOBILE' | 'API' | 'WORKER' | 'SYSTEM';

export interface TenantContext {
  readonly organizationId: string;
  readonly userId: string | null;
  readonly requestId: string;
  readonly source: RequestSource;
}

export interface OutboxRelayHealth {
  readonly failed: number;
  readonly oldestDueSeconds: number | null;
  readonly pending: number;
  readonly processing: number;
}

export type PlatformPermissionValue = 'TENANT_PROVISION' | 'INVITATION_REVOKE';

export interface PlatformOnboardingRow {
  readonly organizationId: string;
  readonly organizationSlug: string;
  readonly organizationName: string;
  readonly timezone: string;
  readonly leagueId: string;
  readonly leagueSlug: string;
  readonly leagueName: string;
  readonly invitationId: string;
  readonly administratorEmail: string;
  readonly expiresAt: Date;
  readonly acceptedAt: Date | null;
  readonly revokedAt: Date | null;
  readonly activatedAt: Date | null;
  readonly version: number;
  readonly createdAt: Date;
}

export type TenantTransaction = Prisma.TransactionClient;

export class TenantDatabase {
  constructor(private readonly prisma: PrismaClient) {}

  async withTenant<TResult>(
    context: TenantContext,
    operation: (transaction: TenantTransaction) => Promise<TResult>,
  ): Promise<TResult> {
    return this.prisma.$transaction(
      async (transaction) => {
        await transaction.$executeRaw`
        SELECT
          set_config('app.current_organization_id', ${context.organizationId}, true),
          set_config('app.current_user_id', ${context.userId ?? ''}, true),
          set_config('app.current_request_id', ${context.requestId}, true),
          set_config('app.current_source', ${context.source}, true)
      `;

        return operation(transaction);
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async listOrganizationIdsForUser(userId: string): Promise<readonly string[]> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        SELECT set_config('app.current_user_id', ${userId}, true)
      `;
      const rows = await transaction.$queryRaw<{ organization_id: string }[]>`
        SELECT organization_id::text
        FROM app.list_user_organizations()
      `;
      return rows.map((row) => row.organization_id);
    });
  }

  async listPendingMembershipOrganizationIds(userId: string): Promise<readonly string[]> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        SELECT set_config('app.current_user_id', ${userId}, true)
      `;
      const rows = await transaction.$queryRaw<{ organization_id: string }[]>`
        SELECT organization_id::text
        FROM app.list_pending_membership_organizations()
      `;
      return rows.map((row) => row.organization_id);
    });
  }

  async hasPlatformPermission(
    userId: string,
    permission: PlatformPermissionValue,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        SELECT set_config('app.current_user_id', ${userId}, true)
      `;
      const rows = await transaction.$queryRaw<{ allowed: boolean }[]>`
        SELECT app.has_platform_permission(${permission}::"PlatformPermission") AS allowed
      `;
      return rows[0]?.allowed === true;
    });
  }

  async listPlatformOnboarding(userId: string): Promise<readonly PlatformOnboardingRow[]> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        SELECT set_config('app.current_user_id', ${userId}, true)
      `;
      const rows = await transaction.$queryRaw<
        {
          administrator_email: string;
          invitation_accepted_at: Date | null;
          invitation_activated_at: Date | null;
          invitation_created_at: Date;
          invitation_expires_at: Date;
          invitation_id: string;
          invitation_revoked_at: Date | null;
          invitation_version: number;
          league_id: string;
          league_name: string;
          league_slug: string;
          organization_id: string;
          organization_name: string;
          organization_slug: string;
          organization_timezone: string;
        }[]
      >`
        SELECT
          organization_id::text,
          organization_slug,
          organization_name,
          organization_timezone,
          league_id::text,
          league_slug,
          league_name,
          invitation_id::text,
          administrator_email,
          invitation_expires_at,
          invitation_accepted_at,
          invitation_revoked_at,
          invitation_activated_at,
          invitation_version,
          invitation_created_at
        FROM app.list_platform_onboarding()
      `;
      return rows.map((row) => ({
        organizationId: row.organization_id,
        organizationSlug: row.organization_slug,
        organizationName: row.organization_name,
        timezone: row.organization_timezone,
        leagueId: row.league_id,
        leagueSlug: row.league_slug,
        leagueName: row.league_name,
        invitationId: row.invitation_id,
        administratorEmail: row.administrator_email,
        expiresAt: row.invitation_expires_at,
        acceptedAt: row.invitation_accepted_at,
        revokedAt: row.invitation_revoked_at,
        activatedAt: row.invitation_activated_at,
        version: row.invitation_version,
        createdAt: row.invitation_created_at,
      }));
    });
  }

  async resolveAdministratorInvitationOrganization(tokenDigest: string): Promise<string | null> {
    const rows = await this.prisma.$queryRaw<{ organization_id: string }[]>`
      SELECT organization_id::text
      FROM app.resolve_administrator_invitation_organization(${tokenDigest})
    `;
    return rows[0]?.organization_id ?? null;
  }

  async resolvePlatformInvitationOrganization(
    userId: string,
    invitationId: string,
  ): Promise<string | null> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        SELECT set_config('app.current_user_id', ${userId}, true)
      `;
      const rows = await transaction.$queryRaw<{ organization_id: string }[]>`
        SELECT organization_id::text
        FROM app.resolve_platform_invitation_organization(${invitationId}::uuid)
      `;
      return rows[0]?.organization_id ?? null;
    });
  }

  async resolvePublicOrganization(
    organizationSlug: string,
    leagueSlug: string,
  ): Promise<string | null> {
    const rows = await this.prisma.$queryRaw<{ organization_id: string }[]>`
      SELECT organization_id::text
      FROM app.resolve_public_organization(${organizationSlug}, ${leagueSlug})
    `;
    return rows[0]?.organization_id ?? null;
  }

  async listDueOutboxOrganizationIds(limit: number): Promise<readonly string[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
      throw new RangeError('Outbox organization limit must be an integer between 1 and 500.');
    }
    const rows = await this.prisma.$queryRaw<{ organization_id: string }[]>`
      SELECT organization_id::text
      FROM app.list_due_outbox_organizations(${limit})
    `;
    return rows.map((row) => row.organization_id);
  }

  async outboxRelayHealth(): Promise<OutboxRelayHealth> {
    const rows = await this.prisma.$queryRaw<
      {
        failed_count: bigint | number | string;
        oldest_due_seconds: number | string | null;
        pending_count: bigint | number | string;
        processing_count: bigint | number | string;
      }[]
    >`
      SELECT pending_count, processing_count, failed_count, oldest_due_seconds
      FROM app.outbox_relay_health()
    `;
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Outbox relay health query returned no result.');
    }
    return {
      failed: toSafeCount(row.failed_count, 'failed_count'),
      oldestDueSeconds:
        row.oldest_due_seconds === null
          ? null
          : toSafeDuration(row.oldest_due_seconds, 'oldest_due_seconds'),
      pending: toSafeCount(row.pending_count, 'pending_count'),
      processing: toSafeCount(row.processing_count, 'processing_count'),
    };
  }
}

function toSafeCount(value: bigint | number | string, field: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Outbox relay health ${field} is outside the supported range.`);
  }
  return parsed;
}

function toSafeDuration(value: number | string, field: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Outbox relay health ${field} is invalid.`);
  }
  return parsed;
}
