import type { TenantDatabase } from '@league/database';
import { describe, expect, it, vi } from 'vitest';

import type { OutboxDispatchJob } from '../src/outbox.contract.js';
import { OutboxRepository, outboxRetryDelayMs } from '../src/outbox.repository.js';

const job: OutboxDispatchJob = {
  actor: { kind: 'SYSTEM' },
  aggregateId: 'season-1',
  aggregateType: 'Season',
  dispatchAttempt: 2,
  eventId: '00000000-0000-4000-8000-000000000101',
  eventType: 'season.created',
  organizationId: '00000000-0000-4000-8000-000000000001',
  requestId: 'request-1',
  schemaVersion: 1,
};

describe('OutboxRepository', () => {
  it('maps claimed metadata without returning the authoritative payload', async () => {
    const executeRaw = vi.fn().mockResolvedValue(1);
    const queryRaw = vi.fn().mockResolvedValue([
      {
        aggregate_id: job.aggregateId,
        aggregate_type: job.aggregateType,
        attempts: job.dispatchAttempt,
        event_type: job.eventType,
        id: job.eventId,
        organization_id: job.organizationId,
        payload: { mustNotEscape: true },
        request_id: job.requestId,
      },
    ]);
    const transaction = { $executeRaw: executeRaw, $queryRaw: queryRaw };
    const withTenant = vi.fn(
      async (_context: unknown, operation: (value: unknown) => Promise<unknown>) =>
        operation(transaction),
    );
    const repository = new OutboxRepository({ withTenant } as unknown as TenantDatabase);

    await expect(
      repository.claimDue(job.organizationId, {
        batchSize: 25,
        leaseMs: 60_000,
        maxDispatchAttempts: 10,
      }),
    ).resolves.toEqual({
      events: [
        {
          aggregateId: job.aggregateId,
          aggregateType: job.aggregateType,
          dispatchAttempt: job.dispatchAttempt,
          eventId: job.eventId,
          eventType: job.eventType,
          organizationId: job.organizationId,
          requestId: job.requestId,
        },
      ],
      exhausted: 1,
    });
    expect(withTenant).toHaveBeenCalledOnce();
  });

  it('accepts only the current fenced generation with matching metadata', async () => {
    const findUnique = vi.fn().mockResolvedValue({
      aggregateId: job.aggregateId,
      aggregateType: job.aggregateType,
      attempts: job.dispatchAttempt,
      eventType: job.eventType,
      requestId: job.requestId,
      status: 'PROCESSING',
    });
    const transaction = { outboxEvent: { findUnique } };
    const withTenant = vi.fn(
      async (_context: unknown, operation: (value: unknown) => Promise<unknown>) =>
        operation(transaction),
    );
    const repository = new OutboxRepository({ withTenant } as unknown as TenantDatabase);

    await expect(repository.generationState(job)).resolves.toBe('CURRENT');
    findUnique.mockResolvedValueOnce({
      aggregateId: job.aggregateId,
      aggregateType: job.aggregateType,
      attempts: job.dispatchAttempt + 1,
      eventType: job.eventType,
      requestId: job.requestId,
      status: 'PROCESSING',
    });
    await expect(repository.generationState(job)).resolves.toBe('STALE');
  });

  it('uses capped exponential dispatch backoff', () => {
    expect(outboxRetryDelayMs(1)).toBe(1_000);
    expect(outboxRetryDelayMs(2)).toBe(2_000);
    expect(outboxRetryDelayMs(100)).toBe(300_000);
    expect(() => outboxRetryDelayMs(0)).toThrow(RangeError);
  });
});
