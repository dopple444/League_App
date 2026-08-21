import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import type { WorkerConfig } from './config.js';
import {
  OUTBOX_QUEUE,
  outboxDispatchJobSchema,
  type OutboxDispatchJob,
} from './outbox.contract.js';
import { OutboxRepository } from './outbox.repository.js';
import { failureClass } from './outbox.relay.js';
import { WORKER_CONFIG } from './tokens.js';

@Processor(OUTBOX_QUEUE)
export class OutboxProcessor extends WorkerHost {
  private readonly logger = new Logger(OutboxProcessor.name);

  constructor(
    @Inject(WORKER_CONFIG) private readonly config: WorkerConfig,
    @Inject(OutboxRepository) private readonly repository: OutboxRepository,
  ) {
    super();
  }

  override async process(job: Job<unknown, void, string>): Promise<void> {
    const parsed = outboxDispatchJobSchema.safeParse(job.data);
    if (!parsed.success) {
      this.logger.error({
        failureClass: 'InvalidEnvelope',
        jobId: job.id,
        message: 'Outbox job envelope is invalid.',
      });
      throw processingFailure();
    }
    const payload = parsed.data;
    try {
      const state = await this.repository.generationState(payload);
      if (state === 'STALE') {
        this.logStale(job, payload);
        return;
      }

      // Durable receipt only. A future event-specific handler must reload any
      // payload from PostgreSQL and use eventId as its idempotency key.
      const completed = await this.repository.complete(payload);
      if (!completed) {
        this.logStale(job, payload);
        return;
      }
      this.logger.log({
        dispatchAttempt: payload.dispatchAttempt,
        eventId: payload.eventId,
        eventType: payload.eventType,
        jobId: job.id,
        message: 'Outbox event durably received.',
        organizationId: payload.organizationId,
        requestId: payload.requestId,
      });
    } catch (error: unknown) {
      const finalBullAttempt = isFinalBullAttempt(job);
      if (finalBullAttempt) {
        try {
          await this.repository.releaseOrFail(payload, this.config.outbox.maxDispatchAttempts);
        } catch (releaseError: unknown) {
          this.logger.error({
            dispatchAttempt: payload.dispatchAttempt,
            eventId: payload.eventId,
            failureClass: failureClass(releaseError),
            jobId: job.id,
            message: 'Outbox processing recovery failed; the lease will recover the event.',
            organizationId: payload.organizationId,
            requestId: payload.requestId,
          });
        }
      }
      this.logger.error({
        dispatchAttempt: payload.dispatchAttempt,
        eventId: payload.eventId,
        failureClass: failureClass(error),
        finalBullAttempt,
        jobId: job.id,
        message: 'Outbox processing failed.',
        organizationId: payload.organizationId,
        requestId: payload.requestId,
      });
      throw processingFailure();
    }
  }

  private logStale(job: Job<unknown, void, string>, payload: OutboxDispatchJob): void {
    this.logger.log({
      dispatchAttempt: payload.dispatchAttempt,
      eventId: payload.eventId,
      jobId: job.id,
      message: 'Outbox job is duplicate or stale; no action was taken.',
      organizationId: payload.organizationId,
      requestId: payload.requestId,
    });
  }
}

function isFinalBullAttempt(job: Job<unknown, void, string>): boolean {
  return job.attemptsMade + 1 >= Math.max(1, job.opts.attempts ?? 1);
}

function processingFailure(): Error {
  const error = new Error('Outbox processing failed.');
  error.name = 'OutboxProcessingError';
  return error;
}
