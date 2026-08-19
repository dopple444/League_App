import { createRequire } from 'node:module';

import IORedis from 'ioredis';
import { describe, expect, it } from 'vitest';

const runtimeRequire = createRequire(import.meta.url);

describe('worker runtime dependencies', () => {
  it('loads the explicit ioredis driver through ESM and BullMQ-compatible CommonJS resolution', () => {
    expect(IORedis).toBeTypeOf('function');
    expect(runtimeRequire.resolve('ioredis')).toContain('ioredis');

    const loaded = runtimeRequire('ioredis') as
      | typeof IORedis
      | { readonly default: typeof IORedis };
    const RedisConstructor = typeof loaded === 'function' ? loaded : loaded.default;
    const client = new RedisConstructor({ lazyConnect: true, maxRetriesPerRequest: null });

    expect(client.status).toBe('wait');
    client.disconnect();
  });
});
