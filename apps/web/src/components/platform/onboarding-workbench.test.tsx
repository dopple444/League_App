import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  browserApi,
  type PlatformOnboarding,
  type ProvisionPlatformOnboardingResult,
} from '../../lib/api-client';
import { OnboardingWorkbench } from './onboarding-workbench';

const replace = vi.fn();
const refresh = vi.fn();
const router = { replace, refresh };

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}));

const baseItem: PlatformOnboarding = {
  acceptedAt: null,
  activatedAt: null,
  administratorEmail: 'administrator@example.invalid',
  createdAt: '2026-08-24T12:00:00.000Z',
  expiresAt: '2026-08-31T12:00:00.000Z',
  invitationId: '16a79428-8259-43c0-8504-e70e70e524ea',
  leagueId: '97ec788c-3c07-4a82-9b9f-c3612f7023e0',
  leagueName: 'Community Softball',
  leagueSlug: 'community-softball',
  organizationId: '6ecab6e5-acaa-485e-9d89-eb7a930e7ee8',
  organizationName: 'Community Recreation',
  organizationSlug: 'community-recreation',
  revokedAt: null,
  status: 'PENDING',
  timezone: 'America/New_York',
  version: 1,
};

afterEach(() => {
  vi.restoreAllMocks();
  replace.mockReset();
  refresh.mockReset();
});

const allowOperator = () => {
  vi.spyOn(browserApi, 'getSecurityPosture').mockResolvedValue({
    mfaEnabled: true,
    mfaRequired: true,
    pendingActivation: false,
    platformAccess: true,
  });
};

