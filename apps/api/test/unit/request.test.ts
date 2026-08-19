import { describe, expect, it } from 'vitest';

import {
  requestMetadata,
  requireIdempotencyKey,
  type ApiRequest,
} from '../../src/common/request.js';

describe('request metadata', () => {
  it('accepts only known client sources', () => {
    const request = {
      headers: { 'x-client-source': 'MOBILE' },
      requestId: 'request-1',
    } as unknown as ApiRequest;
    expect(requestMetadata(request)).toEqual({ requestId: 'request-1', source: 'MOBILE' });

    request.headers['x-client-source'] = 'untrusted';
    expect(requestMetadata(request).source).toBe('API');
  });

  it('requires a bounded idempotency key', () => {
    expect(requireIdempotencyKey('retry-1')).toBe('retry-1');
    expect(() => requireIdempotencyKey(undefined)).toThrow();
    expect(() => requireIdempotencyKey('x'.repeat(201))).toThrow();
  });
});
