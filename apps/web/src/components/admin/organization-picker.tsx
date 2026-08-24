'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import {
  ApiError,
  browserApi,
  type OrganizationSummary,
  type SecurityPosture,
} from '../../lib/api-client';
import { SignOutButton } from '../auth/sign-out-button';
import { EmptyState, StatusBadge } from '../site-shell';

export function OrganizationPicker() {
  const router = useRouter();
  const [items, setItems] = useState<readonly OrganizationSummary[] | null>(null);
  const [posture, setPosture] = useState<SecurityPosture | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activationError, setActivationError] = useState<string | null>(null);

  const loadOrganizations = useCallback(async () => {
    setError(null);
    setActivationError(null);
    try {
      let security = await browserApi.getSecurityPosture();
      if (security.mfaRequired && !security.mfaEnabled) {
        router.replace('/auth/enroll-mfa');
        return;
      }
      if (security.pendingActivation && security.mfaEnabled) {
        try {
          await browserApi.activatePendingMemberships();
          security = await browserApi.getSecurityPosture();
        } catch {
          setActivationError(
            'Workspace activation could not be completed. Existing active workspaces remain available.',
          );
        }
      }
      const organizations = await browserApi.getOrganizations();
      setPosture(security);
      setItems(organizations);
    } catch (reason: unknown) {
      if (reason instanceof ApiError && reason.status === 401) {
        router.replace('/sign-in');
      } else {
        setError('We could not load your workspaces. Please try again.');
      }
    }
  }, [router]);

  useEffect(() => {
    void loadOrganizations();
  }, [loadOrganizations]);

  if (error)
    return (
      <div className="callout error stack" role="alert">
        <p>{error}</p>
        <button onClick={() => void loadOrganizations()} type="button">
          Retry loading workspaces
        </button>
      </div>
    );
  if (!items || !posture) return <p aria-live="polite">Loading your workspaces…</p>;

  const hasPlatformAccess = posture.platformAccess;
  const hasOrganizations = items.length > 0;

  if (!hasOrganizations && !hasPlatformAccess)
    return (
      <div className="stack">
        {activationError || posture.pendingActivation ? (
          <div className="callout error" role="alert">
            <p>
              {activationError ??
                'Your invitation was accepted, but workspace activation still requires attention.'}
            </p>
            <button onClick={() => void loadOrganizations()} type="button">
              Retry workspace activation
            </button>
          </div>
        ) : null}
        <EmptyState
          action={<SignOutButton />}
          title={posture.pendingActivation ? 'Workspace access is pending' : 'No workspace access'}
        >
          <p>
            {posture.pendingActivation
              ? 'Complete the required account-security step, then retry activation. Pending invitations are not shown here.'
              : 'Open the complete invitation link issued by an authorized platform operator, or contact that operator for help.'}
          </p>
          <p>
            Public sign-up and self-service league creation are disabled for the controlled beta.
          </p>
        </EmptyState>
      </div>
    );

  return (
    <div className="stack">
      {activationError ? (
        <div className="callout error" role="alert">
          <p>{activationError}</p>
          <button onClick={() => void loadOrganizations()} type="button">
            Retry workspace activation
          </button>
        </div>
      ) : null}
      <div className="grid">
        {hasPlatformAccess ? (
          <article className="card">
            <p className="eyebrow">Platform operations</p>
            <h2>Controlled-beta onboarding</h2>
            <StatusBadge value="active" />
            <p className="muted">
              Open the controlled-beta operations available to your separate Platform Operator
              authority.
            </p>
            <Link className="button" href="/platform/onboarding">
              Open platform operations
            </Link>
          </article>
        ) : null}
        {items.map((organization) => (
          <article className="card" key={organization.organizationId}>
            <p className="eyebrow">Customer organization</p>
            <h2>{organization.name}</h2>
            <p className="muted">{organization.timezone}</p>
            <Link className="button" href={`/admin/${organization.organizationId}`}>
              Open administration
            </Link>
          </article>
        ))}
      </div>
      <div className="action-row">
        <SignOutButton />
      </div>
    </div>
  );
}
