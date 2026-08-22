#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const repoRoot = resolve(import.meta.dirname, '../..');
const defaultEnvPath = resolve(repoRoot, '.env');
const composePath = resolve(repoRoot, 'infra/compose/compose.yaml');
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const help = `Usage: pnpm acceptance:outbox -- [options]

Runs a local-only, through-stack transactional-outbox rehearsal against the
already-running Compose stack. The created synthetic season, audit event, and
completed outbox event are retained as fixture history.

Options:
  --env-file <path>             Environment file (default: .env)
  --gateway-url <url>           Loopback gateway URL (default: GATEWAY_URL or GATEWAY_PORT)
  --organization-slug <slug>    Synthetic organization to use (default: featured or first)
  --league-slug <slug>          Synthetic league to use (default: featured or first)
  --timeout-seconds <seconds>   Completion timeout (default: 30)
  --recovery <mode>             none, worker-restart, or redis-restart (default: none)
  --help                        Show this help

The worker-restart mode stops the worker before the mutation and starts it
again before completion polling. The redis-restart mode commits the mutation
while Redis is stopped, then restarts Redis and proves database-backed recovery.
Neither mode clears persistent Redis data.
`;

export function parseEnvFile(text) {
  const values = {};
  for (const line of text.split(/\r?\n/u)) {
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/u.exec(line);
    if (match === null) continue;
    let value = match[2];
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

export function parseArguments(arguments_) {
  const options = {
    envPath: defaultEnvPath,
    gatewayUrl: undefined,
    help: false,
    leagueSlug: undefined,
    organizationSlug: undefined,
    recovery: 'none',
    timeoutSeconds: 30,
  };
  const valuedOptions = new Map([
    ['--env-file', 'envPath'],
    ['--gateway-url', 'gatewayUrl'],
    ['--organization-slug', 'organizationSlug'],
    ['--league-slug', 'leagueSlug'],
    ['--recovery', 'recovery'],
    ['--timeout-seconds', 'timeoutSeconds'],
  ]);

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--') continue;
    if (argument === '--help') {
      options.help = true;
      continue;
    }
    const equals = argument.indexOf('=');
    const name = equals === -1 ? argument : argument.slice(0, equals);
    const property = valuedOptions.get(name);
    if (property === undefined) throw new Error(`Unknown option: ${argument}`);
    const value = equals === -1 ? arguments_[index + 1] : argument.slice(equals + 1);
    if (value === undefined || value.length === 0 || (equals === -1 && value.startsWith('--'))) {
      throw new Error(`${name} requires a value.`);
    }
    if (equals === -1) index += 1;
    if (property === 'timeoutSeconds') {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 300) {
        throw new Error('--timeout-seconds must be an integer between 1 and 300.');
      }
      options.timeoutSeconds = parsed;
    } else if (property === 'envPath') {
      options.envPath = resolve(process.cwd(), value);
    } else {
      options[property] = value;
    }
  }
  if (!['none', 'redis-restart', 'worker-restart'].includes(options.recovery)) {
    throw new Error('--recovery must be none, worker-restart, or redis-restart.');
  }
  return options;
}

export function requireLoopbackGateway(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('The gateway URL is invalid.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('The gateway URL must use HTTP or HTTPS.');
  }
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    throw new Error('The rehearsal refuses to send synthetic credentials to a non-loopback host.');
  }
  url.pathname = url.pathname.replace(/\/$/u, '');
  url.search = '';
  url.hash = '';
  return url;
}

function assertRecord(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`);
  }
}

function assertExactKeys(value, expected, label) {
  assertRecord(value, label);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  const unexpected = actual.filter((key) => !wanted.includes(key));
  const missing = wanted.filter((key) => !actual.includes(key));
  if (unexpected.length > 0 || missing.length > 0) {
    const detail = [
      unexpected.length === 0 ? undefined : `unexpected keys: ${unexpected.join(', ')}`,
      missing.length === 0 ? undefined : `missing keys: ${missing.join(', ')}`,
    ]
      .filter(Boolean)
      .join('; ');
    throw new Error(`${label} is not metadata-only (${detail}).`);
  }
}

function assertCounter(value, label) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
}

function assertDuration(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative finite number.`);
  }
}

