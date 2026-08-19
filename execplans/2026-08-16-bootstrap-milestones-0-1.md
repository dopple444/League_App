# Bootstrap Milestones 0 and 1

## Purpose and user outcome

Create a reproducible development foundation and prove one secure vertical slice: a synthetic league administrator signs in, selects an organization, creates and publishes season/team data, and sees the attributable audit record; public web and mobile consumers see only published allowlisted team and schedule data.

## Scope

### Included

- Milestone 0 monorepo, local Compose services, CI, migrations/seed, source-import traceability tooling, threat/data inventory, and verification commands.
- Milestone 1 authentication, tenant memberships, granular roles, independent Board/officer authority, forced PostgreSQL RLS, audit/outbox/idempotency primitives, versioned REST/OpenAPI, generated SDK, public/admin web flows, and a minimal mobile shell.
- A seeded read-only schedule fixture to prove the kickoff prompt's schedule view without implementing the Milestone 3 scheduling engine.
- Modern Field shared design tokens and accessible web/native UI foundations required by `docs/LEAGUE_APP_UI_STYLE_GUIDE.md` before the vertical-slice pages receive their page-level style review.

### Excluded

- Real personal-data import, completed waivers, legal-text changes, public deployment, real providers/messages/payments, store submission, schedule authoring/solver behavior, and game scoring/offline synchronization.
- Full completion of FND-007 through FND-009 beyond the configuration/publication, clean restore, and extension primitives needed by this slice.

## Relevant requirements

- Full slice: FND-001 through FND-006.
- Foundations exercised but not globally complete: FND-007 through FND-009.
- Applicable operational controls: OPS-002, OPS-003, OPS-006, OPS-008, OPS-013.

## Current-state findings

- `main` is clean at kickoff and tracks the expected `origin/main` repository.
- The repository contains only the planning package; no application scaffold or lockfile existed.
- Host tools at kickoff: Node 22.22.1, Corepack 0.24.0, Docker 29.4.3/Compose 5.1.3, and Python 3.14.4. pnpm was absent; pnpm 11.22.0 was installed under the user's local binary directory after the old Corepack loader proved incompatible.
- The five files listed by `import/README.md` are not present in `import/source-docs/` or elsewhere in the local workspace. Source-specific mappings and an authentic waiver render baseline remain blocked until authorized copies arrive.
- Existing ports 3001, 3100-3102, 5432, and 5433 are occupied, so the local stack uses separate loopback ports.
- This foundation changeset contains the intended monorepo, services, database/auth/audit/publication vertical slice, web pages, and Expo shell. Local verification is recorded below; clean-clone verification remains pending.
- The shared UI foundation now implements the accepted Modern Field palette, accessible semantic appearances, locally bundled Roboto Flex, and web/native platform adapters. DS-TOKEN-001 passed its foundation review; consuming pages and components still need page-level and retained visual/device evidence.
- Formatting, bounded-concurrency lint/typecheck, UI-token tests, web unit/build checks (20/20 tests), mobile unit checks (17/17 tests), and Android/iOS Expo export pass under the current host.
- The Compose stack starts with all nine long-running services healthy. Gateway, web, API, worker, and scheduler smoke probes pass. Published PostgreSQL, Redis, MinIO, and Mailpit diagnostics bind only to loopback through a separate `host-access` bridge while the service-to-service `core` network remains internal.
- The forward migration plus repeat no-op, idempotent seed run twice against both the main and test databases, API integration suite (3/3), tenant-isolation suite (4/4), and authorization suite (1/1) pass.
- Explicit Nest injection tokens now make the native-ESM API dependency graph boot reliably; Better Auth generates UUID identifiers compatible with the PostgreSQL schema; and the worker declares the exact `ioredis` runtime dependency required by BullMQ and starts successfully.
- Browser E2E (4/4), desktop/Pixel 7 automated accessibility (2/2), and clean restore now pass. Native-device/assistive-technology review, end-to-end outbox delivery, security remediation, the full `pnpm verify`, and the complete manual demo remain open.
- The mutation layer inserts database outbox records, but the worker currently has no database relay/producer that enqueues them and advances their delivery lifecycle; outbox processing is therefore incomplete.

## Proposed design

