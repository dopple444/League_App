'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useRef, useState } from 'react';

import {
  ApiError,
  browserApi,
  createIdempotencyKey,
  type FieldErrors,
  getApiErrorMessage,
} from '../../lib/api-client';
import { consumeInvitationBearer, invitationFragmentHref } from '../../lib/invitation-bearer';
import { FieldError, FormErrorSummary, invalidProps } from '../form-feedback';
import { SignOutButton } from './sign-out-button';

const isTerminalInvitationFailure = (error: unknown): boolean =>
  error instanceof ApiError && [400, 401, 403, 404, 409, 410, 422].includes(error.status);

const validate = (email: string, password: string): FieldErrors => {
  const errors: Record<string, readonly string[]> = {};
  if (!email.trim() || !email.includes('@')) errors.email = ['Enter a valid email address.'];
  if (!password) errors.password = ['Enter your password.'];
  return errors;
};

export function SignInForm() {
  const router = useRouter();
  const [interactive, setInteractive] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [terminalInvitationFailure, setTerminalInvitationFailure] = useState(false);
  const invitationBearerRef = useRef<string | null>(null);
  const invitationAcceptanceKeyRef = useRef<string | null>(null);
  const bearerReadRef = useRef(false);

  useEffect(() => {
    setInteractive(true);
    if (bearerReadRef.current) return;
    bearerReadRef.current = true;
    invitationBearerRef.current = consumeInvitationBearer();
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    const nextErrors = validate(email, password);
    setErrors(nextErrors);
    setRequestError(null);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    let credentialsAccepted = false;
    try {
      const result = await browserApi.signIn(email, password);
      credentialsAccepted = true;
      if (result.twoFactorRedirect) {
        const invitationBearer = invitationBearerRef.current;
        router.replace(
          invitationBearer
            ? invitationFragmentHref('/auth/two-factor', invitationBearer)
            : '/auth/two-factor',
        );
      } else {
        const invitationBearer = invitationBearerRef.current;
        if (invitationBearer) {
          invitationAcceptanceKeyRef.current ??= createIdempotencyKey();
          await browserApi.acceptAdministratorInvitation(
            { invitationToken: invitationBearer },
            invitationAcceptanceKeyRef.current,
          );
          invitationBearerRef.current = null;
        }
        const posture = await browserApi.getSecurityPosture();
        router.replace(
          posture.mfaRequired && !posture.mfaEnabled ? '/auth/enroll-mfa' : '/admin/organizations',
        );
      }
      router.refresh();
    } catch (error) {
      if (!credentialsAccepted && error instanceof ApiError && error.status === 429) {
        setRequestError('Too many sign-in attempts. Wait a minute, then try again.');
      } else if (
        !credentialsAccepted &&
        error instanceof ApiError &&
        (error.status === 400 || error.status === 401)
      ) {
        setRequestError('The email or password was not recognized.');
      } else if (credentialsAccepted && invitationBearerRef.current && error instanceof ApiError) {
        if (isTerminalInvitationFailure(error)) {
          invitationBearerRef.current = null;
          setTerminalInvitationFailure(true);
          setRequestError(
            'This invitation could not be accepted for the signed-in account. Sign out, reopen the complete invitation link, and sign in with the issued administrator address. If it still cannot be used, request a new invitation.',
          );
        } else if (error.status === 429) {
          setRequestError('Too many invitation attempts. Wait a minute, then try again.');
        } else {
          setRequestError(getApiErrorMessage(error));
        }
      } else {
        setRequestError(getApiErrorMessage(error));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (terminalInvitationFailure) {
    return (
      <section aria-labelledby="invitation-failure-title" className="form-card stack">
        <h2 id="invitation-failure-title">Invitation could not be accepted</h2>
        {requestError ? (
          <div className="callout error" role="alert">
            {requestError}
          </div>
        ) : null}
        <SignOutButton />
      </section>
    );
  }

  return (
    <form className="form-card stack" noValidate onSubmit={submit}>
      <FormErrorSummary errors={errors} />
      {requestError ? (
        <div className="callout error" role="alert">
          {requestError}
        </div>
      ) : null}
      <div className="field">
        <label htmlFor="email">Email address</label>
        <input
          autoComplete="email"
          id="email"
          name="email"
          type="email"
          {...invalidProps('email', errors)}
        />
        <FieldError errors={errors} field="email" />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          autoComplete="current-password"
          id="password"
          name="password"
          type="password"
          {...invalidProps('password', errors)}
        />
        <FieldError errors={errors} field="password" />
      </div>
      <button disabled={!interactive || submitting} type="submit">
        {submitting ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="meta">
        Use only the account issued by your league. Contact an access administrator if you need
        help.
      </p>
    </form>
  );
}
