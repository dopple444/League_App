# Privileged MFA Foundation

## Purpose and user outcome

An issued controlled-beta administrator can enroll a TOTP authenticator, save one-time recovery
codes, and complete an MFA challenge on later sign-ins. Production-like environments can require
that protection before any privileged mutation, while local synthetic development can explicitly
disable the mandatory gate. Authentication throttling and bounded sessions use Better Auth's owned
patterns rather than application-created credential logic.

## Scope

### Included

- Add the Better Auth two-factor schema and TOTP/backup-code plugin.
- Bound session lifetime/freshness and enable targeted authentication rate limits.
- Expose the current account's MFA posture without tenant data.
- Deny tenant mutations with a stable `MFA_ENROLLMENT_REQUIRED` response when policy is enabled.
- Add responsive enrollment and sign-in-challenge pages, including accessible manual-key and
  recovery-code alternatives.
- Reconcile the implemented password-only controlled-beta sign-in specification and add focused
  database, auth, API, component, and browser coverage.

### Excluded

- Invitation issuance/acceptance, pending-membership activation, and Platform Operator provisioning.
- Password recovery, magic link, passkey, email OTP, trusted-device, or real email delivery.
- Production deployment, real credentials/data, or any external send.

## Relevant requirements

- OPS-001, OPS-002, OPS-003, OPS-006, OPS-008, OPS-013.
- ONB-003 and ONB-004 as downstream consumers of this security gate.
- FND-002, FND-004, and FND-006 remain applicable to protected tenant operations.

## Pre-implementation current-state findings

- Better Auth owns password identities and sessions, with public sign-up disabled, but the current
  configuration has no MFA plugin or explicit session policy.
- Better Auth 1.6.29 already provides TOTP, encrypted setup secrets, backup codes, challenge cookies,
  account-level failed-factor lockout, and endpoint rate-limit rules.
- Application session resolution currently drops the plugin's `twoFactorEnabled` field, and tenant
  mutations cannot distinguish an enrolled from an unenrolled identity.
- Existing sign-in UI always routes to organization selection and has no MFA handoff.

## Proposed design

Add `twoFactorEnabled` to `auth_user` and an identity-owned `auth_two_factor` table. These tables are
global authentication records, not tenant-owned records, and therefore do not receive tenant RLS.
The runtime role receives only the table access required by Better Auth. Better Auth encrypts TOTP
secrets and recovery codes with its configured secret and owns all factor verification.

Configure an eight-hour session, hourly refresh, fifteen-minute freshness window, a ten-minute
factor-challenge cookie, no trusted-device UI, and account-level factor lockout. Enable global auth
throttling with stricter sign-in, factor verification, and enrollment rules.

Carry `twoFactorEnabled` through `AuthenticatedUser`. `GET /api/v1/me/security` reports only
`mfaEnabled` and the evaluated `mfaRequired` policy. `MutationService` checks that policy before
entering a tenant transaction and returns `MFA_ENROLLMENT_REQUIRED` without exposing tenant state.
The policy defaults enabled in `NODE_ENV=production` and may be overridden only with an explicit
boolean environment value; local Compose sets it false for existing synthetic journeys.

The sign-in form detects Better Auth's `twoFactorRedirect` result and routes to `/auth/two-factor`.
After ordinary sign-in it reads the security posture and routes to mandatory enrollment when needed.
Enrollment confirms the current password, renders a local QR data image plus selectable manual key,
verifies one TOTP, then requires recovery-code acknowledgement before leaving. Secrets remain only in
component memory and are never sent to application telemetry or retained evidence.

## Milestones

- [x] Record exact requirements, identity/membership sequencing decision, SYS-06, and register rows.
- [x] Add and verify the authentication schema/plugin/session/rate-limit policy.
- [x] Add API posture and privileged-mutation enforcement.
- [x] Add enrollment and challenge pages/forms and update sign-in routing.
- [x] Add focused automated coverage and run the relevant release matrix.
- [x] Update status, plan evidence, and artifact build states.

## Verification and acceptance

