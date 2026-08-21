# Project status

Last updated: 2026-08-21

## Current state

- Product/research blueprint complete.
- Scoring clarified as live-first with immediate connected broadcasts and outage-safe offline continuation/submission/authorized attestation.
- Codex repository guidance and autonomous execution runbook complete.
- The canonical GitHub repository is `dopple444/League_App`; this `main` changeset captures the Milestones 0–1 application foundation.
- The foundation contains the monorepo scaffold and a working web/mobile vertical slice. The public web journey is now navigable from the runtime-configured root gateway through league home, schedule, team directory, and team detail. Local static, database, restore, browser, accessibility, and fresh-stack checks pass; clean-clone verification, through-stack outbox recovery, security remediation, source inputs, and real assistive-technology/physical-device review remain pending.
- The League App UI Style Guide is now the visual reference, with a separate artifact register governing page, form, component, and generated-output review.
- The shared Modern Field token package and base web/native primitives are implemented. DS-TOKEN-001 passed its foundation review. The changed public pages now have retained responsive synthetic screenshots and automated interaction/accessibility evidence but remain **Needs changes** until real screen-reader, desktop Ctrl-Plus, and physical-device/manual review is recorded.
- All nine local Compose services are healthy and the gateway is available for private-LAN synthetic testing on port `8088`. This is a temporary local test deployment, not production and not authorization for public-internet exposure.
- No production infrastructure, credentials, real data, messages, payments, or app-store resources have been changed.
- The 2026-09-15 target is now defined as Beta 0: a controlled, invitation-only, browser-first hosted
  beta using synthetic/practice data. It covers assisted league setup, validated manual schedule
  publication, and the public league experience; it does not represent completion of the full
  commercial roadmap or authorize real participant/legal/payment/message/official-game data.

## Active milestone

Beta 0 release foundation — transactional outbox and runtime hardening.

## Next action

Rotate the exposed synthetic local environment credentials, rebuild/reseed the local stack with the
new relay and migration, and prove API-mutation-to-Redis-to-completion plus Redis/worker restart and
restore recovery. Further deduplicate/prune the API/worker runtime packages and freshly scan every
deployed image before starting assisted beta provisioning and privileged-auth controls.

## Known blockers / production gates

- Five authorized source files are absent, so source-specific mappings and authentic waiver content/render hashes cannot be completed.
- The refreshed dependency lane fails on two high-severity transitive `image-size` advisories plus one moderate finding; the Python dependency audit is clean. The refreshed container lane also fails on fixable high/critical findings across the Compose images.
- The transactional relay, lifecycle, migration, and isolated PostgreSQL tests are implemented, but
  the active LAN stack still runs the prior worker image. A fresh-stack Redis/worker-loss rehearsal
  and restore check remain before the outbox plan can be marked complete.
- Final waiver/minor workflow and retention require Kentucky counsel, insurer, and Parks/Fiscal Court approval.
- Real messaging/provider consent configuration is not selected or approved.
- Real payment provider/acquirer/PCI responsibility is not selected or approved.
- Production host/recovery choice and app-store developer accounts are not approved.
- Public minor name/photo/stat policy requires formal approval.
- The current local Compose topology is development-only and is a no-go for internet exposure. A
  separate approved hosted-beta topology, TLS/private-service boundary, external secret injection,
  encrypted off-site backup/restore, monitoring, and rollback rehearsal are required.
- Synthetic local Compose credentials appeared in diagnostic tool output on 2026-08-21. They are not
  production credentials, but the local environment must be regenerated at the next safe migration
  boundary and none of those values may be reused for beta.

## Verification log

Codex must append dated entries here after each milestone, including exact commands, pass/fail counts, manual demos, known defects, migrations, and the next action.

### 2026-08-18 — UI style governance

