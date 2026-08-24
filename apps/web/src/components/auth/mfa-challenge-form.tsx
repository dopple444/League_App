'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useRef, useState } from 'react';

import { ApiError, browserApi, createIdempotencyKey, type FieldErrors } from '../../lib/api-client';
import { consumeInvitationBearer } from '../../lib/invitation-bearer';
import { FieldError, FormErrorSummary, invalidProps } from '../form-feedback';
import styles from './mfa-forms.module.css';
import { SignOutButton } from './sign-out-button';

type ChallengeMode = 'totp' | 'recovery';
type CompletionFailure =
  | 'retryable-acceptance'
  | 'retryable-activation'
  | 'terminal-invitation'
  | null;

const isTerminalInvitationFailure = (error: unknown): boolean =>
  error instanceof ApiError && [400, 401, 403, 404, 409, 410, 422].includes(error.status);

const challengeMessage = (error: unknown): string => {
  if (!(error instanceof ApiError)) {
    return 'The security service is unavailable. Check your connection and try again.';
  }
  if (error.code === 'ACCOUNT_TEMPORARILY_LOCKED') {
    return 'This account is temporarily locked after repeated failed codes. Try again later.';
  }
  if (error.code === 'INVALID_CODE' || error.code === 'INVALID_BACKUP_CODE') {
    return 'That verification code was not accepted. Check it and try again.';
  }
  if (error.status === 429) return 'Too many attempts. Wait a minute, then try again.';
  if (error.code === 'INVALID_TWO_FACTOR_COOKIE' || error.status === 401) {
    return 'Your verification window expired. Return to sign in and start again.';
  }
  return 'That verification code was not accepted. Check it and try again.';
};

