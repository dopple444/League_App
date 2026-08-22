import assert from 'node:assert/strict';
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const scriptUrl = new URL('./security-containers.sh', import.meta.url);
const validatorUrl = new URL('./check-container-exception.mjs', import.meta.url);
const composeUrl = new URL('../../infra/compose/compose.yaml', import.meta.url);
const postgresDockerfileUrl = new URL('../../infra/docker/postgres.Dockerfile', import.meta.url);
const exceptionRecordUrl = new URL('../../docs/assurance/SECURITY_EXCEPTIONS.md', import.meta.url);

test('keeps every hosted-beta-eligible runtime image in the blocking scan', async () => {
  const script = await readFile(scriptUrl, 'utf8');

  assert.match(
    script,
    /blocking_services=\(gateway web api worker scheduler postgres redis migrate\)/u,
  );
  assert.match(script, /scan_image "\$\{image_id\}" 1/u);
  assert.doesNotMatch(script, /ignore-unfixed[^\n]*--exit-code 0/u);
});

test('limits the expiring development exception to MinIO and Mailpit', async () => {
  const [script, record] = await Promise.all([
    readFile(scriptUrl, 'utf8'),
    readFile(exceptionRecordUrl, 'utf8'),
  ]);

  assert.match(script, /development_exception_services=\(minio minio-init mailpit\)/u);
  assert.match(script, /development_exception_id="SEC-EXC-002"/u);
  assert.match(script, /development_exception_expiry="2026-09-15"/u);
  assert.match(script, /check-container-exception\.mjs/u);
  assert.match(script, /approved_development_exception_images/u);
  assert.match(record, /SEC-EXC-002/u);
  assert.match(record, /2026-09-15/u);
});

test('pins refreshed support images and removes the unused Postgres privilege helper', async () => {
  const [compose, postgresDockerfile] = await Promise.all([
    readFile(composeUrl, 'utf8'),
    readFile(postgresDockerfileUrl, 'utf8'),
  ]);

  assert.match(compose, /nginx-unprivileged:1\.30\.4-alpine@sha256:44e363/u);
  assert.match(compose, /redis:8\.4\.6-alpine3\.22@sha256:12da49/u);
  assert.match(compose, /mailpit:v1\.30\.7@sha256:d5ecbb/u);
  assert.match(compose, /image: league-app\/postgres:local/u);
  assert.match(postgresDockerfile, /postgres:18\.6-bookworm@sha256:7d2695/u);
  assert.match(postgresDockerfile, /rm -f \/usr\/local\/bin\/gosu/u);
  assert.match(postgresDockerfile, /USER postgres/u);
});

const blockingServices = [
  'gateway',
  'web',
  'api',
  'worker',
  'scheduler',
  'postgres',
  'redis',
  'migrate',
];
const approvedExceptionImages = {
  minio:
    'minio/minio:RELEASE.2025-09-07T16-13-09Z@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e',
  'minio-init':
    'minio/mc:RELEASE.2025-08-13T08-35-41Z@sha256:a7fe349ef4bd8521fb8497f55c6042871b2ae640607cf99d9bede5e9bdf11727',
  mailpit:
    'axllent/mailpit:v1.30.7@sha256:d5ecbb067db3705fa953d79e1b7f81ef84038df67aba6c52825d8c02a1ea748a',
};
const exceptionServices = Object.keys(approvedExceptionImages);
const allServices = [...blockingServices, ...exceptionServices];

function policyRecord() {
  return `# Security exceptions

This unrelated date must not activate an exception: 2026-09-15.

## SEC-EXC-001 — Unrelated exception

- **Expiry:** 2099-01-01.

## SEC-EXC-002 — Development-only object storage and mail-capture images

- **Images and services:**
  \`${approvedExceptionImages.minio}\`
  (\`minio\`),
  \`${approvedExceptionImages['minio-init']}\`
  (\`minio-init\`), and
  \`${approvedExceptionImages.mailpit}\`
  (\`mailpit\`). No other image or service is included.
- **Reachability:** Development only.
- **Expiry:** 2026-09-15. The exception no longer applies on this UTC date.
`;
}

function makeImageId(index) {
  return `sha256:${index.toString(16).padStart(64, '0')}`;
}

