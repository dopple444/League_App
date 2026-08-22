# Transactional Outbox Relay

## Purpose and user outcome

Complete the durable delivery path started in Milestone 1. After an authoritative API transaction
commits state, audit history, and an outbox row, the worker must reliably claim that row, enqueue an
idempotent metadata-only BullMQ job, process it, and record completion or visible failure. PostgreSQL
remains authoritative and Redis may be lost or restarted without silently losing committed work.

The first handler proves durable internal receipt only. It sends no email, SMS, push, social post,
payment, webhook, or other external effect.

## Scope

### Included

- Add a due-organization discovery and aggregate-health database interface that does not bypass RLS
  or reveal tenant payloads.
- Claim due tenant rows with `FOR UPDATE SKIP LOCKED`, a bounded lease, attempt generation, and
  fencing on organization/event/status/attempt.
- Enqueue a strict versioned metadata-only BullMQ envelope using `<eventId>-<dispatchAttempt>` as the
  stable job ID for each dispatch generation.
- Reload the authoritative row from PostgreSQL in the processor, treat duplicate/stale jobs as no-op,
  and conditionally transition the current generation to `COMPLETED`, `PENDING`, or `FAILED`.
- Recover expired processing leases and Redis loss, use bounded exponential retry, and retain terminal
  failure for inspection.
- Extend worker health with PostgreSQL dependency state and aggregate pending/processing/failed/oldest
  due metadata without exposing payloads.
- Add unit, real-database, Redis, tenancy, migration, restore, and restart/recovery coverage.

### Excluded

- Provider adapters or real external sends/effects.
- An operator retry UI. `FAILED` remains visible and manually diagnosable until a separately governed
  reason-required retry workflow is registered and implemented.
- An event-schema registry for future feature-specific handlers beyond the durable-receipt handler.
- Giving the worker a migrator/owner credential, `BYPASSRLS`, or unscoped access to tenant payloads.

## Relevant requirements

- **FND-002 MUST** — all tenant row loads/transitions remain organization scoped and denial tested.
- **FND-006 MUST** — causal human actions remain attributable in the transaction's audit row; the
  relay is a system actor and must not invent a human actor.
- **OPS-003 MUST** — queue jobs, health output, and logs exclude payloads and sensitive data.
- **OPS-010 MUST** — queue/dead-letter visibility and dependency health exist before online beta.
- **OPS-013 MUST** — this relay does not authorize any real external effect.

## Current-state findings

- `MutationService.record` atomically inserts `audit_event` and `outbox_event` with authoritative
  state/idempotency handling. It correctly does not enqueue directly from the API transaction.
- `OutboxEvent` already has status, attempts, available/completed times, event/aggregate metadata,
  payload, request ID, and timestamps.
- `OutboxProcessor` consumes a BullMQ job but nothing creates that job, it never reads or advances the
  database row, and its required `actorId` does not exist on the outbox record.
- The worker currently has Redis configuration only. It has no PostgreSQL dependency or
  tenant-scoped repository.
- Forced RLS correctly prevents a worker from scanning all tenant rows directly. A narrowly scoped
  metadata-only discovery function is required; each claim/load/update then uses
  `TenantDatabase.withTenant`.
- Worker health checks Redis queue counts only.

## Proposed design

### Lifecycle semantics

- `PENDING`: eligible when `available_at <= now()`.
- `PROCESSING`: claimed by one dispatch generation; `available_at` is the lease expiry.
- `attempts`: PostgreSQL dispatch generation, incremented at each initial/reclaim operation.
- `COMPLETED`: the current processor generation succeeded; set `completed_at`.
- `FAILED`: the configured dispatch-generation limit is exhausted; retain the row and failure metadata
  for visibility.

BullMQ attempts are retries within one PostgreSQL dispatch generation and remain distinct from the
database `attempts` counter.

### Database access and RLS

Add an index covering global relay discovery by status/availability/organization. Add
`SECURITY DEFINER` functions owned by the RLS owner that expose only:

1. bounded organization UUIDs having due pending or expired-processing rows; and
2. aggregate relay counts/oldest-due age for health.

