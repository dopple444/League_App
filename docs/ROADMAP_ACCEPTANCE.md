# Roadmap and acceptance gates

This roadmap is milestone-based. Calendar time depends on the developer's availability, provider/legal review, and field testing. AI can accelerate implementation, but it cannot replace rule validation, privacy/legal approval, device testing, or operational rehearsal.

## Delivery strategy

- Build vertical slices that are demonstrable from UI → API → database → audit → tests.
- Keep production disabled and use synthetic data through Milestone 6.
- Maintain the Expo mobile shell from Milestone 1, but implement complex administration on web.
- Pilot with a small set of league officers, one scorekeeper, one umpire, and synthetic/practice games before importing real people.
- Prefer a responsive PWA/public site as a universal fallback even after native apps ship.

## Milestone 0 — discovery, traceability, and repository foundation

### Outcome

The repository starts reproducibly and the prior league documents/rules are mapped without losing provenance.

### Scope

- scaffold monorepo, formatting/lint/type/test/CI, Docker local stack, environment validation;
- create synthetic first-tenant seed and source-document import manifest;
- extract/map existing workbooks, rulebook, waivers, and packet structures;
- finalize data inventory, threat model, and first ADRs;
- prove clean database migration/seed and local startup.

### Acceptance

- `pnpm` install/build/lint/typecheck/test run from a clean clone;
- Compose starts web/API/worker/scheduler/Postgres/Redis/MinIO plus fake providers;
- import report identifies every current source file, relevant field/rule, target entity, and unresolved difference;
- waiver body/render comparison baseline exists without changing text;
- no real personal/signature data is committed;
- `docs/STATUS.md` and first ExecPlan are complete.

## Milestone 1 — secure platform vertical slice

### Outcome

An admin can sign in, create a season/team, and publish a safe public view through a tenant-isolated audited path.

### Scope

- Better Auth integration, organizations/memberships/roles/permissions;
- organization/league/season/team/facility base data;
- audit/outbox foundation;
- public league shell and admin shell;
- OpenAPI/generated SDK;
- mobile sign-in/shell consuming the same API;
- denial, accessibility, and E2E tests.

### Acceptance

- two synthetic tenants prove positive and cross-tenant-denial paths;
- admin creates/edits/publishes; public sees only published approved fields;
- Board and officer roles can be assigned independently;
- audit shows attributable mutations;
- mobile/web share generated contracts and pass CI;
- clean build/migration/seed/demo is documented.

## Milestone 2 — registration, rosters, eligibility, and waivers

### Outcome

A team completes application/approval, roster invitations, player/guardian documents, and eligibility review.

### Scope

- configurable team application and church/coach attestations;
- Person/User/guardian/household model and invitations;
- roster lifecycle, rules, eligibility engine, freeze/change request;
- two immutable waiver workflows, signing evidence, PDF/certificate, paper alternative;
- protected/public field policy; admin completion dashboard;
- current league imports/exports and team packet generation.

### Acceptance

- adult, guardian-managed minor, paper-waiver, superseded document, and missing requirement scenarios pass;
- under-14/pitcher cutoff conditions return correct eligibility/lineup result;
- exact signed version/hash/evidence is downloadable and immutable;
- a new waiver version never changes prior signatures;
- coach sees completion status but not restricted evidence;
- legal-body render regression passes;
- counsel/insurer/Parks approval remains a Production Gate, not assumed.

## Milestone 3 — budget, facilities, and schedule engine

### Outcome

Staff plan season costs and generate/publish a fair schedule from flexible weekly availability.

### Scope

- budget scenarios, fee/cost drivers, invoice/manual payment ledger;
- venues/fields/date-specific slots/closures/blackouts;
- schedule rules/UI, OR-Tools contract/model, candidates/penalties/infeasibility;
- locks/manual edits/partial regeneration/version publication;
- public/PDF/ICS/Excel-grid exports and notifications preview.

### Acceptance

- representative 7-, 8-, 9-, and 10-team configurations satisfy all hard constraints or explain infeasibility;
- current 10-game/opponent/home-away/doubleheader/field rules are tested as hard/soft settings;
- randomized property tests find no simultaneous team assignment or max-game violation;
- locked games remain fixed; published revision preserves old/new versions;
- fairness/penalty report is understandable without reading solver code;
- budget dashboard computes break-even and variance using integer money;
- no real payment occurs.

## Milestone 4 — game-day scoring, live following, and official lock

### Outcome

An assigned scorekeeper publishes plays live whenever connected, continues without interruption during an outage, can submit the game offline, and the umpire signs the exact official book either with valid cached authorization or after reconnection.

### Scope

- game states/assignments/lineup validation/write lease;
- basic event types/reducer/projections/stat definitions;
- live-first transmission plus Expo SQLite game snapshot/outbox/offline submission/replay/reconciliation;
- API transactions/idempotency and Socket.IO fan-out;
- public live page/QR; submission/umpire attestation/final lock;
- amendment workflow and deterministic derived-output rebuild;
- printable official book and box score.

### Acceptance

- a connected full practice game updates the public live feed immediately after each accepted play;
- airplane mode, app kill/restart, duplicate retry, server restart, scorer transfer, and stale-version tests lose/duplicate no accepted events;
- a game can be completed and submitted with no network; an authorized offline umpire attestation queues safely, or the umpire signs after reconnection;
- the app never labels the server/public game `Official final` until the queued event/submission/attestation chain is synchronized and accepted;
- spectator cannot mutate and reconnects from last known version;
- ineligible lineup is blocked or authorized override is fully audited;
- umpire signature binds the exact submitted snapshot and finalizes it;
- approved amendment preserves old version and recalculates all dependencies;
- load test supports agreed simultaneous games/viewers with headroom.

