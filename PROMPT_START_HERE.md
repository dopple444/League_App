# First prompt to paste into Codex

Use Plan mode for this first prompt.

```text
You are the principal engineer and delivery lead for the canonical repository https://github.com/dopple444/League_App. Build the Softball League Platform described by the repository documents. Work in the current League_App checkout; do not create another repository, initialize a nested .git directory, or place the application inside an extra wrapper folder.

First inspect the current branch, origin URL, working tree, and existing files. Preserve unrelated user changes. The expected starting repository has only its initial README plus this planning package; if anything else exists, inspect and integrate it safely rather than overwriting it.

Before changing code, read these files completely in this order:
1. AGENTS.md
2. PLANS.md
3. IMPLEMENT.md
4. docs/PRODUCT_BLUEPRINT.md
5. docs/REQUIREMENTS.md
6. docs/ARCHITECTURE_AND_DATA.md
7. docs/SECURITY_LEGAL_OPERATIONS.md
8. docs/ROADMAP_ACCEPTANCE.md
9. docs/DECISIONS.md
10. docs/STATUS.md
11. import/README.md

Then inspect any files in import/source-docs. Treat the original waiver body text as immutable source material. Extract league rules and spreadsheet structures into traceable seed/import specifications; do not silently rewrite legal text or league rules.

Create or update an ExecPlan in execplans/ for Milestone 0 and Milestone 1. Resolve non-blocking ambiguity using the defaults in docs/DECISIONS.md and record the decision. Ask me only when a Production Gate in IMPLEMENT.md is reached or when two choices would create materially different products and no default exists.

Implement Milestone 0 and the smallest end-to-end vertical slice of Milestone 1. The slice must prove: organization/season isolation, authentication, role-based authorization, an admin-created team, a public read-only team/schedule view, audit logging, database migrations, automated tests, local Docker startup, and documented verification steps.

Work autonomously through planning, implementation, tests, review, and documentation. Keep scope aligned to the requirements. Do not deploy publicly, send messages, process real payments, use production credentials, submit apps, or change waiver wording. Run all relevant checks, fix failures, update docs/STATUS.md and the ExecPlan, and finish with a concise report of what works, commands run, test results, known limitations, and the next milestone.
```

## Short continuation prompt

Use this for later sessions after the first slice is accepted:

```text
Read AGENTS.md, IMPLEMENT.md, docs/STATUS.md, docs/ROADMAP_ACCEPTANCE.md, and the active ExecPlan. Complete the next incomplete milestone autonomously. Preserve all production gates, run and fix every required check, update the plan/status/decision docs, and stop only when the milestone acceptance criteria pass or a genuine blocking production decision is required.
```

## Release-candidate prompt

Use this only after the milestone build is complete:

```text
Prepare a release candidate without deploying it. Run the full quality, security, tenant-isolation, backup/restore, live-scoring/offline-failover, accessibility, and acceptance-test suites. Review the diff and operational documentation, fix defects in scope, produce a go/no-go checklist, and list every production gate that still requires my explicit approval.
```
