'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  ApiError,
  browserApi,
  createIdempotencyKey,
  type FieldErrors,
  type PlatformOnboarding,
  type ProvisionPlatformOnboardingInput,
  type ProvisionPlatformOnboardingResult,
} from '../../lib/api-client';
import { invitationFragmentHref } from '../../lib/invitation-bearer';
import { SignOutButton } from '../auth/sign-out-button';
import { FieldError, FormErrorSummary, invalidProps } from '../form-feedback';
import { EmptyState, PageHeading, StatusBadge } from '../site-shell';
import styles from './onboarding-workbench.module.css';

interface ProvisionFormValues {
  readonly organizationName: string;
  readonly organizationSlug: string;
  readonly timezone: string;
  readonly leagueName: string;
  readonly leagueSlug: string;
  readonly administratorEmail: string;
  readonly invitationExpiresInHours: string;
  readonly reason: string;
}

interface MutationAttempt {
  readonly fingerprint: string;
  readonly idempotencyKey: string;
}

type WorkbenchState = 'loading' | 'ready' | 'denied' | 'error';
type ProvisionStep = 'edit' | 'review';

interface PlatformCapabilities {
  readonly canProvisionTenants: boolean;
  readonly canRevokeInvitations: boolean;
}

const noPlatformCapabilities: PlatformCapabilities = {
  canProvisionTenants: false,
  canRevokeInvitations: false,
};

const initialValues: ProvisionFormValues = {
  organizationName: '',
  organizationSlug: '',
  timezone: 'America/New_York',
  leagueName: '',
  leagueSlug: '',
  administratorEmail: '',
  invitationExpiresInHours: '168',
  reason: '',
};

const slugError = (slug: string, label: string): string | null => {
  if (!slug) return `Enter the ${label} URL name.`;
  if (slug.length < 2 || slug.length > 80) return 'Use from 2 through 80 characters.';
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug)
    ? null
    : 'Use lowercase letters, numbers, and single hyphens; begin and end with a letter or number.';
};

