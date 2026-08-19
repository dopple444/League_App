'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { browserApi, type SeasonAdmin } from '../../lib/api-client';
import { EmptyState, StatusBadge } from '../site-shell';

export function SeasonList({ organizationId }: { readonly organizationId: string }) {
  const [seasons, setSeasons] = useState<readonly SeasonAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void browserApi
      .getSeasons(organizationId)
      .then((items) => {
        if (active) setSeasons(items);
      })
      .catch(() => {
        if (active) setError('We could not load seasons.');
      });
    return () => {
      active = false;
    };
  }, [organizationId]);

  if (error)
    return (
      <div className="callout error" role="alert">
        {error}
      </div>
    );
  if (!seasons) return <p aria-live="polite">Loading seasons…</p>;
  if (!seasons.length)
    return (
      <EmptyState
        title="Create your first season"
        action={
          <Link className="button" href={`/admin/${organizationId}/seasons/new`}>
            Create season
          </Link>
        }
      >
        <p>A season stays private until an authorized administrator publishes it.</p>
      </EmptyState>
    );

  return (
    <div className="grid">
      {seasons.map((season) => (
        <article className="card" key={season.seasonId}>
          <StatusBadge value={season.published ? 'published' : 'draft'} />
          <h2>{season.name}</h2>
          <p className="muted">
            {season.startDate} through {season.endDate}
          </p>
          <Link href={`/admin/${organizationId}/seasons/${season.seasonId}`}>
            Manage season and teams
          </Link>
        </article>
      ))}
    </div>
  );
}
