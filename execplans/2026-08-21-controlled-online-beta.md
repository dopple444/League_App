# Controlled Online Beta

## Purpose and user outcome

Deliver an invitation-only, browser-first online beta by 2026-09-15. An issued league administrator
must be able to sign in with a protected account, open an explicitly provisioned tenant, configure the
league's basic season/field/team structure, create and validate a manual schedule, publish approved
public information, and review attributable history. Invited public testers must be able to navigate
the published league, schedule, teams, and team pages from a TLS-protected hosted environment.

This target is a complete controlled-beta workflow, not completion of the nine-milestone commercial
roadmap. The beta uses synthetic or practice data only. Real participants, legal signatures, payments,
external messages, official games, and public production deployment remain disabled until their
separate requirements and Production Gates are satisfied.

## Scope

### Included

- Preserve and prove the current tenant-isolated season/team/publication vertical slice from a clean
  Git checkout and CI-equivalent environment.
- Complete the PostgreSQL transactional-outbox claim, enqueue, process, retry, recovery, and terminal
  lifecycle so committed authoritative events cannot be silently abandoned.
- Remove fixable high/critical vulnerabilities from deployed runtime images, minimize application
  runtime images, and record a narrow time-bounded exception only for an unreachable build-tool
  advisory if no patched compatible release exists.
- Add invitation or operator-issued account onboarding, privileged MFA/session controls, and
  authentication/write rate limits. Public self-sign-up remains disabled.
- Add assisted platform-operator provisioning for Organization, League, initial administrator, and
  beta feature entitlements. Every support/provisioning action is scoped, reasoned, and audited.
- Complete browser administration for organization/league basics, seasons, teams, venues, fields,
  manual schedule creation/edit/validation, explicit publication/revision, and public readback.
- Create an isolated hosted-beta deployment definition with TLS, private data services, secrets
  outside Git, encrypted off-site backup, restore verification, health/error/queue/disk/backup
  monitoring, and documented deploy/rollback/incident procedures.
- Run two-tenant synthetic UAT, denial/idempotency/retry/recovery tests, responsive accessibility
  checks, load/abuse smoke tests, and a recorded go/no-go rehearsal.

### Excluded

- Real participant, guardian, roster, eligibility, waiver, signature, medical, emergency, or minor
  data. The five authorized source files and approved legal bodies are still absent.
- Public self-service account or commercial tenant creation, subscription billing, quotas, custom
  domains, or unrestricted customer onboarding.
- Payment-provider connections, card handling, real invoices/charges/refunds, or SaaS billing.
- Real email, SMS, push, social publication, NWS automation, or AI-generated publication.
- Native-store distribution and the game-day live/offline scoring, umpire-attestation, official-book,
  stats, and standings milestones.
- The full OR-Tools schedule optimizer. The beta supports authoritative manual schedule operations
  with hard-conflict validation and versioned publication; solver work continues after this gate.
- DNS, firewall, public cloud/VPS creation, paid services, live credentials, or public deployment
  without the explicit Production Gate approval required by `IMPLEMENT.md`.

## Relevant requirements

- **FND-001 through FND-006 MUST** — tenant hierarchy, membership, granular permissions, independent
  authority, and attributable audit remain the foundation of every beta operation.
- **FND-009 MUST (beta subset)** — hosted-beta database/object/config backup and isolated restore are
  reproducible; tenant export UI may follow.
- **SCH-001 MUST (manual subset)** — administrators can define date-specific field/slot availability.
- **SCH-003, SCH-009 through SCH-011 MUST** — no simultaneous team assignment, schedule history,
  attributable revision, and hard-constraint validation apply to manual beta schedules.
- **SCH-013 MUST (beta subset)** — public web and basic ICS/CSV export are required; polished PDF and
  legacy spreadsheet-grid parity may follow if time remains.
- **OPS-001 through OPS-003 MUST** — privileged authentication/session protection, encryption, and
  redacted logs apply to the hosted beta.
- **OPS-006 through OPS-011 MUST** — accessibility, TLS/private networks, environment isolation,
  backup, monitoring, and incident response gate online exposure.
- **OPS-013 MUST** — public deployment, live credentials, real data, and external effects require
  explicit approval.

## Current-state findings

- The current checkpoint extends the transactional-outbox release foundation with tenant-scoped
  venue/field and league administration plus the runtime, CI, test, and security hardening required
  to preserve that increment safely.
- The local nine-service Compose stack is healthy behind `127.0.0.1:8088`. Public root, league home,
  schedule, directory, and team detail are responsive and navigable; remote testing requires secure
  forwarding because the gateway is not directly exposed to the LAN or public internet.
