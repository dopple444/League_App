import 'reflect-metadata';

import { ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

import { createWorkerModule } from './app.module.js';
import { loadWorkerConfig } from './config.js';

async function bootstrap(): Promise<void> {
  const config = loadWorkerConfig(process.env);
  const nestLogLevel = config.logLevel === 'info' ? 'log' : config.logLevel;
  const logger = new ConsoleLogger('Worker', {
    colors: false,
    json: true,
    logLevels: [nestLogLevel, 'error', 'fatal'],
    prefix: 'league',
  });
  const application = await NestFactory.create<NestFastifyApplication>(
    createWorkerModule(config),
    new FastifyAdapter({ logger: false }),
    { logger },
  );
  application.enableShutdownHooks();
  await application.listen(config.port, '0.0.0.0');
  logger.log(`Worker health server listening on port ${config.port}.`);
}

void bootstrap();
