import { ServiceUnavailableException } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';

import type { WorkerConfig } from '../src/config.js';
import { HealthController } from '../src/health.controller.js';
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

describe('HealthController', () => {
  it('reports aggregate backlog as degraded without failing readiness', async () => {
    const queue = {
      getJobCounts: vi.fn().mockResolvedValue({ active: 1, failed: 0, waiting: 2 }),
    } as unknown as Queue;
    const repository = {
      health: vi.fn().mockResolvedValue({
        failed: 1,
        oldestDueSeconds: 75,
        pending: 2,
        processing: 1,
      }),
    } as unknown as OutboxRepository;
    const controller = new HealthController(config, queue, repository);

    await expect(controller.health()).resolves.toEqual({
      dependencies: { database: 'ready', queue: 'ready' },
      outbox: { failed: 1, oldestDueSeconds: 75, pending: 2, processing: 1 },
      queue: { active: 1, failed: 0, waiting: 2 },
      service: 'worker',
      status: 'degraded',
    });
  });

  it('returns unavailable when either dependency cannot be queried', async () => {
    const queue = {
      getJobCounts: vi.fn().mockRejectedValue(new Error('synthetic Redis outage')),
    } as unknown as Queue;
    const repository = {
      health: vi.fn().mockResolvedValue({
        failed: 0,
        oldestDueSeconds: null,
        pending: 0,
        processing: 0,
      }),
    } as unknown as OutboxRepository;
    const controller = new HealthController(config, queue, repository);

    await expect(controller.health()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
