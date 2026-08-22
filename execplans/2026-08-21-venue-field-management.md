# Venue and field management

## Purpose and user outcome

Give an authorized league administrator a complete tenant-scoped place to create and maintain the
venues and fields needed by later schedule authoring. The administrator can record whether a field
has lights, its optional fence distance, safe public directions, and whether each venue or field is
active. Every write is idempotent, attributable, audited, and delivered through the transactional
outbox; another tenant can neither see nor change the records.

## Scope

### Included

- Add active state, optimistic versions, and timestamps to venues and fields, plus lights and fence
  distance to fields, through an additive migration compatible with the seeded venue and field.
- Add granular venue/field read, create, and update permissions to the seeded League Admin role.
- Add organization-scoped list/create/update contracts, OpenAPI paths, generated SDK methods, API
  handlers, and database-backed denial/idempotency/audit/outbox tests.
- Add `/admin/{organizationId}/venues` using the ADM-26 accordion/nested-table workbench and ADM-62
  create/edit task panels, including loading, empty, validation, stale-version, permission, and
  service-error states.
- Link the venue workspace from the existing organization command center and administration shell.
- Add component, browser, responsive, and automated accessibility evidence using synthetic data.

### Excluded

- Field availability, recurring slots, closures, blackouts, emergency plans, canonical field status,
  schedule creation/publication, maps/geocoding, files/photos, destructive deletion, or real data.
- Public venue/field endpoints. Public schedule pages continue to read allowlisted publication
  snapshots only.
- Platform onboarding, invitations, MFA, production hosting, or external effects.

## Relevant requirements

- **FND-001 MUST** — Field remains a distinct entity nested beneath a venue.
- **FND-002 MUST** — every list and mutation is organization scoped with wrong/missing-tenant denial.
- **FND-004 MUST** — venue and field permissions are granular and server enforced.
- **FND-006 MUST** — every create/update records actor, organization, action, target, before/after
  reference, time, request ID, and source in the atomic mutation.
- **SCH-001 MUST (prerequisite subset)** — venues and fields exist before date-specific availability
  and slots can be defined.
- **OPS-003 MUST** — logs, health, and queue jobs do not contain directions or mutation payloads.

## Baseline findings

- Prisma originally had tenant-keyed `Venue` and `Field` models and composite tenant foreign keys;
  `Field` had a nullable `publicDirections` field but lacked active state, concurrency versions,
  timestamps, lights, and fence distance.
- The original seed created one venue and one field for the synthetic organization, but no permission,
  API, contract, SDK, or administration UI exposed them.
- The existing season/team services establish the repository pattern for organization context,
  permissions, idempotency, audit/outbox recording, and optimistic updates.
- ADM-26 specifies the page/list composition but not complete form behavior. ADM-62 and register rows
  WEB-PAGE-015, WEB-FORM-008/009, and WEB-DOMAIN-006 were added before implementation.

## Proposed design

### Data and permissions

Add `active boolean default true`, `version integer default 1`, and created/updated timestamps to both
models. Add `has_lights boolean default false` and nullable `fence_distance_feet integer` to `field`,
with a database check constraining a supplied distance to 100–600 feet. Preserve existing IDs and
relationships. Do not delete records; deactivation is an explicit audited update.

Use `venue:read`, `venue:create`, `venue:update`, `field:create`, and `field:update`. The seeded League
Admin role receives all five. Read-only and deliberately restricted synthetic roles do not gain them.

### API and mutation behavior

Expose bounded, name-ordered venue records with nested name-ordered fields at
`GET /api/v1/organizations/{organizationId}/venues`. Create/update endpoints live under the same
organization path. Request DTOs trim names/directions, cap lengths, accept whole fence feet only,
and require the current version for updates. Duplicate venue names and duplicate field names within
one venue return stable conflicts; cross-tenant IDs return the same not-found/denied boundary as
existing resources.

All writes use `MutationService.record`. Create actions are `venue.created` and `field.created`;
updates are `venue.updated` and `field.updated`. The outbox envelope stays metadata-only. Reused
idempotency keys with the same request replay the original response; changed payloads conflict.

### Web behavior

The page uses `AdminShell`, breadcrumbs, a single `h1` “Venues & Fields”, and a primary “Add Venue”
button. Native `details`/`summary` semantics provide keyboard-operable accordion rows. Each summary
shows the venue name, active badge, and field count. Expanded content contains a responsive nested
field table/card reflow and an “Add Field” action. Create/edit forms open inline and preserve page
context. No user-entered directions are rendered as HTML or turned into an unchecked link.

Successful creates/updates refresh the list and announce a concise result. Client-side validation is
helpful but server validation remains authoritative. While submitting, actions are disabled and
duplicate submission is prevented. Permission, 404, conflict, stale version, and unavailable states
use shared feedback primitives.

## Milestones

- [x] Register ADM-26/ADM-62 page, form, and nested-list artifacts before visible implementation.
- [x] Add and verify the additive venue/field migration, schema, permissions, and seed compatibility.
- [x] Implement contracts, generated SDK, tenant-scoped API service/endpoints, and focused tests.
- [x] Implement the administration route, navigation, accordion/table, and create/edit forms.
- [x] Pass focused checks, rebuild the stack, and run functional browser and automated accessibility
      review with synthetic fixtures.