- Issued synthetic staff can select an existing organization, create/update versioned league basics,
  create/publish seasons and teams, and create/update versioned venues and nested fields through
  tenant-scoped browser workbenches. There is still no customer/operator tenant-provisioning
  workflow, privileged invitation/MFA flow, date-specific field availability, or manual schedule
  authoring UI/API.
- The PostgreSQL-authoritative transactional outbox now claims, enqueues, processes, retries,
  recovers, and visibly completes/fails events with metadata-only BullMQ jobs and generation fencing.
  Default, worker-restart, Redis-restart, and isolated restore rehearsals pass. Real external-effect
  handlers remain excluded from this beta foundation.
- Every hosted-beta-eligible application, gateway, database, and cache image passes the fixable
  HIGH/CRITICAL gate. The exact pinned MinIO, MinIO-client, and Mailpit development-only images remain
  report-only under `SEC-EXC-002` and are prohibited from the hosted-beta topology.
- Python dependencies are clean. `SEC-EXC-001` accepts only the two named `image-size@1.2.1`
  advisories on the `apps/mobile` to `metro@0.84.4` build-tool path, rejects scope or lockfile-graph
  drift, and expires fail-closed on 2026-09-15.
- There is no hosted-beta deployment overlay, real HTTPS origin, external secrets mechanism,
  privileged MFA/rate limiting, off-site backup schedule, or beta monitoring/alerting configuration.
- The authorized source workbooks/rules/waiver packet remain absent. No legal or source-derived
  feature may be represented as complete.

## Proposed design

### Beta boundary and feature flags

Use a separate `beta` environment and database populated only with synthetic/practice fixtures.
Expose only gateway ports 80/443. Keep PostgreSQL, Redis, object storage, scheduler, worker health,
and management interfaces on private networks. Add explicit beta feature flags so unavailable
registration, waiver, payment, messaging, scoring, and commercial functions are absent rather than
decorative or misleading. A persistent banner identifies the environment as an invitation-only beta.

### Transactional outbox

Run a single-purpose relay in the worker deployment. It periodically claims eligible rows with a
bounded PostgreSQL transaction and `FOR UPDATE SKIP LOCKED`, sets a lease/attempt state, and enqueues a
BullMQ job whose generation-specific ID is `<outboxEventId>-<dispatchAttempt>`. Queue insertion is
idempotent within a claim generation while a retained failed job cannot block a later lease-recovery
generation. The processor loads and validates the authoritative row, performs the registered internal
handler, and marks the fenced generation complete. Failures record only controlled classifications,
increment dispatch generations, and set exponential `available_at`; exhausted attempts enter a
visible failed state. Startup and a periodic recovery pass reclaim expired processing leases. Health
reports database-relay freshness, queue depth, oldest pending age, and failed count without logging
payloads.

The first handler proves durable internal receipt only. Real provider adapters remain disabled. This
is still valuable because later schedule exports, messages, files, and projections depend on the same
delivery contract.

### Authentication and assisted provisioning

Keep open sign-up disabled. A Platform Operator creates a tenant through a reason-required wizard that
atomically creates Organization, League, initial configuration, membership, and an invitation for one
administrator. Invitation acceptance verifies the issued address, establishes credentials, and
requires MFA enrollment before privileged administration. Operator access is separately permissioned
and audited; ordinary tenant administrators cannot enumerate or provision other tenants.

### League operations

Extend the existing versioned/audited command pattern. Venue, field, slot availability, game, and
schedule-version records carry `organization_id` and composite tenant constraints. Manual changes are
drafts until explicit publication. Validation blocks same-slot team/field collisions and invalid
season/team references. Publication snapshots continue to be the only public read source. Every
revision includes reason, actor, request/source, before/after reference, audit event, and outbox row.

### Hosted beta operations

Create a deployment overlay independent of local Compose. Terminate TLS at the reverse proxy with
HSTS after HTTPS verification; configure trusted origins/proxy handling and secure cookies; inject
secrets from the approved host, never Git. Use minimal multi-stage images, read-only filesystems where
possible, non-root users, resource limits, health checks, and private networks. Back up database,
object storage, configuration, and necessary key material to an approved encrypted off-site target.
Define alerting and runbooks for availability, error rate, queue age/failures, disk pressure, backup
failure, credential compromise, data incident, and restore/rollback.

## Milestones

- [x] 2026-08-21 — Checkpoint the verified navigable public-league slice in local Git and establish a
      clean working tree.
- [ ] 2026-08-21 through 2026-08-24 — Approve this controlled-beta contract, inventory deployed
      vulnerabilities, define clean-clone CI evidence, and record the hosting/domain/tester/source
      decisions required by the first Production Gate.
