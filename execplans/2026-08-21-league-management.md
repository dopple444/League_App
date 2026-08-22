# League basics management

## Purpose and user outcome

Give an already authorized customer administrator a tenant-scoped place to create and maintain the
leagues inside their selected organization. This closes the current operational gap between receiving
organization access and creating the league that owns seasons. It does not enable public tenant
registration: controlled-beta provisioning, invitation acceptance, and mandatory MFA remain a
separate security-gated workflow.

## Scope

### Included

- Add active state and optimistic versioning to the existing tenant-owned `League` model through an
  additive migration that preserves current IDs, slugs, timestamps, relationships, and RLS.
- Add granular league read, create, and update permissions to the seeded League Admin role.
- Add strict organization-scoped list/create/update contracts, OpenAPI paths, generated SDK methods,
  API handlers, and database-backed isolation/idempotency/audit/outbox tests.
- Add `/admin/{organizationId}/leagues` using ADM-63's responsive card workbench and inline create/edit
  task panel, including loading, empty, validation, duplicate-slug, stale-version, permission, and
  service-error states.
- Link league basics from the organization command center and administration shell.
- Add component, browser, responsive, automated accessibility, and retained synthetic visual evidence.

### Excluded

- Creating a new Organization, open self-sign-up, platform-operator provisioning, invitation
  acceptance, MFA, email delivery, subscription tiers, entitlements, billing, or hosted deployment.
- Destructive league deletion, moving a league between organizations, or rewriting historical
  seasons/publication snapshots.
- Division, terminology, branding, provider, or feature-flag configuration.

## Relevant requirements

- **FND-001 MUST** — Organization owns one or more leagues, and League owns seasons and divisions.
- **FND-002 MUST** — every list and mutation is organization scoped with absent/wrong-tenant denial.
- **FND-004 MUST** — league permissions are granular and enforced by the server.
- **FND-006 MUST** — every create/update records actor, organization, action, target, before/after
  state, time, request ID, source, audit event, and transactional outbox event.
- **OPS-003 MUST** — user input is not written to queue metadata, health output, or uncontrolled logs.
- **OPS-013 MUST** — the local synthetic implementation does not authorize public exposure or real
  customer data.

## Baseline findings

- `Organization` already owns tenant-keyed `League` records, and seasons reference a league through a
  composite tenant foreign key. League has name, URL slug, and timestamps but no lifecycle state,
  optimistic version, dedicated permission, command API, or customer-facing editor.
- Organization selection returns league summaries for context, but administrators cannot create or
  update them.
- Existing season, team, and venue services provide the required tenant-context, permission,
  idempotency, optimistic-concurrency, audit, and outbox patterns.
- ADM-63 and register rows WEB-PAGE-016, WEB-FORM-010, and WEB-DOMAIN-007 were added before visible
  implementation. ADM-61 remains the distinct post-MVP commercial tenant-onboarding concept.

## Proposed design

### Data and permissions

Add `active boolean default true` and `version integer default 1` to `league`. Preserve its composite
primary key and organization-scoped unique slug. Deactivation—not deletion—is the safe lifecycle
operation because seasons may already reference a league.

Use `league:read`, `league:create`, and `league:update`. The seeded League Admin receives all three;
other roles receive no new authority. Lists are bounded to 200 and ordered by name, then stable ID.

### API and mutation behavior

Expose `GET` and `POST /api/v1/organizations/{organizationId}/leagues` plus
`PATCH /api/v1/organizations/{organizationId}/leagues/{leagueId}`. Create and update inputs require
trimmed name, normalized lowercase slug, explicit active state, and the current version for updates.
The API does not infer organization context or accept an organization ID in the body.

All writes use `MutationService.record`. Actions are `league.created` and `league.updated`; matching
outbox events remain metadata-only. Same-key/same-payload requests replay the original HTTP 201 or 200
response. Changed payloads conflict. Concurrent stale updates return stable `VERSION_CONFLICT`, and an
organization-local duplicate slug returns stable `DUPLICATE_LEAGUE_SLUG`.

### Web behavior

The page uses `AdminShell`, breadcrumbs, a single `h1` “Leagues”, and one primary “Add League” action.
Each responsive card shows name, URL slug, visible Active/Inactive status, and a specifically named
Edit action. Add/edit forms open inline, retain the surrounding list, and provide persistent labels,
slug guidance, validation summary, Cancel, task locking, and success announcement/focus restoration.
Long synthetic names/slugs wrap without horizontal page overflow.

## Milestones

- [x] Define ADM-63 and register the page, form, and domain artifact before implementation.
- [x] Add and verify the additive league migration, schema, permissions, and seed compatibility.
- [x] Implement contracts, generated SDK, tenant-scoped API endpoints, and focused tests.
- [x] Implement the route, navigation, responsive list, and create/edit task panels.
- [x] Rebuild the stack and complete functional browser and automated accessibility review.
- [x] Retain and visually inspect synthetic desktop, tablet, and mobile screenshots.
- [ ] Complete real screen-reader, desktop Ctrl-Plus, and physical-device/manual review before
      advancing artifact records beyond **Needs changes**.

## Verification and acceptance

Run and record:

