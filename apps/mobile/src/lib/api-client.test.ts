jest.mock('./auth-client', () => ({
  authClient: { getCookie: () => '' },
}));

import { MobileApiClient } from './api-client';

const jsonResponse = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  });

describe('MobileApiClient SDK adapter', () => {
  it('calls the default fetch with the required global receiver', async () => {
    const nativeLikeFetch = jest.spyOn(globalThis, 'fetch').mockImplementation(function (
      this: unknown,
    ) {
      if (this !== globalThis) throw new TypeError('Illegal invocation');
      return Promise.resolve(jsonResponse({ items: [] }));
    });
    const client = new MobileApiClient('https://league.example', () => '');

    await expect(client.getOrganizations()).resolves.toEqual([]);
    expect(nativeLikeFetch.mock.contexts).toEqual([globalThis]);

    nativeLikeFetch.mockRestore();
  });

  it('adds the securely stored auth cookie to organization reads', async () => {
    const fetcher = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return jsonResponse({ items: [] });
    });
    const client = new MobileApiClient(
      'https://league.example',
      () => 'better-auth.session_token=synthetic',
      fetcher as unknown as typeof fetch,
    );
    await expect(client.getOrganizations()).resolves.toEqual([]);
    const [, init] = fetcher.mock.calls[0] ?? [];
    expect(new Headers(init?.headers).get('Cookie')).toBe('better-auth.session_token=synthetic');
    expect(new Headers(init?.headers).get('X-Client-Source')).toBe('MOBILE');
  });

  it('uses the public schedule endpoint from the generated SDK', async () => {
    const home = {
      organization: { slug: 'demo', name: 'Demo League Organization' },
      league: { slug: 'softball', name: 'Softball League' },
      currentSeason: {
        seasonId: '019cc30d-7bc0-7782-a5e3-33fd0d95fa8a',
        slug: '2027',
        name: '2027 Season',
        startDate: '2027-04-01',
        endDate: '2027-08-01',
        timezone: 'America/New_York',
      },
    };
    const fetcher = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void init;
      return String(input).endsWith('/schedule')
        ? jsonResponse({ season: home.currentSeason, items: [] })
        : jsonResponse(home);
    });
    const client = new MobileApiClient(
      'https://league.example',
      () => '',
      fetcher as unknown as typeof fetch,
    );
    const result = await client.getPublicSchedule('demo', 'softball', '2027');
    expect(result.league.name).toBe('Softball League');
    expect(
      fetcher.mock.calls.some(([request]) => String(request).endsWith('/seasons/2027/schedule')),
    ).toBe(true);
  });
});
