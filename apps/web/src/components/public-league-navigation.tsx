'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { browserApi } from '../lib/api-client';
import styles from './public-league-navigation.module.css';

const publicSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

interface LeagueRouteContext {
  readonly organizationSlug: string;
  readonly leagueSlug: string;
  readonly seasonSlug?: string;
  readonly leaguePath: string;
}

const isPublicSlug = (value: string | undefined): value is string =>
  value !== undefined && value.length >= 2 && value.length <= 80 && publicSlugPattern.test(value);

const contextFromPathname = (pathname: string): LeagueRouteContext | null => {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] !== 'leagues' || !isPublicSlug(parts[1]) || !isPublicSlug(parts[2])) {
    return null;
  }

  const seasonSlug = parts[3] === 'seasons' && isPublicSlug(parts[4]) ? parts[4] : undefined;
  return {
    organizationSlug: parts[1],
    leagueSlug: parts[2],
    ...(seasonSlug ? { seasonSlug } : {}),
    leaguePath: `/leagues/${parts[1]}/${parts[2]}`,
  };
};

const activeDestination = (
  pathname: string,
  href: string,
  destination: 'home' | 'schedule' | 'teams' | 'sign-in',
): boolean => {
  if (destination === 'teams') return pathname === href || pathname.startsWith(`${href}/`);
  return pathname === href;
};

function NavigationLink({
  active,
  href,
  label,
  button = false,
}: {
  readonly active: boolean;
  readonly href: string;
  readonly label: string;
  readonly button?: boolean;
}) {
  const className = [button ? 'button secondary' : '', styles.link, active ? styles.active : '']
    .filter(Boolean)
    .join(' ');
  return (
    <Link aria-current={active ? 'page' : undefined} className={className} href={href}>
      <span>{label}</span>
      {active ? (
        <span aria-hidden="true" className={styles.currentMarker}>
          Current
        </span>
      ) : null}
    </Link>
  );
}

function NavigationLinks({
  pathname,
  context,
  seasonSlug,
}: {
  readonly pathname: string;
  readonly context: LeagueRouteContext | null;
  readonly seasonSlug?: string;
}) {
  const homeHref = context?.leaguePath ?? '/';
  const seasonPath = context && seasonSlug ? `${context.leaguePath}/seasons/${seasonSlug}` : null;
  const scheduleHref = seasonPath ? `${seasonPath}/schedule` : null;
  const teamsHref = seasonPath ? `${seasonPath}/teams` : null;

  return (
    <>
      <NavigationLink
        active={activeDestination(pathname, homeHref, 'home')}
        href={homeHref}
        label="Home"
      />
      {scheduleHref ? (
        <NavigationLink
          active={activeDestination(pathname, scheduleHref, 'schedule')}
          href={scheduleHref}
          label="Schedule"
        />
      ) : null}
      {teamsHref ? (
        <NavigationLink
          active={activeDestination(pathname, teamsHref, 'teams')}
          href={teamsHref}
          label="Teams"
        />
      ) : null}
      <NavigationLink
        active={activeDestination(pathname, '/sign-in', 'sign-in')}
        button
        href="/sign-in"
        label="Staff sign in"
      />
    </>
  );
}

export function PublicLeagueNavigation() {
  const pathname = usePathname();
  const mobileNavigation = useRef<HTMLDetailsElement>(null);
  const routeContext = contextFromPathname(pathname);
  const routeOrganizationSlug = routeContext?.organizationSlug;
  const routeLeagueSlug = routeContext?.leagueSlug;
  const routeSeasonSlug = routeContext?.seasonSlug;
  const routeKey = routeContext
    ? `${routeContext.organizationSlug}/${routeContext.leagueSlug}`
    : null;
  const [resolvedSeason, setResolvedSeason] = useState<{
    readonly routeKey: string;
    readonly seasonSlug: string | null;
  } | null>(null);

  useEffect(() => {
    if (!routeOrganizationSlug || !routeLeagueSlug || routeSeasonSlug || !routeKey) return;
    let active = true;
    void browserApi
      .getPublicLeague(routeOrganizationSlug, routeLeagueSlug)
      .then((league) => {
        if (active) {
          setResolvedSeason({
            routeKey,
            seasonSlug: league.currentSeason?.slug ?? null,
          });
        }
      })
      .catch(() => {
        if (active) setResolvedSeason({ routeKey, seasonSlug: null });
      });
    return () => {
      active = false;
    };
  }, [routeKey, routeLeagueSlug, routeOrganizationSlug, routeSeasonSlug]);

  useEffect(() => {
    mobileNavigation.current?.removeAttribute('open');
  }, [pathname]);

  const seasonSlug =
    routeContext?.seasonSlug ??
    (resolvedSeason?.routeKey === routeKey ? (resolvedSeason.seasonSlug ?? undefined) : undefined);

  return (
    <>
      <nav aria-label="Primary" className="site-nav desktop-site-nav">
        <NavigationLinks context={routeContext} pathname={pathname} seasonSlug={seasonSlug} />
      </nav>
      <details className="mobile-nav" ref={mobileNavigation}>
        <summary aria-controls="mobile-primary-navigation" className="mobile-nav-trigger">
          Menu
        </summary>
        <nav
          aria-label="Mobile primary"
          className="mobile-nav-panel"
          id="mobile-primary-navigation"
        >
          <NavigationLinks context={routeContext} pathname={pathname} seasonSlug={seasonSlug} />
        </nav>
      </details>
    </>
  );
}
