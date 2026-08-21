import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Breadcrumbs } from '../../../../components/breadcrumbs';
import {
  EmptyState,
  PageHeading,
  ServiceUnavailable,
  StatusBadge,
} from '../../../../components/site-shell';
import { ApiError, createServerApi, type PublicLeague } from '../../../../lib/api-client';

interface PageParams {
  readonly organizationSlug: string;
  readonly leagueSlug: string;
}

const formatGameTime = (startsAt: string, timezone: string): string => {
  const parsed = new Date(startsAt);
  if (Number.isNaN(parsed.getTime())) return 'Time to be announced';
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timezone,
    }).format(parsed);
  } catch {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC',
    }).format(parsed);
  }
};

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
  const api = createServerApi();
  let data: PublicLeague;
  try {
    data = await api.getPublicLeague(organizationSlug, leagueSlug);
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

  const season = data.currentSeason;
  const leaguePath = `/leagues/${organizationSlug}/${leagueSlug}`;
  let scheduleUnavailable = false;
  let scheduleRequestId: string | undefined;
  let scheduleItems = [] as Awaited<ReturnType<typeof api.getPublicSchedule>>['items'];
  if (season) {
    try {
      scheduleItems = (await api.getPublicSchedule(organizationSlug, leagueSlug, season.slug))
        .items;
    } catch (error) {
      scheduleUnavailable = true;
      if (error instanceof ApiError) scheduleRequestId = error.requestId;
    }
  }
  const now = Date.now();
  const upcomingGames = [...scheduleItems]
    .filter((game) => {
      const start = new Date(game.startsAt).getTime();
      return Number.isFinite(start) && start >= now;
    })
    .sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt))
    .slice(0, 4);

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
          actions={
            season ? (
              <>
                <Link className="button" href={`${leaguePath}/seasons/${season.slug}/schedule`}>
                  Schedule
                </Link>
                <Link
                  className="button secondary"
                  href={`${leaguePath}/seasons/${season.slug}/teams`}
                >
                  Teams
                </Link>
              </>
            ) : undefined
          }
        />
        {season ? (
          <section aria-labelledby="upcoming-games-heading">
            <p className="eyebrow">Published schedule</p>
            <h2 id="upcoming-games-heading">Upcoming games</h2>
            {scheduleUnavailable ? (
              <EmptyState title="Published schedule unavailable">
                <p>We could not load upcoming games. Please try again later.</p>
                {scheduleRequestId ? (
                  <p className="meta">Support reference: {scheduleRequestId}</p>
                ) : null}
              </EmptyState>
            ) : upcomingGames.length ? (
              <div className="grid">
                {upcomingGames.map((game) => (
                  <article className="card" key={game.gameId}>
                    <StatusBadge value={game.status} />
                    <h3>
                      {game.awayTeam.publicName} at {game.homeTeam.publicName}
                    </h3>
                    <p>{formatGameTime(game.startsAt, season.timezone)}</p>
                    <p className="muted">{game.field.name}</p>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                action={
                  <Link
                    className="button secondary"
                    href={`${leaguePath}/seasons/${season.slug}/schedule`}
                  >
                    View published schedule
                  </Link>
                }
                title="No upcoming games published"
              >
                <p>Check the full schedule for published dates and game information.</p>
              </EmptyState>
            )}
          </section>
        ) : (
          <EmptyState title="No published season yet">
            <p>Check back after league staff publish the active season.</p>
          </EmptyState>
        )}
      </div>
    </main>
  );
}
