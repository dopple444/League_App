'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useRef, useState } from 'react';

import {
  ApiError,
  browserApi,
  type AdministratorInvitationContext,
  type FieldErrors,
} from '../../lib/api-client';
import { consumeInvitationBearer, invitationFragmentHref } from '../../lib/invitation-bearer';
import { FieldError, FormErrorSummary, invalidProps } from '../form-feedback';
import { StatusBadge } from '../site-shell';
import styles from './invitation-acceptance.module.css';

type InvitationPhase =
  | 'reading'
  | 'inspecting'
  | 'missing'
  | 'unavailable'
  | 'rate-limited'
  | 'service-unavailable'
  | 'ready'
  | 'registered';

const validateRegistration = (
  name: string,
  password: string,
  passwordConfirmation: string,
): FieldErrors => {
  const errors: Record<string, readonly string[]> = {};
  const normalizedName = name.trim();
  if (!normalizedName) errors.name = ['Enter your display name.'];
  else if (normalizedName.length > 120) errors.name = ['Use 120 characters or fewer.'];

  if (password.length < 12) errors.password = ['Use at least 12 characters.'];
  else if (password.length > 128) errors.password = ['Use 128 characters or fewer.'];
  if (!passwordConfirmation) errors['password-confirmation'] = ['Confirm your new password.'];
  else if (passwordConfirmation !== password)
    errors['password-confirmation'] = ['The passwords do not match.'];
  return errors;
};

const safeInspectionFailure = (error: unknown): InvitationPhase => {
  if (error instanceof ApiError && error.status === 429) return 'rate-limited';
  if (error instanceof ApiError && (error.status === 0 || error.status >= 500))
    return 'service-unavailable';
  return 'unavailable';
};

const safeRegistrationMessage = (error: unknown): string => {
  if (error instanceof ApiError && error.status === 429)
    return 'Too many attempts. Wait a minute, then try again.';
  if (error instanceof ApiError && (error.status === 0 || error.status >= 500))
    return 'The account service is unavailable. Check your connection and try again.';
  return 'This invitation can no longer create an account. Request a new invitation from the platform operator.';
};

const formattedExpiration = (expiresAt: string): string => {
  const date = new Date(expiresAt);
  return Number.isNaN(date.valueOf())
    ? 'Expiration unavailable'
    : new Intl.DateTimeFormat('en-US', {
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        month: 'short',
        timeZoneName: 'short',
        year: 'numeric',
      }).format(date);
};

