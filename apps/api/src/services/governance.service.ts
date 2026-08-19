import type { AuthenticatedUser } from '@league/auth';
import {
  auditEventListSchema,
  createRoleAssignmentSchema,
  revokeRoleAssignmentSchema,
  roleAssignmentSchema,
  type AuditEventListDto,
  type CreateRoleAssignmentInput,
  type RevokeRoleAssignmentInput,
  type RoleAssignmentDto,
} from '@league/contracts';
import type { Prisma, TenantDatabase } from '@league/database';
import { assertExpectedVersion, permissions } from '@league/domain';
import { Inject, Injectable } from '@nestjs/common';

import { ResourceNotFoundError } from '../common/errors.js';
import type { RequestMetadata } from '../common/request.js';
import { TENANT_DATABASE } from '../common/tokens.js';
import { AccessService } from './access.service.js';
import { MutationService, type MutationContext } from './mutation.service.js';

function json(value: unknown): Prisma.InputJsonValue {
  return structuredClone(value) as Prisma.InputJsonValue;
}

@Injectable()
export class GovernanceService {
  constructor(
    @Inject(TENANT_DATABASE) private readonly database: TenantDatabase,
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(MutationService) private readonly mutations: MutationService,
  ) {}

  async auditEvents(
    organizationId: string,
    user: AuthenticatedUser,
    metadata: RequestMetadata,
  ): Promise<AuditEventListDto> {
    return this.database.withTenant(
      { organizationId, userId: user.id, requestId: metadata.requestId, source: metadata.source },
      async (transaction) => {
        await this.access.assertPermission(
          transaction,
          organizationId,
          user.id,
          permissions.auditRead,
        );
        const events = await transaction.auditEvent.findMany({
          orderBy: { occurredAt: 'desc' },
          take: 200,
        });
        return auditEventListSchema.parse({
          items: events.map((event) => ({
            auditEventId: event.id,
            organizationId: event.organizationId,
            actorUserId: event.actorUserId,
            action: event.action,
            targetType: event.targetType,
            targetId: event.targetId,
            before: event.before,
            after: event.after,
            reason: event.reason,
            occurredAt: event.occurredAt.toISOString(),
            requestId: event.requestId,
            source: event.source,
          })),
        });
      },
    );
  }

  createRoleAssignment(
    context: MutationContext,
    rawInput: CreateRoleAssignmentInput,
  ): Promise<RoleAssignmentDto> {
    const input = createRoleAssignmentSchema.parse(rawInput);
    return this.mutations.execute({
      context,
      permission: permissions.roleAssign,
      fingerprintPayload: { operation: 'role-assignment.create', input },
      responseSchema: roleAssignmentSchema,
      operation: async (transaction) => {
        const [membership, role] = await Promise.all([
          transaction.organizationMembership.findUnique({
            where: {
              organizationId_id: {
                organizationId: context.organizationId,
                id: input.membershipId,
              },
            },
          }),
          transaction.role.findUnique({
            where: {
              organizationId_id: { organizationId: context.organizationId, id: input.roleId },
            },
          }),
        ]);
        if (membership === null || role === null) {
          throw new ResourceNotFoundError();
        }
        const assignment = await transaction.roleAssignment.create({
          data: {
            organizationId: context.organizationId,
            membershipId: input.membershipId,
            roleId: input.roleId,
            validFrom: new Date(input.validFrom),
            ...(input.expiresAt === undefined
              ? {}
              : { expiresAt: input.expiresAt === null ? null : new Date(input.expiresAt) }),
          },
        });
        const result = roleAssignmentSchema.parse({
          roleAssignmentId: assignment.id,
          membershipId: assignment.membershipId,
          roleId: assignment.roleId,
          validFrom: assignment.validFrom.toISOString(),
          expiresAt: assignment.expiresAt?.toISOString() ?? null,
          revokedAt: null,
          version: assignment.version,
        });
        await this.mutations.record(transaction, context, {
          action: 'role-assignment.created',
          targetType: 'RoleAssignment',
          targetId: assignment.id,
          after: json(result),
          reason: input.reason,
        });
        return result;
      },
    });
  }

  revokeRoleAssignment(
    context: MutationContext,
    roleAssignmentId: string,
    rawInput: RevokeRoleAssignmentInput,
  ): Promise<RoleAssignmentDto> {
    const input = revokeRoleAssignmentSchema.parse(rawInput);
    return this.mutations.execute({
      context,
      permission: permissions.roleAssign,
      fingerprintPayload: { operation: 'role-assignment.revoke', roleAssignmentId, input },
      responseSchema: roleAssignmentSchema,
      operation: async (transaction) => {
        const current = await transaction.roleAssignment.findUnique({
          where: {
            organizationId_id: { organizationId: context.organizationId, id: roleAssignmentId },
          },
        });
        if (current === null) {
          throw new ResourceNotFoundError();
        }
        assertExpectedVersion(input.expectedVersion, current.version);
        const before = roleAssignmentSchema.parse({
          roleAssignmentId: current.id,
          membershipId: current.membershipId,
          roleId: current.roleId,
          validFrom: current.validFrom.toISOString(),
          expiresAt: current.expiresAt?.toISOString() ?? null,
          revokedAt: current.revokedAt?.toISOString() ?? null,
          version: current.version,
        });
        const updated = await transaction.roleAssignment.update({
          where: {
            organizationId_id: { organizationId: context.organizationId, id: roleAssignmentId },
          },
          data: {
            revokedAt: new Date(),
            revokedByUserId: context.user.id,
            version: { increment: 1 },
          },
        });
        const result = roleAssignmentSchema.parse({
          roleAssignmentId: updated.id,
          membershipId: updated.membershipId,
          roleId: updated.roleId,
          validFrom: updated.validFrom.toISOString(),
          expiresAt: updated.expiresAt?.toISOString() ?? null,
          revokedAt: updated.revokedAt?.toISOString() ?? null,
          version: updated.version,
        });
        await this.mutations.record(transaction, context, {
          action: 'role-assignment.revoked',
          targetType: 'RoleAssignment',
          targetId: updated.id,
          before: json(before),
          after: json(result),
          reason: input.reason,
        });
        return result;
      },
    });
  }
}
