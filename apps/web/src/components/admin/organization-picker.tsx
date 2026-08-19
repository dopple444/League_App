'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ApiError, browserApi, type OrganizationSummary } from '../../lib/api-client';
import { EmptyState } from '../site-shell';

export function OrganizationPicker() {
  const router = useRouter();
  const [items, setItems] = useState<readonly OrganizationSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void browserApi
      .getOrganizations()
      .then((organizations) => {
        if (active) setItems(organizations);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        if (reason instanceof ApiError && reason.status === 401) {
          router.replace('/sign-in');
        } else {
          setError('We could not load your organizations. Please try again.');
        }
      });
    return () => {
      active = false;
    };
  }, [router]);

  if (error)
    return (
      <div className="callout error" role="alert">
        {error}
      </div>
    );
  if (!items) return <p aria-live="polite">Loading your organizations…</p>;
  if (!items.length)
    return (
      <EmptyState title="No organization access">
        <p>Ask your league access administrator to add your account.</p>
      </EmptyState>
    );

  return (
    <div className="grid">
      {items.map((organization) => (
        <article className="card" key={organization.organizationId}>
          <p className="eyebrow">Organization</p>
          <h2>{organization.name}</h2>
          <p className="muted">{organization.timezone}</p>
          <Link className="button" href={`/admin/${organization.organizationId}`}>
            Open administration
          </Link>
        </article>
      ))}
    </div>
  );
}
