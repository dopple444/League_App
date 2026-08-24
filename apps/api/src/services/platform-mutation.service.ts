import type { AuthenticatedUser } from '@league/auth';
import type { Prisma, TenantDatabase, TenantTransaction } from '@league/database';
import {
  IdempotencyConflictError,
  requestFingerprint,
  type PlatformPermission,
} from '@league/domain';
import { Inject, Injectable } from '@nestjs/common';
import type { z } from 'zod';

import { MfaEnrollmentRequiredError, PlatformAccessDeniedError } from '../common/errors.js';
import type { RequestMetadata } from '../common/request.js';
import { TENANT_DATABASE } from '../common/tokens.js';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_TRANSACTION_ATTEMPTS = 5;

class PlatformIdempotencyReservationConflictError extends Error {
  constructor() {
    super('Another request is reserving this platform idempotency key.');
    this.name = 'PlatformIdempotencyReservationConflictError';
  }
}

function hasPrismaCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

function isRetryable(error: unknown): boolean {
  return (
    error instanceof PlatformIdempotencyReservationConflictError || hasPrismaCode(error, 'P2034')
  );
}

export interface PlatformMutationContext {
  readonly organizationId: string;
  readonly user: AuthenticatedUser;
  readonly metadata: RequestMetadata;
  readonly idempotencyKey: string;
}

@Injectable()
export class PlatformMutationService {
  constructor(@Inject(TENANT_DATABASE) private readonly database: TenantDatabase) {}

  async execute<TResult>(options: {
    readonly context: PlatformMutationContext;
    readonly permission: PlatformPermission;
    readonly fingerprintPayload: unknown;
    readonly responseSchema: z.ZodType<TResult>;
    readonly responseStatus?: number;
    readonly operation: (transaction: TenantTransaction) => Promise<TResult>;
  }): Promise<TResult> {
    const { context } = options;
    if (!context.user.twoFactorEnabled) {
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
            await this.assertPermission(transaction, options.permission);

            const existing = await transaction.platformIdempotencyRecord.findUnique({
              where: {
                actorUserId_key: {
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
              await transaction.platformIdempotencyRecord.delete({ where: { id: existing.id } });
            }

            let reservation: { readonly id: string };
            try {
              reservation = await transaction.platformIdempotencyRecord.create({
                data: {
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
                throw new PlatformIdempotencyReservationConflictError();
              }
              throw error;
            }

            const result = options.responseSchema.parse(await options.operation(transaction));
            await transaction.platformIdempotencyRecord.update({
              where: { id: reservation.id },
              data: {
                responseBody: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue,
              },
            });
            return result;
          },
        );
      } catch (error) {
        if (attempt < MAX_TRANSACTION_ATTEMPTS && isRetryable(error)) continue;
        throw error;
      }
    }

    throw new Error('Platform mutation transaction retry loop exhausted unexpectedly.');
  }

  async assertPermission(
    transaction: TenantTransaction,
    permission: PlatformPermission,
  ): Promise<void> {
    const rows = await transaction.$queryRaw<{ allowed: boolean }[]>`
      SELECT app.has_platform_permission(${permission}::"PlatformPermission") AS allowed
    `;
    if (rows[0]?.allowed !== true) throw new PlatformAccessDeniedError();
  }
}
