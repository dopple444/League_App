import { describe, expect, it } from 'vitest';

import { outboxDispatchJobSchema } from '../src/outbox.contract.js';

const validJob = {
  actor: { kind: 'SYSTEM' },
  aggregateId: 'season-1',
  aggregateType: 'Season',
  dispatchAttempt: 1,
  eventId: '00000000-0000-4000-8000-000000000101',
  eventType: 'season.created',
  organizationId: '00000000-0000-4000-8000-000000000001',
  requestId: 'request-1',
  schemaVersion: 1,
} as const;

describe('outbox dispatch contract', () => {
  it('accepts a versioned system envelope containing metadata only', () => {
    expect(outboxDispatchJobSchema.parse(validJob)).toEqual(validJob);
  });

  it('rejects payloads, invented actor IDs, and unknown fields', () => {
    expect(() =>
      outboxDispatchJobSchema.parse({ ...validJob, payload: { private: true } }),
    ).toThrow();
    expect(() =>
      outboxDispatchJobSchema.parse({ ...validJob, actorId: validJob.eventId }),
    ).toThrow();
  });
});
