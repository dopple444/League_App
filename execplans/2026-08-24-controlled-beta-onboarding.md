# Controlled-beta assisted tenant onboarding

## Purpose and user outcome

A separately authorized Platform Operator can create a controlled-beta customer organization, its
first league, the default League Administrator role, and a time-limited administrator invitation.
The invited customer can create or use the issued account, accept the address-bound invitation,
enroll MFA, and only then gain effective access to the new organization. This supplies the first
complete answer to “How do I start a new league?” without enabling public sign-up or self-service
tenant creation.

## Scope

### Included

- Add platform-scoped, effective-dated provisioning and invitation-management grants that never
  imply customer-tenant membership.
- Add an idempotent, reason-required Platform Operator command that atomically creates an
  Organization, initial League, OPERATIONS-scoped League Administrator role and permissions,
  pending administrator invitation, tenant audit/outbox records, and platform audit history.
- Add address-bound, expiring, revocable, single-use invitations whose bearer token is represented
  in storage only by a cryptographic digest.
- Add invite inspection, invite-authorized account registration, authenticated acceptance into a
  PENDING membership, and MFA-gated activation into an ACTIVE membership.
- Add the responsive Platform Operator workbench, invitation acceptance page, invitation-aware
  sign-in/MFA handoff, and truthful zero-membership guidance.
- Add synthetic operator and invitee fixtures plus denial, race, replay, tenant-isolation,
  accessibility, and browser coverage.

### Excluded

- Public registration, unrestricted customer self-service, commercial subscription onboarding, or
  a tenant directory.
- Real email/SMS delivery, live customer data, public hosting, DNS, TLS, or provider credentials.
- Password recovery, invitation resend/replacement, support impersonation, or platform-grant
  administration UI.
- Field availability and manual schedule authoring; those remain the next vertical slice.

## Relevant requirements

- ONB-001, ONB-002, ONB-003, ONB-004.
- FND-001, FND-002, FND-003, FND-004, FND-006.
- OPS-001, OPS-002, OPS-003, OPS-006, OPS-008, OPS-013.

## Current-state findings

- The tenant schema has only ACTIVE/SUSPENDED memberships and no invitation or platform-authority
  records. Existing tenant mutations correctly require an effective membership and therefore must
  not be weakened for provisioning.
- RLS and `app.list_user_organizations()` already exclude anything other than ACTIVE membership;
  AccessService repeats that check at the service boundary.
- Better Auth owns account/password creation and MFA. Public sign-up is disabled. A separate
  server-only Better Auth instance can authorize account creation only after a valid invitation has
  been inspected, without exposing its handler as a public sign-up route.
- The existing tenant MutationService cannot reserve idempotency before an organization exists.
  Platform commands need a separate platform-scoped reservation and audit boundary.
- SYS-02 was illustrative team-invitation copy and ADM-61 is explicitly post-MVP commercial
  onboarding. The style guide now defines dedicated controlled-beta behavior before UI work starts.

## Proposed design

Add PENDING to `MembershipStatus` and make it the safe database default; every intentional seed of
an active member becomes explicit. Add platform access grants, platform idempotency records, and
append-only platform audit events as identity/platform-owned records. Add tenant-owned
administrator invitations with organization, league, exact role, normalized address, SHA-256 token
digest, expiry, accepted/revoked/activated evidence, version, and actors.

Platform commands always require live MFA plus an effective platform permission. The service
generates the prospective organization UUID before entering one serializable transaction, sets
that organization as the RLS context, reserves the global actor/idempotency key, creates the full
tenant foundation, and writes both platform and tenant audit history. The default League
Administrator role uses `AuthorityKind.OPERATIONS`; it does not imply an elected office or Board
position.

Invitation bearer values are HMAC-derived from a random invitation UUID using a domain-separated
key derived from the Better Auth secret, then SHA-256-digested for storage. The raw value can be
reconstructed only for the successful idempotent provisioning response, is displayed once in the
synthetic operator workbench, and never enters a URL query/path, database row, audit/outbox event,
idempotency response, log, screenshot, or browser persistence. The UI hands it through a URL
fragment, immediately removes the fragment from browser history, and posts the token in JSON.

A narrowly granted SECURITY DEFINER function resolves only an organization UUID from a token
digest; all invitation reads/writes then run under tenant RLS. Inspection returns only organization
name, league name, masked address, and expiration. Invalid, expired, revoked, and used tokens share
one unavailable response.

Invite-authorized registration creates only a Better Auth identity and returns the same continue-to-
sign-in result if the address already has an identity. General Better Auth sign-up remains disabled.
After normal sign-in, authenticated acceptance compares the session address to the invitation,
atomically consumes it, and creates exactly one PENDING membership and exact role assignment. The
pending record remains absent from organization discovery and cannot satisfy any permission.

Identity security posture exposes only booleans for effective platform access and pending
activation. Either condition makes MFA required even when the shared local demo policy override is
off. After verified MFA, an authenticated recovery-safe activation command changes each owned
PENDING membership to ACTIVE once and records the attributable transition. The organization then
appears through the existing chooser.

## Milestones

- [x] Reconcile requirements, architecture, UI mappings, and current implementation boundaries.
- [x] Add the additive schema, migration, grants, RLS functions, seed fixture, and database tests.
- [x] Add contracts, generated SDK operations, platform/onboarding services, and authorization tests.
- [x] Add operator, invitation, sign-in handoff, activation, and zero-membership web experiences.
- [x] Run the complete validation matrix and retain only token-free UI evidence.
- [x] Update status/evidence, commit, and push the verified checkpoint.

