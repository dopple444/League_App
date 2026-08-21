import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Breadcrumbs } from '../../../../../../../../components/breadcrumbs';
import { PublicSchedule } from '../../../../../../../../components/public-schedule';
import {
  EmptyState,
  PageHeading,
  ServiceUnavailable,
} from '../../../../../../../../components/site-shell';
import {
  ApiError,
  createServerApi,
  type PublicCollection,
  type PublicScheduleGame,
  type PublicTeam,
} from '../../../../../../../../lib/api-client';
import styles from './page.module.css';

interface PageParams {
  readonly organizationSlug: string;
  readonly leagueSlug: string;
  readonly seasonSlug: string;
  readonly teamSlug: string;
}

export default async function PublicTeamPage({ params }: { readonly params: Promise<PageParams> }) {
  const { organizationSlug, leagueSlug, seasonSlug, teamSlug } = await params;
  let teamData: PublicCollection<PublicTeam>;

  try {
    teamData = await createServerApi().getPublicTeams(organizationSlug, leagueSlug, seasonSlug);
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

  const team = teamData.items.find((item) => item.slug === teamSlug);
  if (!team) notFound();

  let scheduleState:
    | { readonly status: 'available'; readonly games: readonly PublicScheduleGame[] }
    | { readonly status: 'unpublished' }
    | { readonly status: 'unavailable'; readonly requestId?: string };
  try {
    const scheduleData = await createServerApi().getPublicSchedule(
      organizationSlug,
      leagueSlug,
      seasonSlug,
    );
    scheduleState = {
      status: 'available',
      games: scheduleData.items.filter(
        (game) =>
          game.homeTeam.teamSeasonId === team.teamSeasonId ||
          game.awayTeam.teamSeasonId === team.teamSeasonId,
      ),
    };
  } catch (error) {
    scheduleState =
      error instanceof ApiError && error.status === 404
        ? { status: 'unpublished' }
        : {
            status: 'unavailable',
            ...(error instanceof ApiError && error.requestId ? { requestId: error.requestId } : {}),
          };
  }
  const leaguePath = `/leagues/${organizationSlug}/${leagueSlug}`;

  return (
    <main className="main-content" id="main-content">
      <div className={`content-width ${styles.page}`}>
        <Breadcrumbs
          items={[
            { href: '/', label: 'Home' },
            { href: leaguePath, label: teamData.league.name },
            { href: `${leaguePath}/seasons/${seasonSlug}/teams`, label: 'Teams' },
            { label: team.publicName },
          ]}
        />
        <PageHeading
          eyebrow={teamData.season.name}
          title={team.publicName}
          description="Official public team page"
          actions={
            <Link className="button" href={`${leaguePath}/seasons/${seasonSlug}/schedule`}>
              View full schedule
            </Link>
          }
        />
        <section className="card">
          <h2>Team information</h2>
          <p className="muted">
            Only information approved for public display by the league appears here.
          </p>
        </section>
        <section aria-labelledby="team-schedule-heading" className={styles.scheduleSection}>
          <div>
            <p className="eyebrow">Published schedule</p>
            <h2 id="team-schedule-heading">Games for {team.publicName}</h2>
          </div>
          {scheduleState.status === 'available' && scheduleState.games.length ? (
            <PublicSchedule
              dateHeadingLevel={3}
              games={scheduleState.games}
              showFilters={false}
              timezone={teamData.season.timezone}
            />
          ) : scheduleState.status === 'unavailable' ? (
            <EmptyState title="Published schedule temporarily unavailable">
              <p>
                Please check your connection and try again. The approved team page is still safe.
              </p>
              {scheduleState.requestId ? (
                <p className="meta">Support reference: {scheduleState.requestId}</p>
              ) : null}
            </EmptyState>
          ) : scheduleState.status === 'unpublished' ? (
            <EmptyState title="No team schedule published">
              <p>Check back after league staff publish this season&rsquo;s schedule.</p>
            </EmptyState>
          ) : (
            <EmptyState title="No games published for this team">
              <p>Check back after league staff publish this team&rsquo;s schedule.</p>
            </EmptyState>
          )}
        </section>
      </div>
    </main>
  );
}
