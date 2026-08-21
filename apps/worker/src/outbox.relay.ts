import { InjectQueue } from '@nestjs/bullmq';
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import type { Queue } from 'bullmq';

import type { WorkerConfig } from './config.js';
import { OUTBOX_JOB_NAME, OUTBOX_QUEUE, type OutboxDispatchJob } from './outbox.contract.js';
import { OutboxRepository, type ClaimedOutboxEvent } from './outbox.repository.js';
import { WORKER_CONFIG } from './tokens.js';

@Injectable()
export class OutboxRelay implements OnApplicationBootstrap, OnApplicationShutdown {
  private inFlight: Promise<void> | null = null;
  private readonly logger = new Logger(OutboxRelay.name);
  private stopped = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(WORKER_CONFIG) private readonly config: WorkerConfig,
    @Inject(OutboxRepository) private readonly repository: OutboxRepository,
    @InjectQueue(OUTBOX_QUEUE) private readonly queue: Queue<OutboxDispatchJob, void, string>,
  ) {}

  onApplicationBootstrap(): void {
    this.stopped = false;
    this.schedulePoll();
    this.timer = setInterval(() => this.schedulePoll(), this.config.outbox.pollIntervalMs);
    this.timer.unref();
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopped = true;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.inFlight;
  }

  runOnce(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.inFlight !== null) return this.inFlight;

    const operation = this.poll().finally(() => {
      if (this.inFlight === operation) this.inFlight = null;
    });
    this.inFlight = operation;
    return operation;
  }

  private schedulePoll(): void {
    void this.runOnce().catch((error: unknown) => {
      this.logger.error({
        failureClass: failureClass(error),
        message: 'Outbox relay poll failed.',
      });
    });
  }

  private async poll(): Promise<void> {
    const organizationIds = await this.repository.listDueOrganizationIds(
      this.config.outbox.discoveryLimit,
    );
    for (const organizationId of organizationIds) {
      if (this.stopped) return;
      try {
        const claimed = await this.repository.claimDue(organizationId, {
          batchSize: this.config.outbox.batchSize,
          leaseMs: this.config.outbox.leaseMs,
          maxDispatchAttempts: this.config.outbox.maxDispatchAttempts,
        });
        if (claimed.exhausted > 0) {
          this.logger.warn({
            count: claimed.exhausted,
            message: 'Outbox events reached terminal dispatch failure.',
            organizationId,
          });
        }
        for (const event of claimed.events) await this.enqueue(event);
      } catch (error: unknown) {
        this.logger.error({
          failureClass: failureClass(error),
          message: 'Outbox organization poll failed.',
          organizationId,
        });
      }
    }
  }

  private async enqueue(event: ClaimedOutboxEvent): Promise<void> {
    const job: OutboxDispatchJob = {
      actor: { kind: 'SYSTEM' },
      aggregateId: event.aggregateId,
      aggregateType: event.aggregateType,
      dispatchAttempt: event.dispatchAttempt,
      eventId: event.eventId,
      eventType: event.eventType,
      organizationId: event.organizationId,
      requestId: event.requestId,
      schemaVersion: 1,
    };
    const jobId = `${event.eventId}-${event.dispatchAttempt}`;
    try {
      await this.queue.add(OUTBOX_JOB_NAME, job, { jobId });
      this.logger.log({
        dispatchAttempt: event.dispatchAttempt,
        eventId: event.eventId,
        eventType: event.eventType,
        jobId,
        message: 'Outbox event enqueued.',
        organizationId: event.organizationId,
        requestId: event.requestId,
      });
    } catch (error: unknown) {
      let released = false;
      try {
        released = await this.repository.releaseOrFail(job, this.config.outbox.maxDispatchAttempts);
      } catch (releaseError: unknown) {
        this.logger.error({
          dispatchAttempt: event.dispatchAttempt,
          eventId: event.eventId,
          failureClass: failureClass(releaseError),
          message: 'Outbox enqueue recovery failed; the lease will recover the event.',
          organizationId: event.organizationId,
          requestId: event.requestId,
        });
      }
      this.logger.error({
        dispatchAttempt: event.dispatchAttempt,
        eventId: event.eventId,
        failureClass: failureClass(error),
        message: 'Outbox enqueue failed.',
        organizationId: event.organizationId,
        released,
        requestId: event.requestId,
      });
    }
  }
}

export function failureClass(error: unknown): string {
  return error instanceof Error && error.name.length > 0 ? error.name : 'UnknownError';
}
