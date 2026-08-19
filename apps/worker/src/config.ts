import { z } from 'zod';

const workerEnvironmentSchema = z
  .object({
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    REDIS_URL: z
      .url()
      .refine((value) => value.startsWith('redis://') || value.startsWith('rediss://'), {
        message: 'REDIS_URL must use redis:// or rediss://',
      }),
    WORKER_PORT: z.coerce.number().int().min(1).max(65_535).default(3002),
  })
  .strict();

export type WorkerConfig = Readonly<{
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  nodeEnvironment: 'development' | 'test' | 'production';
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
    LOG_LEVEL: environment.LOG_LEVEL,
    NODE_ENV: environment.NODE_ENV,
    REDIS_URL: environment.REDIS_URL,
    WORKER_PORT: environment.WORKER_PORT,
  });
  const redisUrl = new URL(parsed.REDIS_URL);
  const databasePath = redisUrl.pathname.replace(/^\//u, '');
  const database = databasePath.length === 0 ? 0 : Number.parseInt(databasePath, 10);
  if (!Number.isInteger(database) || database < 0) {
    throw new Error('REDIS_URL database path must be a non-negative integer.');
  }

  return {
    logLevel: parsed.LOG_LEVEL,
    nodeEnvironment: parsed.NODE_ENV,
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
