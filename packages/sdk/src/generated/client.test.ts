import { afterEach, describe, expect, it, vi } from 'vitest';

import { LeagueApiClient } from './client.js';

afterEach(() => vi.unstubAllGlobals());

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
});
