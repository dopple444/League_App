# Security, legal, privacy, communications, and operations

This is engineering/compliance planning, not legal advice. Before production, Kentucky counsel, the league's insurance carrier, Meade County/Parks, and applicable payment/messaging providers should approve the actual language, retention, and operating procedures.

## 1. Digital signatures and waiver evidence

Federal E-SIGN and Kentucky's Uniform Electronic Transactions Act generally prevent denying legal effect solely because a record or signature is electronic. That does not make the underlying waiver language enforceable, especially for minors.

The engineering goal is evidence of:

- the exact content presented;
- voluntary agreement to transact/sign electronically;
- signer identity and authority/relationship;
- clear intent to sign;
- attribution and security/verification procedure;
- time and transaction context;
- accurate, accessible, reproducible retention;
- delivery/access to a copy;
- immutable history and later amendments.

### Required signing ceremony

1. Resolve the participant and authorized signer; authenticate the user.
2. For a guardian, capture relationship and the managed participant.
3. Show electronic-record consent and paper alternative/access information.
4. Render the approved immutable document version with allowed merge fields.
5. Let the signer view/download the full document before signing.
6. Require typed legal name, an explicit statement of intent, and a deliberate sign action. Use OTP/recent authentication as configured.
7. Atomically store the signature event, document/render hashes, signer/participant/relationship, tenant/season/team, UTC timestamp, IP/user agent, verification method, consent record, and request ID.
8. Generate a final PDF/signing certificate and deliver/make it available.
9. Mark the eligibility requirement satisfied only after persistence succeeds.

A drawn signature is optional supporting evidence, not the sole proof. Do not permit admins to backdate or fabricate an electronic-signature event. Paper documents use a separate scanned/manual-record workflow with reviewer and source type.

### Minor waiver caution

Kentucky case law raises material limits on a parent's ability to release a minor's own potential claim. Counsel/insurer must decide the exact waiver, assumption-of-risk, emergency-treatment authorization, and minor acknowledgement approach. The product must not promise that a guardian signature guarantees liability release. Each future tenant supplies counsel-approved text; the SaaS operator does not provide a universal legal waiver.

### Legal holds and retention

- Put signed documents, official books, incidents, and connected communications on legal hold when a claim/protest/investigation is possible.
- Do not set the minor-document retention period without counsel and insurer input; limitation periods may be tolled while a claimant is a minor.
- Retention jobs produce a reviewable manifest/audit, honor holds, and separate account deletion from records the organization is obligated/entitled to retain.

## 2. Children and guardian-managed participation

COPPA can apply to child-directed services and general-audience services with actual knowledge they collect personal information from a child under 13. MVP defaults reduce exposure and risk:

- no under-13 self-service account, email, or phone;
- guardian creates/manages the participant profile and consents;
- no behavioral advertising, data sale, ad trackers, precise background location, or open chat;
- no direct adult-to-minor private messaging;
- separate guardian choices for public name, photo/video, and statistics;
- default minor public format is the tenant's counsel-approved private option, such as first name/last initial;
- collect only necessary DOB/eligibility data; restrict and encrypt it;
- guardian access/correction/deletion workflows and purpose-based retention;
- never send minor private data to the AI system.

If a later version adds teen accounts or messaging, require a new legal/safety design review, guardian linkage, adult visibility, reporting/moderation, and SafeSport-informed communication rules.

## 3. Privacy design

### Data classification

| Class | Examples | Minimum handling |
| --- | --- | --- |
| Public | published schedule, final score, approved news | integrity/version controls; no private fields |
| Internal | draft schedule, ordinary staff notes | authenticated tenant access |
| Confidential personal | names, email/phone, DOB, guardian relationship, payment metadata | least privilege, encryption, redacted logs, export/delete process |
| Highly restricted | waiver/signature evidence, medical/emergency info, incidents/discipline, auth secrets | explicit roles, stronger field/storage protection, access audit, no AI/analytics |

Maintain a data inventory mapping each field to purpose, visibility, retention, processors, backups, exports, store privacy declarations, and deletion behavior.

### Account/data rights

