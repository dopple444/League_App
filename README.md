# Softball League Platform — Codex Starter Package

This package is the durable project brief and execution framework for building a website and Android/iOS app for the Meade County Church Softball League, while keeping the core product ready for other leagues later.

## Recommended way to use it

The canonical repository is [dopple444/League_App](https://github.com/dopple444/League_App). Do not create another repository or initialize a nested `.git` directory.

1. Clone `https://github.com/dopple444/League_App.git` onto the Ubuntu development server, or open the existing checkout.
2. Copy every file and folder from this package into the `League_App` repository root. The package README may replace the one-line initial README.
3. Put copies of the existing league source documents listed in `import/README.md` into `import/source-docs/`.
4. Open the repository root in VS Code with Codex.
5. Start Codex in Plan mode and paste the contents of `PROMPT_START_HERE.md`.
6. Review the initial plan and the first vertical-slice demo. After that, use the short continuation prompt in `PROMPT_START_HERE.md`.

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
- `docs/STATUS.md` — Codex's persistent handoff and progress record.
- `docs/RESEARCH_SOURCES.md` — current official and vendor references used for this design.

## Guiding principle

Build a modular monolith first: one repository, one primary API, one PostgreSQL database, and one worker process. Use a small Python scheduling service only because Google OR-Tools is the right tool for the constraint problem. Preserve clear module boundaries so services can be separated later only when real load or organizational needs justify it.