- [ ] 2026-08-22 through 2026-08-28 — Transactional outbox lifecycle and owned web/API/worker/scheduler
      runtime hardening are complete. Resolve or formally gate dependency and third-party image
      findings, complete clean-clone evidence, and pass the remaining foundation release matrix.
- [ ] 2026-08-27 through 2026-09-02 — Implement privileged auth controls, invitation acceptance, and
      assisted Organization/League/administrator provisioning with audit and cross-tenant denial.
- [ ] 2026-09-01 through 2026-09-06 — Venue/field administration is complete. Implement date-specific
      slot availability and manual schedule create/edit/validate/publish/revise flows plus public
      readback and basic export.
- [ ] 2026-09-04 through 2026-09-09 — Prepare the isolated hosted-beta overlay, TLS/trusted-origin
      configuration, secrets interface, backup/restore, monitoring, and deploy/rollback runbooks.
- [ ] 2026-09-09 through 2026-09-11 — Pass clean-clone CI, vulnerability, tenancy, authorization,
      restore, E2E, accessibility, synthetic load, rate-limit, and failure-recovery rehearsal.
- [ ] 2026-09-12 through 2026-09-14 — Invitation-only tester UAT and fix-only stabilization.
- [ ] 2026-09-15 — Present the exact hosted target, risk, rollback, verification, unresolved findings,
      and go/no-go record for explicit deployment approval.

## Verification and acceptance

Run and record at each affected slice:

```bash
pnpm install --frozen-lockfile
pnpm format:check
TURBO_CONCURRENCY=2 pnpm lint
TURBO_CONCURRENCY=2 pnpm typecheck
pnpm contracts:check
TURBO_CONCURRENCY=2 pnpm test:unit
pnpm test:mobile
TURBO_CONCURRENCY=2 pnpm build
pnpm compose:config
pnpm db:migrate:verify
pnpm db:seed:verify
pnpm test:integration
pnpm test:tenancy
pnpm test:authz
pnpm db:restore:verify
pnpm stack:smoke
pnpm test:e2e
pnpm test:a11y
pnpm security:dependencies
pnpm security:containers
pnpm import:check
git diff --check
```

Additional beta acceptance:

- The relay proves commit-before-enqueue, idempotent duplicate enqueue/process, concurrent relay
  exclusion, retry/backoff, expired-lease recovery, terminal failure visibility, and restart safety.
- A Platform Operator can provision a synthetic tenant and issue an invitation without granting
  cross-tenant access. The invited administrator must enroll MFA before privileged mutations.
- The tenant administrator can configure a venue/field/slot, create a conflict-free manual schedule,
  publish it, revise it with a reason, and see only the active snapshot publicly.
- Missing membership, wrong tenant, expired invitation, stale version, reused idempotency key,
  unavailable Redis, unavailable worker, and database restart paths fail closed or recover visibly.
- Desktop/mobile-web keyboard, focus, 200% zoom, screen-reader labeling, 44px targets, and WCAG 2.2 AA
  automated/manual checks are recorded for every new UI artifact.
- The isolated beta environment restores to a clean target within the recorded RTO and loses no more
  than the recorded RPO. Deploy and rollback are rehearsed without real data or external sends.
- Every deployed runtime image has zero unaccepted fixable HIGH/CRITICAL findings. Any upstream-only
  exception identifies package/path, reachability, owner, expiry, compensating controls, and removal
  trigger.

## Migration, rollback, and data compatibility

Use additive forward migrations. Every new tenant table includes `organization_id`, composite tenant
foreign keys, supporting indexes, and forced RLS before application use. Outbox migration preserves
existing pending rows and initializes lease/attempt fields without treating them as delivered.
Rollback is forward-fix: disable the relay or beta feature flag, retain all audit/outbox/publication
history, and deploy the prior application image. Hosted schema changes require a verified backup and
isolated restore before migration. No real-data migration or destructive repair is authorized.

## Security and privacy review

- Beta is synthetic/practice-only, invitation-only, and isolated from local development and future
  production. No real participant or legal artifact is imported.
- Public pages continue to read allowlisted immutable snapshots. Operator and tenant APIs never expose
  a tenant directory to ordinary users.
- MFA, rate limits, secure cookies, TLS, private networks, redaction, minimal runtime images, backup,
  monitoring, and incident response are release gates, not follow-up polish.
- Outbox payloads are never logged. Error fields use controlled classifications and bounded sanitized
  summaries; provider credentials and raw external responses are excluded.
- Production actions in `IMPLEMENT.md` remain blocked until the user approves the exact target and
  plan. Creating a deployment definition does not authorize infrastructure creation or exposure.

