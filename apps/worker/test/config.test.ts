import { describe, expect, it } from 'vitest';

import { loadWorkerConfig } from '../src/config.js';

describe('worker configuration', () => {
  it('parses a private Redis endpoint without retaining the URL', () => {
    const config = loadWorkerConfig({
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
  });

  it('rejects non-Redis URLs', () => {
    expect(() => loadWorkerConfig({ REDIS_URL: 'https://example.invalid' })).toThrow(/REDIS_URL/u);
  });
});
