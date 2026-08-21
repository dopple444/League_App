import { InjectQueue } from '@nestjs/bullmq';
import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import type { Queue } from 'bullmq';

import type { WorkerConfig } from './config.js';
import { OUTBOX_QUEUE } from './outbox.contract.js';
import { OutboxRepository } from './outbox.repository.js';
import { WORKER_CONFIG } from './tokens.js';

type WorkerHealth = Readonly<{
  dependencies: Readonly<{
    database: 'ready';
    queue: 'ready';
  }>;
  outbox: Readonly<{
    failed: number;
    oldestDueSeconds: number | null;
    pending: number;
    processing: number;
  }>;
  queue: Readonly<{
    active: number;
    failed: number;
    waiting: number;
  }>;
  service: 'worker';
  status: 'degraded' | 'ok';
}>;

@Controller()
export class HealthController {
  constructor(
    @Inject(WORKER_CONFIG) private readonly config: WorkerConfig,
    @InjectQueue(OUTBOX_QUEUE) private readonly outboxQueue: Queue,
    @Inject(OutboxRepository) private readonly repository: OutboxRepository,
  ) {}

  @Get('/healthz')
  async health(): Promise<WorkerHealth> {
    try {
      const [queue, outbox] = await Promise.all([
        this.outboxQueue.getJobCounts('waiting', 'active', 'failed'),
        this.repository.health(),
      ]);
      const queueCounts = {
        active: queue.active ?? 0,
        failed: queue.failed ?? 0,
        waiting: queue.waiting ?? 0,
      };
      const lagThresholdSeconds = this.config.outbox.leaseMs / 1_000;
      const degraded =
        queueCounts.failed > 0 ||
        outbox.failed > 0 ||
        (outbox.oldestDueSeconds !== null && outbox.oldestDueSeconds > lagThresholdSeconds);
      return {
        dependencies: { database: 'ready', queue: 'ready' },
        outbox,
        queue: queueCounts,
        service: 'worker',
        status: degraded ? 'degraded' : 'ok',
      };
    } catch {
      throw new ServiceUnavailableException({
        code: 'WORKER_NOT_READY',
        message: 'The worker database or queue is not ready.',
      });
    }
  }
}
