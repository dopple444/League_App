# Bootstrap Milestones 0 and 1

This is a starter ExecPlan. Codex must expand it after inspecting the repository and source documents, then keep it current during implementation.

## Purpose and user outcome

Create a reproducible, secure project foundation and prove the smallest tenant-isolated end-to-end slice: authenticated league admin creates a season/team; a public viewer sees only published data; the change is audited; web and mobile consume the same versioned API.

## Scope

### Included

- Requirements FND-001 through FND-009 as applicable to the first slice.
- Monorepo, local Compose services, database migrations/seed, auth/RBAC/tenancy, audit/outbox, OpenAPI/SDK, public/admin shells, mobile shell, CI/tests.
- Traceability/import report for current source documents and waiver render baseline.

### Excluded

- Completed electronic signing, live scoring, schedule solver, real messages/payments, production deploy, and app-store submission.

## Current-state findings

Planning package exists; application source has not been scaffolded. Codex must update this after inspection.

## Proposed design

Use the accepted decisions in `docs/DECISIONS.md` and topology in `docs/ARCHITECTURE_AND_DATA.md`. Implement one thin vertical slice before filling out broad CRUD.

## Milestones

- [ ] Record current tool/runtime versions and scaffold pnpm/Turborepo.
- [ ] Create local Compose stack and environment validation with synthetic services/data.
- [ ] Add PostgreSQL/Prisma base schema and clean migration/seed.
- [ ] Integrate Better Auth and organization membership/permission policies.
- [ ] Add tenant-isolation and audit/outbox primitives.
- [ ] Add versioned NestJS API and generated SDK.
- [ ] Add admin create/publish flow and public read-only view.
- [ ] Add Expo mobile auth/shell consuming the same SDK.
- [ ] Add import traceability report and waiver render baseline.
- [ ] Run full milestone checks, review, demo, and update status/decisions.

## Verification and acceptance

Codex must replace this section with exact project commands and evidence. At minimum: clean install/build/start, lint, strict typecheck, unit/integration/E2E, two-tenant denial tests, clean migration/seed, audit assertion, public unpublished-data denial, and mobile SDK smoke test.

## Migration, rollback, and data compatibility

No production data exists. Migrations must recreate a clean synthetic database. Do not import real personal data.

## Security and privacy review

Confirm organization scope on every table/query, server-side permissions, secret handling, log redaction, safe synthetic fixtures, and no source documents committed.

## Decisions made

See `docs/DECISIONS.md`.

## Discoveries and risks

To be maintained during implementation.

## Progress log

- 2026-08-13 — Planning package created; implementation not started.

