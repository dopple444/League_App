import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';

export interface LeagueAuthOptions {
  readonly prisma: Parameters<typeof prismaAdapter>[0];
  readonly secret: string;
  readonly baseURL: string;
  readonly trustedOrigins: readonly string[];
  readonly allowSignUp?: boolean;
}

export function validatedTrustedOrigins(origins: readonly string[]): string[] {
  return origins.map((origin) => {
    const trimmed = origin.trim();
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
      throw new Error('Trusted origins must use an explicit URL scheme.');
    }
    void new URL(trimmed);
    return trimmed;
  });
}

export function createLeagueAuth(options: LeagueAuthOptions) {
  if (options.secret.length < 32) {
    throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters.');
  }

  return betterAuth({
    appName: 'Softball League Platform',
    basePath: '/api/auth',
    baseURL: options.baseURL,
    database: prismaAdapter(options.prisma, { provider: 'postgresql' }),
    advanced: {
      database: { generateId: 'uuid' },
    },
    secret: options.secret,
    trustedOrigins: validatedTrustedOrigins(options.trustedOrigins),
    emailAndPassword: {
      enabled: true,
      disableSignUp: !(options.allowSignUp ?? false),
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    telemetry: { enabled: false },
  });
}

export type LeagueAuth = ReturnType<typeof createLeagueAuth>;