- [x] Retain and visually inspect synthetic desktop, tablet, and mobile screenshots.
- [ ] Complete real screen-reader, desktop Ctrl-Plus, and physical-device/manual review before
      advancing the artifact records beyond **Needs changes**.

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
pnpm stack:smoke
pnpm test:e2e
pnpm test:a11y
git diff --check
```

Acceptance additionally proves one authorized create/update of each entity, exact idempotent replay,
one audit/outbox pair per effective mutation, stale-version conflict, duplicate-name conflict,
invalid fence-distance validation, no-access/wrong-tenant denial, and an unchanged public DTO. The
page must work by keyboard at 1440px, 1024px, 393px, and 200% zoom with visible labels, error summary,
44px targets, non-color-only active state, no horizontal page overflow, and no console/page errors.

### Recorded automated evidence — 2026-08-21 UTC

- The web component suite passed 49/49, including eight focused venue/field manager cases for semantic
  nested content, form validation, duplicate-submission prevention, conflict handling, task locking,
  live success feedback, focus restoration, and permission-aware recovery.
- The functional Playwright suite passed 8/8. Its authenticated venue journey performed real venue and
  field create/update operations, checked the resulting audit history, used the venue disclosure by
  keyboard, verified 44px targets, exercised long-token reflow at 1440px, 1024px, 393px, and 720px,
  and detected no horizontal overflow, console errors, or page errors.
- The automated accessibility suite passed 6/6. The expanded venue and field form passed 2/2 across
  desktop and mobile projects with WCAG 2 A/AA, 2.1 A/AA, and 2.2 AA axe rules, required semantics,
  48px text inputs, and 44px actions and toggles.
- Supporting suites passed: contracts 5/5, database 4/4, domain 4/4, API unit 6/6, API integration 8/8,
  tenancy 4/4, authorization 1/1, and database-backed outbox lifecycle 4/4. Together these cover strict
  DTO validation, migration safeguards, granular permissions, authorized create/update, four-way
  same-key idempotent replay, optimistic concurrency, duplicate/stale/validation conflicts, tenant
  denial, and one audit/outbox pair per effective mutation.
- The rebuilt local stack passed smoke checks, repeat migration verification, seed verification, and
  restore verification.
- Retained visual evidence, using synthetic demo data only:
  [expanded desktop 1440](../docs/evidence/ui/2026-08-21-venue-field-management/01-venues-expanded-desktop-1440.png),
  [add-field form tablet 1024](../docs/evidence/ui/2026-08-21-venue-field-management/02-add-field-form-tablet-1024.png),
  and [add-field form mobile 393](../docs/evidence/ui/2026-08-21-venue-field-management/03-add-field-form-mobile-393.png).
  These captures were visually inspected; real screen-reader, desktop Ctrl-Plus, and physical-device/
  manual review remain unavailable and are not implied by the automated results.

## Migration, rollback, and data compatibility

The migration is additive and gives existing synthetic rows safe defaults. Rollback is a forward fix:
hide the navigation entry and deploy the prior application while retaining the new columns and audit/
outbox history. Do not drop columns or delete venue/field records. The next availability/schedule
slice may reference these stable IDs without another conversion.

## Security and privacy review

- Forced RLS and composite tenant keys remain mandatory; runtime access always enters an explicit
  organization context.
- Public directions may reveal location information, so the form labels their public intent and the
  API never publishes them directly. A future schedule publication must explicitly allowlist them.
- Names and directions are plain text only. No HTML, map URL, geocoding request, or external provider
  call is introduced.
- Mutation payloads and directions never enter Redis jobs, health output, or application logs.
- The work uses generated local credentials and synthetic fixtures only. It does not authorize
  public-internet exposure or a production migration.

## Decisions made

- Treat deactivation—not deletion—as the first safe lifecycle control because games may already
  reference a field and audit history must remain intact.
- Keep venue/field setup organization-wide rather than season-specific; later slot availability and
  schedules reference the stable facilities.
- Use one responsive workbench page with inline task panels so administrators retain context while
  managing nested fields.
- Do not expose directions publicly until a publication contract explicitly allowlists them.

## Discoveries and risks

- Existing seeded games reference the seeded field, so destructive venue/field deletion would be
  unsafe and is intentionally absent.
- ADM-26's illustrative `/admin/venues` route must retain the repository's explicit tenant segment to
  avoid implicit organization selection.
- A facility may be inactive while historical schedules still display its published snapshot. Active
  state affects future authoring; it does not rewrite past publications.

## Progress log

- 2026-08-21 UTC — Audited requirements, schema, permissions, existing APIs/UI, ADM-26, and the UI
  artifact workflow. Added ADM-62 and registered the page, forms, and nested list before coding.
- 2026-08-21 UTC — Added the additive venue/field migration, lifecycle fields, constraints,
  permissions, compatible seed updates, strict contracts, OpenAPI/SDK methods, and tenant-scoped API
  endpoints. Added stable duplicate/version/idempotency behavior with atomic audit and outbox records.
- 2026-08-21 UTC — Delivered the administration route, shell/overview navigation, venue disclosure and
  responsive nested field presentation, plus inline create/edit venue and field task panels.
- 2026-08-21 UTC — Completed green component, API, integration, tenancy, authorization, outbox,
  functional browser, and automated accessibility checks. Updated WEB-PAGE-015, WEB-FORM-008/009, and
  WEB-DOMAIN-006 to **Implemented / Needs changes**.
- 2026-08-21 UTC — Retained and visually inspected synthetic demo screenshots at 1440px, 1024px, and
  393px. Real screen-reader, desktop Ctrl-Plus, and physical-device/manual review remain the evidence
  gap.
