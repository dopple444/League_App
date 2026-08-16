# Testable requirements

Priority meanings: **MUST** is required before first production season; **SHOULD** is important but may follow the first pilot; **LATER** is intentionally outside MVP.

## Foundation and governance

- **FND-001 MUST** — The system supports Organization, League, Division, Season, Team, and Field as distinct entities.
- **FND-002 MUST** — Every tenant-owned query and mutation is organization-scoped; denial tests prove users cannot cross tenant boundaries.
- **FND-003 MUST** — A user may belong to multiple organizations with different roles.
- **FND-004 MUST** — Permissions are granular and server-enforced; configurable titles map to bundles.
- **FND-005 MUST** — Board authority and elected officer authority are separately assignable and auditable.
- **FND-006 MUST** — Sensitive/official mutations record actor, organization, action, target, old/new reference or diff, reason where required, time, request ID, and source.
- **FND-007 MUST** — Season rules, documents, fees, stat formulas, tiebreakers, and configuration are versioned and never rewritten for prior seasons.
- **FND-008 MUST** — An admin can clone a season's configuration without copying signatures, completed eligibility, or payments.
- **FND-009 MUST** — The tenant has a portable export and documented restore process.

## Registration, people, rosters, and eligibility

- **REG-001 MUST** — A coach can submit a team application with configurable fields, acknowledgements, affiliated church/organization, and fee status.
- **REG-002 MUST** — An authorized church representative can certify the application through an attributable workflow.
- **REG-003 MUST** — League staff can request changes, approve, reject, and explain status; every transition is recorded.
- **REG-004 MUST** — A Person record can exist without a login; a User account can be linked after invitation/verification.
- **REG-005 MUST** — Adult players can manage their own profile; guardians manage minor profiles and relationships.
- **REG-006 MUST** — Under-13 participants cannot create or control an independent account in MVP.
- **REG-007 MUST** — A coach can invite roster members and see completion/eligibility without seeing protected fields they do not need.
- **REG-008 MUST** — The eligibility engine returns human-readable blocking/warning reasons and the source rule/document.
- **REG-009 MUST** — Roster submission, requested deadline, enforcement deadline, approval, freeze, and approved post-freeze change are distinct states/events.
- **REG-010 MUST** — Under-14 and pitcher-age rules are evaluated against season-configured cutoff dates and lineup positions.
- **REG-011 MUST** — Church attendance/affiliation is an attestation/configurable rule, not globally hard-coded.
- **REG-012 SHOULD** — Duplicate-person matching suggests potential matches without automatically merging them.
- **REG-013 SHOULD** — Rosters can roll forward as draft invitations while all season-specific eligibility resets.
- **REG-014 MUST** — Public roster/name/photo/stat visibility is explicit, season-aware, and guardian-controlled for minors.

## Waivers and signatures

- **WVR-001 MUST** — Each waiver template has immutable versions, effective dates, original artifact, SHA-256 content hash, signer rules, and approved merge fields.
- **WVR-002 MUST** — The Parks/Fiscal Court and league/insurance waivers are independently required unless a recorded league decision substitutes an approved consolidated version.
- **WVR-003 MUST** — The signer sees/downloads the exact rendered document before an explicit intent-to-sign action.
- **WVR-004 MUST** — The signature record binds signer, participant, guardian relationship if applicable, document/render hashes, consent version, verification method, UTC time, IP/user agent, and tenant/season/team context.
- **WVR-005 MUST** — Signed documents are never edited or overwritten; a replacement requires a new version and signature.
- **WVR-006 MUST** — A final downloadable PDF and signing certificate are retained and made available to the signer.
- **WVR-007 MUST** — A paper/offline process can be recorded without pretending it was electronically signed.
- **WVR-008 MUST** — A legal hold prevents ordinary deletion of relevant document/signature records.
- **WVR-009 MUST** — Rendered regression tests detect unintended changes to approved legal body text.
- **WVR-010 MUST** — Waiver completion contributes to eligibility but does not imply every other eligibility requirement is satisfied.

## Finance and planning

- **FIN-001 MUST** — Staff can create multiple season budget scenarios using projected teams, players, games, fees, discounts, and sponsorship revenue.
- **FIN-002 MUST** — Costs support fixed, per-team, per-player, per-game, and quantity/rate drivers.
- **FIN-003 MUST** — The dashboard shows budget, committed, actual, variance, per-team cost, and break-even fee/team count.
- **FIN-004 MUST** — Invoices support line items, partial/manual payments, credits, refunds, receipts, status, and audit.
- **FIN-005 MUST** — No card number or CVV reaches the application, logs, database, or analytics.
- **FIN-006 SHOULD** — A provider-hosted redirect checkout and signed/idempotent webhook can update the ledger.
- **FIN-007 MUST** — Finance data exports to CSV with stable identifiers for reconciliation/accounting.
- **FIN-008 LATER** — SaaS subscription billing is separate from tenant team/player payment flows.

## Facilities and scheduling

