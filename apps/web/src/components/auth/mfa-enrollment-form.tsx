'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { type FormEvent, useEffect, useMemo, useState } from 'react';

import { ApiError, browserApi, type FieldErrors } from '../../lib/api-client';
import { FieldError, FormErrorSummary, invalidProps } from '../form-feedback';
import styles from './mfa-forms.module.css';

interface SetupDetails {
  readonly totpURI: string;
  readonly backupCodes: readonly string[];
}

const providerMessage = (error: unknown, action: 'enable' | 'verify'): string => {
  if (!(error instanceof ApiError)) {
    return 'The security service is unavailable. Check your connection and try again.';
  }
  if (error.code === 'ACCOUNT_TEMPORARILY_LOCKED') {
    return 'Authenticator verification is temporarily locked after repeated failed codes. Try again later.';
  }
  if (action === 'verify' && error.code === 'INVALID_CODE') {
    return 'That authenticator code was not accepted. Use the newest code and try again.';
  }
  if (error.status === 429) return 'Too many attempts. Wait a minute, then try again.';
  if (error.status === 401) return 'Your sign-in session expired. Sign in again to continue.';
  if (action === 'enable' && error.status === 400) {
    return 'The password was not accepted, or authenticator setup is already active.';
  }
  if (action === 'verify' && error.status === 400) {
    return 'That authenticator code was not accepted. Use the newest code and try again.';
  }
  return 'Authenticator setup could not be completed. Try again.';
};

const setupKeyFromUri = (uri: string): string => {
  try {
    return new URL(uri).searchParams.get('secret') ?? 'Setup key unavailable';
  } catch {
    return 'Setup key unavailable';
  }
};

