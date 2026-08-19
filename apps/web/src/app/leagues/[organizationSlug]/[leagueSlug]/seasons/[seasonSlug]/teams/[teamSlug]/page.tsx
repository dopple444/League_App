import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Breadcrumbs } from '../../../../../../../../components/breadcrumbs';
import { PageHeading, ServiceUnavailable } from '../../../../../../../../components/site-shell';
import { ApiError, createServerApi } from '../../../../../../../../lib/api-client';

interface PageParams {
  readonly organizationSlug: string;
  readonly leagueSlug: string;
  readonly seasonSlug: string;
  readonly teamSlug: string;
}

export default async function PublicTeamPage({ params }: { readonly params: Promise<PageParams> }) {
  const { organizationSlug, leagueSlug, seasonSlug, teamSlug } = await params;
  try {
    const data = await createServerApi().getPublicTeams(organizationSlug, leagueSlug, seasonSlug);
    const team = data.items.find((item) => item.slug === teamSlug);
    if (!team) notFound();
    const leaguePath = `/leagues/${organizationSlug}/${leagueSlug}`;
    return (
      <main className="main-content" id="main-content">
        <div className="content-width">
          <Breadcrumbs
            items={[
              { href: '/', label: 'Home' },
              { href: leaguePath, label: data.league.name },
              { href: `${leaguePath}/seasons/${seasonSlug}/teams`, label: 'Teams' },
              { label: team.publicName },
            ]}
          />
          <PageHeading
            eyebrow={data.season.name}
            title={team.publicName}
            description="Official public team page"
            actions={
              <Link className="button" href={`${leaguePath}/seasons/${seasonSlug}/schedule`}>
                View schedule
              </Link>
            }
          />
          <section className="card">
            <h2>Team information</h2>
            <p className="muted">
              Only information approved for public display by the league appears here.
            </p>
          </section>
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