export function MfaChallengeForm() {
  const router = useRouter();
  const [mode, setMode] = useState<ChallengeMode>('totp');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [challengeComplete, setChallengeComplete] = useState(false);
  const [completionFailure, setCompletionFailure] = useState<CompletionFailure>(null);
  const invitationBearerRef = useRef<string | null>(null);
  const bearerReadRef = useRef(false);
  const invitationAcceptanceKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (bearerReadRef.current) return;
    bearerReadRef.current = true;
    invitationBearerRef.current = consumeInvitationBearer();
  }, []);

  const finishOnboarding = async () => {
    if (submitting) return;
    setSubmitting(true);
    setRequestError(null);
    setCompletionFailure(null);
    try {
      const invitationBearer = invitationBearerRef.current;
      const acceptedInvitation = invitationBearer !== null;
      if (invitationBearer) {
        invitationAcceptanceKeyRef.current ??= createIdempotencyKey();
        try {
          await browserApi.acceptAdministratorInvitation(
            { invitationToken: invitationBearer },
            invitationAcceptanceKeyRef.current,
          );
          invitationBearerRef.current = null;
        } catch (error) {
          if (isTerminalInvitationFailure(error)) {
            invitationBearerRef.current = null;
            setCompletionFailure('terminal-invitation');
            setRequestError(
              'This invitation cannot be accepted for the signed-in account. Sign out, reopen the complete invitation link, and sign in with the issued administrator address. If it still cannot be used, request a new invitation.',
            );
          } else {
            setCompletionFailure('retryable-acceptance');
            setRequestError(
              error instanceof ApiError && error.status === 429
                ? 'Your identity was verified, but invitation acceptance is temporarily rate limited. Wait a minute, then retry.'
                : 'Your identity was verified, but invitation acceptance is temporarily unavailable. Retry without entering another code.',
            );
          }
          return;
        }
      }
      try {
        await browserApi.activatePendingMemberships();
      } catch (error) {
        setCompletionFailure('retryable-activation');
        setRequestError(
          error instanceof ApiError && error.status === 429
            ? `${acceptedInvitation ? 'Your invitation was accepted' : 'Your identity was verified'}, but workspace activation is temporarily rate limited. Wait a minute, then retry.`
            : `${acceptedInvitation ? 'Your invitation was accepted' : 'Your identity was verified'}, but workspace activation is temporarily unavailable. Retry without entering another code.`,
        );
        return;
      }
      router.replace('/admin/organizations');
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = String(form.get('verification-code') ?? '').trim();
    const normalized = mode === 'totp' ? value.replaceAll(/\s/gu, '') : value;
    const nextErrors: FieldErrors =
      mode === 'totp' && !/^\d{6}$/u.test(normalized)
        ? { 'verification-code': ['Enter the six-digit code from your authenticator app.'] }
        : mode === 'recovery' && normalized.length < 4
          ? { 'verification-code': ['Enter one complete recovery code.'] }
          : {};
    setErrors(nextErrors);
    setRequestError(null);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    let verified = false;
    try {
      if (mode === 'totp') {
        await browserApi.verifyTotp(normalized);
      } else {
        await browserApi.verifyBackupCode(normalized);
      }
      verified = true;
      setChallengeComplete(true);
    } catch (error) {
      setRequestError(challengeMessage(error));
    } finally {
      setSubmitting(false);
    }
    if (verified) await finishOnboarding();
  };

  if (challengeComplete) {
    return (
      <section className="form-card stack" aria-labelledby="challenge-complete-title">
        <p className={styles.step}>Secure sign-in complete</p>
        <h2 id="challenge-complete-title">
          {completionFailure === 'terminal-invitation'
            ? 'Invitation could not be accepted'
            : 'Finish workspace access'}
        </h2>
        {requestError ? (
          <div className="callout error" role="alert">
            {requestError}
          </div>
        ) : (
          <p aria-live="polite">Activating any invitation-ready workspace access…</p>
        )}
        {requestError &&
        (completionFailure === 'retryable-acceptance' ||
          completionFailure === 'retryable-activation') ? (
          <button disabled={submitting} onClick={() => void finishOnboarding()} type="button">
            {submitting
              ? 'Retrying…'
              : completionFailure === 'retryable-acceptance'
                ? 'Retry invitation acceptance'
                : 'Retry workspace activation'}
          </button>
        ) : null}
        {completionFailure === 'terminal-invitation' ? <SignOutButton /> : null}
      </section>
    );
  }

  return (
    <form className="form-card stack" noValidate onSubmit={submit}>
      <p className={styles.step}>Secure sign-in · Step 2 of 2</p>
      <h2>{mode === 'totp' ? 'Enter authenticator code' : 'Use a recovery code'}</h2>
      <FormErrorSummary errors={errors} />
      {requestError ? (
        <div className="callout error" role="alert">
          {requestError}
        </div>
      ) : null}
      <p>
        {mode === 'totp'
          ? 'Open your authenticator app and enter the current six-digit code.'
          : 'Enter one of the recovery codes saved during authenticator setup.'}
      </p>
      <div className="field">
        <label htmlFor="verification-code">
          {mode === 'totp' ? 'Six-digit authenticator code' : 'Recovery code'}
        </label>
        <input
          autoCapitalize="none"
          autoComplete={mode === 'totp' ? 'one-time-code' : 'off'}
          id="verification-code"
          inputMode={mode === 'totp' ? 'numeric' : 'text'}
          maxLength={mode === 'totp' ? 6 : 64}
          name="verification-code"
          pattern={mode === 'totp' ? '[0-9]*' : undefined}
          spellCheck={false}
          {...invalidProps('verification-code', errors)}
        />
        <FieldError errors={errors} field="verification-code" />
      </div>
      <button disabled={submitting} type="submit">
        {submitting ? 'Verifying…' : 'Verify and continue'}
      </button>
      <button
        className="secondary"
        disabled={submitting}
        onClick={() => {
          setMode((current) => (current === 'totp' ? 'recovery' : 'totp'));
          setErrors({});
          setRequestError(null);
        }}
        type="button"
      >
        {mode === 'totp' ? 'Use a recovery code' : 'Use authenticator code'}
      </button>
      <p className="meta">
        If neither option is available, contact your access administrator. Repeated failed attempts
        temporarily lock verification.
      </p>
    </form>
  );
}