- Adopted `docs/LEAGUE_APP_UI_STYLE_GUIDE.md` as the visual reference in repository guidance.
- Recorded the Modern Field direction and artifact-review requirement as ADR-018.
- Added `docs/UI_ARTIFACT_REGISTER.md` with the intake workflow, current page/screen/form/foundation baseline, per-artifact review checklist, review-record template, and open design-system clarifications.
- Baseline finding: current tokens and UI were created before the guide and require changes; no artifact is marked compliant.
- `pnpm format:check` — passed; all repository files use Prettier formatting. The command also reported the already-known local Node `v22.22.1` versus pinned Node `24.19.0` engine warning.
- `git diff --check -- AGENTS.md README.md docs/DECISIONS.md docs/STATUS.md docs/LEAGUE_APP_UI_STYLE_GUIDE.md` — passed with no whitespace errors.
- `test "$(find apps/web/src/app -name page.tsx | wc -l)" -eq 14 && test "$(find apps/mobile/app -name '*.tsx' | rg '/(home|organizations|account|sign-in)\\.tsx$' | wc -l)" -eq 4` — passed; the page/screen baseline counts match the current source tree.
- `for ui_id in PUB-01 PUB-03 PUB-11 PUB-12 ADM-01 ADM-03 ADM-04 ADM-56 MOB-01 MOB-02 MOB-28 SYS-01 SYS-04; do rg -q "^#### ${ui_id} " docs/LEAGUE_APP_UI_STYLE_GUIDE.md || exit 1; done` — passed; every guide ID used by the baseline exists.

### 2026-08-18 — Modern Field shared foundation

- Resolved UI-GAP-001 through UI-GAP-008 in the style guide: accessible action/status appearances, synchronizing and workflow-pending semantics, overlay/reflow/form/motion rules, and web/native unit adapters are now explicit.
- Added ADR-019 for accessible semantic appearance sets and locally bundled Roboto Flex through platform-specific adapters.
- `pnpm --filter @league/ui-tokens test` — passed 4/4 tests covering locked primitives, CSS/TypeScript alignment, Roboto Flex mappings, 44/64 target values, and WCAG foreground/surface contrast pairs.
- `pnpm --filter @league/ui-tokens lint` and `pnpm --filter @league/ui-tokens typecheck` — passed.
- `pnpm --filter @league/web test` — passed 20/20 tests across three files, including finite status mapping, neutral unknown fallback, semantic mobile-menu coverage, receiver-safe API calls, and web audit attribution.
- `pnpm --filter @league/web lint`, `pnpm --filter @league/web typecheck`, and `pnpm --filter @league/web build` — passed; Next.js produced the static and dynamic route bundle successfully.
- `pnpm --filter @league/mobile test` — passed 17/17 tests across two suites, including native font mapping, semantic actions/statuses, neutral fallback, disabled behavior, 44dp/64dp targets, receiver-safe API calls, and mobile audit attribution.
- `pnpm --filter @league/mobile lint` and `pnpm --filter @league/mobile typecheck` — passed.
- `pnpm --filter @league/mobile build` — passed; Expo exported Android and iOS bundles and included the local `RobotoFlex_400Regular.ttf` asset.
- `pnpm exec prettier --check docs/UI_ARTIFACT_REGISTER.md docs/DECISIONS.md docs/STATUS.md execplans/2026-08-16-bootstrap-milestones-0-1.md` — passed; all four foundation records use repository formatting.
- DS-TOKEN-001 is **Implemented / Pass**. The web shells/primitives and native primitive set have automated foundation evidence but remain **Needs changes** because no responsive screenshots, emulator/physical-device visual checks, screen-reader checks, or visual-regression baselines were recorded.
- All commands reported the known local Node `v22.22.1` versus pinned Node `24.19.0` engine warning. Only local synthetic containers/data were used; no production systems, real data, messages, payments, or app-store resources were touched.

### 2026-08-19 — Working vertical slice and acceptance audit