const isTimeZone = (value: string): boolean => {
  try {
    void new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
};

const validateProvision = (values: ProvisionFormValues): FieldErrors => {
  const errors: Record<string, readonly string[]> = {};
  const organizationName = values.organizationName.trim();
  const organizationSlug = values.organizationSlug.trim();
  const timezone = values.timezone.trim();
  const leagueName = values.leagueName.trim();
  const leagueSlug = values.leagueSlug.trim();
  const administratorEmail = values.administratorEmail.trim();
  const expirationHours = Number(values.invitationExpiresInHours);
  const reason = values.reason.trim();

  if (!organizationName) errors.organizationName = ['Enter an organization name.'];
  else if (organizationName.length > 160)
    errors.organizationName = ['Use 160 characters or fewer.'];
  const organizationSlugError = slugError(organizationSlug, 'organization');
  if (organizationSlugError) errors.organizationSlug = [organizationSlugError];
  if (!timezone) errors.timezone = ['Enter an IANA timezone.'];
  else if (timezone.length > 64 || !isTimeZone(timezone))
    errors.timezone = ['Enter a valid IANA timezone, such as America/New_York.'];
  if (!leagueName) errors.leagueName = ['Enter an initial league name.'];
  else if (leagueName.length > 160) errors.leagueName = ['Use 160 characters or fewer.'];
  const leagueSlugError = slugError(leagueSlug, 'league');
  if (leagueSlugError) errors.leagueSlug = [leagueSlugError];
  if (!administratorEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(administratorEmail))
    errors.administratorEmail = ['Enter a valid administrator email address.'];
  else if (administratorEmail.length > 254)
    errors.administratorEmail = ['Use 254 characters or fewer.'];
  if (!Number.isInteger(expirationHours) || expirationHours < 1 || expirationHours > 720)
    errors.invitationExpiresInHours = ['Use a whole number from 1 through 720 hours.'];
  if (!reason) errors.reason = ['Enter the operational reason for this provisioning action.'];
  else if (reason.length > 500) errors.reason = ['Use 500 characters or fewer.'];
  return errors;
};

const provisionInput = (values: ProvisionFormValues): ProvisionPlatformOnboardingInput => ({
  organizationName: values.organizationName.trim(),
  organizationSlug: values.organizationSlug.trim(),
  timezone: values.timezone.trim(),
  leagueName: values.leagueName.trim(),
  leagueSlug: values.leagueSlug.trim(),
  administratorEmail: values.administratorEmail.trim().toLowerCase(),
  invitationExpiresInHours: Number(values.invitationExpiresInHours),
  reason: values.reason.trim(),
});

const mutationMessage = (error: unknown): string => {
  if (error instanceof ApiError && error.code === 'MFA_ENROLLMENT_REQUIRED')
    return 'Verified MFA is required before platform provisioning.';
  if (error instanceof ApiError && [401, 403].includes(error.status))
    return 'Your account is not authorized to provision controlled-beta customers.';
  if (error instanceof ApiError && error.status === 409)
    return error.code === 'IDEMPOTENCY_CONFLICT'
      ? 'This retry key was already used with different values. Review the form and submit again.'
      : 'That organization or league URL name is already in use. Choose a different URL name.';
  if (error instanceof ApiError && error.status === 429)
    return 'Too many platform changes were attempted. Wait a minute, then retry.';
  if (error instanceof ApiError && error.status === 0)
    return 'The connection ended before the result was known. Retry without changing the values to safely check the same operation.';
  return 'The customer foundation could not be provisioned. Your entries were retained.';
};

const revokeMessage = (error: unknown): string => {
  if (error instanceof ApiError && [401, 403].includes(error.status))
    return 'Your account is not authorized to revoke this invitation.';
  if (error instanceof ApiError && [404, 409, 410].includes(error.status))
    return 'This invitation is no longer pending or changed elsewhere. Refresh the ledger.';
  if (error instanceof ApiError && error.status === 0)
    return 'The connection ended before the result was known. Retry the unchanged revocation safely.';
  return 'The invitation could not be revoked. No other invitation was changed.';
};

const formatTimestamp = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? 'Unavailable'
    : new Intl.DateTimeFormat('en-US', {
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        month: 'short',
        timeZoneName: 'short',
        year: 'numeric',
      }).format(date);
};

const statusLabel = (status: PlatformOnboarding['status']): string =>
  status === 'ACCEPTED_PENDING_MFA' ? 'Accepted — pending MFA' : status.replaceAll('_', ' ');

