import type { AuthenticatedUser } from '@league/auth';
import {
  organizationMembershipListSchema,
  type OrganizationMembershipListDto,
} from '@league/contracts';
import type { TenantDatabase, TenantTransaction } from '@league/database';
import {
  AuthorizationDeniedError,
  hasPermission,
  type AuthorizationContext,
  type Permission,
} from '@league/domain';
import { Inject, Injectable } from '@nestjs/common';

import type { RequestMetadata } from '../common/request.js';
import { TENANT_DATABASE } from '../common/tokens.js';

@Injectable()
export class AccessService {
  constructor(@Inject(TENANT_DATABASE) private readonly database: TenantDatabase) {}

  async listOrganizations(
    user: AuthenticatedUser,
    metadata: RequestMetadata,
  ): Promise<OrganizationMembershipListDto> {
    const organizationIds = await this.database.listOrganizationIdsForUser(user.id);
    const items = await Promise.all(
      organizationIds.map(async (organizationId) =>
        this.database.withTenant(
          {
            organizationId,
            userId: user.id,
            requestId: metadata.requestId,
            source: metadata.source,
          },
          async (transaction) => {
            const [organization, authorization] = await Promise.all([
              transaction.organization.findUniqueOrThrow({
                where: { organizationId },
                include: { leagues: { orderBy: { name: 'asc' } } },
              }),
              this.authorizationContext(transaction, organizationId, user.id),
            ]);
            return {
              organizationId,
              slug: organization.slug,
              name: organization.name,
              timezone: organization.timezone,
              permissions: [
                ...new Set(authorization.roles.flatMap((role) => role.permissions)),
              ].sort(),
              leagues: organization.leagues.map((league) => ({
                leagueId: league.id,
                slug: league.slug,
                name: league.name,
                active: league.active,
              })),
            };
          },
        ),
      ),
    );
    return organizationMembershipListSchema.parse({ items });
  }

  async assertPermission(
    transaction: TenantTransaction,
    organizationId: string,
    userId: string,
    permission: Permission,
  ): Promise<void> {
    const context = await this.authorizationContext(transaction, organizationId, userId);
    if (!hasPermission(context, permission)) {
      throw new AuthorizationDeniedError(permission);
    }
  }

  private async authorizationContext(
    transaction: TenantTransaction,
    organizationId: string,
    userId: string,
  ): Promise<AuthorizationContext> {
    const evaluatedAt = new Date();
    const membership = await transaction.organizationMembership.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      include: {
        roleAssignments: {
          include: { role: { include: { permissions: true } } },
        },
      },
    });
    if (membership === null || membership.status !== 'ACTIVE') {
      return { organizationId, userId, roles: [], evaluatedAt };
    }

    return {
      organizationId,
      userId,
      evaluatedAt,
      roles: membership.roleAssignments.map((assignment) => ({
        roleId: assignment.roleId,
        authorityKind: assignment.role.authorityKind,
        permissions: assignment.role.permissions.map((entry) => entry.permission as Permission),
        validFrom: assignment.validFrom,
        expiresAt: assignment.expiresAt,
        revokedAt: assignment.revokedAt,
      })),
    };
  }
}
