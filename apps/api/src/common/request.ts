import type { AuthenticatedUser } from '@league/auth';
import type { FastifyRequest } from 'fastify';

export type ApiRequest = FastifyRequest & {
  user?: AuthenticatedUser;
  requestId?: string;
};

export interface RequestMetadata {
  readonly requestId: string;
  readonly source: 'WEB' | 'MOBILE' | 'API';
}

export function requestMetadata(request: ApiRequest): RequestMetadata {
  const requestedSource = request.headers['x-client-source'];
  const value = Array.isArray(requestedSource) ? requestedSource[0] : requestedSource;
  const source = value === 'WEB' || value === 'MOBILE' ? value : 'API';
  return { requestId: request.requestId ?? 'unavailable', source };
}

export function requireIdempotencyKey(value: string | undefined): string {
  if (value === undefined || value.trim().length === 0 || value.length > 200) {
    const error = new Error('A valid Idempotency-Key header is required.');
    error.name = 'InvalidIdempotencyKeyError';
    throw error;
  }
  return value;
}
