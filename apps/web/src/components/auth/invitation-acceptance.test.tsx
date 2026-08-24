import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, browserApi } from '../../lib/api-client';
import { InvitationAcceptance } from './invitation-acceptance';

const replace = vi.fn();
const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh }),
}));

const ephemeralBearer = (): string => `${crypto.randomUUID()}${crypto.randomUUID()}`;

afterEach(() => {
  vi.restoreAllMocks();
  replace.mockReset();
  refresh.mockReset();
  window.history.replaceState(null, '', '/');
});

describe('InvitationAcceptance', () => {
  it('strips the bearer fragment, validates registration, and hands it to sign-in in a fragment', async () => {
    const user = userEvent.setup();
    const bearer = ephemeralBearer();
    window.history.replaceState(
      null,
      '',
      `/auth/accept-invite#token=${encodeURIComponent(bearer)}`,
    );
    const inspect = vi.spyOn(browserApi, 'inspectAdministratorInvitation').mockResolvedValue({
      administratorEmailHint: 'a***@example.invalid',
      expiresAt: '2026-08-31T12:00:00.000Z',
      leagueName: 'Community Softball',
      organizationName: 'Community Recreation',
    });
    const register = vi
      .spyOn(browserApi, 'registerAdministratorInvitation')
      .mockResolvedValue({ continueToSignIn: true });

    render(<InvitationAcceptance />);

    expect(await screen.findByText('Community Recreation')).toBeVisible();
    expect(inspect).toHaveBeenCalledWith(bearer);
    expect(window.location.hash).toBe('');
    expect(window.location.search).toBe('');
    expect(screen.getByText('a***@example.invalid')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Create account and continue' }));
    expect(screen.getByRole('alert')).toHaveFocus();
    expect(screen.getByLabelText('Display name (required)')).toHaveAttribute(
      'aria-invalid',
      'true',
    );

    await user.type(screen.getByLabelText('Display name (required)'), 'Synthetic Administrator');
    await user.type(screen.getByLabelText('Create password (required)'), 'long-test-password');
    await user.type(screen.getByLabelText('Confirm password (required)'), 'different-password');
    await user.click(screen.getByRole('button', { name: 'Create account and continue' }));
    expect(screen.getByRole('alert')).toHaveTextContent('passwords do not match');
    expect(register).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText('Confirm password (required)'));
    await user.type(screen.getByLabelText('Confirm password (required)'), 'long-test-password');
    await user.click(screen.getByRole('button', { name: 'Create account and continue' }));
    expect(register).toHaveBeenCalledWith({
      invitationToken: bearer,
      name: 'Synthetic Administrator',
      password: 'long-test-password',
    });
    expect(await screen.findByRole('button', { name: 'Continue to staff sign in' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Continue to staff sign in' }));
    const destination = String(replace.mock.calls[0]?.[0]);
    expect(new URL(destination, 'https://league.example').pathname).toBe('/sign-in');
    expect(new URL(destination, 'https://league.example').search).toBe('');
    expect(new URL(destination, 'https://league.example').hash).toContain(
      encodeURIComponent(bearer),
    );
  });

  it('uses one non-enumerating unavailable state for an unusable bearer', async () => {
    const bearer = ephemeralBearer();
    window.history.replaceState(null, '', `/auth/accept-invite#token=${bearer}`);
    vi.spyOn(browserApi, 'inspectAdministratorInvitation').mockRejectedValue(
      new ApiError(410, {
        code: 'INVITATION_UNAVAILABLE',
        message: 'Unavailable',
        requestId: crypto.randomUUID(),
      }),
    );

    render(<InvitationAcceptance />);

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByRole('heading', { name: 'Invitation unavailable' })).toBeVisible();
    expect(alert).not.toHaveTextContent('Community Recreation');
    expect(alert).not.toHaveTextContent(bearer);
    expect(window.location.hash).toBe('');
  });

  it.each([
    { heading: 'Invitation check temporarily limited', status: 429 },
    { heading: 'Invitation service unavailable', status: 503 },
  ])('retries a $status inspection failure from component memory', async ({ heading, status }) => {
    const user = userEvent.setup();
    const bearer = ephemeralBearer();
    window.history.replaceState(null, '', `/auth/accept-invite#token=${bearer}`);
    const inspect = vi
      .spyOn(browserApi, 'inspectAdministratorInvitation')
      .mockRejectedValueOnce(
        new ApiError(status, {
          code: status === 429 ? 'RATE_LIMITED' : 'SERVICE_UNAVAILABLE',
          message: 'Unavailable',
          requestId: crypto.randomUUID(),
        }),
      )
      .mockResolvedValueOnce({
        administratorEmailHint: 'a***@example.invalid',
        expiresAt: '2026-08-31T12:00:00.000Z',
        leagueName: 'Community Softball',
        organizationName: 'Community Recreation',
      });

    render(<InvitationAcceptance />);

    expect(await screen.findByRole('heading', { name: heading })).toBeVisible();
    expect(window.location.hash).toBe('');
    await user.click(screen.getByRole('button', { name: 'Retry invitation check' }));

    expect(await screen.findByText('Community Recreation')).toBeVisible();
    expect(inspect).toHaveBeenCalledTimes(2);
    expect(inspect.mock.calls[1]?.[0] === bearer).toBe(true);
  });

  it('lets an existing issued account continue without submitting a password', async () => {
    const user = userEvent.setup();
    const bearer = ephemeralBearer();
    window.history.replaceState(null, '', `/auth/accept-invite#token=${bearer}`);
    vi.spyOn(browserApi, 'inspectAdministratorInvitation').mockResolvedValue({
      administratorEmailHint: 'a***@example.invalid',
      expiresAt: '2026-08-31T12:00:00.000Z',
      leagueName: 'Community Softball',
      organizationName: 'Community Recreation',
    });
    const register = vi.spyOn(browserApi, 'registerAdministratorInvitation');

    render(<InvitationAcceptance />);
    await user.click(
      await screen.findByRole('button', { name: 'I already have an issued account' }),
    );

    await waitFor(() => expect(replace).toHaveBeenCalledOnce());
    expect(register).not.toHaveBeenCalled();
  });
});
