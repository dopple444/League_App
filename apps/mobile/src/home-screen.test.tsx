import { act, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import HomeScreen from '../app/(app)/home';
import {
  MobileApiError,
  mobileApi,
  type OrganizationSummary,
  type PublicLeague,
} from './lib/api-client';
import { useLeagueSession } from './providers/session-provider';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

jest.mock('./lib/api-client', () => ({
  MobileApiError: class MobileApiError extends Error {
    readonly status: number;
    readonly code: string;
    readonly requestId?: string;

    constructor(status: number, code: string, message: string, requestId?: string) {
      super(message);
      this.status = status;
      this.code = code;
      this.requestId = requestId;
    }
  },
  mobileApi: {
    getPublicLeague: jest.fn(),
    getPublicSchedule: jest.fn(),
    getPublicTeams: jest.fn(),
  },
}));

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
};

jest.mock('./providers/session-provider', () => ({
  useLeagueSession: jest.fn(),
}));

const organization = (leagues: OrganizationSummary['leagues']): OrganizationSummary => ({
  organizationId: '019cc30d-7bc0-7782-a5e3-33fd0d95fa8a',
  slug: 'demo-organization',
  name: 'Demo Organization',
  timezone: 'America/New_York',
  permissions: [],
  leagues,
});

const session = (
  selectedOrganization: OrganizationSummary,
): ReturnType<typeof useLeagueSession> => ({
  status: 'signed-in',
  userLabel: 'Demo User',
  organizations: [selectedOrganization],
  selectedOrganization,
  error: null,
  signIn: jest.fn(),
  signOut: jest.fn(),
  selectOrganization: jest.fn(),
  refreshOrganizations: jest.fn(),
});