Revoke public execution and grant only the runtime/test roles. The worker uses its ordinary runtime
database credential. After discovery, it enters `TenantDatabase.withTenant` and claims a bounded batch
using a raw SQL CTE with `FOR UPDATE SKIP LOCKED`. All later transitions include
`organization_id`, `id`, `status = PROCESSING`, and `attempts = dispatchAttempt` as a fence.

### Job contract

The strict envelope is:

```ts
{
  schemaVersion: 1;
  eventId: string;
  organizationId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  requestId: string;
  dispatchAttempt: number;
  actor: { kind: 'SYSTEM' };
}
```

No outbox payload enters Redis or logs. A future handler that needs payload data reloads it under the
tenant context. Use `<eventId>-<dispatchAttempt>` for the BullMQ job ID so a retained failed job cannot
block a later lease-recovery generation.

### Relay and processor

Use a non-overlapping lifecycle timer with graceful shutdown. Every second, discover at most 100 due
organizations and claim at most 25 events per organization with a 60-second lease. Queue-add failure
conditionally releases the generation to `PENDING` with capped exponential backoff or marks it
`FAILED` after 10 generations.

The processor validates the envelope, reloads the row, exits successfully for completed/stale
generations, performs durable receipt, and conditionally completes the current generation. A final
BullMQ failure releases the current generation for later PostgreSQL retry or marks it terminal. Redis
flush/loss and worker crashes recover after lease expiry.

### Health and observability

Health returns 503 only when PostgreSQL or Redis is unavailable so backlog does not cause a restart
loop. It reports queue counts plus aggregate pending/processing/failed/oldest-due values and a
degraded indication. Logs contain event ID, event type, organization ID, request ID, dispatch attempt,
and job ID only—never payload, actor contact data, or raw exception/provider response.

## Milestones

- [x] Add the forward migration for discovery index/functions/grants and verify forced-RLS access.
- [x] Add worker database/config/repository/job-contract wiring with exact dependencies.
- [x] Implement non-overlapping claim/enqueue/release/fail relay behavior and graceful shutdown.
- [x] Implement authoritative reload, stale-generation no-op, completion, and processor failure
      recovery.
- [x] Extend dependency/backlog health without payload leakage or restart loops.
- [x] Prove unit, concurrent claim, duplicate, lease expiry, Redis loss, exhausted retry, tenant
      denial, migration, and restore behavior.
- [x] Update assurance, decisions, status, and the controlled-beta plan with exact evidence.

## Verification and acceptance

Run and record:

```bash
pnpm install --frozen-lockfile
pnpm --filter @league/database lint
pnpm --filter @league/database typecheck
pnpm --filter @league/database test
pnpm --filter @league/worker lint
pnpm --filter @league/worker typecheck
pnpm --filter @league/worker test
pnpm db:migrate:verify
pnpm db:seed:verify
pnpm test:integration
pnpm test:tenancy
pnpm test:authz
pnpm db:restore:verify
pnpm compose:config
pnpm stack:smoke
TURBO_CONCURRENCY=2 pnpm build
git diff --check
```

Acceptance must prove:

- one real API mutation creates exactly one pending row and progresses it to completed;
- API idempotency replay creates no second row or effective job;
- concurrent relays claim each row once;
- stale/duplicate jobs do not perform the handler twice or complete a newer generation;
- crash/Redis-loss lease expiry causes successful reclaim;
- bounded retry becomes visible terminal failure;
- missing/wrong tenant context cannot read or transition another tenant row;
- queue/log/health assertions contain no event payload;
- migration/seed/restore preserve pending, processing, completed, and failed lifecycle data.

## Migration, rollback, and data compatibility

Use an additive forward migration. Preserve all current rows as pending unless already marked
otherwise; do not infer delivery. Existing lifecycle columns remain compatible. Add only the relay
index and controlled functions/grants unless testing proves a bounded error-classification field is
required. Rollback disables the relay and deploys the prior worker; database rows/history remain
intact for forward recovery. Never delete failed or stuck events to recover service.