- clear privacy policy and contact;
- view/correct core profile and preferences;
- portable export request;
- account deletion request with reauthentication/confirmation;
- show which official/legal records will be retained and why;
- propagate applicable deletion to processors;
- retain a minimal suppression record when needed to honor opt-outs.

Apple requires apps with account creation to let users initiate deletion in the app. Google Play requires an in-app deletion path and a public web resource. Build both from the beginning.

## 4. SMS, email, push, and recipient safety

Do not treat a roster phone number as blanket consent for automated messages.

### Consent records

Record league/sender identity, channel, operational vs promotional purpose, exact disclosure version, phone/email, source, timestamp, verification, and revocation. Use separate consent/preference scopes for:

- urgent game/safety operations;
- routine schedules/reminders;
- league news;
- fundraising/marketing;
- future SaaS marketing (never inherit from league operations).

### Opt-out and suppression

- Process standard SMS words and ordinary-language revocation.
- Suppress immediately in product behavior even if law/provider allows longer processing.
- Keep tenant/sender-specific suppression so reimporting a roster cannot silently re-subscribe.
- Provide push/email/web/coach-relay alternatives where appropriate.
- Commercial email uses accurate headers/subjects, sender address, postal address, and working unsubscribe.
- Do not mix operational weather/schedule messages with commercial promotion.

### Delivery workflow

Recipient selection → preview/count → authorization → immutable recipient snapshot → deduplication → consent/suppression → queued channel messages → delivery attempts/retries → failure dashboard → acknowledgement/escalation.

No real recipients in development/staging. External send is a Production Gate.

## 5. Weather and safety decisions

The NWS API supplies forecast, observation, and official alert context. A human authorized by the league makes field/game decisions.

Required record:

- affected venue/field/game scope;
- NWS alert/forecast reference and on-site observation;
- decision maker and authority;
- status and reason;
- decision/announcement time;
- next-update time;
- shelter/lightning instructions;
- delivery/acknowledgement results.

The status page is canonical. Social platforms are secondary and may fail. Follow the league's written emergency action plan. NWS outdoor-sports guidance recommends suspension when thunder is heard and waiting at least 30 minutes after the last thunder before resumption; dugouts and small outdoor shelters are not safe lightning shelters. Confirm final local policy with the facility/insurer.

## 6. Social publishing

- Separate adapter and OAuth connection for each network.
- Target authorized Pages/accounts, not scraping or storing passwords.
- Request minimum scopes and encrypt refresh/access tokens.
- Expect app review, token expiry, permission/version changes, rate/cost changes, and partial failures.
- Store approved content version, remote ID, authorizer, times, attempt/failure, and deletion/correction status.
- Provide “copy approved announcement” fallback.
- Reconfirm provider requirements at implementation/release. Do not design around Facebook Groups publishing; current Meta changes have removed/deprecated important Groups capabilities.

## 7. Payments and PCI

Use a provider-hosted redirect checkout so card data does not render in an application-hosted form and never enters application servers/logs/storage.

- Each tenant should ultimately connect its own merchant account; avoid custody of tenant funds in the first commercial version.
- Platform subscription billing is separate from league participant/team payments.
- Verify signed webhooks and use provider event ID/idempotency.
- Reconcile amount, currency, fees, settlement, refunds, credits, and disputes.
- Restrict/refund permissions and audit manual adjustments.
- Verify provider PCI compliance and shared responsibilities; confirm applicable SAQ with the acquiring bank. Outsourcing reduces but does not erase merchant responsibilities.

## 8. AI safety and media controls

- AI is never in the authoritative score/stat path.
- Only finalized public snapshots and approved notes leave the platform.
- Use structured output and deterministic validation; schema conformity is not factual correctness.
- Treat notes as untrusted data and defend against prompt injection.
- Keep prompts narrow, output length bounded, and model/vendor configurable.
- Human reviewer sees the source facts beside the draft and must approve exact content.
- Never auto-email/post, and never invent quotes or speculate on injury/discipline.
- Retain public source snapshot, prompt/schema/model versions, output, validation, edits, approver, publication, and correction chain.
- Review API data-retention configuration; use the approved `store` policy and minimize data.
- Maintain a regression/evaluation set of synthetic and historical-public games covering blowouts, ties, forfeits, suspensions, corrections, missing stats, unusual names, and adversarial notes.