export function MfaEnrollmentForm() {
  const router = useRouter();
  const [posture, setPosture] = useState<'loading' | 'enrollable' | 'enabled' | 'error'>('loading');
  const [setup, setSetup] = useState<SetupDetails | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [codesSaved, setCodesSaved] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const setupKey = useMemo(() => (setup ? setupKeyFromUri(setup.totpURI) : ''), [setup]);

  useEffect(() => {
    let active = true;
    void browserApi
      .getSecurityPosture()
      .then((result) => {
        if (active) setPosture(result.mfaEnabled ? 'enabled' : 'enrollable');
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) {
          router.replace('/sign-in');
          return;
        }
        setRequestError('We could not verify your account security status. Try again.');
        setPosture('error');
      });
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    let active = true;
    if (!setup) {
      setQrDataUrl(null);
      return () => {
        active = false;
      };
    }
    void QRCode.toDataURL(setup.totpURI, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320,
    }).then((value) => {
      if (active) setQrDataUrl(value);
    });
    return () => {
      active = false;
    };
  }, [setup]);

  const beginEnrollment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get('password') ?? '');
    const nextErrors: FieldErrors = password ? {} : { password: ['Enter your current password.'] };
    setErrors(nextErrors);
    setRequestError(null);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      const result = await browserApi.enableMfa(password);
      setSetup(result);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace('/sign-in');
      }
      setRequestError(providerMessage(error, 'enable'));
    } finally {
      setSubmitting(false);
    }
  };

  const verifyEnrollment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get('code') ?? '')
      .replaceAll(/\s/gu, '')
      .trim();
    const nextErrors: FieldErrors = /^\d{6}$/u.test(code)
      ? {}
      : { code: ['Enter the six-digit code from your authenticator app.'] };
    setErrors(nextErrors);
    setRequestError(null);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      await browserApi.verifyTotp(code);
      setVerified(true);
      try {
        await browserApi.activatePendingMemberships();
        setActivationError(null);
      } catch {
        setActivationError(
          'Authenticator setup succeeded, but workspace activation could not be completed. Save your recovery codes, then retry activation.',
        );
      }
    } catch (error) {
      setRequestError(providerMessage(error, 'verify'));
    } finally {
      setSubmitting(false);
    }
  };

  const continueAfterEnrollment = async () => {
    if (!codesSaved || submitting) return;
    setSubmitting(true);
    try {
      await browserApi.activatePendingMemberships();
      setActivationError(null);
      router.replace('/admin/organizations');
      router.refresh();
    } catch {
      setActivationError(
        'Workspace activation is still unavailable. Your authenticator is active and your recovery codes remain valid. Try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (posture === 'loading') {
    return <p aria-live="polite">Checking your account security…</p>;
  }

  if (posture === 'error') {
    return (
      <section className="form-card stack" role="alert">
        <h2>Security status unavailable</h2>
        <p>{requestError}</p>
        <Link className="button secondary" href="/admin/organizations">
          Return to organizations
        </Link>
      </section>
    );
  }

  if (posture === 'enabled') {
    return (
      <section className="form-card stack" aria-labelledby="mfa-active-title">
        <p className={styles.step}>Account protected</p>
        <h2 id="mfa-active-title">Authenticator protection is active</h2>
        <div className="callout" role="status">
          Your account will require an authenticator or unused recovery code at sign-in.
        </div>
        <p>
          Existing authenticator details are not shown or replaced here. Contact an authorized
          operator if you lose both your authenticator and recovery codes.
        </p>
        <Link className="button" href="/admin/organizations">
          Return to organizations
        </Link>
      </section>
    );
  }

  if (verified && setup) {
    return (
      <section className="form-card stack" aria-labelledby="recovery-code-title">
        <p className={styles.step}>Step 3 of 3</p>
        <h2 id="recovery-code-title">Save your recovery codes</h2>
        <div className="callout" role="status">
          Authenticator verification succeeded. Each recovery code can be used only once.
        </div>
        {activationError ? (
          <div className="callout error" role="alert">
            {activationError}
          </div>
        ) : null}
        <ul className={styles.recoveryCodes} aria-label="One-time recovery codes">
          {setup.backupCodes.map((code) => (
            <li key={code}>
              <code>{code}</code>
            </li>
          ))}
        </ul>
        <p className="meta">
          Store these somewhere private and separate from this device. They will not be shown again.
        </p>
        <div className={styles.checkField}>
          <input
            checked={codesSaved}
            id="codes-saved"
            onChange={(event) => setCodesSaved(event.currentTarget.checked)}
            type="checkbox"
          />
          <div>
            <label htmlFor="codes-saved">I saved my recovery codes</label>
            <p>Confirm only after you can recover the account without this authenticator.</p>
          </div>
        </div>
        <button
          disabled={!codesSaved || submitting}
          onClick={() => void continueAfterEnrollment()}
          type="button"
        >
          {submitting ? 'Activating workspace…' : 'Continue to organizations'}
        </button>
      </section>
    );
  }

  if (setup) {
    return (
      <form className="form-card stack" noValidate onSubmit={verifyEnrollment}>
        <p className={styles.step}>Step 2 of 3</p>
        <h2>Connect your authenticator</h2>
        <FormErrorSummary errors={errors} />
        {requestError ? (
          <div className="callout error" role="alert">
            {requestError}
          </div>
        ) : null}
        <p>Scan this code with an authenticator app, or enter the setup key manually.</p>
        <div className={styles.qrWrap}>
          {qrDataUrl ? (
            <Image
              alt="QR code for authenticator setup; the same setup key appears below"
              className={styles.qrImage}
              height={320}
              src={qrDataUrl}
              unoptimized
              width={320}
            />
          ) : (
            <p aria-live="polite">Preparing the QR code…</p>
          )}
        </div>
        <div className="field">
          <label htmlFor="manual-setup-key">Manual setup key</label>
          <output className={styles.manualKey} id="manual-setup-key">
            {setupKey}
          </output>
        </div>
        <div className="field">
          <label htmlFor="code">Six-digit authenticator code</label>
          <input
            autoComplete="one-time-code"
            id="code"
            inputMode="numeric"
            maxLength={6}
            name="code"
            pattern="[0-9]*"
            {...invalidProps('code', errors)}
          />
          <FieldError errors={errors} field="code" />
        </div>
        <button disabled={submitting} type="submit">
          {submitting ? 'Verifying…' : 'Verify authenticator'}
        </button>
      </form>
    );
  }

  return (
    <form className="form-card stack" noValidate onSubmit={beginEnrollment}>
      <p className={styles.step}>Step 1 of 3</p>
      <h2>Confirm your account</h2>
      <FormErrorSummary errors={errors} />
      {requestError ? (
        <div className="callout error" role="alert">
          {requestError}
        </div>
      ) : null}
      <p>
        Enter your current password before connecting an authenticator. Your password is sent only
        to the authentication service for verification.
      </p>
      <div className="field">
        <label htmlFor="password">Current password</label>
        <input
          autoComplete="current-password"
          id="password"
          name="password"
          type="password"
          {...invalidProps('password', errors)}
        />
        <FieldError errors={errors} field="password" />
      </div>
      <button disabled={submitting} type="submit">
        {submitting ? 'Preparing setup…' : 'Start authenticator setup'}
      </button>
    </form>
  );
}