- Use the accepted modular-monolith topology and exact pinned versions recorded in manifests/lockfiles. Share strict TypeScript domain/contracts/SDK packages while keeping web and native UI appropriate to each platform.
- Put `organization_id` on every tenant table, use composite tenant foreign keys, and force RLS. Migrations run as an owner role; API/worker/tests use non-owner, non-bypass roles. Domain repositories require a transaction-scoped tenant context.
- Keep Better Auth identity/session storage global; application memberships and permissions remain authoritative. Board and officer assignments are effective-dated and independent, and titles do not imply permissions.
- Store internal mutable records separately from immutable publication snapshots. Public handlers read allowlisted snapshots only. State, audit, outbox, and idempotent response commit atomically.
- Keep source documents ignored. Generate hashes, structure/provenance mappings, redacted synthetic fixtures, and deterministic waiver comparison artifacts without logging or committing personal/signature data.
- Use a single nested semantic-token contract for the Modern Field palette, typography, spacing, targets, state appearances, and platform adapters. Raw status colors are indicators; paired foreground/surface tokens provide accessible text contrast. Web and native components consume semantic names rather than feature-local color values.
- Bundle Roboto Flex with the applications so production rendering does not depend on a runtime font request. Use web font assets for Next.js and Expo-compatible static faces for Android/iOS.
- Keep Compose application traffic on the internal `core` network. Attach only the locally published data and mail services to the separate `host-access` bridge, with explicit loopback bindings, so host-run verification remains possible without widening LAN exposure.
- Generate Better Auth identifiers as UUIDs, use explicit Nest injection tokens at runtime boundaries, and declare BullMQ's Redis driver as an exact worker runtime dependency instead of relying on optional transitive resolution.
- Preserve a strict gateway CSP with unique per-response script nonces for transformed Next.js HTML, retain compression on separately proxied static assets, and use receiver-safe web/native fetch wrappers with explicit client-source audit headers.
- Temporarily override only `@prisma/config>deepmerge-ts` to 8.0.1, matching Prisma's pending upstream remediation, until Prisma publishes the fix.

## Milestones

- [x] Pin toolchains, create the workspace and root quality commands, and generate frozen lockfiles.
- [x] Reconcile the shared token package, web shell, and native primitives with Modern Field; add contrast, semantic-state, touch-target, and font-loading tests; record foundation artifact reviews without treating missing visual/device evidence as complete.
- [x] Verify the implemented local gateway/web/API/worker/scheduler/PostgreSQL/Redis/MinIO/Mailpit stack with health checks and generated ignored secrets.
- [x] Prove the API provider graph boots under native ESM and the worker resolves its explicit BullMQ Redis runtime driver.
- [ ] Complete safe source-document mappings and authentic waiver baselines once all authorized inputs exist. Tooling and synthetic metadata exist; source-specific completion is blocked by the missing files.
- [x] Verify the implemented Prisma schema, forward migrations, forced RLS policies, UUID-compatible synthetic two-tenant seed, memberships/RBAC, audited authoritative transactions, publication snapshots, and public-query boundaries.
- [x] Verify the clean dump/restore path.
- [ ] Complete and verify the end-to-end database outbox relay/processing lifecycle; transactional outbox insertion already passes integration coverage.
- [x] Verify OpenAPI/generated SDK alignment plus the browser admin/public vertical-slice flow and automated desktop/mobile-browser accessibility.
- [ ] Finish page-level style review and native-device/assistive-technology evidence for the web and read-only Expo flows.
- [ ] Remediate or explicitly gate dependency/container findings, run the remaining acceptance matrix and `pnpm verify`, complete the manual demo, and update all handoff documents.

## Verification and acceptance

The stable command interface is the root `package.json`. Final acceptance requires `pnpm verify` plus individually recorded migration, tenancy, authorization, web accessibility, mobile, dependency, container, and restore results. Tests must cover same-tenant success, wrong/missing tenant denial, Board/officer separation, draft visibility denial, public-field allowlisting, audit/outbox rollback, retry idempotency, clean migration/seed, and shared SDK behavior.

The Modern Field foundation slice additionally requires exact locked-token assertions, WCAG contrast checks for action/status foreground pairs, web/native semantic status tests, 44px/dp default and 64px/dp scoring-target assertions, locally bundled Roboto Flex, no feature-local color literals in changed foundation components, and recorded register evidence.

Completed infrastructure evidence on 2026-08-18:

- `pnpm stack:up` passed with all nine long-running services healthy; `pnpm stack:smoke` passed the gateway, web, API, worker, and scheduler probes.
- `pnpm db:migrate:verify` passed a forward apply and repeat no-op; `pnpm db:seed:verify` passed idempotent seeding twice against both the main and test databases.
- `pnpm test:integration` passed 3/3, `pnpm test:tenancy` passed 4/4, and `pnpm test:authz` passed 1/1.
- Worker lint, typecheck, tests (3/3), build, and compiled startup smoke passed after adding the explicit Redis runtime driver. The smoke reached the health listener and then produced only the expected connection refusals against a deliberately unavailable Redis test port.