describe('OnboardingWorkbench', () => {
  it('validates, reviews, and provisions one customer with a copy-once fragment link', async () => {
    const user = userEvent.setup();
    allowOperator();
    vi.spyOn(browserApi, 'listPlatformOnboarding').mockResolvedValue({
      canProvisionTenants: true,
      canRevokeInvitations: false,
      items: [],
    });
    const invitationToken = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    const result: ProvisionPlatformOnboardingResult = { ...baseItem, invitationToken };
    const provision = vi.spyOn(browserApi, 'provisionTenant').mockResolvedValue(result);

    render(<OnboardingWorkbench />);

    expect(await screen.findByText('mfa protected', { exact: true })).toBeVisible();
    await user.click(await screen.findByRole('button', { name: 'Provision customer' }));
    const form = screen.getByRole('region', { name: 'Provision customer' });
    await user.click(within(form).getByRole('button', { name: 'Review customer foundation' }));
    expect(within(form).getByRole('alert')).toHaveFocus();
    expect(within(form).getByLabelText('Organization name (required)')).toHaveAttribute(
      'aria-invalid',
      'true',
    );

    await user.type(
      within(form).getByLabelText('Organization name (required)'),
      'Community Recreation',
    );
    await user.type(
      within(form).getByLabelText('Organization URL name (required)'),
      'community-recreation',
    );
    await user.type(
      within(form).getByLabelText('Initial league name (required)'),
      'Community Softball',
    );
    await user.type(
      within(form).getByLabelText('League URL name (required)'),
      'community-softball',
    );
    await user.type(
      within(form).getByLabelText('Administrator email (required)'),
      'Administrator@Example.Invalid',
    );
    await user.type(
      within(form).getByLabelText('Operational reason (required)'),
      'Authorized synthetic beta onboarding.',
    );
    await user.click(within(form).getByRole('button', { name: 'Review customer foundation' }));

    expect(
      await screen.findByRole('heading', { name: 'Review customer foundation' }),
    ).toHaveFocus();
    expect(screen.getByText('administrator@example.invalid')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Confirm and provision customer' }));

    await waitFor(() => expect(provision).toHaveBeenCalledOnce());
    expect(provision.mock.calls[0]?.[0]).toEqual({
      administratorEmail: 'administrator@example.invalid',
      invitationExpiresInHours: 168,
      leagueName: 'Community Softball',
      leagueSlug: 'community-softball',
      organizationName: 'Community Recreation',
      organizationSlug: 'community-recreation',
      reason: 'Authorized synthetic beta onboarding.',
      timezone: 'America/New_York',
    });
    expect(provision.mock.calls[0]?.[1]).toEqual(expect.any(String));

    const handoff = await screen.findByText(/\/auth\/accept-invite#token=/u);
    const invitationUrl = handoff.textContent ?? '';
    expect(new URL(invitationUrl).pathname).toBe('/auth/accept-invite');
    expect(new URL(invitationUrl).search).toBe('');
    expect(new URL(invitationUrl).hash).toContain(encodeURIComponent(invitationToken));
    expect(screen.getByRole('heading', { name: 'Community Recreation' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Revoke invitation' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'I saved the link — clear it' }));
    expect(screen.queryByText(invitationToken, { exact: false })).not.toBeInTheDocument();
    expect(screen.getByText(/copy-once invitation link was cleared/u)).toBeVisible();
  });

  it('requires a reason and updates the ledger after revocation', async () => {
    const user = userEvent.setup();
    allowOperator();
    vi.spyOn(browserApi, 'listPlatformOnboarding').mockResolvedValue({
      canProvisionTenants: false,
      canRevokeInvitations: true,
      items: [baseItem],
    });
    const revoke = vi.spyOn(browserApi, 'revokeAdministratorInvitation').mockResolvedValue({
      ...baseItem,
      revokedAt: '2026-08-24T13:00:00.000Z',
      status: 'REVOKED',
      version: 2,
    });

    render(<OnboardingWorkbench />);

    const card = await screen.findByRole('article', { name: 'Community Recreation' });
    expect(screen.queryByRole('button', { name: 'Provision customer' })).not.toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Revoke invitation' }));
    await user.click(within(card).getByRole('button', { name: 'Confirm revocation' }));
    const summary = within(card).getByRole('alert');
    expect(summary).toHaveFocus();
    expect(summary).toHaveTextContent('Enter a revocation reason.');
    expect(within(card).getByLabelText('Revocation reason (required)')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(revoke).not.toHaveBeenCalled();

    await user.type(
      within(card).getByLabelText('Revocation reason (required)'),
      'Customer requested a replacement invitation.',
    );
    await user.click(within(card).getByRole('button', { name: 'Confirm revocation' }));

    await waitFor(() => expect(revoke).toHaveBeenCalledOnce());
    expect(revoke).toHaveBeenCalledWith(
      baseItem.invitationId,
      {
        expectedVersion: 1,
        reason: 'Customer requested a replacement invitation.',
      },
      expect.any(String),
    );
    const updatedCard = await screen.findByRole('article', { name: 'Community Recreation' });
    expect(within(updatedCard).getByText('revoked', { exact: true })).toBeVisible();
    expect(
      within(updatedCard).queryByRole('button', { name: 'Revoke invitation' }),
    ).not.toBeInTheDocument();
  });

  it('denies a tenant administrator without rendering platform data', async () => {
    vi.spyOn(browserApi, 'getSecurityPosture').mockResolvedValue({
      mfaEnabled: true,
      mfaRequired: false,
      pendingActivation: false,
      platformAccess: false,
    });
    const list = vi.spyOn(browserApi, 'listPlatformOnboarding');

    render(<OnboardingWorkbench />);

    expect(
      await screen.findByRole('heading', { name: 'Platform access unavailable' }),
    ).toBeVisible();
    expect(list).not.toHaveBeenCalled();
    expect(screen.queryByText(baseItem.organizationName)).not.toBeInTheDocument();
  });

  it('does not instruct a revoke-only operator to provision an empty ledger', async () => {
    allowOperator();
    vi.spyOn(browserApi, 'listPlatformOnboarding').mockResolvedValue({
      canProvisionTenants: false,
      canRevokeInvitations: true,
      items: [],
    });

    render(<OnboardingWorkbench />);

    expect(
      await screen.findByText(
        'No customer invitations are currently available for review or revocation.',
      ),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Provision customer' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Provision the first synthetic customer/u)).not.toBeInTheDocument();
  });
});
