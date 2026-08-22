import { describe, expect, it } from 'vitest';

import {
  createLeagueAuth,
  privilegedMfaRequired,
  SyntheticHeaderSessionResolver,
  validatedTrustedOrigins,
} from '../src/index.js';

describe('SyntheticHeaderSessionResolver', () => {
  it('is unavailable in production', () => {
    expect(() => new SyntheticHeaderSessionResolver('production')).toThrow(
      'Synthetic authentication cannot run in production.',
    );
  });

  it('resolves only an explicit synthetic user header', async () => {
    const resolver = new SyntheticHeaderSessionResolver('test');
    await expect(resolver.resolve(new Headers())).resolves.toBeNull();

    const headers = new Headers({
      'x-synthetic-user-id': '00000000-0000-4000-8000-000000000010',
    });
    await expect(resolver.resolve(headers)).resolves.toMatchObject({
      id: '00000000-0000-4000-8000-000000000010',
      twoFactorEnabled: true,
    });
  });
});

describe('validatedTrustedOrigins', () => {
  it('accepts the Expo app scheme alongside the web origin', () => {
    expect(validatedTrustedOrigins(['http://localhost:8080', 'league-companion://'])).toEqual([
      'http://localhost:8080',
      'league-companion://',
    ]);
  });
});

describe('createLeagueAuth', () => {
  it('generates UUID identifiers compatible with the PostgreSQL auth schema', () => {
    const auth = createLeagueAuth({
      baseURL: 'http://localhost:8080',
      prisma: {} as Parameters<typeof createLeagueAuth>[0]['prisma'],
      secret: 'synthetic-test-secret-at-least-32-characters',
      trustedOrigins: ['http://localhost:8080'],
    });

    expect(auth.options.advanced?.database?.generateId).toBe('uuid');
    expect(auth.options.session).toMatchObject({
      expiresIn: 28_800,
      freshAge: 900,
      updateAge: 3_600,
    });
    expect(auth.options.rateLimit).toMatchObject({ enabled: true, storage: 'memory' });
    expect(auth.options.plugins?.map((plugin) => plugin.id)).toContain('two-factor');
  });
});

describe('privilegedMfaRequired', () => {
  it('defaults closed in production and allows an explicit local override', () => {
    expect(privilegedMfaRequired('production', undefined)).toBe(true);
    expect(privilegedMfaRequired('development', undefined)).toBe(false);
    expect(privilegedMfaRequired('production', 'false')).toBe(false);
    expect(privilegedMfaRequired('development', 'true')).toBe(true);
  });

  it('rejects ambiguous configuration', () => {
    expect(() => privilegedMfaRequired('production', 'yes')).toThrow(
      'PRIVILEGED_MFA_REQUIRED must be true or false',
    );
  });
});
