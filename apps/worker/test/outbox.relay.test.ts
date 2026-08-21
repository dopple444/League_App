import { Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { WorkerConfig } from '../src/config.js';
import type { OutboxDispatchJob } from '../src/outbox.contract.js';
import { OutboxRelay } from '../src/outbox.relay.js';
import type { OutboxRepository } from '../src/outbox.repository.js';

const config: WorkerConfig = {
  databaseUrl: 'postgresql://synthetic:synthetic@postgres:5432/league_test',
  logLevel: 'error',
  nodeEnvironment: 'test',
  outbox: {
    batchSize: 25,
    discoveryLimit: 100,
    leaseMs: 60_000,
    maxDispatchAttempts: 10,
    pollIntervalMs: 1_000,
  },
  port: 3002,
  redis: { db: 0, host: 'redis', port: 6379, tls: false },
};

const event = {
  aggregateId: 'season-1',
  aggregateType: 'Season',
  dispatchAttempt: 1,
  eventId: '00000000-0000-4000-8000-000000000101',
  eventType: 'season.created',
  organizationId: '00000000-0000-4000-8000-000000000001',
  requestId: 'request-1',
} as const;

describe('OutboxRelay', () => {
  afterEach(() => vi.restoreAllMocks());

  it('enqueues a metadata-only job with a generation-specific ID', async () => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const repository = {
      claimDue: vi.fn().mockResolvedValue({ events: [event], exhausted: 0 }),
      listDueOrganizationIds: vi.fn().mockResolvedValue([event.organizationId]),
      releaseOrFail: vi.fn(),
    } as unknown as OutboxRepository;
    const add = vi.fn().mockResolvedValue({ id: `${event.eventId}-1` });
    const relay = new OutboxRelay(config, repository, { add } as unknown as Queue<
      OutboxDispatchJob,
      void,
      string
    >);

    await relay.runOnce();

    expect(add).toHaveBeenCalledWith(
      'durable-receipt',
      {
        actor: { kind: 'SYSTEM' },
        aggregateId: event.aggregateId,
        aggregateType: event.aggregateType,
        dispatchAttempt: 1,
        eventId: event.eventId,
        eventType: event.eventType,
        organizationId: event.organizationId,
        requestId: event.requestId,
        schemaVersion: 1,
      },
      { jobId: `${event.eventId}-1` },
    );
    expect(JSON.stringify(add.mock.calls)).not.toContain('payload');
  });

  it('does not overlap polls', async () => {
    let resolveOrganizations: ((value: readonly string[]) => void) | undefined;
    const organizations = new Promise<readonly string[]>((resolve) => {
      resolveOrganizations = resolve;
    });
    const listDueOrganizationIds = vi.fn().mockReturnValue(organizations);
    const repository = {
      listDueOrganizationIds,
    } as unknown as OutboxRepository;
    const relay = new OutboxRelay(config, repository, { add: vi.fn() } as unknown as Queue<
      OutboxDispatchJob,
      void,
      string
    >);

    const first = relay.runOnce();
    const second = relay.runOnce();
    expect(second).toBe(first);
    expect(listDueOrganizationIds).toHaveBeenCalledOnce();
    resolveOrganizations?.([]);
    await first;
  });

  it('releases a fenced generation when Redis enqueue fails', async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const releaseOrFail = vi.fn().mockResolvedValue(true);
    const repository = {
      claimDue: vi.fn().mockResolvedValue({ events: [event], exhausted: 0 }),
      listDueOrganizationIds: vi.fn().mockResolvedValue([event.organizationId]),
      releaseOrFail,
    } as unknown as OutboxRepository;
    const relay = new OutboxRelay(config, repository, {
      add: vi.fn().mockRejectedValue(new Error('synthetic Redis outage')),
    } as unknown as Queue<OutboxDispatchJob, void, string>);

    await relay.runOnce();
    expect(releaseOrFail).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: event.eventId, dispatchAttempt: 1 }),
      10,
    );
  });
});
