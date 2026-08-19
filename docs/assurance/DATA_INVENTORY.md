# Milestones 0–1 data inventory

This inventory covers the implemented foundation slice and uses synthetic records only. Retention
periods and legal bases for later participant/legal data remain subject to counsel and tenant
approval.

| Data group | Classification | Purpose / current visibility | System of record | Current handling |
| --- | --- | --- | --- | --- |
| User/session identifiers | Confidential personal | Authentication and attributable actions; self/admin only | Better Auth tables in PostgreSQL | HttpOnly web session boundary; mobile secure-storage boundary; never public/logged |
| Organization membership and role assignment | Internal | Tenant selection and server authorization | PostgreSQL | organization-scoped, audited, runtime RLS |
| Organization/league/season/team drafts | Internal | League administration | PostgreSQL | organization-scoped, version checked, not exposed publicly |
| Published league/team/schedule snapshot | Public | Approved public read-only pages/API | immutable PostgreSQL publication snapshot | explicit DTO allowlist; withdrawn/nonexistent is 404 |
| Audit/security/idempotency/outbox metadata | Internal; security-sensitive | Traceability, retries, queued effects | append-restricted PostgreSQL tables | request/actor/organization correlation; no secret/contact payloads in logs |
| Generated local credentials | Secret | Local service/auth/database access | ignored mode-0600 `.env` | independent high-entropy values, never printed or committed |
| Synthetic demo identity | Confidential synthetic | Reproducible demo and tests | PostgreSQL | `.invalid` identity; generated ignored password; never reused for production |
| Authorized source-document metadata | Highly restricted metadata | Provenance and later import review | committed metadata report | filename/type/size/hash only; content remains ignored and is not logged |
| Waiver legal body/render | Highly restricted; not present | Future immutable document/version proof | future object storage/PostgreSQL | two components marked pending; no text/hash/render invented |
| Object files | Not used by current slice | Future documents/exports | private MinIO bucket | anonymous access disabled; generated local access secret |
| Queue data | Internal | Post-commit work dispatch | Redis/BullMQ (disposable transport) | tenant/request/event metadata only; PostgreSQL outbox remains authoritative |
| Scheduler request data | Internal; not used by current slice | Future schedule solve | transient private scheduler | only health endpoints enabled; no persistence or public route |

Public pages must never gain a field merely because it exists in an internal model. Any future DOB,
guardian, contact, waiver/signature, medical, incident, payment, communication-consent, or minor
profile field requires inventory expansion with purpose, visibility, retention, processor, export,
and deletion behavior before implementation.
