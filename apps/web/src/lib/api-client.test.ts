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
});
