# Repository guidance for Codex

## Mission

Build a reliable league operating system for the Meade County Church Softball League first, with clean multi-tenant boundaries so it can later be sold to other leagues. Favor correctness, traceability, usability at the ballpark, and maintainability over novelty.

## Instruction sources

- Read `IMPLEMENT.md` before implementing a milestone.
- Use an ExecPlan under `execplans/` for every milestone, large feature, schema change, security change, or significant refactor. Follow `PLANS.md`.
- `docs/REQUIREMENTS.md` is the testable scope source.
- `docs/ARCHITECTURE_AND_DATA.md` is the architecture and invariant source.
- `docs/DECISIONS.md` contains approved defaults. Add dated ADR-style entries when making a material decision.
- `docs/LEAGUE_APP_UI_STYLE_GUIDE.md` is the visual design reference for every page, screen, form, component, and generated communication or document artifact.
- `docs/UI_ARTIFACT_REGISTER.md` is the implementation and style-review ledger. Add or update an entry before creating or materially changing a user-visible artifact. If the style guide has no matching specification, add one there before implementation.
- `docs/STATUS.md` is the current handoff record and must be updated at every stopping point.

## Product invariants

- Every tenant-owned record carries `organization_id`; tenant isolation is enforced in services and by PostgreSQL row-level security where supported.
- Board authority and elected officer authority are separate permission concepts. A person may hold both, but titles never imply unreviewed superuser access.
- League rules, eligibility rules, schedule rules, terminology, document templates, and stat definitions are configurable by organization and season. Never hard-code “Meade County” into reusable domain code.
- The current Meade County defaults include 7–10 teams, 10 games per team, every opponent at least once, no matchup more than twice, a 5/5 home-away target, no simultaneous assignment, at most two games for a team in one night, preferred back-to-back same-field doubleheaders, variable fields/days/slots by week, and balanced field use with a rotating odd-team exception.
- Current eligibility defaults include church affiliation/attestation, attendance criteria, roster approval by the first game, special under-14 position limits, and an age cutoff for pitchers. These are season rules, not universal code assumptions.
- Both required waiver documents must be tracked independently unless the league records approval of a consolidated replacement. Waiver versions and signed evidence are immutable.
- The authoritative game book is controlled. One designated scorekeeper writes game events; spectators are read-only. Umpire certification closes the game. Corrections are amendments with reason and audit history, never silent overwrites.
- Official score, standings, and statistics are derived deterministically from accepted game events. AI never determines official facts.
- AI summaries and press releases are drafts based only on verified facts. A human must approve before publication or email.
- Weather data informs a human decision. The system must not automatically cancel games.
- No child under 13 receives an independent self-service account in the initial product. A parent/guardian manages the participant record and consent.

## Technical direction

- Use a `pnpm` TypeScript monorepo with Turborepo.
- Deployables: Next.js web, Expo/React Native mobile, NestJS API, NestJS/BullMQ worker, and a small Python/FastAPI OR-Tools scheduler.
- Primary persistence: PostgreSQL through Prisma. Jobs/fan-out: Redis. Files: S3-compatible object storage, MinIO locally.
- API style: versioned REST/OpenAPI for authoritative commands and queries; Socket.IO for live fan-out after committed writes.
- Mobile scoring is live-first and offline-resilient. When connected, every accepted play is submitted and broadcast immediately. Expo SQLite and a durable outbox allow uninterrupted scoring, game submission, and eligible umpire attestation during an outage, followed by ordered automatic synchronization.
- Authentication uses Better Auth behind repository abstractions. Authorization belongs to the domain/API and must not rely only on client UI.
- Pin exact supported dependency versions in lockfiles at scaffold time; do not use floating production versions.

## Engineering rules

- Use strict TypeScript. Avoid `any`; justify narrow exceptions in code comments.
- Keep domain rules pure where practical and unit-test them independently of frameworks.
- Validate all external input at the API boundary. Generate the TypeScript SDK from OpenAPI and fail CI when contracts drift.
- Use database transactions for authoritative game, waiver, finance, and schedule publication changes.
- Use idempotency keys on scoring events, webhook handlers, payments, communications, and retryable jobs.
- Store timestamps in UTC and the league's IANA timezone separately. Render schedule times in the league timezone.
- All mutations that affect eligibility, official results, waivers, money, permissions, or communications create an audit event.
- Never put secrets, access tokens, real contact lists, waiver signatures, or production data in Git, logs, fixtures, screenshots, AI prompts, or issue text.
- Use synthetic fixtures and a dedicated demo tenant.
- Preserve source waiver wording byte-for-byte or as a verified rendered snapshot. Any legal-text change is a Production Gate.
- Public APIs and pages expose only fields explicitly approved for public visibility.
- Make destructive data changes reversible where possible. Production migrations require a tested backup and rollback/forward-fix plan.

## Required validation

Before marking work complete, run the narrow tests while developing and then the applicable full checks:

- formatting and lint
- strict typecheck
- unit and property tests
- API/database integration tests
- web end-to-end tests
- mobile component/live-sync/offline-failover tests when mobile code changes
- tenant-isolation denial tests
- authorization-matrix tests
- migration up/down or forward-recovery validation
- dependency and container vulnerability checks
- accessibility checks for changed user flows
- an updated UI artifact register and recorded style-review evidence for changed user-visible artifacts

Document exact commands and results in `docs/STATUS.md`.

## Review rules

- Flag any query or mutation that can run without an organization scope.
- Flag any official-record update that replaces history instead of appending an amendment/audit record.
- Flag any waiver signature that is not bound to a specific immutable document version and signer evidence.
- Flag any scorekeeping flow that loses accepted actions when connectivity drops or retries duplicate actions.
- Flag any AI output that can publish automatically or introduce unverified facts, quotes, injuries, discipline, or private minor data.
- Flag any message send without consent/preference checks, recipient snapshot, delivery log, and channel-appropriate opt-out handling.
- Flag payment code that lets card data touch this application.
- Flag production actions that bypass `IMPLEMENT.md` gates.