- **SCH-001 MUST** — Staff can define date-specific availability for any number of dates, weekdays, fields, and slots, plus bulk patterns and exceptions.
- **SCH-002 MUST** — Season scheduling rules define team game count, opponent min/max, home/away target, games/night max, rest, and hard/soft preference weights.
- **SCH-003 MUST** — A generated schedule never assigns a team to two games in the same slot or exceeds a hard capacity/rule.
- **SCH-004 MUST** — The Meade County default supports 7–10 teams, 10 games/team, all opponents at least once, matchup max two, and 5/5 home-away target when feasible.
- **SCH-005 MUST** — Same-field consecutive doubleheaders, field balance, early/late balance, repeat spacing, and bye balance are scored soft preferences.
- **SCH-006 MUST** — Unavoidable odd-team field imbalance can be tracked and rotated across seasons.
- **SCH-007 MUST** — The scheduler returns candidate score/penalties and explains infeasibility or unmet preferences.
- **SCH-008 MUST** — Users can lock games and regenerate only unlocked games.
- **SCH-009 MUST** — Draft, published, revised, postponed, and archived schedule versions retain history.
- **SCH-010 MUST** — A published change identifies old/new details, affected recipients, author, reason, and notification status.
- **SCH-011 MUST** — Manual edits are validated against hard constraints before publication.
- **SCH-012 MUST** — Schedule property tests cover representative 7-, 8-, 9-, and 10-team seasons and randomized availability.
- **SCH-013 MUST** — Export supports public web/PDF/ICS and a spreadsheet grid with opposing teams in separate cells.
- **SCH-014 SHOULD** — Existing schedule spreadsheets can be imported into a draft with a validation report.

## Officials and assignments

- **OFF-001 MUST** — Scorekeeper and umpire profiles support availability, assignments, confirmation, replacement, conflicts, and fee.
- **OFF-002 MUST** — An official sees only assignments and private details needed for the role.
- **OFF-003 MUST** — Assignment changes and acknowledgements are audited and can trigger notifications.
- **OFF-004 LATER** — Qualification/expiration, background-check status, evaluation, and third-party payout/tax workflows are supported without storing tax IDs in core storage.

## Game-day scoring and official record

- **GAM-001 MUST** — Each game has a state machine covering scheduled, live, delayed, suspended, postponed, canceled, forfeited, protested, submitted, final, and amended states as applicable.
- **GAM-002 MUST** — A designated official scorekeeper is the only normal writer; transfer of the write lease requires authority, reason, and audit.
- **GAM-003 MUST** — Lineup submission validates roster eligibility, special age/position rules, and configured coed composition, with authorized override reasons.
- **GAM-004 MUST** — Basic scoring records plate-appearance outcome, runner movement, outs, runs, hits/errors where captured, inning, substitutions, special runner, and official notes.
- **GAM-005 MUST** — Scoring actions are immutable events with client event ID, sequence/version, actor/device, times, payload, and correction linkage.
- **GAM-006 MUST** — Replayed offline events are idempotent; duplicate client event IDs cannot create duplicate plays.
- **GAM-007 MUST** — The mobile app persists the game snapshot and pending outbox across app restarts and connectivity loss.
- **GAM-008 MUST** — Conflicts never use silent last-write-wins; the official writer gets an actionable reconcile/refresh flow.
- **GAM-009 MUST** — Suspension preserves exact resumption state, including batting order, substitutions, bases, outs, inning, score, and event version.
- **GAM-010 MUST** — Scorekeeper submission creates an exact reviewable scorebook snapshot.
- **GAM-011 MUST** — The authenticated assigned umpire attests to exact scorebook snapshot hash, result/status, time, and attestation wording.
- **GAM-012 MUST** — Finalization locks the official version. Later corrections use request, review, reason, amendment, and version history.
- **GAM-013 MUST** — Stats, standings, box score, recap, and weekly release dependencies regenerate or invalidate after an approved amendment.
- **GAM-014 MUST** — Redis, WebSocket, and client caches are never the sole official record.
- **GAM-015 SHOULD** — A printable/exportable official book includes event log, line score, box score, signatures/attestations, and amendments.
- **GAM-016 MUST** — When connected, each locally saved scoring event is submitted immediately; after the server transaction commits, the scorer receives an acknowledgement and live followers receive the update.
- **GAM-017 MUST** — A pregame readiness check downloads and verifies the game package, current version, eligible roster, rules, assignments, and any time-bounded offline authorizations before play.
- **GAM-018 MUST** — The scorekeeper can submit the completed game without connectivity; the immutable local snapshot, event sequence, hash, and submission survive process/device restart and synchronize later.
- **GAM-019 MUST** — An umpire may attest offline only with valid cached authorization. Otherwise, the game remains `Submitted offline — awaiting umpire`; neither path becomes server/public `Official final` until synchronization and server validation succeed.
- **GAM-020 MUST** — During an outage the public feed displays the last synchronized state and an interruption indicator; after reconnection it receives accepted queued events in authoritative order.
- **GAM-021 MUST** — The scorer always sees distinct states for saved locally, synchronizing, live/synced, failed/action required, submitted pending sync, attested pending sync, and official final.