function makeRows(options) {
  const rows = [];
  let nextImage = 1;
  let apiImage;
  for (const service of allServices) {
    let image = makeImageId(nextImage);
    let reference = `registry.invalid/league-${service}:current`;
    if (service === 'api') {
      apiImage = image;
    } else if (service === 'migrate') {
      image = apiImage;
      reference = 'registry.invalid/league-api:current';
    }
    if (approvedExceptionImages[service]) {
      reference = approvedExceptionImages[service];
    }
    if (service === options.mismatchedImageService) {
      reference = `registry.invalid/unapproved-${service}@sha256:${'f'.repeat(64)}`;
    }
    const expectedHash = `expected-${service}`;
    const actualHash = service === options.staleService ? `stale-${service}` : expectedHash;
    rows.push({
      actualHash,
      container: `container-${service}`,
      expectedHash,
      image,
      reference,
      service,
    });
    nextImage += 1;
  }
  return rows;
}

const dockerStub = `#!/usr/bin/env bash
set -euo pipefail
state_file="\${STUB_STATE_FILE:?}"
log_file="\${STUB_DOCKER_LOG:?}"

field_by_service() {
  local service="$1"
  local column="$2"
  awk -F '\t' -v service="$service" -v column="$column" '
    $1 == service { print $column; found = 1; exit }
    END { if (!found) exit 1 }
  ' "$state_file"
}

field_by_container() {
  local container="$1"
  awk -F '\t' -v container="$container" '
    $2 == container { print $3 "|" $4 "|" $5; found = 1; exit }
    END { if (!found) exit 1 }
  ' "$state_file"
}

command="$1"
shift
case "$command" in
  compose)
    service="\${!#}"
    if [[ " $* " == *" config --services "* ]]; then
      cut -f 1 "$state_file"
      if [[ -n "\${STUB_EXTRA_COMPOSE_SERVICE:-}" ]]; then
        printf '%s\n' "\${STUB_EXTRA_COMPOSE_SERVICE}"
      fi
    elif [[ " $* " == *" ps --all --quiet "* ]]; then
      if [[ "\${STUB_MISSING_SERVICE:-}" == "$service" ]]; then
        exit 0
      fi
      field_by_service "$service" 2
    elif [[ " $* " == *" config --hash "* ]]; then
      printf '%s %s\n' "$service" "$(field_by_service "$service" 6)"
    else
      echo "Unexpected compose invocation: $*" >&2
      exit 90
    fi
    ;;
  inspect)
    container="\${!#}"
    field_by_container "$container"
    ;;
  image)
    reference="\${!#}"
    if [[ "\${STUB_MISSING_IMAGE_REFERENCE:-}" == "$reference" ]]; then
      exit 1
    fi
    awk -F '\t' -v reference="$reference" '
      $4 == reference { print $3; found = 1; exit }
      END { if (!found) exit 1 }
    ' "$state_file"
    ;;
  run)
    scan_exit_code=''
    previous=''
    for argument in "$@"; do
      if [[ "$previous" == '--exit-code' ]]; then
        scan_exit_code="$argument"
      fi
      previous="$argument"
    done
    reference="\${!#}"
    printf 'scan|%s|%s\n' "$scan_exit_code" "$reference" >> "$log_file"
    if [[ "\${STUB_SCAN_FAILURE_REFERENCE:-}" == "$reference" ]]; then
      exit 70
    fi
    ;;
  *)
    echo "Unexpected docker invocation: $command $*" >&2
    exit 91
    ;;
esac
`;

