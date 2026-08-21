import type { OutboxRelayHealth, TenantDatabase, TenantTransaction } from '@league/database';
import { Inject, Injectable } from '@nestjs/common';

import type { OutboxDispatchJob } from './outbox.contract.js';
import { TENANT_DATABASE } from './tokens.js';

export interface ClaimedOutboxEvent {
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly dispatchAttempt: number;
  readonly eventId: string;
  readonly eventType: string;
  readonly organizationId: string;
  readonly requestId: string;
}

export interface OutboxClaimBatch {
  readonly events: readonly ClaimedOutboxEvent[];
  readonly exhausted: number;
}

type ClaimedOutboxRow = Readonly<{
  aggregate_id: string;
  aggregate_type: string;
  attempts: number;
  event_type: string;
  id: string;
  organization_id: string;
  request_id: string;
}>;

export type OutboxGenerationState = 'CURRENT' | 'STALE';

export function outboxRetryDelayMs(dispatchAttempt: number): number {
  if (!Number.isInteger(dispatchAttempt) || dispatchAttempt < 1) {
    throw new RangeError('Dispatch attempt must be a positive integer.');
  }
  return Math.min(1_000 * 2 ** Math.min(dispatchAttempt - 1, 20), 300_000);
}

@Injectable()
export class OutboxRepository {
  constructor(@Inject(TENANT_DATABASE) private readonly database: TenantDatabase) {}

  listDueOrganizationIds(limit: number): Promise<readonly string[]> {
    return this.database.listDueOutboxOrganizationIds(limit);
  }

  health(): Promise<OutboxRelayHealth> {
    return this.database.outboxRelayHealth();
  }

  async claimDue(
    organizationId: string,
    options: Readonly<{
      batchSize: number;
      leaseMs: number;
      maxDispatchAttempts: number;
    }>,
  ): Promise<OutboxClaimBatch> {
    return this.database.withTenant(
      workerContext(organizationId, 'outbox-relay-claim'),
      async (transaction) => {
        const exhausted = await transaction.$executeRaw`
          UPDATE outbox_event
          SET status = 'FAILED'
          WHERE organization_id = ${organizationId}::uuid
            AND status IN ('PENDING', 'PROCESSING')
            AND available_at <= CURRENT_TIMESTAMP
            AND attempts >= ${options.maxDispatchAttempts}
        `;
        const rows = await transaction.$queryRaw<ClaimedOutboxRow[]>`
          WITH due AS (
            SELECT organization_id, id
            FROM outbox_event
            WHERE organization_id = ${organizationId}::uuid
              AND status IN ('PENDING', 'PROCESSING')
              AND available_at <= CURRENT_TIMESTAMP
              AND attempts < ${options.maxDispatchAttempts}
            ORDER BY available_at, created_at, id
            FOR UPDATE SKIP LOCKED
            LIMIT ${options.batchSize}
          )
          UPDATE outbox_event AS event
          SET
            status = 'PROCESSING',
            attempts = event.attempts + 1,
            available_at = CURRENT_TIMESTAMP + (${options.leaseMs} * INTERVAL '1 millisecond'),
            completed_at = NULL
          FROM due
          WHERE event.organization_id = due.organization_id
            AND event.id = due.id
          RETURNING
            event.id,
            event.organization_id,
            event.event_type,
            event.aggregate_type,
            event.aggregate_id,
            event.request_id,
            event.attempts
        `;
        return {
          events: rows.map(mapClaimedRow),
          exhausted,
        };
      },
    );
  }

  async generationState(job: OutboxDispatchJob): Promise<OutboxGenerationState> {
    return this.database.withTenant(
      workerContext(job.organizationId, job.requestId),
      async (transaction) => {
        const event = await transaction.outboxEvent.findUnique({
          where: {
            organizationId_id: {
              organizationId: job.organizationId,
              id: job.eventId,
            },
          },
          select: {
            aggregateId: true,
            aggregateType: true,
            attempts: true,
            eventType: true,
            requestId: true,
            status: true,
          },
        });
        if (
          event === null ||
          event.status !== 'PROCESSING' ||
          event.attempts !== job.dispatchAttempt
        ) {
          return 'STALE';
        }
        if (
          event.eventType !== job.eventType ||
          event.aggregateType !== job.aggregateType ||
          event.aggregateId !== job.aggregateId ||
          event.requestId !== job.requestId
        ) {
          throw new Error('Outbox job metadata does not match the authoritative event.');
        }
        return 'CURRENT';
      },
    );
  }

  async complete(job: OutboxDispatchJob): Promise<boolean> {
    return this.database.withTenant(
      workerContext(job.organizationId, job.requestId),
      async (transaction) => (await fencedTransition(transaction, job, 'COMPLETED', 0)) === 1,
    );
  }

  async releaseOrFail(job: OutboxDispatchJob, maxDispatchAttempts: number): Promise<boolean> {
    const terminal = job.dispatchAttempt >= maxDispatchAttempts;
    const delayMs = terminal ? 0 : outboxRetryDelayMs(job.dispatchAttempt);
    return this.database.withTenant(
      workerContext(job.organizationId, job.requestId),
      async (transaction) =>
        (await fencedTransition(transaction, job, terminal ? 'FAILED' : 'PENDING', delayMs)) === 1,
    );
  }
}

function workerContext(organizationId: string, requestId: string) {
  return {
    organizationId,
    requestId,
    source: 'WORKER' as const,
    userId: null,
  };
}

function mapClaimedRow(row: ClaimedOutboxRow): ClaimedOutboxEvent {
  return {
    aggregateId: row.aggregate_id,
    aggregateType: row.aggregate_type,
    dispatchAttempt: row.attempts,
    eventId: row.id,
    eventType: row.event_type,
    organizationId: row.organization_id,
    requestId: row.request_id,
  };
}

async function fencedTransition(
  transaction: TenantTransaction,
  job: OutboxDispatchJob,
  status: 'COMPLETED' | 'FAILED' | 'PENDING',
  delayMs: number,
): Promise<number> {
  if (status === 'COMPLETED') {
    return transaction.$executeRaw`
      UPDATE outbox_event
      SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP
      WHERE organization_id = ${job.organizationId}::uuid
        AND id = ${job.eventId}::uuid
        AND status = 'PROCESSING'
        AND attempts = ${job.dispatchAttempt}
    `;
  }
  return transaction.$executeRaw`
    UPDATE outbox_event
    SET
      status = ${status}::"OutboxStatus",
      available_at = CURRENT_TIMESTAMP + (${delayMs} * INTERVAL '1 millisecond'),
      completed_at = NULL
    WHERE organization_id = ${job.organizationId}::uuid
      AND id = ${job.eventId}::uuid
      AND status = 'PROCESSING'
      AND attempts = ${job.dispatchAttempt}
  `;
}