export function InvitationAcceptance() {
  const router = useRouter();
  const [bearer, setBearer] = useState<string | null>(null);
  const [context, setContext] = useState<AdministratorInvitationContext | null>(null);
  const [phase, setPhase] = useState<InvitationPhase>('reading');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const bearerReadRef = useRef(false);
  const cardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (bearerReadRef.current) return;
    bearerReadRef.current = true;
    const invitationBearer = consumeInvitationBearer();
    if (!invitationBearer) {
      setPhase('missing');
      return;
    }
    setBearer(invitationBearer);
    setPhase('inspecting');
  }, []);

  useEffect(() => {
    if (!bearer || phase !== 'inspecting') return;
    let active = true;
    void browserApi
      .inspectAdministratorInvitation(bearer)
      .then((result) => {
        if (!active) return;
        setContext(result);
        setPhase('ready');
      })
      .catch((error: unknown) => {
        if (active) setPhase(safeInspectionFailure(error));
      });
    return () => {
      active = false;
    };
  }, [bearer, phase]);

  useEffect(() => {
    if (!focusRequest) return;
    cardRef.current?.querySelector<HTMLElement>('[role="alert"][tabindex]')?.focus();
  }, [focusRequest]);

  const continueToSignIn = () => {
    if (!bearer) return;
    router.replace(invitationFragmentHref('/sign-in', bearer));
  };

  const register = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!bearer || submitting) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const name = String(form.get('name') ?? '');
    const password = String(form.get('password') ?? '');
    const passwordConfirmation = String(form.get('password-confirmation') ?? '');
    const nextErrors = validateRegistration(name, password, passwordConfirmation);
    setErrors(nextErrors);
    setRequestError(null);
    if (Object.keys(nextErrors).length) {
      setFocusRequest((value) => value + 1);
      return;
    }

    setSubmitting(true);
    try {
      await browserApi.registerAdministratorInvitation({
        invitationToken: bearer,
        name: name.trim(),
        password,
      });
      formElement.reset();
      setErrors({});
      setPhase('registered');
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      setRequestError(safeRegistrationMessage(error));
      setFocusRequest((value) => value + 1);
    } finally {
      setSubmitting(false);
    }
  };

  if (phase === 'reading' || phase === 'inspecting') {
    return <p aria-live="polite">Checking your invitation…</p>;
  }

  if (phase === 'missing') {
    return (
      <section className="form-card stack" role="alert">
        <h2>Invitation link required</h2>
        <p>Open the complete invitation link supplied by the authorized platform operator.</p>
        <p className="meta">Public account creation and self-service league setup are disabled.</p>
      </section>
    );
  }

  if (phase === 'unavailable') {
    return (
      <section className="form-card stack" role="alert">
        <h2>Invitation unavailable</h2>
        <p>
          This invitation cannot be used. It may have expired, been revoked, or already been used.
        </p>
        <p className="meta">Request a new invitation from the authorized platform operator.</p>
      </section>
    );
  }

  if (phase === 'rate-limited' || phase === 'service-unavailable') {
    return (
      <section className="form-card stack" role="alert">
        <h2>
          {phase === 'rate-limited'
            ? 'Invitation check temporarily limited'
            : 'Invitation service unavailable'}
        </h2>
        <p>
          {phase === 'rate-limited'
            ? 'Wait a minute, then retry. The invitation remains only in this page memory.'
            : 'Check your connection and try again. The invitation remains only in this page memory.'}
        </p>
        <button onClick={() => setPhase('inspecting')} type="button">
          Retry invitation check
        </button>
      </section>
    );
  }

  if (!context || !bearer) return null;

  return (
    <section className="form-card stack" ref={cardRef}>
      <section aria-labelledby="invitation-context-title" className={styles.context}>
        <div>
          <StatusBadge value={phase === 'registered' ? 'workflow_pending' : 'pending'} />
          <h2 id="invitation-context-title">Verified invitation context</h2>
          <p className="muted">Only the issued administrator address can accept this access.</p>
        </div>
        <dl className={styles.contextGrid}>
          <div>
            <dt>Organization</dt>
            <dd>{context.organizationName}</dd>
          </div>
          <div>
            <dt>Initial league</dt>
            <dd>{context.leagueName}</dd>
          </div>
          <div>
            <dt>Invited address</dt>
            <dd>{context.administratorEmailHint}</dd>
          </div>
          <div>
            <dt>Expires</dt>
            <dd>
              <time dateTime={context.expiresAt}>{formattedExpiration(context.expiresAt)}</time>
            </dd>
          </div>
        </dl>
      </section>

      {phase === 'registered' ? (
        <div className="stack">
          <div className="callout" role="status">
            Account setup is ready. Sign in with the issued address to accept the invitation. MFA is
            required before organization access becomes active.
          </div>
          <button onClick={continueToSignIn} type="button">
            Continue to staff sign in
          </button>
        </div>
      ) : (
        <form className="stack" noValidate onSubmit={register}>
          <div className={styles.formHeading}>
            <h2>Create your issued account</h2>
            <p className="muted">
              Already have an account for the invited address? Continue to sign in instead.
            </p>
          </div>
          <FormErrorSummary errors={errors} />
          {requestError ? (
            <div className="callout error" role="alert" tabIndex={-1}>
              {requestError}
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="name">Display name (required)</label>
            <input
              autoComplete="name"
              id="name"
              maxLength={120}
              name="name"
              required
              {...invalidProps('name', errors)}
            />
            <FieldError errors={errors} field="name" />
          </div>
          <div className="field">
            <label htmlFor="password">Create password (required)</label>
            <p className="meta" id="password-help">
              Use from 12 through 128 characters. Password managers and paste are supported.
            </p>
            <input
              aria-describedby={
                errors.password?.length ? 'password-help password-error' : 'password-help'
              }
              aria-invalid={errors.password?.length ? true : undefined}
              autoComplete="new-password"
              id="password"
              maxLength={128}
              minLength={12}
              name="password"
              required
              type="password"
            />
            <FieldError errors={errors} field="password" />
          </div>
          <div className="field">
            <label htmlFor="password-confirmation">Confirm password (required)</label>
            <input
              autoComplete="new-password"
              id="password-confirmation"
              maxLength={128}
              minLength={12}
              name="password-confirmation"
              required
              type="password"
              {...invalidProps('password-confirmation', errors)}
            />
            <FieldError errors={errors} field="password-confirmation" />
          </div>
          <div className={styles.actions}>
            <button disabled={submitting} type="submit">
              {submitting ? 'Creating account…' : 'Create account and continue'}
            </button>
            <button
              className="secondary"
              disabled={submitting}
              onClick={continueToSignIn}
              type="button"
            >
              I already have an issued account
            </button>
          </div>
          <p className="meta">
            Creating an account does not activate organization access. Sign in and complete MFA to
            finish.
          </p>
        </form>
      )}
    </section>
  );
}
