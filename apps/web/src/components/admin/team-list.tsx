'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { browserApi, type TeamAdmin } from '../../lib/api-client';
import { EmptyState, StatusBadge } from '../site-shell';

export function TeamList({
  organizationId,
  seasonId,
}: {
  readonly organizationId: string;
  readonly seasonId: string;
}) {
  const [teams, setTeams] = useState<readonly TeamAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void browserApi
      .getTeams(organizationId, seasonId)
      .then((items) => {
        if (active) setTeams(items);
      })
      .catch(() => {
        if (active) setError('We could not load teams.');
      });
    return () => {
      active = false;
    };
  }, [organizationId, seasonId]);
  if (error)
    return (
      <div className="callout error" role="alert">
        {error}
      </div>
    );
  if (!teams) return <p aria-live="polite">Loading teams…</p>;
  if (!teams.length)
    return (
      <EmptyState title="No teams yet">
        <p>Create a team to prove the private-to-public publication flow.</p>
      </EmptyState>
    );
  return (
    <div className="grid">
      {teams.map((team) => (
        <article className="card" key={team.teamSeasonId}>
          <StatusBadge value={team.published ? 'published' : 'draft'} />
          <h3>{team.name}</h3>
          <p className="muted">Public name: {team.publicName}</p>
          <Link href={`/admin/${organizationId}/seasons/${seasonId}/teams/${team.teamSeasonId}`}>
            Manage team
          </Link>
        </article>
      ))}
    </div>
  );
}