## Verification and acceptance

Run focused tests during implementation, then:

```bash
pnpm --filter @league/database db:generate
pnpm format:check
TURBO_CONCURRENCY=2 pnpm lint
TURBO_CONCURRENCY=2 pnpm typecheck
pnpm contracts:check
TURBO_CONCURRENCY=2 pnpm test:unit
pnpm db:migrate:verify
pnpm db:seed:verify
pnpm test:integration
pnpm test:tenancy
pnpm test:authz
pnpm test:outbox
TURBO_CONCURRENCY=2 pnpm build
pnpm test:e2e
pnpm test:a11y
pnpm stack:smoke
pnpm security:dependencies
pnpm security:containers
git diff --check
```

Acceptance evidence must prove operator-only/MFA-only provisioning, atomic rollback, same-key replay
and changed-payload conflict, no implicit operator tenant membership, token-digest-only persistence,
uniform invalid invitation behavior, revocation and expiry, single-use/concurrent acceptance,
address mismatch denial, hidden/ineffective PENDING membership, MFA-only one-time activation,
cross-tenant denial, disabled public sign-up, responsive keyboard/zoom behavior, and no automated
WCAG A/AA findings on the changed pages.

## Migration, rollback, and data compatibility

The migration is additive except for changing the membership default from ACTIVE to PENDING. Existing
rows retain their state, and every seed path now writes ACTIVE explicitly. Application rollback may
leave the new tables and enum value in place; do not drop invitation, audit, or membership history.
If a forward fix is needed, disable the operator route while preserving already issued invitations.
Rotating the authentication secret invalidates outstanding invitation bearer values and requires
revocation/reissue; it must not silently activate or rewrite memberships.

## Security and privacy review

- Platform authority and tenant membership are distinct database concepts and denial paths.
- Platform provisioning and revocation require both an effective grant and live MFA.
- Invitation tokens are never logged or stored raw; generated SDK and UI calls use POST bodies.
- PENDING membership cannot be discovered through the tenant chooser or used for authorization.
- Account registration remains invitation-specific and cannot overwrite an existing password.
- Audit/outbox payloads omit the administrator address, password, and invitation bearer value.
- The local handoff is synthetic only. Real delivery and public hosting remain OPS-013 gates.

## Decisions made

- Use `OPERATIONS` for the default League Administrator role so onboarding does not manufacture an
  elected officer or Board title.
- Require MFA unconditionally for platform actions and for activating an accepted administrator
  invitation, independent of the local shared-demo policy override.
- Use a server-only Better Auth registration instance rather than enabling the public sign-up route
  or implementing password hashing in application code.
- Carry invitation bearers in URL fragments and JSON bodies only; no query/path token is accepted.

## Discoveries and risks

- A process-local Better Auth limiter remains unsuitable for multiple hosted API replicas; that is a
  separate hosted-beta gate.
- Synthetic copy-once invitation handoff is not real delivery. Losing the link requires an operator
  revocation and a future reissue workflow, which remains excluded from this slice.
- Real screen-reader, desktop Ctrl-Plus, and physical-device review remain human follow-up items even
  after automated accessibility checks pass.

## Progress log

- 2026-08-24 UTC — Reviewed AGENTS, IMPLEMENT, PLANS, STATUS, requirements, roadmap, architecture,
  ADR-026, the complete UI style guide, artifact register, current schema/auth/API/web code, and the
  preceding MFA ExecPlan. Selected ONB-001 through ONB-004 as the next coherent vertical slice and
  recorded the security/UI design before implementation.
- 2026-08-24 UTC — Implemented distinct effective-dated platform grants, PENDING membership, tenant
  invitation state, actor-scoped platform idempotency/audit history, least-privilege definer helpers,
  and forced RLS for tenant/platform records. Added the synthetic no-membership Platform Operator.
- 2026-08-24 UTC — Implemented strict contracts/generated SDK calls, MFA- and grant-gated atomic
  provisioning/revocation, digest-only invitation handling, invite-authorized identity creation,
  single-use acceptance, and MFA-only activation. Concurrency, rollback, recovery, address binding,
  hidden pending access, operator non-membership, and a real Better Auth TOTP flow are covered by
  database-backed tests.
- 2026-08-24 UTC — Implemented the responsive Platform Operator workbench, invitation acceptance,
  sign-in/MFA bearer handoff, retry-safe recovery states, capability-aware controls, and truthful
  zero-workspace guidance. Raw invitation bearers remain fragment/POST/in-memory only and are
  excluded from persisted browser state and retained evidence.
- 2026-08-24 UTC — Passed repository formatting, lint, typecheck, contract drift, unit, mobile,
  production build, nine-migration/repeat/seed, 22 integration, four tenancy, one authorization, four
  outbox, restore, and smoke checks. The final trusted-LAN run passed 14 functional and 10
  desktop/mobile accessibility browser checks; seven visually reviewed screenshots were captured
  from mutation-blocked synthetic states after token-free history/storage/DOM assertions.
- 2026-08-24 UTC — Dependency policy passed under the two exact expiring Metro exceptions. The
  blocking hosted-runtime container scan passed; the development-only images remain report-only
  under SEC-EXC-002. Human end-to-end UAT, real assistive technology/device review, shared limiting,
  and hosted deployment controls remain explicit release gates rather than local completion claims.
