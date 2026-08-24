# Milestones 0–1 threat model

## Scope and trust boundaries

The current slice contains browser/mobile clients, loopback Nginx, web/API/worker/scheduler
containers, PostgreSQL, Redis, MinIO, and Mailpit. The API/database transaction is the authority
boundary. Redis, browser state, generated views, and worker queues are never authoritative facts.
The public endpoint, authenticated tenant endpoint, runtime database connection, migrator
connection, and ignored source-document directory are separate trust boundaries.

Assets include identity sessions, tenant membership/permissions, controlled-beta invitation
bearers and administrator addresses, platform grants, season/team drafts and published snapshots,
audit/outbox/idempotency records, database/object-store credentials, and future legal source
artifacts. Current fixtures are synthetic. No waiver body, signature, contact list, real minor
record, payment credential, or provider token is authorized in this slice.

## Priority threats and controls

| Threat | Milestones 0–1 control | Verification |
| --- | --- | --- |
| Cross-tenant read/write | Explicit organization IDs, composite tenant keys, scoped transactions, forced RLS, `NOBYPASSRLS` runtime/test roles | tenant denial suite and wrong-context SQL tests |
| Title implies authority | Board/officer assignments remain independent; server checks granular permission | authorization matrix |
| Draft/private data reaches public response | Immutable publication snapshot and public DTO allowlist; absent/draft/withdrawn returns 404 | API/E2E public visibility tests |
| Retried mutation duplicates state | Idempotency record plus state/audit/outbox in one transaction | retry and rollback tests |
| Platform Operator becomes an implicit customer administrator | Platform grants are identity-scoped and separate from tenant membership; provisioning uses prospective-tenant RLS without creating operator membership | operator grant/MFA denial tests and zero-membership assertion |
| Invitation bearer leaks through storage, URL, logs, or browser history | Domain-separated HMAC bearer; SHA-256 digest-only storage; fragment and JSON-body transport; immediate fragment removal; bearer-free list/audit/outbox/idempotency DTOs | contract, database, API, component, and browser leakage tests |
| Invitation is guessed, reused, revoked late, or accepted by the wrong identity | 256-bit opaque bearer, bounded inspection, address match, expiry/revocation/version checks, single-use serializable acceptance, uniform unavailable response | invalid/revoked/expired/wrong-address/replay/concurrency tests |
| Pending invitation authority becomes effective before MFA | Acceptance creates only PENDING membership and exact role assignment; discovery and authorization require ACTIVE; verified MFA performs one audited activation | pending discovery/authz denial and TOTP activation tests |
| Audit/outbox failure loses trace | Transaction rollback; audit tables deny ordinary update/delete | forced-failure integration test |
| Redis loss, worker crash, or stale delivery abandons/duplicates committed work | PostgreSQL-authoritative outbox; metadata-only queue envelope; leased tenant-scoped `SKIP LOCKED` claims; dispatch-generation fencing; terminal failure visibility | relay unit/integration tests, lease reclaim, concurrent claim, stale completion, and Redis restart rehearsal |
| Session/secret disclosure | HttpOnly web session design, secure mobile storage boundary, redacted structured logs, ignored generated secrets | logger tests, secret scan, response inspection |
| Database-owner RLS bypass | Separate migrator from runtime/test LOGIN roles with `NOBYPASSRLS`; API receives runtime URL only | role assertions and denial tests |
| Public infrastructure exposure | Gateway is the only application ingress; data services are internal and diagnostics bind loopback | Compose config and socket inspection |
| Supply-chain substitution | Exact manifests/locks, pnpm build allowlist, hash-verified uv, image/action digests | frozen install and CI policy checks |
| Source/legal text corruption | Source directory ignored; metadata-only hashes; waiver components tracked independently; no baseline fabricated while absent | import trace check; later byte/text/render regression |

## Residual risk and required gates

- Better Auth production recovery/MFA, shared-environment secrets, TLS, rate limits, monitoring, and
  support access need production hardening before real accounts.
- Source files are absent. Waiver legal-body and deterministic render baselines remain unverified;
  creating or changing legal text is prohibited without the documented gate.
- The local Compose host is one availability domain. It is a development/pilot topology, not an
  approved commercial production environment.
- Container/dependency scans reduce known-vulnerability risk but do not replace penetration review
  or timely patch operations.
- No current worker performs an external send. Adding real providers, recipients, payments, public
  deployment, real data, or app-store release remains a Production Gate.
- The relay provides at-least-once processing, not exactly-once external effects. Every future
  provider adapter must use the stable outbox event ID as its idempotency key and record delivery
  evidence before a real send is approved.