## Decisions made

- ADR-023: September 15 targets a controlled, invitation-only, browser-first hosted beta using only
  synthetic/practice data and a complete narrow workflow; it does not redefine the full commercial
  roadmap as complete.
- Reliability/security foundation precedes new beta mutations because onboarding and schedule
  publication must not add undeliverable events or widen an insecure runtime.
- Assisted operator provisioning precedes public self-service. The latter remains Milestone 9 after a
  successful owned-league season.
- Manual validated scheduling is the beta path. Full OR-Tools optimization, real communications,
  legal workflows, scoring, statistics, and payments remain separately testable milestones.

## Discoveries and risks

- The beta date is 25 days from plan creation. Scope growth, delayed hosting approval, unavailable
  source/legal decisions, or an unremediated runtime high finding threatens the date and triggers
  de-scope rather than a weakened gate.
- Hosted infrastructure, domain/DNS, recurring cost, and live credentials require explicit user
  approval. The implementation can prepare manifests/runbooks but cannot complete that external step
  autonomously.
- Privileged MFA and invitation flows may require Better Auth extension work. They must be proven
  behind the reverse proxy before hosted exposure.
- An upstream-unpublished Expo build-tool advisory cannot be silently waived. Excluding native builds
  from the hosted runtime plus an owned expiring exception may support browser beta only.
- The five missing source files prevent authentic rule/import/waiver completion. If they are not
  supplied, the beta must remain synthetic and omit legal/registration claims.
- Real assistive-technology users and real testers are external dependencies. Automated axe and device
  emulation do not replace their signoff.

## Progress log

- 2026-08-21 — User set a middle-of-September full online-beta expectation. Reconciled that request
  with the roadmap and Production Gates; defined a complete controlled browser-beta workflow using
  synthetic/practice data while retaining real-data/provider/legal/scoring gates.
- 2026-08-21 — Locally committed the verified public-league slice as `b41d214`, leaving a clean tree.
  Began the release-foundation slice with outbox and security/deployment audits in parallel.
- 2026-08-21 — Classified the current LAN Compose topology as local-only and not safe for internet
  exposure. Defined the hosted-beta security sequence: isolated TLS deployment, minimal runtime
  images with fresh scans, privileged-auth controls, encrypted off-site restore, monitoring,
  rollback, and release-candidate rehearsal. No hosted resource or live credential was created.
- 2026-08-21 — Reached a release-foundation checkpoint: implemented and unit/isolated-PostgreSQL
  tested the transactional relay, and built verified non-root production-artifact images under
  distinct tags. Through-stack Redis/restart/restore evidence, further API/worker package pruning,
  fresh scans, credential rotation, and a clean-clone run remain before the Aug 28 gate is complete.
- 2026-08-21 — Rotated the synthetic local credentials, rebuilt/reseeded the stack, and completed the
  default, worker-restart, and Redis-restart outbox acceptance rehearsals plus the strengthened
  repeatable-snapshot restore check. The durable internal-receipt outbox scope is complete.
- 2026-08-21 — Hardened and runtime-verified the web, API/migrator, worker, and scheduler images. Their
  latest targeted scans report 0 HIGH and 0 CRITICAL findings. The broader Compose gate remains red
  on pinned third-party images, and the JavaScript dependency gate remains red on two high
  `image-size` advisories and one moderate `uuid` advisory.
- 2026-08-21 — Implemented tenant-scoped venue/field administration with additive schema,
  permissions, generated contracts, optimistic concurrency, deterministic idempotency, audit/outbox
  records, responsive browser forms, and focused database/API/browser coverage. The next slice is
  privileged onboarding/authentication, followed by field availability and validated manual
  scheduling. The local gateway remains loopback-only at `127.0.0.1:8088`, with remote testing
  available only through secure forwarding.
- 2026-08-21 — Remediated the failed CI runtime package pruning and refreshed the hosted-eligible
  runtime boundary. Application, gateway, PostgreSQL, and Redis images now pass the fixable
  High/Critical gate; exact local-development MinIO and Mailpit images remain visible under the
  fail-closed `SEC-EXC-002` exception and are prohibited from hosted beta. The dependency gate now
  accepts only the two scoped Metro `image-size` advisories under `SEC-EXC-001`, with independent
  lockfile reachability enforcement. Both exceptions expire on 2026-09-15.
- 2026-08-22 — Completed the local CI-equivalent checkpoint: fresh-stack migration/seed/restore,
  API tenancy/authorization/outbox suites, browser and accessibility journeys, production web/native
  builds, dependency audit, and the complete hosted-runtime container scan pass. The pushed Node
  24.19.0 clean-checkout workflow remains the final preservation check.