## Milestone 5 — statistics, standings, officials, and season operations

### Outcome

Final games automatically drive trusted season records and normal official assignment operations.

### Scope

- MVP player/team stats, standings/tiebreakers, leaderboards;
- schedule/result/team/player public pages with privacy filters;
- official availability, assignment, confirmation/replacement, fees;
- protests/ejections/incidents/equipment inspection base records;
- season reports and archive/export.

### Acceptance

- golden event streams produce expected box scores, stats, standings, and tiebreakers;
- formulas identify their season/ruleset version;
- public minor/privacy variants expose only allowed fields;
- official assignment conflict and replacement scenarios work;
- prior season remains unchanged when current rules/formulas change.

## Milestone 6 — communications, weather, AI recaps, and weekly media

### Outcome

One approved operational update reliably reaches the right audience, and official games produce fact-checked reviewable media drafts.

### Scope

- consent/preferences/suppression/recipient snapshots;
- fake then staged email/SMS/push providers; delivery/retry/failure/acknowledgement;
- public status and NWS advisory/decision console;
- replaceable social Page adapters with manual fallback;
- AI source snapshot, Structured Outputs, fact validator, approval/version workflow;
- weekly release/box scores/media contacts/delivery preview.

### Acceptance

- audience/dedup/opt-out tests prevent unauthorized or duplicate delivery;
- STOP/revocation suppresses immediately and persists across reimport;
- weather alert cannot cancel a game; only authorized signed decision changes status;
- one announcement updates canonical status and produces channel-specific jobs;
- AI cannot publish; numeric/name claims fail closed when not validated;
- official amendment invalidates dependent AI draft/release;
- adversarial notes do not change instructions or leak private data;
- real sends/social publication remain gated.

## Milestone 7 — production hardening and pilot

### Outcome

A release candidate is safe to pilot with controlled real data after approvals.

### Scope

- complete permission/data inventory, privacy/account deletion, retention/holds;
- MFA, headers/rate limits/secrets, file/webhook controls, dependency/container scans;
- monitoring/runbooks/UPS considerations/off-site backup and restore drill;
- accessibility audit and field/device usability tests;
- migration/dry-run import of redacted then approved real data;
- operator training and manual contingency procedures;
- production capacity/SLO/RPO/RTO and go/no-go checklist.

### Acceptance

- no open severity-high defect; cross-tenant/permission suites pass;
- full backup restores to isolated clean environment within target;
- account deletion/export and legal-hold exceptions work;
- scorekeeper/umpire/coach/admin practice-session signoff recorded;
- Android and iOS preview builds pass target device matrix;
- legal/insurer/Parks, messaging, payment, privacy/store, and emergency-plan approvals are documented;
- rollback/forward-fix and incident contacts are current.

## Milestone 8 — native store release and first live season

### Outcome

The public web service and reviewed Android/iOS apps run the league with measured support.

### Scope

- production environment and data migration after explicit approval;
- app privacy/data-safety forms, screenshots, metadata, TestFlight/Play tracks;
- staged rollout, health/support dashboard, incident rehearsal;
- first-week enhanced monitoring and daily reconciliation;
- post-season archive and retrospective.

### Acceptance

- explicit Production Gate approvals recorded for deployment, real data/providers/sends, and store submission;
- first release has tested rollback and support path;
- delivery, sync, official-game, payment, backup, and AI validation metrics remain within thresholds;
- retrospective converts repeated defects/corrections into tests and `AGENTS.md`/process updates.

## Milestone 9 — commercial tenant product

Begin only after a successful owned-league season.

- self-service/assisted tenant onboarding and data import;
- configurable sports/rule/stat/document packages;
- custom branding/domain, tenant provider connections, quotas;
- connected merchant accounts and separate SaaS billing;
- support access grants, tenant export/deletion, processor agreements;
- subscription/entitlement/feature flags, usage/margin analytics;
- migration, documentation, customer support, SLO, and disaster recovery;
- penetration/security/privacy review for wider jurisdictional exposure.

## Test matrix that must not be postponed

| Area | Essential scenarios |
| --- | --- |
| Tenancy | positive same-tenant and denial cross-tenant for every module |
| Roles | Board vs officer separation; dual role; removed/expired term; coach/player/guardian boundaries |
| Waiver | adult; guardian; paper; superseded; withdrawn consent; legal hold; corrupt/mismatched hash |
| Schedule | 7/8/9/10 teams; variable days/slots; locks; rainout; impossible capacity; odd-team fairness |
| Score | immediate connected live updates; outage/restart/retry/conflict; offline submission/authorized attestation; reconnect catch-up; suspension/resume; scorer transfer; umpire reject/sign; amendment |
| Stats | golden games; forfeit/tie/suspension/amendment; versioned formula/tiebreaker |
| Messages | consent/opt-out; duplicate contacts; partial provider failure; reschedule old/new; acknowledgement |
| AI | missing facts; name ambiguity; adversarial note; amendment; validation failure; no approval |
| Finance | integer/currency; partial/refund/duplicate webhook; permission; reconciliation |
| Operations | clean deploy; failed migration; backup/restore; full disk; provider outage; token expiry |

## Minimal human checkpoints

The user should not need to write repeated engineering prompts. Human involvement is concentrated at these checkpoints:

1. Approve the first vertical slice and visual direction.
2. Confirm extracted league rules/document mappings where source materials conflict.
3. Field-test scoring and schedule fairness with real league operators using synthetic/practice data.
4. Obtain legal/insurer/Parks and provider approvals.
5. Approve production, real communications/payments, and app-store submission.
6. Go/no-go for live season and later commercial use.