- Fixed native-ESM API dependency injection, Better Auth UUID generation, worker `ioredis` runtime resolution, loopback-only Compose host access, season revision creation, and idempotent main/test seeding.
- Fixed the gateway hydration failure without enabling `script-src 'unsafe-inline'`: each HTML response receives a unique CSP nonce, while `/_next/static/` retains gzip compression. Added a regression that checks nonce uniqueness, hydration, absence of CSP/page errors, and compressed static delivery.
- Made generated SDK plus web/native API adapters safe for receiver-sensitive global `fetch`, made sign-in wait for hydration, and attached explicit `WEB`/`MOBILE` audit-source headers.
- `pnpm format:check` passed. The first unconstrained lint attempt was killed with exit 137 under local memory pressure; `TURBO_CONCURRENCY=2 pnpm lint` then passed all 12 TypeScript packages plus Ruff. `TURBO_CONCURRENCY=2 pnpm typecheck`, `pnpm contracts:check`, `TURBO_CONCURRENCY=2 pnpm test:unit`, `pnpm test:mobile` (17/17), and `TURBO_CONCURRENCY=2 pnpm build` (all 12 packages, web production bundle, Android/iOS exports) passed.
- `pnpm stack:up` passed with all nine long-running services healthy. `pnpm db:migrate:verify` passed forward apply plus repeat no-op; `pnpm db:seed:verify` passed idempotent seed runs against main and test; integration passed 3/3, tenancy 4/4, authorization 1/1, and `pnpm db:restore:verify` passed with matching restored object counts and clean temporary-database removal.
- `pnpm test:e2e` passed 4/4 through the real gateway: public schedule, sign-in validation, private draft denial, team publication, and attributable audit history. `pnpm test:a11y` passed 2/2 on desktop Chromium and Pixel 7 emulation. `pnpm stack:smoke` passed gateway, web, API, worker, and scheduler.
- `pnpm security:dependencies` reports exactly two high `image-size` advisories (`GHSA-w3rx-r6r6-pgpr`, `GHSA-5p2g-fcmc-qvqq`) and one moderate transitive `uuid` advisory, and exits nonzero because of the two high findings. Python dependency audit passes after pytest 9.0.3, and a scoped `@prisma/config>deepmerge-ts` 8.0.1 override removed that high advisory after Prisma/database/API regression testing.
- The initial `pnpm security:containers` audit scanned every running Compose image and failed on real
  fixable high/critical findings before the final clean rebuild. A refreshed post-rebuild result is
  recorded below; ignored local Trivy reports and their stale counts are not current evidence. Release
  remains blocked until base/third-party images are refreshed and application images are pruned to
  runtime dependencies.
- Rotated all generated local credentials after diagnostics. Removed only the four reproducible synthetic Compose volumes, regenerated `.env`, rebuilt all images, reapplied migrations, reseeded, reran smoke/E2E/accessibility checks, and stopped the stack with fresh synthetic volumes preserved. The removed data was synthetic and is fully recoverable from migrations and seed fixtures.
- `pnpm verify` was not reported as passing because its dependency/container lanes remain red. Milestone acceptance is separately gated by missing authorized source content, the incomplete outbox relay, native-device/manual evidence, and clean-clone verification of this foundation.

### 2026-08-19 — Navigable published-league closeout

- Implemented PUB-21 as a runtime-dynamic root gateway to one validated, explicitly configured
  featured league. The root never enumerates, searches, guesses, or selects the first tenant; absent,
  invalid, withdrawn, and unavailable configurations use neutral fallback states. Recorded this as
  ADR-022.
- Added contextual Home/Schedule/Teams navigation, bounded published upcoming-game presentation,
  combined Date/Team/Field/Status schedule filtering with league-timezone grouping and responsive
  cards, approved-public-name team search, and team-specific published schedules with independent
  schedule-unavailable handling. No public DTO, mutation, database schema, legal content, delivery
  effect, or private-data boundary was expanded.
- `pnpm format:check`, `TURBO_CONCURRENCY=2 pnpm lint`,
  `TURBO_CONCURRENCY=2 pnpm typecheck`, `pnpm contracts:check`,
  `TURBO_CONCURRENCY=2 pnpm test:unit`, `TURBO_CONCURRENCY=2 pnpm build`, and
  `pnpm import:check` passed. The web unit suite passed 40/40.
- The rebuilt nine-service stack is healthy. `pnpm stack:smoke` passed 5/5, `pnpm test:e2e` passed
  7/7, and `pnpm test:a11y` passed 4/4. A separate private-LAN Playwright journey passed 5/5 against
  the private LAN test origin on port `8088` across root, league home, schedule, team directory, and
  team detail.