## Security and privacy review

- Worker uses the non-owner runtime database role and tenant context for every payload row.
- Security-definer functions return organization IDs or aggregates only, set a safe search path, and
  are granted narrowly.
- Redis jobs and logs contain metadata only. Payload never crosses the queue boundary.
- Future external handlers must use event ID as provider/idempotency key because a crash after an
  external effect but before completion can replay under at-least-once delivery.
- Health reveals no tenant names, aggregate IDs, requests, or payloads to unauthenticated callers.
- No external provider adapter or effect is introduced by this plan.

## Decisions made

- Use PostgreSQL-authoritative at-least-once delivery; Redis is disposable transport.
- Represent the relay actor as `SYSTEM`; retain the human causal actor in the atomic audit record.
- Use dispatch-attempt fencing and generation-specific job IDs to prevent stale completion.
- Keep `MutationService.record` transaction-only and do not enqueue from the API.
- Terminal failed rows require later reasoned/audited operator action; they are never silently dropped
  or retried forever.

## Discoveries and risks

- Forced RLS requires a carefully reviewed metadata-only discovery function. A broad security-definer
  payload reader would violate the tenant model.
- The current `actorId` job requirement is impossible and must be replaced rather than inferred from
  non-unique request IDs.
- At-least-once delivery cannot guarantee an external side effect occurred once unless every future
  adapter supplies the stable event ID to an idempotent provider boundary.
- Local synthetic credentials were displayed during a read-only Compose audit. Rotate/recreate the
  local synthetic environment after this migration is ready, then rebuild, migrate, seed, and rerun
  acceptance. Never reuse those values in beta.

## Progress log

- 2026-08-21 — Audited mutation insertion, Prisma lifecycle fields, forced RLS, worker queue/processor,
  health, configuration, and Compose wiring. Selected the PostgreSQL-authoritative metadata-only
  relay with generation fencing and lease recovery.
- 2026-08-21 — Implemented the migration, tenant database helpers, strict queue contract, fenced
  repository, non-overlapping relay, processor recovery, aggregate health, Compose configuration,
  and CI-discovered PostgreSQL test lane. Restricted the definer role to organization/status/time
  columns and prevented the production runtime role from deleting an outbox record or rewriting its
  payload/identity fields.
- 2026-08-21 — `pnpm --filter @league/worker test` passed 19 tests with the four environment-gated
  PostgreSQL cases skipped. `pnpm db:migrate:verify` then applied the additive migration to the
  synthetic test database and passed the repeat no-op; `pnpm test:outbox` passed 4/4 real-PostgreSQL
  cases covering metadata-only discovery, wrong-tenant denial, concurrent claim, expired-lease
  reclaim, stale fencing, terminal failure, and least-privilege grants. Database tests passed 3/3;
  worker/database lint, typecheck, and builds passed. A real relay-through-Redis completion/restart
  rehearsal and restore verification remain open before this plan is complete.
- 2026-08-21 — Rotated the generated local credentials, recreated only the four synthetic Compose
  volumes, rebuilt the application images, applied both migrations, and passed idempotent main/test
  seed verification. Added `pnpm acceptance:outbox`, whose default, `worker-restart`, and
  `redis-restart` modes authenticate through the loopback gateway, commit one real season mutation,
  prove exactly one audit/outbox/idempotency record, wait for `COMPLETED`, replay without a duplicate,
  and strictly validate metadata-only worker health. The Redis phase commits while Redis is stopped
  and then proves recovery after restart without clearing its persistent volume.
- 2026-08-21 — The live default, worker-restart, and Redis-restart rehearsals passed. A focused worker
  log assertion found no season name or slug payload, while permitted event/organization/request/job
  metadata remained visible. `pnpm db:restore:verify` now compares a repeatable-snapshot SHA-256 over
  every outbox row's identity and lifecycle fields and passed after the retained rehearsal history.
  `pnpm stack:smoke` passed all five probes. This plan's durable internal-receipt scope is complete;
  real external handlers and an operator retry UI remain separately governed work.
