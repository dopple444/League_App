# Autonomous implementation runbook

## Operating loop

1. Read `AGENTS.md`, `docs/STATUS.md`, the active ExecPlan, and the relevant requirement/architecture sections.
2. Confirm the working tree and preserve unrelated user changes.
3. Implement the smallest coherent vertical slice.
4. Add or update tests before considering the slice complete.
5. Run checks, fix failures, and review the diff for security, tenant isolation, data loss, and scope creep.
6. Update the ExecPlan, `docs/STATUS.md`, and `docs/DECISIONS.md` when needed.
7. Continue to the next planned slice without asking for routine “next step” permission.

## Default autonomy

Codex may autonomously:

- create local development code, migrations, tests, documentation, fixtures, and Docker configuration;
- install ordinary development dependencies consistent with the approved architecture;
- use synthetic data;
- run local builds, tests, emulators, and containers;
- refactor within the active milestone when tests preserve behavior;
- make reversible local Git commits when the repository is configured for them.

## Production Gates — explicit user approval required

Stop and present the exact proposed action, target, risk, rollback, and verification before any of these:

- public production deployment, DNS change, firewall exposure, or production infrastructure mutation;
- use, creation, rotation, or transmission of live credentials or signing keys;
- sending email, SMS, push, or social posts to real recipients;
- charging, refunding, or connecting a real payment account;
- Apple App Store, TestFlight external, or Google Play submission/release;
- production database migration, destructive data repair, or bulk import of real personal data;
- editing or substituting waiver/release language, retention policy, privacy policy, or legal consent text;
- enabling an under-13 self-service account, direct minor messaging, advertising, tracking, or public minor profile;
- publishing AI-generated content;
- adding a paid vendor or a dependency that materially changes data custody or recurring cost.

## Definition of milestone complete

A milestone is complete only when:

- every listed acceptance criterion passes;
- automated tests cover success, denial, failure, retry, and audit behavior appropriate to the feature;
- changed user flows are usable on supported screen sizes and keyboard accessible on web;
- authorization and tenant-isolation tests pass;
- migrations and seed data work from a clean database;
- documentation and status are current;
- no known severity-high security defect or data-loss path remains;
- the feature has a reproducible demo path.

