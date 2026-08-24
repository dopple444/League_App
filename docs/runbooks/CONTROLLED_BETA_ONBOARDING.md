# Controlled-beta onboarding runbook

This runbook covers the current assisted, synthetic-data workflow. It does not authorize public
hosting, real customer/contact data, or external email/SMS delivery.

## Preconditions

- Use the private trusted-LAN gateway only; do not router-forward the plain-HTTP local stack.
- Use `.invalid` administrator addresses and practice organization/league names.
- The Platform Operator must have both an effective platform grant and verified MFA. Customer
  organization roles do not grant platform access.
- Keep the generated invitation link in an approved temporary handoff channel. It is a bearer
  credential even though only its digest is stored by the application.

## Provision and hand off

1. Sign in with the issued Platform Operator identity and complete MFA.
2. Open `/platform/onboarding`, choose **Provision customer**, and enter the organization, initial
   league, IANA timezone, issued administrator address, expiry, and attributable reason.
3. Review the exact foundation and confirm once. If the connection result is unknown, retry without
   changing the values so the same idempotency key can recover the result.
4. Copy the fragment-based invitation link from the one-time receipt. Verify that the URL has no
   token in its path or query. Clear the receipt after the link is safely handed off.
5. The invitee opens the complete link, reviews the masked context, creates or uses the issued
   account, signs in with the exact invited address, and completes MFA.
6. Confirm that the organization appears in the invitee's workspace chooser only after MFA and that
   the operator's invitation ledger reports activation.

## Failure and recovery boundaries

- Invalid, expired, revoked, used, wrong-address, and prior-membership cases intentionally use one
  unavailable response. Do not diagnose a tenant or identity from that response.
- A rate-limited or temporarily unavailable invitation check keeps the bearer only in the current
  page's memory. Use the on-page retry after waiting; refreshing or navigating away deliberately
  clears that in-memory handoff, so reopen the original complete link if necessary.
- A pending membership is deliberately absent from the workspace chooser and cannot authorize any
  tenant action.
- A pending invitation may be revoked with an attributable reason. Revocation is terminal.
- There is no resend/reissue workflow in this slice. If a link is lost, expires, or is revoked, stop
  that onboarding attempt and record the incident; do not edit invitation, membership, role,
  idempotency, or audit rows by hand. A reviewed forward migration or the planned reissue feature is
  required. For disposable synthetic testing only, a new distinctly named practice organization may
  be provisioned instead.
- Do not paste invitation links, passwords, authenticator secrets, or recovery codes into logs,
  screenshots, issues, commits, or retained test artifacts.

## Current release gates

Real delivery, shared multi-replica rate limiting, TLS/public hosting, external secret injection,
monitoring, off-site recovery, and real assistive-technology/device review remain hosted-beta gates.
