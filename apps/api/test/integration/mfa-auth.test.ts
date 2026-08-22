import { createHmac, randomUUID } from 'node:crypto';

import { createLeagueAuth } from '@league/auth';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { databaseTestsEnabled, testDatabase } from '../helpers/database.js';

const authOrigin = 'http://localhost:3001';

const requestAuth = (
  auth: ReturnType<typeof createLeagueAuth>,
  path: string,
  body: unknown,
  cookie?: string,
): Promise<Response> =>
  auth.handler(
    new Request(`${authOrigin}/api/auth${path}`, {
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        Origin: authOrigin,
        ...(cookie === undefined ? {} : { Cookie: cookie }),
      },
      method: 'POST',
    }),
  );

const responseCookies = (response: Response): string => {
  const values = (
    response.headers as Headers & {
      getSetCookie?: () => string[];
    }
  ).getSetCookie?.() ?? [response.headers.get('set-cookie') ?? ''];
  return values
    .filter(Boolean)
    .map((value) => value.split(';', 1)[0])
    .join('; ');
};

const decodeBase32 = (encoded: string): Buffer => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const character of encoded.replaceAll('=', '').toUpperCase()) {
    const value = alphabet.indexOf(character);
    if (value < 0) throw new Error('Unexpected Base32 character in generated TOTP secret.');
    bits += value.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }
  return Buffer.from(bytes);
};

const currentTotp = (secret: string): string => {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1_000 / 30)));
  const digest = createHmac('sha1', decodeBase32(secret)).update(counter).digest();
  const offset = (digest.at(-1) ?? 0) & 0x0f;
  const binary = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return binary.toString().padStart(6, '0');
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe.skipIf(!databaseTestsEnabled)('Better Auth privileged MFA lifecycle', () => {
  it('enrolls TOTP, challenges the next sign-in, and accepts one recovery code', async () => {
    const { prisma } = testDatabase();
    const unique = randomUUID();
    const email = `mfa-${unique}@example.invalid`;
    const password = `Synthetic-${unique}-Password`;
    const auth = createLeagueAuth({
      prisma,
      secret: 'integration-only-better-auth-secret-000000000000',
      baseURL: authOrigin,
      trustedOrigins: [authOrigin],
      allowSignUp: true,
    });

    try {
      const signUp = await requestAuth(auth, '/sign-up/email', {
        email,
        name: 'MFA Integration Administrator',
        password,
      });
      expect(signUp.status).toBe(200);
      const enrollmentCookie = responseCookies(signUp);
      expect(enrollmentCookie).toContain('session_token');

      const parallelSignIn = await requestAuth(auth, '/sign-in/email', { email, password });
      expect(parallelSignIn.status).toBe(200);
      const preEnrollmentCookie = responseCookies(parallelSignIn);
      expect(preEnrollmentCookie).toContain('session_token');

      const enable = await requestAuth(auth, '/two-factor/enable', { password }, enrollmentCookie);
      expect(enable.status).toBe(200);
      const enrollment = (await enable.json()) as {
        totpURI: string;
        backupCodes: string[];
      };
      expect(enrollment.backupCodes.length).toBeGreaterThan(0);
      const secret = new URL(enrollment.totpURI).searchParams.get('secret');
      expect(secret).toBeTruthy();

      const verifyEnrollment = await requestAuth(
        auth,
        '/two-factor/verify-totp',
        { code: currentTotp(secret ?? ''), trustDevice: false },
        enrollmentCookie,
      );
      expect(verifyEnrollment.status).toBe(200);
      const verifiedEnrollmentCookie = responseCookies(verifyEnrollment);
      expect(verifiedEnrollmentCookie).toContain('session_token');

      const identity = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(identity.twoFactorEnabled).toBe(true);
      expect(await prisma.session.count({ where: { userId: identity.id } })).toBe(1);
      await expect(
        auth.api.getSession({ headers: new Headers({ Cookie: preEnrollmentCookie }) }),
      ).resolves.toBeNull();
      await expect(
        auth.api.getSession({ headers: new Headers({ Cookie: verifiedEnrollmentCookie }) }),
      ).resolves.toMatchObject({ user: { id: identity.id, twoFactorEnabled: true } });
      await prisma.session.deleteMany({ where: { userId: identity.id } });

      const signIn = await requestAuth(auth, '/sign-in/email', { email, password });
      expect(signIn.status).toBe(200);
      await expect(signIn.clone().json()).resolves.toMatchObject({
        twoFactorRedirect: true,
        twoFactorMethods: expect.arrayContaining(['totp']),
      });
      const challengeCookie = responseCookies(signIn);
      expect(challengeCookie).toContain('two_factor');

      const recovery = await requestAuth(
        auth,
        '/two-factor/verify-backup-code',
        { code: enrollment.backupCodes[0], trustDevice: false },
        challengeCookie,
      );
      expect(recovery.status).toBe(200);
      expect(responseCookies(recovery)).toContain('session_token');
    } finally {
      await prisma.user.deleteMany({ where: { email } });
      await prisma.$disconnect();
    }
  });
});