describe('mobile league home selection', () => {
  const api = jest.mocked(mobileApi);
  const useSession = jest.mocked(useLeagueSession);

  beforeEach(() => {
    jest.clearAllMocks();
    api.getPublicLeague.mockResolvedValue({
      organization: { slug: 'demo-organization', name: 'Demo Organization' },
      league: { slug: 'alpha-active', name: 'Alpha Active League' },
      currentSeason: null,
    });
  });

  it('skips unpublished and inactive leagues to select a published active league', async () => {
    api.getPublicLeague.mockImplementation(async (_organizationSlug, leagueSlug) => {
      if (leagueSlug === 'alpha-unpublished') {
        throw new MobileApiError(404, 'NOT_FOUND', 'Not found');
      }
      return {
        organization: { slug: 'demo-organization', name: 'Demo Organization' },
        league: { slug: 'zulu-published', name: 'Zulu Published League' },
        currentSeason: null,
      };
    });
    useSession.mockReturnValue(
      session(
        organization([
          {
            leagueId: '019cc30d-7bc0-7782-a5e3-33fd0d95fa8b',
            slug: 'inactive-first',
            name: 'Inactive First League',
            active: false,
          },
          {
            leagueId: '019cc30d-7bc0-7782-a5e3-33fd0d95fa8c',
            slug: 'zulu-published',
            name: 'Zulu Published League',
            active: true,
          },
          {
            leagueId: '019cc30d-7bc0-7782-a5e3-33fd0d95fa8d',
            slug: 'alpha-unpublished',
            name: 'Alpha Unpublished League',
            active: true,
          },
        ]),
      ),
    );

    const view = await render(<HomeScreen />);

    await waitFor(() => {
      expect(view.getByRole('header', { name: 'Zulu Published League' })).toBeTruthy();
    });
    expect(api.getPublicLeague.mock.calls).toEqual([
      ['demo-organization', 'alpha-unpublished'],
      ['demo-organization', 'zulu-published'],
    ]);
  });

  it('shows an unavailable state and makes no public request when no league is active', async () => {
    useSession.mockReturnValue(
      session(
        organization([
          {
            leagueId: '019cc30d-7bc0-7782-a5e3-33fd0d95fa8b',
            slug: 'inactive-league',
            name: 'Inactive League',
            active: false,
          },
        ]),
      ),
    );

    const view = await render(<HomeScreen />);

    expect(view.getByRole('header', { name: 'League unavailable' })).toBeTruthy();
    expect(view.getByText('No active league available')).toBeTruthy();
    expect(api.getPublicLeague).not.toHaveBeenCalled();
  });

  it('shows a distinct unavailable state when every active league is unpublished', async () => {
    api.getPublicLeague.mockRejectedValue(new MobileApiError(404, 'NOT_FOUND', 'Not found'));
    useSession.mockReturnValue(
      session(
        organization([
          {
            leagueId: '019cc30d-7bc0-7782-a5e3-33fd0d95fa8c',
            slug: 'active-unpublished',
            name: 'Active Unpublished League',
            active: true,
          },
        ]),
      ),
    );

    const view = await render(<HomeScreen />);

    await waitFor(() => {
      expect(view.getByText('No published active league available')).toBeTruthy();
    });
    expect(view.queryByText('No published season')).toBeNull();
  });

  it('does not show an empty-season message when the initial request fails', async () => {
    api.getPublicLeague.mockRejectedValue(
      new MobileApiError(503, 'SERVICE_UNAVAILABLE', 'Unavailable'),
    );
    useSession.mockReturnValue(
      session(
        organization([
          {
            leagueId: '019cc30d-7bc0-7782-a5e3-33fd0d95fa8c',
            slug: 'active-league',
            name: 'Active League',
            active: true,
          },
        ]),
      ),
    );

    const view = await render(<HomeScreen />);

    await waitFor(() => {
      expect(
        view.getByText('We could not load league information. Please try again.'),
      ).toBeTruthy();
    });
    expect(view.queryByText('No published season')).toBeNull();
  });

  it('clears a rendered overview as soon as the organization context changes', async () => {
    const newLeague = deferred<PublicLeague>();
    const oldOrganization = organization([
      {
        leagueId: '019cc30d-7bc0-7782-a5e3-33fd0d95fa8c',
        slug: 'old-league',
        name: 'Old League',
        active: true,
      },
    ]);
    const newOrganization: OrganizationSummary = {
      ...organization([
        {
          leagueId: '019cc30d-7bc0-7782-a5e3-33fd0d95fa8d',
          slug: 'new-league',
          name: 'New League',
          active: true,
        },
      ]),
      organizationId: '019cc30d-7bc0-7782-a5e3-33fd0d95fa8e',
      slug: 'new-organization',
      name: 'New Organization',
    };
    let currentOrganization = oldOrganization;
    useSession.mockImplementation(() => session(currentOrganization));
    api.getPublicLeague.mockImplementation((organizationSlug) => {
      if (organizationSlug === 'new-organization') return newLeague.promise;
      return Promise.resolve({
        organization: { slug: 'demo-organization', name: 'Demo Organization' },
        league: { slug: 'old-league', name: 'Old Published League' },
        currentSeason: null,
      });
    });

    const view = await render(<HomeScreen />);
    await waitFor(() => {
      expect(view.getByRole('header', { name: 'Old Published League' })).toBeTruthy();
    });

    await act(async () => {
      currentOrganization = newOrganization;
      view.rerender(<HomeScreen />);
    });
    expect(view.queryByText('Old Published League')).toBeNull();
    expect(view.getByText('Loading published league information…')).toBeTruthy();

    await act(async () => {
      newLeague.resolve({
        organization: { slug: 'new-organization', name: 'New Organization' },
        league: { slug: 'new-league', name: 'New Published League' },
        currentSeason: null,
      });
      await newLeague.promise;
    });
    await waitFor(() => {
      expect(view.getByRole('header', { name: 'New Published League' })).toBeTruthy();
    });
  });

  it('ignores a stale completion after the selected organization changes', async () => {
    const oldLeague = deferred<PublicLeague>();
    const newLeague = deferred<PublicLeague>();
    const oldOrganization = organization([
      {
        leagueId: '019cc30d-7bc0-7782-a5e3-33fd0d95fa8c',
        slug: 'old-league',
        name: 'Old League',
        active: true,
      },
    ]);
    const newOrganization: OrganizationSummary = {
      ...organization([
        {
          leagueId: '019cc30d-7bc0-7782-a5e3-33fd0d95fa8d',
          slug: 'new-league',
          name: 'New League',
          active: true,
        },
      ]),
      organizationId: '019cc30d-7bc0-7782-a5e3-33fd0d95fa8e',
      slug: 'new-organization',
      name: 'New Organization',
    };
    let currentOrganization = oldOrganization;
    useSession.mockImplementation(() => session(currentOrganization));
    api.getPublicLeague.mockImplementation((organizationSlug) =>
      organizationSlug === 'demo-organization' ? oldLeague.promise : newLeague.promise,
    );

    const view = await render(<HomeScreen />);
    await waitFor(() => {
      expect(api.getPublicLeague).toHaveBeenCalledWith('demo-organization', 'old-league');
    });

    await act(async () => {
      currentOrganization = newOrganization;
      view.rerender(<HomeScreen />);
    });
    await waitFor(() => {
      expect(api.getPublicLeague).toHaveBeenCalledWith('new-organization', 'new-league');
    });

    await act(async () => {
      newLeague.resolve({
        organization: { slug: 'new-organization', name: 'New Organization' },
        league: { slug: 'new-league', name: 'New Published League' },
        currentSeason: null,
      });
      await newLeague.promise;
    });
    await waitFor(() => {
      expect(view.getByRole('header', { name: 'New Published League' })).toBeTruthy();
    });

    await act(async () => {
      oldLeague.resolve({
        organization: { slug: 'demo-organization', name: 'Demo Organization' },
        league: { slug: 'old-league', name: 'Old Published League' },
        currentSeason: null,
      });
      await oldLeague.promise;
    });
    expect(view.queryByText('Old Published League')).toBeNull();
    expect(view.getByRole('header', { name: 'New Published League' })).toBeTruthy();
  });
});
