import type { LeagueSummary } from './api-client';

export function selectActiveLeagues(leagues: readonly LeagueSummary[]): readonly LeagueSummary[] {
  return leagues
    .filter((league) => league.active)
    .sort((left, right) => left.slug.localeCompare(right.slug));
}