Completed browser, restore, and fresh-environment evidence on 2026-08-19:

- `pnpm db:restore:verify` passed an isolated dump/restore with matching object counts and removed its temporary database.
- Browser E2E passed 4/4 through the real gateway, including unique CSP nonces, Next hydration, sign-in validation, published schedule visibility, private draft-team denial, team publication, and `WEB`-attributed audit history.
- Desktop Chromium and Pixel 7 axe scans passed 2/2. Web unit tests passed 20/20, mobile tests passed 17/17, and the receiver-sensitive shared SDK regression passed.
- Generated local credentials were rotated. The four local-only synthetic volumes were removed, recreated from migrations, seeded idempotently, smoke-tested, and left stopped with fresh synthetic data.
- Dependency scanning cleared the Python finding by pinning pytest 9.0.3 and cleared `deepmerge-ts` through the scoped Prisma override. Two high-severity Metro `image-size` advisories remain upstream-blocked because no patched package is published; the moderate Expo/xcode `uuid` advisory and fixable container-image findings also remain. Complete container-scan evidence predates the final clean rebuild, so a post-rebuild scan with the stack running remains required.

This evidence does not complete native device or assistive-technology review, end-to-end outbox delivery, dependency/container remediation, the complete manual demo, or the full `pnpm verify` command.

Pending manual demo checklist: public seeded schedule; synthetic admin sign-in; organization selection; create/publish season and team; public visibility; attributable audit event; direct tenant-B resource denial; mobile read-only view and logout.

## Migration, rollback, and data compatibility

No production data exists. Migrations are forward-only and verified from an empty database. Local rollback is a named-volume teardown/recreate or restore of the synthetic pre-change dump. No production migration or destructive real-data operation is authorized.

## Security and privacy review

- Default-deny when organization context is absent; runtime roles cannot bypass RLS.
- Public DTOs are separate allowlists; no internal model serialization.
- Logs redact secrets, cookies, authorization headers, contact fields, waiver text, and personal data.
- All fixtures use synthetic `.invalid` identities. Source documents and generated private artifacts stay ignored.
- No external send, payment, publication, production infrastructure, live credential, legal-text edit, or minor-account behavior is in scope.

## Decisions made

- Use a seeded published schedule read model only; schedule authoring remains Milestone 3.
- Use local synthetic email/password authentication with open sign-up disabled; provider selection and privileged production MFA enforcement remain later gates.
- Keep the last approved public snapshot visible during internal edits until explicit republish.
- Complete FND-001 through FND-006 for this slice and report FND-007 through FND-009 as partial extension obligations.
- Adopt the Modern Field direction and the UI artifact register under ADR-018. Resolve implementation-level token and platform-unit gaps centrally rather than allowing pages to invent local values.
- Under ADR-019, use accessible semantic appearance sets, treat raw status colors as indicators, and bundle open-source Roboto Flex locally through separate web/native adapters; do not make UI startup depend on a remote font CDN.
- Under ADR-020, retain an internal Compose `core` network and use a separate loopback-only `host-access` bridge for host-run database verification and local infrastructure diagnostics.
- Configure Better Auth to generate UUID identifiers because the authentication tables use PostgreSQL UUID columns.
- Use explicit Nest `@Inject` tokens for runtime provider dependencies so native-ESM compilation does not erase information required to bootstrap the API graph.
- Pin `ioredis` 5.11.1 as a direct worker dependency because BullMQ 6.1.1 treats the Redis driver as an optional peer even though the worker requires it at runtime.
- Under ADR-021, inject a unique nonce into each proxied Next.js HTML response without enabling `unsafe-inline`, keep static asset compression on a separate location, and require receiver-safe fetch wrappers plus explicit web/native audit-source headers.
- Use a narrowly scoped `@prisma/config>deepmerge-ts` 8.0.1 override that matches Prisma's pending upstream fix; remove it when Prisma ships the dependency bump.

## Discoveries and risks

