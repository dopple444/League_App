import { afterEach, describe, expect, it, vi } from 'vitest';

import { LeagueApiClient } from './client.js';

afterEach(() => vi.unstubAllGlobals());

function requiredFetchCall(
  call: [input: RequestInfo | URL, init?: RequestInit | undefined] | undefined,
): { url: string; init: RequestInit } {
  if (call === undefined || call[1] === undefined) throw new Error('Expected a fetch call.');
  return { url: call[0].toString(), init: call[1] };
}

describe('LeagueApiClient', () => {
  it('calls the default fetch with the required global receiver', async () => {
    const nativeLikeFetch = vi.fn(function (this: unknown) {
      if (this !== globalThis) throw new TypeError('Illegal invocation');
      return Promise.resolve(
        new Response(JSON.stringify({ items: [] }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }),
      );
    });
    vi.stubGlobal('fetch', nativeLikeFetch);

    const client = new LeagueApiClient({ baseUrl: 'https://league.example' });
    await expect(client.listMyOrganizations()).resolves.toEqual({ items: [] });
    expect(nativeLikeFetch.mock.contexts).toEqual([globalThis]);
  });

  it('returns independent post-MFA platform capabilities with the onboarding list', async () => {
    const response = {
      canProvisionTenants: true,
      canRevokeInvitations: false,
      items: [],
    };
    const fetcher = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(
        new Response(JSON.stringify(response), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }),
      ),
    );
    const client = new LeagueApiClient({ baseUrl: 'https://league.example', fetch: fetcher });

    await expect(client.listPlatformOnboarding()).resolves.toEqual(response);
    expect(requiredFetchCall(fetcher.mock.calls[0]).url).toBe(
      'https://league.example/api/v1/platform/onboarding',
    );
  });

  it('keeps invitation bearers in JSON bodies and out of URLs', async () => {
    const fetcher = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            organizationName: 'Meade County Demo',
            leagueName: 'Church Softball',
            administratorEmailHint: 'a***@e***.invalid',
            expiresAt: '2026-08-31T12:00:00.000Z',
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 200 },
        ),
      ),
    );
    const client = new LeagueApiClient({ baseUrl: 'https://league.example', fetch: fetcher });
    const invitationToken = 'opaque-invitation-bearer-value-1234567890';

    await client.inspectAdministratorInvitation({ invitationToken });

    const { url, init } = requiredFetchCall(fetcher.mock.calls[0]);
    expect(url).toBe('https://league.example/api/v1/onboarding/invitations/inspect');
    expect(url).not.toContain(invitationToken);
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ invitationToken });
    expect(new Headers(init.headers).has('Idempotency-Key')).toBe(false);

    await client.registerAdministratorInvitation({
      invitationToken,
      name: 'Demo Administrator',
      password: 'synthetic-password-only',
    });
    await client.acceptAdministratorInvitation(
      { invitationToken },
      { idempotencyKey: 'accept-invitation-once' },
    );

    for (const call of fetcher.mock.calls.slice(1)) {
      const { url: calledUrl, init: calledInit } = requiredFetchCall(call);
      expect(calledUrl).not.toContain(invitationToken);
      expect(JSON.parse(String(calledInit.body))).toMatchObject({ invitationToken });
    }
    expect(requiredFetchCall(fetcher.mock.calls[1]).url).toBe(
      'https://league.example/api/v1/onboarding/invitations/register',
    );
    const acceptCall = requiredFetchCall(fetcher.mock.calls[2]);
    expect(acceptCall.url).toBe(
      'https://league.example/api/v1/onboarding/invitations/accept',
    );
    expect(new Headers(acceptCall.init.headers).get('Idempotency-Key')).toBe(
      'accept-invitation-once',
    );
  });

  it('uses the platform workbench routes and caller-owned mutation keys', async () => {
    const fetcher = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(
        new Response(JSON.stringify({}), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }),
      ),
    );
    const client = new LeagueApiClient({ baseUrl: 'https://league.example', fetch: fetcher });

    await client.provisionPlatformOnboarding(
      {
        organizationName: 'Meade County Demo',
        organizationSlug: 'meade-county-demo',
        timezone: 'America/New_York',
        leagueName: 'Church Softball',
        leagueSlug: 'church-softball',
        administratorEmail: 'administrator@example.invalid',
        invitationExpiresInHours: 168,
        reason: 'Controlled synthetic beta onboarding',
      },
      { idempotencyKey: 'provision-customer-once' },
    );
    await client.revokePlatformInvitation(
      '00000000-0000-4000-8000-000000000701',
      { expectedVersion: 1, reason: 'Invitation withdrawn' },
      { idempotencyKey: 'revoke-invitation-once' },
    );

    const provisionCall = requiredFetchCall(fetcher.mock.calls[0]);
    expect(provisionCall.url).toBe('https://league.example/api/v1/platform/onboarding');
    expect(new Headers(provisionCall.init.headers).get('Idempotency-Key')).toBe(
      'provision-customer-once',
    );
    const revokeCall = requiredFetchCall(fetcher.mock.calls[1]);
    expect(revokeCall.url).toBe(
      'https://league.example/api/v1/platform/invitations/00000000-0000-4000-8000-000000000701/revoke',
    );
    expect(new Headers(revokeCall.init.headers).get('Idempotency-Key')).toBe(
      'revoke-invitation-once',
    );
  });

  it('sends recovery-safe activation with an empty body and no caller key', async () => {
    const fetcher = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(
        new Response(JSON.stringify({ items: [] }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }),
      ),
    );
    const client = new LeagueApiClient({ baseUrl: 'https://league.example', fetch: fetcher });

    await client.activatePendingMemberships();

    const { url, init } = requiredFetchCall(fetcher.mock.calls[0]);
    expect(url).toBe('https://league.example/api/v1/onboarding/activations');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({});
    expect(new Headers(init.headers).has('Idempotency-Key')).toBe(false);
  });
});
