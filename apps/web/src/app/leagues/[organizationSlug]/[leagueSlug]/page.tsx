import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Breadcrumbs } from '../../../../components/breadcrumbs';
import { EmptyState, PageHeading, ServiceUnavailable } from '../../../../components/site-shell';
import { ApiError, createServerApi } from '../../../../lib/api-client';

interface PageParams {
  readonly organizationSlug: string;
  readonly leagueSlug: string;
}

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<PageParams>;
}): Promise<Metadata> {
  const { organizationSlug, leagueSlug } = await params;
  try {
    const data = await createServerApi().getPublicLeague(organizationSlug, leagueSlug);
    return {
      title: data.league.name,
      description: `Official information for ${data.league.name}.`,
    };
  } catch {
    return { title: 'League' };
  }
}

export default async function PublicLeaguePage({
  params,
}: {
  readonly params: Promise<PageParams>;
}) {
  const { organizationSlug, leagueSlug } = await params;
  try {
    const data = await createServerApi().getPublicLeague(organizationSlug, leagueSlug);
    const season = data.currentSeason;
    const leaguePath = `/leagues/${organizationSlug}/${leagueSlug}`;

    return (
      <main className="main-content" id="main-content">
        <div className="content-width">
          <Breadcrumbs items={[{ href: '/', label: 'Home' }, { label: data.league.name }]} />
          <PageHeading
            eyebrow={data.organization.name}
            title={data.league.name}
            description={
              season ? `${season.name} · ${season.timezone}` : 'Official league information'
            }
          />
          {season ? (
            <div className="grid">
              <article className="card">
                <p className="eyebrow">Published schedule</p>
                <h2>Game times and fields</h2>
                <p className="muted">
                  See the current schedule and game status published by the league.
                </p>
                <Link className="button" href={`${leaguePath}/seasons/${season.slug}/schedule`}>
                  View schedule
                </Link>
              </article>
              <article className="card">
                <p className="eyebrow">Teams</p>
                <h2>{season.name}</h2>
                <p className="muted">Browse approved public team pages for this season.</p>
                <Link
                  className="button secondary"
                  href={`${leaguePath}/seasons/${season.slug}/teams`}
                >
                  View teams
                </Link>
              </article>
            </div>
          ) : (
            <EmptyState title="No published season yet">
              <p>Check back after league staff publish the active season.</p>
            </EmptyState>
          )}
        </div>
      </main>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    return (
      <main className="main-content" id="main-content">
        <div className="content-width">
          <ServiceUnavailable requestId={error instanceof ApiError ? error.requestId : undefined} />
        </div>
      </main>
    );
  }
}