async function runStubbedGate(options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'league-container-gate-'));
  const scriptsDirectory = join(root, 'tools', 'scripts');
  const fakeBin = join(root, 'fake-bin');
  const recordPath = join(root, 'docs', 'assurance', 'SECURITY_EXCEPTIONS.md');
  const statePath = join(root, 'state.tsv');
  const logPath = join(root, 'docker.log');

  try {
    await Promise.all([
      mkdir(scriptsDirectory, { recursive: true }),
      mkdir(join(root, 'infra', 'compose'), { recursive: true }),
      mkdir(join(root, 'docs', 'assurance'), { recursive: true }),
      mkdir(fakeBin, { recursive: true }),
    ]);
    await Promise.all([
      copyFile(scriptUrl, join(scriptsDirectory, 'security-containers.sh')),
      copyFile(validatorUrl, join(scriptsDirectory, 'check-container-exception.mjs')),
      writeFile(join(root, '.env'), 'TEST_ONLY=true\n'),
      writeFile(join(root, 'infra', 'compose', 'compose.yaml'), 'services: {}\n'),
      writeFile(logPath, ''),
    ]);
    if (!options.missingRecord) {
      await writeFile(recordPath, policyRecord());
    }

    const rows = makeRows(options);
    await writeFile(
      statePath,
      rows
        .map((row) =>
          [
            row.service,
            row.container,
            row.image,
            row.reference,
            row.actualHash,
            row.expectedHash,
          ].join('\t'),
        )
        .join('\n') + '\n',
    );

    const dateStub = '#!/usr/bin/env bash\nprintf \'%s\\n\' "${STUB_DATE:?}"\n';
    const statStub = "#!/usr/bin/env bash\nprintf '999\\n'\n";
    await Promise.all([
      writeFile(join(fakeBin, 'docker'), dockerStub),
      writeFile(join(fakeBin, 'date'), dateStub),
      writeFile(join(fakeBin, 'stat'), statStub),
    ]);
    await Promise.all([
      chmod(join(scriptsDirectory, 'security-containers.sh'), 0o755),
      chmod(join(fakeBin, 'docker'), 0o755),
      chmod(join(fakeBin, 'date'), 0o755),
      chmod(join(fakeBin, 'stat'), 0o755),
    ]);

    const rowFor = (service) => rows.find((row) => row.service === service);
    const result = spawnSync('bash', [join(scriptsDirectory, 'security-containers.sh')], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${fakeBin}:${process.env.PATH}`,
        STUB_DATE: options.date ?? '2026-08-21',
        STUB_DOCKER_LOG: logPath,
        STUB_EXTRA_COMPOSE_SERVICE: options.extraComposeService ?? '',
        STUB_MISSING_IMAGE_REFERENCE: options.missingImageService
          ? rowFor(options.missingImageService).reference
          : '',
        STUB_MISSING_SERVICE: options.missingService ?? '',
        STUB_SCAN_FAILURE_REFERENCE: options.scanFailureService
          ? rowFor(options.scanFailureService).image
          : '',
        STUB_STATE_FILE: statePath,
      },
      timeout: 10_000,
    });
    const log = await readFile(logPath, 'utf8');
    return { ...result, log, rows };
  } finally {
    await rm(root, { force: true, recursive: true });
  }
}

function scansFrom(result) {
  return result.log
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [, exitCode, image] = line.split('|');
      return { exitCode, image };
    });
}

test('uses report-only scans only while the exact exception is active', async () => {
  const result = await runStubbedGate();
  assert.equal(result.status, 0, result.stderr);

  const scans = scansFrom(result);
  const exceptionImageIds = new Set(
    result.rows.filter((row) => exceptionServices.includes(row.service)).map((row) => row.image),
  );
  assert.equal(scans.filter((scan) => scan.exitCode === '0').length, 3);
  assert.ok(
    scans
      .filter((scan) => scan.exitCode === '0')
      .every((scan) => exceptionImageIds.has(scan.image)),
  );
  assert.ok(scans.filter((scan) => scan.exitCode === '1').length > 0);
});

test('fails closed and scans exception images as blocking on the expiry date', async () => {
  const result = await runStubbedGate({ date: '2026-09-15' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /expired on 2026-09-15/u);
  assert.equal(scansFrom(result).filter((scan) => scan.exitCode === '0').length, 0);
});

test('fails closed when the structured exception record is missing', async () => {
  const result = await runStubbedGate({ missingRecord: true });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /exception validation failed/u);
  assert.equal(scansFrom(result).filter((scan) => scan.exitCode === '0').length, 0);
});

test('fails closed when an exception service uses an unapproved image', async () => {
  const result = await runStubbedGate({ mismatchedImageService: 'mailpit' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /not the exact image approved/u);
  assert.equal(scansFrom(result).filter((scan) => scan.exitCode === '0').length, 0);
});

test('rejects a missing service container before scanning anything', async () => {
  const result = await runStubbedGate({ missingService: 'worker' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /exactly one current Compose container for worker, found 0/u);
  assert.equal(scansFrom(result).length, 0);
});

test('rejects an unclassified Compose service before scanning anything', async () => {
  const result = await runStubbedGate({ extraComposeService: 'new-runtime' });
  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /Compose service new-runtime is not classified by the container security policy/u,
  );
  assert.equal(scansFrom(result).length, 0);
});

test('rejects stale Compose service configuration before scanning', async () => {
  const result = await runStubbedGate({ staleService: 'web' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /web is stale relative to the current Compose configuration/u);
  assert.equal(scansFrom(result).length, 0);
});

test('rejects a missing current service image before scanning', async () => {
  const result = await runStubbedGate({ missingImageService: 'postgres' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /configured image for postgres is unavailable locally/u);
  assert.equal(scansFrom(result).length, 0);
});

test('does not hide an operational failure from a report-only scan', async () => {
  const result = await runStubbedGate({ scanFailureService: 'minio' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /development-only image scan could not complete/u);
  const minioImage = result.rows.find((row) => row.service === 'minio').image;
  assert.ok(scansFrom(result).some((scan) => scan.exitCode === '0' && scan.image === minioImage));
});
