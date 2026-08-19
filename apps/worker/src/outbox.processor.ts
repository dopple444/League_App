import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { z } from 'zod';

export const OUTBOX_QUEUE = 'authoritative-outbox';

const outboxJobSchema = z
  .object({
    actorId: z.uuid(),
    eventId: z.uuid(),
    eventType: z.string().min(1).max(100),
    organizationId: z.uuid(),
    requestId: z.string().min(1).max(200),
  })
  .strict();

@Processor(OUTBOX_QUEUE)
export class OutboxProcessor extends WorkerHost {
  private readonly logger = new Logger(OutboxProcessor.name);

  override async process(job: Job<unknown, void, string>): Promise<void> {
    const payload = outboxJobSchema.parse(job.data);
    // Payload content is deliberately not logged. Milestone 1 proves durable receipt only;
    // external side effects are introduced behind explicit provider adapters later.
    this.logger.log({
      eventId: payload.eventId,
      eventType: payload.eventType,
      jobId: job.id,
      organizationId: payload.organizationId,
      requestId: payload.requestId,
    });
    await Promise.resolve();
  }
}