- Automated Chromium review passed keyboard/focus traversal, mobile-menu closure, 200% CDP
  zoom/reflow, reduced-motion behavior, 44-by-44-pixel minimum targets, logical heading order, polite
  atomic live regions, and no-console/page-error checks. The root is runtime dynamic, and `/icon`
  returned `200 image/png`.
- Retained 12 synthetic screenshots under
  `docs/evidence/ui/2026-08-19-navigable-published-league/` at 1440px, 1024px, and 393px. The artifact
  register links each exact file. Real screen-reader, desktop browser Ctrl-Plus, and physical-device/
  manual review remain unavailable, so every changed consuming artifact remains **Needs changes**.
- `pnpm security:dependencies` was refreshed and **failed** on two high-severity transitive
  `image-size` findings plus one moderate finding; the Python audit is clean.
  `pnpm security:containers` was refreshed and **failed** on fixable high/critical findings across
  Compose images. Stale ignored JSON counts are not used as current evidence, and `pnpm verify` is not
  reported as passing.
- Five authorized sources remain absent, and the transactional outbox relay remains incomplete. The
  private-LAN stack and this synthetic public-read increment are not production-ready and did not
  touch production infrastructure, real data, external messages, payments, or app-store resources.

### 2026-08-21 — Controlled online-beta scope and release-foundation start

- Locally checkpointed the verified navigable public-league slice as commit `b41d214`. Local `main`
  is one commit ahead of `origin/main`; no remote push or public deployment was performed.
- Added `execplans/2026-08-21-controlled-online-beta.md` and recorded ADR-023. The September 15 target
  is an invitation-only browser beta with synthetic/practice data, assisted operator provisioning,
  manual validated schedule publication, and the existing public journey. Registration/waivers,
  payments, real messaging, scoring/official results, native distribution, and unrestricted
  self-service are explicitly deferred.
- Added `execplans/2026-08-21-transactional-outbox-relay.md` and began implementing the
  PostgreSQL-authoritative, metadata-only BullMQ relay with tenant-scoped claims, lease recovery,
  generation fencing, terminal-failure visibility, and no external effects.
- The deployment/security audit classified the active Compose stack as local-development only. It
  identified minimal non-root runtime images, zero unaccepted deployed HIGH/CRITICAL findings, TLS,
  privileged MFA/rate limiting, off-site restore, monitoring, and rollback rehearsal as online-beta
  gates. Existing ignored scanner counts are stale and will not be used as release evidence.
- Implemented the PostgreSQL-authoritative outbox relay and ADR-024: metadata-only BullMQ envelopes,
  `SYSTEM` actor context, tenant-scoped leased `SKIP LOCKED` claims, generation-specific job IDs and
  fencing, bounded retry/terminal failure, duplicate/stale no-op handling, and dependency/backlog
  health. The definer role can read only organization/status/time discovery columns; the production
  runtime role cannot delete outbox records or rewrite payload/identity metadata.
- `pnpm install --frozen-lockfile`, worker/database lint, typecheck, builds, Prisma validation, and
  database tests 3/3 passed. Worker unit tests passed 19 with four environment-gated cases skipped;
  `pnpm db:migrate:verify` then applied `20260821000100_outbox_relay` to the synthetic test database
  and passed the repeat no-op, and `pnpm test:outbox` passed 4/4 real-PostgreSQL cases for metadata
  discovery, wrong-tenant denial, concurrent claim, lease reclaim, stale fencing, terminal failure,
  and least-privilege grants.
- Implemented ADR-025's multi-stage Node packaging and a static/runtime verifier. Distinct validation
  images for web, API, and worker passed non-root, allowlisted-artifact, compiled-entry, dev-tool
  exclusion, and API migration-to-database-boundary checks without replacing the running Compose
  images. Sizes were web 403 MB, API 1.55 GB, and worker 845 MB; API dependency duplication and the
  worker size regression remain open, as do startup probes and fresh vulnerability scans. This does
  not close the runtime security gate.
- No production infrastructure, DNS, firewall, live credential, real-data, provider, payment, or
  app-store action was taken. The active LAN stack was left running on its prior images; credential
  rotation, fresh-stack relay/recovery evidence, restore, and current scanner results remain next.
