import Link from 'next/link';

import { ApiError, createServerApi, type PublicLeague } from '../lib/api-client';
import { publicLeaguePath, readFeaturedPublicLeagueConfig } from '../lib/public-site-config';

// Deployment-selected league settings are supplied to the web container at runtime.
export const dynamic = 'force-dynamic';

type FeaturedLeagueState =
  | { readonly status: 'available'; readonly href: string; readonly league: PublicLeague }
  | { readonly status: 'not-found' }
  | { readonly status: 'unavailable'; readonly requestId?: string }
  | { readonly status: 'unconfigured' };

const resolveFeaturedLeague = async (): Promise<FeaturedLeagueState> => {
  const configuration = readFeaturedPublicLeagueConfig();
  if (configuration.status !== 'configured') return { status: 'unconfigured' };

  try {
    return {
      status: 'available',
      href: publicLeaguePath(configuration.value),
      league: await createServerApi().getPublicLeague(
        configuration.value.organizationSlug,
        configuration.value.leagueSlug,
      ),
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return { status: 'not-found' };
    return {
      status: 'unavailable',
      ...(error instanceof ApiError && error.requestId ? { requestId: error.requestId } : {}),
    };
  }
};

function FeaturedLeagueCard({ state }: { readonly state: FeaturedLeagueState }) {
  if (state.status === 'available') {
    return (
      <aside className="hero-card" aria-labelledby="featured-league-heading">
        <p className="eyebrow">Featured published league</p>
        <h2 id="featured-league-heading">{state.league.league.name}</h2>
        <p>{state.league.organization.name}</p>
        <p className="muted">
          {state.league.currentSeason
            ? `Current published season: ${state.league.currentSeason.name}`
            : 'Official league information published by authorized staff.'}
        </p>
        <div className="action-row">
          <Link className="button" href={state.href}>
            Open league
          </Link>
          <Link className="button secondary" href="/sign-in">
            Staff sign in
          </Link>
        </div>
      </aside>
    );
  }

  const content =
    state.status === 'not-found'
      ? {
          eyebrow: 'Public link unavailable',
          title: 'This league is not currently published.',
          description:
            'Use the public link supplied by your league or check back after authorized staff publish it.',
        }
      : state.status === 'unavailable'
        ? {
            eyebrow: 'Temporarily unavailable',
            title: 'We could not open the featured league.',
            description:
              'Please check your connection and try again. No private information was shown.',
          }
        : {
            eyebrow: 'Find your league',
            title: 'Use the public link from your league.',
            description:
              'League Hub does not publish a directory of organizations. Your league will provide its official link.',
          };

  return (
    <aside className="hero-card" aria-labelledby="featured-league-heading">
      <p className="eyebrow">{content.eyebrow}</p>
      <h2 id="featured-league-heading">{content.title}</h2>
      <p>{content.description}</p>
      {state.status === 'unavailable' && state.requestId ? (
        <p className="meta">Support reference: {state.requestId}</p>
      ) : null}
      <Link className="button secondary" href="/sign-in">
        Staff sign in
      </Link>
    </aside>
  );
}

export default async function HomePage() {
  const featuredLeague = await resolveFeaturedLeague();
  return (
    <main className="main-content" id="main-content">
      <div className="content-width">
        <section className="hero">
          <div>
            <p className="eyebrow">The official league source</p>
            <h1>One place for every game night.</h1>
            <p className="lede">
              See the schedule and public team information your league has reviewed and published.
              Staff updates stay traceable from draft to public release.
            </p>
          </div>
          <FeaturedLeagueCard state={featuredLeague} />
        </section>
        <section aria-labelledby="features-heading" id="league-features">
          <p className="eyebrow">Built for league day</p>
          <h2 id="features-heading">Clear information, wherever you are.</h2>
          <div className="grid feature-grid">
            <article className="card">
              <h3>Public schedules</h3>
              <p className="muted">
                Game times, matchups, statuses, fields, and approved directions.
              </p>
            </article>
            <article className="card">
              <h3>Safe team pages</h3>
              <p className="muted">
                Only explicitly approved public team names are displayed. Draft seasons and private
                participant information never appear on public pages.
              </p>
            </article>
            <article className="card">
              <h3>Audited administration</h3>
              <p className="muted">
                Authorized changes carry versions, request references, and history.
              </p>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
