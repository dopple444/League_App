import {
  AuthorizationDeniedError,
  IdempotencyConflictError,
  VersionConflictError,
} from '@league/domain';
import { Catch, type ArgumentsHost, type ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ZodError } from 'zod';

import {
  AuthenticationRequiredError,
  InvalidIdempotencyKeyError,
  ResourceNotFoundError,
} from './errors.js';
import type { ApiRequest } from './request.js';

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<ApiRequest>();
    const reply = http.getResponse<FastifyReply>();
    const requestId = request.requestId ?? 'unavailable';

    if (exception instanceof ZodError) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of exception.issues) {
        const key = issue.path.join('.') || 'request';
        fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
      }
      void reply.status(HttpStatus.BAD_REQUEST).send({
        code: 'VALIDATION_FAILED',
        message: 'The request contains invalid fields.',
        requestId,
        fieldErrors,
      });
      return;
    }

    const known = this.knownError(exception);
    if (known !== null) {
      void reply.status(known.status).send({
        code: known.code,
        message: known.message,
        requestId,
      });
      return;
    }

    void reply.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
      code: 'INTERNAL_ERROR',
      message: 'The request could not be completed.',
      requestId,
    });
  }

  private knownError(exception: unknown): { status: number; code: string; message: string } | null {
    if (exception instanceof AuthenticationRequiredError) {
      return { status: 401, code: exception.code, message: exception.message };
    }
    if (exception instanceof AuthorizationDeniedError) {
      return { status: 403, code: exception.code, message: exception.message };
    }
    if (exception instanceof ResourceNotFoundError) {
      return { status: 404, code: exception.code, message: exception.message };
    }
    if (
      exception instanceof VersionConflictError ||
      exception instanceof IdempotencyConflictError
    ) {
      return { status: 409, code: exception.code, message: exception.message };
    }
    if (
      exception instanceof InvalidIdempotencyKeyError ||
      (exception instanceof Error && exception.name === 'InvalidIdempotencyKeyError')
    ) {
      return { status: 400, code: 'INVALID_IDEMPOTENCY_KEY', message: exception.message };
    }
    return null;
  }
}