function ProvisionTask({
  onCancel,
  onProvisioned,
}: {
  readonly onCancel: () => void;
  readonly onProvisioned: (result: ProvisionPlatformOnboardingResult) => void;
}) {
  const [values, setValues] = useState(initialValues);
  const [step, setStep] = useState<ProvisionStep>('edit');
  const [attempted, setAttempted] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const taskRef = useRef<HTMLElement>(null);
  const pendingRef = useRef(false);
  const mutationAttemptRef = useRef<MutationAttempt | null>(null);
  const input = useMemo(() => provisionInput(values), [values]);

  useEffect(() => {
    if (attempted && step === 'edit') setErrors(validateProvision(values));
  }, [attempted, step, values]);

  useEffect(() => {
    if (!focusRequest) return;
    taskRef.current?.querySelector<HTMLElement>('[role="alert"][tabindex]')?.focus();
  }, [focusRequest]);

  const update = <Key extends keyof ProvisionFormValues>(
    key: Key,
    value: ProvisionFormValues[Key],
  ) => {
    setValues((current) => ({ ...current, [key]: value }));
    setRequestError(null);
  };

  const review = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateProvision(values);
    setAttempted(true);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setFocusRequest((value) => value + 1);
      return;
    }
    setStep('review');
    queueMicrotask(() => taskRef.current?.querySelector<HTMLElement>('h2')?.focus());
  };

  const confirm = async () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setSubmitting(true);
    setRequestError(null);
    const fingerprint = JSON.stringify(input);
    if (mutationAttemptRef.current?.fingerprint !== fingerprint) {
      mutationAttemptRef.current = { fingerprint, idempotencyKey: createIdempotencyKey() };
    }
    try {
      const result = await browserApi.provisionTenant(
        input,
        mutationAttemptRef.current.idempotencyKey,
      );
      onProvisioned(result);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) {
        setErrors(error.fieldErrors);
        setStep('edit');
      }
      setRequestError(mutationMessage(error));
      setFocusRequest((value) => value + 1);
    } finally {
      pendingRef.current = false;
      setSubmitting(false);
    }
  };

  const plannedExpiration = new Date(
    Date.now() + input.invitationExpiresInHours * 60 * 60 * 1_000,
  ).toISOString();

  return (
    <section
      aria-labelledby="provision-task-title"
      className={`form-card ${styles.taskPanel}`}
      ref={taskRef}
    >
      <div className={styles.taskHeader}>
        <div>
          <p className="eyebrow">Platform operator task</p>
          <h2 id="provision-task-title" tabIndex={-1}>
            {step === 'edit' ? 'Provision customer' : 'Review customer foundation'}
          </h2>
        </div>
        <button className="secondary" disabled={submitting} onClick={onCancel} type="button">
          Cancel
        </button>
      </div>

      {requestError ? (
        <div className="callout error" role="alert" tabIndex={-1}>
          {requestError}
        </div>
      ) : null}

      {step === 'review' ? (
        <div className="stack">
          <div className="callout" role="status">
            Confirm this exact controlled-beta customer foundation. The action is attributable and
            audited; the operator does not become a customer member.
          </div>
          <dl className={styles.reviewList}>
            <div>
              <dt>Organization</dt>
              <dd>
                {input.organizationName} · {input.organizationSlug}
              </dd>
            </div>
            <div>
              <dt>Timezone</dt>
              <dd>{input.timezone}</dd>
            </div>
            <div>
              <dt>Initial league</dt>
              <dd>
                {input.leagueName} · {input.leagueSlug}
              </dd>
            </div>
            <div>
              <dt>Invited administrator</dt>
              <dd>{input.administratorEmail}</dd>
            </div>
            <div>
              <dt>Planned expiration</dt>
              <dd>{formatTimestamp(plannedExpiration)}</dd>
            </div>
            <div>
              <dt>Audit reason</dt>
              <dd>{input.reason}</dd>
            </div>
          </dl>
          <div className={styles.actions}>
            <button disabled={submitting} onClick={() => void confirm()} type="button">
              {submitting ? 'Provisioning…' : 'Confirm and provision customer'}
            </button>
            <button
              className="secondary"
              disabled={submitting}
              onClick={() => setStep('edit')}
              type="button"
            >
              Edit details
            </button>
          </div>
        </div>
      ) : (
        <form className="stack" noValidate onSubmit={review}>
          <p className="meta">All fields are required. URL names use lowercase kebab-case.</p>
          <FormErrorSummary errors={errors} />
          <div className="form-grid">
            <div className="field">
              <label htmlFor="organizationName">Organization name (required)</label>
              <input
                autoComplete="organization"
                autoFocus
                id="organizationName"
                maxLength={160}
                name="organizationName"
                onChange={(event) => update('organizationName', event.currentTarget.value)}
                required
                value={values.organizationName}
                {...invalidProps('organizationName', errors)}
              />
              <FieldError errors={errors} field="organizationName" />
            </div>
            <div className="field">
              <label htmlFor="organizationSlug">Organization URL name (required)</label>
              <p className={styles.helper} id="organizationSlug-help">
                Example: county-recreation
              </p>
              <input
                aria-describedby={
                  errors.organizationSlug?.length
                    ? 'organizationSlug-help organizationSlug-error'
                    : 'organizationSlug-help'
                }
                aria-invalid={errors.organizationSlug?.length ? true : undefined}
                autoCapitalize="none"
                autoComplete="off"
                id="organizationSlug"
                maxLength={80}
                name="organizationSlug"
                onChange={(event) => update('organizationSlug', event.currentTarget.value)}
                required
                spellCheck={false}
                value={values.organizationSlug}
              />
              <FieldError errors={errors} field="organizationSlug" />
            </div>
            <div className="field">
              <label htmlFor="timezone">IANA timezone (required)</label>
              <p className={styles.helper} id="timezone-help">
                Example: America/New_York
              </p>
              <input
                aria-describedby={
                  errors.timezone?.length ? 'timezone-help timezone-error' : 'timezone-help'
                }
                aria-invalid={errors.timezone?.length ? true : undefined}
                autoCapitalize="none"
                autoComplete="off"
                id="timezone"
                maxLength={64}
                name="timezone"
                onChange={(event) => update('timezone', event.currentTarget.value)}
                required
                spellCheck={false}
                value={values.timezone}
              />
              <FieldError errors={errors} field="timezone" />
            </div>
            <div className="field">
              <label htmlFor="leagueName">Initial league name (required)</label>
              <input
                id="leagueName"
                maxLength={160}
                name="leagueName"
                onChange={(event) => update('leagueName', event.currentTarget.value)}
                required
                value={values.leagueName}
                {...invalidProps('leagueName', errors)}
              />
              <FieldError errors={errors} field="leagueName" />
            </div>
            <div className="field">
              <label htmlFor="leagueSlug">League URL name (required)</label>
              <p className={styles.helper} id="leagueSlug-help">
                Example: spring-softball
              </p>
              <input
                aria-describedby={
                  errors.leagueSlug?.length ? 'leagueSlug-help leagueSlug-error' : 'leagueSlug-help'
                }
                aria-invalid={errors.leagueSlug?.length ? true : undefined}
                autoCapitalize="none"
                autoComplete="off"
                id="leagueSlug"
                maxLength={80}
                name="leagueSlug"
                onChange={(event) => update('leagueSlug', event.currentTarget.value)}
                required
                spellCheck={false}
                value={values.leagueSlug}
              />
              <FieldError errors={errors} field="leagueSlug" />
            </div>
            <div className="field">
              <label htmlFor="administratorEmail">Administrator email (required)</label>
              <input
                autoCapitalize="none"
                autoComplete="email"
                id="administratorEmail"
                maxLength={254}
                name="administratorEmail"
                onChange={(event) => update('administratorEmail', event.currentTarget.value)}
                required
                spellCheck={false}
                type="email"
                value={values.administratorEmail}
                {...invalidProps('administratorEmail', errors)}
              />
              <FieldError errors={errors} field="administratorEmail" />
            </div>
            <div className="field">
              <label htmlFor="invitationExpiresInHours">
                Invitation lifetime in hours (required)
              </label>
              <p className={styles.helper} id="invitationExpiresInHours-help">
                Use a whole number from 1 through 720 hours.
              </p>
              <input
                aria-describedby={
                  errors.invitationExpiresInHours?.length
                    ? 'invitationExpiresInHours-help invitationExpiresInHours-error'
                    : 'invitationExpiresInHours-help'
                }
                aria-invalid={errors.invitationExpiresInHours?.length ? true : undefined}
                id="invitationExpiresInHours"
                inputMode="numeric"
                max={720}
                min={1}
                name="invitationExpiresInHours"
                onChange={(event) => update('invitationExpiresInHours', event.currentTarget.value)}
                required
                step={1}
                type="number"
                value={values.invitationExpiresInHours}
              />
              <FieldError errors={errors} field="invitationExpiresInHours" />
            </div>
            <div className="field span-full">
              <label htmlFor="reason">Operational reason (required)</label>
              <p className={styles.helper} id="reason-help">
                This reason is recorded in attributable platform audit history.
              </p>
              <textarea
                aria-describedby={
                  errors.reason?.length ? 'reason-help reason-error' : 'reason-help'
                }
                aria-invalid={errors.reason?.length ? true : undefined}
                id="reason"
                maxLength={500}
                name="reason"
                onChange={(event) => update('reason', event.currentTarget.value)}
                required
                rows={4}
                value={values.reason}
              />
              <FieldError errors={errors} field="reason" />
            </div>
          </div>
          <div className={styles.actions}>
            <button disabled={submitting} type="submit">
              Review customer foundation
            </button>
            <button className="secondary" disabled={submitting} onClick={onCancel} type="button">
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function InvitationLedgerCard({
  canRevokeInvitations,
  item,
  onRevoked,
}: {
  readonly canRevokeInvitations: boolean;
  readonly item: PlatformOnboarding;
  readonly onRevoked: (updated: PlatformOnboarding) => void;
}) {
  const [revoking, setRevoking] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonErrors, setReasonErrors] = useState<FieldErrors>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const attemptRef = useRef<MutationAttempt | null>(null);
  const revokeFormRef = useRef<HTMLFormElement>(null);
  const titleId = `onboarding-${item.invitationId}-title`;
  const reasonFieldId = `revoke-reason-${item.invitationId}`;

  useEffect(() => {
    if (!focusRequest) return;
    revokeFormRef.current?.querySelector<HTMLElement>('[role="alert"][tabindex]')?.focus();
  }, [focusRequest]);

  const revoke = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedReason = reason.trim();
    if (!normalizedReason || normalizedReason.length > 500) {
      setReasonErrors({
        [reasonFieldId]: [
          normalizedReason ? 'Use 500 characters or fewer.' : 'Enter a revocation reason.',
        ],
      });
      setFocusRequest((value) => value + 1);
      return;
    }
    const input = { expectedVersion: item.version, reason: normalizedReason };
    const fingerprint = JSON.stringify(input);
    if (attemptRef.current?.fingerprint !== fingerprint)
      attemptRef.current = { fingerprint, idempotencyKey: createIdempotencyKey() };
    setSubmitting(true);
    setRequestError(null);
    try {
      const updated = await browserApi.revokeAdministratorInvitation(
        item.invitationId,
        input,
        attemptRef.current.idempotencyKey,
      );
      onRevoked(updated);
      setRevoking(false);
    } catch (error) {
      setRequestError(revokeMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <article aria-labelledby={titleId} className={styles.ledgerCard}>
      <div className={styles.cardHeader}>
        <div className={styles.identity}>
          <h3 id={titleId}>{item.organizationName}</h3>
          <p>
            {item.leagueName} ·{' '}
            <code>
              {item.organizationSlug}/{item.leagueSlug}
            </code>
          </p>
        </div>
        <StatusBadge value={item.status} />
      </div>
      <div className={styles.metaGrid}>
        <div>
          <span>Administrator</span>
          <strong>{item.administratorEmail}</strong>
        </div>
        <div>
          <span>Status</span>
          <strong>{statusLabel(item.status)}</strong>
        </div>
        <div>
          <span>Expires</span>
          <time dateTime={item.expiresAt}>{formatTimestamp(item.expiresAt)}</time>
        </div>
      </div>
      {canRevokeInvitations && item.status === 'PENDING' ? (
        revoking ? (
          <form className={styles.revokePanel} noValidate onSubmit={revoke} ref={revokeFormRef}>
            {requestError ? (
              <div className="callout error" role="alert">
                {requestError}
              </div>
            ) : null}
            <FormErrorSummary errors={reasonErrors} />
            <div className="field">
              <label htmlFor={reasonFieldId}>Revocation reason (required)</label>
              <textarea
                id={reasonFieldId}
                maxLength={500}
                onChange={(event) => {
                  setReason(event.currentTarget.value);
                  setReasonErrors({});
                  setRequestError(null);
                }}
                required
                rows={3}
                value={reason}
                {...invalidProps(reasonFieldId, reasonErrors)}
              />
              <FieldError errors={reasonErrors} field={reasonFieldId} />
            </div>
            <p className="meta">
              Revocation is audited and permanently prevents this invitation from being accepted.
            </p>
            <div className={styles.actions}>
              <button className="danger" disabled={submitting} type="submit">
                {submitting ? 'Revoking…' : 'Confirm revocation'}
              </button>
              <button
                className="secondary"
                disabled={submitting}
                onClick={() => {
                  setRevoking(false);
                  setReason('');
                  setReasonErrors({});
                  setRequestError(null);
                }}
                type="button"
              >
                Keep invitation
              </button>
            </div>
          </form>
        ) : (
          <div className={styles.actions}>
            <button className="danger" onClick={() => setRevoking(true)} type="button">
              Revoke invitation
            </button>
          </div>
        )
      ) : null}
    </article>
  );
}

export function OnboardingWorkbench() {
  const router = useRouter();
  const [state, setState] = useState<WorkbenchState>('loading');
  const [items, setItems] = useState<readonly PlatformOnboarding[]>([]);
  const [capabilities, setCapabilities] = useState<PlatformCapabilities>(noPlatformCapabilities);
  const [taskOpen, setTaskOpen] = useState(false);
  const [receipt, setReceipt] = useState<ProvisionPlatformOnboardingResult | null>(null);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const provisionTriggerRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const posture = await browserApi.getSecurityPosture();
      if (posture.mfaRequired && !posture.mfaEnabled) {
        router.replace('/auth/enroll-mfa');
        return;
      }
      if (!posture.platformAccess) {
        setState('denied');
        return;
      }
      const result = await browserApi.listPlatformOnboarding();
      setCapabilities({
        canProvisionTenants: result.canProvisionTenants,
        canRevokeInvitations: result.canRevokeInvitations,
      });
      setItems(result.items);
      setState('ready');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace('/sign-in');
        return;
      }
      if (error instanceof ApiError && error.status === 403) {
        setState('denied');
        return;
      }
      setState('error');
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const invitationUrl = receipt
    ? new URL(
        invitationFragmentHref('/auth/accept-invite', receipt.invitationToken),
        typeof window === 'undefined' ? 'http://localhost' : window.location.origin,
      ).toString()
    : null;

  const provisioned = (result: ProvisionPlatformOnboardingResult) => {
    const { invitationToken, ...ledgerItem } = result;
    void invitationToken;
    setItems((current) => [
      ledgerItem,
      ...current.filter((item) => item.invitationId !== result.invitationId),
    ]);
    setReceipt(result);
    setTaskOpen(false);
    setAnnouncement(`${result.organizationName} was provisioned with a pending invitation.`);
    setCopyStatus(null);
  };

  const copyInvitation = async () => {
    if (!invitationUrl) return;
    try {
      await navigator.clipboard.writeText(invitationUrl);
      setCopyStatus('Invitation link copied. Share it only with the issued administrator.');
    } catch {
      setCopyStatus(
        'Automatic copy was unavailable. Select and copy the invitation link manually.',
      );
    }
  };

  const dismissReceipt = () => {
    setReceipt(null);
    setCopyStatus('The copy-once invitation link was cleared from this page.');
    queueMicrotask(() => provisionTriggerRef.current?.focus());
  };

  const replaceItem = (updated: PlatformOnboarding) => {
    setItems((current) =>
      current.map((item) => (item.invitationId === updated.invitationId ? updated : item)),
    );
    setAnnouncement(`The invitation for ${updated.organizationName} was revoked.`);
  };

  if (state === 'loading') return <p aria-live="polite">Verifying platform access…</p>;
  if (state === 'denied') {
    return (
      <section className="empty-state" role="alert">
        <h1>Platform access unavailable</h1>
        <p>
          A separately authorized Platform Operator grant and verified MFA are required. Customer
          organization roles do not grant this access.
        </p>
        <div className="action-row empty-state-actions">
          <button onClick={() => router.replace('/admin/organizations')} type="button">
            Return to workspaces
          </button>
          <SignOutButton />
        </div>
      </section>
    );
  }
  if (state === 'error') {
    return (
      <section className="empty-state" role="alert">
        <h1>Platform operations unavailable</h1>
        <p>Check your connection and try again. No customer foundation was changed.</p>
        <button onClick={() => void load()} type="button">
          Try again
        </button>
      </section>
    );
  }

  return (
    <div className={styles.workbench}>
      <header className={styles.workspaceHeader}>
        <div>
          <p className={`eyebrow ${styles.operatorEyebrow}`}>Separate platform authority</p>
          <strong>Platform operations</strong>
        </div>
        <StatusBadge value="mfa_protected" />
      </header>
      <div className="callout" role="note">
        Controlled beta · synthetic/practice data only. Provisioning does not make the operator a
        member of the customer organization. Real delivery and public hosting remain disabled.
      </div>
      <PageHeading
        actions={
          capabilities.canProvisionTenants ? (
            <button
              disabled={taskOpen || receipt !== null}
              onClick={() => {
                setTaskOpen(true);
                setAnnouncement(null);
              }}
              ref={provisionTriggerRef}
              type="button"
            >
              Provision customer
            </button>
          ) : null
        }
        description="Create an organization, its initial league, and one MFA-gated administrator invitation as a single audited operation."
        eyebrow="Controlled-beta onboarding"
        title="Customer foundations"
      />

      {announcement ? (
        <div className="callout" role="status">
          {announcement}
        </div>
      ) : null}

      {taskOpen ? (
        <ProvisionTask
          onCancel={() => {
            setTaskOpen(false);
            queueMicrotask(() => provisionTriggerRef.current?.focus());
          }}
          onProvisioned={provisioned}
        />
      ) : null}

      {receipt && invitationUrl ? (
        <section
          aria-labelledby="provision-receipt-title"
          className={`form-card ${styles.receipt}`}
        >
          <div className="stack">
            <p className="eyebrow">Provisioning receipt</p>
            <h2 id="provision-receipt-title">Copy the invitation link now</h2>
            <p>
              This synthetic handoff is displayed only in this page state. It cannot be recovered
              from the ledger after it is cleared.
            </p>
            <div className={styles.handoff}>
              <label htmlFor="invitation-handoff">Copy-once administrator invitation</label>
              <output id="invitation-handoff">{invitationUrl}</output>
              <div className={styles.actions}>
                <button onClick={() => void copyInvitation()} type="button">
                  Copy invitation link
                </button>
                <button className="secondary" onClick={dismissReceipt} type="button">
                  I saved the link — clear it
                </button>
              </div>
            </div>
            {copyStatus ? <p role="status">{copyStatus}</p> : null}
            <dl className={styles.reviewList}>
              <div>
                <dt>Organization ID</dt>
                <dd>{receipt.organizationId}</dd>
              </div>
              <div>
                <dt>League ID</dt>
                <dd>{receipt.leagueId}</dd>
              </div>
              <div>
                <dt>Invitation ID</dt>
                <dd>{receipt.invitationId}</dd>
              </div>
              <div>
                <dt>Expires</dt>
                <dd>{formatTimestamp(receipt.expiresAt)}</dd>
              </div>
            </dl>
          </div>
        </section>
      ) : copyStatus ? (
        <div className="callout" role="status">
          {copyStatus}
        </div>
      ) : null}

      <section aria-labelledby="invitation-ledger-title" className={styles.ledger}>
        <div className={styles.ledgerHeader}>
          <div>
            <h2 id="invitation-ledger-title">Invitation ledger</h2>
            <p className="muted">Bearer values are never returned by this list.</p>
          </div>
          <button className="secondary" onClick={() => void load()} type="button">
            Refresh ledger
          </button>
        </div>
        {items.length === 0 ? (
          <EmptyState title="No controlled-beta customers yet">
            <p>
              {capabilities.canProvisionTenants
                ? 'Provision the first synthetic customer when its beta access is authorized.'
                : 'No customer invitations are currently available for review or revocation.'}
            </p>
          </EmptyState>
        ) : (
          <ul className={styles.ledgerList}>
            {[...items]
              .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
              .map((item) => (
                <li key={item.invitationId}>
                  <InvitationLedgerCard
                    canRevokeInvitations={capabilities.canRevokeInvitations}
                    item={item}
                    onRevoked={replaceItem}
                  />
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}
