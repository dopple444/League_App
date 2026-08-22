import Link from 'next/link';

import { PageHeading } from '../../../components/site-shell';

export default async function AdminOverviewPage({
  params,
}: {
  readonly params: Promise<{ readonly organizationId: string }>;
}) {
  const { organizationId } = await params;
  return (
    <>
      <PageHeading
        eyebrow="League operations"
        title="Overview"
        description="Create the season and teams, review them, then publish only approved public details."
      />
      <div className="grid">
        <article className="card">
          <h2>Leagues</h2>
          <p className="muted">Manage league names, public URL names, and active status.</p>
          <Link className="button" href={`/admin/${organizationId}/leagues`}>
            Manage leagues
          </Link>
        </article>
        <article className="card">
          <h2>Seasons and teams</h2>
          <p className="muted">Manage the current season and its public team names.</p>
          <Link className="button" href={`/admin/${organizationId}/seasons`}>
            Manage seasons
          </Link>
        </article>
        <article className="card">
          <h2>Venues and fields</h2>
          <p className="muted">Set up the places and field details used for scheduling.</p>
          <Link className="button secondary" href={`/admin/${organizationId}/venues`}>
            Manage facilities
          </Link>
        </article>
        <article className="card">
          <h2>Audit history</h2>
          <p className="muted">Review attributable authoritative changes and request references.</p>
          <Link className="button secondary" href={`/admin/${organizationId}/audit`}>
            View audit
          </Link>
        </article>
      </div>
    </>
  );
}
