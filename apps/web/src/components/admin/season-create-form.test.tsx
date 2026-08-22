import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { browserApi, type OrganizationSummary } from '../../lib/api-client';
import { SeasonCreateForm } from './season-create-form';

const { backMock, refreshMock, replaceMock } = vi.hoisted(() => ({
  backMock: vi.fn(),
  refreshMock: vi.fn(),
  replaceMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: backMock, refresh: refreshMock, replace: replaceMock }),
}));

const organizationId = '00000000-0000-4000-8000-000000000001';
const activeLeagueId = '00000000-0000-4000-8000-000000000101';
const inactiveLeagueId = '00000000-0000-4000-8000-000000000102';

const organization = (active: boolean): OrganizationSummary => ({
  organizationId,
  slug: 'meade-county-demo',
  name: 'Meade County Demo',
  timezone: 'America/New_York',
  permissions: ['season:create'],
  leagues: [
    {
      leagueId: activeLeagueId,
      slug: 'active-league',
      name: 'Active League',
      active,
    },
    {
      leagueId: inactiveLeagueId,
      slug: 'inactive-league',
      name: 'Inactive League',
      active: false,
    },
  ],
});

afterEach(() => {
  vi.restoreAllMocks();
  backMock.mockReset();
  refreshMock.mockReset();
  replaceMock.mockReset();
});

describe('SeasonCreateForm active league boundary', () => {
  it('offers only active leagues and submits the active selection', async () => {
    const user = userEvent.setup();
    vi.spyOn(browserApi, 'getOrganizations').mockResolvedValue([organization(true)]);
    const createSeason = vi.spyOn(browserApi, 'createSeason').mockResolvedValue({
      organizationId,
      seasonId: '00000000-0000-4000-8000-000000000201',
      leagueId: activeLeagueId,
      name: 'Fall 2026',
      slug: 'fall-2026',
      startDate: '2026-09-01',
      endDate: '2026-10-31',
      timezone: 'America/New_York',
      version: 1,
      published: false,
    });

    render(<SeasonCreateForm organizationId={organizationId} />);

    const leagueSelect = await screen.findByLabelText('League');
    await waitFor(() => expect(leagueSelect).toHaveValue(activeLeagueId));
    expect(within(leagueSelect).getByRole('option', { name: 'Active League' })).toBeInTheDocument();
    expect(
      within(leagueSelect).queryByRole('option', { name: 'Inactive League' }),
    ).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Season name'), 'Fall 2026');
    await user.type(screen.getByLabelText('Public URL name'), 'fall-2026');
    await user.type(screen.getByLabelText('Start date'), '2026-09-01');
    await user.type(screen.getByLabelText('End date'), '2026-10-31');
    await user.click(screen.getByRole('button', { name: 'Create draft season' }));

    await waitFor(() =>
      expect(createSeason).toHaveBeenCalledWith(organizationId, {
        leagueId: activeLeagueId,
        name: 'Fall 2026',
        slug: 'fall-2026',
        startDate: '2026-09-01',
        endDate: '2026-10-31',
        timezone: 'America/New_York',
      }),
    );
  });

  it('blocks season creation and links to league management when no league is active', async () => {
    vi.spyOn(browserApi, 'getOrganizations').mockResolvedValue([organization(false)]);
    const createSeason = vi.spyOn(browserApi, 'createSeason');

    render(<SeasonCreateForm organizationId={organizationId} />);

    const guidance = await screen.findByRole('status');
    expect(guidance).toHaveTextContent('No active leagues are available.');
    expect(within(guidance).getByRole('link', { name: 'Manage leagues' })).toHaveAttribute(
      'href',
      `/admin/${organizationId}/leagues`,
    );
    expect(screen.getByLabelText('League')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Create draft season' })).toBeDisabled();
    expect(createSeason).not.toHaveBeenCalled();
  });

  it('rejects an inactive league id even if the submitted form value is manipulated', async () => {
    vi.spyOn(browserApi, 'getOrganizations').mockResolvedValue([organization(true)]);
    const createSeason = vi.spyOn(browserApi, 'createSeason');

    render(<SeasonCreateForm organizationId={organizationId} />);

    const leagueSelect = await screen.findByLabelText('League');
    await waitFor(() => expect(leagueSelect).toHaveValue(activeLeagueId));
    const inactiveOption = document.createElement('option');
    inactiveOption.value = inactiveLeagueId;
    inactiveOption.textContent = 'Injected inactive league';
    leagueSelect.append(inactiveOption);
    inactiveOption.selected = true;
    fireEvent.change(screen.getByLabelText('Season name'), { target: { value: 'Fall 2026' } });
    fireEvent.change(screen.getByLabelText('Public URL name'), {
      target: { value: 'fall-2026' },
    });
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-10-31' } });
    fireEvent.submit(leagueSelect.closest('form') as HTMLFormElement);

    expect(leagueSelect).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getAllByText('Choose an active league.')).not.toHaveLength(0);
    expect(createSeason).not.toHaveBeenCalled();
  });
});