Run:

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
TURBO_CONCURRENCY=2 pnpm build
pnpm test:e2e
pnpm test:a11y
git diff --check
```

Acceptance evidence covers initial TOTP enrollment, invalid factor handling, one-time recovery-code
challenge, repeat sign-in challenge, revocation of pre-enrollment sessions, bounded/rate-limited auth
configuration, mandatory mutation denial, local explicit-policy override, enrollment replacement
protection, responsive validation states, labels/paste semantics, and no detectable WCAG A/AA
violations on the new entry pages. Real assistive-technology and physical-device review remains open.

## Migration, rollback, and data compatibility

The migration is additive and leaves existing users unenrolled. Rolling back application behavior
means explicitly disabling the mandatory policy and deploying the prior application; factor records
remain encrypted and readable by the forward version. Do not drop factor data in rollback. Secret
rotation must preserve a decryption key for existing encrypted factors.

## Security and privacy review

- Raw TOTP secrets and recovery codes are handled only by Better Auth and ephemeral enrollment UI.
- No factor secret, password, OTP, recovery code, auth cookie, or raw provider response is logged,
  placed in URLs, stored in browser persistence, or retained in screenshots.
- MFA posture is identity-scoped and discloses no organization or membership information.
- Tenant authorization remains separate; MFA never grants a permission or membership.
- Production-like mandatory policy fails closed. Real hosting remains an OPS-013 Production Gate.

## Decisions made

- ADR-026 resolves provisioning, invitation acceptance, pending membership, and MFA activation order.
- Use Better Auth's native TOTP/backup-code implementation and rate limiter; do not implement
  credential cryptography in application code.
- Do not offer trusted-device bypass during controlled beta.

## Discoveries and risks

- The current local browser suite uses shared unenrolled synthetic accounts. Local Compose keeps the
  mandatory policy explicitly false until invitation-seeded MFA fixtures are added; plugin/challenge
  behavior is covered independently in this slice.
- In-memory rate limiting is process-local. A shared atomic rate-limit store remains a hosted-beta
  scaling gate if the API runs more than one replica.
- Direct `192.168.2.45:8088` access is an explicit private-address, synthetic-data test exception.
  It uses plain HTTP and is not acceptable outside the trusted LAN; hosted beta still requires TLS.

## Progress log

- 2026-08-22 UTC — Reconciled requirements, architecture, Better Auth 1.6.29 capabilities, and UI
  coverage. Added ONB-001 through ONB-004, ADR-026, SYS-06, and planned artifact rows. Implementation
  started from the green `c14b1fc` checkpoint.
- 2026-08-22 UTC — Added additive migration `20260822000100_privileged_mfa`, Better Auth TOTP and
  encrypted recovery-code ownership, eight-hour sessions with hourly refresh/fifteen-minute
  freshness, targeted auth throttling, and an enrollment hook that revokes every older session while
  retaining the newly verified replacement.
- 2026-08-22 UTC — Added identity-only `GET /api/v1/me/security`, the pre-tenant
  `MFA_ENROLLMENT_REQUIRED` mutation gate, effective-role filtering, sign-in MFA handoff, guarded
  enrollment, factor challenge/recovery forms, and explicit local policy override. Factor secrets and
  recovery codes remain out of URLs, persistence, logs, and retained evidence.
- 2026-08-22 UTC — Focused suites passed: auth 6/6, database 12/12, API unit 13/13, web 72/72, API
  integration 15/15, tenancy 4/4, authorization 1/1, and outbox 4/4. Migration repeat/seed checks,
  full lint/typecheck/build, generated-contract/format/Compose policy, dependency security, and
  blocking container security checks passed. The rebuilt nine-service stack and five health paths
  passed; browser journeys passed 10/10 and automated accessibility passed 6/6 through
  `192.168.2.45:8088`.
- 2026-08-22 UTC — WEB-PAGE-017/018 and WEB-FORM-011/012 are **Implemented / Needs changes**. No
  secret-bearing screenshot was retained. Real screen-reader, desktop Ctrl-Plus, and physical-device
  review remain before a style Pass. Platform Operator provisioning and invitation/pending-membership
  activation are the next onboarding slice.
