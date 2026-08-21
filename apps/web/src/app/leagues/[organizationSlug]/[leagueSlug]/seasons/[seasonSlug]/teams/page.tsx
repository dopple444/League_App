import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Breadcrumbs } from '../../../../../../../components/breadcrumbs';
import { PublicTeamDirectory } from '../../../../../../../components/public-team-directory';
import { PageHeading, ServiceUnavailable } from '../../../../../../../components/site-shell';
import { ApiError, createServerApi } from '../../../../../../../lib/api-client';

interface PageParams {
  readonly organizationSlug: string;
  readonly leagueSlug: string;
  readonly seasonSlug: string;
}

export default async function PublicTeamsPage({
  params,
}: {
  readonly params: Promise<PageParams>;
}) {
  const { organizationSlug, leagueSlug, seasonSlug } = await params;
  try {
    const data = await createServerApi().getPublicTeams(organizationSlug, leagueSlug, seasonSlug);
    const leaguePath = `/leagues/${organizationSlug}/${leagueSlug}`;
    return (
      <main className="main-content" id="main-content">
        <div className="content-width">
          <Breadcrumbs
            items={[
              { href: '/', label: 'Home' },
              { href: leaguePath, label: data.league.name },
              { label: 'Teams' },
            ]}
          />
          <PageHeading
            eyebrow={data.season.name}
            title="Teams"
            description="Approved public team information."
            actions={
              <Link
                className="button secondary"
                href={`${leaguePath}/seasons/${seasonSlug}/schedule`}
              >
                View schedule
              </Link>
            }
          />
          <PublicTeamDirectory
            baseTeamUrl={`${leaguePath}/seasons/${seasonSlug}/teams`}
            teams={data.items}
          />
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
