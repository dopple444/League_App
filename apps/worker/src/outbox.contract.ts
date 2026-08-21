import { z } from 'zod';

export const OUTBOX_QUEUE = 'authoritative-outbox';
export const OUTBOX_JOB_NAME = 'durable-receipt';

export const outboxDispatchJobSchema = z
  .object({
    actor: z.object({ kind: z.literal('SYSTEM') }).strict(),
    aggregateId: z.string().min(1).max(200),
    aggregateType: z.string().min(1).max(100),
    dispatchAttempt: z.number().int().positive(),
    eventId: z.uuid(),
    eventType: z.string().min(1).max(100),
    organizationId: z.uuid(),
    requestId: z.string().min(1).max(200),
    schemaVersion: z.literal(1),
  })
  .strict();

export type OutboxDispatchJob = z.infer<typeof outboxDispatchJobSchema>;
