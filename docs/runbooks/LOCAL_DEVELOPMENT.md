# Local development runbook

## Bootstrap

Install the exact runtime pins from `.node-version`, `.python-version`, and `package.json`. The
repository's pnpm bootstrap stays inside the user's local binary directory and does not require
sudo. It tries Corepack first and falls back to an exact user-local npm install when the distro's
Corepack is incompatible:

```bash
bash tools/scripts/bootstrap-pnpm.sh
export PATH="$HOME/.local/bin:$PATH"
pnpm env:init
pnpm install --frozen-lockfile
pnpm scheduler:sync --frozen
```

`env:init` creates `.env` with mode `0600`, generates independent high-entropy local secrets, and
never prints them. Running it again preserves existing values and only adds newly introduced
derived settings. Python sync bootstraps hash-verified uv 0.12.5 under ignored `.tools/` and uses
uv's managed Python 3.14.7; it does not depend on a distro `python-venv` package.

Before the first local E2E/accessibility run, install the Playwright-managed Chromium build:

```bash
pnpm --filter @league/web exec playwright install chromium
```

This does not install operating-system libraries or invoke sudo. CI uses Playwright's explicit
`--with-deps` setup on an ephemeral GitHub runner.

## Services

```bash
pnpm env:check
pnpm compose:config
pnpm stack:up
pnpm stack:smoke
```

The gateway is available at `127.0.0.1:8080`. PostgreSQL (`54320`), Redis (`63790`), MinIO
(`9000`/`9001`), and Mailpit (`1025`/`8025`) are loopback-only diagnostics. API, web, worker, and
scheduler ports are private Compose ports. The data services, scheduler, worker, and Mailpit share
an internal network with no external route.

The API uses the `NOBYPASSRLS` runtime role. Prisma migrations use the separate migrator role.
Host-run tests use generated `HOST_*_DATABASE_URL` values for port 54320. The worker and scheduler
expose minimal private health endpoints; neither sends messages nor runs a schedule solve in
Milestones 0–1.

Stop safely without deleting volumes:

```bash
pnpm stack:down
```

Volume deletion, source-document import, real data, provider credentials, public deployment, and
external sends are not part of this runbook and remain explicit gates.

## Common failures

- `pnpm: command not found`: run the user-local bootstrap above and add the printed directory to
  `PATH`.
- Toolchain warnings: local patch deviations are warnings for exploratory checks; CI and images
  enforce exact pins. Use the repository `mise.toml` for parity.
- Missing `.env`: run `pnpm env:init`; do not use placeholder credentials from `.env.example`.
- Trace status `awaiting_authorized_sources`: authorized documents are absent from ignored
  `import/source-docs/`. Do not fabricate waiver text or hashes.
- Failed service: inspect metadata-safe logs with `docker compose --env-file .env -f
  infra/compose/compose.yaml logs <service>` and do not paste secrets or personal data.
