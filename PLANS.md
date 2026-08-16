# Codex Execution Plans

An ExecPlan is a living implementation specification that another engineer can follow using only the repository and the plan. Create one under `execplans/YYYY-MM-DD-milestone-name.md` for each milestone or substantial change.

## Required behavior

- Read the applicable product, requirement, architecture, security, decision, and status documents before writing the plan.
- Describe the user-visible outcome, not merely code activity.
- Use repository-relative paths, concrete commands, and verifiable acceptance criteria.
- Keep the plan current while implementing. Record discoveries, decisions, test evidence, and remaining work at every stopping point.
- Proceed through non-blocking ambiguities using documented defaults. Do not ask the user to choose routine implementation details.
- Stop at Production Gates listed in `IMPLEMENT.md`.
- Keep milestones independently demonstrable and recoverable. Prefer vertical slices over large layers with no working UI.

## ExecPlan template

```md
# <Milestone or change name>

## Purpose and user outcome

## Scope

### Included

### Excluded

## Relevant requirements

List stable requirement IDs from docs/REQUIREMENTS.md.

## Current-state findings

## Proposed design

Include data changes, API/UI behavior, permissions, audit behavior, failure handling, and observability.

## Milestones

- [ ] Step with an observable result

## Verification and acceptance

List exact commands and manual checks. State expected results.

## Migration, rollback, and data compatibility

## Security and privacy review

## Decisions made

## Discoveries and risks

## Progress log

- YYYY-MM-DD HH:MM TZ — work completed, checks run, next action
```

