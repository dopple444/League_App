import { BullModule } from '@nestjs/bullmq';
import { Module, type Type } from '@nestjs/common';

import type { WorkerConfig } from './config.js';
import { HealthController } from './health.controller.js';
import { OUTBOX_QUEUE, OutboxProcessor } from './outbox.processor.js';

export function createWorkerModule(config: WorkerConfig): Type<unknown> {
  @Module({
    controllers: [HealthController],
    imports: [
      BullModule.forRoot({
        connection: {
          db: config.redis.db,
          host: config.redis.host,
          ...(config.redis.password === undefined ? {} : { password: config.redis.password }),
          port: config.redis.port,
          ...(config.redis.tls ? { tls: {} } : {}),
          ...(config.redis.username === undefined ? {} : { username: config.redis.username }),
        },
        defaultJobOptions: {
          attempts: 5,
          backoff: { delay: 1_000, type: 'exponential' },
          removeOnComplete: { age: 86_400, count: 10_000 },
          removeOnFail: false,
        },
      }),
      BullModule.registerQueue({ name: OUTBOX_QUEUE }),
    ],
    providers: [OutboxProcessor],
  })
  // Nest modules are declarative containers and intentionally have no instance members.
  // eslint-disable-next-line @typescript-eslint/no-extraneous-class
  class ConfiguredWorkerModule {}

  return ConfiguredWorkerModule;
}
