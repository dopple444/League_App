import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, browserApi } from '../../lib/api-client';
import { MfaChallengeForm } from './mfa-challenge-form';
import { MfaEnrollmentForm } from './mfa-enrollment-form';
import { SignInForm } from './sign-in-form';

const replace = vi.fn();
const refresh = vi.fn();
const router = { replace, refresh };

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}));

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,cXItY29kZQ=='),
  },
}));

afterEach(() => {
  vi.restoreAllMocks();
  replace.mockReset();
  refresh.mockReset();
  window.history.replaceState(null, '', '/');
});

describe('MfaEnrollmentForm', () => {
  it('validates the password and factor, then requires recovery-code acknowledgement', async () => {
    const user = userEvent.setup();
    vi.spyOn(browserApi, 'getSecurityPosture').mockResolvedValue({
      mfaEnabled: false,
      mfaRequired: true,
      pendingActivation: true,
      platformAccess: false,
    });
    const enable = vi.spyOn(browserApi, 'enableMfa').mockResolvedValue({
      totpURI:
        'otpauth://totp/Softball%20League%20Platform:admin%40demo.invalid?secret=ABCDEFGHIJKLMNOP&issuer=Softball%20League%20Platform',
      backupCodes: ['recover-one', 'recover-two'],
    });
    const verify = vi.spyOn(browserApi, 'verifyTotp').mockResolvedValue({});
    const activate = vi
      .spyOn(browserApi, 'activatePendingMemberships')
      .mockResolvedValue({ items: [] });

    render(<MfaEnrollmentForm />);

    await user.click(await screen.findByRole('button', { name: 'Start authenticator setup' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your current password.');
    expect(screen.getByLabelText('Current password')).toHaveAttribute('aria-invalid', 'true');

    await user.type(screen.getByLabelText('Current password'), 'synthetic-password');
    await user.click(screen.getByRole('button', { name: 'Start authenticator setup' }));
    expect(enable).toHaveBeenCalledWith('synthetic-password');
    expect(
      await screen.findByRole('heading', { name: 'Connect your authenticator' }),
    ).toBeVisible();
    expect(screen.getByText('ABCDEFGHIJKLMNOP')).toBeVisible();
    expect(await screen.findByAltText(/QR code for authenticator setup/u)).toBeInTheDocument();

    await user.type(screen.getByLabelText('Six-digit authenticator code'), '12');
    await user.click(screen.getByRole('button', { name: 'Verify authenticator' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter the six-digit code');
    expect(verify).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText('Six-digit authenticator code'));
    await user.type(screen.getByLabelText('Six-digit authenticator code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify authenticator' }));
    expect(verify).toHaveBeenCalledWith('123456');
    expect(activate).toHaveBeenCalled();

    expect(await screen.findByRole('heading', { name: 'Save your recovery codes' })).toBeVisible();
    expect(screen.getByText('recover-one')).toBeVisible();
    const continueButton = screen.getByRole('button', { name: 'Continue to organizations' });
    expect(continueButton).toBeDisabled();
    await user.click(screen.getByLabelText('I saved my recovery codes'));
    expect(continueButton).toBeEnabled();
    await user.click(continueButton);
    expect(replace).toHaveBeenCalledWith('/admin/organizations');
  });

  it('does not replace an existing authenticator enrollment', async () => {
    vi.spyOn(browserApi, 'getSecurityPosture').mockResolvedValue({
      mfaEnabled: true,
      mfaRequired: true,
      pendingActivation: false,
      platformAccess: false,
    });
    const enable = vi.spyOn(browserApi, 'enableMfa');

    render(<MfaEnrollmentForm />);

    expect(
      await screen.findByRole('heading', { name: 'Authenticator protection is active' }),
    ).toBeVisible();
    expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument();
    expect(enable).not.toHaveBeenCalled();
  });

  it('reports an invalid enrollment code without claiming the session expired', async () => {
    const user = userEvent.setup();
    vi.spyOn(browserApi, 'getSecurityPosture').mockResolvedValue({
      mfaEnabled: false,
      mfaRequired: true,
      pendingActivation: false,
      platformAccess: false,
    });
    vi.spyOn(browserApi, 'enableMfa').mockResolvedValue({
      totpURI: 'otpauth://totp/League?secret=ABCDEFGHIJKLMNOP',
      backupCodes: ['recover-one'],
    });
    vi.spyOn(browserApi, 'verifyTotp').mockRejectedValue(
      new ApiError(401, { code: 'INVALID_CODE', message: 'Invalid code' }),
    );

    render(<MfaEnrollmentForm />);
    await user.type(await screen.findByLabelText('Current password'), 'synthetic-password');
    await user.click(screen.getByRole('button', { name: 'Start authenticator setup' }));
    await user.type(await screen.findByLabelText('Six-digit authenticator code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify authenticator' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('code was not accepted');
    expect(screen.getByRole('alert')).not.toHaveTextContent('session expired');
  });
});

describe('MfaChallengeForm', () => {
  it('supports authenticator and recovery-code challenge modes', async () => {
    const user = userEvent.setup();
    const verifyTotp = vi.spyOn(browserApi, 'verifyTotp').mockResolvedValue({});
    const activate = vi
      .spyOn(browserApi, 'activatePendingMemberships')
      .mockResolvedValue({ items: [] });

    const { unmount } = render(<MfaChallengeForm />);
    await user.click(screen.getByRole('button', { name: 'Verify and continue' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter the six-digit code');
    await user.type(screen.getByLabelText('Six-digit authenticator code'), '654321');
    await user.click(screen.getByRole('button', { name: 'Verify and continue' }));
    expect(verifyTotp).toHaveBeenCalledWith('654321');
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/admin/organizations'));
    expect(activate).toHaveBeenCalled();

    unmount();
    replace.mockReset();
    const verifyBackup = vi.spyOn(browserApi, 'verifyBackupCode').mockResolvedValue({});
    render(<MfaChallengeForm />);
    await user.click(screen.getByRole('button', { name: 'Use a recovery code' }));
    await user.type(screen.getByLabelText('Recovery code'), 'recovery-code');
    await user.click(screen.getByRole('button', { name: 'Verify and continue' }));
    expect(verifyBackup).toHaveBeenCalledWith('recovery-code');
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/admin/organizations'));
  });

  it('distinguishes invalid codes and lockout from an expired verification window', async () => {
    const user = userEvent.setup();
    const verifyTotp = vi
      .spyOn(browserApi, 'verifyTotp')
      .mockRejectedValueOnce(new ApiError(401, { code: 'INVALID_CODE', message: 'Invalid code' }));

    render(<MfaChallengeForm />);
    await user.type(screen.getByLabelText('Six-digit authenticator code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify and continue' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('code was not accepted');
    expect(screen.getByRole('alert')).not.toHaveTextContent('window expired');

    verifyTotp.mockRejectedValueOnce(
      new ApiError(429, {
        code: 'ACCOUNT_TEMPORARILY_LOCKED',
        message: 'Account temporarily locked',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Verify and continue' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('temporarily locked');
    expect(screen.getByRole('alert')).not.toHaveTextContent('Wait a minute');
  });

  it('accepts a fragment-held invitation after MFA and then activates pending access', async () => {
    const user = userEvent.setup();
    const bearer = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    window.history.replaceState(null, '', `/auth/two-factor#token=${encodeURIComponent(bearer)}`);
    const sequence: string[] = [];
    vi.spyOn(browserApi, 'verifyTotp').mockImplementation(async () => {
      sequence.push('verify');
      return {};
    });
    const accept = vi
      .spyOn(browserApi, 'acceptAdministratorInvitation')
      .mockImplementation(async () => {
        sequence.push('accept');
        return {
          accepted: true,
          acceptedAt: '2026-08-24T12:00:00.000Z',
          membershipStatus: 'PENDING',
          mfaRequired: true,
        };
      });
    vi.spyOn(browserApi, 'activatePendingMemberships').mockImplementation(async () => {
      sequence.push('activate');
      return { items: [] };
    });

    render(<MfaChallengeForm />);
    await waitFor(() => expect(window.location.hash).toBe(''));
    await user.type(screen.getByLabelText('Six-digit authenticator code'), '654321');
    await user.click(screen.getByRole('button', { name: 'Verify and continue' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/admin/organizations'));
    expect(accept).toHaveBeenCalledWith({ invitationToken: bearer }, expect.any(String));
    expect(sequence).toEqual(['verify', 'accept', 'activate']);
  });

  it('stops retrying a terminal invitation rejection after MFA', async () => {
    const user = userEvent.setup();
    const bearer = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    window.history.replaceState(null, '', `/auth/two-factor#token=${encodeURIComponent(bearer)}`);
    vi.spyOn(browserApi, 'verifyTotp').mockResolvedValue({});
    const accept = vi.spyOn(browserApi, 'acceptAdministratorInvitation').mockRejectedValue(
      new ApiError(410, {
        code: 'INVITATION_UNAVAILABLE',
        message: 'Unavailable',
        requestId: crypto.randomUUID(),
      }),
    );
    const activate = vi.spyOn(browserApi, 'activatePendingMemberships');

    render(<MfaChallengeForm />);
    await user.type(screen.getByLabelText('Six-digit authenticator code'), '654321');
    await user.click(screen.getByRole('button', { name: 'Verify and continue' }));

    expect(
      await screen.findByRole('heading', { name: 'Invitation could not be accepted' }),
    ).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('issued administrator address');
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Retry workspace activation' }),
    ).not.toBeInTheDocument();
    expect(accept).toHaveBeenCalledOnce();
    expect(activate).not.toHaveBeenCalled();
  });

  it('retries activation without accepting the invitation or entering MFA twice', async () => {
    const user = userEvent.setup();
    const bearer = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    window.history.replaceState(null, '', `/auth/two-factor#token=${encodeURIComponent(bearer)}`);
    const verify = vi.spyOn(browserApi, 'verifyTotp').mockResolvedValue({});
    const accept = vi.spyOn(browserApi, 'acceptAdministratorInvitation').mockResolvedValue({
      accepted: true,
      acceptedAt: '2026-08-24T12:00:00.000Z',
      membershipStatus: 'PENDING',
      mfaRequired: true,
    });
    const activate = vi
      .spyOn(browserApi, 'activatePendingMemberships')
      .mockRejectedValueOnce(
        new ApiError(503, {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Unavailable',
          requestId: crypto.randomUUID(),
        }),
      )
      .mockResolvedValueOnce({ items: [] });

    render(<MfaChallengeForm />);
    await user.type(screen.getByLabelText('Six-digit authenticator code'), '654321');
    await user.click(screen.getByRole('button', { name: 'Verify and continue' }));

    const retry = await screen.findByRole('button', { name: 'Retry workspace activation' });
    expect(screen.getByRole('alert')).toHaveTextContent('invitation was accepted');
    await user.click(retry);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/admin/organizations'));
    expect(verify).toHaveBeenCalledOnce();
    expect(accept).toHaveBeenCalledOnce();
    expect(activate).toHaveBeenCalledTimes(2);
  });

  it('labels and retries transient invitation acceptance separately from activation', async () => {
    const user = userEvent.setup();
    const bearer = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    window.history.replaceState(null, '', `/auth/two-factor#token=${encodeURIComponent(bearer)}`);
    const verify = vi.spyOn(browserApi, 'verifyTotp').mockResolvedValue({});
    const accept = vi
      .spyOn(browserApi, 'acceptAdministratorInvitation')
      .mockRejectedValueOnce(
        new ApiError(503, {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Unavailable',
          requestId: crypto.randomUUID(),
        }),
      )
      .mockResolvedValueOnce({
        accepted: true,
        acceptedAt: '2026-08-24T12:00:00.000Z',
        membershipStatus: 'PENDING',
        mfaRequired: true,
      });
    const activate = vi
      .spyOn(browserApi, 'activatePendingMemberships')
      .mockResolvedValue({ items: [] });

    render(<MfaChallengeForm />);
    await user.type(screen.getByLabelText('Six-digit authenticator code'), '654321');
    await user.click(screen.getByRole('button', { name: 'Verify and continue' }));

    const retry = await screen.findByRole('button', { name: 'Retry invitation acceptance' });
    expect(screen.queryByRole('button', { name: 'Retry workspace activation' })).toBeNull();
    await user.click(retry);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/admin/organizations'));
    expect(verify).toHaveBeenCalledOnce();
    expect(accept).toHaveBeenCalledTimes(2);
    expect(activate).toHaveBeenCalledOnce();
  });
});

describe('SignInForm MFA routing', () => {
  it('routes an enrolled identity to the factor challenge', async () => {
    const user = userEvent.setup();
    vi.spyOn(browserApi, 'signIn').mockResolvedValue({
      twoFactorRedirect: true,
      twoFactorMethods: ['totp'],
    });
    const posture = vi.spyOn(browserApi, 'getSecurityPosture');

    render(<SignInForm />);
    await user.type(screen.getByLabelText('Email address'), 'admin@demo.invalid');
    await user.type(screen.getByLabelText('Password'), 'synthetic-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/auth/two-factor'));
    expect(posture).not.toHaveBeenCalled();
  });

  it('routes an unenrolled privileged identity to mandatory enrollment', async () => {
    const user = userEvent.setup();
    vi.spyOn(browserApi, 'signIn').mockResolvedValue({
      user: { twoFactorEnabled: false },
    });
    vi.spyOn(browserApi, 'getSecurityPosture').mockResolvedValue({
      mfaEnabled: false,
      mfaRequired: true,
      pendingActivation: false,
      platformAccess: false,
    });

    render(<SignInForm />);
    await user.type(screen.getByLabelText('Email address'), 'admin@demo.invalid');
    await user.type(screen.getByLabelText('Password'), 'synthetic-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/auth/enroll-mfa'));
  });

  it('keeps an invitation out of the query string while handing it to MFA', async () => {
    const user = userEvent.setup();
    const bearer = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    window.history.replaceState(null, '', `/sign-in#token=${encodeURIComponent(bearer)}`);
    vi.spyOn(browserApi, 'signIn').mockResolvedValue({
      twoFactorRedirect: true,
      twoFactorMethods: ['totp'],
    });
    const accept = vi.spyOn(browserApi, 'acceptAdministratorInvitation');

    render(<SignInForm />);
    await waitFor(() => expect(window.location.hash).toBe(''));
    await user.type(screen.getByLabelText('Email address'), 'admin@demo.invalid');
    await user.type(screen.getByLabelText('Password'), 'synthetic-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(replace).toHaveBeenCalledOnce());
    const destination = new URL(String(replace.mock.calls[0]?.[0]), 'https://league.example');
    expect(destination.pathname).toBe('/auth/two-factor');
    expect(destination.search).toBe('');
    expect(destination.hash).toContain(encodeURIComponent(bearer));
    expect(accept).not.toHaveBeenCalled();
  });

  it('clears a terminal pre-MFA invitation and requires sign-out before recovery', async () => {
    const user = userEvent.setup();
    const bearer = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    window.history.replaceState(null, '', `/sign-in#token=${encodeURIComponent(bearer)}`);
    vi.spyOn(browserApi, 'signIn').mockResolvedValue({ user: { twoFactorEnabled: false } });
    const accept = vi.spyOn(browserApi, 'acceptAdministratorInvitation').mockRejectedValue(
      new ApiError(410, {
        code: 'INVITATION_UNAVAILABLE',
        message: 'Unavailable',
        requestId: crypto.randomUUID(),
      }),
    );
    const posture = vi.spyOn(browserApi, 'getSecurityPosture');
    const signOut = vi.spyOn(browserApi, 'signOut').mockResolvedValue({});

    render(<SignInForm />);
    await waitFor(() => expect(window.location.hash).toBe(''));
    await user.type(screen.getByLabelText('Email address'), 'other@example.invalid');
    await user.type(screen.getByLabelText('Password'), 'synthetic-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByRole('heading', { name: 'Invitation could not be accepted' }),
    ).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('issued administrator address');
    expect(screen.queryByLabelText('Email address')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument();
    expect(accept).toHaveBeenCalledOnce();
    expect(posture).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(signOut).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledWith('/sign-in');
  });
});
