import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { WorkerConfig } from '../src/config.js';
import type { OutboxDispatchJob } from '../src/outbox.contract.js';
import { OutboxProcessor } from '../src/outbox.processor.js';
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

const payload: OutboxDispatchJob = {
  actor: { kind: 'SYSTEM' },
  aggregateId: 'season-1',
  aggregateType: 'Season',
  dispatchAttempt: 1,
  eventId: '00000000-0000-4000-8000-000000000101',
  eventType: 'season.created',
  organizationId: '00000000-0000-4000-8000-000000000001',
  requestId: 'request-1',
  schemaVersion: 1,
};

function bullJob(overrides: Partial<Job<unknown, void, string>> = {}): Job<unknown, void, string> {
  return {
    attemptsMade: 0,
    data: payload,
    id: `${payload.eventId}-1`,
    opts: { attempts: 5 },
    ...overrides,
  } as Job<unknown, void, string>;
}

describe('OutboxProcessor', () => {
  afterEach(() => vi.restoreAllMocks());

  it('completes the current authoritative generation', async () => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const complete = vi.fn().mockResolvedValue(true);
    const repository = {
      complete,
      generationState: vi.fn().mockResolvedValue('CURRENT'),
      releaseOrFail: vi.fn(),
    } as unknown as OutboxRepository;
    const processor = new OutboxProcessor(config, repository);

    await processor.process(bullJob());
    expect(complete).toHaveBeenCalledWith(payload);
  });

  it('treats stale or duplicate generations as successful no-ops', async () => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const complete = vi.fn();
    const repository = {
      complete,
      generationState: vi.fn().mockResolvedValue('STALE'),
      releaseOrFail: vi.fn(),
    } as unknown as OutboxRepository;
    const processor = new OutboxProcessor(config, repository);

    await processor.process(bullJob());
    expect(complete).not.toHaveBeenCalled();
  });

  it('releases only after the final BullMQ attempt', async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const failure = new Error('synthetic handler failure');
    const releaseOrFail = vi.fn().mockResolvedValue(true);
    const repository = {
      complete: vi.fn(),
      generationState: vi.fn().mockRejectedValue(failure),
      releaseOrFail,
    } as unknown as OutboxRepository;
    const processor = new OutboxProcessor(config, repository);

    await expect(processor.process(bullJob({ attemptsMade: 3 }))).rejects.toMatchObject({
      name: 'OutboxProcessingError',
    });
    expect(releaseOrFail).not.toHaveBeenCalled();
    await expect(processor.process(bullJob({ attemptsMade: 4 }))).rejects.toMatchObject({
      name: 'OutboxProcessingError',
    });
    expect(releaseOrFail).toHaveBeenCalledWith(payload, 10);
  });

  it('rejects invalid envelopes without logging their contents', async () => {
    const errorLog = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const repository = {
      complete: vi.fn(),
      generationState: vi.fn(),
      releaseOrFail: vi.fn(),
    } as unknown as OutboxRepository;
    const processor = new OutboxProcessor(config, repository);

    await expect(
      processor.process(bullJob({ data: { payload: { privateMarker: 'must-not-log' } } })),
    ).rejects.toMatchObject({ name: 'OutboxProcessingError' });
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain('must-not-log');
  });
});