export function assertMetadataOnlyWorkerHealth(health) {
  assertExactKeys(
    health,
    ['dependencies', 'outbox', 'queue', 'service', 'status'],
    'Worker health',
  );
  assertExactKeys(health.dependencies, ['database', 'queue'], 'Worker health dependencies');
  assertExactKeys(
    health.outbox,
    ['failed', 'oldestDueSeconds', 'pending', 'processing'],
    'Worker health outbox',
  );
  assertExactKeys(health.queue, ['active', 'failed', 'waiting'], 'Worker health queue');
  if (health.service !== 'worker') throw new Error('Worker health has the wrong service marker.');
  if (health.status !== 'ok' && health.status !== 'degraded') {
    throw new Error('Worker health has an unsupported status.');
  }
  if (health.dependencies.database !== 'ready' || health.dependencies.queue !== 'ready') {
    throw new Error('Worker health dependencies are not ready.');
  }
  for (const field of ['failed', 'pending', 'processing']) {
    assertCounter(health.outbox[field], `Worker health outbox.${field}`);
  }
  if (health.outbox.oldestDueSeconds !== null) {
    assertDuration(health.outbox.oldestDueSeconds, 'Worker health outbox.oldestDueSeconds');
  }
  for (const field of ['active', 'failed', 'waiting']) {
    assertCounter(health.queue[field], `Worker health queue.${field}`);
  }
  return health;
}

const snapshotFields = [
  'auditCount',
  'outboxCount',
  'completedCount',
  'pendingCount',
  'processingCount',
  'failedCount',
  'idempotencyCount',
  'auditRequestCount',
  'outboxRequestCount',
];

export function parseDatabaseSnapshot(output) {
  const values = output.trim().split('|');
  if (values.length !== snapshotFields.length) {
    throw new Error('PostgreSQL returned an unexpected rehearsal snapshot shape.');
  }
  return Object.fromEntries(
    snapshotFields.map((field, index) => {
      const value = Number(values[index]);
      if (!Number.isInteger(value) || value < 0) {
        throw new Error(`PostgreSQL returned an invalid ${field}.`);
      }
      return [field, value];
    }),
  );
}

function composeArguments(envPath, ...arguments_) {
  return ['compose', '--env-file', envPath, '-f', composePath, ...arguments_];
}

