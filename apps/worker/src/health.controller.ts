import { InjectQueue } from '@nestjs/bullmq';
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import type { Queue } from 'bullmq';

import { OUTBOX_QUEUE } from './outbox.processor.js';

type WorkerHealth = Readonly<{
  queue: 'ready';
  service: 'worker';
  status: 'ok';
}>;

@Controller()
export class HealthController {
  constructor(@InjectQueue(OUTBOX_QUEUE) private readonly outboxQueue: Queue) {}

  @Get('/healthz')
  async health(): Promise<WorkerHealth> {
    try {
      await this.outboxQueue.getJobCounts('waiting', 'active', 'failed');
      return { queue: 'ready', service: 'worker', status: 'ok' };
    } catch {
      throw new ServiceUnavailableException({
        code: 'WORKER_NOT_READY',
        message: 'The worker queue is not ready.',
      });
    }
  }
}
