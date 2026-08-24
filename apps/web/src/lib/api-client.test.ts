import { afterEach, describe, expect, it, vi } from 'vitest';

import { LeagueApiClient, resolveBrowserApiBaseUrl } from './api-client';

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' }, status });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('LeagueApiClient SDK adapter', () => {
  it('uses the page origin when the public API base is intentionally empty', () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '');

    expect(resolveBrowserApiBaseUrl()).toBe(window.location.origin);
  });

  it('calls the default browser fetch with the required global receiver', async () => {
    const nativeLikeFetch = vi.fn(function (
      this: unknown,
      input: RequestInfo | URL,
      init?: RequestInit,
    ) {
      void input;
      void init;
      if (this !== globalThis) throw new TypeError('Illegal invocation');
      return Promise.resolve(jsonResponse({ user: { id: 'demo-admin' } }));
    });
    vi.stubGlobal('fetch', nativeLikeFetch);

    const client = new LeagueApiClient('https://league.example');
    await expect(client.signIn('admin@demo.invalid', 'not-a-real-secret')).resolves.toEqual({
      user: { id: 'demo-admin' },
    });
    expect(nativeLikeFetch.mock.contexts).toEqual([globalThis]);
    const [, init] = nativeLikeFetch.mock.calls[0] ?? [];
    expect(new Headers(init?.headers).get('X-Client-Source')).toBe('WEB');
  });

  it('uses Better Auth factor endpoints without placing secrets in URLs', async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const path = new URL(String(input)).pathname;
      return jsonResponse(
        path.endsWith('/enable')
          ? { totpURI: 'otpauth://totp/example?secret=hidden', backupCodes: ['hidden-code'] }
          : { status: true },
      );
    });
    const client = new LeagueApiClient('https://league.example', fetcher);

    await client.enableMfa('not-a-real-secret');
    await client.verifyTotp('123456');
    await client.verifyBackupCode('recovery-code');

    expect(fetcher.mock.calls.map(([request]) => new URL(String(request)).pathname)).toEqual([
      '/api/auth/two-factor/enable',
      '/api/auth/two-factor/verify-totp',
      '/api/auth/two-factor/verify-backup-code',
    ]);
    for (const [request, init] of fetcher.mock.calls) {
      expect(String(request)).not.toContain('not-a-real-secret');
      expect(String(request)).not.toContain('123456');
      expect(String(request)).not.toContain('recovery-code');
      expect(init?.method).toBe('POST');
    }
  });

  it('reads the authenticated MFA policy through the generated SDK', async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      jsonResponse({
        mfaEnabled: false,
        mfaRequired: true,
        pendingActivation: true,
        platformAccess: false,
      }),
    );
    const client = new LeagueApiClient('https://league.example', fetcher);

    await expect(client.getSecurityPosture()).resolves.toEqual({
      mfaEnabled: false,
      mfaRequired: true,
      pendingActivation: true,
      platformAccess: false,
    });
    expect(String(fetcher.mock.calls[0]?.[0])).toContain('/api/v1/me/security');
  });

  it('preserves platform capability flags with the onboarding ledger', async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      jsonResponse({
        canProvisionTenants: false,
        canRevokeInvitations: true,
        items: [],
      }),
    );
    const client = new LeagueApiClient('https://league.example', fetcher);

    await expect(client.listPlatformOnboarding()).resolves.toEqual({
      canProvisionTenants: false,
      canRevokeInvitations: true,
      items: [],
    });
    expect(String(fetcher.mock.calls[0]?.[0])).toContain('/api/v1/platform/onboarding');
  });

  it('routes tenant reads through the generated SDK', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => jsonResponse({ items: [] }));
    const client = new LeagueApiClient('https://league.example', fetcher);
    await expect(client.getSeasons('3bc6ce3d-84cf-4031-a7a8-dbb8dfe48dd9')).resolves.toEqual([]);
    const [request] = fetcher.mock.calls[0] ?? [];
    expect(String(request)).toContain(
      '/api/v1/organizations/3bc6ce3d-84cf-4031-a7a8-dbb8dfe48dd9/seasons',
    );
  });

  it('sends an idempotency key for an authoritative create', async () => {
    const created = {
      organizationId: '89a6be95-5190-44bb-9cd0-b9bf089abcc9',
      seasonId: '66e3ae38-142e-4b1c-8671-f6000788f4e7',
      leagueId: '47e315cb-aa01-42df-a0b0-f95a9f1d32da',
      name: '2027 Season',
      slug: '2027-season',
      startDate: '2027-04-01',
      endDate: '2027-08-01',
      timezone: 'America/New_York',
      version: 1,
      published: false,
    };
    const fetcher = vi.fn<typeof fetch>(async () => jsonResponse(created));
    const client = new LeagueApiClient('https://league.example', fetcher);
    await client.createSeason(created.organizationId, {
      leagueId: created.leagueId,
      name: created.name,
      slug: created.slug,
      startDate: created.startDate,
      endDate: created.endDate,
      timezone: created.timezone,
    });
    const [, init] = fetcher.mock.calls[0] ?? [];
    expect(new Headers(init?.headers).get('Idempotency-Key')).toBeTruthy();
  });

  it('uses tenant-scoped league routes and idempotency for league writes', async () => {
    const organizationId = '89a6be95-5190-44bb-9cd0-b9bf089abcc9';
    const leagueId = '47e315cb-aa01-42df-a0b0-f95a9f1d32da';
    const league = {
      organizationId,
      leagueId,
      name: 'Community Softball',
      slug: 'community-softball',
      active: true,
      version: 2,
      createdAt: '2026-08-21T12:00:00.000Z',
      updatedAt: '2026-08-21T12:30:00.000Z',
    };
    const fetcher = vi.fn<typeof fetch>(async (input, init) =>
      init?.method === 'GET' || init?.method === undefined
        ? jsonResponse({ items: [league] })
        : jsonResponse(league, init.method === 'POST' ? 201 : 200),
    );
    const client = new LeagueApiClient('https://league.example', fetcher);

    await expect(client.getLeagues(organizationId)).resolves.toEqual([league]);
    await client.createLeague(
      organizationId,
      {
        name: league.name,
        slug: league.slug,
        active: league.active,
      },
      'caller-create-key',
    );
    await client.updateLeague(
      organizationId,
      leagueId,
      {
        expectedVersion: league.version,
        name: 'Community Softball Updated',
        slug: 'community-softball-updated',
        active: false,
      },
      'caller-update-key',
    );
    await client.createLeague(organizationId, {
      name: 'Default Key League',
      slug: 'default-key-league',
      active: true,
    });

    const [listRequest] = fetcher.mock.calls[0] ?? [];
    const [createRequest, createInit] = fetcher.mock.calls[1] ?? [];
    const [updateRequest, updateInit] = fetcher.mock.calls[2] ?? [];
    const [, defaultCreateInit] = fetcher.mock.calls[3] ?? [];
    const collectionPath = `/api/v1/organizations/${organizationId}/leagues`;
    expect(String(listRequest)).toContain(collectionPath);
    expect(String(createRequest)).toContain(collectionPath);
    expect(createInit?.method).toBe('POST');
    expect(new Headers(createInit?.headers).get('Idempotency-Key')).toBe('caller-create-key');
    expect(String(updateRequest)).toContain(`${collectionPath}/${leagueId}`);
    expect(updateInit?.method).toBe('PATCH');
    expect(new Headers(updateInit?.headers).get('Idempotency-Key')).toBe('caller-update-key');
    expect(new Headers(defaultCreateInit?.headers).get('Idempotency-Key')).toBeTruthy();
  });

  it('uses tenant-scoped facility routes and honors caller-provided idempotency keys', async () => {
    const createdField = {
      organizationId: '89a6be95-5190-44bb-9cd0-b9bf089abcc9',
      venueId: '47e315cb-aa01-42df-a0b0-f95a9f1d32da',
      fieldId: '66e3ae38-142e-4b1c-8671-f6000788f4e7',
      name: 'Field One',
      publicDirections: null,
      hasLights: false,
      fenceDistanceFeet: null,
      active: true,
      version: 1,
      createdAt: '2026-08-21T12:00:00.000Z',
      updatedAt: '2026-08-21T12:00:00.000Z',
    };
    const createdVenue = {
      organizationId: createdField.organizationId,
      venueId: createdField.venueId,
      name: 'Demo Parks Complex',
      active: true,
      version: 1,
      createdAt: createdField.createdAt,
      updatedAt: createdField.updatedAt,
      fields: [createdField],
    };
    const fetcher = vi.fn<typeof fetch>(async (input) =>
      jsonResponse(String(input).includes('/fields') ? createdField : createdVenue),
    );
    const client = new LeagueApiClient('https://league.example', fetcher);

    await client.createVenue(
      createdVenue.organizationId,
      { name: createdVenue.name, active: true },
      'caller-venue-create-key',
    );
    await client.updateVenue(
      createdVenue.organizationId,
      createdVenue.venueId,
      { expectedVersion: 1, name: 'Updated Parks Complex', active: true },
      'caller-venue-update-key',
    );
    await client.createField(
      createdField.organizationId,
      createdField.venueId,
      {
        name: createdField.name,
        publicDirections: null,
        hasLights: false,
        fenceDistanceFeet: null,
        active: true,
      },
      'caller-field-create-key',
    );
    await client.updateField(
      createdField.organizationId,
      createdField.venueId,
      createdField.fieldId,
      {
        expectedVersion: 1,
        name: 'Updated Field One',
        publicDirections: null,
        hasLights: true,
        fenceDistanceFeet: 300,
        active: true,
      },
      'caller-field-update-key',
    );
    await client.createField(createdField.organizationId, createdField.venueId, {
      name: 'Default Key Field',
      publicDirections: null,
      hasLights: false,
      fenceDistanceFeet: null,
      active: true,
    });

    const [venueCreateRequest, venueCreateInit] = fetcher.mock.calls[0] ?? [];
    const [venueUpdateRequest, venueUpdateInit] = fetcher.mock.calls[1] ?? [];
    const [fieldCreateRequest, fieldCreateInit] = fetcher.mock.calls[2] ?? [];
    const [fieldUpdateRequest, fieldUpdateInit] = fetcher.mock.calls[3] ?? [];
    const [, defaultKeyInit] = fetcher.mock.calls[4] ?? [];
    const venuePath = `/api/v1/organizations/${createdField.organizationId}/venues/${createdField.venueId}`;
    const fieldPath = `${venuePath}/fields`;
    expect(String(venueCreateRequest)).toContain(
      `/api/v1/organizations/${createdField.organizationId}/venues`,
    );
    expect(venueCreateInit?.method).toBe('POST');
    expect(new Headers(venueCreateInit?.headers).get('Idempotency-Key')).toBe(
      'caller-venue-create-key',
    );
    expect(String(venueUpdateRequest)).toContain(venuePath);
    expect(venueUpdateInit?.method).toBe('PATCH');
    expect(new Headers(venueUpdateInit?.headers).get('Idempotency-Key')).toBe(
      'caller-venue-update-key',
    );
    expect(String(fieldCreateRequest)).toContain(fieldPath);
    expect(fieldCreateInit?.method).toBe('POST');
    expect(new Headers(fieldCreateInit?.headers).get('Idempotency-Key')).toBe(
      'caller-field-create-key',
    );
    expect(String(fieldUpdateRequest)).toContain(`${fieldPath}/${createdField.fieldId}`);
    expect(fieldUpdateInit?.method).toBe('PATCH');
    expect(new Headers(fieldUpdateInit?.headers).get('Idempotency-Key')).toBe(
      'caller-field-update-key',
    );
    expect(new Headers(defaultKeyInit?.headers).get('Idempotency-Key')).toBeTruthy();
  });
});
