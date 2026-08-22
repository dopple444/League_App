import Link from 'next/link';
import type { ReactNode } from 'react';

import { PublicLeagueNavigation } from './public-league-navigation';

type StatusClassName =
  | 'status-danger'
  | 'status-success'
  | 'status-info'
  | 'status-live'
  | 'status-official-final'
  | 'status-offline'
  | 'status-pending-sync'
  | 'status-neutral'
  | 'status-synchronizing'
  | 'status-workflow-pending'
  | 'status-warning';

const STATUS_CLASS_BY_VALUE: Readonly<Record<string, StatusClassName>> = {
  canceled: 'status-danger',
  error: 'status-danger',
  active: 'status-success',
  published: 'status-success',
  scheduled: 'status-info',
  live: 'status-live',
  final: 'status-official-final',
  official_final: 'status-official-final',
  'official-final': 'status-official-final',
  offline: 'status-offline',
  inactive: 'status-neutral',
  pending_sync: 'status-pending-sync',
  'pending-sync': 'status-pending-sync',
  synchronizing: 'status-synchronizing',
  workflow_pending: 'status-workflow-pending',
  'workflow-pending': 'status-workflow-pending',
  draft: 'status-neutral',
  postponed: 'status-warning',
};

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" href="/">
          <span aria-hidden="true" className="brand-mark">
            L
          </span>
          <span>League Hub</span>
        </Link>
        <PublicLeagueNavigation />
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="content-width">
        <p>League information is published by authorized league staff.</p>
      </div>
    </footer>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  readonly eyebrow?: string;
  readonly title: string;
  readonly description?: string;
  readonly actions?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p className="lede">{description}</p> : null}
      </div>
      {actions ? <div className="action-row">{actions}</div> : null}
    </div>
  );
}

export function StatusBadge({ value }: { readonly value: string }) {
  const normalized = value.trim().toLowerCase();
  const statusClass = STATUS_CLASS_BY_VALUE[normalized] ?? 'status-neutral';
  const label = ['final', 'official_final', 'official-final'].includes(normalized)
    ? 'Official Final'
    : normalized
      ? normalized.replaceAll(/[_-]+/g, ' ')
      : 'unknown';

  return <span className={`status ${statusClass}`}>{label}</span>;
}

export function EmptyState({
  title,
  children,
  action,
}: {
  readonly title: string;
  readonly children: ReactNode;
  readonly action?: ReactNode;
}) {
  return (
    <section className="empty-state">
      <h2>{title}</h2>
      <div className="muted">{children}</div>
      {action ? <div className="action-row empty-state-actions">{action}</div> : null}
    </section>
  );
}

export function ServiceUnavailable({ requestId }: { readonly requestId?: string }) {
  return (
    <section className="empty-state" role="alert">
      <p className="eyebrow">Temporarily unavailable</p>
      <h1>We could not load this page.</h1>
      <p>Please check your connection and try again. No changes were made.</p>
      {requestId ? <p className="meta">Support reference: {requestId}</p> : null}
    </section>
  );
}
