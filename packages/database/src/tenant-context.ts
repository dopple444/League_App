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
