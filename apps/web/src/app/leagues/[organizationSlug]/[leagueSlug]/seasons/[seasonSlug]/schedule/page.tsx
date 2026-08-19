import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Breadcrumbs } from '../../../../../../../components/breadcrumbs';
import { PublicSchedule } from '../../../../../../../components/public-schedule';
import {
  EmptyState,
  PageHeading,
  ServiceUnavailable,
} from '../../../../../../../components/site-shell';
import { ApiError, createServerApi } from '../../../../../../../lib/api-client';

interface PageParams {
  readonly organizationSlug: string;
  readonly leagueSlug: string;
  readonly seasonSlug: string;
}

export default async function PublicSchedulePage({
  params,
}: {
  readonly params: Promise<PageParams>;
}) {
  const { organizationSlug, leagueSlug, seasonSlug } = await params;
  try {
    const data = await createServerApi().getPublicSchedule(
      organizationSlug,
      leagueSlug,
      seasonSlug,
    );
    const leaguePath = `/leagues/${organizationSlug}/${leagueSlug}`;
    return (
      <main className="main-content" id="main-content">
        <div className="content-width">
          <Breadcrumbs
            items={[
              { href: '/', label: 'Home' },
              { href: leaguePath, label: data.league.name },
              { label: 'Schedule' },
            ]}
          />
          <PageHeading
            eyebrow={data.season.name}
            title="Schedule"
            description={`All times are shown in ${data.season.timezone}.`}
            actions={
              <Link className="button secondary" href={`${leaguePath}/seasons/${seasonSlug}/teams`}>
                View teams
              </Link>
            }
          />
          <div className="callout" role="note">
            <strong>Official status:</strong> Weather information supports a human decision. Only
            league staff publish cancellations or postponements.
          </div>
          {data.items.length ? (
            <PublicSchedule games={data.items} timezone={data.season.timezone} />
          ) : (
            <EmptyState title="No games published">
              <p>There are no published games for this season yet.</p>
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
