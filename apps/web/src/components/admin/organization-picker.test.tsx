import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { browserApi } from '../../lib/api-client';
import { OrganizationPicker } from './organization-picker';

const replace = vi.fn();
const refresh = vi.fn();
const router = { replace, refresh };

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}));

afterEach(() => {
  vi.restoreAllMocks();
  replace.mockReset();
  refresh.mockReset();
});

describe('OrganizationPicker', () => {
  it('recovers pending memberships before showing an active customer workspace', async () => {
    const activation = vi
      .spyOn(browserApi, 'activatePendingMemberships')
      .mockResolvedValue({ items: [] });
    vi.spyOn(browserApi, 'getSecurityPosture')
      .mockResolvedValueOnce({
        mfaEnabled: true,
        mfaRequired: true,
        pendingActivation: true,
        platformAccess: false,
      })
      .mockResolvedValueOnce({
        mfaEnabled: true,
        mfaRequired: true,
        pendingActivation: false,
        platformAccess: false,
      });
    vi.spyOn(browserApi, 'getOrganizations').mockResolvedValue([
      {
        leagues: [],
        name: 'Community Recreation',
        organizationId: '6ecab6e5-acaa-485e-9d89-eb7a930e7ee8',
        permissions: ['league:manage'],
        slug: 'community-recreation',
        timezone: 'America/New_York',
      },
    ]);

    render(<OrganizationPicker />);

    expect(await screen.findByRole('heading', { name: 'Community Recreation' })).toBeVisible();
    expect(activation).toHaveBeenCalledOnce();
    expect(screen.getByRole('link', { name: 'Open administration' })).toHaveAttribute(
      'href',
      '/admin/6ecab6e5-acaa-485e-9d89-eb7a930e7ee8',
    );
  });

  it('gives non-enumerating controlled-beta guidance when no access is active', async () => {
    vi.spyOn(browserApi, 'getSecurityPosture').mockResolvedValue({
      mfaEnabled: true,
      mfaRequired: false,
      pendingActivation: false,
      platformAccess: false,
    });
    vi.spyOn(browserApi, 'getOrganizations').mockResolvedValue([]);

    render(<OrganizationPicker />);

    expect(await screen.findByRole('heading', { name: 'No workspace access' })).toBeVisible();
    expect(screen.getByText(/complete invitation link/u)).toBeVisible();
    expect(screen.getByText(/self-service league creation are disabled/u)).toBeVisible();
    expect(screen.queryByRole('link', { name: /create/u })).not.toBeInTheDocument();
  });

  it('retries a transient workspace load failure without reloading the page', async () => {
    const user = userEvent.setup();
    const security = vi
      .spyOn(browserApi, 'getSecurityPosture')
      .mockRejectedValueOnce(new Error('Temporary connection loss'))
      .mockResolvedValueOnce({
        mfaEnabled: true,
        mfaRequired: false,
        pendingActivation: false,
        platformAccess: false,
      });
    vi.spyOn(browserApi, 'getOrganizations').mockResolvedValue([]);

    render(<OrganizationPicker />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not load your workspaces.',
    );
    await user.click(screen.getByRole('button', { name: 'Retry loading workspaces' }));

    expect(await screen.findByRole('heading', { name: 'No workspace access' })).toBeVisible();
    expect(security).toHaveBeenCalledTimes(2);
    expect(replace).not.toHaveBeenCalled();
  });

  it('keeps platform authority visibly separate from customer organizations', async () => {
    vi.spyOn(browserApi, 'getSecurityPosture').mockResolvedValue({
      mfaEnabled: true,
      mfaRequired: true,
      pendingActivation: false,
      platformAccess: true,
    });
    vi.spyOn(browserApi, 'getOrganizations').mockResolvedValue([]);

    render(<OrganizationPicker />);

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Controlled-beta onboarding' })).toBeVisible(),
    );
    expect(screen.getByRole('link', { name: 'Open platform operations' })).toHaveAttribute(
      'href',
      '/platform/onboarding',
    );
    expect(
      screen.getByText(/operations available to your separate Platform Operator/u),
    ).toBeVisible();
    expect(screen.queryByText(/Provision customer foundations/u)).not.toBeInTheDocument();
    expect(screen.queryByText(/customer organization/u)).not.toBeInTheDocument();
  });
});
