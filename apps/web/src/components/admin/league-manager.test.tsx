import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, browserApi, type LeagueAdmin } from '../../lib/api-client';
import { LeagueManager } from './league-manager';

const organizationId = '89a6be95-5190-44bb-9cd0-b9bf089abcc9';
const leagueId = '47e315cb-aa01-42df-a0b0-f95a9f1d32da';

const league: LeagueAdmin = {
  organizationId,
  leagueId,
  name: 'Community Softball',
  slug: 'community-softball',
  active: true,
  version: 3,
  createdAt: '2026-08-21T11:00:00.000Z',
  updatedAt: '2026-08-21T12:30:00.000Z',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LeagueManager', () => {
  it('renders sorted league cards and restores the edit trigger after canceling', async () => {
    const user = userEvent.setup();
    vi.spyOn(browserApi, 'getLeagues').mockResolvedValue([
      league,
      {
        ...league,
        leagueId: '66e3ae38-142e-4b1c-8671-f6000788f4e7',
        name: 'Adult Kickball',
        slug: 'adult-kickball',
        active: false,
      },
    ]);

    render(<LeagueManager organizationId={organizationId} />);

    const region = await screen.findByRole('region', { name: 'League list' });
    expect(
      within(region)
        .getAllByRole('heading', { level: 2 })
        .map((heading) => heading.textContent),
    ).toEqual(['Adult Kickball', 'Community Softball']);
    expect(within(region).getByText('adult-kickball')).toBeInTheDocument();
    expect(within(region).getByText('inactive')).toBeInTheDocument();

    const edit = within(region).getByRole('button', { name: 'Edit Community Softball' });
    await user.click(edit);
    expect(screen.getByRole('region', { name: 'Edit Community Softball' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add League' })).toBeDisabled();
    expect(within(region).getByRole('button', { name: 'Edit Adult Kickball' })).toBeDisabled();
    await user.click(screen.getAllByRole('button', { name: 'Cancel' })[0] as HTMLElement);
    await waitFor(() => expect(edit).toHaveFocus());
  });

  it('validates, locks competing tasks, announces create success, and focuses the saved card', async () => {
    const user = userEvent.setup();
    vi.spyOn(browserApi, 'getLeagues').mockResolvedValue([]);
    const created: LeagueAdmin = {
      ...league,
      name: 'Youth Recreation',
      slug: 'youth-recreation',
      version: 1,
    };
    let resolveCreate: (value: LeagueAdmin) => void = () => undefined;
    const createLeague = vi.spyOn(browserApi, 'createLeague').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
    );

    render(<LeagueManager organizationId={organizationId} />);
    await screen.findByRole('heading', { name: 'Add your first league' });
    await user.click(screen.getByRole('button', { name: 'Add League' }));

    const panel = screen.getByRole('region', { name: 'Add league' });
    const name = within(panel).getByLabelText('League name (required)');
    const slug = within(panel).getByLabelText('Public URL name (required)');
    const active = within(panel).getByLabelText('Active');
    const submit = within(panel).getByRole('button', { name: 'Add league' });
    expect(name).toBeRequired();
    expect(slug).toBeRequired();
    await user.click(submit);
    expect(within(panel).getByRole('alert')).toHaveFocus();
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(slug).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveAttribute('maxlength', '160');
    expect(slug).toHaveAttribute('maxlength', '80');
    expect(active).toHaveAccessibleDescription(
      'Inactive leagues remain in history and should not receive new seasons.',
    );
    expect(within(panel).getByText('Active', { selector: 'label' })).toHaveAttribute(
      'for',
      'active',
    );
    expect(
      within(panel).getByText(/URL name is locked after league content is published/),
    ).toBeInTheDocument();

    await user.type(name, 'Youth Recreation');
    await user.type(slug, 'y');
    await user.click(submit);
    expect(within(panel).getByRole('alert')).toHaveTextContent('Use from 2 through 80 characters.');
    await user.clear(slug);
    await user.type(slug, 'Youth Recreation');
    expect(slug).toHaveAttribute('aria-invalid', 'true');
    await user.clear(slug);
    await user.type(slug, 'youth-recreation');
    await waitFor(() => expect(slug).not.toHaveAttribute('aria-invalid'));
    await user.click(submit);

    expect(within(panel).getByRole('button', { name: 'Adding…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add League' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add your first league' })).toBeDisabled();
    await user.click(within(panel).getByRole('button', { name: 'Adding…' }));
    expect(createLeague).toHaveBeenCalledTimes(1);
    expect(createLeague).toHaveBeenCalledWith(
      organizationId,
      {
        name: 'Youth Recreation',
        slug: 'youth-recreation',
        active: true,
      },
      expect.any(String),
    );

    await act(async () => {
      resolveCreate(created);
      await Promise.resolve();
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Youth Recreation was added.');
    await waitFor(() =>
      expect(screen.getByRole('article', { name: 'Youth Recreation' })).toHaveFocus(),
    );
  });

  it('reuses an idempotency key for an unchanged retry and rotates it for changed input', async () => {
    const user = userEvent.setup();
    vi.spyOn(browserApi, 'getLeagues').mockResolvedValue([]);
    const networkError = new ApiError(0, {
      code: 'NETWORK_UNAVAILABLE',
      message: 'The connection ended before the result was known.',
      requestId: 'synthetic-network-request',
    });
    const createLeague = vi
      .spyOn(browserApi, 'createLeague')
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(networkError)
      .mockResolvedValue({
        ...league,
        name: 'Retry League Updated',
        slug: 'retry-league',
        version: 1,
      });

    render(<LeagueManager organizationId={organizationId} />);
    await screen.findByRole('heading', { name: 'Add your first league' });
    await user.click(screen.getByRole('button', { name: 'Add League' }));
    const panel = screen.getByRole('region', { name: 'Add league' });
    const name = within(panel).getByLabelText('League name (required)');
    await user.type(name, 'Retry League');
    await user.type(within(panel).getByLabelText('Public URL name (required)'), 'retry-league');
    const submit = within(panel).getByRole('button', { name: 'Add league' });

    await user.click(submit);
    expect(await within(panel).findByRole('alert')).toHaveTextContent('result was known');
    const firstKey = createLeague.mock.calls[0]?.[2];
    expect(firstKey).toEqual(expect.any(String));

    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);
    await waitFor(() => expect(createLeague).toHaveBeenCalledTimes(2));
    expect(createLeague.mock.calls[1]?.[2]).toBe(firstKey);

    await waitFor(() => expect(submit).toBeEnabled());
    await user.type(name, ' Updated');
    await user.click(submit);
    expect(await screen.findByRole('status')).toHaveTextContent('Retry League Updated was added.');
    expect(createLeague.mock.calls[2]?.[2]).not.toBe(firstKey);
  });

  it('retains edited values until latest values are explicitly loaded and rotates the version key', async () => {
    const user = userEvent.setup();
    const latest: LeagueAdmin = {
      ...league,
      name: 'Latest Community Softball',
      slug: 'latest-community-softball',
      active: false,
      version: 4,
      updatedAt: '2026-08-21T13:30:00.000Z',
    };
    let resolveLatest: (value: readonly LeagueAdmin[]) => void = () => undefined;
    vi.spyOn(browserApi, 'getLeagues')
      .mockResolvedValueOnce([league])
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveLatest = resolve;
          }),
      );
    const updateLeague = vi
      .spyOn(browserApi, 'updateLeague')
      .mockRejectedValueOnce(
        new ApiError(409, {
          code: 'VERSION_CONFLICT',
          message: 'Version conflict.',
          requestId: 'synthetic-version-request',
        }),
      )
      .mockRejectedValueOnce(
        new ApiError(409, {
          code: 'DUPLICATE_LEAGUE_SLUG',
          message: 'Duplicate league slug.',
          requestId: 'synthetic-duplicate-request',
        }),
      );

    render(<LeagueManager organizationId={organizationId} />);
    const card = await screen.findByRole('article', { name: 'Community Softball' });
    await user.click(within(card).getByRole('button', { name: 'Edit Community Softball' }));
    const panel = screen.getByRole('region', { name: 'Edit Community Softball' });
    const name = within(panel).getByLabelText('League name (required)');
    const slug = within(panel).getByLabelText('Public URL name (required)');
    await user.clear(name);
    await user.type(name, 'Community Diamond League');
    await user.clear(slug);
    await user.type(slug, 'community-diamond');
    await user.click(within(panel).getByLabelText('Active'));
    await user.click(within(panel).getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(updateLeague).toHaveBeenCalledWith(
        organizationId,
        leagueId,
        {
          expectedVersion: league.version,
          name: 'Community Diamond League',
          slug: 'community-diamond',
          active: false,
        },
        expect.any(String),
      ),
    );
    expect(within(panel).getByRole('alert')).toHaveTextContent('changed elsewhere');
    expect(name).toHaveValue('Community Diamond League');
    expect(slug).toHaveValue('community-diamond');
    expect(within(panel).getByRole('button', { name: 'Save changes' })).toBeDisabled();

    const firstKey = updateLeague.mock.calls[0]?.[3];
    const loadLatest = within(panel).getByRole('button', { name: 'Load latest values' });
    await user.click(loadLatest);
    expect(within(panel).getByRole('button', { name: 'Loading latest…' })).toBeDisabled();
    for (const cancel of within(panel).getAllByRole('button', { name: 'Cancel' }))
      expect(cancel).toBeDisabled();

    await act(async () => {
      resolveLatest([latest]);
      await Promise.resolve();
    });
    expect(await within(panel).findByRole('status')).toHaveTextContent('Latest values loaded');
    expect(name).toHaveValue('Latest Community Softball');
    expect(slug).toHaveValue('latest-community-softball');
    expect(within(panel).getByLabelText('Active')).not.toBeChecked();

    await user.type(slug, '-next');
    await user.click(within(panel).getByRole('button', { name: 'Save changes' }));
    expect(await within(panel).findByRole('alert')).toHaveTextContent(
      'public URL name is already used',
    );
    expect(updateLeague).toHaveBeenLastCalledWith(
      organizationId,
      leagueId,
      {
        expectedVersion: latest.version,
        name: latest.name,
        slug: `${latest.slug}-next`,
        active: latest.active,
      },
      expect.any(String),
    );
    expect(updateLeague.mock.calls[1]?.[3]).not.toBe(firstKey);
    expect(name).toHaveValue(latest.name);
  });

  it('retains entries when loading latest values is forbidden or the league is missing', async () => {
    const user = userEvent.setup();
    vi.spyOn(browserApi, 'getLeagues')
      .mockResolvedValueOnce([league])
      .mockRejectedValueOnce(
        new ApiError(403, {
          code: 'AUTHORIZATION_DENIED',
          message: 'Forbidden.',
          requestId: 'synthetic-latest-permission-request',
        }),
      )
      .mockResolvedValueOnce([]);
    vi.spyOn(browserApi, 'updateLeague').mockRejectedValue(
      new ApiError(409, {
        code: 'VERSION_CONFLICT',
        message: 'Version conflict.',
        requestId: 'synthetic-version-request',
      }),
    );

    render(<LeagueManager organizationId={organizationId} />);
    const card = await screen.findByRole('article', { name: league.name });
    await user.click(within(card).getByRole('button', { name: `Edit ${league.name}` }));
    const panel = screen.getByRole('region', { name: `Edit ${league.name}` });
    const name = within(panel).getByLabelText('League name (required)');
    await user.clear(name);
    await user.type(name, 'Unsaved Customer Entry');
    await user.click(within(panel).getByRole('button', { name: 'Save changes' }));

    await user.click(await within(panel).findByRole('button', { name: 'Load latest values' }));
    await waitFor(() =>
      expect(within(panel).getByRole('alert')).toHaveTextContent('do not have permission'),
    );
    expect(name).toHaveValue('Unsaved Customer Entry');

    await user.click(within(panel).getByRole('button', { name: 'Load latest values' }));
    await waitFor(() =>
      expect(within(panel).getByRole('alert')).toHaveTextContent('no longer available'),
    );
    expect(name).toHaveValue('Unsaved Customer Entry');
  });

  it.each([
    [
      'PUBLISHED_LEAGUE_SLUG_LOCKED',
      'public URL name is locked because the league has published content',
    ],
    ['INACTIVE_LEAGUE', 'action requires an active league'],
  ])('explains the %s mutation error without clearing entries', async (code, message) => {
    const user = userEvent.setup();
    vi.spyOn(browserApi, 'getLeagues').mockResolvedValue([league]);
    vi.spyOn(browserApi, 'updateLeague').mockRejectedValue(
      new ApiError(409, {
        code,
        message: 'Synthetic domain error.',
        requestId: `synthetic-${code.toLowerCase()}`,
      }),
    );

    render(<LeagueManager organizationId={organizationId} />);
    const card = await screen.findByRole('article', { name: league.name });
    await user.click(within(card).getByRole('button', { name: `Edit ${league.name}` }));
    const panel = screen.getByRole('region', { name: `Edit ${league.name}` });
    const name = within(panel).getByLabelText('League name (required)');
    await user.clear(name);
    await user.type(name, 'Retained League Entry');
    await user.click(within(panel).getByRole('button', { name: 'Save changes' }));

    expect(await within(panel).findByRole('alert')).toHaveTextContent(message);
    expect(name).toHaveValue('Retained League Entry');
  });

  it('shows a permission-aware loading failure with a retry action', async () => {
    vi.spyOn(browserApi, 'getLeagues').mockRejectedValue(
      new ApiError(403, {
        code: 'AUTHORIZATION_DENIED',
        message: 'Forbidden.',
        requestId: 'synthetic-request',
      }),
    );

    render(<LeagueManager organizationId={organizationId} />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('do not have permission');
    expect(within(alert).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