function runDocker(envPath, arguments_, options = {}) {
  const result = spawnSync('docker', composeArguments(envPath, ...arguments_), {
    cwd: repoRoot,
    encoding: 'utf8',
    input: options.input,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error !== undefined) {
    throw new Error(`Docker Compose could not run: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const detail = result.stderr.trim().split(/\r?\n/u).at(-1);
    throw new Error(`Docker Compose failed${detail ? `: ${detail}` : '.'}`);
  }
  return result.stdout;
}

function requireRunningServices(envPath) {
  const output = runDocker(envPath, ['ps', '--services', '--status', 'running']);
  const running = new Set(output.trim().split(/\r?\n/u).filter(Boolean));
  const required = ['api', 'gateway', 'postgres', 'redis', 'worker'];
  const missing = required.filter((service) => !running.has(service));
  if (missing.length > 0) {
    throw new Error(
      `The Compose stack is not ready; missing running services: ${missing.join(', ')}. Run pnpm stack:up first.`,
    );
  }
}

async function requestJson(url, init, expectedStatuses) {
  let response;
  try {
    response = await fetch(url, {
      ...init,
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error(`The gateway request failed for ${init.method ?? 'GET'} ${url.pathname}.`);
  }
  const text = await response.text();
  let body;
  try {
    body = text.length === 0 ? {} : JSON.parse(text);
  } catch {
    throw new Error(`The gateway returned non-JSON for ${init.method ?? 'GET'} ${url.pathname}.`);
  }
  if (!expectedStatuses.includes(response.status)) {
    const code = typeof body?.code === 'string' ? ` (${body.code})` : '';
    throw new Error(
      `The gateway returned HTTP ${response.status}${code} for ${init.method ?? 'GET'} ${url.pathname}.`,
    );
  }
  return { body, response };
}

function cookieHeader(response) {
  const setCookies =
    typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [response.headers.get('set-cookie')].filter(Boolean);
  const cookies = setCookies
    .map((value) => value.split(';', 1)[0])
    .filter((value) => value.includes('='));
  if (cookies.length === 0)
    throw new Error('Synthetic sign-in did not establish a session cookie.');
  return cookies.join('; ');
}

async function authenticate(gateway, password) {
  const trustedOrigin = new URL(gateway);
  trustedOrigin.hostname = 'localhost';
  const { response } = await requestJson(
    new URL('/api/auth/sign-in/email', gateway),
    {
      body: JSON.stringify({ email: 'admin@demo.invalid', password }),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Origin: trustedOrigin.origin,
      },
      method: 'POST',
    },
    [200],
  );
  return cookieHeader(response);
}

async function selectTenant(gateway, cookie, organizationSlug, leagueSlug) {
  const { body } = await requestJson(
    new URL('/api/v1/me/organizations', gateway),
    { headers: { Accept: 'application/json', Cookie: cookie, 'X-Client-Source': 'API' } },
    [200],
  );
  if (!Array.isArray(body?.items))
    throw new Error('The organization response has an invalid shape.');
  const organization = organizationSlug
    ? body.items.find((item) => item?.slug === organizationSlug)
    : body.items.find((item) => Array.isArray(item?.leagues) && item.leagues.length > 0);
  if (organization === undefined || !uuidPattern.test(organization.organizationId)) {
    throw new Error(
      'The requested synthetic organization is unavailable to the demo administrator.',
    );
  }
  if (!Array.isArray(organization.leagues)) throw new Error('The organization has no league list.');
  const league = leagueSlug
    ? organization.leagues.find((item) => item?.slug === leagueSlug)
    : organization.leagues[0];
  if (league === undefined || !uuidPattern.test(league.leagueId)) {
    throw new Error('The requested synthetic league is unavailable to the demo administrator.');
  }
  if (typeof organization.timezone !== 'string' || organization.timezone.length === 0) {
    throw new Error('The synthetic organization has no timezone.');
  }
  return {
    leagueId: league.leagueId,
    organizationId: organization.organizationId,
    timezone: organization.timezone,
  };
}

function readWorkerHealth(envPath) {
  const expression = [
    "const response = await fetch('http://127.0.0.1:3002/healthz');",
    'if (!response.ok) process.exit(2);',
    'process.stdout.write(await response.text());',
  ].join('');
  const output = runDocker(envPath, [
    'exec',
    '-T',
    'worker',
    'node',
    '--input-type=module',
    '--eval',
    expression,
  ]);
  let health;
  try {
    health = JSON.parse(output);
  } catch {
    throw new Error('Worker health returned invalid JSON.');
  }
  return assertMetadataOnlyWorkerHealth(health);
}

const snapshotSql = String.raw`
SELECT
  (SELECT COUNT(*) FROM audit_event
    WHERE organization_id = :'organization_id'::uuid
      AND action = 'season.created' AND target_type = 'Season' AND target_id = :'season_id'),
  (SELECT COUNT(*) FROM outbox_event
    WHERE organization_id = :'organization_id'::uuid
      AND event_type = 'season.created' AND aggregate_type = 'Season' AND aggregate_id = :'season_id'),
  (SELECT COUNT(*) FROM outbox_event
    WHERE organization_id = :'organization_id'::uuid
      AND event_type = 'season.created' AND aggregate_type = 'Season' AND aggregate_id = :'season_id'
      AND status = 'COMPLETED'),
  (SELECT COUNT(*) FROM outbox_event
    WHERE organization_id = :'organization_id'::uuid
      AND event_type = 'season.created' AND aggregate_type = 'Season' AND aggregate_id = :'season_id'
      AND status = 'PENDING'),
  (SELECT COUNT(*) FROM outbox_event
    WHERE organization_id = :'organization_id'::uuid
      AND event_type = 'season.created' AND aggregate_type = 'Season' AND aggregate_id = :'season_id'
      AND status = 'PROCESSING'),
  (SELECT COUNT(*) FROM outbox_event
    WHERE organization_id = :'organization_id'::uuid
      AND event_type = 'season.created' AND aggregate_type = 'Season' AND aggregate_id = :'season_id'
      AND status = 'FAILED'),
  (SELECT COUNT(*) FROM idempotency_record
    WHERE organization_id = :'organization_id'::uuid AND key = :'idempotency_key'),
  (SELECT COUNT(*) FROM audit_event
    WHERE organization_id = :'organization_id'::uuid
      AND action = 'season.created' AND target_type = 'Season' AND target_id = :'season_id'
      AND request_id = :'request_id'),
  (SELECT COUNT(*) FROM outbox_event
    WHERE organization_id = :'organization_id'::uuid
      AND event_type = 'season.created' AND aggregate_type = 'Season' AND aggregate_id = :'season_id'
      AND request_id = :'request_id');
`;

function readDatabaseSnapshot(envPath, environment, marker) {
  const databaseUser = environment.POSTGRES_USER ?? 'league_migrator';
  const databaseName = environment.POSTGRES_DB ?? 'league_app';
  const output = runDocker(
    envPath,
    [
      'exec',
      '-T',
      'postgres',
      'psql',
      '--username',
      databaseUser,
      '--dbname',
      databaseName,
      '--set',
      'ON_ERROR_STOP=1',
      '--set',
      `organization_id=${marker.organizationId}`,
      '--set',
      `season_id=${marker.seasonId}`,
      '--set',
      `idempotency_key=${marker.idempotencyKey}`,
      '--set',
      `request_id=${marker.requestId}`,
      '--tuples-only',
      '--no-align',
      '--field-separator',
      '|',
    ],
    { input: snapshotSql },
  );
  return parseDatabaseSnapshot(output);
}

function assertSingleTransaction(snapshot) {
  const fields = [
    'auditCount',
    'outboxCount',
    'idempotencyCount',
    'auditRequestCount',
    'outboxRequestCount',
  ];
  for (const field of fields) {
    if (snapshot[field] !== 1) {
      throw new Error(`Expected exactly one matching ${field}, received ${snapshot[field]}.`);
    }
  }
  const statusCount =
    snapshot.completedCount +
    snapshot.pendingCount +
    snapshot.processingCount +
    snapshot.failedCount;
  if (statusCount !== 1 || snapshot.outboxCount !== statusCount) {
    throw new Error('The matching outbox event has an invalid or duplicate status distribution.');
  }
  if (snapshot.failedCount !== 0) throw new Error('The matching outbox event reached FAILED.');
}

async function pollForCompletion(envPath, environment, marker, timeoutSeconds) {
  const deadline = Date.now() + timeoutSeconds * 1_000;
  let latest;
  do {
    latest = readDatabaseSnapshot(envPath, environment, marker);
    assertSingleTransaction(latest);
    if (latest.completedCount === 1) return latest;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  } while (Date.now() < deadline);
  throw new Error(
    `The outbox event did not complete within ${timeoutSeconds}s (pending=${latest.pendingCount}, processing=${latest.processingCount}).`,
  );
}

async function waitForWorker(envPath, timeoutSeconds) {
  const deadline = Date.now() + timeoutSeconds * 1_000;
  let lastError;
  do {
    try {
      return readWorkerHealth(envPath);
    } catch (error) {
      lastError = error;
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
    }
  } while (Date.now() < deadline);
  throw new Error(`The worker did not become healthy: ${lastError?.message ?? 'unknown error'}`);
}

function assertHealthyWorker(health) {
  if (health.status !== 'ok' || health.outbox.failed !== 0 || health.queue.failed !== 0) {
    throw new Error(
      'Worker health is degraded; inspect worker logs before accepting the rehearsal.',
    );
  }
}

async function run() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(help);
    return;
  }

  let fileEnvironment;
  try {
    fileEnvironment = parseEnvFile(readFileSync(options.envPath, 'utf8'));
  } catch (error) {
    throw new Error(`Could not read the local environment file: ${error.message}`);
  }
  const environment = { ...fileEnvironment, ...process.env };
  const password = environment.DEMO_ADMIN_PASSWORD;
  if (typeof password !== 'string' || password.length < 12) {
    throw new Error(
      'DEMO_ADMIN_PASSWORD is missing or invalid; run pnpm env:init and seed the stack.',
    );
  }
  const gateway = requireLoopbackGateway(
    options.gatewayUrl ??
      environment.GATEWAY_URL ??
      `http://127.0.0.1:${environment.GATEWAY_PORT ?? '8080'}`,
  );
  const organizationSlug =
    options.organizationSlug ?? environment.FEATURED_PUBLIC_ORGANIZATION_SLUG;
  const leagueSlug = options.leagueSlug ?? environment.FEATURED_PUBLIC_LEAGUE_SLUG;

  requireRunningServices(options.envPath);
  console.log('PASS running local Compose services are ready.');
  const gatewayHealth = await requestJson(new URL('/healthz', gateway), {}, [200]);
  if (gatewayHealth.body?.status !== 'ok') throw new Error('Gateway health did not report ok.');
  console.log('PASS loopback gateway is healthy.');

  const initialWorkerHealth = readWorkerHealth(options.envPath);
  assertHealthyWorker(initialWorkerHealth);
  console.log('PASS worker health is ready and exposes metadata-only fields.');

  const cookie = await authenticate(gateway, password);
  console.log('PASS synthetic administrator authenticated (credentials were not printed).');
  const tenant = await selectTenant(gateway, cookie, organizationSlug, leagueSlug);

  const runId = randomUUID();
  const suffix = `${Date.now()}-${runId.slice(0, 8)}`;
  const payload = {
    endDate: '2099-01-02',
    leagueId: tenant.leagueId,
    name: `Outbox rehearsal ${suffix}`,
    slug: `outbox-rehearsal-${suffix}`,
    startDate: '2099-01-01',
    timezone: tenant.timezone,
  };
  const idempotencyKey = `outbox-rehearsal-${runId}`;
  const requestId = `outbox-rehearsal-${runId}`;
  let redisStopped = false;
  let workerStopped = false;

  try {
    if (options.recovery === 'worker-restart') {
      runDocker(options.envPath, ['stop', 'worker']);
      workerStopped = true;
      console.log('PASS worker stopped for the explicit restart-recovery phase.');
    } else if (options.recovery === 'redis-restart') {
      runDocker(options.envPath, ['stop', 'redis']);
      redisStopped = true;
      console.log('PASS Redis stopped for the explicit restart-recovery phase.');
    }

    const mutationHeaders = {
      Accept: 'application/json',
      Cookie: cookie,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
      'X-Client-Source': 'API',
      'X-Request-Id': requestId,
    };
    const mutationUrl = new URL(`/api/v1/organizations/${tenant.organizationId}/seasons`, gateway);
    const first = await requestJson(
      mutationUrl,
      { body: JSON.stringify(payload), headers: mutationHeaders, method: 'POST' },
      [201],
    );
    const seasonId = first.body?.seasonId;
    if (!uuidPattern.test(seasonId ?? '') || first.body?.organizationId !== tenant.organizationId) {
      throw new Error('The season mutation returned an invalid response.');
    }
    const marker = { idempotencyKey, organizationId: tenant.organizationId, requestId, seasonId };
    const committed = readDatabaseSnapshot(options.envPath, environment, marker);
    assertSingleTransaction(committed);
    console.log(
      'PASS one atomic season, idempotency, audit, and outbox transaction was committed.',
    );

    if (redisStopped) {
      runDocker(options.envPath, ['start', 'redis']);
      redisStopped = false;
      const recoveredHealth = await waitForWorker(options.envPath, options.timeoutSeconds);
      assertHealthyWorker(recoveredHealth);
      console.log('PASS Redis restarted and the worker recovered database-backed outbox work.');
    }

    if (workerStopped) {
      runDocker(options.envPath, ['start', 'worker']);
      workerStopped = false;
      const recoveredHealth = await waitForWorker(options.envPath, options.timeoutSeconds);
      assertHealthyWorker(recoveredHealth);
      console.log('PASS worker restarted and recovered its database-backed outbox work.');
    }

    await pollForCompletion(options.envPath, environment, marker, options.timeoutSeconds);
    console.log('PASS PostgreSQL proves exactly one matching audit/outbox row reached COMPLETED.');

    const replay = await requestJson(
      mutationUrl,
      {
        body: JSON.stringify(payload),
        headers: { ...mutationHeaders, 'X-Request-Id': `${requestId}-replay` },
        method: 'POST',
      },
      [201],
    );
    if (JSON.stringify(replay.body) !== JSON.stringify(first.body)) {
      throw new Error('The idempotent replay did not return the original response.');
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
    const replayed = readDatabaseSnapshot(options.envPath, environment, marker);
    assertSingleTransaction(replayed);
    if (replayed.completedCount !== 1) {
      throw new Error('The replay changed the completed outbox state.');
    }
    console.log(
      'PASS replay returned the original response without duplicate audit or outbox rows.',
    );

    const finalWorkerHealth = readWorkerHealth(options.envPath);
    assertHealthyWorker(finalWorkerHealth);
    console.log('PASS final worker health remains ready and metadata-only.');
    console.log(
      `FIXTURE retained synthetic season ${payload.slug} (${seasonId}) as auditable history.`,
    );
    console.log('INFO This command did not clear persistent Redis data.');
  } finally {
    if (redisStopped) {
      runDocker(options.envPath, ['start', 'redis']);
      console.log('INFO Redis was restarted after an interrupted recovery rehearsal.');
    }
    if (workerStopped) {
      runDocker(options.envPath, ['start', 'worker']);
      console.log('INFO worker was restarted after an interrupted recovery rehearsal.');
    }
  }
}

const entrypoint = process.argv[1];
if (entrypoint !== undefined && import.meta.url === pathToFileURL(resolve(entrypoint)).href) {
  try {
    await run();
  } catch (error) {
    console.error(`FAIL ${error instanceof Error ? error.message : 'Unknown rehearsal failure.'}`);
    process.exitCode = 1;
  }
}