- Missing authorized source documents block two Milestone 0 acceptance items. All independent implementation proceeds first, but Milestone 0 cannot be declared complete without them.
- The host runtime differs from pinned Node/Python patches; containers and CI provide parity, and local checks report the mismatch clearly.
- Expo native emulator tooling is not installed. Component tests and platform exports are required now; store/native-device release checks remain later gates.
- This foundation changeset captures the current source tree; clean-clone verification remains outstanding. Generated TypeScript, Playwright, scanner, Next.js, Expo, Prisma, and Python artifacts have explicit ignore/formatter exclusions where needed.
- Database-backed tests prove idempotent authoritative writes with atomic audit/outbox insertion, rollback on recording failure, published-snapshot visibility, missing/wrong-tenant denial, composite tenant integrity, and Board/officer/auditor/revoked-role separation. Browser authentication/admin/public flow now passes; mobile logout and end-to-end outbox delivery still need explicit coverage.
- Dependency acceptance is blocked by two high Metro `image-size` advisories with no published fixed release. The pre-rebuild container scan also reports fixable high/critical packages in all pinned application and third-party images; a post-rebuild scan, image refresh, and production-image pruning are required before release.
- Automated foundation evidence does not replace browser viewport, emulator/physical-device, screen-reader, zoom/dynamic-type, or visual-regression review; the web/native consuming artifacts remain **Needs changes** until that evidence exists.

## Progress log

- 2026-08-16 00:00 UTC — Read all governing documents, confirmed clean Git/origin state, inspected host tooling and missing source inputs, and completed the decision-ready implementation plan.
- 2026-08-16 00:01 UTC — Began implementation; installed user-local pnpm 11.22.0 after bundled Corepack failed to execute pnpm 11.
- 2026-08-18 20:10 UTC — Re-audited the local scaffold and plan. Confirmed the implementation is substantial but uncommitted, authorized source inputs remain absent, outbox relay and acceptance coverage remain incomplete, and all UI foundations require Modern Field reconciliation.
- 2026-08-18 20:16 UTC — Baseline checks passed: toolchain check (with known host Node/Python patch warnings), formatting, lint, typecheck, UI-token tests (1/1), web unit tests (5/5), and mobile unit tests (4/4). No containers were started.
- 2026-08-18 20:21 UTC — Began the Modern Field foundation slice: extend the guide's semantic tokens and platform rules, migrate shared tokens/web/native primitives atomically, add focused tests, and update the UI artifact register before page-level restyling.
- 2026-08-18 20:36 UTC — Completed the Modern Field shared foundation slice. UI-token tests passed 4/4; web tests passed 12/12 with lint, typecheck, and production build; mobile tests passed 16/16 with lint, typecheck, and Android/iOS Expo export including the local Roboto Flex asset. DS-TOKEN-001 is **Implemented / Pass**; web/native consuming artifacts remain **Needs changes** pending retained visual, assistive-technology, and device evidence.
- 2026-08-18 (exact UTC time not retained) — Expanded the passing web suite to 18/18 while retaining **Needs changes** for web/native consuming artifacts because screenshot, device, and assistive-technology evidence is still absent.
- 2026-08-18 (exact UTC time not retained) — Corrected native-ESM API dependency injection, selected UUID generation for Better Auth seed compatibility, pinned the worker's required `ioredis` runtime peer, and adopted ADR-020's loopback-only host-access bridge while retaining the internal Compose core network. `pnpm stack:up` reported all nine long-running services healthy and all five `pnpm stack:smoke` probes passed.
- 2026-08-18 (exact UTC time not retained) — `pnpm db:migrate:verify` passed forward apply plus repeat no-op; `pnpm db:seed:verify` passed twice against both main and test databases; integration passed 3/3, tenancy passed 4/4, and authorization passed 1/1. Restore, browser E2E/accessibility, security scans, full verification, and the complete manual demo remain pending.
- 2026-08-19 — Fixed the gateway CSP hydration failure with unique response nonces, preserved static compression, made shared web/native fetch calls receiver-safe, and added explicit `WEB`/`MOBILE` audit attribution. Web unit tests passed 20/20, mobile tests passed 17/17, browser E2E passed 4/4, and desktop/Pixel 7 axe scans passed 2/2.
- 2026-08-19 — Clean restore passed. The Python dependency audit passed after pytest 9.0.3; the scoped Prisma override removed the `deepmerge-ts` advisory after database/API validation. Security remains blocked by two unpublished-fix `image-size` advisories, one moderate transitive `uuid` advisory, and fixable findings in the pinned container images.
- 2026-08-19 — Rotated generated local credentials, removed only the four reproducible synthetic Compose volumes, rebuilt all application images, reapplied migrations, reseeded both databases idempotently, reran smoke/E2E/accessibility checks, and stopped the stack with fresh synthetic volumes preserved.
