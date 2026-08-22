import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, browserApi } from '../../lib/api-client';
import { MfaChallengeForm } from './mfa-challenge-form';
import { MfaEnrollmentForm } from './mfa-enrollment-form';
import { SignInForm } from './sign-in-form';

const replace = vi.fn();
const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh }),
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
});

describe('MfaEnrollmentForm', () => {
  it('validates the password and factor, then requires recovery-code acknowledgement', async () => {
    const user = userEvent.setup();
    vi.spyOn(browserApi, 'getSecurityPosture').mockResolvedValue({
      mfaEnabled: false,
      mfaRequired: true,
    });
    const enable = vi.spyOn(browserApi, 'enableMfa').mockResolvedValue({
      totpURI:
        'otpauth://totp/Softball%20League%20Platform:admin%40demo.invalid?secret=ABCDEFGHIJKLMNOP&issuer=Softball%20League%20Platform',
      backupCodes: ['recover-one', 'recover-two'],
    });
    const verify = vi.spyOn(browserApi, 'verifyTotp').mockResolvedValue({});

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

    const { unmount } = render(<MfaChallengeForm />);
    await user.click(screen.getByRole('button', { name: 'Verify and continue' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter the six-digit code');
    await user.type(screen.getByLabelText('Six-digit authenticator code'), '654321');
    await user.click(screen.getByRole('button', { name: 'Verify and continue' }));
    expect(verifyTotp).toHaveBeenCalledWith('654321');
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/admin/organizations'));

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
    });

    render(<SignInForm />);
    await user.type(screen.getByLabelText('Email address'), 'admin@demo.invalid');
    await user.type(screen.getByLabelText('Password'), 'synthetic-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/auth/enroll-mfa'));
  });
});
