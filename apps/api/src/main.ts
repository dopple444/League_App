import 'reflect-metadata';

import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

import type { LeagueAuth } from '@league/auth';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyInstance } from 'fastify';

import { AppModule } from './app.module.js';
import { LEAGUE_AUTH } from './common/tokens.js';

function registerRequestIds(server: FastifyInstance): void {
  server.addHook('onRequest', (request, reply, done) => {
    const incoming = request.headers['x-request-id'];
    const requestId =
      typeof incoming === 'string' && incoming.length > 0 && incoming.length <= 128
        ? incoming
        : randomUUID();
    (request as typeof request & { requestId: string }).requestId = requestId;
    void reply.header('x-request-id', requestId);
    done();
  });
}

function registerAuth(server: FastifyInstance, auth: LeagueAuth): void {
  server.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    async handler(request, reply) {
      const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
      const fetchRequest = new Request(url, {
        method: request.method,
        headers: fromNodeHeaders(request.headers),
        ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
      });
      const response = await auth.handler(fetchRequest);
      void reply.status(response.status);
      response.headers.forEach((value, key) => void reply.header(key, value));
      return response.body === null ? reply.send() : reply.send(await response.text());
    },
  });
}

export async function createApplication(): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: false }),
  );
  app.enableShutdownHooks();
  app.enableCors({
    origin: (process.env.WEB_ORIGIN ?? 'http://localhost:8080')
      .split(',')
      .map((origin) => origin.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Idempotency-Key', 'X-Request-Id', 'X-Client-Source'],
  });
  // Nest's adapter and the direct Fastify dependency can temporarily resolve
  // to distinct patch-level type identities during a workspace install.
  const server = app.getHttpAdapter().getInstance() as unknown as FastifyInstance;
  registerRequestIds(server);
  registerAuth(server, app.get<LeagueAuth>(LEAGUE_AUTH));
  return app;
}

export async function bootstrap(): Promise<void> {
  const app = await createApplication();
  const port = Number.parseInt(process.env.API_PORT ?? '3001', 10);
  await app.listen(port, '0.0.0.0');
}

const entrypoint = process.argv[1];
if (entrypoint !== undefined && import.meta.url === pathToFileURL(entrypoint).href) {
  await bootstrap();
}