```bash
pnpm format:check
TURBO_CONCURRENCY=2 pnpm lint
TURBO_CONCURRENCY=2 pnpm typecheck
pnpm contracts:check
TURBO_CONCURRENCY=2 pnpm test:unit
TURBO_CONCURRENCY=2 pnpm build
pnpm db:migrate:verify
pnpm db:seed:verify
pnpm test:integration
pnpm test:tenancy
pnpm test:authz
pnpm test:outbox
pnpm stack:smoke
pnpm test:e2e
pnpm test:a11y
git diff --check
```

Acceptance additionally proves authorized create/update, exact idempotent replay, one audit/outbox
pair per effective mutation, duplicate-slug and stale-version conflicts, absent/wrong-tenant denial,
and unchanged public publication DTOs. The page must work by keyboard at 1440px, 1024px, 393px, and
720px compact landscape, with visible labels, error summary, 44px targets, non-color-only status, no
horizontal page overflow, and no console/page errors.

### Recorded automated evidence — 2026-08-21 UTC

- API integration passed 14/14, covering authorized organization-scoped league list/create/update,
  granular denial, duplicate slug and stale version conflicts, exact idempotent replay, audit/outbox
  attribution, and unchanged public behavior.
- The web unit suite passed 61/61, including strict form validation, pending-task locking, stable
  caller-owned idempotency keys across ambiguous retries, explicit latest-version recovery, retained
  customer entries, domain-error guidance, announcements, and focus restoration.
- The functional Playwright suite passed 9/9. Its authenticated league journey created and updated a
  dedicated synthetic league without changing the seeded `church-softball` league, checked HTTP 201
  and 200 results and audit history, and verified keyboard operation, target size, safe long-token wrapping,
  responsive reflow, zero horizontal overflow, and no console or page errors.
- The automated accessibility suite passed 6/6 across desktop and mobile projects. The synthetic
  visual-evidence capture passed 1/1.
- Retained visual evidence, using synthetic demo data only:
  [league basics desktop 1440](../docs/evidence/ui/2026-08-21-league-management/01-league-basics-desktop-1440.png),
  [league form tablet 1024](../docs/evidence/ui/2026-08-21-league-management/02-league-form-tablet-1024.png),
  and [league form mobile 393](../docs/evidence/ui/2026-08-21-league-management/03-league-form-mobile-393.png).
  These captures were visually inspected; real screen-reader, desktop Ctrl-Plus/browser-zoom, and
  physical-device/manual review remain unavailable and are not implied by the automated results.
- The completed implementation and evidence remain uncommitted in the local working tree. This slice
  serves already authorized organization members; zero-membership onboarding and operator hardening
  remain separate incomplete release work.

## Migration, rollback, and data compatibility

The migration is additive and gives existing leagues safe defaults. Rollback is a forward fix: hide
the route and deploy the prior application while retaining the columns and audit/outbox history. Do
not drop league columns or records. Existing season and publication references remain stable.

## Security and privacy review

- Forced RLS and composite tenant keys remain mandatory; runtime access always enters an explicit
  organization context.
- The URL slug is public identity only when an authorized publication exists; creating a league does
  not publish it or alter the configured featured league.
- Names and slugs are plain text. They never enter Redis job metadata, health output, or uncontrolled
  application logs.
- Only generated synthetic fixtures are used in local evidence. No production infrastructure,
  credential, real data, external delivery, or public exposure is authorized.

## Decisions made

- Deliver league management for already authorized organizations before the separate operator and
  invitation security boundary. This gives issued beta customers a usable league-creation step
  without weakening the no-public-sign-up rule.
- Require explicit active state and optimistic versions from the first command API.
- Treat deactivation, not deletion, as the safe lifecycle control.
- Keep organization basics and commercial provisioning out of this focused page.

## Discoveries and risks

- Organization slugs remain globally unique, while league slugs are unique only inside their
  organization. The public route therefore continues to require both slugs.
- Existing seasons may belong to an inactive league; deactivation affects future setup guidance but
  must not rewrite historical or published content.
- Completing this slice does not let a user with zero organization memberships create a tenant. The
  controlled-beta platform-provisioning/invitation/MFA plan still gates that first access.

## Progress log

- 2026-08-21 UTC — Reconciled the customer's “start a league” need with the controlled-beta security
  boundary. Added ADM-63, registered WEB-PAGE-016, WEB-FORM-010, and WEB-DOMAIN-007, and began the
  tenant-scoped league-management implementation for already authorized customers.
- 2026-08-21 UTC — Completed the additive migration, lifecycle/version fields, granular permissions,
  strict contracts, OpenAPI/SDK methods, tenant-scoped API commands, idempotency/audit/outbox behavior,
  responsive administration route, navigation, league cards, and inline create/edit workbench.
- 2026-08-21 UTC — Completed API integration 14/14, web unit 61/61, functional browser 9/9,
  accessibility 6/6, and visual-evidence 1/1 checks. Updated WEB-PAGE-016, WEB-FORM-010, and
  WEB-DOMAIN-007 to **Implemented / Needs changes**.
- 2026-08-21 UTC — Retained and visually inspected the synthetic desktop, tablet, and mobile captures.
  The local working tree remains uncommitted; real screen-reader, desktop Ctrl-Plus/browser-zoom,
  physical-device/manual review, zero-membership onboarding, and operator hardening remain open.
