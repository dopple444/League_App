import type { Prisma, PrismaClient } from './generated/prisma/client.js';

export type RequestSource = 'WEB' | 'MOBILE' | 'API' | 'WORKER' | 'SYSTEM';

export interface TenantContext {
  readonly organizationId: string;
  readonly userId: string | null;
  readonly requestId: string;
  readonly source: RequestSource;
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
}