## 9. Application and infrastructure security

### Identity/session

- MFA for Board/officers, finance, waiver admins, schedulers, platform operators, and support.
- Secure, HttpOnly, SameSite cookies for web where applicable; PKCE and secure storage for mobile.
- Shorter/recent-auth requirement for export, permission, waiver override, finance, game amendment, provider connection, and deletion.
- Rate-limit login, verification, password recovery, invitation, public lookup, and write endpoints.
- Revoke sessions after credential/role/security changes.

### Application

- Strict input schemas; parameterized database access; output encoding; CSRF/CORS/headers appropriate to clients.
- Permission and tenant checks at service/API boundaries and RLS defense-in-depth.
- File type/size validation, malware scanning where appropriate, random storage keys, no public bucket by default.
- Webhook signatures, replay windows, idempotency, and secrets rotation.
- Dependency/container/SBOM scanning; supported versions and timely patches.
- Audit events are append-only/restricted; consider integrity chaining or periodic signed manifests for high-value official records.
- No secrets in source, images, logs, crash reports, AI prompts, or client bundles.

### Mobile/device

- Minimal permissions; do not request contacts/SMS/location unless a feature truly needs them.
- No sensitive data in push payloads or lock-screen text.
- Encrypt local scoring data if the threat model requires it; secure key storage; remote session revocation.
- Clear cached private data on logout/account removal while protecting unsynced official events with an explicit recovery flow.

## 10. Accessibility and field usability

Target WCAG 2.2 AA on web and equivalent mobile accessibility:

- keyboard and screen-reader navigation;
- labels, focus, validation summary, and accessible document signing;
- text plus color/icons for state;
- high contrast and sunlight mode;
- large touch targets and minimal scoring taps;
- zoom/reflow and responsive layouts;
- reduced motion and usable error recovery;
- status announcements for live changes without overwhelming assistive technology.

Test with real scorekeepers/coaches/umpires on representative phones at the field before release.

## 11. Backup, recovery, and continuity

A Docker volume is not a backup.

### Minimum backup set

- nightly PostgreSQL custom-format dump;
- point-in-time recovery/WAL once production criticality justifies it;
- object storage files and version metadata;
- deployment/configuration and encrypted secrets recovery materials;
- signing keys/certificates through secure provider/export procedure;
- off-site encrypted copy using restic or equivalent.

### Verification

- automated job/result alerts;
- checksum/integrity verification;
- routine restore to an isolated environment;
- documented Recovery Point Objective and Recovery Time Objective;
- pre-season full disaster exercise;
- restore test before/after major storage or database changes.

Game-night continuity includes live-scoring offline failover, printed/emergency contact alternatives, and a manual weather/communication backup if the public service fails.

## 12. Observability and incident response

Monitor:

- web/API availability and latency;
- database capacity/replication/backups;
- queue depth, failed/dead jobs, delivery failures;
- live-game connections and sync conflicts;
- auth/security anomalies;
- object storage and disk capacity;
- NWS/provider failures and token expiry;
- AI validation/rejection rate and spend;
- mobile crash/error versions.

Maintain response playbooks for data breach, account takeover, lost device with unsynced events, misdirected message, duplicate/incorrect payment, corrupt official book, bad schedule publication, social compromise, provider outage, and full restore. Kentucky breach-notification obligations and contracts may impose deadlines; counsel owns legal determinations.

## 13. Pre-production approvals

Obtain and record:

- league Board/officer approval of roles, rules, schedule defaults, stats, and amendment authority;
- Parks/Fiscal Court and insurance confirmation of exact waiver rendering/signing/retention;
- Kentucky counsel review of adult/minor electronic documents, privacy/terms, retention, and communications;
- payment acquirer/provider PCI responsibility confirmation;
- SMS brand/campaign/consent/opt-out review;
- Apple/Google privacy, account deletion, age/audience, and data-safety review;
- facilities/emergency/lightning/weather plan approval;
- successful security, tenant-isolation, backup/restore, offline-scoring, load, and accessibility tests.
