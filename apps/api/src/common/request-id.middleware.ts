import { randomUUID } from 'node:crypto';

import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import type { ApiRequest } from './request.js';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: ApiRequest, reply: FastifyReply['raw'], next: () => void): void {
    const incoming = request.headers['x-request-id'];
    const requestId =
      typeof incoming === 'string' && incoming.length > 0 && incoming.length <= 128
        ? incoming
        : randomUUID();
    request.requestId = requestId;
    reply.setHeader('x-request-id', requestId);
    next();
  }
}
