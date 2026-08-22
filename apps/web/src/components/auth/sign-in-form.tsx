'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import { ApiError, browserApi, type FieldErrors, getApiErrorMessage } from '../../lib/api-client';
import { FieldError, FormErrorSummary, invalidProps } from '../form-feedback';

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

  useEffect(() => setInteractive(true), []);

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
    try {
      const result = await browserApi.signIn(email, password);
      if (result.twoFactorRedirect) {
        router.replace('/auth/two-factor');
      } else {
        const posture = await browserApi.getSecurityPosture();
        router.replace(
          posture.mfaRequired && !posture.mfaEnabled ? '/auth/enroll-mfa' : '/admin/organizations',
        );
      }
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        setRequestError('Too many sign-in attempts. Wait a minute, then try again.');
      } else if (error instanceof ApiError && (error.status === 400 || error.status === 401)) {
        setRequestError('The email or password was not recognized.');
      } else {
        setRequestError(getApiErrorMessage(error));
      }
    } finally {
      setSubmitting(false);
    }
  };

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