## Statistics, standings, and public live view

- **STS-001 MUST** — Stat formulas and tiebreakers are versioned and covered by examples from league rules.
- **STS-002 MUST** — Official stats derive only from the accepted event stream for the current official game version.
- **STS-003 MUST** — MVP produces configurable basic player batting stats, team inning line score, W/L/T, runs for/against, and standings.
- **STS-004 MUST** — The interface does not show a statistic the configured scorer workflow cannot reliably capture.
- **STS-005 MUST** — Public live connections are read-only and expose only tenant-approved fields.
- **STS-006 MUST** — Public game links recover cleanly after reconnect and show last-updated/current-official-state indicators.
- **STS-007 SHOULD** — Public schedule, results, standings, leaderboards, game archive, and press releases are SEO-accessible and shareable.
- **STS-008 LATER** — Pool play and configurable tournament brackets use a published standings snapshot and versioned seeding rules.

## Communications, weather, and social

- **COM-001 MUST** — An announcement targets recipients by organization/division/team/role/field/game using a snapshotted recipient list.
- **COM-002 MUST** — Recipient resolution deduplicates and applies verified contact, channel consent, preferences, and tenant-specific suppression.
- **COM-003 MUST** — Each delivery attempt records provider/message ID, status, error, times, retry, and final outcome.
- **COM-004 MUST** — Opt-out/revocation immediately suppresses applicable SMS/commercial email while preserving allowed alternative channels.
- **COM-005 MUST** — Operational and promotional consent/purpose are separate.
- **COM-006 MUST** — No direct SMS or private adult-to-minor chat is enabled by default.
- **COM-007 MUST** — The public status page/banner is canonical and remains usable without a social platform.
- **COM-008 MUST** — NWS data creates advisory context; only an authorized human changes game/field status.
- **COM-009 MUST** — A weather decision records evidence, decision maker, affected scope, time, next update, and safety message.
- **COM-010 SHOULD** — Urgent announcements support coach acknowledgement and escalation for delivery failures.
- **COM-011 SHOULD** — Facebook Page/social connections use separate OAuth adapters, encrypted tokens, minimum scopes, failure visibility, and manual-copy fallback.
- **COM-012 MUST** — A reschedule alert clearly contains old and new date/time/field plus the canonical link.

## AI and media

- **AIM-001 MUST** — AI receives only finalized, approved public-data snapshots and approved notes; no contact, medical, waiver, signature, or private minor data.
- **AIM-002 MUST** — AI output follows a schema containing headline, narrative sections, fact references, omissions, and validation state.
- **AIM-003 MUST** — Deterministic code verifies all names, scores, innings, records, and numeric claims before review.
- **AIM-004 MUST** — AI cannot invent quotations or publish injury speculation, discipline, accusations, or criticism of officials.
- **AIM-005 MUST** — A named human approves an exact output version before any email/social/public publication.
- **AIM-006 MUST** — Source snapshot, prompt/template version, model, output, edits, validation, approver, and publication/correction history are retained.
- **AIM-007 MUST** — Official game amendment invalidates dependent drafts and requires regeneration/reapproval.
- **AIM-008 SHOULD** — Approved game recaps compile into an editable weekly release with box scores, standings, leaders, media recipients, and delivery log.
- **AIM-009 MUST** — Scorekeeper/admin notes are escaped and treated as untrusted content, never as instructions to the model.

## Privacy, security, accessibility, and operations

- **OPS-001 MUST** — Privileged accounts support MFA; sessions, passwordless/login flows, rate limits, and recovery follow the auth provider's secure patterns.
- **OPS-002 MUST** — Sensitive data is encrypted in transit and at rest; high-risk fields have restricted/application-level protection where justified.
- **OPS-003 MUST** — Logs redact tokens, signatures, contact details, DOB, emergency/medical data, and waiver content.
- **OPS-004 MUST** — Privacy settings include access/correction/export/deletion request workflow and documented lawful/contractual retention exceptions.
- **OPS-005 MUST** — Android and iOS account deletion can be initiated from the app; Google also has a public web deletion-request path.
- **OPS-006 MUST** — Public and administrative web experiences target WCAG 2.2 AA; game scoring supports large touch targets, sunlight/high-contrast use, and non-color status cues.
- **OPS-007 MUST** — Production runs behind TLS with only the reverse proxy publicly exposed; database, Redis, and object storage use private networks.
- **OPS-008 MUST** — Staging and production are isolated; tests/AI development use synthetic data.
- **OPS-009 MUST** — Nightly encrypted off-site backups cover database, object files, configuration, and necessary keys; restore is tested on a schedule.
- **OPS-010 MUST** — Health checks, structured logs, error monitoring, uptime monitoring, queue/dead-letter visibility, and backup alerts exist before production.
- **OPS-011 MUST** — Incident response covers credential compromise, data breach, lost device, misdirected message, corrupt official game, and restore.
- **OPS-012 MUST** — Mobile and store privacy declarations are generated from an inventory of first- and third-party data collection.
- **OPS-013 MUST** — Production actions and external sends remain explicit approval gates during AI-assisted development.
