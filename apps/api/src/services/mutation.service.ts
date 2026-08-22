import { privilegedMfaRequired, type AuthenticatedUser } from '@league/auth';
import { type Prisma, type TenantDatabase, type TenantTransaction } from '@league/database';
import { IdempotencyConflictError, requestFingerprint, type Permission } from '@league/domain';
import { Inject, Injectable } from '@nestjs/common';
import type { z } from 'zod';

import type { RequestMetadata } from '../common/request.js';
import { MfaEnrollmentRequiredError } from '../common/errors.js';
import { TENANT_DATABASE } from '../common/tokens.js';
import { AccessService } from './access.service.js';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_TRANSACTION_ATTEMPTS = 5;

class IdempotencyReservationConflictError extends Error {
  constructor() {
    super('Another request is reserving this idempotency key.');
    this.name = 'IdempotencyReservationConflictError';
  }
}

function hasPrismaCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

function isRetryableTransactionError(error: unknown): boolean {
  return error instanceof IdempotencyReservationConflictError || hasPrismaCode(error, 'P2034');
}

export interface MutationContext {
  readonly organizationId: string;
  readonly user: AuthenticatedUser;
  readonly metadata: RequestMetadata;
  readonly idempotencyKey: string;
}

export interface AuditWrite {
  readonly action: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly before?: Prisma.InputJsonValue;
  readonly after?: Prisma.InputJsonValue;
  readonly reason?: string;
}

@Injectable()
export class MutationService {
  constructor(
    @Inject(TENANT_DATABASE) private readonly database: TenantDatabase,
    @Inject(AccessService) private readonly access: AccessService,
  ) {}

  async execute<TResult>(options: {
    readonly context: MutationContext;
    readonly permission: Permission;
    readonly fingerprintPayload: unknown;
    readonly responseSchema: z.ZodType<TResult>;
    readonly responseStatus?: number;
    readonly operation: (transaction: TenantTransaction) => Promise<TResult>;
  }): Promise<TResult> {
    const { context } = options;
    if (
      privilegedMfaRequired(process.env.NODE_ENV, process.env.PRIVILEGED_MFA_REQUIRED) &&
      !context.user.twoFactorEnabled
    ) {
      throw new MfaEnrollmentRequiredError();
    }
    const fingerprint = requestFingerprint(options.fingerprintPayload);
    const responseStatus = options.responseStatus ?? 200;

    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        return await this.database.withTenant(
          {
            organizationId: context.organizationId,
            userId: context.user.id,
            requestId: context.metadata.requestId,
            source: context.metadata.source,
          },
          async (transaction) => {
            await this.access.assertPermission(
              transaction,
              context.organizationId,
              context.user.id,
              options.permission,
            );

            const existing = await transaction.idempotencyRecord.findUnique({
              where: {
                organizationId_actorUserId_key: {
                  organizationId: context.organizationId,
                  actorUserId: context.user.id,
                  key: context.idempotencyKey,
                },
              },
            });
            if (existing !== null && existing.expiresAt.getTime() > Date.now()) {
              if (existing.requestHash !== fingerprint) {
                throw new IdempotencyConflictError();
              }
              return options.responseSchema.parse(existing.responseBody);
            }
            if (existing !== null) {
              await transaction.idempotencyRecord.delete({
                where: {
                  organizationId_id: {
                    organizationId: context.organizationId,
                    id: existing.id,
                  },
                },
              });
            }

            let reservation: { readonly id: string };
            try {
              reservation = await transaction.idempotencyRecord.create({
                data: {
                  organizationId: context.organizationId,
                  actorUserId: context.user.id,
                  key: context.idempotencyKey,
                  requestHash: fingerprint,
                  responseStatus,
                  responseBody: {},
                  expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
                },
                select: { id: true },
              });
            } catch (error) {
              if (hasPrismaCode(error, 'P2002')) {
                throw new IdempotencyReservationConflictError();
              }
              throw error;
            }

            const result = options.responseSchema.parse(await options.operation(transaction));
            await transaction.idempotencyRecord.update({
              where: {
                organizationId_id: {
                  organizationId: context.organizationId,
                  id: reservation.id,
                },
              },
              data: {
                responseBody: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue,
              },
            });
            return result;
          },
        );
      } catch (error) {
        if (attempt < MAX_TRANSACTION_ATTEMPTS && isRetryableTransactionError(error)) {
          continue;
        }
        throw error;
      }
    }

    throw new Error('Mutation transaction retry loop exhausted unexpectedly.');
  }

  async record(
    transaction: TenantTransaction,
    context: MutationContext,
    audit: AuditWrite,
  ): Promise<void> {
    const after = audit.after;
    await transaction.auditEvent.create({
      data: {
        organizationId: context.organizationId,
        actorUserId: context.user.id,
        action: audit.action,
        targetType: audit.targetType,
        targetId: audit.targetId,
        ...(audit.before === undefined ? {} : { before: audit.before }),
        ...(after === undefined ? {} : { after }),
        ...(audit.reason === undefined ? {} : { reason: audit.reason }),
        requestId: context.metadata.requestId,
        source: context.metadata.source,
      },
    });
    await transaction.outboxEvent.create({
      data: {
        organizationId: context.organizationId,
        eventType: audit.action,
        aggregateType: audit.targetType,
        aggregateId: audit.targetId,
        payload: after ?? {},
        requestId: context.metadata.requestId,
      },
    });
  }
}
