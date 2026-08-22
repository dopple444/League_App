import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { createAuthMiddleware } from 'better-auth/api';
import { twoFactor } from 'better-auth/plugins';

const SESSION_EXPIRES_SECONDS = 8 * 60 * 60;
const SESSION_REFRESH_SECONDS = 60 * 60;
const SESSION_FRESH_SECONDS = 15 * 60;

export interface LeagueAuthOptions {
  readonly prisma: Parameters<typeof prismaAdapter>[0];
  readonly secret: string;
  readonly baseURL: string;
  readonly trustedOrigins: readonly string[];
  readonly allowSignUp?: boolean;
}

export interface LeagueAuth {
  readonly handler: (request: Request) => Promise<Response>;
  readonly options: {
    readonly advanced?: {
      readonly database?: { readonly generateId?: string };
    };
    readonly session?: {
      readonly expiresIn?: number;
      readonly updateAge?: number;
      readonly freshAge?: number;
    };
    readonly rateLimit?: {
      readonly enabled?: boolean;
      readonly storage?: string;
    };
    readonly plugins?: readonly { readonly id: string }[];
  };
  readonly api: {
    readonly getSession: (input: { readonly headers: Headers }) => Promise<{
      readonly user: {
        readonly id: string;
        readonly name: string;
        readonly email: string;
        readonly twoFactorEnabled?: boolean | null;
      };
    } | null>;
    readonly signUpEmail: (input: {
      readonly body: {
        readonly email: string;
        readonly name: string;
        readonly password: string;
      };
    }) => Promise<unknown>;
  };
}

export function privilegedMfaRequired(
  environment: string | undefined,
  configured: string | undefined,
): boolean {
  if (configured === undefined || configured.trim().length === 0) {
    return environment === 'production';
  }
  if (configured === 'true') return true;
  if (configured === 'false') return false;
  throw new Error('PRIVILEGED_MFA_REQUIRED must be true or false when configured.');
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

export function createLeagueAuth(options: LeagueAuthOptions): LeagueAuth {
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
    session: {
      expiresIn: SESSION_EXPIRES_SECONDS,
      updateAge: SESSION_REFRESH_SECONDS,
      freshAge: SESSION_FRESH_SECONDS,
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      storage: 'memory',
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/two-factor/enable': { window: 300, max: 3 },
        '/two-factor/verify-totp': { window: 60, max: 5 },
        '/two-factor/verify-backup-code': { window: 60, max: 5 },
      },
    },
    hooks: {
      after: createAuthMiddleware(async (context) => {
        const replacement = context.context.newSession;
        if (
          context.path.endsWith('/two-factor/verify-totp') &&
          context.context.session !== null &&
          replacement?.user.twoFactorEnabled === true
        ) {
          // Enrollment changes the account's authentication requirements. Better Auth has now
          // created the verified replacement, so revoke every session carrying older assurance.
          const otherTokens = (
            await context.context.internalAdapter.listSessions(replacement.user.id)
          )
            .filter((session) => session.token !== replacement.session.token)
            .map((session) => session.token);
          if (otherTokens.length > 0) {
            await context.context.internalAdapter.deleteSessions(otherTokens);
          }
        }
      }),
    },
    plugins: [
      twoFactor({
        issuer: 'Softball League Platform',
        skipVerificationOnEnable: false,
        twoFactorCookieMaxAge: 10 * 60,
        trustDeviceMaxAge: 0,
        accountLockout: {
          enabled: true,
          maxFailedAttempts: 10,
          durationSeconds: 15 * 60,
        },
      }),
    ],
    telemetry: { enabled: false },
  }) as unknown as LeagueAuth;
}
