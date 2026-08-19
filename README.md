# Softball League Platform

This repository contains the developing website and Android/iOS application for the Meade County Church Softball League, together with the durable project brief and execution framework needed to keep the core product ready for other leagues later.

## Local quick start

The repository pins Node 24.19.0, pnpm 11.22.0, and Python 3.14.7. If `pnpm` is not on `PATH`,
create a user-local shim without sudo (the script falls back to exact-version npm installation when
the host Corepack is too old):

```bash
bash tools/scripts/bootstrap-pnpm.sh
export PATH="$HOME/.local/bin:$PATH"
pnpm env:init
pnpm install --frozen-lockfile
pnpm scheduler:sync --frozen
pnpm toolchain:check
pnpm env:check
pnpm stack:up
pnpm stack:smoke
```

Open <http://127.0.0.1:8080>. Generated `.env` values and source documents under
`import/source-docs/` are ignored. Use only synthetic data until its Production Gate is approved,
and do not paste generated secrets into logs or issues. `pnpm stack:down` stops containers without
deleting local volumes. See `docs/runbooks/LOCAL_DEVELOPMENT.md` for the complete runbook.

## Development workflow

The canonical repository is [dopple444/League_App](https://github.com/dopple444/League_App). Do not create another repository or initialize a nested `.git` directory.

1. Clone or update the canonical repository, then open its root in VS Code.
2. Read `AGENTS.md`, `docs/STATUS.md`, the active dated plan under `execplans/`, and the UI style guide/register before changing a milestone or user-visible artifact.
3. Follow the local quick start above and the complete development runbook in `docs/runbooks/LOCAL_DEVELOPMENT.md`.
4. When authorized source documents become available, place them only in the ignored `import/source-docs/` directory and validate them against `import/expected-sources.json`.
5. Continue from the next action and open blockers recorded in `docs/STATUS.md` and the active ExecPlan.

Do not begin with app-store submission, paid messaging, live payments, or a public production deployment. Those are explicit production gates after the core system is tested.

## Package map

- `PROMPT_START_HERE.md` — the one kickoff prompt and the short continuation prompt.
- `AGENTS.md` — durable repository instructions Codex reads automatically.
- `PLANS.md` — rules for long-running execution plans.
- `IMPLEMENT.md` — autonomous implementation runbook.
- `docs/PRODUCT_BLUEPRINT.md` — product vision, workflows, features, and boundaries.
- `docs/REQUIREMENTS.md` — testable requirements with stable IDs.
- `docs/ARCHITECTURE_AND_DATA.md` — stack, deployment, APIs, live-first/offline-resilient scoring, scheduler, and data model.
- `docs/SECURITY_LEGAL_OPERATIONS.md` — security, waivers, minors, communications, payments, backups, and store obligations.
- `docs/ROADMAP_ACCEPTANCE.md` — milestone order and definition of done.
- `docs/DECISIONS.md` — defaults, assumptions, and architecture-decision log.
- `docs/LEAGUE_APP_UI_STYLE_GUIDE.md` — the normative visual language and specifications for pages, forms, screens, and generated artifacts.
- `docs/UI_ARTIFACT_REGISTER.md` — the living inventory and style-compliance review ledger for implemented UI artifacts.
- `docs/STATUS.md` — Codex's persistent handoff and progress record.
- `docs/RESEARCH_SOURCES.md` — current official and vendor references used for this design.

## Guiding principle

Build a modular monolith first: one repository, one primary API, one PostgreSQL database, and one worker process. Use a small Python scheduling service only because Google OR-Tools is the right tool for the constraint problem. Preserve clear module boundaries so services can be separated later only when real load or organizational needs justify it.
