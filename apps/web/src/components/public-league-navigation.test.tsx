import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { browserApi } from '../lib/api-client';
import { PublicLeagueNavigation } from './public-league-navigation';

const { usePathnameMock } = vi.hoisted(() => ({ usePathnameMock: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: usePathnameMock }));

const desktopNavigation = (): HTMLElement => screen.getByRole('navigation', { name: 'Primary' });

beforeEach(() => {
  usePathnameMock.mockReset();
  vi.restoreAllMocks();
});

describe('PublicLeagueNavigation', () => {
  it('uses a safe generic Home and staff path outside league context', () => {
    usePathnameMock.mockReturnValue('/');
    render(<PublicLeagueNavigation />);

    const navigation = desktopNavigation();
    expect(within(navigation).getByRole('link', { name: /Home/u })).toHaveAttribute('href', '/');
    expect(within(navigation).getByRole('link', { name: /Home/u })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(navigation).queryByRole('link', { name: 'Schedule' })).not.toBeInTheDocument();
    expect(within(navigation).getByRole('link', { name: 'Staff sign in' })).toHaveAttribute(
      'href',
      '/sign-in',
    );
  });

  it('renders contextual destinations and a visible active marker on league home', async () => {
    usePathnameMock.mockReturnValue('/leagues/example-org/example-league');
    vi.spyOn(browserApi, 'getPublicLeague').mockResolvedValue({
      organization: { slug: 'example-org', name: 'Example Organization' },
      league: { slug: 'example-league', name: 'Example League' },
      currentSeason: {
        seasonId: '55e0ee1f-0233-4399-84b2-f62d78c293b1',
        slug: 'spring-2027',
        name: 'Spring 2027',
        startDate: '2027-03-01',
        endDate: '2027-06-01',
        timezone: 'America/New_York',
      },
    });
    render(<PublicLeagueNavigation />);

    const navigation = desktopNavigation();
    const home = within(navigation).getByRole('link', { name: /Home/u });
    expect(home).toHaveAttribute('href', '/leagues/example-org/example-league');
    expect(home).toHaveAttribute('aria-current', 'page');
    expect(home).toHaveTextContent('Current');
    await waitFor(() =>
      expect(within(navigation).getByRole('link', { name: 'Schedule' })).toHaveAttribute(
        'href',
        '/leagues/example-org/example-league/seasons/spring-2027/schedule',
      ),
    );
    expect(within(navigation).getByRole('link', { name: 'Teams' })).toHaveAttribute(
      'href',
      '/leagues/example-org/example-league/seasons/spring-2027/teams',
    );
  });

  it('derives a non-featured league and season from the current route', () => {
    usePathnameMock.mockReturnValue(
      '/leagues/another-org/community-ball/seasons/fall-2027/teams/team-one',
    );
    render(<PublicLeagueNavigation />);

    const navigation = desktopNavigation();
    expect(within(navigation).getByRole('link', { name: 'Schedule' })).toHaveAttribute(
      'href',
      '/leagues/another-org/community-ball/seasons/fall-2027/schedule',
    );
    expect(within(navigation).getByRole('link', { name: /Teams/u })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('closes the mobile disclosure after client-side navigation', async () => {
    let pathname = '/leagues/example-org/example-league/seasons/spring-2027/teams';
    usePathnameMock.mockImplementation(() => pathname);
    const { container, rerender } = render(<PublicLeagueNavigation />);
    const disclosure = container.querySelector('details.mobile-nav') as HTMLDetailsElement;
    disclosure.open = true;

    pathname = '/leagues/example-org/example-league/seasons/spring-2027/schedule';
    rerender(<PublicLeagueNavigation />);

    await waitFor(() => expect(disclosure).not.toHaveAttribute('open'));
  });

  it('resolves the current published season for a directly linked league home', async () => {
    usePathnameMock.mockReturnValue('/leagues/direct-org/direct-league');
    vi.spyOn(browserApi, 'getPublicLeague').mockResolvedValue({
      organization: { slug: 'direct-org', name: 'Direct Organization' },
      league: { slug: 'direct-league', name: 'Direct League' },
      currentSeason: {
        seasonId: 'bb5de64d-9a14-4d0d-8d73-b37870ba2e4f',
        slug: 'summer-2027',
        name: 'Summer 2027',
        startDate: '2027-05-01',
        endDate: '2027-08-01',
        timezone: 'America/New_York',
      },
    });

    render(<PublicLeagueNavigation />);

    await waitFor(() =>
      expect(within(desktopNavigation()).getByRole('link', { name: 'Schedule' })).toHaveAttribute(
        'href',
        '/leagues/direct-org/direct-league/seasons/summer-2027/schedule',
      ),
    );
    expect(browserApi.getPublicLeague).toHaveBeenCalledWith('direct-org', 'direct-league');
  });
});
