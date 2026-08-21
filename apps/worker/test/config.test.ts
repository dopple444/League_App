import { describe, expect, it } from 'vitest';

import { loadWorkerConfig } from '../src/config.js';

describe('worker configuration', () => {
  it('parses a private Redis endpoint without retaining the URL', () => {
    const config = loadWorkerConfig({
      DATABASE_URL: 'postgresql://synthetic:synthetic@postgres:5432/league_test',
      NODE_ENV: 'test',
      REDIS_URL: 'redis://synthetic-user:synthetic-password@redis:6379/2',
      WORKER_PORT: '3002',
    });

    expect(config.redis).toEqual({
      db: 2,
      host: 'redis',
      password: 'synthetic-password',
      port: 6379,
      tls: false,
      username: 'synthetic-user',
    });
    expect(config).not.toHaveProperty('redisUrl');
    expect(config.outbox).toEqual({
      batchSize: 25,
      discoveryLimit: 100,
      leaseMs: 60_000,
      maxDispatchAttempts: 10,
      pollIntervalMs: 1_000,
    });
  });

  it('rejects non-Redis URLs', () => {
    expect(() =>
      loadWorkerConfig({
        DATABASE_URL: 'postgresql://synthetic:synthetic@postgres:5432/league_test',
        REDIS_URL: 'https://example.invalid',
      }),
    ).toThrow(/REDIS_URL/u);
  });

  it('requires PostgreSQL and a lease longer than two poll intervals', () => {
    expect(() => loadWorkerConfig({ REDIS_URL: 'redis://redis:6379/0' })).toThrow(/DATABASE_URL/u);
    expect(() =>
      loadWorkerConfig({
        DATABASE_URL: 'postgresql://synthetic:synthetic@postgres:5432/league_test',
        OUTBOX_LEASE_MS: '1000',
        OUTBOX_POLL_INTERVAL_MS: '600',
        REDIS_URL: 'redis://redis:6379/0',
      }),
    ).toThrow(/OUTBOX_LEASE_MS/u);
  });

  it('prefers the non-owner runtime database URL when both database URLs exist', () => {
    const config = loadWorkerConfig({
      DATABASE_URL: 'postgresql://migrator:synthetic@postgres:5432/league_test',
      REDIS_URL: 'redis://redis:6379/0',
      RUNTIME_DATABASE_URL: 'postgresql://runtime:synthetic@postgres:5432/league_test',
    });

    expect(config.databaseUrl).toContain('runtime:synthetic');
    expect(config.databaseUrl).not.toContain('migrator:synthetic');
  });
});
