# Milestones 0–1 threat model

## Scope and trust boundaries

The current slice contains browser/mobile clients, loopback Nginx, web/API/worker/scheduler
containers, PostgreSQL, Redis, MinIO, and Mailpit. The API/database transaction is the authority
boundary. Redis, browser state, generated views, and worker queues are never authoritative facts.
The public endpoint, authenticated tenant endpoint, runtime database connection, migrator
connection, and ignored source-document directory are separate trust boundaries.

Assets include identity sessions, tenant membership/permissions, season/team drafts and published
snapshots, audit/outbox/idempotency records, database/object-store credentials, and future legal
source artifacts. Current fixtures are synthetic. No waiver body, signature, contact list, real
minor record, payment credential, or provider token is authorized in this slice.

## Priority threats and controls

| Threat | Milestones 0–1 control | Verification |
| --- | --- | --- |
| Cross-tenant read/write | Explicit organization IDs, composite tenant keys, scoped transactions, forced RLS, `NOBYPASSRLS` runtime/test roles | tenant denial suite and wrong-context SQL tests |
| Title implies authority | Board/officer assignments remain independent; server checks granular permission | authorization matrix |
| Draft/private data reaches public response | Immutable publication snapshot and public DTO allowlist; absent/draft/withdrawn returns 404 | API/E2E public visibility tests |
| Retried mutation duplicates state | Idempotency record plus state/audit/outbox in one transaction | retry and rollback tests |
| Audit/outbox failure loses trace | Transaction rollback; audit tables deny ordinary update/delete | forced-failure integration test |
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
