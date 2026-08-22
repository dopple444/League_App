import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertMetadataOnlyWorkerHealth,
  parseArguments,
  parseDatabaseSnapshot,
  parseEnvFile,
  requireLoopbackGateway,
} from './outbox-acceptance-rehearsal.mjs';

const healthy = {
  dependencies: { database: 'ready', queue: 'ready' },
  outbox: { failed: 0, oldestDueSeconds: null, pending: 0, processing: 0 },
  queue: { active: 0, failed: 0, waiting: 0 },
  service: 'worker',
  status: 'ok',
};

test('parses the bounded rehearsal command options', () => {
  assert.deepEqual(
    parseArguments([
      '--',
      '--gateway-url=http://localhost:8088',
      '--timeout-seconds',
      '45',
      '--recovery',
      'worker-restart',
    ]),
    {
      envPath: new URL('../../.env', import.meta.url).pathname,
      gatewayUrl: 'http://localhost:8088',
      help: false,
      leagueSlug: undefined,
      organizationSlug: undefined,
      recovery: 'worker-restart',
      timeoutSeconds: 45,
    },
  );
  assert.equal(parseArguments(['--recovery=redis-restart']).recovery, 'redis-restart');
  assert.throws(() => parseArguments(['--recovery=redis-loss']), /redis-restart/u);
  assert.throws(() => parseArguments(['--timeout-seconds=0']), /between 1 and 300/u);
});

test('loads local values without interpreting comments inside generated secrets', () => {
  assert.deepEqual(parseEnvFile('A=ignored\nDEMO_ADMIN_PASSWORD=synthetic#value\n# COMMENT=x\n'), {
    A: 'ignored',
    DEMO_ADMIN_PASSWORD: 'synthetic#value',
  });
});

test('refuses to send synthetic credentials beyond the loopback gateway', () => {
  assert.equal(requireLoopbackGateway('http://127.0.0.1:8080/').href, 'http://127.0.0.1:8080/');
  assert.throws(() => requireLoopbackGateway('https://league.example'), /non-loopback/u);
});

test('accepts only the metadata-only worker health contract', () => {
  assert.equal(assertMetadataOnlyWorkerHealth(healthy), healthy);
  assert.doesNotThrow(() =>
    assertMetadataOnlyWorkerHealth({
      ...healthy,
      outbox: { ...healthy.outbox, oldestDueSeconds: 0.125 },
    }),
  );
  assert.throws(
    () => assertMetadataOnlyWorkerHealth({ ...healthy, payload: { private: true } }),
    /metadata-only/u,
  );
  assert.throws(
    () =>
      assertMetadataOnlyWorkerHealth({
        ...healthy,
        outbox: { ...healthy.outbox, eventId: 'not-health-metadata' },
      }),
    /metadata-only/u,
  );
});

test('parses the exact PostgreSQL snapshot shape', () => {
  assert.deepEqual(parseDatabaseSnapshot('1|1|1|0|0|0|1|1|1\n'), {
    auditCount: 1,
    auditRequestCount: 1,
    completedCount: 1,
    failedCount: 0,
    idempotencyCount: 1,
    outboxCount: 1,
    outboxRequestCount: 1,
    pendingCount: 0,
    processingCount: 0,
  });
  assert.throws(() => parseDatabaseSnapshot('1|1|1'), /unexpected rehearsal snapshot/u);
});
