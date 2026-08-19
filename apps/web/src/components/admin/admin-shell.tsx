'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { ApiError, browserApi, type OrganizationSummary } from '../../lib/api-client';
import { SignOutButton } from '../auth/sign-out-button';

export function AdminShell({
  organizationId,
  children,
}: {
  readonly organizationId: string;
  readonly children: ReactNode;
}) {
  const router = useRouter();
  const [organization, setOrganization] = useState<OrganizationSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void browserApi
      .getOrganizations()
      .then((items) => {
        if (!active) return;
        const match = items.find((item) => item.organizationId === organizationId);
        if (!match) {
          setError('You do not have access to this organization.');
          return;
        }
        setOrganization(match);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        if (reason instanceof ApiError && reason.status === 401) {
          router.replace('/sign-in');
          return;
        }
        setError('We could not verify your organization access.');
      });
    return () => {
      active = false;
    };
  }, [organizationId, router]);

  if (error) {
    return (
      <section className="empty-state" role="alert">
        <h1>Access unavailable</h1>
        <p>{error}</p>
        <Link className="button" href="/admin/organizations">
          Choose an organization
        </Link>
      </section>
    );
  }
  if (!organization) return <p aria-live="polite">Loading your organization…</p>;

  const basePath = `/admin/${organizationId}`;
  return (
    <div className="admin-layout">
      <aside className="admin-nav">
        <p className="eyebrow admin-eyebrow">Administration</p>
        <strong>{organization.name}</strong>
        <nav aria-label="Administration">
          <ul className="admin-nav-list">
            <li>
              <Link href={basePath}>Overview</Link>
            </li>
            <li>
              <Link href={`${basePath}/seasons`}>Seasons and teams</Link>
            </li>
            <li>
              <Link href={`${basePath}/audit`}>Audit history</Link>
            </li>
            <li>
              <Link href="/admin/organizations">Switch organization</Link>
            </li>
          </ul>
        </nav>
        <SignOutButton />
      </aside>
      <section>{children}</section>
    </div>
  );
}
