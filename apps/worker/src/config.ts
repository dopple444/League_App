import { z } from 'zod';

const workerEnvironmentSchema = z
  .object({
    DATABASE_URL: z
      .url()
      .refine((value) => value.startsWith('postgresql://') || value.startsWith('postgres://'), {
        message: 'DATABASE_URL must use postgresql:// or postgres://',
      }),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    OUTBOX_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(25),
    OUTBOX_DISCOVERY_LIMIT: z.coerce.number().int().min(1).max(500).default(100),
    OUTBOX_LEASE_MS: z.coerce.number().int().min(1_000).max(900_000).default(60_000),
    OUTBOX_MAX_DISPATCH_ATTEMPTS: z.coerce.number().int().min(1).max(100).default(10),
    OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().min(100).max(60_000).default(1_000),
    REDIS_URL: z
      .url()
      .refine((value) => value.startsWith('redis://') || value.startsWith('rediss://'), {
        message: 'REDIS_URL must use redis:// or rediss://',
      }),
    WORKER_PORT: z.coerce.number().int().min(1).max(65_535).default(3002),
  })
  .strict();

export type WorkerConfig = Readonly<{
  databaseUrl: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  nodeEnvironment: 'development' | 'test' | 'production';
  outbox: Readonly<{
    batchSize: number;
    discoveryLimit: number;
    leaseMs: number;
    maxDispatchAttempts: number;
    pollIntervalMs: number;
  }>;
  port: number;
  redis: Readonly<{
    db: number;
    host: string;
    password?: string;
    port: number;
    tls: boolean;
    username?: string;
  }>;
}>;

export function loadWorkerConfig(environment: NodeJS.ProcessEnv): WorkerConfig {
  const parsed = workerEnvironmentSchema.parse({
    DATABASE_URL: environment.RUNTIME_DATABASE_URL ?? environment.DATABASE_URL,
    LOG_LEVEL: environment.LOG_LEVEL,
    NODE_ENV: environment.NODE_ENV,
    OUTBOX_BATCH_SIZE: environment.OUTBOX_BATCH_SIZE,
    OUTBOX_DISCOVERY_LIMIT: environment.OUTBOX_DISCOVERY_LIMIT,
    OUTBOX_LEASE_MS: environment.OUTBOX_LEASE_MS,
    OUTBOX_MAX_DISPATCH_ATTEMPTS: environment.OUTBOX_MAX_DISPATCH_ATTEMPTS,
    OUTBOX_POLL_INTERVAL_MS: environment.OUTBOX_POLL_INTERVAL_MS,
    REDIS_URL: environment.REDIS_URL,
    WORKER_PORT: environment.WORKER_PORT,
  });
  const redisUrl = new URL(parsed.REDIS_URL);
  const databasePath = redisUrl.pathname.replace(/^\//u, '');
  const database = databasePath.length === 0 ? 0 : Number.parseInt(databasePath, 10);
  if (!Number.isInteger(database) || database < 0) {
    throw new Error('REDIS_URL database path must be a non-negative integer.');
  }
  if (parsed.OUTBOX_LEASE_MS < parsed.OUTBOX_POLL_INTERVAL_MS * 2) {
    throw new Error('OUTBOX_LEASE_MS must be at least twice OUTBOX_POLL_INTERVAL_MS.');
  }

  return {
    databaseUrl: parsed.DATABASE_URL,
    logLevel: parsed.LOG_LEVEL,
    nodeEnvironment: parsed.NODE_ENV,
    outbox: {
      batchSize: parsed.OUTBOX_BATCH_SIZE,
      discoveryLimit: parsed.OUTBOX_DISCOVERY_LIMIT,
      leaseMs: parsed.OUTBOX_LEASE_MS,
      maxDispatchAttempts: parsed.OUTBOX_MAX_DISPATCH_ATTEMPTS,
      pollIntervalMs: parsed.OUTBOX_POLL_INTERVAL_MS,
    },
    port: parsed.WORKER_PORT,
    redis: {
      db: database,
      host: redisUrl.hostname,
      ...(redisUrl.password.length > 0 ? { password: redisUrl.password } : {}),
      port: redisUrl.port.length > 0 ? Number.parseInt(redisUrl.port, 10) : 6379,
      tls: redisUrl.protocol === 'rediss:',
      ...(redisUrl.username.length > 0 ? { username: redisUrl.username } : {}),
    },
  };
}
