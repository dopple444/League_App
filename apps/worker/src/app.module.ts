import { BullModule } from '@nestjs/bullmq';
import { createPrismaClient, TenantDatabase, type PrismaClient } from '@league/database';
import { Module, type OnModuleDestroy, type Type } from '@nestjs/common';

import type { WorkerConfig } from './config.js';
import { HealthController } from './health.controller.js';
import { OUTBOX_QUEUE } from './outbox.contract.js';
import { OutboxProcessor } from './outbox.processor.js';
import { OutboxRelay } from './outbox.relay.js';
import { OutboxRepository } from './outbox.repository.js';
import { PRISMA, TENANT_DATABASE, WORKER_CONFIG } from './tokens.js';

class PrismaLifecycle implements OnModuleDestroy {
  constructor(private readonly prisma: PrismaClient) {}

  onModuleDestroy(): Promise<void> {
    return this.prisma.$disconnect();
  }
}

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
    providers: [
      { provide: WORKER_CONFIG, useValue: config },
      {
        provide: PRISMA,
        useFactory: () => createPrismaClient(config.databaseUrl),
      },
      {
        provide: TENANT_DATABASE,
        inject: [PRISMA],
        useFactory: (prisma: PrismaClient) => new TenantDatabase(prisma),
      },
      {
        provide: PrismaLifecycle,
        inject: [PRISMA],
        useFactory: (prisma: PrismaClient) => new PrismaLifecycle(prisma),
      },
      OutboxRepository,
      OutboxRelay,
      OutboxProcessor,
    ],
  })
  // Nest modules are declarative containers and intentionally have no instance members.
  // eslint-disable-next-line @typescript-eslint/no-extraneous-class
  class ConfiguredWorkerModule {}

  return ConfiguredWorkerModule;
}
